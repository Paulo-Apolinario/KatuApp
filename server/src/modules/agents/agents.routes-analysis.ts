import { prisma } from "../../lib/prisma";
import {
  checkConflict,
  validateTeam,
  validatePoints,
} from "../routes/planning.service";
import { suggestSequence } from "../routes/road-routing";
import { optimizeSchema } from "../routes/planning.schemas";
import {
  LIMITS,
  type Analysis,
  type Command,
  type Finding,
  type ProposalDraft,
} from "./agents.types";
function distance(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const rad = Math.PI / 180,
    dl = (b.latitude - a.latitude) * rad,
    dn = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dl / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin(dn / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export async function analyzeRoutes(
  cooperativeId: string,
  command: Command,
  now = new Date(),
): Promise<Analysis> {
  const where = {
    cooperativeId,
    status: {
      in: ["SCHEDULED", "IN_PROGRESS"] as ("SCHEDULED" | "IN_PROGRESS")[],
    },
  };
  const [total, rows] = await Promise.all([
    prisma.route.count({ where }),
    prisma.route.findMany({
      where,
      orderBy: [{ scheduledDate: "asc" }, { id: "asc" }],
      take: LIMITS.records + 1,
      select: {
        id: true,
        driver: { select: { updatedAt: true } },
        vehicle: { select: { updatedAt: true } },
        cooperativeId: true,
        name: true,
        status: true,
        updatedAt: true,
        scheduledDate: true,
        driverId: true,
        vehicleId: true,
        collectorIds: true,
        teamId: true,
        estimatedMinutes: true,
        coverageMode: true,
        coverageArea: true,
        collectionOrder: true,
        startPoint: true,
        endPoint: true,
        collections: {
          where: { status: { not: "CANCELLED" } },
          orderBy: { id: "asc" },
          take: 61,
          select: {
            id: true,
            routePoint: true,
            generator: {
              select: {
                id: true,
                name: true,
                latitude: true,
                longitude: true,
                street: true,
                address: true,
              },
            },
            bin: {
              select: {
                id: true,
                name: true,
                latitude: true,
                longitude: true,
                street: true,
              },
            },
          },
        },
      },
    }),
  ]);
  const collectors = await prisma.collector.findMany({
    where: {
      cooperativeId,
      id: {
        in: [
          ...new Set(
            rows.slice(0, LIMITS.records).flatMap((r) => r.collectorIds),
          ),
        ],
      },
    },
    orderBy: { id: "asc" },
    select: { id: true, updatedAt: true },
  });
  const items: Finding[] = [],
    proposals: ProposalDraft[] = [];
  let geometriesSkipped = 0;
  for (const [index, r] of rows.slice(0, LIMITS.records).entries()) {
    const reasons: string[] = [];
    if (!r.scheduledDate) reasons.push("Data de programação não definida.");
    else if (+r.scheduledDate < +now && r.status === "SCHEDULED")
      reasons.push("Programação vencida sem início registrado.");
    if (!r.driverId) reasons.push("Motorista não definido.");
    if (!r.vehicleId) reasons.push("Veículo não definido.");
    if (!r.collectorIds.length)
      reasons.push("Equipe de catadores não definida.");
    if (r.coverageMode === "POINTS" && !r.collections.length)
      reasons.push("Rota por pontos sem coleta vinculada.");
    if (r.coverageMode === "AREA" && !r.coverageArea)
      reasons.push("Área de cobertura não descrita.");
    if (index < LIMITS.routeValidation) {
      for (const validate of [
        () => validateTeam(prisma, cooperativeId, r),
        () => checkConflict(prisma, r),
      ]) {
        try {
          await validate();
        } catch (e: any) {
          if (e.code) throw e;
          reasons.push(e.message);
        }
      }
      const points = r.collections.map((c) => {
        if (c.routePoint && typeof c.routePoint === "object")
          return { ...(c.routePoint as any), key: c.id };
        const p = c.generator || c.bin;
        if (!p || p.latitude === null || p.longitude === null) return null;
        return {
          key: c.id,
          kind: c.generator ? "GENERATOR" : "PEV",
          sourceId: p.id,
          name: p.name || "Ponto",
          address:
            p.street ||
            ("address" in p ? p.address : null) ||
            "Endereço não informado",
          latitude: p.latitude,
          longitude: p.longitude,
        };
      });
      const input = optimizeSchema.safeParse({
        start: r.startPoint,
        end: r.endPoint,
        points,
      });
      if (input.success) {
        let valid = true;
        try {
          await validatePoints(
            prisma,
            cooperativeId,
            input.data.points,
            r.collectorIds,
          );
        } catch (e: any) {
          if (e.code) throw e;
          valid = false;
          reasons.push(e.message);
        }
        if (valid && command === "ROUTES_ATTENTION") {
          const ordered = [...input.data.points].sort((a, b) => {
            const ia = r.collectionOrder.indexOf(a.key),
              ib = r.collectionOrder.indexOf(b.key);
            return (
              (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) ||
              a.key.localeCompare(b.key)
            );
          });
          const all = [input.data.start, ...ordered, input.data.end];
          const matrix = all.map((a) => all.map((b) => distance(a, b)));
          const order = suggestSequence(matrix, ordered.length).map(
            (i) => ordered[i - 1].key,
          );
          if (order.some((id, i) => id !== ordered[i].key))
            proposals.push({
              kind: "REVIEW_ROUTE_SEQUENCE",
              title: `Avaliar sequência: ${r.name}`,
              description:
                "Sugestão por proximidade geométrica com o algoritmo de planejamento existente. Não representa percurso por ruas, trânsito ou economia garantida. Confira a ordem no planejamento.",
              evidence: {
                routeId: r.id,
                revisionAt: r.updatedAt.toISOString(),
                resources: {
                  driver: r.driver?.updatedAt.toISOString() || null,
                  vehicle: r.vehicle?.updatedAt.toISOString() || null,
                  collectors: collectors
                    .filter((c) => r.collectorIds.includes(c.id))
                    .map((c) => ({
                      id: c.id,
                      version: c.updatedAt.toISOString(),
                    })),
                },
                collectionIds: order,
                method: "GEOMETRIC_NEAREST_2OPT",
                href: `/edit-route/${encodeURIComponent(r.id)}`,
              },
            });
        }
      } else geometriesSkipped++;
    }
    if (command === "SCHEDULED_ROUTES" || reasons.length)
      items.push({
        kind: "ROUTE",
        id: r.id,
        title: r.name,
        status: r.status,
        date: r.scheduledDate?.toISOString() || null,
        href: `/edit-route/${encodeURIComponent(r.id)}`,
        reasons,
      });
    if (reasons.length && command === "ROUTES_ATTENTION")
      proposals.push({
        kind: "REVIEW_ROUTE",
        title: `Conferir rota: ${r.name}`,
        description: reasons.join(" "),
        evidence: {
          routeId: r.id,
          revisionAt: r.updatedAt.toISOString(),
          resources: {
            driver: r.driver?.updatedAt.toISOString() || null,
            vehicle: r.vehicle?.updatedAt.toISOString() || null,
            collectors: collectors
              .filter((c) => r.collectorIds.includes(c.id))
              .map((c) => ({ id: c.id, version: c.updatedAt.toISOString() })),
          },
          reasons,
          href: `/edit-route/${encodeURIComponent(r.id)}`,
        },
      });
  }
  return {
    agent: "ROUTES",
    command,
    generatedAt: now.toISOString(),
    summary: items.length
      ? "Programação consultada; revise os motivos apontados antes da saída."
      : "Nenhuma rota encontrada no recorte selecionado.",
    counts: {
      activeRoutes: total,
      listedRoutes: items.length,
      validatedRoutes: Math.min(rows.length, LIMITS.routeValidation),
    },
    items,
    warnings: [
      `Validações detalhadas de equipe, conflito e pontos limitadas às primeiras ${LIMITS.routeValidation} rotas.`,
      ...(geometriesSkipped
        ? [
            `${geometriesSkipped} rota(s) sem dados completos ou dentro do limite de 60 pontos para sugestão de sequência.`,
          ]
        : []),
    ],
    truncated:
      rows.length > LIMITS.records || rows.length > LIMITS.routeValidation,
    method:
      "Validações existentes de planejamento e sugestão geométrica local; sem requisição a serviços de mapas externos.",
    proposals: proposals.slice(0, LIMITS.proposals),
  };
}
