import { LIMITS } from "./agents.types";
import { processAgentEvents } from "./agents.events";
import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma";
import { defaultCommand } from "./agents.commands";
import { executeAnalysis } from "./agents.execution";
import { recoverExpiredRuns } from "./agents.recovery";
import { agentsEnabled } from "./agents.permissions";
/** Polls only opted-in configurations. One sequential batch; durable event keys protect multiple API processes. */
export async function agentTick(
  log: Pick<FastifyInstance["log"], "info" | "error">,
) {
  if (!agentsEnabled()) return;
  const cycleStarted = Date.now();
  await recoverExpiredRuns();
  await processAgentEvents(log);
  const due = await prisma.agentConfig.findMany({
    where: {
      enabled: true,
      automationsEnabled: true,
      nextRunAt: { lte: new Date() },
      cooperative: {
        user: { isActive: true, accountStatus: "ACTIVE", role: "COOPERATIVE" },
      },
    },
    orderBy: [{ nextRunAt: "asc" }, { id: "asc" }],
    take: 3,
  });
  for (const config of due) {
    if (Date.now() - cycleStarted > Math.min(5000, LIMITS.durationMs)) break;
    try {
      const result = await executeAnalysis({
        cooperativeId: config.cooperativeId,
        actorId: null,
        origin: "SCHEDULED",
        command: defaultCommand(config.agent),
        eventId: `scheduled_${config.id}_${+config.nextRunAt}`,
      });
      log.info(
        {
          agent: config.agent,
          runId: result.run.id,
          status: result.run.status,
        },
        "Ciclo consultivo de agente concluído",
      );
    } catch (e: any) {
      if (e.statusCode === 409 || e.statusCode === 429) {
        // A blocked tenant must not occupy the oldest due slots for the whole day.
        await prisma.agentConfig.updateMany({
          where: { id: config.id, enabled: true, nextRunAt: config.nextRunAt },
          data: {
            nextRunAt: new Date(
              Date.now() + (e.statusCode === 429 ? 15 : 1) * 60000,
            ),
          },
        });
      }
      if (e.statusCode !== 409 && e.statusCode !== 429)
        log.error(
          { code: e.code || "TICK_FAILED" },
          "Falha no ciclo de agentes",
        );
    }
  }
}
export function registerAgentWorker(app: FastifyInstance) {
  let stopped = false,
    inFlight: Promise<void> | null = null;
  const tick = () => {
    if (stopped || inFlight || !agentsEnabled()) return;
    inFlight = agentTick(app.log)
      .catch((e) => {
        app.log.error(
          { code: e.code || "AGENTS_UNAVAILABLE" },
          "Agentes indisponíveis; nova tentativa no próximo ciclo",
        );
      })
      .finally(() => {
        inFlight = null;
      });
  };
  const timer = setInterval(tick, 60000);
  timer.unref();
  app.addHook("onClose", async () => {
    stopped = true;
    clearInterval(timer);
    if (inFlight) await inFlight;
  });
  // Start only after listen/db connect (not while building test apps).
  app.addHook("onListen", async () => {
    tick();
  });
}
