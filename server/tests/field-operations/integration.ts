import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  if (
    process.env.KATUA_LOCAL_VALIDATION !== "1" ||
    url.hostname !== "127.0.0.1" ||
    url.port !== "54329"
  )
    throw Error("Banco local descartável obrigatório");
  process.env.NODE_ENV = "test";
  process.env.LOG_LEVEL = "silent";
  process.env.JWT_SECRET = randomBytes(48).toString("hex");
  const { prisma: p } = await import("../../src/lib/prisma");
  const { buildApp } = await import("../../src/app");
  const app = await buildApp();
  await app.ready();
  const checks: string[] = [];
  const pass = (name: string) => {
    checks.push(name);
    console.log("PASS " + name);
  };
  const preserved = await p.route.findUniqueOrThrow({
    where: { id: "route-before-field-migration" },
  });
  assert.equal(preserved.status, "IN_PROGRESS");
  assert.equal(preserved.startedAt, null);
  assert.equal(
    await p.collection.count({ where: { routeId: preserved.id } }),
    1,
  );
  pass(
    "Migração preserva execução histórica e seu ponto sem inventar data de saída",
  );
  const users: any = {};
  for (const [key, role] of [
    ["owner", "COOPERATIVE"],
    ["foreign", "COOPERATIVE"],
    ["cat", "COLLECTOR"],
    ["member", "COLLECTOR"],
    ["driver", "DRIVER"],
  ])
    users[key] = await p.user.create({
      data: {
        email: `${key}@field.test.invalid`,
        displayName: key!,
        role: role as any,
        passwordHash: "unused-local",
      },
    });
  const coop = await p.cooperative.create({
      data: { userId: users.owner.id, name: "Cooperativa de operações QA" },
    }),
    other = await p.cooperative.create({
      data: { userId: users.foreign.id, name: "Outra cooperativa QA" },
    });
  const cat = await p.collector.create({
      data: {
        cooperativeId: coop.id,
        userId: users.cat.id,
        email: users.cat.email,
        name: "Catadora QA",
      },
    }),
    member = await p.collector.create({
      data: {
        cooperativeId: coop.id,
        userId: users.member.id,
        email: users.member.email,
        name: "Integrante QA",
      },
    });
  const driver = await p.driver.create({
      data: {
        cooperativeId: coop.id,
        userId: users.driver.id,
        email: users.driver.email,
        name: "Motorista QA",
      },
    }),
    vehicle = await p.vehicle.create({
      data: {
        cooperativeId: coop.id,
        driverId: driver.id,
        plate: "QAG2026",
        model: "QA",
      },
    });
  const bin = await p.bin.create({
    data: {
      cooperativeId: coop.id,
      binId: "PEV-GRUPO",
      name: "PEV Grupo QA",
      street: "Rua QA",
      number: "10",
      city: "Fortaleza",
    },
  });
  const generators = await Promise.all(
    ["Gerador A QA", "Gerador B QA"].map((name, i) =>
      p.generator.create({
        data: {
          cooperativeId: coop.id,
          type: "SMALL",
          name,
          email: `g${i}@field.test.invalid`,
          city: "Fortaleza",
        },
      }),
    ),
  );
  const plan = await p.routePlan.create({
    data: {
      cooperativeId: coop.id,
      name: "Fixa diária QA",
      active: false,
      startsOn: "2026-10-28",
      weekdays: [1, 2, 3, 4, 5],
      departureTime: "08:00",
      points: [],
      startPoint: {},
      endPoint: {},
    },
  });
  const resources = {
    driverId: driver.id,
    vehicleId: vehicle.id,
    collectorIds: [cat.id, member.id],
  };
  const r1 = await p.route.create({
    data: {
      cooperativeId: coop.id,
      planId: plan.id,
      executionDate: "2026-10-28",
      name: "Fixa diária QA",
      scheduledDate: new Date("2026-10-28T11:00:00Z"),
      ...resources,
    },
  });
  const r2 = await p.route.create({
    data: {
      cooperativeId: coop.id,
      planId: plan.id,
      executionDate: "2026-10-29",
      name: "Fixa diária QA",
      scheduledDate: new Date("2026-10-29T11:00:00Z"),
      ...resources,
    },
  });
  const historical = await p.route.create({
    data: {
      cooperativeId: coop.id,
      executionDate: "2026-10-26",
      name: "Fixa histórica QA",
      status: "COMPLETED",
      scheduledDate: new Date("2026-10-26T11:00:00Z"),
    },
  });
  const casual = await p.route.create({
    data: {
      cooperativeId: coop.id,
      name: "Rota avulsa QA",
      scheduledDate: new Date(),
      ...resources,
    },
  });
  const foreignRoute = await p.route.create({
    data: {
      cooperativeId: other.id,
      executionDate: "2026-10-28",
      name: "Execução alheia QA",
      scheduledDate: new Date(),
    },
  });
  const pointData = {
    cooperativeId: coop.id,
    collectorId: cat.id,
    driverId: driver.id,
    vehicleId: vehicle.id,
  };
  const a = await p.collection.create({
      data: { ...pointData, routeId: r1.id, generatorId: generators[0].id },
    }),
    b = await p.collection.create({
      data: {
        ...pointData,
        routeId: r1.id,
        routePoint: {
          key: "address-qa",
          kind: "ADDRESS",
          name: "Endereço avulso QA",
          address: "Rua da Coleta, 10, Fortaleza",
          latitude: -3.73,
          longitude: -38.52,
        },
      },
    }),
    c = await p.collection.create({
      data: { ...pointData, routeId: r1.id, binId: bin.id },
    });
  await p.route.update({
    where: { id: r1.id },
    data: { collectionOrder: [c.id, a.id, b.id] },
  });
  await p.collection.create({
    data: { ...pointData, routeId: r2.id, generatorId: generators[0].id },
  });
  await p.collection.create({
    data: {
      ...pointData,
      routeId: historical.id,
      status: "COLLECTED",
      collectedAt: new Date(),
    },
  });
  const normal = await p.collection.create({
      data: { ...pointData, generatorId: generators[0].id },
    }),
    casualPoint = await p.collection.create({
      data: { ...pointData, routeId: casual.id, generatorId: generators[0].id },
    });
  await p.collection.create({
    data: { cooperativeId: other.id, routeId: foreignRoute.id },
  });
  async function call(
    method: any,
    url: string,
    payload?: any,
    who = "owner",
    expected = 200,
  ) {
    const u = users[who];
    const res = await app.inject({
      method,
      url,
      headers: {
        authorization: "Bearer " + app.jwt.sign({ sub: u.id, role: u.role }),
      },
      ...(payload === undefined ? {} : { payload }),
    });
    assert.equal(res.statusCode, expected, res.body);
    return res.json();
  }
  const overview = async () =>
    (await call("GET", "/dashboard/operations")).data;
  assert.equal((await overview()).inProgress, 0);
  pass("Antes da saída não existe operação em campo");
  await call(
    "POST",
    `/routes/${r1.id}/field-status`,
    { status: "IN_PROGRESS" },
    "cat",
  );
  const started = await p.route.findUniqueOrThrow({ where: { id: r1.id } });
  assert(started.startedAt);
  assert.equal(
    await p.collection.count({
      where: { routeId: r1.id, status: "PENDING", startedAt: null },
    }),
    3,
  );
  pass(
    "Saída registra início da execução e preserva pontos aguardando atendimento",
  );
  let op = await overview();
  assert.equal(op.inProgress, 1);
  assert.equal(op.fieldSources.fixedRoutes, 1);
  assert.equal(op.scheduled, 3);
  assert.equal(op.field[0].kind, "ROUTE");
  assert.match(op.field[0].href, /tipo=fixed/);
  pass(
    "Painel conta uma rota fixa em campo sem contar suas três paradas novamente",
  );
  const dashboard = (
    await call("GET", "/dashboard/overview?start=2026-10-28&end=2026-10-28")
  ).data;
  assert.match(
    dashboard.recent.find((row: any) => row.id === c.id).operationLabel,
    /Em campo/,
  );
  pass(
    "Agenda e registros do painel identificam saída em campo sem confundir com atendimento do ponto",
  );
  await call(
    "POST",
    `/routes/${r1.id}/field-status`,
    { status: "IN_PROGRESS" },
    "cat",
  );
  assert.equal(
    (
      await p.route.findUniqueOrThrow({ where: { id: r1.id } })
    ).startedAt?.toISOString(),
    started.startedAt?.toISOString(),
  );
  pass("Repetir confirmação não modifica a primeira saída");
  const group = await call("GET", "/waste-workspace/field-routes?limit=1");
  assert.equal(group.pagination.total, 3);
  assert.equal(group.routes[0].id, historical.id);
  assert.equal(group.routes[0].points, 1);
  assert.equal(group.routes[0].pointStatuses.COLLECTED, 1);
  assert.equal(group.routes[0].collections, undefined);
  assert.equal(group.stats.totalPoints, 5);
  pass("Execuções são paginadas inteiras por data crescente, sem transferir todos os detalhes");
  const page2 = await call("GET", "/waste-workspace/field-routes?limit=1&page=2");
  assert.equal(page2.routes[0].id, r1.id);
  assert.equal(page2.routes[0].points, 3);
  assert.equal(page2.routes[0].pointStatuses.PENDING, 3);
  const page3 = await call("GET", "/waste-workspace/field-routes?limit=1&page=3");
  assert.equal(page3.routes[0].id, r2.id);
  pass("Datas de execução permanecem em tópicos separados e em ordem entre páginas");
  const one = await call(
      "GET",
      `/waste-workspace/field-routes/${r1.id}/collections?limit=1`,
    ),
    two = await call(
      "GET",
      `/waste-workspace/field-routes/${r1.id}/collections?limit=1&page=2`,
    );
  assert.equal(one.collections[0].id, c.id);
  assert.equal(two.collections[0].id, a.id);
  assert.equal(one.pagination.total, 3);
  assert.equal(one.collections[0].route.status, "IN_PROGRESS");
  pass(
    "Pontos seguem a sequência da rota com paginação própria e contexto em campo",
  );
  const normalRows = await call(
    "GET",
    "/waste-workspace/field-collections?kind=normal",
  );
  assert.deepEqual(
    new Set(normalRows.collections.map((x: any) => x.id)),
    new Set([normal.id, casualPoint.id]),
  );
  pass(
    "Coletas normais excluem pontos de rotas fixas, inclusive plano histórico removido",
  );
  const search = await call(
    "GET",
    "/waste-workspace/field-routes?q=PEV%20Grupo%20QA",
  );
  assert.equal(search.pagination.total, 1);
  assert.equal(search.routes[0].points, 3);
  pass("Busca por um ponto encontra sua execução completa");
  const address = await call(
    "GET",
    "/waste-workspace/field-routes?q=rua%20da%20coleta",
  );
  assert.equal(address.pagination.total, 1);
  const addressPoints = await call(
    "GET",
    `/waste-workspace/field-routes/${r1.id}/collections`,
  );
  assert.equal(
    addressPoints.collections.find((point: any) => point.id === b.id).routePoint
      .name,
    "Endereço avulso QA",
  );
  pass(
    "Endereço avulso sem cadastro de gerador conserva identificação e pode ser pesquisado",
  );
  const date = await call(
    "GET",
    "/waste-workspace/field-routes?start=2026-10-28&end=2026-10-28",
  );
  assert.equal(date.pagination.total, 1);
  assert.equal(date.routes[0].id, r1.id);
  pass("Filtro de programação distingue os dias de execução no fuso do Ceará");
  await call(
    "POST",
    `/collections/${a.id}/start`,
    { operationId: randomUUID() },
    "cat",
  );
  assert.equal((await overview()).inProgress, 1);
  pass("Iniciar ponto dentro da rota não duplica a operação em campo");
  await call(
    "POST",
    `/collections/${normal.id}/start`,
    { operationId: randomUUID() },
    "cat",
  );
  assert.equal((await overview()).inProgress, 2);
  pass("Coleta delegada individual iniciada entra no mesmo indicador");
  await call(
    "POST",
    `/routes/${casual.id}/field-status`,
    { status: "IN_PROGRESS" },
    "cat",
  );
  op = await overview();
  assert.equal(op.inProgress, 3);
  assert.deepEqual(op.fieldSources, {
    routes: 2,
    fixedRoutes: 1,
    otherRoutes: 1,
    collections: 1,
  });
  pass(
    "Rotas avulsas e fixas e coleta individual são contadas sem sobreposição",
  );
  const inField = await call(
    "GET",
    "/waste-workspace/field-collections?kind=normal&inField=true",
  );
  assert.equal(inField.pagination.total, 2);
  const waiting = await call(
    "GET",
    "/waste-workspace/field-collections?status=PENDING",
  );
  assert.equal(waiting.pagination.total, 1);
  pass("Pontos com saída confirmada não ficam na fila de pendentes sem saída");
  const item = await p.wasteStockItem.create({
    data: {
      cooperativeId: coop.id,
      name: "Papelão QA",
      category: "Papel",
      unit: "KG",
    },
  });
  await call(
    "POST",
    `/collections/${a.id}/complete-field`,
    {
      operationId: randomUUID(),
      materials: [{ wasteTypeId: item.id, quantity: 10, unit: "KG" }],
      totalWeightKg: 10,
    },
    "cat",
  );
  await call("POST", `/collections/${a.id}/receive`, {});
  assert.equal(
    (await p.collection.findUniqueOrThrow({ where: { id: a.id } })).status,
    "RECEIVED",
  );
  assert.equal(
    await p.collection.count({
      where: { id: { in: [b.id, c.id] }, status: "PENDING" },
    }),
    2,
  );
  assert.equal(
    await p.collectionWasteEntry.count({ where: { collectionId: a.id } }),
    1,
  );
  pass(
    "Recebimento de um ponto preserva os demais e sua entrada de material individual",
  );
  await p.collectionParticipant.create({
    data: {
      collectionId: b.id,
      collectorId: member.id,
      nameSnapshot: member.name,
    },
  });
  const team = await call(
    "GET",
    `/waste-workspace/field-routes?collector=${member.id}`,
  );
  assert.equal(team.pagination.total, 1);
  assert.equal(team.routes[0].id, r1.id);
  pass("Filtro por colaborador reconhece sua participação em equipe");
  await call(
    "GET",
    `/waste-workspace/field-routes/${r1.id}/collections`,
    undefined,
    "foreign",
    404,
  );
  assert.equal(
    (await call("GET", "/waste-workspace/field-routes", undefined, "foreign"))
      .pagination.total,
    1,
  );
  await call("GET", "/waste-workspace/field-routes", undefined, "cat", 403);
  pass(
    "Detalhes e consultas respeitam cooperativa proprietária e perfil autorizado",
  );
  await call(
    "GET",
    "/waste-workspace/field-routes?limit=51",
    undefined,
    "owner",
    400,
  );
  await call(
    "GET",
    "/waste-workspace/field-collections?status=INVALID",
    undefined,
    "owner",
    400,
  );
  await call(
    "GET",
    "/waste-workspace/field-routes?start=2026-02-30",
    undefined,
    "owner",
    400,
  );
  pass("Paginação, etapa e período inválidos são rejeitados");
  const orderIds: string[] = [];
  for (const [suffix, date, status] of [
    ["nov", "2026-11-02T11:00:00Z", "SCHEDULED"],
    ["oct30", "2026-10-30T11:00:00Z", "IN_PROGRESS"],
    ["oct27", "2026-10-27T11:00:00Z", "SCHEDULED"],
    ["tie-b", "2026-10-28T11:00:00Z", "SCHEDULED"],
    ["tie-a", "2026-10-28T11:00:00Z", "IN_PROGRESS"],
    ["undated", null, "SCHEDULED"],
  ]) {
    const r = await p.route.create({ data: { id: `date-order-${suffix}`, cooperativeId: coop.id, name: "Ordenação cronológica QA", executionDate: suffix!, scheduledDate: date ? new Date(date) : null, status: status as any, stops: [] } });
    orderIds.push(r.id);
    await p.collection.create({ data: { cooperativeId: coop.id, routeId: r.id } });
  }
  const actual: string[] = [];
  for(let page=1;page<=3;page++) {
    const res = await call("GET", `/waste-workspace/field-routes?q=${encodeURIComponent("Ordenação cronológica QA")}&limit=2&page=${page}`);
    assert.equal(res.pagination.total,6);actual.push(...res.routes.map((r:any)=>r.id));
  }
  assert.deepEqual(actual,["date-order-oct27","date-order-tie-a","date-order-tie-b","date-order-oct30","date-order-nov","date-order-undated"]);
  pass("Ordenação global cruza meses e páginas, ignora prioridade por status, desempata por ID e coloca sem data ao final");
  await p.collection.deleteMany({where:{routeId:{in:orderIds}}});
  await p.route.deleteMany({where:{id:{in:orderIds}}});
  if (process.env.APP_RELIABILITY === "1") {
    const { checkHistory } = await import("../app-reliability/api");
    await checkHistory(app, p, users, coop, cat, driver, pass);
  }
  if (process.env.RESIDENTIAL === "1") {
    const { checkResidential } = await import("../residential/api");
    await checkResidential(app, p, coop, cat, driver, vehicle, pass);
  }
  if (process.env.ROUTE_PENDING === "1") {
    const { checkRoutePending } = await import("../route-pending/api");
    await checkRoutePending(app, p, users, coop, cat, member, driver, vehicle, pass);
  }
  if (process.env.COMMUNICATION === "1") {
    const { checkCommunication } = await import("../communication/api");
    await checkCommunication(app, p, users, coop, cat, driver, vehicle, pass);
  }
  if (process.env.GENERATOR_DOCUMENT === "1") {
    const { checkGeneratorDocument } = await import("../generator-document/api");
    await checkGeneratorDocument(app, p, users, coop, pass);
  }
  let cooperativeField;
  if (process.env.COOPERATIVE_FIELD === "1") {
    const {checkCooperativeField}=await import("../cooperative-field/api");
    cooperativeField=await checkCooperativeField(app,p,users,coop,pass);
  }
  let serviceDocuments;
  if (process.env.SERVICE_DOCUMENTS === "1") {
    const {checkServiceDocuments}=await import("../service-documents/api");
    serviceDocuments=await checkServiceDocuments(app,p,users,coop,pass);
  }
  let stockCodes;
  if (process.env.STOCK_CODES === "1") {
    const {checkStockCodes}=await import("../stock-codes/api");
    stockCodes=await checkStockCodes(app,p,users,coop,pass);
  }
  let wasteUsability;
  if (process.env.WASTE_USABILITY === "1") {
    const { checkWasteUsability } = await import("../waste-usability/api");
    wasteUsability = await checkWasteUsability(app,p,users,coop,cat,pass);
  }
  let wasteCompletion;
  if (process.env.WASTE_COMPLETION === "1") {
    const { checkWasteCompletion } = await import("../waste-completion/api");
    wasteCompletion = await checkWasteCompletion(app, p, users, coop, pass);
  }
  const tools = process.env.KATUA_VALIDATION_TOOLS || "/tmp";
  fs.writeFileSync(
    path.join(tools, "field-operations-api-results.json"),
    JSON.stringify({ passed: checks.length, checks }, null, 2),
  );
  if (process.env.RESIDENTIAL === "1") fs.writeFileSync(path.join(tools, "residential-api-results.json"), JSON.stringify({ passed: checks.length, checks }, null, 2));
  if (process.env.FIELD_UI === "1" || process.env.RESIDENTIAL_UI === "1" || process.env.GENERATOR_DOCUMENT_UI === "1" || process.env.WASTE_COMPLETION_UI === "1" || process.env.WASTE_USABILITY_UI === "1" || process.env.COOPERATIVE_FIELD_UI === "1" || process.env.SERVICE_DOCUMENTS_UI === "1" || process.env.STOCK_CODES_UI === "1") {
    fs.writeFileSync(
      path.join(tools, "field-operations-fixture.json"),
      JSON.stringify({
        wasteCompletion,
        wasteUsability,
        stockCodes,
        serviceDocuments,
        cooperativeField,
        owner: {
          id: users.owner.id,
          role: "COOPERATIVE",
          displayName: users.owner.displayName,
        },
        token: app.jwt.sign({ sub: users.owner.id, role: "COOPERATIVE" }),
        route: r1.id,
        second: r2.id,
        point: a.id,
        pev: c.id,
        normal: normal.id,
      }),
    );
    await app.listen({ host: "127.0.0.1", port: 3339 });
    console.log("FIELD_UI_READY");
    await new Promise((resolve) => process.once("SIGTERM", resolve));
  }
  await app.close();
  await p.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
