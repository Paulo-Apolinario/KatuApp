import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { prisma } from "../../src/lib/prisma";
import { participationAttendance } from "../../src/modules/analytics/attendance.service";
import { participationQuery } from "../../src/modules/analytics/participation.schemas";

export async function testAttendance(app: FastifyInstance) {
  await prisma.user.create({
    data: {
      id: "attendance-owner",
      email: "attendance@qa.invalid",
      passwordHash: "unused",
      displayName: "Atendimento QA",
      role: "COOPERATIVE",
    },
  });
  const coop = await prisma.cooperative.create({
    data: {
      id: "attendance-coop",
      userId: "attendance-owner",
      name: "Atendimento QA",
    },
  });
  const collector = await prisma.collector.create({
    data: {
      cooperativeId: coop.id,
      name: "Catador QA",
      email: "collector-attendance@qa.invalid",
    },
  });
  const stamp = (day: string) => new Date(day + "T15:00:00Z");
  const now = stamp("2026-11-01");
  const q = participationQuery.parse({
    start: "2026-10-01",
    end: "2026-10-31",
  });
  for (const [id, day, status] of [
    ["older", "2026-10-01", "REQUESTED"],
    ["week", "2026-10-25", "SCHEDULED"],
    ["recent", "2026-10-31", "REQUESTED"],
    ["received", "2026-10-14", "REQUESTED"],
    ["retro", "2026-10-03", "COMPLETED"],
    ["closed", "2026-10-10", "CANCELLED"],
  ] as const)
    await prisma.schedule.create({
      data: {
        id: "att-" + id,
        cooperativeId: coop.id,
        requestedByUserId: "a",
        createdAt: stamp(day),
        status,
        scheduledDate: stamp("2026-12-01"),
      },
    });
  for (const [id, day] of [
    ["received", "2026-10-15"],
    ["retro", "2026-10-02"],
  ] as const)
    await prisma.collection.create({
      data: {
        id: "att-collection-" + id,
        cooperativeId: coop.id,
        scheduleId: "att-" + id,
        status: "RECEIVED",
        receivedAt: stamp(day),
        createdAt: stamp("2026-10-01"),
      },
    });
  // Outside the selected creation dates, including the exact local end boundary.
  await prisma.schedule.create({
    data: {
      cooperativeId: coop.id,
      requestedByUserId: "a",
      createdAt: new Date("2026-11-01T03:00:00Z"),
    },
  });
  const extra = (
    id: string,
    status: string,
    day: string,
    rest: Record<string, unknown> = {},
  ) =>
    prisma.extraCollectionOrder.create({
      data: {
        id,
        cooperativeId: coop.id,
        collectorId: collector.id,
        status,
        createdAt: stamp(day),
        originalHash: "test",
        payload: {},
        reporterUserId: "staff",
        reporterName: "QA",
        custody: "COLLECTOR",
        custodyNotes: "",
        ...rest,
      } as any,
    });
  await extra("att-extra-review", "PENDING_REVIEW", "2026-10-01");
  await extra("att-extra-info", "NEEDS_INFO", "2026-10-31");
  await extra("att-extra-accepted", "ACCEPTED", "2026-10-14", {
    collectionId: "att-collection-received",
  });
  await extra("att-extra-foreign", "ACCEPTED", "2026-10-20", {
    collectionId: "old1",
  });
  await extra("att-extra-unknown", "UNRECOGNIZED", "2026-10-20");
  const bin = await prisma.bin.create({
    data: { cooperativeId: coop.id, binId: "ATT-PEV" },
  });
  const other = await prisma.bin.create({
    data: { cooperativeId: "coop-b", binId: "OTHER-ATT-PEV" },
  });
  for (const [index, status] of [
    "OPEN",
    "ASSIGNED",
    "RESOLVED",
    "DISMISSED",
    "OPEN",
  ].entries())
    await prisma.pevRequest.create({
      data: {
        id: `att-pev-${index}`,
        cooperativeId: coop.id,
        binId: index === 4 ? other.id : bin.id,
        requesterUserId: "pf",
        requesterRole: "PF",
        requesterName: "QA",
        binName: "QA",
        address: "",
        condition: "FULL",
        notes: "",
        photos: [],
        status,
        collectionId: index < 2 ? "att-collection-received" : null,
        createdAt: stamp("2026-10-25"),
      },
    });
  await prisma.schedule.create({
    data: {
      id: "att-closed-unreceived",
      cooperativeId: coop.id,
      requestedByUserId: "a",
      status: "COMPLETED",
      createdAt: stamp("2026-10-10"),
    },
  });
  await prisma.schedule.create({
    data: {
      id: "att-missing-date",
      cooperativeId: coop.id,
      requestedByUserId: "a",
      status: "COMPLETED",
      createdAt: stamp("2026-10-10"),
    },
  });
  await prisma.collection.create({
    data: {
      cooperativeId: coop.id,
      scheduleId: "att-missing-date",
      status: "RECEIVED",
      createdAt: stamp("2026-10-10"),
    },
  });
  const result = await participationAttendance("attendance-owner", q, now);
  assert.deepEqual(result.reconciliation, {
    total: 8,
    received: 2,
    pending: 3,
    cancelled: 1,
    closed_without_receipt: 1,
    needs_check: 1,
  });
  const schedule = result.channels.find((row) => row.channel === "SCHEDULE")!;
  assert.equal(schedule.total, 8);
  assert.equal(schedule.received, 2);
  assert.equal(schedule.pending, 3);
  assert.equal(schedule.pending_under7, 1);
  assert.equal(schedule.pending_7to29, 1);
  assert.equal(schedule.pending_30plus, 1);
  assert.equal(schedule.linked, 1);
  assert.equal(schedule.median_hours, 24);
  assert.equal(schedule.duration_sample, 1);
  assert.equal(schedule.retrospective, 1);
  const orders = result.channels.find((row) => row.channel === "EXTRA")!;
  assert.equal(orders.total, 5);
  assert.equal(orders.pending, 2);
  assert.equal(orders.linked, 1);
  assert.equal(orders.received, 1);
  assert.equal(orders.invalid_links, 1);
  assert.equal(
    orders.statuses.reduce((sum, row) => sum + row.count, 0),
    orders.total,
  );
  const pevs = result.channels.find((row) => row.channel === "PEV")!;
  assert.equal(pevs.total, 5);
  assert.equal(pevs.pending, 3);
  assert.equal(pevs.received, 0);
  assert.equal(pevs.median_hours, null);
  assert.equal(pevs.linked, 2);
  assert.equal(pevs.invalid_links, 1);
  for (const row of result.channels)
    assert.equal(
      Number(row.pending_under7) +
        Number(row.pending_7to29) +
        Number(row.pending_30plus),
      row.pending,
    );
  const empty = await participationAttendance("b", q, now);
  assert(
    empty.channels.every((row) => row.total === 0 && row.median_hours === null),
  );
  const token = app.jwt.sign({
    sub: "attendance-owner",
    role: "COOPERATIVE",
    authVersion: 0,
  });
  const path =
    "/analytics/participation/attendance?start=2026-10-01&end=2026-10-31";
  const call = (suffix = "", auth = token) =>
    app.inject({
      method: "GET",
      url: path + suffix,
      headers: auth ? { authorization: "Bearer " + auth } : {},
    });
  const response = await call();
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.headers["cache-control"], "private, no-store");
  assert.equal((await call("&city=fortaleza")).statusCode, 400);
  assert.equal((await call("&cooperativeId=coop-b")).statusCode, 400);
  assert.equal((await call("", "")).statusCode, 401);
  assert.equal(
    (await call("", app.jwt.sign({ sub: "pf", role: "PF", authVersion: 0 })))
      .statusCode,
    403,
  );
  console.log(
    "PASS: attendance populations, shared links without additive totals, request age boundaries, future appointments, median with retrospective exclusion, PEV notices, invalid links, auth and tenant isolation",
  );
  return response.json().data;
}
