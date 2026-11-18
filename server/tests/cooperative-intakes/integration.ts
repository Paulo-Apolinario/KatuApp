import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../src/lib/prisma";
import { buildApp } from "../../src/app";
import { relations } from "../../src/modules/analytics/participation.service";
import { participationQuery, civilDay } from "../../src/modules/analytics/participation.schemas";
async function main() {
  const url = new URL(process.env.DATABASE_URL || "");
  if (url.hostname !== "127.0.0.1" || url.port !== "54347" || process.env.KATUA_INTAKES_TEST !== "1") throw Error("Somente banco descartável local.");
  const app = await buildApp();
  try {
    for (const id of ["a", "b"]) {
      await prisma.user.create({ data: { id, email: id + "@qa.invalid", passwordHash: "unused", displayName: id, role: "COOPERATIVE" } });
      await prisma.cooperative.create({ data: { id: "coop-" + id, userId: id, name: id } });
      await prisma.generator.create({ data: { id: "gen-" + id, cooperativeId: "coop-" + id, name: "Gerador " + id, type: "SMALL", address: "Rua da Origem, 123", phone: "85999991111" } });
    }
    await prisma.user.create({ data: { id: "cat", email: "cat@qa.invalid", passwordHash: "unused", displayName: "Catador", role: "COLLECTOR" } });
    await prisma.collector.create({ data: { id: "collector", userId: "cat", cooperativeId: "coop-a", name: "Catador" } });
    await prisma.wasteStockItem.create({ data: { id: "paper", cooperativeId: "coop-a", name: "Papelão", category: "Papel", unit: "KG", defaultUnit: "KG" } });
    await prisma.wasteStockItem.create({ data: { id: "oil", cooperativeId: "coop-a", name: "Óleo", category: "Óleo", unit: "LITER", defaultUnit: "LITER" } });
    const call = async (method: "GET" | "POST", url: string, payload?: any, status = 200, who = "a") => {
      const r = await app.inject({ method, url, payload, headers: { authorization: "Bearer " + app.jwt.sign({ sub: who, role: who === "cat" ? "COLLECTOR" : "COOPERATIVE", authVersion: 0 }) } });
      assert.equal(r.statusCode, status, r.body); return r.json();
    };
    const direct = { operationId: randomUUID(), kind: "DIRECT", generatorId: "gen-a", origin: { name: "Não confiar neste nome" } };
    const c = (await call("POST", "/material-intakes", direct, 201)).collection;
    assert.equal(c.generatorId, "gen-a"); assert.equal(c.intakeOrigin.name, "Gerador a"); assert.equal(c.intakeOrigin.address, "Rua da Origem, 123"); assert.equal(c.status, "RECEIVED"); assert(c.receivedAt); assert.equal(c.collectorId, null); assert.equal(c.intakeDelivererId, null);
    assert.equal((await call("POST", "/material-intakes", direct, 201)).collection.id, c.id);
    await call("POST", "/material-intakes", { ...direct, notes: "Alteração" }, 409);
    await call("POST", "/material-intakes", { ...direct, operationId: randomUUID(), generatorId: "gen-b" }, 404);
    await call("POST", "/material-intakes", { ...direct, operationId: randomUUID() }, 404, "b");
    await call("POST", "/material-intakes", { ...direct, operationId: randomUUID() }, 403, "cat");
    await call("POST", "/material-intakes", { ...direct, operationId: randomUUID(), delivererId: randomUUID() }, 400);
    const person = (await prisma.intakeDeliverer.create({ data: { id: randomUUID(), cooperativeId: "coop-a", name: "Entregador avulso", normalizedName: "entregador avulso", creationHash: "qa", createdByUserId: "a", updatedByUserId: "a" } }));
    const avulso = (await call("POST", "/material-intakes", { operationId: randomUUID(), kind: "DIRECT", delivererId: person.id, origin: {} }, 201)).collection;
    assert.equal(avulso.intakeDelivererId, person.id); assert.equal(avulso.generatorId, null);
    const anonymous = (await call("POST", "/material-intakes", { operationId: randomUUID(), kind: "DIRECT", origin: {} }, 201)).collection;
    const pickupBody = { operationId: randomUUID(), kind: "PICKUP", performedByCooperative: true, generatorId: "gen-a", origin: { address: "Rua da retirada, 45" } };
    const pickup = (await call("POST", "/material-intakes", pickupBody, 201)).collection;
    assert.equal(pickup.status, "COLLECTED"); assert(pickup.collectedAt); assert.equal(pickup.receivedAt, null); assert.equal(pickup.collectorId, null); assert.equal(pickup.intakeOrigin.performedBy, "COOPERATIVE"); assert.equal(pickup.intakeOrigin.registeredByUserId, "a");
    assert.equal((await call("POST", "/material-intakes", pickupBody, 201)).collection.id, pickup.id);
    await call("POST", "/material-intakes", { ...pickupBody, operationId: randomUUID(), collectorId: "collector" }, 400);
    await call("POST", "/material-intakes", { ...direct, operationId: randomUUID(), performedByCooperative: true }, 400);
    await call("POST", "/material-intakes", { ...pickupBody, operationId: randomUUID(), origin: {} }, 400);
    await call("POST", `/material-intakes/${pickup.id}/weigh`, { operationId: randomUUID(), materials: [{ wasteTypeId: "paper", quantity: 30, unit: "KG" }] }, 409);
    await call("POST", `/material-intakes/${pickup.id}/arrive`, {}, 404, "b");
    assert.equal((await call("POST", `/material-intakes/${pickup.id}/arrive`, {})).collection.status, "RECEIVED");
    const weighing = { operationId: randomUUID(), materials: [{ wasteTypeId: "paper", quantity: 30, unit: "KG" }, { wasteTypeId: "oil", quantity: 10, unit: "LITER" }] };
    await call("POST", `/material-intakes/${pickup.id}/weigh`, weighing);
    await call("POST", `/material-intakes/${pickup.id}/weigh`, weighing);
    assert.equal(await prisma.collectionMaterial.count({ where: { collectionId: pickup.id } }), 2);
    assert.equal(Number((await prisma.collection.findUniqueOrThrow({ where: { id: pickup.id } })).totalWeightKg), 30);
    assert.equal(Number((await prisma.generator.findUniqueOrThrow({ where: { id: "gen-a" } })).totalKg), 30);
    const directWeighing = { operationId: randomUUID(), materials: [{ wasteTypeId: "paper", quantity: 12, unit: "KG" }] };
    await call("POST", `/material-intakes/${c.id}/weigh`, directWeighing);
    await call("POST", `/material-intakes/${c.id}/weigh`, directWeighing);
    assert.equal(Number((await prisma.generator.findUniqueOrThrow({ where: { id: "gen-a" } })).totalKg), 42);
    const scheduled = (await call("POST", "/material-intakes", { operationId: randomUUID(), kind: "PICKUP", origin: { address: "Rua avulsa, 55" } }, 201)).collection;
    assert.equal(scheduled.status, "PENDING"); assert.equal(scheduled.collectedAt, null);
    assert.equal(Number((await prisma.collector.findUniqueOrThrow({ where: { id: "collector" } })).totalKg), 0);
    assert.equal((await call("GET", "/cooperative-field/generators/gen-a")).collections.filter((v: any) => [c.id, pickup.id].includes(v.id)).length, 2);
    assert.equal((await call("GET", "/material-intakes", undefined, 200, "b")).pagination.total, 0);
    const now = new Date(), q = participationQuery.parse({ start: civilDay(now), end: civilDay(now) });
    const buckets = await prisma.$queryRaw<any[]>(Prisma.sql`${relations("coop-a", q, now)} SELECT id,bucket FROM operations WHERE id IN (${c.id},${pickup.id},${avulso.id},${anonymous.id})`);
    assert.equal(buckets.find(v => v.id === c.id)?.bucket, "GENERATOR"); assert.equal(buckets.find(v => v.id === pickup.id)?.bucket, "GENERATOR"); assert.equal(buckets.find(v => v.id === avulso.id)?.bucket, "DELIVERER"); assert.equal(buckets.find(v => v.id === anonymous.id)?.bucket, "UNATTRIBUTED");
    // Ambiguous historical links must still be flagged, never silently attributed.
    await prisma.collection.update({ where: { id: anonymous.id }, data: { generatorId: "gen-a", intakeDelivererId: person.id } });
    const conflicts = await prisma.$queryRaw<any[]>(Prisma.sql`${relations("coop-a", q, new Date())} SELECT bucket FROM operations WHERE id=${anonymous.id}`);
    assert.equal(conflicts[0].bucket, "CONFLICT");
    console.log("PASS: generator delivery, tenant isolation, permissions, avulso compatibility, cooperative pickup, arrival, idempotency, kg/liters, history and analytics");
  } finally { await app.close(); await prisma.$disconnect(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
