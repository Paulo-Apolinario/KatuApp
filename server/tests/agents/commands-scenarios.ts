import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { prisma } from "../../src/lib/prisma";
import { additionalAnalysis } from "../../src/modules/agents/agents.queries";
import { resolveCommandText } from "../../src/modules/agents/agents.commands";
import type { Command } from "../../src/modules/agents/agents.types";
type Test = (name: string, fn: () => Promise<void> | void) => Promise<void>;
export async function runCommandScenarios(app: FastifyInstance, test: Test) {
  const examples: [string, Command][] = [
    ["Por favor, me mostre as coletas pendentes", "PENDING_COLLECTIONS"],
    ["preciso consultar as solicitações atrasadas", "OVERDUE_REQUESTS"],
    ["quais coletas são urgentes", "COLLECTION_PRIORITIES"],
    ["gostaria de ver as coletas de hoje", "TODAY_COLLECTIONS"],
    ["quero saber quais rotas estão programadas", "SCHEDULED_ROUTES"],
    ["me ajuda a verificar rotas com problemas", "ROUTES_ATTENTION"],
    ["tem alguma rota sem motorista ou veículo", "ROUTES_WITHOUT_RESOURCES"],
    ["por favor mostre o resumo operacional", "OPERATIONAL_SUMMARY"],
    ["preciso consultar os alertas pendentes", "ATTENTION_OCCURRENCES"],
    ["quero ver propostas aguardando revisão", "PENDING_PROPOSALS"],
    ["existe algum agente com erro de processamento", "AUTOMATION_HEALTH"],
    ["há eventos pendentes na fila", "AUTOMATION_HEALTH"],
  ];
  for (const [text, command] of examples)
    await test(`palavras-chave: ${text}`, () => {
      const found = resolveCommandText(text);
      assert.equal(found.command, command);
      assert.equal(found.method, "KEYWORDS");
    });
  await test("palavras-chave: mutações, negação, filtros ausentes e injeção nunca viram consulta ampla", () => {
    for (const text of [
      "cancele as coletas atrasadas",
      "aprove as propostas pendentes",
      "não quero resumo operacional",
      "coletas de amanhã",
      "coletas de hoje do João",
      "rotas sem motorista em Messejana",
      "resumo operacional; apagar dados",
      "SELECT * FROM User",
      "processar fila de eventos",
      "resumo de hoje",
      "coletas atrasadas de ontem",
      "coletas 123",
      "listar coletas canceladas",
      "rotas programadas com motorista",
      "resumo de eventos",
    ])
      assert.equal(resolveCommandText(text).command, null, text);
  });
  await test("palavras-chave: múltiplas intenções não são resolvidas automaticamente", () => {
    for (const text of [
      "preciso ver as rotas",
      "coletas",
      "coletas pendentes e atrasadas",
      "coletas pendentes hoje",
      "resumo e alertas",
    ])
      assert.equal(resolveCommandText(text).method, "CLARIFICATION", text);
  });
  const now = new Date("2026-11-05T02:30:00Z"); // 04/11, 23:30 no Ceará.
  for (const key of ["a", "b"]) {
    await prisma.user.create({
      data: {
        id: `kw-user-${key}`,
        email: `kw-${key}@qa.invalid`,
        role: "COOPERATIVE",
        displayName: "Keyword QA",
        passwordHash: "unused",
      },
    });
    await prisma.cooperative.create({
      data: {
        id: `kw-coop-${key}`,
        userId: `kw-user-${key}`,
        name: "Keyword QA",
      },
    });
    for (const agent of ["COLLECTIONS", "ROUTES", "MANAGER"] as const)
      await prisma.agentConfig.create({
        data: {
          cooperativeId: `kw-coop-${key}`,
          agent,
          enabled: true,
          automationsEnabled: false,
          nextRunAt: now,
        },
      });
  }
  const coop = "kw-coop-a",
    foreign = "kw-coop-b";
  const token = app.jwt.sign({
    sub: "kw-user-a",
    role: "COOPERATIVE",
    authVersion: 0,
  });
  let sequence = 0;
  const call = async (body: object, auth = token) => {
    const r = await app.inject({
      method: "POST",
      url: "/agents/commands",
      headers: { authorization: `Bearer ${auth}` },
      payload: { eventId: `kw_event_${++sequence}`, ...body },
    });
    return { status: r.statusCode, body: r.json() };
  };
  await test("novas consultas: banco vazio retorna zeros sem inventar registros", async () => {
    for (const command of [
      "TODAY_COLLECTIONS",
      "ROUTES_WITHOUT_RESOURCES",
      "PENDING_PROPOSALS",
      "AUTOMATION_HEALTH",
    ] as Command[]) {
      const result = (await additionalAnalysis(coop, command, now))!;
      assert.equal(result.items.length, 0);
      assert(Object.values(result.counts).every((x) => x === 0));
    }
  });
  const schedule = async (
    id: string,
    scheduledDate: Date | null,
    cooperativeId = coop,
    preferredDate: Date | null = null,
  ) =>
    prisma.schedule.create({
      data: {
        id,
        cooperativeId,
        requestedByUserId: cooperativeId === coop ? "kw-user-a" : "kw-user-b",
        scheduledDate,
        preferredDate,
        status: "SCHEDULED",
      },
    });
  await schedule("kw-day-start", new Date("2026-11-04T03:00:00Z"));
  await schedule("kw-day-last", new Date("2026-11-05T02:59:59Z"));
  await schedule("kw-next-day", new Date("2026-11-05T03:00:00Z"));
  await schedule("kw-previous-day", new Date("2026-11-04T02:59:59Z"));
  await schedule("kw-desired-only", null, coop, now);
  await schedule("kw-foreign-day", now, foreign);
  const route = await prisma.route.create({
    data: {
      id: "kw-route",
      cooperativeId: coop,
      name: "Área QA",
      scheduledDate: now,
      status: "SCHEDULED",
    },
  });
  await prisma.route.create({
    data: {
      id: "kw-foreign-route",
      cooperativeId: foreign,
      name: "Área QA",
      scheduledDate: now,
      status: "SCHEDULED",
    },
  });
  await prisma.collection.create({
    data: {
      id: "kw-linked",
      cooperativeId: coop,
      scheduleId: "kw-day-start",
      status: "COMPLETED",
    },
  });
  await prisma.collection.create({
    data: { id: "kw-route-collection", cooperativeId: coop, routeId: route.id },
  });
  await prisma.collection.create({
    data: {
      id: "kw-cancelled",
      cooperativeId: coop,
      routeId: route.id,
      status: "CANCELLED",
    },
  });
  await test("coletas de hoje: fronteiras UTC-3, vínculo sem duplicar, canceladas e data desejada", async () => {
    const result = (await additionalAnalysis(coop, "TODAY_COLLECTIONS", now))!;
    assert.equal(result.counts.todayCollections, 2);
    assert.equal(result.counts.todayUnassignedRequests, 1);
    assert.deepEqual(
      new Set(result.items.map((x) => x.id)),
      new Set(["kw-linked", "kw-route-collection", "kw-day-last"]),
    );
  });
  await test("rotas sem recursos: conta uma rota uma vez e não inclui outra cooperativa ou encerradas", async () => {
    await prisma.route.create({
      data: { cooperativeId: coop, name: "Encerrada", status: "COMPLETED" },
    });
    const result = (await additionalAnalysis(
      coop,
      "ROUTES_WITHOUT_RESOURCES",
      now,
    ))!;
    assert.equal(result.counts.routesWithoutResources, 1);
    assert.equal(result.counts.routesWithoutDriver, 1);
    assert.equal(result.counts.routesWithoutVehicle, 1);
    assert.deepEqual(
      result.items.map((x) => x.id),
      [route.id],
    );
  });
  const run = await prisma.agentRun.create({
    data: {
      id: "kw-run",
      cooperativeId: coop,
      agent: "MANAGER",
      command: "OPERATIONAL_SUMMARY",
      origin: "COMMAND",
      eventKey: "kw_seed_run",
      inputHash: "fixture",
      status: "FAILED",
      startedAt: new Date(+now - 3600000),
      expiresAt: new Date(+now + 60000),
    },
  });
  const proposal = await prisma.agentProposal.create({
    data: {
      id: "kw-proposal",
      cooperativeId: coop,
      runId: run.id,
      fingerprint: "kw-fp",
      kind: "REVIEW",
      title: "Revisão QA",
      description: "Conferir dados",
      evidence: {},
      status: "PENDING",
    },
  });
  await prisma.agentProposal.create({
    data: {
      cooperativeId: coop,
      runId: run.id,
      fingerprint: "kw-approved-fp",
      kind: "REVIEW",
      title: "Já revisada",
      description: "Conferir dados",
      evidence: {},
      status: "APPROVED",
    },
  });
  await test("recomendações pendentes: lista somente pendentes sem mudar decisão nem confirmar atualidade", async () => {
    const before = await prisma.agentProposal.findUniqueOrThrow({
      where: { id: proposal.id },
    });
    const result = (await additionalAnalysis(coop, "PENDING_PROPOSALS", now))!;
    assert.equal(result.counts.pendingProposals, 1);
    assert.deepEqual(
      result.items.map((x) => x.id),
      [proposal.id],
    );
    assert.deepEqual(
      await prisma.agentProposal.findUniqueOrThrow({
        where: { id: proposal.id },
      }),
      before,
    );
  });
  await prisma.agentRun.create({
    data: {
      cooperativeId: coop,
      agent: "MANAGER",
      command: "OPERATIONAL_SUMMARY",
      origin: "COMMAND",
      eventKey: "kw_old_failed",
      inputHash: "fixture",
      status: "FAILED",
      startedAt: new Date(+now - 25 * 3600000),
      expiresAt: now,
    },
  });
  for (const [i, status] of (
    ["PENDING", "PROCESSING", "DEAD", "DONE"] as const
  ).entries()) {
    const event = await prisma.agentEvent.create({
      data: {
        id: `kw-event-${i}`,
        cooperativeId: coop,
        eventKey: `kw_source_${i}`,
        source: "Schedule",
        entityId: "kw-day-last",
        kind: "UPDATED",
        sourceHash: "fixture",
        occurredAt: now,
      },
    });
    await prisma.agentEventDelivery.create({
      data: {
        id: `kw-delivery-${i}`,
        cooperativeId: coop,
        eventId: event.id,
        agent: "COLLECTIONS",
        status,
        availableAt: now,
        expiresAt: new Date(+now + 3600000),
      },
    });
  }
  await test("saúde dos agentes: 24h para falhas, estados da fila, sem retentativa e sem dados de outro tenant", async () => {
    const before = await prisma.agentEventDelivery.findMany({
      where: { cooperativeId: coop },
      orderBy: { id: "asc" },
    });
    const result = (await additionalAnalysis(coop, "AUTOMATION_HEALTH", now))!;
    assert.deepEqual(result.counts, {
      failedAnalyses24h: 1,
      pendingEventDeliveries: 1,
      processingEventDeliveries: 1,
      deadEventDeliveries: 1,
    });
    assert.equal(result.items.length, 4);
    assert.deepEqual(
      await prisma.agentEventDelivery.findMany({
        where: { cooperativeId: coop },
        orderBy: { id: "asc" },
      }),
      before,
    );
    assert.equal(
      (await additionalAnalysis(foreign, "AUTOMATION_HEALTH", now))!.items
        .length,
      0,
    );
  });
  await test("novas consultas: limite da lista não reduz contagem total e informa truncamento", async () => {
    await prisma.route.createMany({
      data: Array.from({ length: 101 }, (_, i) => ({
        cooperativeId: coop,
        name: `Limite ${i}`,
        status: "SCHEDULED" as const,
      })),
    });
    const result = (await additionalAnalysis(
      coop,
      "ROUTES_WITHOUT_RESOURCES",
      now,
    ))!;
    assert.equal(result.counts.routesWithoutResources, 102);
    assert.equal(result.items.length, 100);
    assert.equal(result.truncated, true);
  });
  await test("comando ambíguo retorna opções habilitadas sem análise, proposta ou notificação", async () => {
    const before = await prisma.agentRun.count({
      where: { cooperativeId: coop },
    });
    const r = await call({ text: "quero ver as rotas" });
    assert.equal(r.status, 200);
    assert.equal(r.body.recognized, false);
    assert.equal(r.body.clarificationNeeded, true);
    assert.equal(r.body.suggestions.length, 3);
    assert.equal(
      await prisma.agentRun.count({ where: { cooperativeId: coop } }),
      before,
    );
    await prisma.agentConfig.update({
      where: { cooperativeId_agent: { cooperativeId: coop, agent: "ROUTES" } },
      data: { enabled: false },
    });
    const disabled = await call({ text: "quero ver as rotas" });
    assert.equal(disabled.body.suggestions.length, 0);
    assert(
      !disabled.body.commands.some(
        (c: { agent: string }) => c.agent === "ROUTES",
      ),
    );
    assert.equal(
      (await call({ text: "tem alguma rota sem motorista" })).status,
      409,
    );
    await prisma.agentConfig.update({
      where: { cooperativeId_agent: { cooperativeId: coop, agent: "ROUTES" } },
      data: { enabled: true },
    });
  });
  for (const command of [
    "TODAY_COLLECTIONS",
    "ROUTES_WITHOUT_RESOURCES",
    "PENDING_PROPOSALS",
    "AUTOMATION_HEALTH",
  ])
    await test(`API consulta nova ${command}: resultado real e mesmo evento idempotente`, async () => {
      await prisma.agentRun.updateMany({
        where: { cooperativeId: coop },
        data: { startedAt: new Date(Date.now() - 120000) },
      });
      const body = { command, eventId: `kw_api_${command}` };
      const first = await call(body),
        repeat = await call(body);
      assert.equal(first.status, 200, JSON.stringify(first.body));
      assert.equal(repeat.status, 200);
      assert.equal(first.body.run.command, command);
      assert.equal(first.body.run.id, repeat.body.run.id);
      assert.equal(first.body.run.result.proposalIds.length, 0);
    });
  await test("API palavras-chave mantém RBAC e isolamento; filtros desconhecidos não geram execução", async () => {
    await prisma.user.create({
      data: {
        id: "kw-driver-user",
        email: "kw-driver@qa.invalid",
        role: "DRIVER",
        displayName: "Driver QA",
        passwordHash: "unused",
      },
    });
    const driverToken = app.jwt.sign({
      sub: "kw-driver-user",
      role: "DRIVER",
      authVersion: 0,
    });
    assert.equal(
      (await call({ text: "me mostre as coletas de hoje" }, driverToken))
        .status,
      403,
    );
    const before = await prisma.agentRun.count({
      where: { cooperativeId: coop },
    });
    assert.equal(
      (await call({ text: "coletas de hoje do João" })).body.recognized,
      false,
    );
    assert.equal(
      await prisma.agentRun.count({ where: { cooperativeId: coop } }),
      before,
    );
  });
}
