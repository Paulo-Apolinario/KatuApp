import type { AgentKey } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { audit, fingerprint, json, lockCooperative } from "./agents.audit";
import { AGENTS, AgentError } from "./agents.types";
import { COMMANDS } from "./agents.commands";
export async function listAgents(cooperativeId: string) {
  const configs = await prisma.agentConfig.findMany({
    where: { cooperativeId },
  });
  return {
    agents: AGENTS.map((a) => ({
      ...a,
      ...(configs.find((c) => c.agent === a.key) || {
        enabled: false,
        intervalMinutes: 60,
        version: 0,
        nextRunAt: null,
      }),
    })),
    commands: COMMANDS.map(({ key, example, agent }) => ({
      key,
      example,
      agent,
    })),
    operationalExecutionEnabled: false,
  };
}
export async function configureAgent(
  cooperativeId: string,
  actorId: string,
  agent: AgentKey,
  input: {
    enabled: boolean;
    intervalMinutes?: number;
    expectedVersion: number;
    eventId: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    await lockCooperative(tx, cooperativeId);
    const key = `config:${input.eventId}`,
      hash = fingerprint({ actorId, agent, ...input });
    const prior = await tx.agentAuditEvent.findUnique({
      where: { cooperativeId_eventKey: { cooperativeId, eventKey: key } },
    });
    if (prior) {
      if ((prior.data as any).hash !== hash)
        throw new AgentError(
          409,
          "EVENT_CONFLICT",
          "Identificador de evento já utilizado com outros dados.",
        );
      return { config: (prior.data as any).config, replayed: true };
    }
    const old = await tx.agentConfig.findUnique({
      where: { cooperativeId_agent: { cooperativeId, agent } },
    });
    if ((old?.version || 0) !== input.expectedVersion)
      throw new AgentError(
        409,
        "VERSION_CONFLICT",
        "Configuração alterada. Consulte a versão atual.",
      );
    const config = await tx.agentConfig.upsert({
      where: { cooperativeId_agent: { cooperativeId, agent } },
      create: {
        cooperativeId,
        agent,
        enabled: input.enabled,
        intervalMinutes: input.intervalMinutes || 60,
        nextRunAt: new Date(Date.now() + 60000),
      },
      update: {
        enabled: input.enabled,
        intervalMinutes: input.intervalMinutes || old?.intervalMinutes || 60,
        nextRunAt: new Date(Date.now() + 60000),
        version: { increment: 1 },
      },
    });
    await audit(tx, cooperativeId, actorId, key, "CONFIG_UPDATED", config.id, {
      hash,
      config: json(config),
    });
    return { config, replayed: false };
  });
}
