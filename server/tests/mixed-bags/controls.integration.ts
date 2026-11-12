import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/prisma";
import { civilDay } from "../../src/modules/mixed-bags/bags.calendar";
export async function runControls({
  call,
  received,
  sort,
  get,
  close,
  usedBag,
}: any) {
  const reverse = async (
    bag: any,
    eventId: string,
    who = "a",
    extra: any = {},
  ) =>
    call(
      "POST",
      `/mixed-bags/${bag.id}/reverse`,
      {
        operationId: randomUUID(),
        expectedVersion: bag.version,
        eventId,
        notes: "Correção conferida na balança",
        ...extra,
      },
      who,
    );
  const b = await received(30, 0),
    s = await sort(b, 30);
  assert.equal(s.statusCode, 201, s.body);
  await close(await get(b.id));
  const id = s.json().event.id,
    operationId = randomUUID(),
    body = {
      operationId,
      expectedVersion: (await get(b.id)).version,
      eventId: id,
      notes: "Correção conferida na balança",
    };
  assert.equal(
    (await call("POST", `/mixed-bags/${b.id}/reverse`, body, "c1")).statusCode,
    403,
  );
  assert.equal(
    (await call("POST", `/mixed-bags/${b.id}/reverse`, body, "b")).statusCode,
    404,
  );
  const genBefore = (
    await prisma.generator.findUniqueOrThrow({ where: { id: "g1" } })
  ).totalKg;
  const reversed = await call("POST", `/mixed-bags/${b.id}/reverse`, body);
  assert.equal(reversed.statusCode, 201, reversed.body);
  assert.equal(reversed.json().bag.remainingKg, "30.000");
  assert.equal(reversed.json().bag.status, "SORTING");
  assert.equal(
    (await call("POST", `/mixed-bags/${b.id}/reverse`, body)).statusCode,
    200,
  );
  assert.equal((await reverse(await get(b.id), id)).statusCode, 409);
  assert.equal(
    (await prisma.generator.findUniqueOrThrow({ where: { id: "g1" } })).totalKg,
    genBefore - 30,
  );
  const source = await prisma.mixedBagEvent.findUniqueOrThrow({
    where: { id },
    include: { outputs: true },
  });
  assert.ok(source.reversedAt);
  assert.equal(source.outputs[0].quantityKg.toFixed(3), "30.000");
  assert.equal(
    (
      await prisma.collectionMaterial.findUniqueOrThrow({
        where: { id: source.outputs[0].materialId },
      })
    ).quantity.toFixed(3),
    "0.000",
  );
  assert.equal(
    (
      await prisma.wasteStockLot.findUniqueOrThrow({
        where: { id: source.outputs[0].lotId },
      })
    ).status,
    "CANCELLED",
  );
  assert.equal(
    (
      await call("GET", `/mixed-bags/lots/${source.outputs[0].lotId}/lineage`)
    ).json().outputs.length,
    0,
  );
  const changed = (await get(usedBag.id)).events.find(
    (e: any) =>
      e.kind === "SORT" && e.outputs.some((o: any) => o.itemId === "paper"),
  );
  assert.equal(
    (await reverse(await get(usedBag.id), changed.id)).statusCode,
    409,
  );
  assert.equal((await get(usedBag.id)).status, "COMPLETED");
  const a = await received(50, 0),
    first = await sort(a, 20);
  const out = await prisma.mixedBagOutput.findFirstOrThrow({
    where: { eventId: first.json().event.id },
    include: { lot: true },
  });
  const appended = await sort(await get(a.id), 10, "paper", {
    outputs: [
      {
        itemId: "paper",
        quantityKg: 10,
        lotId: out.lotId,
        expectedLotVersion: out.lot.version,
      },
    ],
  });
  assert.equal(appended.statusCode, 201, appended.body);
  assert.equal(
    (await reverse(await get(a.id), first.json().event.id)).statusCode,
    409,
  );
  assert.equal(
    (await reverse(await get(a.id), appended.json().event.id)).statusCode,
    201,
  );
  assert.equal(
    (await reverse(await get(a.id), first.json().event.id)).statusCode,
    201,
  );
  assert.equal((await get(a.id)).remainingKg, "50.000");
  const reject = await received(10, 0),
    rej = await sort(reject, 0, "paper", {
      rejectedKg: 3,
      notes: "Rejeitos pesados",
    });
  assert.equal(
    (await reverse(await get(reject.id), rej.json().event.id)).statusCode,
    201,
  );
  assert.equal((await get(reject.id)).rejectedKg, "0.000");
  const day = civilDay(),
    view = async (d = day) =>
      (await call("GET", `/mixed-bags/day?day=${d}`)).json();
  let preview = await view();
  const another = await received(5, 0);
  assert.equal((await sort(another, 1)).statusCode, 201);
  const stale = await call("POST", `/mixed-bags/day/${day}/close`, {
    operationId: randomUUID(),
    expectedVersion: preview.version,
    expectedFingerprint: preview.preview.fingerprint,
    notes: "Conferência da produção do dia",
  });
  assert.equal(stale.statusCode, 409, stale.body);
  preview = await view();
  const closeBody = {
    operationId: randomUUID(),
    expectedVersion: preview.version,
    expectedFingerprint: preview.preview.fingerprint,
    notes: "",
  };
  const closed = await call("POST", `/mixed-bags/day/${day}/close`, closeBody);
  assert.equal(closed.statusCode, 201, closed.body);
  assert.equal(
    (await call("POST", `/mixed-bags/day/${day}/close`, closeBody)).statusCode,
    200,
  );
  let current = await view();
  assert.equal(current.status, "CLOSED");
  const preserved = current.snapshot.sortedKg;
  assert.equal((await sort(await get(another.id), 1)).statusCode, 409);
  assert.equal(
    (
      await reverse(
        await get(another.id),
        (await get(another.id)).events.find((e: any) => e.kind === "SORT").id,
      )
    ).statusCode,
    409,
  );
  const reopen = {
    operationId: randomUUID(),
    expectedVersion: current.version,
    notes: "Reabertura para corrigir a produção",
  };
  assert.equal(
    (await call("POST", `/mixed-bags/day/${day}/reopen`, reopen, "c1"))
      .statusCode,
    403,
  );
  assert.equal(
    (await call("POST", `/mixed-bags/day/${day}/reopen`, reopen)).statusCode,
    201,
  );
  assert.equal((await sort(await get(another.id), 1)).statusCode, 201);
  current = await view();
  assert.equal(current.status, "OPEN");
  assert.equal(
    current.actions.find((e: any) => e.kind === "CLOSE").snapshot.production
      .sortedKg,
    preserved,
  );
  assert.notEqual(current.preview.sortedKg, preserved);
  const historical = await view("2026-01-01");
  assert.equal(
    (
      await call("POST", "/mixed-bags/day/2026-01-01/close", {
        operationId: randomUUID(),
        expectedVersion: historical.version,
        expectedFingerprint: historical.preview.fingerprint,
        notes: "Conferência histórica da produção",
      })
    ).statusCode,
    201,
  );
  const past = await prisma.mixedBagEvent.findFirstOrThrow({
    where: {
      cooperativeId: "coop-a",
      kind: "SORT",
      reversedAt: null,
      createdAt: {
        gte: new Date("2026-01-01T03:00:00Z"),
        lt: new Date("2026-01-02T03:00:00Z"),
      },
    },
  });
  assert.equal((await reverse(await get(past.bagId), past.id)).statusCode, 409);
  const hv = await view("2026-01-01");
  assert.equal(
    (
      await call("POST", "/mixed-bags/day/2026-01-01/reopen", {
        operationId: randomUUID(),
        expectedVersion: hv.version,
        notes: "Reabertura histórica para revisão",
      })
    ).statusCode,
    201,
  );
  const idle = await received(8, 0),
    old = new Date(Date.now() - 73 * 3600000);
  await prisma.mixedBag.update({
    where: { id: idle.id },
    data: { receivedAt: old },
  });
  await prisma.mixedBagEvent.updateMany({
    where: { bagId: idle.id },
    data: { createdAt: old },
  });
  const alerts = (await call("GET", "/mixed-bags/alerts?hours=48")).json();
  assert.ok(
    alerts.items.find((r: any) => r.id === idle.id && r.idleHours >= 72),
  );
  assert.equal(
    (await call("GET", "/mixed-bags/alerts?hours=48", undefined, "b")).json()
      .total,
    0,
  );
  assert.equal((await sort(await get(idle.id), 1)).statusCode, 201);
  assert.ok(
    !(await call("GET", "/mixed-bags/alerts?hours=48"))
      .json()
      .items.some((r: any) => r.id === idle.id),
  );
  assert.equal(
    (await call("GET", "/mixed-bags/alerts?hours=0")).statusCode,
    400,
  );
  assert.equal(
    (await call("GET", "/mixed-bags/day?day=2026-02-30")).statusCode,
    400,
  );
  assert.equal(
    (await call("GET", "/mixed-bags/day?day=2099-01-01")).statusCode,
    400,
  );
  const report = (
    await call("GET", `/mixed-bags/report?start=${day}&end=${day}`)
  ).json();
  assert.ok(!report.events.items.some((e: any) => e.id === id));
  assert.ok(report.production.sortedKg);
  console.log(
    "PASS: justified reversal preserves original evidence and updates balances; completed bag reopening; replay/roles/tenant isolation; used-lot and complement guards; reject reversal; closure fingerprints, day locks, immutable snapshots, reasoned reopening and historical-day guards; live stalled-bag alerts",
  );
  return { day: await view(), alerts, reverseBag: await get(another.id) };
}
