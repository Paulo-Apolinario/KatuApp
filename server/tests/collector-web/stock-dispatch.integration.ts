import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/prisma";
import {
  reviewExtraOrder,
  receiveExtraOrder,
} from "../../src/modules/extra-collection-orders/extra-order.schemas";
export async function dispatchTests(
  call: any,
  manager: string,
  collector: string,
  foreign: string,
  test: any,
) {
  const root = "/waste-stock/dispatches";
  const input = { stockItemId: "dispatch-item", unit: "KG", quantity: 400 };
  await prisma.wasteStockItem.create({
    data: {
      id: input.stockItemId,
      cooperativeId: "coop",
      name: "Papelão",
      category: "Papel",
      unit: "KG",
      defaultUnit: "KG",
    },
  });
  for (const [id, amount, status, unit, days] of [
    ["d-reserved", 100, "RESERVED", "KG", 0],
    ["d-liter", 900, "AVAILABLE", "LITER", 0],
    ["d-first", 370, "AVAILABLE", "KG", 1],
    ["d-partial", 60, "AVAILABLE", "KG", 2],
    ["d-last", 70, "AVAILABLE", "KG", 3],
  ] as const)
    await prisma.wasteStockLot.create({
      data: {
        id,
        cooperativeId: "coop",
        stockItemId: input.stockItemId,
        quantity: amount,
        availableQuantity: amount,
        quantityKg: amount,
        status,
        unit,
        receivedAt: new Date(`2026-10-0${days + 1}T00:00:00Z`),
      },
    });
  const origin = await prisma.collection.findFirst({
    where: { cooperativeId: "coop" },
  });
  if (origin) {
    const order = await prisma.serviceOrder.create({
      data: {
        cooperativeId: "coop",
        number: "OS-DISPATCH-QA",
        sourceKey: "DISPATCH-QA",
        sourceType: "COLLECTION",
        sourceId: origin.id,
        collections: { create: { collectionId: origin.id } },
      },
    });
    await prisma.wasteStockLot.update({
      where: { id: "d-first" },
      data: { originCollectionId: origin.id },
    });
  }
  const preview = await call("POST", root + "/preview", input, manager);
  let payload: any;
  const status = (r: any, expected: number) =>
    assert.equal(r.status, expected, JSON.stringify(r.body));
  await test("prévia FIFO usa só material/unidade disponíveis, com retirada parcial 60→30", async () => {
    status(preview, 200);
    assert.deepEqual(
      preview.body.allocations.map((a: any) => [a.lotId, a.quantity, a.after]),
      [
        ["d-first", "370.000", "0.000"],
        ["d-partial", "30.000", "30.000"],
      ],
    );
    payload = {
      ...input,
      operationId: randomUUID(),
      expectedPlanHash: preview.body.planHash,
      kind: "SALE",
      destinationName: "Recicladora QA",
      movementDate: "2026-11-05T18:30:00-03:00",
    };
  });
  await test("catador e cooperativa alheia não movimentam nem consultam o protocolo", async () => {
    status(await call("POST", root + "/preview", input, collector), 403);
    status(await call("POST", root, payload, collector), 403);
    status(await call("POST", root + "/preview", input, foreign), 404);
    status(
      await call("GET", root + "/" + payload.operationId, undefined, foreign),
      404,
    );
    status(await call("POST", root + "/preview", input, ""), 401);
  });
  await test("saldo insuficiente e precisão inválida não geram baixa", async () => {
    status(
      await call(
        "POST",
        root + "/preview",
        { ...input, quantity: 501 },
        manager,
      ),
      409,
    );
    status(
      await call(
        "POST",
        root + "/preview",
        { ...input, quantity: 0.0001 },
        manager,
      ),
      400,
    );
    assert.equal(
      await prisma.wasteStockMovement.count({
        where: { lotId: { startsWith: "d-" } },
      }),
      0,
    );
  });
  await test("saída atômica gera movimentos e documento com saldos, destino e horário", async () => {
    const result = await call("POST", root, payload, manager);
    status(result, 201);
    const a = await prisma.wasteStockLot.findUniqueOrThrow({
        where: { id: "d-first" },
      }),
      b = await prisma.wasteStockLot.findUniqueOrThrow({
        where: { id: "d-partial" },
      });
    assert.equal(a.status, "SOLD");
    assert.equal(a.availableQuantity.toString(), "0");
    assert.equal(a.quantity!.toString(), "370");
    assert.equal(b.status, "AVAILABLE");
    assert.equal(b.availableQuantity.toString(), "30");
    assert.equal(b.quantity!.toString(), "60");
    assert.equal(
      (
        await prisma.wasteStockLot.findUniqueOrThrow({
          where: { id: "d-reserved" },
        })
      ).availableQuantity.toString(),
      "100",
    );
    const d = result.body.document;
    assert(
      d.orders.some((o: any) => o.serviceOrder.number === "OS-DISPATCH-QA"),
    );
    assert.equal(d.kind, "STOCK_DISPATCH");
    assert.equal(d.snapshot.dispatch.destinationName, "Recicladora QA");
    assert.equal(d.snapshot.dispatch.allocations.length, 2);
    assert.equal(d.snapshot.dispatch.allocations[1].after, "30.000");
    assert(d.createdAt);
    assert(d.snapshot.dispatch.recordedAt);
    status(
      await call("GET", root + "/" + payload.operationId, undefined, manager),
      200,
    );
    if (process.env.KATUA_STOCK_DOCUMENT_TRIGGERS === "1")
      assert.equal(
        await prisma.internalDocument.count({
          where: {
            kind: "TRANSPORT_RECORD",
            movementId: {
              in: d.snapshot.dispatch.allocations.map((a: any) => a.movementId),
            },
          },
        }),
        2,
      );
  });
  await test("resposta perdida e envios concorrentes com mesmo protocolo não duplicam saída", async () => {
    const results = await Promise.all([
      call("POST", root, payload, manager),
      call("POST", root, payload, manager),
    ]);
    for (const r of results) {
      status(r, 200);
      assert.equal(r.body.replayed, true);
    }
    assert.equal(
      await prisma.wasteStockMovement.count({
        where: { operationId: { startsWith: `bulk:${payload.operationId}:` } },
      }),
      2,
    );
    assert.equal(
      await prisma.internalDocument.count({
        where: { eventKey: `STOCK-DISPATCH:${payload.operationId}` },
      }),
      1,
    );
    status(
      await call(
        "POST",
        root,
        { ...payload, destinationName: "Outro destino" },
        manager,
      ),
      409,
    );
  });
  await test("prévia antiga não pode retirar material depois de outra movimentação", async () => {
    const p = await call(
      "POST",
      root + "/preview",
      { ...input, quantity: 20 },
      manager,
    );
    status(p, 200);
    await prisma.wasteStockLot.update({
      where: { id: "d-partial" },
      data: { version: { increment: 1 } },
    });
    const next = {
      ...payload,
      quantity: 20,
      operationId: randomUUID(),
      expectedPlanHash: p.body.planHash,
    };
    status(await call("POST", root, next, manager), 409);
    assert.equal(
      await prisma.internalDocument.count({
        where: { eventKey: `STOCK-DISPATCH:${next.operationId}` },
      }),
      0,
    );
    assert.equal(
      (
        await prisma.wasteStockLot.findUniqueOrThrow({
          where: { id: "d-partial" },
        })
      ).availableQuantity.toString(),
      "30",
    );
  });
  await test("duas saídas disputando o mesmo saldo: só uma confirma a mesma prévia", async () => {
    const p = await call(
      "POST",
      root + "/preview",
      { ...input, quantity: 70 },
      manager,
    );
    status(p, 200);
    const a = {
        ...payload,
        quantity: 70,
        operationId: randomUUID(),
        expectedPlanHash: p.body.planHash,
      },
      b = { ...a, operationId: randomUUID() };
    const results = await Promise.all([
      call("POST", root, a, manager),
      call("POST", root, b, manager),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
    const balance = await prisma.wasteStockLot.aggregate({
      where: {
        stockItemId: input.stockItemId,
        unit: "KG",
        status: "AVAILABLE",
      },
      _sum: { availableQuantity: true },
    });
    assert.equal(balance._sum.availableQuantity!.toString(), "30");
  });
  await test("falha ao emitir documento desfaz todos os movimentos e saldos da operação", async () => {
    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION qa_fail_dispatch_document() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind='STOCK_DISPATCH' AND NEW.snapshot->'dispatch'->>'destinationName'='Falha QA' THEN RAISE EXCEPTION 'Falha de emissão controlada'; END IF; RETURN NEW; END; $$`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER qa_dispatch_failure BEFORE INSERT ON "InternalDocument" FOR EACH ROW EXECUTE FUNCTION qa_fail_dispatch_document()`,
    );
    try {
      const p = await call(
        "POST",
        root + "/preview",
        { ...input, quantity: 10 },
        manager,
      );
      status(p, 200);
      const request = {
        ...payload,
        quantity: 10,
        operationId: randomUUID(),
        expectedPlanHash: p.body.planHash,
        destinationName: "Falha QA",
      };
      const before = await prisma.wasteStockLot.findMany({
        where: { stockItemId: input.stockItemId },
        orderBy: { id: "asc" },
      });
      status(await call("POST", root, request, manager), 500);
      assert.deepEqual(
        await prisma.wasteStockLot.findMany({
          where: { stockItemId: input.stockItemId },
          orderBy: { id: "asc" },
        }),
        before,
      );
      assert.equal(
        await prisma.wasteStockMovement.count({
          where: {
            operationId: { startsWith: `bulk:${request.operationId}:` },
          },
        }),
        0,
      );
    } finally {
      await prisma.$executeRawUnsafe(
        'DROP TRIGGER qa_dispatch_failure ON "InternalDocument"',
      );
      await prisma.$executeRawUnsafe(
        "DROP FUNCTION qa_fail_dispatch_document()",
      );
    }
  });
  await test("precisão decimal preserva 0,300 − 0,100 = 0,200", async () => {
    const item = await prisma.wasteStockItem.create({
      data: {
        cooperativeId: "coop",
        name: "Decimal QA",
        category: "QA",
        unit: "KG",
      },
    });
    const lot = await prisma.wasteStockLot.create({
      data: {
        cooperativeId: "coop",
        stockItemId: item.id,
        quantity: 0.3,
        availableQuantity: 0.3,
        unit: "KG",
      },
    });
    const p = await call(
      "POST",
      root + "/preview",
      { stockItemId: item.id, quantity: 0.1, unit: "KG" },
      manager,
    );
    status(p, 200);
    const request = {
      ...payload,
      stockItemId: item.id,
      quantity: 0.1,
      operationId: randomUUID(),
      expectedPlanHash: p.body.planHash,
    };
    const attempts = await Promise.all([
      call("POST", root, request, manager),
      call("POST", root, request, manager),
    ]);
    assert.deepEqual(attempts.map((r) => r.status).sort(), [200, 201]);
    assert.equal(
      (
        await prisma.wasteStockLot.findUniqueOrThrow({ where: { id: lot.id } })
      ).availableQuantity.toString(),
      "0.2",
    );
  });
  await test("aprovação e recebimento dispensam observação; recusa e complementação exigem motivo", () => {
    const base = {
      operationId: randomUUID(),
      expectedRevision: 1,
      decision: "ACCEPT",
    };
    assert.equal(reviewExtraOrder.parse(base).notes, "");
    assert.equal(
      receiveExtraOrder.parse({
        operationId: randomUUID(),
        receivedAt: new Date().toISOString(),
      }).notes,
      "",
    );
    assert(
      !reviewExtraOrder.safeParse({ ...base, decision: "NEEDS_INFO" }).success,
    );
    assert(
      !reviewExtraOrder.safeParse({
        ...base,
        decision: "REJECT",
        custody: "ORIGIN",
        custodyNotes: "Na origem, aguardando retirada",
      }).success,
    );
  });
}
