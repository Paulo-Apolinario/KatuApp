import { prisma } from "../../lib/prisma";
import { operationalOverview } from "../dashboard/dashboard-operations";
import { refreshAlerts } from "../settings/settings.alerts";
import { LIMITS, type Analysis, type Command } from "./agents.types";
export async function analyzeManager(
  cooperativeId: string,
  command: Command,
  now = new Date(),
): Promise<Analysis> {
  // Same alert engine as the existing central. This refreshes alert metadata, never domain operations or email delivery.
  const refreshed = await refreshAlerts(cooperativeId);
  const [overview, alerts, total] = await Promise.all([
    operationalOverview(cooperativeId),
    prisma.systemAlert.findMany({
      where: {
        cooperativeId,
        status: "OPEN",
        OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }],
      },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      take: LIMITS.records + 1,
      select: {
        id: true,
        category: true,
        priority: true,
        title: true,
        message: true,
        link: true,
        cycle: true,
        updatedAt: true,
      },
    }),
    prisma.systemAlert.count({
      where: {
        cooperativeId,
        status: "OPEN",
        OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }],
      },
    }),
  ]);
  // Priority is a string in the existing model; do not rely on alphabetical ordering.
  const ordered = alerts
    .slice(0, LIMITS.records)
    .sort(
      (a, b) =>
        (({ CRITICAL: 0, WARNING: 1, INFO: 2 })[a.priority] ?? 3) -
        ({ CRITICAL: 0, WARNING: 1, INFO: 2 }[b.priority] ?? 3),
    );
  const items = ordered.map((a) => ({
    kind: "SYSTEM_ALERT",
    id: a.id,
    title: a.title,
    href: a.link,
    reasons: [a.message],
    status: a.priority,
  }));
  return {
    agent: "MANAGER",
    command,
    generatedAt: now.toISOString(),
    summary: `${overview.requested} pendência(s) de atendimento; ${overview.inProgress} operação(ões) em campo; ${overview.awaitingReceipt} coleta(s) aguardando recebimento.`,
    counts: {
      pendingRequests: overview.requested,
      fieldOperations: overview.inProgress,
      awaitingReceipt: overview.awaitingReceipt,
      awaitingReview: overview.reviewPending,
      pendingDestination: overview.pendingDestination,
      openAlerts: total,
    },
    indicators: {
      requestSources: overview.requestSources,
      fieldSources: overview.fieldSources,
      pendingUnits: overview.pendingUnits,
      intermediateEntries: overview.intermediateEntries,
    },
    items,
    truncated: alerts.length > LIMITS.records || refreshed.truncated,
    warnings: [
      "Quantidades em kg e litros são mantidas separadas. As ocorrências reutilizam a central de alertas e seus adiamentos.",
    ],
    method:
      "Resumo consolidado do dashboard existente e motor de alertas existente.",
    proposals: ordered
      .filter((a) => a.priority === "CRITICAL")
      .slice(0, LIMITS.proposals)
      .map((a) => ({
        kind: "REVIEW_OCCURRENCE",
        title: a.title,
        description:
          "Conferir a ocorrência na central existente; nenhuma ação operacional será executada pelo agente.",
        evidence: { alertId: a.id, cycle: a.cycle, href: a.link },
      })),
  };
}
