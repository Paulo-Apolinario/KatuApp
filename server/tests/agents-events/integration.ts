import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import type { FastifyInstance } from "fastify";
import { performance } from "node:perf_hooks";
import { prisma } from "../../src/lib/prisma";
import { processAgentEvents } from "../../src/modules/agents/agents.events";
import { eventBatchKey } from "../../src/modules/agents/agents.event-lifecycle";
import { executeAnalysis } from "../../src/modules/agents/agents.execution";
import { recoverExpiredRuns } from "../../src/modules/agents/agents.recovery";
import { analyzeCollections } from "../../src/modules/agents/agents.collections";
import { analyzeManager } from "../../src/modules/agents/agents.manager";
import { agentTick } from "../../src/modules/agents/agents.triggers";
import { LIMITS } from "../../src/modules/agents/agents.types";
const log = { info: () => {}, error: () => {} } as any;
export async function runEventScenarios(app: FastifyInstance) {
  const results: { name: string; status: string; ms: number }[] = [];
  const test = async (name: string, fn: () => Promise<void>) => {
    const start = performance.now();
    await fn();
    results.push({
      name,
      status: "PASS",
      ms: Math.round((performance.now() - start) * 100) / 100,
    });
    console.log("PASS EVENT", name);
  };
  const seed = async (suffix: string) => {
    const user = await prisma.user.create({
      data: {
        email: `event-${suffix}@qa.invalid`,
        displayName: "QA " + suffix,
        role: "COOPERATIVE",
        passwordHash: "unused-local",
      },
    });
    const coop = await prisma.cooperative.create({
      data: { name: "Cooperativa " + suffix, userId: user.id },
    });
    const generator = await prisma.generator.create({
      data: {
        cooperativeId: coop.id,
        name: "Mesmo nome QA",
        email: `event-gen-${suffix}@qa.invalid`,
        type: "SMALL",
        city: "Fortaleza",
        neighborhood: "Centro",
      },
    });
    const driver = await prisma.driver.create({
      data: {
        cooperativeId: coop.id,
        name: "Motorista QA",
        email: `event-driver-${suffix}@qa.invalid`,
      },
    });
    const vehicle = await prisma.vehicle.create({
      data: {
        cooperativeId: coop.id,
        driverId: driver.id,
        plate: `EVT${suffix}`,
        model: "QA",
      },
    });
    const collector = await prisma.collector.create({
      data: {
        cooperativeId: coop.id,
        name: "Catador QA",
        email: `event-cat-${suffix}@qa.invalid`,
      },
    });
    const item = await prisma.wasteStockItem.create({
      data: {
        cooperativeId: coop.id,
        name: "Papel QA",
        category: "Papel",
        unit: "KG",
        defaultUnit: "KG",
      },
    });
    const historical = await prisma.collection.create({
      data: { cooperativeId: coop.id, status: "COMPLETED", totalWeightKg: 10 },
    });
    const lot = await prisma.wasteStockLot.create({
      data: {
        cooperativeId: coop.id,
        stockItemId: item.id,
        code: `EVENT-LOT-${suffix}`,
        quantity: 50,
        availableQuantity: 50,
        unit: "KG",
        status: "AVAILABLE",
      },
    });
    await prisma.agentConfig.createMany({
      data: (["COLLECTIONS", "ROUTES", "MANAGER"] as const).map((agent) => ({
        cooperativeId: coop.id,
        agent,
        enabled: true,
        automationsEnabled: true,
        notificationsEnabled: true,
        nextRunAt: new Date(Date.now() + 86400000),
        nextEventAt: new Date(0),
      })),
    });
    return {
      user,
      coop,
      generator,
      driver,
      vehicle,
      collector,
      item,
      historical,
      lot,
      token: app.jwt.sign({
        sub: user.id,
        role: "COOPERATIVE",
        authVersion: 0,
      }),
    };
  };
  const a = await seed("A3"),
    b = await seed("B3");
  const call = async (
    method: string,
    url: string,
    payload?: unknown,
    token = a.token,
  ) => {
    const r = await app.inject({
      method: method as any,
      url,
      headers: { authorization: "Bearer " + token },
      ...(payload ? { payload: payload as any } : {}),
    });
    return { status: r.statusCode, body: r.json() as any };
  };
  const future = new Date(Date.now() + 2 * 86400000),
    past = new Date(Date.now() - 3 * 86400000);
  const requestBody = {
    generatorId: a.generator.id,
    preferredDate: future.toISOString(),
    requestedMaterials: [
      { wasteTypeId: a.item.id, estimatedQuantity: 2, unit: "KG" },
    ],
  };
  const pauseOthers = () =>
    prisma.agentEventDelivery.updateMany({
      where: { status: "PENDING" },
      data: { availableAt: new Date(Date.now() + 86400000) },
    });
  const age = () =>
    prisma.agentRun.updateMany({
      where: { cooperativeId: { in: [a.coop.id, b.coop.id] } },
      data: { startedAt: new Date(Date.now() - 2 * 86400000) },
    });
  const ready = async (
    cooperativeId = a.coop.id,
    agent: "COLLECTIONS" | "ROUTES" | "MANAGER" = "COLLECTIONS",
  ) => {
    await pauseOthers();
    await age();
    await prisma.agentConfig.update({
      where: { cooperativeId_agent: { cooperativeId, agent } },
      data: { nextEventAt: new Date(0) },
    });
    await prisma.agentEventDelivery.updateMany({
      where: { cooperativeId, agent, status: "PENDING" },
      data: { availableAt: new Date(Date.now() - 1000) },
    });
  };
  const consume = async (
    cooperativeId = a.coop.id,
    agent: "COLLECTIONS" | "ROUTES" | "MANAGER" = "COLLECTIONS",
  ) => {
    await ready(cooperativeId, agent);
    await processAgentEvents(log);
    return prisma.agentRun.findFirstOrThrow({
      where: { cooperativeId, agent, origin: "EVENT" },
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
    });
  };
  let scheduleId = "";
  await test("01 — solicitação real recebida e analisada com painel fechado", async () => {
    const response = await call("POST", "/schedules", requestBody);
    assert.equal(response.status, 201, JSON.stringify(response.body));
    scheduleId = response.body.schedule.id;
    const event = await prisma.agentEvent.findFirstOrThrow({
      where: {
        cooperativeId: a.coop.id,
        entityId: scheduleId,
        source: "Schedule",
      },
    });
    assert.equal(
      await prisma.agentEventDelivery.count({ where: { eventId: event.id } }),
      2,
    );
    const run = await consume();
    assert.equal(run.status, "SUCCEEDED");
    assert.ok((run.result as any).items.some((x: any) => x.id === scheduleId));
    const cfg = await prisma.agentConfig.findUniqueOrThrow({
      where: {
        cooperativeId_agent: { cooperativeId: a.coop.id, agent: "COLLECTIONS" },
      },
    });
    assert.ok(
      +cfg.nextRunAt < Date.now() + 61 * 60000,
      "Análise por evento deve cobrir o ciclo periódico",
    );
    assert.ok(
      (run.result as any).eventSources.some((x: any) => x.id === event.id),
    );
  });
  await test("02 — data atrasada gera sinal real sem mudar a solicitação", async () => {
    await prisma.schedule.update({
      where: { id: scheduleId },
      data: { preferredDate: past },
    });
    const run = await consume();
    assert.ok(
      (run.result as any).items
        .find((x: any) => x.id === scheduleId)
        .reasons.some((r: string) => r.includes("ultrapassou")),
    );
    assert.equal(
      (await prisma.schedule.findUniqueOrThrow({ where: { id: scheduleId } }))
        .status,
      "REQUESTED",
    );
  });
  await test("03 — cancelamento antes do consumo não gera atendimento fantasma", async () => {
    const response = await call("PATCH", `/schedules/${scheduleId}/status`, {
      status: "CANCELLED",
    });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const run = await consume();
    assert.ok(!(run.result as any).items.some((x: any) => x.id === scheduleId));
    assert.equal(await prisma.collection.count({ where: { scheduleId } }), 0);
  });
  const route = await prisma.route.create({
    data: {
      cooperativeId: a.coop.id,
      name: "Rota QA eventos",
      scheduledDate: past,
      driverId: a.driver.id,
      vehicleId: a.vehicle.id,
      collectorIds: [a.collector.id],
      stops: [],
    },
  });
  let proposalId = "";
  await test("04 — rota alterada torna proposta pendente histórica e bloqueia aprovação", async () => {
    await consume(a.coop.id, "ROUTES");
    const proposal = await prisma.agentProposal.findFirstOrThrow({
      where: {
        cooperativeId: a.coop.id,
        kind: "REVIEW_ROUTE",
        status: "PENDING",
      },
    });
    proposalId = proposal.id;
    await prisma.route.update({
      where: { id: route.id },
      data: { scheduledDate: future },
    });
    const detail = await call("GET", `/agents/proposals/${proposal.id}`);
    assert.equal(detail.body.proposal.freshness.current, false);
    const decision = await call(
      "POST",
      `/agents/proposals/${proposal.id}/decision`,
      {
        status: "APPROVED",
        expectedVersion: 1,
        eventId: "old_route_approval",
        reason: "Dados antigos",
      },
    );
    assert.equal(decision.status, 409);
    assert.equal(decision.body.code, "STALE_PROPOSAL");
  });
  await test("05 — veículo indisponível dispara revisão e mantém sua situação", async () => {
    await prisma.vehicle.update({
      where: { id: a.vehicle.id },
      data: { status: "MAINTENANCE" },
    });
    const run = await consume(a.coop.id, "ROUTES");
    assert.ok(JSON.stringify(run.result).includes("Veículo indisponível"));
    assert.equal(
      (await prisma.vehicle.findUniqueOrThrow({ where: { id: a.vehicle.id } }))
        .status,
      "MAINTENANCE",
    );
  });
  await test("06 — mesmo bairro com dias incompatíveis não é agrupado", async () => {
    await prisma.schedule.createMany({
      data: [
        {
          cooperativeId: a.coop.id,
          generatorId: a.generator.id,
          requestedByUserId: a.user.id,
          preferredDate: future,
        },
        {
          cooperativeId: a.coop.id,
          generatorId: a.generator.id,
          requestedByUserId: a.user.id,
          preferredDate: new Date(+future + 86400000),
        },
      ],
    });
    const analysis = await analyzeCollections(
      a.coop.id,
      "COLLECTION_PRIORITIES",
    );
    assert.equal(
      analysis.proposals.filter((p) => p.kind === "GROUP_COLLECTIONS").length,
      0,
    );
  });
  await test("07 — duas cooperativas semelhantes têm filas, análises e APIs isoladas", async () => {
    const row = await prisma.schedule.create({
      data: {
        cooperativeId: b.coop.id,
        generatorId: b.generator.id,
        requestedByUserId: b.user.id,
        preferredDate: future,
      },
    });
    const run = await consume(b.coop.id);
    assert.ok((run.result as any).items.some((x: any) => x.id === row.id));
    assert.ok(!(run.result as any).items.some((x: any) => x.id === scheduleId));
    assert.equal(
      (await call("GET", `/agents/proposals/${proposalId}`, undefined, b.token))
        .status,
      404,
    );
    const foreignDelivery = await prisma.agentEventDelivery.findFirstOrThrow({
      where: { cooperativeId: b.coop.id },
    });
    assert.equal(
      (await call("GET", `/agents/events?cursor=${foreignDelivery.id}`)).status,
      404,
    );
  });
  await test("08 — replay da mesma reserva não duplica análise nem aviso", async () => {
    const row = await prisma.schedule.create({
      data: {
        cooperativeId: a.coop.id,
        requestedByUserId: a.user.id,
        preferredDate: future,
      },
    });
    await ready();
    const deliveries = await prisma.agentEventDelivery.findMany({
      where: {
        cooperativeId: a.coop.id,
        agent: "COLLECTIONS",
        status: "PENDING",
        availableAt: { lte: new Date() },
      },
      take: LIMITS.eventBatch,
      select: { id: true, attempts: true },
    });
    const input = {
      cooperativeId: a.coop.id,
      actorId: null,
      origin: "EVENT" as const,
      command: "COLLECTION_PRIORITIES" as const,
      eventId: eventBatchKey(deliveries),
      deliveryIds: deliveries.map((x) => x.id).sort(),
    };
    const first = await executeAnalysis(input),
      notices = await prisma.inboxNotification.count({
        where: { userId: a.user.id },
      });
    const again = await executeAnalysis(input);
    assert.equal(first.run.id, again.run.id);
    assert.ok(again.replayed);
    assert.equal(
      await prisma.inboxNotification.count({ where: { userId: a.user.id } }),
      notices,
    );
    assert.ok(row.id);
  });
  await test("09 — reinício durante execução recupera lease e conserva eventos para nova tentativa", async () => {
    const event = await prisma.agentEvent.findFirstOrThrow({
      where: {
        cooperativeId: a.coop.id,
        deliveries: { some: { agent: "COLLECTIONS" } },
      },
    });
    const run = await prisma.agentRun.create({
      data: {
        cooperativeId: a.coop.id,
        agent: "COLLECTIONS",
        origin: "EVENT",
        command: "COLLECTION_PRIORITIES",
        eventKey: "run:crashed_worker_test",
        inputHash: "qa",
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    // Reuse a completed delivery only as explicit crash-fixture setup.
    const delivery = await prisma.agentEventDelivery.findFirstOrThrow({
      where: { eventId: event.id, agent: "COLLECTIONS" },
    });
    await prisma.agentEventDelivery.update({
      where: { id: delivery.id },
      data: { status: "PROCESSING", runId: run.id, attempts: 1 },
    });
    await recoverExpiredRuns();
    const recovered = await prisma.agentEventDelivery.findUniqueOrThrow({
      where: { id: delivery.id },
    });
    assert.equal(recovered.status, "PENDING");
    assert.equal(recovered.errorCode, "LEASE_EXPIRED");
    assert.equal(
      (await prisma.agentRun.findUniqueOrThrow({ where: { id: run.id } }))
        .status,
      "FAILED",
    );
    await consume();
    assert.equal(
      (
        await prisma.agentEventDelivery.findUniqueOrThrow({
          where: { id: delivery.id },
        })
      ).status,
      "DONE",
    );
  });
  await test("10 — agente desabilitado com análise pendente não processa a entrega", async () => {
    await prisma.schedule.create({
      data: { cooperativeId: a.coop.id, requestedByUserId: a.user.id },
    });
    await ready();
    await prisma.agentConfig.update({
      where: {
        cooperativeId_agent: { cooperativeId: a.coop.id, agent: "COLLECTIONS" },
      },
      data: { enabled: false },
    });
    const before = await prisma.agentRun.count();
    await processAgentEvents(log);
    assert.equal(await prisma.agentRun.count(), before);
    assert.ok(
      await prisma.agentEventDelivery.count({
        where: {
          cooperativeId: a.coop.id,
          agent: "COLLECTIONS",
          status: "SKIPPED",
        },
      }),
    );
    await prisma.agentConfig.update({
      where: {
        cooperativeId_agent: { cooperativeId: a.coop.id, agent: "COLLECTIONS" },
      },
      data: { enabled: true },
    });
  });
  await test("11 — usuário sem perfil não executa agente nem lê fila", async () => {
    const actor = await prisma.user.create({
      data: {
        email: "events-collector-auth@qa.invalid",
        displayName: "Catador QA",
        role: "COLLECTOR",
        passwordHash: "unused",
      },
    });
    const token = app.jwt.sign({
      sub: actor.id,
      role: actor.role,
      authVersion: 0,
    });
    assert.equal(
      (
        await call(
          "POST",
          "/agents/COLLECTIONS/run",
          { eventId: "denied_event_test" },
          token,
        )
      ).status,
      403,
    );
    assert.equal(
      (await call("GET", "/agents/events", undefined, token)).status,
      403,
    );
  });
  await test("12 — aviso histórico preserva referência e informa origem desatualizada", async () => {
    const notice = await prisma.inboxNotification.findFirstOrThrow({
      where: { userId: a.user.id, eventKey: `agent:proposal:${proposalId}` },
    });
    const detail = await call(
      "GET",
      `/agents/proposals/${(notice.data as any).proposalId}`,
    );
    assert.equal(detail.status, 200);
    assert.equal(detail.body.proposal.freshness.current, false);
    assert.equal(
      (
        await prisma.agentProposal.findUniqueOrThrow({
          where: { id: proposalId },
        })
      ).status,
      "PENDING",
    );
    assert.equal(notice.readAt, null);
  });
  await test("13 — solicitação offline repetida usa idempotência existente e produz um evento", async () => {
    const pf = await prisma.user.create({
        data: {
          email: "events-pf-offline@qa.invalid",
          displayName: "Residencial QA",
          role: "PF",
          passwordHash: "unused",
        },
      }),
      token = app.jwt.sign({ sub: pf.id, role: pf.role, authVersion: 0 });
    const body = {
      operationId: randomUUID(),
      cooperativeId: a.coop.id,
      pickupAddress: "Rua QA, 10",
      preferredDate: new Date(Date.now() + 86400000).toISOString(),
      requestedMaterials: [
        { wasteTypeId: a.item.id, unit: "KG", estimatedQuantity: 1 },
      ],
    };
    const first = await call("POST", "/schedules", body, token),
      second = await call("POST", "/schedules", body, token);
    assert.equal(first.status, 201, JSON.stringify(first.body));
    assert.equal(second.status, 201, JSON.stringify(second.body));
    assert.equal(first.body.schedule.id, second.body.schedule.id);
    assert.equal(
      await prisma.agentEvent.count({
        where: { entityId: first.body.schedule.id, source: "Schedule" },
      }),
      1,
    );
  });
  await test("14 — indisponibilidade temporária do banco preserva pendência para retomada", async () => {
    await prisma.schedule.create({
      data: { cooperativeId: a.coop.id, requestedByUserId: a.user.id },
    });
    await ready();
    const before = await prisma.agentEventDelivery.count({
      where: { cooperativeId: a.coop.id, status: "PENDING" },
    });
    const original = prisma.agentEventDelivery.findFirst;
    prisma.agentEventDelivery.findFirst = (() => {
      throw Object.assign(Error("Banco temporariamente indisponível"), {
        code: "P1001",
      });
    }) as any;
    try {
      await assert.rejects(
        () => processAgentEvents(log),
        (e: any) => e.code === "P1001",
      );
    } finally {
      prisma.agentEventDelivery.findFirst = original;
    }
    assert.equal(
      await prisma.agentEventDelivery.count({
        where: { cooperativeId: a.coop.id, status: "PENDING" },
      }),
      before,
    );
    await consume();
  });
  if (!process.env.KATUA_NATIVE_POSTGRES_BIN) {
    results.push({
      name: "15 — concorrência de instâncias em PostgreSQL nativo",
      status: "PENDING",
      ms: 0,
    });
    console.log(
      "PENDING EVENT 15 — PostgreSQL nativo indisponível: ambiente não permite usuário não-root; PGlite não certifica múltiplas conexões reais",
    );
  } else {
    await test("15 — dois processos concorrentes em PostgreSQL nativo não repetem o lote", async () => {
      await prisma.schedule.create({
        data: { cooperativeId: a.coop.id, requestedByUserId: a.user.id },
      });
      await ready();
      const before = await prisma.agentRun.count({
        where: { cooperativeId: a.coop.id, origin: "EVENT" },
      });
      const worker = () =>
        new Promise<void>((resolve, reject) => {
          const c = spawn(
            process.execPath,
            ["--import", "tsx", "tests/agents-events/worker.ts"],
            {
              cwd: process.cwd(),
              env: process.env,
              stdio: ["ignore", "pipe", "pipe"],
            },
          );
          let error = "";
          c.stderr.on("data", (b) => {
            error += b.toString();
          });
          c.on("error", reject);
          c.on("exit", (code) =>
            code === 0 ? resolve() : reject(Error(error || `Worker ${code}`)),
          );
        });
      await Promise.all([worker(), worker()]);
      assert.equal(
        await prisma.agentRun.count({
          where: { cooperativeId: a.coop.id, origin: "EVENT" },
        }),
        before + 1,
      );
    });
  }
  await test("16 — rollback operacional remove também o evento e suas entregas", async () => {
    const id = randomUUID();
    await assert.rejects(() =>
      prisma.$transaction(async (tx) => {
        await tx.schedule.create({
          data: { id, cooperativeId: a.coop.id, requestedByUserId: a.user.id },
        });
        throw Error("Rollback QA");
      }),
    );
    assert.equal(await prisma.agentEvent.count({ where: { entityId: id } }), 0);
    assert.equal(await prisma.schedule.count({ where: { id } }), 0);
  });
  await test("17 — alteração só de updatedAt não cria evento ou ciclo de notificações", async () => {
    const before = await prisma.agentEvent.count({
      where: { entityId: route.id, source: "Route" },
    });
    await prisma.route.update({
      where: { id: route.id },
      data: { updatedAt: new Date() },
    });
    assert.equal(
      await prisma.agentEvent.count({
        where: { entityId: route.id, source: "Route" },
      }),
      before,
    );
    const count = await prisma.agentEvent.count({
      where: { cooperativeId: a.coop.id, source: "SystemAlert" },
    });
    await analyzeManager(a.coop.id, "OPERATIONAL_SUMMARY");
    await analyzeManager(a.coop.id, "OPERATIONAL_SUMMARY");
    assert.equal(
      await prisma.agentEvent.count({
        where: { cooperativeId: a.coop.id, source: "SystemAlert" },
      }),
      count,
    );
  });
  await test("18 — limite de três tentativas encerra falha sem repetir indefinidamente", async () => {
    await prisma.schedule.create({
      data: { cooperativeId: a.coop.id, requestedByUserId: a.user.id },
    });
    await ready();
    let ids: string[] = [];
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (ids.length) {
        await pauseOthers();
        await prisma.agentEventDelivery.updateMany({
          where: { id: { in: ids } },
          data: { availableAt: new Date(Date.now() - 1000) },
        });
        await prisma.agentConfig.update({
          where: {
            cooperativeId_agent: {
              cooperativeId: a.coop.id,
              agent: "COLLECTIONS",
            },
          },
          data: { nextEventAt: new Date(0) },
        });
      }
      const rows = await prisma.agentEventDelivery.findMany({
        where: {
          cooperativeId: a.coop.id,
          agent: "COLLECTIONS",
          status: "PENDING",
          availableAt: { lte: new Date() },
        },
        take: LIMITS.eventBatch,
        select: { id: true, attempts: true },
      });
      ids = rows.map((r) => r.id).sort();
      assert.ok(ids.length);
      const result = await executeAnalysis(
        {
          cooperativeId: a.coop.id,
          actorId: null,
          origin: "EVENT",
          command: "COLLECTION_PRIORITIES",
          eventId: eventBatchKey(rows),
          deliveryIds: ids,
        },
        {
          analyze: async () => {
            throw Object.assign(Error("Falha temporária QA"), {
              code: "P1001",
            });
          },
        },
      );
      assert.equal(result.run.status, "FAILED");
    }
    assert.equal(
      await prisma.agentEventDelivery.count({
        where: { id: { in: ids }, status: "DEAD", attempts: 3 },
      }),
      ids.length,
    );
  });
  await test("19 — limite de duração não permite resultado tardio nem análises paralelas órfãs", async () => {
    await age();
    let release!: () => void;
    const hold = new Promise<void>((r) => {
      release = r;
    });
    const result = await executeAnalysis(
      {
        cooperativeId: a.coop.id,
        actorId: a.user.id,
        origin: "MANUAL",
        command: "COLLECTION_PRIORITIES",
        eventId: "timeout_guard_test",
      },
      {
        analyze: async () => {
          await hold;
          return {
            agent: "COLLECTIONS",
            command: "COLLECTION_PRIORITIES",
            generatedAt: new Date().toISOString(),
            summary: "QA",
            counts: {},
            items: [],
            warnings: [],
            truncated: false,
            method: "QA",
            proposals: [],
          };
        },
      },
      { budgetMs: 20 },
    );
    assert.equal(result.run.errorCode, "TIME_BUDGET_EXCEEDED");
    await assert.rejects(
      () =>
        executeAnalysis({
          cooperativeId: b.coop.id,
          actorId: b.user.id,
          origin: "MANUAL",
          command: "COLLECTION_PRIORITIES",
          eventId: "while_timeout_held",
        }),
      (e: any) => e.code === "SERVER_BUSY",
    );
    release();
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(
      (
        await prisma.agentRun.findUniqueOrThrow({
          where: { id: result.run.id },
        })
      ).status,
      "FAILED",
    );
  });
  await test("20 — desligamento global preserva fila sem iniciar análise", async () => {
    await prisma.schedule.create({
      data: { cooperativeId: a.coop.id, requestedByUserId: a.user.id },
    });
    await ready();
    const before = await prisma.agentRun.count();
    process.env.AGENTS_ENABLED = "false";
    try {
      await agentTick(log);
      assert.equal(await prisma.agentRun.count(), before);
    } finally {
      process.env.AGENTS_ENABLED = "true";
    }
  });
  await test("21 — expiração registrada não descarta silenciosamente evento antigo", async () => {
    await prisma.schedule.create({
      data: { cooperativeId: a.coop.id, requestedByUserId: a.user.id },
    });
    await ready();
    const row = await prisma.agentEventDelivery.findFirstOrThrow({
      where: {
        cooperativeId: a.coop.id,
        agent: "COLLECTIONS",
        status: "PENDING",
      },
    });
    await prisma.agentEventDelivery.update({
      where: { id: row.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await processAgentEvents(log);
    const stored = await prisma.agentEventDelivery.findUniqueOrThrow({
      where: { id: row.id },
    });
    assert.equal(stored.status, "DEAD");
    assert.equal(stored.errorCode, "EVENT_EXPIRED");
  });
  const performanceResult: Record<string, unknown> = {};
  await test("22 — carga de mil solicitações mantém lote e saída limitados", async () => {
    await age();
    const before = process.memoryUsage(),
      cpu = process.cpuUsage(),
      started = performance.now();
    await prisma.schedule.createMany({
      data: Array.from({ length: 1000 }, (_, i) => ({
        cooperativeId: a.coop.id,
        generatorId: a.generator.id,
        requestedByUserId: a.user.id,
        preferredDate: future,
        createdAt: new Date(+past + i * 1000),
      })),
    });
    const run = await consume();
    const result = run.result as any;
    assert.equal(run.status, "SUCCEEDED");
    assert.ok(result.truncated);
    assert.ok(result.items.length <= 100);
    assert.ok(run.eventDeliveryIds.length <= 20);
    assert.ok(result.proposalIds.length <= 10);
    const usage = process.cpuUsage(cpu),
      after = process.memoryUsage();
    Object.assign(performanceResult, {
      elapsedMs: Math.round(performance.now() - started),
      cpuUserMs: Math.round(usage.user / 1000),
      cpuSystemMs: Math.round(usage.system / 1000),
      rssBeforeMiB: Math.round(before.rss / 1048576),
      rssAfterMiB: Math.round(after.rss / 1048576),
      heapAfterMiB: Math.round(after.heapUsed / 1048576),
      resultBytes: Buffer.byteLength(JSON.stringify(result)),
      sourceEventsInBatch: run.eventDeliveryIds.length,
      listedItems: result.items.length,
    });
  });
  await test("23 — consultas críticas usam índices disponíveis e API mostra fila real", async () => {
    const plan = await prisma.$queryRawUnsafe<any[]>(
      'EXPLAIN SELECT id FROM "AgentEventDelivery" WHERE status=\'PENDING\' AND "availableAt"<=now() ORDER BY "availableAt","createdAt",id LIMIT 20',
    );
    performanceResult.queuePlan = plan.map((p) => p["QUERY PLAN"]);
    const response = await call("GET", "/agents/events?limit=1");
    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 1);
    assert.ok(response.body.counts.DONE > 0);
    assert.ok(response.body.nextCursor);
    assert.ok(response.body.data[0].event.entityId);
  });
  await test("24 — captura e análises preservam pesos, estoque e destinações", async () => {
    assert.equal(
      await prisma.collectionWasteEntry.count({
        where: { cooperativeId: a.coop.id },
      }),
      0,
    );
    assert.equal(
      await prisma.wasteStockLot.count({ where: { cooperativeId: a.coop.id } }),
      1,
    );
    assert.equal(
      await prisma.collectionWasteDestination.count({
        where: { cooperativeId: a.coop.id },
      }),
      0,
    );
  });
  await test("25 — agentes simultâneos respeitam uma única vaga global", async () => {
    await age();
    let release!: () => void, started!: () => void;
    const hold = new Promise<void>((r) => {
        release = r;
      }),
      ready = new Promise<void>((r) => {
        started = r;
      });
    const first = executeAnalysis(
      {
        cooperativeId: a.coop.id,
        actorId: a.user.id,
        origin: "MANUAL",
        command: "COLLECTION_PRIORITIES",
        eventId: "simultaneous_first",
      },
      {
        analyze: async () => {
          started();
          await hold;
          return {
            agent: "COLLECTIONS",
            command: "COLLECTION_PRIORITIES",
            generatedAt: new Date().toISOString(),
            summary: "Controle de concorrência QA",
            counts: {},
            items: [],
            warnings: [],
            truncated: false,
            method: "QA",
            proposals: [],
          };
        },
      },
    );
    await ready;
    try {
      const others = await Promise.allSettled([
        executeAnalysis({
          cooperativeId: a.coop.id,
          actorId: a.user.id,
          origin: "MANUAL",
          command: "ROUTES_ATTENTION",
          eventId: "simultaneous_route",
        }),
        executeAnalysis({
          cooperativeId: a.coop.id,
          actorId: a.user.id,
          origin: "MANUAL",
          command: "OPERATIONAL_SUMMARY",
          eventId: "simultaneous_manager",
        }),
        executeAnalysis({
          cooperativeId: b.coop.id,
          actorId: b.user.id,
          origin: "MANUAL",
          command: "COLLECTION_PRIORITIES",
          eventId: "simultaneous_other",
        }),
      ]);
      assert.ok(
        others.every(
          (r) =>
            r.status === "rejected" &&
            ["RUN_BUSY", "SERVER_BUSY"].includes(r.reason.code),
        ),
      );
    } finally {
      release();
    }
    assert.equal((await first).run.status, "SUCCEEDED");
  });
  await test("26 — ocorrências críticas semelhantes geram uma recomendação e um aviso", async () => {
    await age();
    await prisma.vehicleDocument.createMany({
      data: [1, 2].map((i) => ({
        cooperativeId: a.coop.id,
        vehicleId: a.vehicle.id,
        documentType: `Documento QA ${i}`,
        documentNumber: `QA-${i}`,
        expiryDate: past,
      })),
    });
    const before = await prisma.inboxNotification.count({
      where: { userId: a.user.id },
    });
    const run = await executeAnalysis({
      cooperativeId: a.coop.id,
      actorId: a.user.id,
      origin: "MANUAL",
      command: "OPERATIONAL_SUMMARY",
      eventId: "grouped_alerts_first",
    });
    assert.equal(run.run.status, "SUCCEEDED");
    const ids = (run.run.result as any).proposalIds;
    assert.equal(ids.length, 1);
    const group = await prisma.agentProposal.findUniqueOrThrow({
      where: { id: ids[0] },
    });
    assert.equal(group.kind, "REVIEW_OCCURRENCES");
    assert.equal((group.evidence as any).alerts.length, 2);
    assert.equal(
      await prisma.inboxNotification.count({ where: { userId: a.user.id } }),
      before + 1,
    );
    await executeAnalysis({
      cooperativeId: a.coop.id,
      actorId: a.user.id,
      origin: "MANUAL",
      command: "OPERATIONAL_SUMMARY",
      eventId: "grouped_alerts_second",
    });
    assert.equal(
      await prisma.inboxNotification.count({ where: { userId: a.user.id } }),
      before + 1,
    );
    assert.equal(
      (
        await prisma.collection.findUniqueOrThrow({
          where: { id: a.historical.id },
        })
      ).totalWeightKg,
      10,
    );
    assert.equal(
      Number(
        (
          await prisma.wasteStockLot.findUniqueOrThrow({
            where: { id: a.lot.id },
          })
        ).availableQuantity,
      ),
      50,
    );
  });
  await test("27 — perda de permissão durante análise impede novas propostas", async () => {
    await age();
    const before = await prisma.agentProposal.count({
      where: { cooperativeId: b.coop.id },
    });
    const result = await executeAnalysis(
      {
        cooperativeId: b.coop.id,
        actorId: b.user.id,
        origin: "MANUAL",
        command: "COLLECTION_PRIORITIES",
        eventId: "disabled_owner_during_analysis",
      },
      {
        analyze: async () => {
          await prisma.user.update({
            where: { id: b.user.id },
            data: { isActive: false },
          });
          return {
            agent: "COLLECTIONS",
            command: "COLLECTION_PRIORITIES",
            generatedAt: new Date().toISOString(),
            summary: "QA",
            counts: {},
            items: [],
            warnings: [],
            truncated: false,
            method: "QA",
            proposals: [],
          };
        },
      },
    );
    assert.equal(result.run.status, "FAILED");
    assert.equal(result.run.errorCode, "COOPERATIVE_UNAVAILABLE");
    assert.equal(
      await prisma.agentProposal.count({ where: { cooperativeId: b.coop.id } }),
      before,
    );
    await prisma.user.update({
      where: { id: b.user.id },
      data: { isActive: true },
    });
  });
  await test("28 — pausa e retomada de captura preservam dados e histórico", async () => {
    const before = await prisma.agentEvent.count();
    await prisma.$executeRawUnsafe(
      readFileSync("prisma/rollback/agents-events-pause.sql", "utf8"),
    );
    const paused = await prisma.schedule.create({
      data: { cooperativeId: a.coop.id, requestedByUserId: a.user.id },
    });
    assert.equal(await prisma.agentEvent.count(), before);
    assert.ok(await prisma.schedule.findUnique({ where: { id: paused.id } }));
    await prisma.$executeRawUnsafe(
      readFileSync("prisma/rollback/agents-events-resume.sql", "utf8"),
    );
    const resumed = await prisma.schedule.create({
      data: { cooperativeId: a.coop.id, requestedByUserId: a.user.id },
    });
    assert.equal(
      await prisma.agentEvent.count({
        where: { entityId: resumed.id, source: "Schedule" },
      }),
      1,
    );
  });
  writeFileSync(
    path.join(
      process.env.KATUA_VALIDATION_TOOLS!,
      "agents-events-results.json",
    ),
    JSON.stringify(
      {
        date: "2026-11-04",
        passed: results.filter((r) => r.status === "PASS").length,
        pending: results.filter((r) => r.status === "PENDING").length,
        failed: 0,
        environment:
          process.env.KATUA_NATIVE_POSTGRES_BIN ? "PostgreSQL nativo descartável + Fastify/Prisma reais; dois processos concorrentes; indisponibilidade por falha injetada" : "PGlite/socket descartável + Fastify/Prisma reais; concorrência nativa pendente; indisponibilidade por falha injetada",
        cases: results,
        performance: performanceResult,
      },
      null,
      2,
    ),
  );
  console.log(
    `AGENTS_EVENTS_RESULT ${results.filter((r) => r.status === "PASS").length} passed, ${results.filter((r) => r.status === "PENDING").length} pending, 0 failed`,
  );
  // Do not alter later interface tests: leave the automation fixtures opted out after validation.
  await prisma.agentConfig.updateMany({
    where: { cooperativeId: { in: [a.coop.id, b.coop.id] } },
    data: { automationsEnabled: false },
  });
}
