import { proposalFreshness } from "./agents.freshness";
import { eventQuery } from "./agents.schemas";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z, ZodError } from "zod";
import { prisma } from "../../lib/prisma";
import { agentScope, requireAgentsEnabled } from "./agents.permissions";
import { AgentError } from "./agents.types";
import { resolveCommandText, defaultCommand } from "./agents.commands";
import { listAgents, configureAgent } from "./agents.config";
import { executeAnalysis } from "./agents.execution";
import { decideProposal } from "./agents.proposals";
import {
  agentKey,
  id,
  configSchema,
  runSchema,
  chatSchema,
  pageSchema,
  proposalQuery,
  runQuery,
  decisionSchema,
} from "./agents.schemas";
export async function agentsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);
  const handle =
    (
      fn: (
        r: FastifyRequest,
        p: FastifyReply,
        coop: { id: string; userId: string },
      ) => Promise<unknown>,
    ) =>
    async (r: FastifyRequest, p: FastifyReply) => {
      p.header("Cache-Control", "private, no-store");
      try {
        const coop = await agentScope(r.user);
        requireAgentsEnabled();
        return await fn(r, p, coop);
      } catch (e: any) {
        if (e instanceof ZodError)
          return p.code(400).send({
            code: "VALIDATION_ERROR",
            error: e.issues.map((x) => x.message).join(" "),
          });
        if (e instanceof AgentError)
          return p.code(e.statusCode).send({ code: e.code, error: e.message });
        r.log.error(
          { code: e.code || "AGENTS_ERROR" },
          "Falha no módulo de agentes",
        );
        return p.code(503).send({
          code: "AGENTS_UNAVAILABLE",
          error:
            "Não foi possível consultar os agentes agora. Confira a disponibilidade e as migrações do módulo.",
        });
      }
    };
  app.get(
    "/agents",
    handle(async (_r, _p, coop) => listAgents(coop.id)),
  );
  app.patch(
    "/agents/:agent/config",
    handle(async (r, _p, coop) => {
      const { agent } = z.object({ agent: agentKey }).strict().parse(r.params);
      return configureAgent(
        coop.id,
        r.user.sub,
        agent,
        configSchema.parse(r.body),
      );
    }),
  );
  app.post(
    "/agents/:agent/run",
    handle(async (r, p, coop) => {
      const { agent } = z.object({ agent: agentKey }).strict().parse(r.params),
        input = runSchema.parse(r.body);
      const result = await executeAnalysis({
        cooperativeId: coop.id,
        actorId: r.user.sub,
        command: defaultCommand(agent),
        origin: "MANUAL",
        eventId: input.eventId,
      });
      p.code(
        result.run.status === "RUNNING"
          ? 202
          : result.run.status === "FAILED"
            ? 503
            : 200,
      );
      return result;
    }),
  );
  app.post(
    "/agents/commands",
    handle(async (r, p, coop) => {
      const input = chatSchema.parse(r.body);
      const interpretation = input.command
        ? null
        : resolveCommandText(input.text!);
      const command = input.command || interpretation?.command;
      if (!command) {
        const catalog = await listAgents(coop.id);
        const available = catalog.commands.filter((c) =>
          catalog.agents.some((a) => a.key === c.agent && a.enabled),
        );
        const clarificationNeeded = interpretation?.method === "CLARIFICATION";
        return {
          recognized: false,
          clarificationNeeded,
          message: clarificationNeeded
            ? "Encontrei mais de uma consulta possível. Escolha uma opção para esclarecer; nenhuma análise foi executada."
            : "Não reconheci este comando. Use uma das opções disponíveis; este assistente utiliza regras e não IA generativa. Datas, pessoas ou filtros adicionais precisam de um comando específico.",
          suggestions: clarificationNeeded
            ? available.filter((c) => interpretation.candidates.includes(c.key))
            : [],
          commands: available,
          agents: catalog.agents
            .filter((a) => a.enabled)
            .map(({ key, label }) => ({ key, label })),
        };
      }
      const result = await executeAnalysis({
        cooperativeId: coop.id,
        actorId: r.user.sub,
        command,
        origin: "COMMAND",
        eventId: input.eventId,
        conversationId: input.conversationId,
        text: input.text,
      });
      p.code(
        result.run.status === "RUNNING"
          ? 202
          : result.run.status === "FAILED"
            ? 503
            : 200,
      );
      return { recognized: true, ...result };
    }),
  );
  // Keyset pages: the cursor must itself belong to the authenticated tenant and current filter.
  async function listPage(
    model:
      | "agentRun"
      | "agentConversation"
      | "agentMessage"
      | "agentProposal"
      | "agentAuditEvent",
    where: Record<string, unknown>,
    q: { cursor?: string; limit: number },
  ) {
    const delegate = prisma[model] as any;
    if (
      q.cursor &&
      !(await delegate.findFirst({
        where: { ...where, id: q.cursor },
        select: { id: true },
      }))
    )
      throw new AgentError(404, "NOT_FOUND", "Página não encontrada.");
    const orderField = model === "agentRun" ? "startedAt" : "createdAt";
    const rows = await delegate.findMany({
      where,
      orderBy: [{ [orderField]: "desc" }, { id: "desc" }],
      take: q.limit + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    const data =
      model === "agentProposal"
        ? await Promise.all(
            rows.slice(0, q.limit).map(async (row: any) => ({
              ...row,
              freshness: await proposalFreshness(row),
            })),
          )
        : rows.slice(0, q.limit);
    return {
      data,
      nextCursor: rows.length > q.limit ? data[data.length - 1].id : null,
    };
  }
  app.get(
    "/agents/runs",
    handle(async (r, _p, coop) => {
      const { agent, status, ...q } = runQuery.parse(r.query);
      return listPage(
        "agentRun",
        {
          cooperativeId: coop.id,
          ...(agent ? { agent } : {}),
          ...(status ? { status } : {}),
        },
        q,
      );
    }),
  );
  app.get(
    "/agents/runs/:id",
    handle(async (r, _p, coop) => {
      const key = z.object({ id }).parse(r.params);
      const run = await prisma.agentRun.findFirst({
        where: { id: key.id, cooperativeId: coop.id },
      });
      if (!run)
        throw new AgentError(404, "NOT_FOUND", "Execução não encontrada.");
      return { run };
    }),
  );
  app.get(
    "/agents/conversations",
    handle(async (r, _p, coop) =>
      listPage(
        "agentConversation",
        { cooperativeId: coop.id, userId: r.user.sub },
        pageSchema.parse(r.query),
      ),
    ),
  );
  app.get(
    "/agents/conversations/:id/messages",
    handle(async (r, _p, coop) => {
      const key = z.object({ id }).parse(r.params);
      if (
        !(await prisma.agentConversation.findFirst({
          where: { id: key.id, cooperativeId: coop.id, userId: r.user.sub },
        }))
      )
        throw new AgentError(404, "NOT_FOUND", "Conversa não encontrada.");
      return listPage(
        "agentMessage",
        { cooperativeId: coop.id, conversationId: key.id },
        pageSchema.parse(r.query),
      );
    }),
  );
  app.get(
    "/agents/proposals",
    handle(async (r, _p, coop) => {
      const { status, ...q } = proposalQuery.parse(r.query);
      return listPage(
        "agentProposal",
        { cooperativeId: coop.id, ...(status ? { status } : {}) },
        q,
      );
    }),
  );
  app.get(
    "/agents/proposals/:id",
    handle(async (r, _p, coop) => {
      const key = z.object({ id }).parse(r.params);
      const proposal = await prisma.agentProposal.findFirst({
        where: { id: key.id, cooperativeId: coop.id },
      });
      if (!proposal)
        throw new AgentError(404, "NOT_FOUND", "Proposta não encontrada.");
      return {
        proposal: { ...proposal, freshness: await proposalFreshness(proposal) },
        operationalExecutionEnabled: false,
      };
    }),
  );
  app.post(
    "/agents/proposals/:id/decision",
    handle(async (r, _p, coop) =>
      decideProposal(
        coop.id,
        r.user.sub,
        z.object({ id }).parse(r.params).id,
        decisionSchema.parse(r.body),
      ),
    ),
  );
  app.get(
    "/agents/occurrences",
    handle(async (r, _p, coop) => {
      const q = pageSchema.parse(r.query),
        now = new Date();
      const where = {
        cooperativeId: coop.id,
        status: "OPEN",
        OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }],
      };
      if (
        q.cursor &&
        !(await prisma.systemAlert.findFirst({
          where: { ...where, id: q.cursor },
          select: { id: true },
        }))
      )
        throw new AgentError(404, "NOT_FOUND", "Página não encontrada.");
      const rows = await prisma.systemAlert.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: q.limit + 1,
        ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      });
      const data = rows.slice(0, q.limit);
      return {
        data,
        nextCursor: rows.length > q.limit ? data[data.length - 1].id : null,
        source: "SystemAlert",
        refreshedBy: "AgentManager ou central de alertas existente",
      };
    }),
  );
  app.get(
    "/agents/occurrences/:id",
    handle(async (r, _p, coop) => {
      const key = z.object({ id }).parse(r.params);
      const occurrence = await prisma.systemAlert.findFirst({
        where: { id: key.id, cooperativeId: coop.id },
      });
      if (!occurrence)
        throw new AgentError(404, "NOT_FOUND", "Ocorrência não encontrada.");
      return { occurrence, agent: "MANAGER", advisoryOnly: true };
    }),
  );
  app.get(
    "/agents/events",
    handle(async (r, _p, coop) => {
      const { agent, status, ...q } = eventQuery.parse(r.query);
      const where = {
        cooperativeId: coop.id,
        ...(agent ? { agent } : {}),
        ...(status ? { status } : {}),
      };
      if (
        q.cursor &&
        !(await prisma.agentEventDelivery.findFirst({
          where: { ...where, id: q.cursor },
          select: { id: true },
        }))
      )
        throw new AgentError(404, "NOT_FOUND", "Página não encontrada.");
      const [rows, counts] = await Promise.all([
        prisma.agentEventDelivery.findMany({
          where,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: q.limit + 1,
          ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
          include: {
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
        }),
        prisma.agentEventDelivery.groupBy({
          by: ["status"],
          where: { cooperativeId: coop.id },
          _count: { _all: true },
        }),
      ]);
      const data = rows.slice(0, q.limit);
      return {
        data,
        nextCursor: rows.length > q.limit ? data[data.length - 1].id : null,
        counts: Object.fromEntries(
          counts.map((c) => [c.status, c._count._all]),
        ),
      };
    }),
  );
  app.get(
    "/agents/audit",
    handle(async (r, _p, coop) =>
      listPage(
        "agentAuditEvent",
        { cooperativeId: coop.id },
        pageSchema.parse(r.query),
      ),
    ),
  );
}
