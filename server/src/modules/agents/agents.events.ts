import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma";
import { audit, lockCooperative } from "./agents.audit";
import { defaultCommand } from "./agents.commands";
import { executeAnalysis } from "./agents.execution";
import { eventBatchKey } from "./agents.event-lifecycle";
import { agentsEnabled } from "./agents.permissions";
import { LIMITS } from "./agents.types";
type Log = Pick<FastifyInstance["log"], "info" | "error">;
export async function retireEventDeliveries() {
  const now = new Date();
  const rows = await prisma.agentEventDelivery.findMany({
    where: {
      status: "PENDING",
      OR: [
        { expiresAt: { lte: now } },
        { attempts: { gte: LIMITS.eventAttempts } },
        { config: { enabled: false } },
        { config: { automationsEnabled: false } },
        { config: { cooperative: { user: { isActive: false } } } },
        {
          config: {
            cooperative: { user: { accountStatus: { not: "ACTIVE" } } },
          },
        },
      ],
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: LIMITS.eventBatch,
    select: { id: true, cooperativeId: true, expiresAt: true, attempts: true },
  });
  for (const row of rows)
    await prisma.$transaction(async (tx) => {
      await lockCooperative(tx, row.cooperativeId);
      // Recheck configuration after obtaining the lock; do not retire a job that was re-enabled concurrently.
      const current = await tx.agentEventDelivery.findFirst({
        where: { id: row.id, status: "PENDING" },
        include: {
          config: {
            include: {
              cooperative: {
                select: {
                  user: { select: { isActive: true, accountStatus: true } },
                },
              },
            },
          },
        },
      });
      if (!current) return;
      const expired = current.expiresAt <= now,
        exhausted = current.attempts >= LIMITS.eventAttempts,
        disabled =
          !current.config.enabled ||
          !current.config.automationsEnabled ||
          !current.config.cooperative.user.isActive ||
          current.config.cooperative.user.accountStatus !== "ACTIVE";
      if (!expired && !exhausted && !disabled) return;
      const code = expired
        ? "EVENT_EXPIRED"
        : exhausted
          ? "RETRIES_EXHAUSTED"
          : "AGENT_DISABLED";
      await tx.agentEventDelivery.update({
        where: { id: row.id },
        data: {
          status: expired || exhausted ? "DEAD" : "SKIPPED",
          errorCode: code,
          finishedAt: now,
        },
      });
      await audit(
        tx,
        row.cooperativeId,
        null,
        `delivery-retired:${row.id}`,
        "EVENT_RETIRED",
        row.id,
        { code },
      );
    });
}
/** One tenant/agent batch per cycle, maximum 20 source events, no browser or external queue required. */
export async function processAgentEvents(log: Log) {
  if (!agentsEnabled()) return;
  await retireEventDeliveries();
  const now = new Date();
  const first = await prisma.agentEventDelivery.findFirst({
    where: {
      status: "PENDING",
      availableAt: { lte: now },
      expiresAt: { gt: now },
      config: {
        enabled: true,
        automationsEnabled: true,
        nextEventAt: { lte: now },
        cooperative: {
          user: {
            isActive: true,
            accountStatus: "ACTIVE",
            role: "COOPERATIVE",
          },
        },
      },
    },
    orderBy: [{ availableAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    select: { cooperativeId: true, agent: true },
  });
  if (!first) return;
  const rows = await prisma.agentEventDelivery.findMany({
    where: {
      ...first,
      status: "PENDING",
      availableAt: { lte: now },
      expiresAt: { gt: now },
      attempts: { lt: LIMITS.eventAttempts },
    },
    orderBy: [{ availableAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    take: LIMITS.eventBatch,
    select: { id: true, attempts: true },
  });
  if (!rows.length) return;
  try {
    const result = await executeAnalysis({
      cooperativeId: first.cooperativeId,
      actorId: null,
      origin: "EVENT",
      command: defaultCommand(first.agent),
      eventId: eventBatchKey(rows),
      deliveryIds: rows.map((r) => r.id).sort(),
    });
    log.info(
      {
        runId: result.run.id,
        agent: first.agent,
        status: result.run.status,
        eventCount: rows.length,
      },
      "Lote consultivo de eventos processado",
    );
  } catch (e: any) {
    if (e.statusCode === 409 || e.statusCode === 429) {
      await prisma.agentEventDelivery.updateMany({
        where: {
          id: { in: rows.map((r) => r.id) },
          status: "PENDING",
          availableAt: { lte: now },
        },
        data: {
          availableAt: new Date(
            Date.now() + (e.statusCode === 429 ? 15 : 1) * 60000,
          ),
          errorCode: e.code || "RETRY_LATER",
        },
      });
    } else
      log.error(
        { code: e.code || "EVENT_PROCESSING_FAILED" },
        "Falha ao processar eventos; lote persistido para nova tentativa",
      );
  }
}
