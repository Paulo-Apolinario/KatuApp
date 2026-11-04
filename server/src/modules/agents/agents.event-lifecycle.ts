import type { AgentConfig, AgentRun, Prisma } from "@prisma/client";
import { fingerprint } from "./agents.audit";
import { AgentError, LIMITS } from "./agents.types";
export const eventBatchKey = (rows: { id: string; attempts: number }[]) =>
  `event_${fingerprint(rows.map((x) => ({ id: x.id, attempt: x.attempts })).sort((a, b) => a.id.localeCompare(b.id))).slice(0, 60)}`;
export async function validateEventBatch(
  tx: Prisma.TransactionClient,
  cooperativeId: string,
  config: AgentConfig,
  eventId: string,
  ids: string[],
  now: Date,
) {
  if (!config.automationsEnabled || config.nextEventAt > now)
    throw new AgentError(
      409,
      "EVENT_COOLDOWN",
      "Análises por evento aguardam o intervalo configurado.",
    );
  if (
    !ids.length ||
    ids.length > LIMITS.eventBatch ||
    new Set(ids).size !== ids.length
  )
    throw new AgentError(
      409,
      "INVALID_EVENT_BATCH",
      "Lote de eventos inválido.",
    );
  const rows = await tx.agentEventDelivery.findMany({
    where: {
      id: { in: ids },
      cooperativeId,
      agent: config.agent,
      status: "PENDING",
      availableAt: { lte: now },
      expiresAt: { gt: now },
      attempts: { lt: LIMITS.eventAttempts },
    },
    select: { id: true, attempts: true },
  });
  if (rows.length !== ids.length || eventBatchKey(rows) !== eventId)
    throw new AgentError(
      409,
      "STALE_EVENT_BATCH",
      "Lote de eventos já reservado ou alterado.",
    );
}
export async function reserveEventBatch(
  tx: Prisma.TransactionClient,
  run: AgentRun,
  config: AgentConfig,
  ids: string[],
  now: Date,
) {
  await tx.agentEventDelivery.updateMany({
    where: {
      id: { in: ids },
      cooperativeId: run.cooperativeId,
      agent: run.agent,
      status: "PENDING",
    },
    data: {
      status: "PROCESSING",
      runId: run.id,
      attempts: { increment: 1 },
      errorCode: null,
    },
  });
  await tx.agentConfig.update({
    where: { id: config.id },
    data: {
      nextEventAt: new Date(+now + config.eventIntervalMinutes * 60000),
      nextRunAt: new Date(+now + config.intervalMinutes * 60000),
    },
  });
}
/** Completion and delivery acknowledgement share the proposal/inbox transaction. Failed attempts retain their AgentRun history. */
export async function settleEventDeliveries(
  tx: Prisma.TransactionClient,
  run: Pick<AgentRun, "id" | "cooperativeId" | "origin">,
  success: boolean,
  errorCode?: string,
) {
  if (run.origin !== "EVENT") return;
  const rows = await tx.agentEventDelivery.findMany({
    where: {
      cooperativeId: run.cooperativeId,
      runId: run.id,
      status: "PROCESSING",
    },
    take: LIMITS.eventBatch,
    select: { id: true, attempts: true },
  });
  for (const row of rows) {
    const skipped =
      errorCode === "AGENT_DISABLED" ||
      errorCode === "AGENTS_DISABLED" ||
      errorCode === "COOPERATIVE_UNAVAILABLE";
    const terminal = success || skipped || row.attempts >= LIMITS.eventAttempts;
    await tx.agentEventDelivery.update({
      where: { id: row.id },
      data: {
        status: success
          ? "DONE"
          : skipped
            ? "SKIPPED"
            : terminal
              ? "DEAD"
              : "PENDING",
        errorCode: success ? null : errorCode || "ANALYSIS_FAILED",
        finishedAt: terminal ? new Date() : null,
        ...(!terminal
          ? {
              availableAt: new Date(
                Date.now() + (row.attempts === 1 ? 2 : 10) * 60000,
              ),
            }
          : {}),
      },
    });
  }
}
