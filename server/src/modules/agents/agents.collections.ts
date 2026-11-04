import { otherRequestSources } from "./agents.request-sources";
import { prisma } from "../../lib/prisma";
import { defaults } from "../settings/settings.schemas";
import {
  LIMITS,
  type Analysis,
  type Command,
  type Finding,
  type ProposalDraft,
} from "./agents.types";
const civilDay = (d: Date) =>
  new Date(d.getTime() - 3 * 3600000).toISOString().slice(0, 10);
export async function analyzeCollections(
  cooperativeId: string,
  command: Command,
  now = new Date(),
): Promise<Analysis> {
  const settings = await prisma.cooperativeSettings.findUnique({
    where: { cooperativeId },
    select: { payload: true },
  });
  const hours = Number(
    (settings?.payload as any)?.preferences?.collectionOverdueHours ??
      defaults.preferences.collectionOverdueHours,
  );
  const overdueHours =
    Number.isFinite(hours) && hours >= 1 && hours <= 720
      ? hours
      : defaults.preferences.collectionOverdueHours;
  const before = new Date(+now - overdueHours * 3600000);
  const where = {
    cooperativeId,
    status: {
      in: ["REQUESTED", "SCHEDULED", "IN_PROGRESS"] as (
        "REQUESTED" | "SCHEDULED" | "IN_PROGRESS"
      )[],
    },
  };
  const [rows, total, collections, collectionTotal] = await Promise.all([
    prisma.schedule.findMany({
      where,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: LIMITS.records + 1,
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        scheduledDate: true,
        preferredDate: true,
        pickupAddress: true,
        generator: {
          select: { id: true, name: true, neighborhood: true, city: true },
        },
        collections: { select: { id: true, status: true, routeId: true } },
      },
    }),
    prisma.schedule.count({ where }),
    prisma.collection.findMany({
      where: { cooperativeId, status: { in: ["PENDING", "IN_PROGRESS"] } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: LIMITS.records + 1,
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        collectorId: true,
        driverId: true,
        vehicleId: true,
        routeId: true,
        schedule: { select: { scheduledDate: true } },
        route: { select: { scheduledDate: true, status: true } },
      },
    }),
    prisma.collection.count({
      where: { cooperativeId, status: { in: ["PENDING", "IN_PROGRESS"] } },
    }),
  ]);
  const overdue = (x: (typeof rows)[number]) =>
    +(x.scheduledDate || x.preferredDate || x.createdAt) < +before;
  const items: Finding[] = [];
  for (const x of rows.slice(0, LIMITS.records)) {
    const reasons: string[] = [];
    if (overdue(x))
      reasons.push(
        `Referência de data ultrapassou ${overdueHours} hora(s); confirmar atendimento.`,
      );
    if (x.status === "REQUESTED")
      reasons.push("Solicitação aguardando análise da cooperativa.");
    if (x.status === "SCHEDULED" && !x.collections.length)
      reasons.push("Agendamento sem coleta operacional vinculada.");
    if (
      x.status === "IN_PROGRESS" &&
      !x.collections.some((c) =>
        ["PENDING", "IN_PROGRESS", "COLLECTED", "RECEIVED", "SORTING"].includes(
          c.status,
        ),
      )
    )
      reasons.push("Solicitação em andamento sem coleta ativa correspondente.");
    if (
      x.collections.some((c) => ["COMPLETED", "CANCELLED"].includes(c.status))
    )
      reasons.push(
        "Solicitação ativa possui coleta encerrada; revisar consistência de status.",
      );
    if (command === "OVERDUE_REQUESTS" && !overdue(x)) continue;
    items.push({
      kind: "SCHEDULE",
      id: x.id,
      title: x.generator?.name || "Solicitação avulsa",
      status: x.status,
      date: (x.scheduledDate || x.preferredDate || x.createdAt).toISOString(),
      href: "/collection-requests",
      reasons,
    });
  }
  if (command !== "OVERDUE_REQUESTS")
    for (const c of collections.slice(0, LIMITS.records)) {
      const reasons: string[] = [];
      const date = c.schedule?.scheduledDate || c.route?.scheduledDate;
      if (date && +date < +before)
        reasons.push("Programação vencida e etapa de campo pendente.");
      if (!c.collectorId && !c.routeId)
        reasons.push("Coleta individual sem catador definido.");
      if (c.route && ["COMPLETED", "CANCELLED"].includes(c.route.status))
        reasons.push(
          "Coleta pendente em rota encerrada; conferir o desfecho do ponto.",
        );
      if (command === "COLLECTION_PRIORITIES" && !reasons.length) continue;
      items.push({
        kind: "COLLECTION",
        id: c.id,
        title: "Coleta operacional",
        status: c.status,
        date: date?.toISOString() || null,
        href: `/waste-list?coleta=${encodeURIComponent(c.id)}`,
        reasons,
      });
    }
  const other = await otherRequestSources(
    cooperativeId,
    before,
    command === "OVERDUE_REQUESTS",
  );
  items.push(...other.items);
  items.sort(
    (a, b) =>
      b.reasons.length - a.reasons.length ||
      (a.date || "9999").localeCompare(b.date || "9999") ||
      a.id.localeCompare(b.id),
  );
  const groups = new Map<string, typeof rows>();
  for (const x of rows.slice(0, LIMITS.records)) {
    if (
      x.collections.length ||
      x.status === "IN_PROGRESS" ||
      !x.generator?.neighborhood ||
      !x.generator.city
    )
      continue;
    // Group only requests with a real intended day. Never assume today for undated requests.
    const date = x.scheduledDate || x.preferredDate;
    if (!date) continue;
    const key = [
      civilDay(date),
      x.generator.city.trim().toLocaleLowerCase("pt-BR"),
      x.generator.neighborhood.trim().toLocaleLowerCase("pt-BR"),
    ].join("|");
    const group = groups.get(key) || [];
    group.push(x);
    groups.set(key, group);
  }
  const proposals: ProposalDraft[] = [];
  if (command === "COLLECTION_PRIORITIES")
    for (const [area, group] of groups) {
      if (group.length < 2) continue;
      proposals.push({
        kind: "GROUP_COLLECTIONS",
        title: `Avaliar agrupamento de ${group.length} solicitações`,
        description:
          "Mesmo bairro, município e dia de referência. A equipe deve conferir endereços, capacidade e janelas antes de planejar; nenhuma rota foi criada.",
        evidence: {
          area,
          records: group
            .map((x) => ({ id: x.id, updatedAt: x.updatedAt.toISOString() }))
            .sort((a, b) => a.id.localeCompare(b.id)),
          href: "/collection-requests",
        },
      });
    }
  return {
    agent: "COLLECTIONS",
    command,
    generatedAt: now.toISOString(),
    summary: items.length
      ? "Pendências encontradas; priorização por sinais explícitos e antiguidade."
      : "Nenhuma pendência encontrada no recorte consultado.",
    counts: {
      activeRequests: total,
      extraOrdersAwaitingReview: other.extraTotal,
      pevReportsAwaitingCollection: other.pevTotal,
      fieldPendingCollections: collectionTotal,
      overdueRequestsInSample: rows.slice(0, LIMITS.records).filter(overdue)
        .length,
    },
    items: items.slice(0, LIMITS.records),
    truncated:
      other.truncated ||
      rows.length > LIMITS.records ||
      collections.length > LIMITS.records ||
      items.length > LIMITS.records,
    warnings: [
      "Solicitações e coletas são contagens distintas e não devem ser somadas como atendimentos únicos.",
      "Data desejada e antiguidade são sinais de revisão, não confirmação de prazo contratual.",
    ],
    method: `Regras determinísticas; limite de ${LIMITS.records} registros por fonte, atraso após ${overdueHours} hora(s).`,
    proposals: proposals.slice(0, LIMITS.proposals),
  };
}
