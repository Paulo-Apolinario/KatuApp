import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
async function main() {
  if (
    process.env.KATUA_LOCAL_VALIDATION !== "1" ||
    new URL(process.env.DATABASE_URL!).port !== "54329" ||
    new URL(process.env.DATABASE_URL!).hostname !== "127.0.0.1"
  )
    throw Error("Banco local obrigatório");
  const artifacts = process.env.KATUA_VALIDATION_TOOLS || os.tmpdir();
  process.env.NODE_ENV = "test";
  process.env.LOG_LEVEL = "silent";
  process.env.JWT_SECRET = randomBytes(48).toString("hex");
  const { prisma: p } = await import("../../src/lib/prisma");
  const { buildApp } = await import("../../src/app");
  const app = await buildApp();
  await app.ready();
  const checks: any[] = [];
  const pass = (name: string, details: any = {}) => {
    checks.push({ name, ...details });
    console.log("PASS", name, JSON.stringify(details));
  };
  const users: any = {};
  for (const [name, role] of [
    ["owner", "COOPERATIVE"],
    ["cat", "COLLECTOR"],
    ["pf", "PF"],
  ])
    users[name] = await p.user.create({
      data: {
        email: `audit-${name}@test.invalid`,
        displayName: name,
        role: role as any,
        passwordHash: "unused",
      },
    });
  const coop = await p.cooperative.create({
    data: { userId: users.owner.id, name: "Cooperativa auditoria" },
  });
  const collector = await p.collector.create({
    data: {
      cooperativeId: coop.id,
      userId: users.cat.id,
      name: "Catador auditoria",
      email: users.cat.email,
    },
  });
  async function call(
    who: string,
    method: any,
    url: string,
    payload?: any,
    expected?: number,
  ) {
    const u = users[who];
    const r = await app.inject({
      method,
      url,
      headers: {
        authorization: "Bearer " + app.jwt.sign({ sub: u.id, role: u.role }),
      },
      ...(payload === undefined ? {} : { payload }),
    });
    if (expected !== undefined) {
      assert.equal(r.statusCode, expected, r.body);
      return r.json();
    }
    if (r.statusCode >= 400)
      throw Error(`${method} ${url} ${r.statusCode} ${r.body.slice(0, 250)}`);
    return r.json();
  }
  const bin = await p.bin.create({
    data: {
      cooperativeId: coop.id,
      binId: "PEV-AUDIT",
      name: "PEV auditoria",
      publicAccess: true,
      latitude: -3.73,
      longitude: -38.52,
    },
  });
  async function report(binId = bin.id) {
    return (
      await call("pf", "POST", "/pev-requests", {
        id: randomUUID(),
        binId,
        condition: "FULL",
        notes: "PEV cheio para retirada de auditoria",
        photos: [],
      })
    ).request;
  }
  const r1 = await report();
  const a = (await call("cat", "POST", `/pev-requests/${r1.id}/collect`, {}))
    .collection;
  const shared = await report();
  assert.equal(shared.collectionId, a.id);
  pass("Dois relatos de uma retirada ativa compartilham a coleta");
  await call("cat", "POST", `/collections/${a.id}/start`, {});
  await call("cat", "POST", `/collections/${a.id}/complete-field`, {
    operationId: randomUUID(),
    materials: [
      {
        proposedMaterial: { name: "Papel teste", unit: "KG" },
        quantity: 40,
        unit: "KG",
      },
    ],
  });
  const r2 = await report();
  const b = (await call("cat", "POST", `/pev-requests/${r2.id}/collect`, {}))
    .collection;
  assert.notEqual(a.id, b.id);
  assert.equal(
    (await p.collection.findUniqueOrThrow({ where: { id: a.id } })).status,
    "COLLECTED",
  );
  pass(
    "Nova retirada do mesmo PEV tem coleta distinta mesmo aguardando recebimento anterior",
  );
  await call("cat", "POST", `/collections/${b.id}/start`, {});
  const payload = {
    operationId: randomUUID(),
    materials: [
      {
        proposedMaterial: { name: "Papel teste", unit: "KG" },
        quantity: 30,
        unit: "KG",
      },
    ],
  };
  await call("cat", "POST", `/collections/${b.id}/complete-field`, payload);
  const entries = await p.collectionWasteEntry.findMany({
    where: { collectionId: { in: [a.id, b.id] } },
  });
  assert.equal(entries.length, 2);
  assert.equal(new Set(entries.map((e) => e.collectionId)).size, 2);
  const times = await p.collection.findMany({
    where: { id: { in: [a.id, b.id] } },
    select: { collectedAt: true },
  });
  assert.equal(
    times[0].collectedAt?.toISOString().slice(0, 10),
    times[1].collectedAt?.toISOString().slice(0, 10),
  );
  pass("Mesmo dia: entradas separadas de 40 e 30 kg");
  await call("cat", "POST", `/collections/${b.id}/complete-field`, payload);
  assert.equal(await p.collectionWasteEntry.count(), 2);
  pass("Reenvio da conclusão com mesmo identificador não duplica entradas");
  await call("owner", "POST", `/collections/${a.id}/receive`, {});
  const col = (await call("owner", "GET", `/collections/${a.id}`)).collection;
  await call("owner", "POST", `/collections/${a.id}/start-sorting`, {}, 409);
  await call(
    "owner",
    "POST",
    "/collection-waste-destinations",
    {
      operationId: randomUUID(),
      collectionWasteEntryId: entries.find((e) => e.collectionId === a.id)!.id,
      type: "DIRECT_DESTINATION",
      quantity: 1,
      unit: "KG",
      destinationName: "Destino teste",
    },
    409,
  );
  pass("Triagem e movimentações bloqueadas antes da conferência");
  const review = {
    expectedVersion: 0,
    reason: "",
    items: col.collectionMaterials.map((m: any) => ({
      materialId: m.id,
      quantity: Number(m.quantity),
    })),
  };
  await call("owner", "POST", `/collections/${a.id}/review-quantities`, review);
  const nc = await p.inboxNotification.count();
  await call("owner", "POST", `/collections/${a.id}/review-quantities`, {
    ...review,
    expectedVersion: 1,
  });
  assert.equal(await p.collectionQuantityReview.count(), 1);
  assert.equal(await p.inboxNotification.count(), nc);
  pass("Conferência repetida sem mudança não duplica histórico nem avisos");
  const entry = entries.find((e) => e.collectionId === a.id)!;
  await call(
    "owner",
    "POST",
    `/waste-workspace/entries/${entry.id}/catalog`,
    { name: "Papel estoque", category: "Papel", unit: "LITER" },
    409,
  );
  const classified = await call(
    "owner",
    "POST",
    `/waste-workspace/entries/${entry.id}/catalog`,
    { name: "Papel estoque", category: "Papel", unit: "KG" },
  );
  const classifiedAgain = await call(
    "owner",
    "POST",
    `/waste-workspace/entries/${entry.id}/catalog`,
    { name: "Papel estoque", category: "Papel", unit: "KG" },
  );
  assert.equal(classified.item.id, classifiedAgain.item.id);
  assert.equal(await p.wasteStockItem.count({where:{cooperativeId:coop.id}}), 1);
  assert.equal(await p.wasteStockLot.count({where:{cooperativeId:coop.id}}), 0);
  assert.equal(
    (
      await p.collectionMaterial.findFirstOrThrow({
        where: { collectionId: a.id },
      })
    ).wasteTypeId,
    classified.item.id,
  );
  pass(
    "Classificação inline é vinculada à entrada, reutiliza material e não cria estoque",
  );
  const dest = {
    operationId: randomUUID(),
    collectionWasteEntryId: entry.id,
    type: "STOCK",
    quantity: 10,
    unit: "KG",
    stockItemId: classified.item.id,
    destinationDate: new Date().toISOString(),
  };
  const first = (
    await call("owner", "POST", "/collection-waste-destinations", dest)
  ).destination;
  const replay = (
    await call("owner", "POST", "/collection-waste-destinations", dest)
  ).destination;
  assert.equal(first.id, replay.id);
  assert.equal(await p.wasteStockLot.count({where:{cooperativeId:coop.id}}), 1);
  assert.equal(await p.collectionWasteDestination.count(), 1);
  assert.equal(
    Number(
      (
        await p.collectionWasteEntry.findUniqueOrThrow({
          where: { id: entry.id },
        })
      ).remainingQuantity,
    ),
    30,
  );
  pass(
    "Reenvio idêntico de destinação parcial devolve a mesma movimentação e lote",
  );
  await call(
    "owner",
    "POST",
    "/collection-waste-destinations",
    { ...dest, quantity: 11 },
    409,
  );
  await call(
    "owner",
    "POST",
    "/collection-waste-destinations",
    { ...dest, operationId: undefined },
    400,
  );
  pass(
    "Identificador reutilizado com conteúdo diferente e operação sem identificação são rejeitados",
  );
  const update = {
    operationId: randomUUID(),
    expectedVersion: first.version,
    type: "TRIAGE",
    destinationName: "Área de triagem",
  };
  const edited = (
    await call(
      "owner",
      "PATCH",
      `/collection-waste-destinations/${first.id}`,
      update,
    )
  ).destination;
  const editedReplay = (
    await call(
      "owner",
      "PATCH",
      `/collection-waste-destinations/${first.id}`,
      update,
    )
  ).destination;
  assert.equal(editedReplay.version, edited.version);
  assert.equal(
    await p.collectionWasteDestinationEvent.count({
      where: { destinationId: first.id },
    }),
    2,
  );
  await call(
    "owner",
    "PATCH",
    `/collection-waste-destinations/${first.id}`,
    { ...update, operationId: randomUUID(), notes: "Sobrescrita antiga" },
    409,
  );
  pass("Edição tem controle de versão e reenvio não duplica auditoria");
  const cancel = {
    operationId: randomUUID(),
    expectedVersion: edited.version,
    reason: "Revisão da movimentação de teste",
  };
  await call(
    "owner",
    "POST",
    `/collection-waste-destinations/${first.id}/cancel`,
    cancel,
  );
  await call(
    "owner",
    "POST",
    `/collection-waste-destinations/${first.id}/cancel`,
    cancel,
  );
  assert.equal(
    await p.collectionWasteDestinationEvent.count({
      where: { destinationId: first.id },
    }),
    3,
  );
  assert.equal(
    Number(
      (
        await p.collectionWasteEntry.findUniqueOrThrow({
          where: { id: entry.id },
        })
      ).remainingQuantity,
    ),
    40,
  );
  pass(
    "Cancelamento repetido preserva um evento e devolve o saldo uma única vez",
  );
  const next = (
    await call("owner", "POST", "/collection-waste-destinations", {
      ...dest,
      operationId: randomUUID(),
    })
  ).destination;
  assert.notEqual(next.id, first.id);
  pass(
    "Nova destinação parcial intencional com outro identificador permanece permitida",
  );
  const current = await call(
    "owner",
    "GET",
    "/waste-workspace/inventory?view=current",
  );
  const history = await call(
    "owner",
    "GET",
    "/waste-workspace/inventory?view=history",
  );
  assert.equal(current.lotCount, 1);
  assert.equal(history.lotCount, 1);
  assert(!("lots" in current.items[0]));
  pass(
    "Estoque atual e cancelamentos separados, sem download dos lotes na lista",
  );
  await call("owner", "POST", `/collections/${a.id}/start-sorting`, {});
  const temporary = (
    await call("owner", "POST", "/collection-waste-destinations", {
      operationId: randomUUID(),
      collectionWasteEntryId: entry.id,
      type: "TRIAGE",
      quantity: 30,
      unit: "KG",
      destinationName: "Triagem interna",
    })
  ).destination;
  await call("owner", "POST", `/collections/${a.id}/complete`, {});
  const pending = await call(
    "owner",
    "GET",
    "/waste-workspace/collections?stage=destination",
  );
  assert(pending.collections.some((c: any) => c.id === a.id));
  pass(
    "Triagem intermediária permite concluir a coleta e continua visível para acompanhamento mesmo com saldo zero",
  );
  await call(
    "owner",
    "PATCH",
    `/collection-waste-destinations/${temporary.id}`,
    {
      operationId: randomUUID(),
      expectedVersion: temporary.version,
      type: "STOCK",
      stockItemId: classified.item.id,
    },
  );
  assert.equal((await call("owner", "GET", `/collections/${a.id}`)).collection.status, "COMPLETED");
  pass(
    "Conversão de triagem em estoque após concluir preserva encerramento sem duplicar entradas",
  );
  const bin2 = await p.bin.create({
    data: {
      cooperativeId: coop.id,
      binId: "PEV-PENDENTE",
      name: "PEV pendente",
      publicAccess: true,
      latitude: -3.74,
      longitude: -38.53,
    },
  });
  await report(bin2.id);
  await report(bin2.id);
  await p.schedule.create({
    data: {
      cooperativeId: coop.id,
      requestedByUserId: users.pf.id,
      status: "REQUESTED",
    },
  });
  await p.extraCollectionOrder.create({
    data: {
      id: randomUUID(),
      cooperativeId: coop.id,
      collectorId: collector.id,
      originalHash: "test",
      payload: {},
      reporterUserId: users.cat.id,
      reporterName: "Catador teste",
      custody: "COLLECTOR",
      custodyNotes: "Dados de teste",
    },
  });
  const operations = (await call("owner", "GET", "/dashboard/operations")).data;
  assert.equal(operations.requested, 3);
  assert.equal(operations.requestSources.pevPoints, 1);
  assert.equal(operations.requestSources.pevReports, 2);
  assert.equal(operations.requestSources.extraOrders, 1);
  assert.equal(operations.requestSources.schedules, 1);
  pass(
    "Painel inclui agendamentos, OCs e PEVs sem contar relatos do mesmo PEV como duas retiradas",
  );
  const grouped = await call(
    "owner",
    "GET",
    "/waste-workspace/collections?origin=PEV&limit=1&page=1",
  );
  assert.equal(grouped.pagination.total, 2);
  assert.equal(grouped.collections.length, 1);
  assert(!("quantityReviews" in grouped.collections[0]));
  pass("Lista agrupada e paginação no servidor preservam coletas separadas");
  const foreignOwner = await p.user.create({
    data: {
      email: "foreign@waste-test.invalid",
      displayName: "Outra cooperativa",
      passwordHash: "unused",
      role: "COOPERATIVE",
    },
  });
  const foreign = await p.cooperative.create({
    data: { userId: foreignOwner.id, name: "Cooperativa alheia" },
  });
  users.foreign = foreignOwner;
  await p.wasteStockItem.create({
    data: {
      cooperativeId: foreign.id,
      name: "Segredo alheio",
      category: "Outros",
    },
  });
  assert.equal(
    (await call("foreign", "GET", "/waste-workspace/collections")).pagination
      .total,
    0,
  );
  await call(
    "foreign",
    "GET",
    `/waste-workspace/items/${classified.item.id}/lots`,
    undefined,
    404,
  );
  await call("pf", "GET", "/waste-workspace/inventory", undefined, 403);
  await call("cat", "GET", "/dashboard/operations", undefined, 403);
  pass(
    "Isolamento entre cooperativas e restrição de perfis em consultas e detalhes",
  );
  await p.wasteStockLot.createMany({
    data: Array.from({ length: 25 }, (_, i) => ({
      id: "audit-page-" + i,
      cooperativeId: coop.id,
      stockItemId: classified.item.id,
      lotCode: "MANUAL-" + i,
      quantity: 1,
      availableQuantity: 1,
      unit: "KG" as const,
    })),
  });
  const lots = await call(
    "owner",
    "GET",
    `/waste-workspace/items/${classified.item.id}/lots?limit=2&page=2`,
  );
  assert.equal(lots.lots.length, 2);
  assert.equal(lots.pagination.total, 27);
  pass(
    "Consulta de lotes carrega apenas a página solicitada e mantém total correto",
  );
  const fieldPage = await call(
    "owner",
    "GET",
    "/waste-workspace/field-collections?limit=1&page=2",
  );
  assert.equal(fieldPage.collections.length, 1);
  assert.equal(fieldPage.pagination.total, 2);
  assert(!("quantityReviews" in fieldPage.collections[0]));
  pass(
    "Lista de coletas usa paginação real e não baixa conferências na listagem",
  );
  await call(
    "owner",
    "GET",
    "/waste-workspace/collections?dateFrom=2026-02-31",
    undefined,
    400,
  );
  pass("Data inexistente é rejeitada sem consulta de período incorreto");
  await call(
    "owner",
    "POST",
    "/waste-stock/items",
    { name: "Papel  estoque", category: "Papel", unit: "KG" },
    409,
  );
  assert.equal(
    await p.wasteStockItem.count({ where: { cooperativeId: coop.id } }),
    1,
  );
  pass("Nomes equivalentes com espaços duplicados são barrados no banco");
  const generator = await p.generator.create({
    data: {
      cooperativeId: coop.id,
      name: "Gerador sem catador vinculado",
      email: "audit-generator@test.invalid",
      type: "SMALL",
      totalKg: 999,
    },
  });
  const gc = await p.collection.create({
    data: {
      cooperativeId: coop.id,
      generatorId: generator.id,
      status: "RECEIVED",
      receivedAt: new Date(),
      collectedAt: new Date(),
      totalWeightKg: 50,
      collectionMaterials: {
        create: { nameSnapshot: "Papel conferência", quantity: 50, unit: "KG" },
      },
    },
  });
  const gm = await p.collectionMaterial.findFirstOrThrow({
    where: { collectionId: gc.id },
  });
  await p.collectionWasteEntry.create({
    data: {
      cooperativeId: coop.id,
      collectionId: gc.id,
      collectionMaterialId: gm.id,
      materialNameSnapshot: gm.nameSnapshot,
      collectedQuantity: 50,
      remainingQuantity: 50,
      unit: "KG",
    },
  });
  await call("owner", "POST", `/collections/${gc.id}/review-quantities`, {
    expectedVersion: 0,
    reason: "Peso confirmado na balança",
    items: [{ materialId: gm.id, quantity: 40 }],
  });
  assert.equal(
    (await p.generator.findUniqueOrThrow({ where: { id: generator.id } }))
      .totalKg,
    40,
  );
  pass("Conferência corrige total do gerador mesmo sem catador vinculado");
  await call("owner", "POST", `/collections/${b.id}/receive`, {});
  const c = await p.collection.create({
    data: {
      cooperativeId: coop.id,
      collectorId: collector.id,
      status: "RECEIVED",
      receivedAt: new Date(),
      collectedAt: new Date(),
      quantityReviewVersion: 1,
      collectionMaterials: {
        create: {
          nameSnapshot: "Plástico limpo",
          categorySnapshot: "Plástico",
          quantity: 50,
          unit: "KG",
        },
      },
    },
  });
  const cm = await p.collectionMaterial.findFirstOrThrow({
    where: { collectionId: c.id },
  });
  const ce = await p.collectionWasteEntry.create({
    data: {
      cooperativeId: coop.id,
      collectionId: c.id,
      collectionMaterialId: cm.id,
      materialNameSnapshot: "Plástico limpo",
      collectedQuantity: 50,
      remainingQuantity: 50,
      destinedQuantity: 0,
      unit: "KG",
    },
  });
  await p.collection.create({
    data: {
      cooperativeId: coop.id,
      collectorId: collector.id,
      status: "IN_PROGRESS",
      startedAt: new Date(),
    },
  });
  const oil = await p.collection.create({
    data: {
      cooperativeId: coop.id,
      collectorId: collector.id,
      status: "RECEIVED",
      receivedAt: new Date(),
      collectedAt: new Date(),
      quantityReviewVersion: 1,
      collectionMaterials: {
        create: {
          nameSnapshot: "Óleo de cozinha",
          quantity: 20,
          unit: "LITER",
        },
      },
    },
  });
  const om = await p.collectionMaterial.findFirstOrThrow({
    where: { collectionId: oil.id },
  });
  const oe = await p.collectionWasteEntry.create({
    data: {
      cooperativeId: coop.id,
      collectionId: oil.id,
      collectionMaterialId: om.id,
      materialNameSnapshot: om.nameSnapshot,
      collectedQuantity: 20,
      remainingQuantity: 20,
      unit: "LITER",
    },
  });
  await call("owner", "POST", "/collection-waste-destinations", {
    operationId: randomUUID(),
    collectionWasteEntryId: oe.id,
    type: "TRIAGE",
    quantity: 20,
    unit: "LITER",
    destinationName: "Separação óleo",
  });
  fs.writeFileSync(path.join(artifacts, "waste-workspace-api-results.json"), JSON.stringify({ checks, passed: checks.length }, null, 2));
  if (process.env.TEAM_UI === "1") {
    const fixtures = {
      owner: users.owner,
      token: app.jwt.sign({ sub: users.owner.id, role: users.owner.role }),
      ids: {
        first: a.id,
        review: b.id,
        editable: c.id,
        entry: ce.id,
        stockItem: classified.item.id,
      },
      foreign: foreign.id,
    };
    fs.writeFileSync(
      path.join(artifacts, "waste-workspace-fixture.json"),
      JSON.stringify(fixtures),
    );
    await app.listen({ port: 3339, host: "127.0.0.1" });
    console.log("WASTE_UI_READY");
    await new Promise((resolve) => process.once("SIGTERM", resolve));
  }
  fs.writeFileSync(
    path.join(artifacts, "waste-workspace-api-results.json"),
    JSON.stringify({ checks, passed: checks.length }, null, 2),
  );
  await app.close();
  await p.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
