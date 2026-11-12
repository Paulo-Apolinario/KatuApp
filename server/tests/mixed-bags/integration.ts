import { runControls } from "./controls.integration";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { prisma } from "../../src/lib/prisma";
import { buildApp } from "../../src/app";
async function main() {
  const url = new URL(process.env.DATABASE_URL || "");
  if (
    url.port !== "54345" ||
    url.hostname !== "127.0.0.1" ||
    process.env.KATUA_MIXED_BAG_TEST !== "1"
  )
    throw Error("Somente banco descartável local.");
  const app = await buildApp();
  try {
    for (const [id, role] of [
      ["a", "COOPERATIVE"],
      ["b", "COOPERATIVE"],
      ["c1", "COLLECTOR"],
      ["c2", "COLLECTOR"],
      ["cb", "COLLECTOR"],
      ["pf", "PF"],
    ] as const)
      await prisma.user.create({
        data: {
          id,
          email: `${id}@qa.invalid`,
          passwordHash: "unused",
          displayName: id,
          role,
        },
      });
    for (const id of ["a", "b"])
      await prisma.cooperative.create({
        data: { id: `coop-${id}`, userId: id, name: id },
      });
    for (const [id, coop] of [
      ["c1", "a"],
      ["c2", "a"],
      ["cb", "b"],
    ])
      await prisma.collector.create({
        data: {
          id: `col-${id}`,
          cooperativeId: `coop-${coop}`,
          userId: id,
          name: `Catador ${id}`,
        },
      });
    for (const id of ["g1", "g2", "gb"])
      await prisma.generator.create({
        data: {
          id,
          type: "SMALL",
          cooperativeId: id === "gb" ? "coop-b" : "coop-a",
          name: `Gerador ${id}`,
        },
      });
    for (const [id, unit, coop] of [
      ["paper", "KG", "a"],
      ["glass", "KG", "a"],
      ["oil", "LITER", "a"],
      ["foreign", "KG", "b"],
    ] as const)
      await prisma.wasteStockItem.create({
        data: {
          id,
          name: id,
          category: "Teste",
          unit,
          defaultUnit: unit,
          cooperativeId: `coop-${coop}`,
        },
      });
    const call = (
      method: "GET" | "POST" | "PATCH",
      url: string,
      payload?: any,
      who = "a",
    ) =>
      app.inject({
        method,
        url,
        ...(payload === undefined ? {} : { payload }),
        headers: who
          ? {
              authorization: `Bearer ${app.jwt.sign({ sub: who, role: ["a", "b"].includes(who) ? "COOPERATIVE" : who === "pf" ? "PF" : "COLLECTOR", authVersion: 0 })}`,
            }
          : {},
      });
    const received = async (gross = 110, tare = 10, extra: any = {}) => {
      const r = await call("POST", "/mixed-bags", {
        operationId: randomUUID(),
        grossKg: gross,
        tareKg: tare,
        originLabel: "Bag da rua",
        generatorIds: ["g1"],
        ...extra,
      });
      assert.equal(r.statusCode, 201, r.body);
      return r.json().bag;
    };
    const sort = async (
      bag: any,
      qty: number,
      itemId = "paper",
      extra: any = {},
      who = "c1",
    ) =>
      call(
        "POST",
        `/mixed-bags/${bag.id}/sort`,
        {
          operationId: randomUUID(),
          expectedVersion: bag.version,
          outputs: qty ? [{ itemId, quantityKg: qty }] : [],
          participantIds: ["col-c2"],
          ...extra,
        },
        who,
      );
    const get = async (id: string) =>
      (await call("GET", `/mixed-bags/${id}`)).json().bag;
    const close = async (bag: any) => {
      const r = await call("POST", `/mixed-bags/${bag.id}/close`, {
        operationId: randomUUID(),
        expectedVersion: bag.version,
      });
      assert.equal(r.statusCode, 201, r.body);
      return r.json().bag;
    };
    for (const who of ["pf", ""])
      assert.equal(
        (await call("GET", "/mixed-bags", undefined, who)).statusCode,
        who ? 403 : 401,
      );
    const bag = await received();
    assert.equal(bag.netKg, "100.000");
    assert.equal(bag.remainingKg, "100.000");
    assert.equal(
      (await call("GET", `/mixed-bags/${bag.id}`, undefined, "b")).statusCode,
      404,
    );
    assert.equal(
      (await call("GET", `/mixed-bags/${bag.id}`, undefined, "cb")).statusCode,
      404,
    );
    const initial = await prisma.collection.findUniqueOrThrow({
      where: { id: bag.collectionId },
    });
    assert.equal(initial.totalWeightKg, 0);
    assert.equal(initial.reportedTotalWeightKg, 100);
    assert.equal(await prisma.wasteStockLot.count(), 0);
    const body = {
      operationId: randomUUID(),
      expectedVersion: 1,
      outputs: [{ itemId: "paper", quantityKg: 40 }],
      participantIds: ["col-c2"],
      rejectedKg: 5,
      notes: "Rejeito identificado na triagem",
    };
    const r = await call("POST", `/mixed-bags/${bag.id}/sort`, body, "c1");
    assert.equal(r.statusCode, 201, r.body);
    assert.equal(r.json().bag.remainingKg, "55.000");
    const first = await prisma.mixedBagOutput.findFirstOrThrow({
      where: { bagId: bag.id },
    });
    let lot = await prisma.wasteStockLot.findUniqueOrThrow({
      where: { id: first.lotId },
    });
    assert.equal(Number(lot.availableQuantity), 40);
    assert.equal(Number(lot.quantity), 40);
    const event = await prisma.mixedBagEvent.findUniqueOrThrow({
      where: {
        cooperativeId_operationId: {
          cooperativeId: "coop-a",
          operationId: body.operationId,
        },
      },
    });
    assert.equal(event.actorUserId, "c1");
    assert.equal((event.participantSnapshot as any[]).length, 2);
    assert.equal(
      (await call("POST", `/mixed-bags/${bag.id}/sort`, body, "c1")).statusCode,
      200,
    );
    assert.equal(
      (await call("POST", `/mixed-bags/${bag.id}/sort`, body, "c2")).statusCode,
      409,
    );
    assert.equal(
      Number(
        (
          await prisma.wasteStockLot.findUniqueOrThrow({
            where: { id: lot.id },
          })
        ).availableQuantity,
      ),
      40,
    );
    assert.equal((await sort(bag, 1)).statusCode, 409);
    let current = await get(bag.id);
    assert.equal((await sort(current, 56)).statusCode, 409);
    const append = await sort(current, 20, "paper", {
      outputs: [
        {
          itemId: "paper",
          quantityKg: 20,
          lotId: lot.id,
          expectedLotVersion: lot.version,
        },
      ],
    });
    assert.equal(append.statusCode, 201, append.body);
    current = await get(bag.id);
    assert.equal((await sort(current, 35, "glass")).statusCode, 201);
    current = await get(bag.id);
    await close(current);
    const collection = await prisma.collection.findUniqueOrThrow({
      where: { id: bag.collectionId },
      include: { collectionMaterials: true },
    });
    assert.equal(collection.totalWeightKg, 95);
    assert.equal(collection.reportedTotalWeightKg, 100);
    assert.equal(collection.status, "COMPLETED");
    assert.equal(
      collection.collectionMaterials.reduce(
        (s, m) => s + Number(m.quantity),
        0,
      ),
      95,
    );
    assert.equal(
      (await prisma.generator.findUniqueOrThrow({ where: { id: "g1" } }))
        .totalKg,
      95,
    );
    assert.equal(
      (await prisma.collector.findUniqueOrThrow({ where: { id: "col-c1" } }))
        .totalKg,
      0,
    );
    assert.equal(
      (await call("POST", `/collections/${bag.collectionId}/complete`, {}))
        .statusCode,
      409,
    );
    assert.equal(
      (
        await call(
          "POST",
          `/collections/${bag.collectionId}/allocate-materials`,
          {},
        )
      ).statusCode,
      409,
    );
    assert.equal(
      (
        await call(
          "POST",
          `/collection-waste-destinations/${first.destinationId}/cancel`,
          { reason: "Teste", operationId: randomUUID() },
        )
      ).statusCode,
      409,
    );
    assert.equal(
      (
        await call("POST", `/material-intakes/${bag.collectionId}/weigh`, {
          operationId: randomUUID(),
          materials: [],
        })
      ).statusCode,
      409,
    );
    assert.equal((await sort(await get(bag.id), 1)).statusCode, 409);
    const a = await received(40, 0),
      b = await received(60, 0, { collectionId: a.collectionId });
    assert.equal(a.collectionId, b.collectionId);
    assert.equal((await sort(a, 40)).statusCode, 201);
    await close(await get(a.id));
    assert.equal(
      (
        await prisma.collection.findUniqueOrThrow({
          where: { id: a.collectionId },
        })
      ).status,
      "SORTING",
    );
    assert.equal((await sort(b, 60)).statusCode, 201);
    await close(await get(b.id));
    assert.equal(
      (
        await prisma.collection.findUniqueOrThrow({
          where: { id: a.collectionId },
        })
      ).totalWeightKg,
      100,
    );
    const col = await prisma.collection.create({
      data: { cooperativeId: "coop-a", generatorId: "g2", status: "COLLECTED" },
    });
    const linked = await received(10, 0, {
      collectionId: col.id,
      generatorIds: [],
    });
    assert.equal(linked.collectionId, col.id);
    const known = await prisma.collection.create({
      data: { cooperativeId: "coop-a", status: "COLLECTED", totalWeightKg: 10 },
    });
    const bad = await call("POST", "/mixed-bags", {
      operationId: randomUUID(),
      grossKg: 10,
      tareKg: 0,
      originLabel: "Não duplicar",
      collectionId: known.id,
    });
    assert.equal(bad.statusCode, 409);
    const multi = await received(2, 0, { generatorIds: ["g1", "g2"] });
    assert.equal(
      (
        await prisma.collection.findUniqueOrThrow({
          where: { id: multi.collectionId },
        })
      ).generatorId,
      null,
    );
    assert.equal((multi.originSnapshot as any).generators.length, 2);
    const tag = await received(1, 0, { externalTag: "BAG-REUTILIZAVEL" });
    const duplicate = await call("POST", "/mixed-bags", {
      operationId: randomUUID(),
      grossKg: 1,
      tareKg: 0,
      originLabel: "Nova bag",
      externalTag: "BAG-REUTILIZAVEL",
    });
    assert.equal(duplicate.statusCode, 409);
    assert.equal(
      (
        await call(
          "POST",
          `/mixed-bags/${tag.id}/cancel`,
          {
            operationId: randomUUID(),
            expectedVersion: tag.version,
            notes: "Cadastro duplicado conferido",
          },
          "c1",
        )
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await call("POST", `/mixed-bags/${tag.id}/cancel`, {
          operationId: randomUUID(),
          expectedVersion: tag.version,
          notes: "Cadastro duplicado conferido",
        })
      ).statusCode,
      201,
    );
    await received(1, 0, { externalTag: "BAG-REUTILIZAVEL" });
    const adjusted = await received(10, 0);
    const changed = await call("POST", `/mixed-bags/${adjusted.id}/adjust`, {
      operationId: randomUUID(),
      expectedVersion: adjusted.version,
      grossKg: 13,
      tareKg: 1,
      notes: "Nova conferência na balança",
    });
    assert.equal(changed.statusCode, 201, changed.body);
    assert.equal(changed.json().event.before.grossKg, "10.000");
    assert.equal(changed.json().event.after.tareKg, "1.000");
    const precision = await received(100.001, 0);
    assert.equal(
      (
        await sort(precision, 99.999, "glass", {
          rejectedKg: 0.002,
          notes: "Pequena impureza pesada",
        })
      ).statusCode,
      201,
    );
    assert.equal((await get(precision.id)).remainingKg, "0.000");
    const restricted = await received(10, 0);
    assert.equal((await sort(restricted, 1, "oil")).statusCode, 400);
    assert.equal((await sort(restricted, 1, "foreign")).statusCode, 404);
    assert.equal(
      (await sort(restricted, 1, "paper", { participantIds: ["col-cb"] }))
        .statusCode,
      400,
    );
    const race = await received(9, 0);
    const both = await Promise.all([sort(race, 5), sort(race, 5)]);
    assert.deepEqual(both.map((r) => r.statusCode).sort(), [201, 409]);
    assert.equal((await get(race.id)).remainingKg, "4.000");
    const lineage = (
      await call("GET", `/mixed-bags/lots/${lot.id}/lineage`)
    ).json();
    assert.equal(lineage.outputs.length, 2);
    assert.equal(lineage.otherInputQuantityKg, "0.000");
    const summary = (await call("GET", "/mixed-bags?status=COMPLETED")).json();
    assert.equal(Number(summary.summary.receivedKg), 200);
    assert.equal(Number(summary.summary.sortedKg), 195);
    assert.equal(Number(summary.summary.rejectedKg), 5);
    const dispatchInput = { stockItemId: "paper", unit: "KG", quantity: 10 };
    assert.equal(
      (
        await call(
          "POST",
          "/waste-stock/dispatches/preview",
          dispatchInput,
          "c1",
        )
      ).statusCode,
      403,
    );
    const plan = await call(
      "POST",
      "/waste-stock/dispatches/preview",
      dispatchInput,
    );
    assert.equal(plan.statusCode, 200, plan.body);
    const shipment = await call("POST", "/waste-stock/dispatches", {
      ...dispatchInput,
      operationId: randomUUID(),
      expectedPlanHash: plan.json().planHash,
      kind: "SALE",
      destinationName: "Recicladora QA",
      movementDate: new Date().toISOString(),
    });
    assert.equal(shipment.statusCode, 201, shipment.body);
    const dispatchDoc = await prisma.internalDocument.findFirstOrThrow({
      where: { kind: "STOCK_DISPATCH" },
    });
    const snapshot = dispatchDoc.snapshot as any;
    assert.equal(snapshot.dispatch.quantity, "10.000");
    assert.equal(snapshot.dispatch.allocations[0].bagComposition.length, 2);
    assert.equal(
      snapshot.dispatch.allocations[0].bagComposition.reduce(
        (v: number, o: any) => v + Number(o.inputQuantityKg),
        0,
      ),
      60,
    );
    const afterDispatch = await prisma.wasteStockLot.findUniqueOrThrow({
      where: { id: lot.id },
    });
    assert.equal(Number(afterDispatch.availableQuantity), 50);
    assert.equal(Number(afterDispatch.quantity), 60);
    // Report dates are civil Fortaleza days. Production and receipt cohorts differ.
    const reportBag = await received(100, 0);
    const reportSort = await sort(reportBag, 40, "paper", {
      rejectedKg: 10,
      notes: "Rejeitos pesados para o relatório",
    });
    assert.equal(reportSort.statusCode, 201, reportSort.body);
    const firstReportEvent = reportSort.json().event.id;
    const laterSort = await sort(await get(reportBag.id), 20);
    assert.equal(laterSort.statusCode, 201, laterSort.body);
    await prisma.mixedBag.update({
      where: { id: reportBag.id },
      data: { receivedAt: new Date("2026-01-01T03:00:00Z") },
    });
    await prisma.mixedBagEvent.update({
      where: { id: firstReportEvent },
      data: { createdAt: new Date("2026-01-02T02:59:59.999Z") },
    });
    await prisma.mixedBagEvent.update({
      where: { id: laterSort.json().event.id },
      data: { createdAt: new Date("2026-01-02T03:00:00Z") },
    });
    const oldBag = await received(50, 0);
    const oldSort = await sort(oldBag, 10, "glass");
    assert.equal(oldSort.statusCode, 201, oldSort.body);
    await prisma.mixedBag.update({
      where: { id: oldBag.id },
      data: { receivedAt: new Date("2025-12-31T03:00:00Z") },
    });
    await prisma.mixedBagEvent.update({
      where: { id: oldSort.json().event.id },
      data: { createdAt: new Date("2026-01-01T03:00:00Z") },
    });
    const reportUrl = "/mixed-bags/report?start=2026-01-01&end=2026-01-01";
    const response = await call("GET", reportUrl);
    assert.equal(response.statusCode, 200, response.body);
    const report = response.json();
    assert.equal(report.cohort.bags, 1);
    assert.equal(report.cohort.receivedKg, "100.000");
    assert.equal(report.cohort.sortedKg, "60.000");
    assert.equal(report.cohort.pendingKg, "30.000");
    assert.equal(report.cohort.recoveredPercent, 60);
    assert.equal(report.cohort.rejectedPercent, 10);
    assert.equal(report.production.sortedKg, "50.000");
    assert.equal(report.production.rejectedKg, "10.000");
    assert.equal(report.production.operations, 2);
    assert.equal(
      report.materials.find((m: any) => m.itemId === "paper").quantityKg,
      "40.000",
    );
    assert.equal(report.series[0].sortedKg, "50.000");
    assert.equal(report.participants.length, 2);
    assert.equal(
      report.participants.reduce(
        (n: number, p: any) => n + Number(p.collectiveKg),
        0,
      ),
      100,
    );
    assert.equal(report.production.sortedKg, "50.000");
    const personReport = await call("GET", reportUrl + "&participantId=col-c2");
    assert.equal(personReport.statusCode, 200, personReport.body);
    assert.equal(personReport.json().cohort.bags, 1);
    const materialReport = (
      await call("GET", reportUrl + "&itemId=glass")
    ).json();
    assert.equal(materialReport.events.items.length, 1);
    assert.equal(materialReport.production.sortedKg, "50.000");
    assert.equal(
      (await call("GET", reportUrl + "&bucket=COMPLETED")).json().bags.items
        .length,
      0,
    );
    assert.equal(
      (await call("GET", reportUrl + "&page=2")).json().bags.items.length,
      0,
    );
    const other = (await call("GET", reportUrl, undefined, "b")).json();
    assert.equal(other.cohort.bags, 0);
    assert.equal(other.cohort.recoveredPercent, null);
    assert.equal(other.production.operations, 0);
    assert.equal(
      (await call("GET", reportUrl + "&participantId=col-cb")).statusCode,
      404,
    );
    assert.equal(
      (await call("GET", reportUrl, undefined, "c1")).statusCode,
      200,
    );
    assert.equal(
      (await call("GET", reportUrl, undefined, "pf")).statusCode,
      403,
    );
    assert.equal((await call("GET", reportUrl, undefined, "")).statusCode, 401);
    for (const suffix of [
      "start=2026-02-30&end=2026-03-01",
      "start=2024-01-01&end=2026-01-01",
      "start=2026-01-02&end=2026-01-01",
      "end=2099-01-01",
      "unexpected=yes",
    ]) {
      assert.equal(
        (await call("GET", "/mixed-bags/report?" + suffix)).statusCode,
        400,
        suffix,
      );
    }
    console.log(
      "PASS: triage reporting separates current receipt-cohort balances from dated production; Fortaleza midnight boundaries; shared participation without double-counting totals; drilldowns, pagination, empty data, dates, roles and tenant isolation",
    );
    const controls = await runControls({
      call,
      received,
      sort,
      get,
      close,
      usedBag: bag,
    });
    if (process.env.KATUA_BAG_FIXTURE)
      writeFileSync(
        process.env.KATUA_BAG_FIXTURE,
        JSON.stringify({
          controls,
          report,
          context: (await call("GET", "/mixed-bags/context")).json(),
          catalog: (await call("GET", "/mixed-bags/catalog")).json(),
          list: (await call("GET", "/mixed-bags")).json(),
          bag: await get(linked.id),
          closedBag: await get(bag.id),
          lot: await prisma.wasteStockLot.findUniqueOrThrow({
            where: { id: lot.id },
          }),
          lineage,
          operator: {
            id: "c1",
            email: "c1@qa.invalid",
            displayName: "Catador c1",
            role: "COLLECTOR",
            collector: { id: "col-c1", cooperativeId: "coop-a" },
          },
          manager: {
            id: "a",
            email: "a@qa.invalid",
            displayName: "Cooperativa QA",
            role: "COOPERATIVE",
            cooperative: { id: "coop-a", name: "Cooperativa QA" },
          },
        }),
      );
    console.log(
      "PASS: gross/tare/net conservation, partial/reject triage, lot creation/addition, idempotency, actor/team distinction, version conflicts, multiple bags per receipt, source reuse without duplicate collection, origin uncertainty, active bag tags, immutable history, adjustment audit, unit/tenant/role isolation, legacy-edit guards and exact decimal precision",
    );
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
