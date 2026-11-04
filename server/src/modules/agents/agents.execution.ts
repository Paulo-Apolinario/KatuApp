import {
  validateEventBatch,
  reserveEventBatch,
  settleEventDeliveries,
} from "./agents.event-lifecycle";
import { requireAgentsEnabled } from "./agents.permissions";
import type { AgentOrigin } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { audit, fingerprint, json, lockCooperative } from "./agents.audit";
import { commandAgent, COMMANDS } from "./agents.commands";
import { persistProposals } from "./agents.proposals";
import { readOnlyTools, type AgentTools } from "./agents.tools";
import { recoverExpiredRuns } from "./agents.recovery";
import { AgentError, LIMITS, type Command } from "./agents.types";
export interface RunInput {
  cooperativeId: string;
  actorId: string | null;
  command: Command;
  origin: AgentOrigin;
  eventId: string;
  conversationId?: string;
  text?: string;
  deliveryIds?: string[];
}
async function claim(input: RunInput) {
  return prisma.$transaction(
    async (tx) => {
      await lockCooperative(tx, "__global_run_budget__");
      await lockCooperative(tx, input.cooperativeId);
      const now = new Date(),
        agent = commandAgent(input.command);
      const hash = fingerprint(input),
        eventKey = `run:${input.eventId}`;
      const prior = await tx.agentRun.findUnique({
        where: {
          cooperativeId_eventKey: {
            cooperativeId: input.cooperativeId,
            eventKey,
          },
        },
      });
      if (prior) {
        if (prior.inputHash !== hash)
          throw new AgentError(
            409,
            "EVENT_CONFLICT",
            "Evento já utilizado com outro comando, conversa ou origem.",
          );
        return { run: prior, replayed: true };
      }
      const owner = await tx.cooperative.findFirst({
        where: {
          id: input.cooperativeId,
          user: {
            isActive: true,
            accountStatus: "ACTIVE",
            role: "COOPERATIVE",
          },
        },
        select: { userId: true },
      });
      if (!owner || (input.actorId && owner.userId !== input.actorId))
        throw new AgentError(
          403,
          "FORBIDDEN",
          "Cooperativa ou usuário indisponível.",
        );
      const config = await tx.agentConfig.findUnique({
        where: {
          cooperativeId_agent: { cooperativeId: input.cooperativeId, agent },
        },
      });
      if (!config?.enabled)
        throw new AgentError(
          409,
          "AGENT_DISABLED",
          "Habilite este agente nas configurações antes de executar.",
        );
      if (
        input.origin === "SCHEDULED" &&
        (!config.automationsEnabled ||
          config.nextRunAt > now ||
          input.eventId !== `scheduled_${config.id}_${+config.nextRunAt}`)
      )
        throw new AgentError(
          409,
          "STALE_TRIGGER",
          "Gatilho agendado desatualizado.",
        );
      if (input.origin === "EVENT")
        await validateEventBatch(
          tx,
          input.cooperativeId,
          config,
          input.eventId,
          input.deliveryIds || [],
          now,
        );
      if (
        await tx.agentRun.count({
          where: { cooperativeId: input.cooperativeId, status: "RUNNING" },
        })
      )
        throw new AgentError(
          409,
          "RUN_BUSY",
          "Já há uma análise em andamento nesta cooperativa.",
        );
      if (
        (await tx.agentRun.count({
          where: {
            expiresAt: { gt: now },
            OR: [
              { status: "RUNNING" },
              { status: "FAILED", errorCode: "TIME_BUDGET_EXCEEDED" },
            ],
          },
        })) >= LIMITS.globalConcurrency
      )
        throw new AgentError(
          409,
          "SERVER_BUSY",
          "Há uma análise em andamento no servidor. Tente novamente em instantes.",
        );
      const [minute, day] = await Promise.all([
        tx.agentRun.count({
          where: {
            cooperativeId: input.cooperativeId,
            startedAt: { gte: new Date(+now - 60000) },
          },
        }),
        tx.agentRun.count({
          where: {
            cooperativeId: input.cooperativeId,
            startedAt: { gte: new Date(+now - 86400000) },
          },
        }),
      ]);
      if (minute >= LIMITS.perMinute || day >= LIMITS.perDay)
        throw new AgentError(
          429,
          "RATE_LIMIT",
          "Limite de análises atingido. Aguarde antes de tentar novamente.",
        );
      let conversationId = input.conversationId;
      if (input.origin === "COMMAND") {
        if (conversationId) {
          if (
            !(await tx.agentConversation.findFirst({
              where: {
                id: conversationId,
                cooperativeId: input.cooperativeId,
                userId: input.actorId,
              },
            }))
          )
            throw new AgentError(404, "NOT_FOUND", "Conversa não encontrada.");
        } else
          conversationId = (
            await tx.agentConversation.create({
              data: {
                cooperativeId: input.cooperativeId,
                userId: input.actorId,
                title: COMMANDS.find((c) => c.key === input.command)!.example,
              },
            })
          ).id;
      }
      const run = await tx.agentRun.create({
        data: {
          cooperativeId: input.cooperativeId,
          actorId: input.actorId,
          agent,
          command: input.command,
          origin: input.origin,
          eventKey,
          inputHash: hash,
          eventDeliveryIds: input.deliveryIds || [],
          conversationId,
          expiresAt: new Date(+now + LIMITS.leaseMinutes * 60000),
        },
      });
      if (input.origin === "EVENT")
        await reserveEventBatch(tx, run, config, input.deliveryIds!, now);
      if (conversationId) {
        await tx.agentMessage.create({
          data: {
            cooperativeId: input.cooperativeId,
            conversationId,
            runId: run.id,
            role: "USER",
            content: input.text || input.command,
          },
        });
        await tx.agentConversation.update({
          where: { id: conversationId },
          data: { updatedAt: now },
        });
      }
      if (input.origin === "SCHEDULED")
        await tx.agentConfig.update({
          where: { id: config.id },
          data: { nextRunAt: new Date(+now + config.intervalMinutes * 60000) },
        });
      await audit(
        tx,
        input.cooperativeId,
        input.actorId,
        `started:${run.id}`,
        "RUN_STARTED",
        run.id,
        {
          agent,
          origin: input.origin,
          command: input.command,
          deliveryIds: input.deliveryIds || [],
        },
      );
      return { run, replayed: false };
    },
    { timeout: 15000 },
  );
}
export async function executeAnalysis(
  input: RunInput,
  tools: AgentTools = readOnlyTools,
  options: { budgetMs?: number } = {},
) {
  requireAgentsEnabled();
  await recoverExpiredRuns(input.cooperativeId);
  const claimed = await claim(input);
  if (claimed.replayed) return claimed;
  const { run } = claimed;
  let analysisSettled = false;
  try {
    let timedOut = false;
    const analysis = tools.analyze(input.cooperativeId, input.command);
    let timer: ReturnType<typeof setTimeout>;
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(
        () => {
          timedOut = true;
          reject(
            new AgentError(
              503,
              "TIME_BUDGET_EXCEEDED",
              "A análise excedeu o tempo permitido.",
            ),
          );
        },
        Math.max(
          1,
          Math.min(LIMITS.durationMs, options.budgetMs ?? LIMITS.durationMs),
        ),
      );
    });
    // A late read cannot commit results. Keep the global resource slot fenced while it is still running.
    void analysis
      .finally(async () => {
        analysisSettled = true;
        if (timedOut)
          await prisma.agentRun.updateMany({
            where: {
              id: run.id,
              status: "FAILED",
              errorCode: "TIME_BUDGET_EXCEEDED",
            },
            data: { expiresAt: new Date() },
          });
      })
      .catch(() => {});
    const result = await Promise.race([analysis, deadline]).finally(() =>
      clearTimeout(timer),
    );
    return await prisma.$transaction(
      async (tx) => {
        await lockCooperative(tx, input.cooperativeId);
        const current = await tx.agentRun.findUniqueOrThrow({
          where: { id: run.id },
        });
        if (current.status !== "RUNNING" || +current.expiresAt < Date.now())
          throw new AgentError(
            409,
            "LEASE_EXPIRED",
            "A análise excedeu o prazo. Solicite uma nova execução.",
          );
        const config = await tx.agentConfig.findUnique({
          where: {
            cooperativeId_agent: {
              cooperativeId: input.cooperativeId,
              agent: run.agent,
            },
          },
        });
        const owner = await tx.cooperative.findFirst({
          where: {
            id: input.cooperativeId,
            user: {
              isActive: true,
              accountStatus: "ACTIVE",
              role: "COOPERATIVE",
            },
          },
          select: { userId: true },
        });
        if (!owner || (input.actorId && owner.userId !== input.actorId))
          throw new AgentError(
            403,
            "COOPERATIVE_UNAVAILABLE",
            "O acesso da cooperativa foi desativado durante a análise.",
          );
        requireAgentsEnabled();
        if (
          !config?.enabled ||
          ((input.origin === "EVENT" || input.origin === "SCHEDULED") &&
            !config.automationsEnabled)
        )
          throw new AgentError(
            409,
            "AGENT_DISABLED",
            "O agente foi desativado durante a análise.",
          );
        const proposalIds = await persistProposals(
          tx,
          input.cooperativeId,
          run.id,
          result.proposals,
          config.notificationsEnabled,
        );
        const eventSources =
          input.origin === "EVENT"
            ? await tx.agentEventDelivery.findMany({
                where: { cooperativeId: run.cooperativeId, runId: run.id },
                take: LIMITS.eventBatch,
                select: {
                  event: {
                    select: {
                      id: true,
                      source: true,
                      entityId: true,
                      kind: true,
                      occurredAt: true,
                    },
                  },
                },
              })
            : [];
        const payload = json({
          ...result,
          proposals: undefined,
          proposalIds,
          advisoryOnly: true,
          eventSources: eventSources.map((x) => x.event),
        });
        const updated = await tx.agentRun.update({
          where: { id: run.id },
          data: {
            status: "SUCCEEDED",
            result: payload,
            finishedAt: new Date(),
          },
        });
        await settleEventDeliveries(tx, run, true);
        if (run.conversationId)
          await tx.agentMessage.create({
            data: {
              cooperativeId: input.cooperativeId,
              conversationId: run.conversationId,
              runId: run.id,
              role: "ASSISTANT",
              content: result.summary,
              data: payload,
            },
          });
        await audit(
          tx,
          input.cooperativeId,
          input.actorId,
          `finished:${run.id}`,
          "RUN_SUCCEEDED",
          run.id,
          { proposalIds },
        );
        return { run: updated, replayed: false };
      },
      { timeout: 20000 },
    );
  } catch (error: any) {
    // Errors are persisted without raw database details, commands, addresses or personal documents in logs.
    const code = error instanceof AgentError ? error.code : "ANALYSIS_FAILED";
    const failed = await prisma.$transaction(async (tx) => {
      await lockCooperative(tx, input.cooperativeId);
      const updated = await tx.agentRun.updateMany({
        where: {
          id: run.id,
          cooperativeId: input.cooperativeId,
          status: "RUNNING",
        },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
          errorCode: code,
          ...(code === "TIME_BUDGET_EXCEEDED" && analysisSettled
            ? { expiresAt: new Date() }
            : {}),
        },
      });
      if (updated.count) {
        await settleEventDeliveries(tx, run, false, code);
        if (run.conversationId)
          await tx.agentMessage.create({
            data: {
              cooperativeId: input.cooperativeId,
              conversationId: run.conversationId,
              runId: run.id,
              role: "ASSISTANT",
              content:
                "Não foi possível concluir esta análise. Consulte o histórico e tente novamente com um novo evento.",
            },
          });
        await audit(
          tx,
          input.cooperativeId,
          input.actorId,
          `failed:${run.id}`,
          "RUN_FAILED",
          run.id,
          { code },
        );
      }
      return tx.agentRun.findUniqueOrThrow({ where: { id: run.id } });
    });
    return { run: failed, replayed: false };
  }
}
