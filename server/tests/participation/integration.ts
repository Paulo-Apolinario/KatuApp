import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { prisma } from "../../src/lib/prisma";
import { buildApp } from "../../src/app";
import {
  participationOverview,
  participationDetail,
} from "../../src/modules/analytics/participation.service";
import { participationQuery } from "../../src/modules/analytics/participation.schemas";
import { testAttendance } from "./attendance";

async function main() {
  const url = new URL(process.env.DATABASE_URL || "");
  if (
    url.hostname !== "127.0.0.1" ||
    url.port !== "54339" ||
    process.env.KATUA_PARTICIPATION_TEST !== "1"
  )
    throw Error("Somente banco descartável local.");
  const app = await buildApp();
  try {
    for (const [id, role] of [
      ["a", "COOPERATIVE"],
      ["b", "COOPERATIVE"],
      ["pf", "PF"],
      ["staff", "COLLECTOR"],
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
    for (const [id, coop, type] of [
      ["old", "a", "SMALL"],
      ["new", "a", "LARGE"],
      ["foreign", "b", "SMALL"],
    ] as const)
      await prisma.generator.create({
        data: {
          id,
          cooperativeId: `coop-${coop}`,
          email: `${id}@qa.invalid`,
          name: id,
          type,
          city: " Fortaleza ",
          state: "CE",
          neighborhood: "José  Bonifácio",
        },
      });
    const stamp = (day: string) => new Date(`${day}T15:00:00Z`);
    const q = participationQuery.parse({
      start: "2026-10-01",
      end: "2026-10-31",
    });
    const now = stamp("2026-11-10");
    const collection = async (
      id: string,
      date: Date | null,
      extra: Record<string, unknown> = {},
    ) =>
      prisma.collection.create({
        data: {
          id,
          cooperativeId: "coop-a",
          generatorId: "old",
          status: "RECEIVED",
          createdAt: stamp("2026-08-01"),
          receivedAt: date,
          ...extra,
        } as any,
      });
    await collection("history", stamp("2026-09-01"));
    await collection("old1", stamp("2026-10-25"));
    await collection("old2", stamp("2026-10-31"));
    await collection("boundary", new Date("2026-11-01T02:59:59Z")); // Still October in Fortaleza.
    await collection("excluded-boundary", new Date("2026-11-01T03:00:00Z"));
    await collection("new1", stamp("2026-10-15"), { generatorId: "new" });
    await prisma.collectionMaterial.createMany({
      data: [
        { collectionId: "old1", nameSnapshot: "Papel", quantity: 10 },
        { collectionId: "old1", nameSnapshot: "Plástico", quantity: 20 },
        {
          collectionId: "old1",
          nameSnapshot: "Óleo",
          quantity: 80,
          unit: "LITER",
        },
      ],
    });
    const pfSchedule = await prisma.schedule.create({
      data: {
        cooperativeId: "coop-a",
        requestedByUserId: "pf",
        createdAt: stamp("2026-10-02"),
      },
    });
    await collection("pf1", stamp("2026-10-02"), {
      generatorId: null,
      scheduleId: pfSchedule.id,
    });
    const staffSchedule = await prisma.schedule.create({
      data: {
        cooperativeId: "coop-a",
        requestedByUserId: "staff",
        createdAt: stamp("2026-10-02"),
      },
    });
    await collection("anonymous", stamp("2026-10-02"), {
      generatorId: null,
      scheduleId: staffSchedule.id,
    });
    const pev = await prisma.bin.create({
      data: { cooperativeId: "coop-a", binId: "PEV-1", city: "Fortaleza" },
    });
    await collection("pev1", stamp("2026-10-05"), {
      generatorId: null,
      binId: pev.id,
    });
    await collection("null-date", null);
    await collection("future", stamp("2026-12-05"));
    await collection("collected-only", stamp("2026-10-05"), {
      status: "COLLECTED",
    });
    await collection("bad-tenant", stamp("2026-10-05"), {
      generatorId: "foreign",
    });
    await collection("other-coop", stamp("2026-10-05"), {
      cooperativeId: "coop-b",
      generatorId: "foreign",
    });
    await prisma.schedule.create({
      data: {
        cooperativeId: "coop-a",
        requestedByUserId: "a",
        generatorId: "new",
        createdAt: stamp("2026-10-22"),
        scheduledDate: stamp("2026-12-05"),
      },
    });
    const later = await prisma.schedule.create({
      data: {
        cooperativeId: "coop-a",
        requestedByUserId: "a",
        generatorId: "old",
        createdAt: stamp("2026-10-22"),
      },
    });
    await collection("received-after-period", stamp("2026-11-03"), {
      scheduleId: later.id,
    });
    const overview = await participationOverview("a", q, now);
    assert.deepEqual(overview.summary, {
      active: 3,
      first_registered: 2,
      returning: 1,
      participations: 5,
      repeated: 1,
      open_requests: 1,
    });
    assert.equal(
      overview.series.reduce((n: any, row: any) => n + row.operations, 0),
      5,
    );
    assert.equal(
      (overview.coverage as any[]).reduce((n, row) => n + row.count, 0),
      8,
    );
    assert.equal(overview.quality.missing_received_date, 1);
    assert.deepEqual(overview.coverageTotals, { received: 8, identified: 5 });
    assert.equal(overview.quality.future_received_date, 1);
    assert.equal(overview.quality.conflicting_relations, 1);
    assert.equal(overview.quality.request_status_mismatch, 3);
    console.log(
      "PASS: no material duplication, receipt eligibility, local midnight, origin coverage, open requests use current receipt",
    );
    const detail = await participationDetail("a", q, "GENERATOR", "old", now);
    assert.equal(detail.person.days7, 3);
    assert.equal(detail.person.recency_days, 0);
    assert.equal((detail.regularity as any).dates, 3);
    assert.equal((detail.regularity as any).median_days, 30);
    const pfDetail = await participationDetail("a", q, "PF", "pf", now);
    assert.equal(
      pfDetail.timeline instanceof Array && pfDetail.timeline.length,
      1,
    );
    assert.equal((pfDetail.regularity as any).median_days, null);
    const filtered = await participationOverview(
      "a",
      participationQuery.parse({
        ...q,
        city: "FORTALEZA",
        neighborhood: "jose bonifacio",
        profile: "SMALL",
      }),
      now,
    );
    assert.equal(filtered.summary.participations, 3);
    assert.equal(filtered.summary.returning, 1);
    const empty = await participationOverview(
      "a",
      participationQuery.parse({ ...q, city: "inexistente" }),
      now,
    );
    assert.equal(empty.summary.active, 0);
    console.log(
      "PASS: whole-history recurrence, 7-day inclusive window, regularity threshold, normalized filters and empty data",
    );
    const token = (id: string, role: string) =>
      app.jwt.sign({ sub: id, role, authVersion: 0 });
    const call = (path: string, auth = token("a", "COOPERATIVE")) =>
      app.inject({
        method: "GET",
        url: `/analytics/participation/${path}`,
        headers: auth ? { authorization: `Bearer ${auth}` } : {},
      });
    const query = new URLSearchParams({
      start: q.start,
      end: q.end,
    }).toString();
    assert.equal((await call(`overview?${query}`, "")).statusCode, 401);
    assert.equal(
      (await call(`overview?${query}`, token("pf", "PF"))).statusCode,
      403,
    );
    assert.equal(
      (await call(`overview?${query}&cooperativeId=coop-b`)).statusCode,
      400,
    );
    assert.equal(
      (await call(`overview?start=2026-02-30&end=2026-10-01`)).statusCode,
      400,
    );
    assert.equal(
      (await call(`overview?start=2025-01-01&end=2026-10-01`)).statusCode,
      400,
    );
    assert.equal(
      (await call(`participants/GENERATOR/foreign?${query}`)).statusCode,
      404,
    );
    const response = await call(`overview?${query}`);
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.headers["cache-control"], "private, no-store");
    const b = await call(`overview?${query}`, token("b", "COOPERATIVE"));
    assert.equal(b.json().data.summary.active, 1);
    assert.equal(b.json().data.summary.participations, 1);
    const page = await call(`participants?${query}&pageSize=5&search=new`);
    assert.equal(page.json().data.total, 1);
    assert.equal(page.json().data.items[0].name, "new");
    assert.equal(
      (await call(`participants?${query}&search=%25`)).json().data.total,
      0,
    );
    const attendance = await testAttendance(app);
    if (process.env.KATUA_ANALYTICS_FIXTURE) {
      const context = await call("context");
      writeFileSync(
        process.env.KATUA_ANALYTICS_FIXTURE,
        JSON.stringify({
          overview: response.json().data,
          context: context.json().data,
          detail: await participationDetail("a", q, "GENERATOR", "old"),
          participants: response.json().data.participants,
          attendance,
        }),
      );
    }
    await prisma.generator.createMany({
      data: Array.from({ length: 6 }, (_, i) => ({
        id: `page-${i}`,
        cooperativeId: "coop-a",
        email: `page-${i}@qa.invalid`,
        name: `Página ${i}`,
        type: "SMALL" as const,
      })),
    });
    await prisma.schedule.createMany({
      data: Array.from({ length: 6 }, (_, i) => ({
        cooperativeId: "coop-a",
        generatorId: `page-${i}`,
        requestedByUserId: "a",
        createdAt: stamp("2026-10-20"),
      })),
    });
    const secondPage = await call(`participants?${query}&pageSize=5&page=2`);
    assert.equal(secondPage.json().data.total, 9);
    assert.equal(secondPage.json().data.items.length, 4);
    await prisma.collection.createMany({
      data: Array.from({ length: 501 }, (_, i) => ({
        id: `volume-${i}`,
        cooperativeId: "coop-a",
        generatorId: "old",
        status: "RECEIVED" as const,
        receivedAt: stamp("2026-10-10"),
        createdAt: stamp("2026-10-10"),
      })),
    });
    const full = await participationOverview("a", q, now);
    assert.equal(full.summary.participations, 506);
    assert.equal(full.summary.active, 3);
    console.log(
      "PASS: full aggregate totals remain independent of page size, request-only identities and 501 additional receipts",
    );
    console.log(
      "PASS: authenticated API, cooperative isolation, cross-tenant 404, strict queries, pagination, literal search and no-store",
    );
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
