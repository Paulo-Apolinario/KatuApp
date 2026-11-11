import { analyticsGet } from "./access";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { prisma } from "../../src/lib/prisma";
import { participationQuery } from "../../src/modules/analytics/participation.schemas";
import { generatorsOverview } from "../../src/modules/analytics/participation.service";
import {
  collectorsOverview,
  territoryOverview,
} from "../../src/modules/analytics/dimensions.service";
import {
  recordUsage,
  usageOverview,
} from "../../src/modules/analytics/usage.service";
import { createActivityMeter as appMeter } from "../../../src/services/activityMeter";

export async function testDimensions(app: FastifyInstance) {
  const q = participationQuery.parse({
    start: "2026-10-01",
    end: "2026-10-31",
  });
  await prisma.generator.update({
    where: { id: "old" },
    data: { latitude: -3.72, longitude: -38.52 },
  });
  await prisma.generator.update({
    where: { id: "new" },
    data: { latitude: -3.74, longitude: -38.54 },
  });
  const generators = await generatorsOverview("a", q);
  assert.equal(generators.summary.active, 2);
  assert.equal(generators.summary.receipts, 4);
  assert(
    (generators.items as any[]).every((row) =>
      row.party_key.startsWith("GENERATOR:"),
    ),
  );
  const territory = await territoryOverview("a", q);
  assert.equal(
    territory.items.reduce((sum, row) => sum + Number(row.receipts), 0),
    8,
  );
  const neighborhood: any = territory.items.find(
    (row) => row.neighborhood_key === "jose bonifacio",
  );
  assert.equal(neighborhood.receipts, 4);
  assert.equal(neighborhood.located, 4);
  assert.equal(neighborhood.participants, 2);
  assert(neighborhood.latitude < -3.7 && neighborhood.longitude < -38.5);
  const first = await prisma.collector.create({
    data: {
      id: "analytics-staff",
      cooperativeId: "coop-a",
      userId: "staff",
      name: "Catador equipe",
      email: "analytics-staff@qa.invalid",
    },
  });
  const second = await prisma.collector.create({
    data: {
      id: "analytics-colleague",
      cooperativeId: "coop-a",
      name: "Catador sem conta",
      email: "analytics-colleague@qa.invalid",
    },
  });
  const foreign = await prisma.collector.create({
    data: {
      id: "analytics-foreign",
      cooperativeId: "coop-b",
      name: "Catador externo",
      email: "analytics-foreign@qa.invalid",
    },
  });
  await prisma.collection.update({
    where: { id: "old1" },
    data: { collectorId: first.id },
  });
  await prisma.collection.update({
    where: { id: "old2" },
    data: { collectorId: first.id },
  });
  await prisma.collectionParticipant.createMany({
    data: [first, second, foreign].map((row) => ({
      collectionId: "old2",
      collectorId: row.id,
      nameSnapshot: row.name,
    })),
  });
  const collectors = await collectorsOverview("a", q);
  assert.equal(collectors.summary.registered, 2);
  assert.equal(collectors.summary.active, 2);
  assert.equal(collectors.summary.receipts, 2);
  assert.equal(
    collectors.items.find((row) => row.id === first.id)?.receipts,
    2,
  );
  assert.equal(
    collectors.items.find((row) => row.id === second.id)?.receipts,
    1,
  );
  assert(!JSON.stringify(collectors).includes("Catador externo"));
  await prisma.user.create({
    data: {
      id: "analytics-gen-user",
      email: "analytics-gen-user@qa.invalid",
      passwordHash: "unused",
      displayName: "Gerador com conta",
      role: "GENERATOR_SMALL",
    },
  });
  await prisma.generator.update({
    where: { id: "old" },
    data: { userId: "analytics-gen-user" },
  });
  const now = new Date("2026-10-20T15:00:10Z");
  await recordUsage("a", { activeSeconds: 20, platform: "WEB" }, now);
  await Promise.all([
    recordUsage("a", { activeSeconds: 20, platform: "WEB" }, now),
    recordUsage("a", { activeSeconds: 30, platform: "APP" }, now),
  ]);
  await recordUsage(
    "a",
    { activeSeconds: 10, platform: "WEB" },
    new Date(now.getTime() + 30000),
  );
  await recordUsage("staff", { activeSeconds: 15, platform: "APP" }, now);
  await recordUsage(
    "analytics-gen-user",
    { activeSeconds: 5, platform: "APP" },
    now,
  );
  await recordUsage("b", { activeSeconds: 29, platform: "WEB" }, now);
  assert.equal(
    (await recordUsage("pf", { activeSeconds: 30, platform: "APP" }, now))
      .recorded,
    false,
  );
  const usage = await usageOverview("a", q);
  assert.equal(usage.summary.accounts, 3);
  assert.equal(usage.summary.measured_accounts, 3);
  assert.equal(usage.summary.seconds, 60);
  const owner = usage.items.find((row) => row.id === "a")!;
  assert.equal(owner.seconds, 40);
  assert.equal(owner.app_used, true);
  assert.equal(owner.web_used, true);
  assert(!usage.items.some((row) => row.id === "b"));
  const empty = await usageOverview(
    "a",
    participationQuery.parse({ start: "2026-09-01", end: "2026-09-30" }),
  );
  assert.equal(empty.summary.measured_accounts, 0);
  assert(empty.items.every((row) => row.last_seen === null));
  const token = (id: string, role: string) =>
    app.jwt.sign({ sub: id, role, authVersion: 0 });
  const call = (path: string, auth = token("a", "COOPERATIVE")) =>
    analyticsGet(app, "/analytics/participation/" + path + "?start=2026-10-01&end=2026-10-31", auth);
  for (const name of ["generators", "collectors", "territory", "usage"]) {
    assert.equal((await call(name)).statusCode, 200);
    assert.equal((await call(name, token("pf", "PF"))).statusCode, 403);
  }
  const beat = (body: unknown, auth = token("a", "COOPERATIVE")) =>
    app.inject({
      method: "POST",
      url: "/analytics/usage/heartbeat",
      headers: { authorization: "Bearer " + auth },
      payload: body as any,
    });
  assert.equal(
    (await beat({ activeSeconds: 31, platform: "WEB" })).statusCode,
    400,
  );
  assert.equal(
    (
      await beat({
        activeSeconds: 20,
        platform: "WEB",
        cooperativeId: "coop-b",
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await beat(
        { activeSeconds: 1, platform: "APP" },
        token("staff", "COLLECTOR"),
      )
    ).statusCode,
    200,
  );
  for (const factory of [appMeter]) {
    let clock = 0;
    const meter = factory(() => clock);
    meter.setVisible(true);
    for (let i = 0; i < 30; i++) {
      clock += 1000;
      meter.tick();
    }
    assert.equal(meter.drain(), 30);
    for (let i = 0; i < 100; i++) {
      clock += 1000;
      meter.tick();
    }
    assert.equal(meter.drain(), 30);
    clock += 30000;
    meter.tick();
    assert.equal(meter.drain(), 0);
    meter.touch();
    meter.setVisible(false);
    clock += 30000;
    meter.tick();
    assert.equal(meter.drain(), 0);
    meter.setVisible(true);
    for (let i = 0; i < 5; i++) {
      clock += 1000;
      meter.tick();
    }
    assert.equal(meter.drain(), 5);
  }
  console.log(
    "PASS: generator/territory scopes; team membership without leader double-count; daily usage tenant isolation, concurrent-tab dedup, strict body; app idle and foreground clock",
  );
  return { generators, territory, collectors, usage };
}
