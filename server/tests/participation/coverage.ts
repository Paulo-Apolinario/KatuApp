import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { prisma } from "../../src/lib/prisma";

export async function testCoverage(app: FastifyInstance) {
  const query = "start=2026-10-01&end=2026-10-31";
  const token = (sub: string, role: string) =>
    app.jwt.sign({ sub, role, authVersion: 0 });
  const call = (path: string, auth = token("a", "COOPERATIVE")) =>
    app.inject({
      method: "GET",
      url: "/analytics/participation/coverage/" + path,
      headers: auth ? { authorization: "Bearer " + auth } : {},
    });
  const lists: Record<string, unknown> = {};
  for (const [bucket, count] of [
    ["GENERATOR", 4],
    ["PF", 1],
    ["PEV", 1],
    ["DELIVERER", 0],
    ["UNATTRIBUTED", 1],
    ["CONFLICT", 1],
  ] as const) {
    const response = await call(`${bucket}?${query}`);
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.headers["cache-control"], "private, no-store");
    const data = response.json().data;
    assert.equal(data.total, count);
    assert.equal(data.items.length, count);
    lists[bucket] = data;
  }
  await prisma.intakeDeliverer.create({
    data: {
      id: "coverage-deliverer-b",
      cooperativeId: "coop-b",
      name: "Entregador B",
      normalizedName: "entregador b",
      creationHash: "test",
      createdByUserId: "b",
      updatedByUserId: "b",
    },
  });
  await prisma.collection.create({
    data: {
      id: "coverage-direct-b",
      cooperativeId: "coop-b",
      intakeKind: "DIRECT",
      intakeDelivererId: "coverage-deliverer-b",
      status: "RECEIVED",
      createdAt: new Date("2026-10-12T15:00:00Z"),
      receivedAt: new Date("2026-10-12T16:00:00Z"),
    },
  });
  const direct = await call(`DELIVERER?${query}`, token("b", "COOPERATIVE"));
  assert.equal(direct.json().data.total, 1);
  assert.equal(direct.json().data.items[0].origin, "Entregador B");
  assert.equal(
    (await call(`DELIVERER/coverage-direct-b?${query}`)).statusCode,
    404,
  );
  const detail = await call(`GENERATOR/old1?${query}`);
  assert.equal(detail.statusCode, 200, detail.body);
  const data = detail.json().data;
  assert.equal(data.materials.length, 3);
  assert.equal(
    data.materials.find((row: any) => row.unit === "LITER").quantity,
    "80",
  );
  assert.equal(
    (await call(`PEV?${query}&profile=LARGE`)).json().data.total,
    1,
    "Coverage does not apply the participant profile filter",
  );
  assert.equal(
    (
      await call(
        `GENERATOR?${query}&city=Fortaleza&neighborhood=jos%C3%A9%20bonif%C3%A1cio`,
      )
    ).json().data.total,
    4,
  );
  assert.equal(
    (await call(`GENERATOR?${query}&search=%25`)).json().data.total,
    0,
  );
  assert.equal(
    (await call(`GENERATOR?${query}&search=old1`)).json().data.total,
    1,
  );
  assert.equal(
    (await call(`GENERATOR/old1?${query}&city=inexistente`)).statusCode,
    404,
  );
  assert.equal((await call(`PF/old1?${query}`)).statusCode, 404);
  assert.equal((await call(`GENERATOR/other-coop?${query}`)).statusCode, 404);
  assert.equal(
    (await call(`GENERATOR/old1?${query}`, token("b", "COOPERATIVE")))
      .statusCode,
    404,
  );
  assert.equal((await call(`BAD?${query}`)).statusCode, 400);
  assert.equal(
    (await call(`GENERATOR?${query}&cooperativeId=coop-b`)).statusCode,
    400,
  );
  assert.equal(
    (await call(`GENERATOR?${query}`, token("pf", "PF"))).statusCode,
    403,
  );
  assert.equal((await call(`GENERATOR?${query}`, "")).statusCode, 401);
  const conflict = (lists.CONFLICT as any).items[0];
  assert.equal(conflict.origin, "Vínculos a conferir");
  assert(!JSON.stringify(conflict).includes("foreign"));
  console.log(
    "PASS: six coverage categories reconcile with cards; materials retain liters; same geographic filters; profile-independent coverage; literal search; cross-tenant/category/filter detail blocked",
  );
  return { lists, detail: data };
}
