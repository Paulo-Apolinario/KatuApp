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
  const ids = ["a", "b", "c"].map((n) => people[n].id),
    body = { name: "Equipe Aurora", active: true, memberIds: ids };
  const team = (await call("owner", "POST", "/collector-teams", body)).team;
  assert.equal(
    (await call("foreign", "GET", "/collector-teams")).teams.length,
    0,
  );
  await call(
    "owner",
    "POST",
    "/collector-teams",
    { ...body, memberIds: [ids[0], people.outsider.id] },
    400,
  );
  await call("a", "GET", "/collector-teams", undefined, 403);
  await call("driver", "POST", "/collector-teams", body, 403);
  await call(
    "owner",
    "POST",
    "/collector-teams",
    { ...body, memberIds: [ids[0]] },
    400,
  );
  await call(
    "foreign",
    "PATCH",
    `/collector-teams/${team.id}`,
    { ...body, expectedVersion: 0 },
    404,
  );
  ok(
    "Cadastro de equipe exige 2 a 30 catadores ativos e isola as cooperativas",
  );
  const point = {
    key: "endereco01",
    kind: "GENERATOR",
    sourceId: generator.id,
    name: "Gerador Teste",
    email: users.gen.email,
    address: "Rua Teste, 30, Fortaleza",
    latitude: -3.73,
    longitude: -38.52,
  };
  const route = (
    await call(
      "owner",
      "POST",
      "/routes",
      {
        name: "Rota Equipe",
        teamId: team.id,
        collectorIds: ids,
        plannedPoints: [point],
      },
      201,
    )
  ).route;
  assert.ok(route?.id);
  assert.equal(route.collections.length, 1);
  const collection = route.collections[0];
  assert.equal(
    (await call("b", "GET", `/collections/${collection.id}`)).collection
      .participants.length,
    3,
  );
  assert.equal(
    (await call("c", "GET", "/collections")).collections.filter(
      (c: any) => c.id === collection.id,
    ).length,
    1,
  );
  await call(
    "outsider",
    "GET",
    `/collections/${collection.id}`,
    undefined,
    404,
  );
  assert.equal(await p.collection.count({ where: { routeId: route.id } }), 1);
  ok(
    "Rota da equipe cria uma coleta única com três participantes e acesso compartilhado",
  );
  await call("b", "POST", `/collections/${collection.id}/start`, {});
  assert.equal(
    await p.collector.count({ where: { id: { in: ids }, status: "ON_ROUTE" } }),
    3,
  );
  await call("a", "POST", `/collections/${collection.id}/complete-field`, {
    materials: [
      {
        proposedMaterial: { name: "Papelão equipe", unit: "KG" },
        unit: "KG",
        quantity: 50,
      },
    ],
  });
  let c = (await call("owner", "GET", `/collections/${collection.id}`))
    .collection;
  const materialId = c.collectionMaterials[0].id;
  assert.equal(c.totalWeightKg, 50);
  assert.equal(
    await p.collectionWasteEntry.count({ where: { collectionId: c.id } }),
    1,
  );
  assert.equal(
    await p.wasteStockLot.count({ where: { originCollectionId: c.id } }),
    0,
  );
  assert.equal(
    (await call("b", "GET", `/collections/${c.id}`)).collection
      .creditedWeightKg,
    0,
  );
  assert.equal(
    (await p.collector.findUniqueOrThrow({ where: { id: ids[0] } })).totalKg,
    0,
  );
  ok(
    "Etapa de campo não multiplica material nem credita o peso completo a cada catador",
  );
  await call("owner", "POST", `/collections/${c.id}/receive`, {});
  await call('owner','POST',`/collections/${c.id}/start-sorting`,{});
  const blocked = await call('owner','POST',`/collections/${c.id}/complete`,{},409);
  assert.equal(blocked.code, 'ALLOCATION_REQUIRED');
  const alloc = {
    expectedVersion: 0,
    quantityVersion: 0,
    reason: "Rateio igual após pesagem",
    items: ids.map((collectorId) => ({
      collectorId,
      materialId,
      quantity: 50 / 3,
    })),
  };
  await call(
    "owner",
    "POST",
    `/collections/${c.id}/allocate-materials`,
    alloc,
    400,
  );
  await call(
    "owner",
    "POST",
    `/collections/${c.id}/allocate-materials`,
    {
      ...alloc,
      items: ids.map((collectorId) => ({
        collectorId,
        materialId,
        quantity: 10,
      })),
    },
    409,
  );
  await call("owner", "POST", `/collections/${c.id}/review-quantities`, {
    expectedVersion: 0,
    reason: "Pesagem confirmou quarenta kg",
    items: [{ materialId, quantity: 40 }],
  });
  c = (await call("owner", "GET", `/collections/${c.id}`)).collection;
  assert.equal(c.totalWeightKg, 40);
  assert.equal(Number(c.collectionMaterials[0].reportedQuantity), 50);
  const exact = {
    ...alloc,
    quantityVersion: 1,
    items: ids.map((collectorId, i) => ({
      collectorId,
      materialId,
      quantity: [13.334, 13.333, 13.333][i],
    })),
  };
  await call(
    "foreign",
    "POST",
    `/collections/${c.id}/allocate-materials`,
    exact,
    404,
  );
  await call(
    "b",
    "POST",
    `/collections/${c.id}/allocate-materials`,
    exact,
    403,
  );
  await call(
    "owner",
    "POST",
    `/collections/${c.id}/allocate-materials`,
    { ...exact, items: exact.items.map((i) => ({ ...i, quantity: 14 })) },
    400,
  );
  await call(
    "owner",
    "POST",
    `/collections/${c.id}/allocate-materials`,
    { ...exact, items: [...exact.items.slice(0, 2), exact.items[0]] },
    400,
  );
  c = (
    await call(
      "owner",
      "POST",
      `/collections/${c.id}/allocate-materials`,
      exact,
    )
  ).collection;
  assert.equal(c.allocationVersion, 1);
  assert.equal(c.allocationReviews.length, 1);
  assert.equal(c.totalWeightKg, 40);
  assert.equal(
    await p.collectionWasteEntry.count({ where: { collectionId: c.id } }),
    1,
  );
  const sum = (
    await p.collector.findMany({ where: { id: { in: ids } } })
  ).reduce((s, p) => s + p.totalKg, 0);
  assert.equal(Math.round(sum * 1000), 40000);
  for (const [index, who] of ["a", "b", "c"].entries()) {
    assert.equal(
      (await call(who, "GET", `/collections/${c.id}`)).collection
        .creditedWeightKg,
      exact.items[index].quantity,
    );
    assert.ok(
      (await call(who, "GET", "/notifications")).notifications.some(
        (n: any) => n.kind === "MATERIAL_ALLOCATION",
      ),
    );
  }
  ok(
    "Pesagem 50→40 preserva original; divisão exata com três casas atualiza parcelas e notifica todos",
  );
  await call(
    "owner",
    "POST",
    `/collections/${c.id}/allocate-materials`,
    exact,
    409,
  );
  await call("owner", "POST", `/collections/${c.id}/review-quantities`, {
    expectedVersion: 1,
    reason: "Nova aferição da balança",
    items: [{ materialId, quantity: 39 }],
  });
  assert.equal(
    (await call("b", "GET", `/collections/${c.id}`)).collection
      .creditedWeightKg,
    0,
  );
  assert.equal(
    (await p.collector.findUniqueOrThrow({ where: { id: ids[0] } })).totalKg,
    0,
  );
  await call(
    "owner",
    "POST",
    `/collections/${c.id}/allocate-materials`,
    { ...exact, expectedVersion: 1 },
    409,
  );
  const next = {
    ...exact,
    expectedVersion: 1,
    quantityVersion: 2,
    items: exact.items.map((i) => ({ ...i, quantity: 13 })),
  };
  c = (
    await call("owner", "POST", `/collections/${c.id}/allocate-materials`, next)
  ).collection;
  assert.equal(c.allocationReviews.length, 2);
  assert.equal(
    (await call("c", "GET", `/collections/${c.id}`)).collection
      .creditedWeightKg,
    13,
  );
  ok(
    "Alterar pesagem invalida parcelas; versões antigas são recusadas e histórico é preservado",
  );
  await call("owner", "PATCH", `/collector-teams/${team.id}`, {
    ...body,
    memberIds: ids.slice(0, 2),
    expectedVersion: 0,
  });
  assert.equal(
    (await call("c", "GET", `/collections/${c.id}`)).collection.participants
      .length,
    3,
  );
  await call(
    "owner",
    "PATCH",
    `/collector-teams/${team.id}`,
    { ...body, expectedVersion: 0 },
    409,
  );
  ok(
    "Editar cadastro de equipe não altera participantes nem créditos de uma coleta já registrada",
  );
  // O encerramento operacional continua validado pelo módulo original de destinações.
  // Este cenário de impacto usa uma coleta consolidada isolada, sem fingir reciclagem.
  const material = await p.wasteStockItem.create({
    data: {
      cooperativeId: coop.id,
      name: "Papelão catálogo",
      category: "Papel",
      unit: "KG",
    },
  });
  const completed = await p.collection.create({
    data: {
      cooperativeId: coop.id,
      generatorId: generator.id,
      collectorId: ids[0],
      status: "COMPLETED",
      completedAt: new Date("2026-10-27T10:00:00-03:00"),
      totalWeightKg: 40,
      collectionMaterials: {
        create: {
          wasteTypeId: material.id,
          nameSnapshot: "Papelão",
          quantity: 40,
          unit: "KG",
        },
      },
    },
  });
  const query = "/environmental-impact?start=2026-10-01&end=2026-10-31";
  let impact = (await call("gen", "GET", query)).data;
  assert.equal(impact.totalMassKg, 40);
  assert.equal(impact.co2Kg, null);
  await p.reportConfiguration.create({
    data: {
      cooperativeId: coop.id,
      updatedBy: users.owner.id,
      payload: {
        goals: { monthlyCollections: null, monthlyMassKg: null },
        methodology: {
          label: "Metodologia de ensaio",
          source: "Fixture sintética: não usar em produção",
          version: "teste",
          factors: [{ materialId: material.id, co2PerKg: 2 }],
        },
      },
    },
  });
  impact = (await call("gen", "GET", query)).data;
  assert.equal(impact.co2Kg, 80);
  assert.equal(impact.coveragePercent, 100);
  assert.equal(impact.generators.length, 1);
  assert.equal((await call("gen2", "GET", query)).data.totalMassKg, 0);
  await call(
    "gen2",
    "GET",
    query + "&generatorId=" + generator.id,
    undefined,
    403,
  );
  await call(
    "foreign",
    "GET",
    query + "&generatorId=" + generator.id,
    undefined,
    404,
  );
  await call("a", "GET", query, undefined, 403);
  await call(
    "owner",
    "GET",
    "/environmental-impact?start=2026-10-31&end=2026-10-01",
    undefined,
    400,
  );
  assert.equal((await call("owner", "GET", query)).data.co2Kg, 80);
  assert.equal(completed.totalWeightKg, 40);
  ok(
    "Impacto usa apenas geradores e coletas concluídas do vínculo; fatores ausentes não viram zero ou reciclagem comprovada",
  );
  const avulsa = await p.collection.create({
    data: { cooperativeId: coop.id, collectorId: ids[0] },
  });
  let standalone = (
    await call("owner", "POST", `/collections/${avulsa.id}/team`, {
      teamId: team.id,
      expectedVersion: 0,
    })
  ).collection;
  assert.equal(standalone.participants.length, 2);
  await call("c", "GET", `/collections/${avulsa.id}`, undefined, 404);
  standalone = (
    await call("owner", "POST", `/collections/${avulsa.id}/team`, {
      teamId: null,
      expectedVersion: 1,
    })
  ).collection;
  assert.equal(standalone.participants.length, 0);
  ok(
    "Coleta avulsa aceita e remove equipe antes da saída, com controle de versão",
  );
  const plan = (
    await call("owner", "POST", "/route-plans", {
      name: "Equipe fixa",
      active: true,
      startsOn: "2026-10-27",
      weekdays: [2],
      intervalWeeks: 1,
      departureTime: "08:00",
      estimatedMinutes: 60,
      teamId: team.id,
      collectorIds: ids.slice(0, 2),
      points: [point],
      startPoint: point,
      endPoint: point,
    })
  ).plan;
  const generated = await p.route.findMany({
    where: { planId: plan.id },
    include: { collections: { include: { participants: true } } },
  });
  assert.ok(generated.length > 0);
  assert.ok(
    generated.every(
      (r) =>
        r.teamId === team.id &&
        r.collections.every((c) => c.participants.length === 2),
    ),
  );
  ok(
    "Rota fixa gera execuções com equipe e participantes registrados em cada coleta",
  );
  const report = (
    await call(
      "owner",
      "GET",
      "/reports/staff?start=2026-10-01&end=2026-10-31&role=COLLECTOR",
    )
  ).data;
  assert.ok(report);
  assert.equal(report.rows.find((r: any) => r.rawId === ids[1]).massKg, 13);
  assert.equal(report.rows.find((r: any) => r.rawId === ids[2]).massKg, 13);
  ok("Relatório de catadores incorpora parcelas sem multiplicar a produção");
  const bin = await p.bin.create({
    data: {
      cooperativeId: coop.id,
      binId: "teams-public",
      name: "Ponto público equipe",
      pointKind: "PEV",
      latitude: -3.73,
      longitude: -38.52,
      publicAccess: true,
    },
  });
  assert.ok(
    (await call("owner", "GET", "/pev-points")).bins.some(
      (b: any) => b.id === bin.id,
    ),
  );
  assert.ok(
    !(await call("foreign", "GET", "/pev-points")).bins.some(
      (b: any) => b.id === bin.id,
    ),
  );
  assert.ok(
    !(await call("outsider", "GET", "/pev-points")).bins.some(
      (b: any) => b.id === bin.id,
    ),
  );
  ok(
    "Publicação da PEV não concede acesso operacional a cooperativas e catadores alheios",
  );
  writeFileSync(
    process.env.KATUA_TEAM_TEST_RESULT || "/tmp/katua-team-results.json",
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
        team,
        people,
        collectionId: c.id,
        generator,
        completedId: completed.id,
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
