import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
async function main() {
  const url = new URL(process.env.DATABASE_URL || "http://invalid");
  if (
    process.env.KATUA_LOCAL_VALIDATION !== "1" ||
    url.hostname !== "127.0.0.1" ||
    url.port !== "54329"
  )
    throw Error("Exige banco local descartável");
  process.env.NODE_ENV = "test";
  process.env.LOG_LEVEL = "silent";
  process.env.JWT_SECRET = randomBytes(48).toString("hex");
  const { prisma: p } = await import("../../src/lib/prisma");
  const { buildApp } = await import("../../src/app");
  const app = await buildApp();
  await app.ready();
  const checks: string[] = [],
    ok = (s: string) => {
      checks.push(s);
      console.log("PASS " + s);
    };
  const users: any = {};
  for (const [name, role] of [
    ["owner", "COOPERATIVE"],
    ["foreign", "COOPERATIVE"],
    ["a", "COLLECTOR"],
    ["b", "COLLECTOR"],
    ["c", "COLLECTOR"],
    ["outsider", "COLLECTOR"],
    ["gen", "GENERATOR_SMALL"],
    ["gen2", "GENERATOR_SMALL"],
    ["driver", "DRIVER"],
  ])
    users[name] = await p.user.create({
      data: {
        email: `teams-${name}@test.invalid`,
        displayName: name,
        role: role as any,
        passwordHash: "unused",
      },
    });
  const coop = await p.cooperative.create({
      data: { userId: users.owner.id, name: "Cooperativa Equipes" },
    }),
    other = await p.cooperative.create({
      data: { userId: users.foreign.id, name: "Outra Equipe" },
    });
  const people: any = {};
  for (const name of ["a", "b", "c", "outsider"])
    people[name] = await p.collector.create({
      data: {
        userId: users[name].id,
        cooperativeId: name === "outsider" ? other.id : coop.id,
        email: users[name].email,
        name: "Catador " + name,
      },
    });
  const generator = await p.generator.create({
    data: {
      userId: users.gen.id,
      cooperativeId: coop.id,
      name: "Gerador Teste",
      email: users.gen.email,
      type: "SMALL",
    },
  });
  await p.generator.create({
    data: {
      userId: users.gen2.id,
      cooperativeId: other.id,
      name: "Gerador Alheio",
      email: users.gen2.email,
      type: "SMALL",
    },
  });
  async function call(
    who: string,
    method: any,
    path: string,
    payload?: any,
    expected = 200,
  ) {
    const res = await app.inject({
      method,
      url: path,
      headers: {
        authorization:
          "Bearer " +
          app.jwt.sign({ sub: users[who].id, role: users[who].role }),
      },
      ...(payload === undefined ? {} : { payload }),
    });
    assert.equal(
      res.statusCode,
      expected,
      `${who} ${method} ${path}: ${res.body.slice(0, 500)}`,
    );
    return res.json();
  }
  const ids = ["a", "b", "c"].map((n) => people[n].id);
  const material = await p.wasteStockItem.create({
    data: {
      cooperativeId: coop.id,
      name: "Papelão mensal",
      category: "Papel",
      unit: "KG",
    },
  });
  const bin = await p.bin.create({
    data: {
      cooperativeId: coop.id,
      name: "PEV mensal",
      binId: "pev-month",
      pointKind: "PEV",
      publicAccess: true,
      latitude: -3.73,
      longitude: -38.52,
    },
  });
  async function create(kg: number, date: string, extra: any = {}) {
    return p.collection.create({
      data: {
        cooperativeId: coop.id,
        collectorId: ids[0],
        generatorId: generator.id,
        status: "COLLECTED",
        totalWeightKg: kg,
        collectedAt: new Date(date),
        collectionMaterials: {
          create: {
            wasteTypeId: material.id,
            nameSnapshot: material.name,
            quantity: kg,
            unit: "KG",
          },
        },
        ...extra,
      },
      include: { collectionMaterials: true },
    });
  }
  await create(20, "2026-09-30T23:55:00-03:00", {
    receivedAt: new Date("2026-10-01T10:00:00-03:00"),
  });
  const shared = await create(40, "2026-10-01T00:05:00-03:00", {
    status: "RECEIVED",
    teamNameSnapshot: "Equipe mensal",
    participants: {
      create: ids.map((id) => ({
        collectorId: id,
        nameSnapshot: "Participante " + id,
      })),
    },
  });
  await p.collectionWasteEntry.create({
    data: {
      cooperativeId: coop.id,
      collectionId: shared.id,
      collectionMaterialId: shared.collectionMaterials[0].id,
      wasteTypeId: material.id,
      collectorId: ids[0],
      generatorId: generator.id,
      materialNameSnapshot: material.name,
      unit: "KG",
      collectedQuantity: 40,
      remainingQuantity: 40,
      collectedAt: shared.collectedAt,
    },
  });
  await create(10, "2026-10-05T10:00:00-03:00", {
    generatorId: null,
    binId: bin.id,
  });
  await create(5, "2026-10-07T10:00:00-03:00", {
    generatorId: null,
    status: "COMPLETED",
  });
  await p.collection.create({
    data: {
      cooperativeId: coop.id,
      collectorId: ids[0],
      generatorId: generator.id,
      status: "COMPLETED",
      totalWeightKg: 7,
      completedAt: new Date("2026-10-10T10:00:00-03:00"),
    },
  });
  await create(100, "2026-10-01T10:00:00-03:00", { status: "CANCELLED" });
  const schedule = await p.schedule.create({
    data: {
      cooperativeId: coop.id,
      generatorId: generator.id,
      requestedByUserId: users.gen.id,
      createdAt: new Date("2026-10-15T10:00:00-03:00"),
      requestedMaterials: {
        create: {
          nameSnapshot: material.name,
          estimatedQuantity: 1000,
          unit: "KG",
        },
      },
    },
  });
  await p.collection.create({
    data: {
      cooperativeId: coop.id,
      generatorId: generator.id,
      collectorId: ids[0],
      scheduleId: schedule.id,
      status: "PENDING",
      totalWeightKg: 1000,
    },
  });
  await p.extraCollectionOrder.create({
    data: {
      id: "monthly-order",
      cooperativeId: coop.id,
      collectorId: ids[1],
      status: "PENDING_REVIEW",
      originalHash: "fixture",
      payload: {
        generatorId: generator.id,
        materials: [{ quantity: 500, unit: "KG" }],
      },
      reporterUserId: users.b.id,
      reporterName: "Catador B",
      custody: "ORIGIN",
      custodyNotes: "Aguardando cooperativa",
      createdAt: new Date("2026-10-16T10:00:00-03:00"),
    },
  });
  await p.collection.create({
    data: {
      cooperativeId: other.id,
      collectorId: people.outsider.id,
      status: "COMPLETED",
      totalWeightKg: 8000,
      collectedAt: new Date("2026-10-10T12:00:00-03:00"),
    },
  });
  const q = "/environmental-impact?year=2026";
  let result = (await call("owner", "GET", q)).data,
    oct = result.monthly[9],
    sep = result.monthly[8];
  assert.equal(result.monthly.length, 12);
  assert.equal(result.totalMassKg, 82);
  assert.equal(oct.totalMassKg, 62);
  assert.equal(sep.totalMassKg, 20);
  assert.equal(oct.collections, 4);
  assert.equal(oct.requests, 1);
  assert.equal(oct.pendingRequests, 1);
  assert.equal(oct.extraOrders, 1);
  assert.equal(oct.pendingExtraOrders, 1);
  assert.equal(oct.co2Kg, null);
  assert.equal(oct.waterLiters, null);
  assert.equal(oct.legacyDateCollections, 1);
  assert.ok(
    result.generators.some(
      (g: any) => g.name === "PEVs" && g.totalMassKg === 10,
    ),
  );
  assert.ok(
    result.generators.some(
      (g: any) =>
        g.name === "Pessoa física / coletas avulsas" && g.totalMassKg === 5,
    ),
  );
  ok(
    "Painel mensal inclui geradores, PEVs, PF e equipe uma única vez; exclui canceladas e peso previsto",
  );
  assert.equal((await call("gen", "GET", q)).data.totalMassKg, 67);
  const participant = (await call("b", "GET", q)).data;
  assert.equal(participant.monthly[9].totalMassKg, 40);
  assert.equal(participant.monthly[9].extraOrders, 1);
  assert.equal(
    (await call("b", "GET", `/collections/${shared.id}`)).collection
      .creditedWeightKg,
    0,
  );
  ok(
    "Catador mantém impacto das coletas em equipe mesmo antes do rateio; gerador vê somente seu histórico",
  );
  await call("driver", "GET", q, undefined, 403);
  await call("gen2", "GET", q + "&generatorId=" + generator.id, undefined, 403);
  await call(
    "foreign",
    "GET",
    q + "&generatorId=" + generator.id,
    undefined,
    404,
  );
  await call("b", "GET", q + "&generatorId=" + generator.id, undefined, 403);
  assert.equal((await call("gen2", "GET", q)).data.totalMassKg, 0);
  assert.equal((await call("outsider", "GET", q)).data.totalMassKg, 8000);
  ok("Filtros mensais permanecem isolados por vínculo e perfil");
  const config = {
    version: 0,
    goals: { monthlyCollections: null, monthlyMassKg: null },
    methodology: {
      label: "Metodologia mensal de ensaio",
      source: "Fatores sintéticos apenas para teste local",
      url: "",
      version: "teste-1",
      factors: [
        {
          materialId: material.id,
          co2PerKg: 2,
          waterPerKg: 10,
          energyPerKg: 0.5,
          treesPerKg: 0.01,
        },
      ],
    },
  };
  await call("owner", "PUT", "/reports/config", config);
  result = (await call("owner", "GET", q)).data;
  oct = result.monthly[9];
  assert.equal(oct.co2Kg, 110);
  assert.equal(oct.waterLiters, 550);
  assert.equal(oct.energyKwh, 27.5);
  assert.equal(oct.treesEquivalent, 0.55);
  assert.equal(oct.metricCoverage.co2Kg, 55);
  assert.equal(result.co2Kg, 150);
  assert.equal((await call("gen", "GET", q)).data.monthly[9].co2Kg, 80);
  assert.equal((await call("b", "GET", q)).data.monthly[9].co2Kg, 80);
  ok(
    "Os quatro indicadores usam os mesmos fatores no painel, gerador e catador com cobertura explícita",
  );
  await call("owner", "POST", `/collections/${shared.id}/review-quantities`, {
    expectedVersion: 0,
    reason: "Balança confirmou trinta kg",
    items: [{ materialId: shared.collectionMaterials[0].id, quantity: 30 }],
  });
  result = (await call("owner", "GET", q)).data;
  assert.equal(result.monthly[9].totalMassKg, 52);
  assert.equal(result.monthly[9].co2Kg, 90);
  assert.equal(result.monthly[8].totalMassKg, 20);
  assert.equal((await call("b", "GET", q)).data.monthly[9].totalMassKg, 30);
  assert.equal(
    await p.collectionWasteEntry.count({ where: { collectionId: shared.id } }),
    1,
  );
  ok(
    "Conferência recalcula o mês original, preservando entrada única e produção separada",
  );
  await call("owner", "GET", "/environmental-impact?year=1999", undefined, 400);
  await call(
    "owner",
    "GET",
    "/environmental-impact?year=2026&start=2026-10-01&end=2026-10-31",
    undefined,
    400,
  );
  assert.equal(
    (await call("gen", "GET", "/environmental-impact?year=2025")).data
      .totalMassKg,
    0,
  );
  ok("Histórico permite anos anteriores e rejeita períodos inválidos");
  const allQuery = "/environmental-impact";
  const legacy = await p.collection.create({
    data: {
      cooperativeId: coop.id,
      status: "COMPLETED",
      collectedAt: new Date("2025-04-01T12:00:00-03:00"),
      materials: [{ name: "Papelão antigo", quantityKg: 9 }],
    },
  });
  let total = (await call("owner", "GET", allQuery)).data;
  assert.equal(total.totalMassKg, 81);
  assert.equal(total.collections, 6);
  assert.equal(total.co2Kg, 121.5);
  assert.equal(total.waterLiters, 2835);
  assert.equal(total.energyKwh, 186.29999999999998);
  assert.equal(total.treesEquivalent, 0.81);
  assert.equal(total.monthly, undefined);
  assert.equal(total.year, undefined);
  assert.equal(total.requests, 2);
  assert.equal(total.pendingRequests, 2);
  assert.ok(legacy.id);
  ok(
    "Resumo automático acumula todos os anos, com referência anterior do App e sem histórico mensal exposto",
  );
  await p.reportConfiguration.delete({ where: { cooperativeId: coop.id } });
  total = (await call("owner", "GET", allQuery)).data;
  assert.equal(total.co2Kg, 121.5);
  assert.equal(total.waterLiters, 2835);
  assert.equal(total.reference.version, "katua-reference-v1");
  assert.equal((await call("gen", "GET", allQuery)).data.totalMassKg, 57);
  assert.equal((await call("b", "GET", allQuery)).data.totalMassKg, 30);
  assert.equal((await call("b", "GET", allQuery)).data.co2Kg, 45);
  assert.equal(
    (await call("b", "GET", `/collections/${shared.id}`)).collection
      .creditedWeightKg,
    0,
  );
  ok(
    "Sem configuração, gerador e catador recebem estimativas numéricas; produção individual não é alterada",
  );
  const pendingCollection = await p.collection.findUniqueOrThrow({
    where: { scheduleId: schedule.id },
  });
  for (const [name, refs] of [
    ["linked-source", { sourceScheduleId: schedule.id }],
    ["linked-collection", { collectionId: pendingCollection.id }],
  ] as const)
    await p.extraCollectionOrder.create({
      data: {
        id: name,
        cooperativeId: coop.id,
        collectorId: ids[0],
        status: "ACCEPTED",
        originalHash: "fixture",
        payload: { generatorId: generator.id },
        reporterUserId: users.a.id,
        reporterName: "A",
        custody: "COOPERATIVE",
        custodyNotes: "Teste local",
        ...refs,
      },
    });
  total = (await call("owner", "GET", allQuery)).data;
  assert.equal(total.requests, 2);
  assert.equal(total.totalMassKg, 81);
  ok(
    "Solicitações são deduplicadas quando uma O.C. tem agendamento de origem ou coleta vinculada",
  );
  await call("driver", "GET", allQuery, undefined, 403);
  await call(
    "gen2",
    "GET",
    allQuery + "?generatorId=" + generator.id,
    undefined,
    403,
  );
  await call(
    "b",
    "GET",
    allQuery + "?generatorId=" + generator.id,
    undefined,
    403,
  );
  await call(
    "foreign",
    "GET",
    allQuery + "?generatorId=" + generator.id,
    undefined,
    404,
  );
  assert.equal(
    (await call("owner", "GET", allQuery + "?generatorId=" + generator.id)).data
      .totalMassKg,
    57,
  );
  assert.equal((await call("gen2", "GET", allQuery)).data.totalMassKg, 0);
  ok("Resumo acumulado e filtro por gerador respeitam vínculos e papéis");
  await p.collection.createMany({
    data: Array.from({ length: 501 }, () => ({
      cooperativeId: other.id,
      status: "COMPLETED" as const,
      totalWeightKg: 1,
      completedAt: new Date("2024-01-01T10:00:00-03:00"),
    })),
  });
  assert.equal((await call("foreign", "GET", allQuery)).data.totalMassKg, 8501);
  assert.equal((await call("owner", "GET", allQuery)).data.totalMassKg, 81);
  ok(
    "Leitura paginada inclui mais de quinhentas coletas sem truncar o acumulado ou misturar cooperativas",
  );
  writeFileSync(
    process.env.KATUA_TEAM_TEST_RESULT || "/tmp/monthly-impact-api.json",
    JSON.stringify({ passed: checks.length, checks }, null, 2),
  );
  if (process.env.KATUA_TEAM_UI_FIXTURE) {
    writeFileSync(
      process.env.KATUA_TEAM_UI_FIXTURE,
      JSON.stringify({
        users,
        tokens: Object.fromEntries(
          Object.entries(users).map(([k, u]: any) => [
            k,
            app.jwt.sign({ sub: u.id, role: u.role }),
          ]),
        ),
        coop,
        generator,
        sharedId: shared.id,
      }),
    );
    await app.listen({ host: "127.0.0.1", port: 3339 });
    console.log("TEAMS_UI_READY");
    return;
  }
  await app.close();
  await p.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
