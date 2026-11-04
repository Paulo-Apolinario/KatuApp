import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import {
  LIMITS,
  type Analysis,
  type Command,
  type Finding,
} from "./agents.types";
const extraCommands: Command[] = [
  "TODAY_COLLECTIONS",
  "ROUTES_WITHOUT_RESOURCES",
  "PENDING_PROPOSALS",
  "AUTOMATION_HEALTH",
];
/** Bounded read-only queries. Counts and records always include the authenticated cooperative. */
export async function additionalAnalysis(
  cooperativeId: string,
  command: Command,
  now = new Date(),
): Promise<Analysis | null> {
  if (!extraCommands.includes(command)) return null;
  const result: Analysis = {
    agent:
      command === "TODAY_COLLECTIONS"
        ? "COLLECTIONS"
        : command === "ROUTES_WITHOUT_RESOURCES"
          ? "ROUTES"
          : "MANAGER",
    command,
    generatedAt: now.toISOString(),
    summary: "",
    counts: {},
    items: [],
    warnings: [],
    truncated: false,
    method:
      "Consulta determinística somente de leitura, com contagem total e lista limitada por cooperativa.",
    proposals: [],
  };
  if (command === "TODAY_COLLECTIONS") {
    const day = new Date(+now - 3 * 3600000).toISOString().slice(0, 10);
    const gte = new Date(`${day}T00:00:00-03:00`),
      lt = new Date(+gte + 86400000);
    const period = { gte, lt };
    const schedules: Prisma.ScheduleWhereInput = {
      cooperativeId,
      status: { not: "CANCELLED" },
      scheduledDate: period,
      collections: { none: {} },
    };
    const collections: Prisma.CollectionWhereInput = {
      cooperativeId,
      status: { not: "CANCELLED" },
      OR: [
        { schedule: { cooperativeId, scheduledDate: period } },
        { scheduleId: null, route: { cooperativeId, scheduledDate: period } },
      ],
    };
    const [totalCollections, totalSchedules, rows, requests] =
      await Promise.all([
        prisma.collection.count({ where: collections }),
        prisma.schedule.count({ where: schedules }),
        prisma.collection.findMany({
          where: collections,
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: 51,
          select: {
            id: true,
            status: true,
            generator: { select: { name: true } },
            schedule: { select: { scheduledDate: true } },
            route: { select: { name: true, scheduledDate: true } },
          },
        }),
        prisma.schedule.findMany({
          where: schedules,
          orderBy: [{ scheduledDate: "asc" }, { id: "asc" }],
          take: 51,
          select: {
            id: true,
            status: true,
            scheduledDate: true,
            generator: { select: { name: true } },
          },
        }),
      ]);
    result.counts = {
      todayCollections: totalCollections,
      todayUnassignedRequests: totalSchedules,
    };
    result.summary = `Programação de ${day.split("-").reverse().join("/")} no fuso do Ceará: ${totalCollections} coleta(s) e ${totalSchedules} solicitação(ões) ainda sem coleta vinculada.`;
    result.items = [
      ...rows
        .slice(0, 50)
        .map((c): Finding => ({
          kind: "COLLECTION",
          id: c.id,
          title: c.generator?.name || c.route?.name || "Coleta operacional",
          status: c.status,
          date: (
            c.schedule?.scheduledDate || c.route?.scheduledDate
          )?.toISOString(),
          href: `/waste-list?coleta=${encodeURIComponent(c.id)}`,
          reasons: [
            "Programada para hoje; confira a etapa atual antes de mobilizar a equipe.",
          ],
        })),
      ...requests
        .slice(0, 50)
        .map((s): Finding => ({
          kind: "SCHEDULE",
          id: s.id,
          title: s.generator?.name || "Solicitação avulsa",
          status: s.status,
          date: s.scheduledDate?.toISOString(),
          href: "/collection-requests",
          reasons: [
            "Programada para hoje e ainda sem coleta operacional vinculada.",
          ],
        })),
    ];
    result.truncated = rows.length > 50 || requests.length > 50;
    result.warnings = [
      "Usa a data programada, não a criação ou apenas a data desejada. Registros cancelados são excluídos. Uma solicitação vinculada à coleta não é contada novamente; etapas encerradas continuam identificadas na lista do dia.",
    ];
  }
  if (command === "ROUTES_WITHOUT_RESOURCES") {
    const where: Prisma.RouteWhereInput = {
      cooperativeId,
      status: { in: ["SCHEDULED", "IN_PROGRESS"] },
      OR: [{ driverId: null }, { vehicleId: null }],
    };
    const [total, withoutDriver, withoutVehicle, rows] = await Promise.all([
      prisma.route.count({ where }),
      prisma.route.count({ where: { ...where, driverId: null } }),
      prisma.route.count({ where: { ...where, vehicleId: null } }),
      prisma.route.findMany({
        where,
        orderBy: [{ scheduledDate: "asc" }, { id: "asc" }],
        take: LIMITS.records + 1,
        select: {
          id: true,
          name: true,
          status: true,
          scheduledDate: true,
          driverId: true,
          vehicleId: true,
        },
      }),
    ]);
    result.summary = `${total} rota(s) ativa(s) sem motorista ou veículo definido.`;
    result.counts = {
      routesWithoutResources: total,
      routesWithoutDriver: withoutDriver,
      routesWithoutVehicle: withoutVehicle,
    };
    result.items = rows
      .slice(0, LIMITS.records)
      .map((r) => ({
        kind: "ROUTE",
        id: r.id,
        title: r.name,
        status: r.status,
        date: r.scheduledDate?.toISOString(),
        href: `/edit-route/${encodeURIComponent(r.id)}`,
        reasons: [
          ...(!r.driverId ? ["Motorista não definido."] : []),
          ...(!r.vehicleId ? ["Veículo não definido."] : []),
        ],
      }));
    result.truncated = rows.length > LIMITS.records;
    result.warnings = [
      "Uma mesma rota pode estar sem ambos os recursos. Esta consulta verifica vínculos ausentes; use a análise de atenção das rotas para indisponibilidade e conflitos.",
    ];
  }
  if (command === "PENDING_PROPOSALS") {
    const where = { cooperativeId, status: "PENDING" as const };
    const [total, rows] = await Promise.all([
      prisma.agentProposal.count({ where }),
      prisma.agentProposal.findMany({
        where,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: LIMITS.records + 1,
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);
    result.summary = `${total} recomendação(ões) aguardando revisão humana.`;
    result.counts = { pendingProposals: total };
    result.items = rows
      .slice(0, LIMITS.records)
      .map((p) => ({
        kind: "AGENT_PROPOSAL",
        id: p.id,
        title: p.title,
        status: p.status,
        date: p.createdAt.toISOString(),
        href: "/agents",
        reasons: [
          p.description,
          "Confira a aba Recomendações e a atualidade dos dados antes de decidir. Esta consulta não aprova nem executa a proposta.",
        ],
      }));
    result.truncated = rows.length > LIMITS.records;
    result.warnings = [
      "Pendente significa sem decisão registrada, não confirmação de que a recomendação continua atual. A atualidade é verificada no fluxo de revisão existente.",
    ];
  }
  if (command === "AUTOMATION_HEALTH") {
    const failedWhere = {
      cooperativeId,
      status: "FAILED" as const,
      startedAt: { gte: new Date(+now - 86400000) },
    };
    const deliveryWhere: Prisma.AgentEventDeliveryWhereInput = {
      cooperativeId,
      status: { in: ["PENDING", "PROCESSING", "DEAD"] },
    };
    const [failed, waiting, processing, dead, runs, deliveries] =
      await Promise.all([
        prisma.agentRun.count({ where: failedWhere }),
        prisma.agentEventDelivery.count({
          where: { cooperativeId, status: "PENDING" },
        }),
        prisma.agentEventDelivery.count({
          where: { cooperativeId, status: "PROCESSING" },
        }),
        prisma.agentEventDelivery.count({
          where: { cooperativeId, status: "DEAD" },
        }),
        prisma.agentRun.findMany({
          where: failedWhere,
          orderBy: [{ startedAt: "desc" }, { id: "desc" }],
          take: 51,
          select: { id: true, agent: true, status: true, startedAt: true },
        }),
        prisma.agentEventDelivery.findMany({
          where: deliveryWhere,
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: 51,
          select: {
            id: true,
            agent: true,
            status: true,
            attempts: true,
            createdAt: true,
          },
        }),
      ]);
    result.summary = `${failed} análise(s) com falha nas últimas 24h; ${waiting} entrega(s) pendente(s), ${processing} em processamento e ${dead} que precisam de revisão.`;
    result.counts = {
      failedAnalyses24h: failed,
      pendingEventDeliveries: waiting,
      processingEventDeliveries: processing,
      deadEventDeliveries: dead,
    };
    result.items = [
      ...runs
        .slice(0, 50)
        .map((r): Finding => ({
          kind: "AGENT_RUN",
          id: r.id,
          title: "Análise com falha",
          status: r.status,
          date: r.startedAt.toISOString(),
          href: "/agents",
          reasons: [
            "Consulte os detalhes na aba Análises. Nenhuma retentativa foi solicitada por este comando.",
          ],
        })),
      ...deliveries
        .slice(0, 50)
        .map((d): Finding => ({
          kind: "AGENT_EVENT_DELIVERY",
          id: d.id,
          title: "Entrega de evento operacional",
          status: d.status,
          date: d.createdAt.toISOString(),
          href: "/agents",
          reasons: [
            `${d.attempts} tentativa(s) registrada(s). Consulte a aba Eventos operacionais.`,
          ],
        })),
    ];
    result.truncated = runs.length > 50 || deliveries.length > 50;
    result.warnings = [
      "Pendências podem aguardar o intervalo configurado, limites de uso ou agente desabilitado; não significam, por si só, falha. Entregas de um mesmo evento para agentes diferentes são contadas separadamente. Falhas de análise usam 24h; a fila e entregas que precisam de revisão usam todo o histórico ainda nesse estado.",
    ];
  }
  return result;
}
