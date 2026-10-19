import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { prisma } from "../src/lib/prisma";
import { vehicleRoutes } from "../src/modules/vehicles/vehicle.routes";
import { routeRoutes } from "../src/modules/routes/route.routes";

// Teste de contrato com persistência simulada. Não substitui integração PostgreSQL.
test("contratos de edição, permissões, isolamento e rollback", async (t) => {
  let vehicle: any = { id: "v1", cooperativeId: "c1", driverId: "d1", plate: "ABC1234", model: "Antigo", status: "ACTIVE", brand: "Marca", year: 2020, capacityKg: 100 };
  let route: any = { id: "r1", cooperativeId: "c1", driverId: "d1", vehicleId: "v1", name: "Rota", description: "Antes", scheduledDate: new Date(), stops: ["Rua A, 123"], status: "SCHEDULED" };
  let collections: any[] = [{ id: "p", routeId: "r1", cooperativeId: "c1", status: "PENDING", driverId: "d1", vehicleId: "v1" }, { id: "h", routeId: "r1", cooperativeId: "c1", status: "COLLECTED", driverId: "d1", vehicleId: "v1" }];
  let failCollections = false;
  let concurrentWrite = false;
  const restores: Array<() => void> = [];
  const patch = (obj: any, key: string, fn: any) => { const before = obj[key]; obj[key] = fn; restores.push(() => { obj[key] = before; }); };
  const matches = (row: any, where: any) => Object.entries(where).every(([key, value]) => typeof value === "object" && value !== null
    ? (value as any).in ? (value as any).in.includes(row[key]) : !(value as any).notIn.includes(row[key])
    : row[key] === value);
  const apply = (row: any, data: any) => ({ ...row, ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) });
  const withDriver = () => ({ ...vehicle, driver: vehicle.driverId ? { id: vehicle.driverId, name: "Motorista", status: "AVAILABLE" } : null });
  patch(prisma.cooperative, "findUnique", async ({ where }: any) => ({ id: where.userId === "other" ? "c2" : "c1" }));
  patch(prisma.driver, "findFirst", async ({ where }: any) => ["d1", "d2"].includes(where.id) && where.cooperativeId === "c1" ? { id: where.id } : null);
  patch(prisma.vehicle, "findFirst", async ({ where }: any) => matches(vehicle, where) ? withDriver() : null);
  patch(prisma.vehicle, "update", async ({ data }: any) => { if (data.plate === "DUP1234") throw { code: "P2002" }; vehicle = apply(vehicle, data); return withDriver(); });
  patch(prisma.route, "findFirst", async ({ where }: any) => matches(route, where) ? { ...route } : null);
  patch(prisma.route, "update", async ({ data }: any) => { route = apply(route, data); return { ...route }; });
  patch(prisma.collection, "findMany", async ({ where }: any) => collections.filter((row) => matches(row, where)));
  patch(prisma.collection, "count", async ({ where }: any) => collections.filter((row) => matches(row, where)).length);
  patch(prisma.collection, "updateMany", async ({ where, data }: any) => { if (failCollections) throw new Error("Falha simulada"); collections = collections.map((row) => matches(row, where) ? apply(row, data) : row); return { count: 1 }; });
  patch(prisma, "$transaction", async (fn: any, options: any) => {
    assert.equal(options.isolationLevel, "Serializable");
    if (concurrentWrite) throw { code: "P2034" };
    const before = structuredClone({ vehicle, route, collections });
    try { return await fn(prisma); } catch (error) { ({ vehicle, route, collections } = before); throw error; }
  });
  const app = Fastify();
  app.decorate("authenticate", async (request: any) => { request.user = { sub: request.headers["x-user"] || "owner", role: request.headers["x-role"] || "COOPERATIVE" }; });
  await app.register(vehicleRoutes, { prefix: "/vehicles" });
  await app.register(routeRoutes, { prefix: "/routes" });
  t.after(async () => { await app.close(); restores.reverse().forEach((restore) => restore()); await prisma.$disconnect(); });
  const request = (url: string, payload: any, headers = {}) => app.inject({ method: "PATCH", url, payload, headers });

  await t.test("veículo: todos os campos persistem em nova consulta e motorista pode ser removido", async () => {
    const result = await request("/vehicles/v1", { plate: "xyz-5678", model: "Novo", brand: null, year: null, capacityKg: 250, driverId: null, status: "MAINTENANCE" });
    assert.equal(result.statusCode, 200);
    const reloaded = (await app.inject("/vehicles/v1")).json().vehicle;
    assert.deepEqual([reloaded.plate, reloaded.model, reloaded.brand, reloaded.year, reloaded.capacityKg, reloaded.driverId, reloaded.driver, reloaded.status], ["XYZ5678", "Novo", null, null, 250, null, null, "MAINTENANCE"]);
  });
  await t.test("veículo: omissão preserva valores; validações, isolamento e perfil rejeitam gravação", async () => {
    assert.equal((await request("/vehicles/v1", { driverId: "d1" })).statusCode, 200);
    assert.equal((await app.inject("/vehicles/v1")).json().vehicle.driver.name, "Motorista");
    assert.equal(vehicle.model, "Novo");
    for (const payload of [{ plate: "---" }, { capacityKg: -1 }, { year: 1800 }, { driverId: "foreign" }, {}]) assert.equal((await request("/vehicles/v1", payload)).statusCode, 400);
    assert.equal((await request("/vehicles/v1", { model: "Outro" }, { "x-user": "other" })).statusCode, 400);
    assert.equal((await request("/vehicles/v1", { model: "Outro" }, { "x-role": "DRIVER" })).statusCode, 403);
    assert.equal((await request("/vehicles/v1", { plate: "DUP1234" })).statusCode, 409);
    assert.equal(vehicle.model, "Novo");
  });
  await t.test("rota: PATCH persiste status e null sem apagar paradas omitidas", async () => {
    const result = await request("/routes/r1", { status: "IN_PROGRESS", description: null, scheduledDate: null });
    assert.equal(result.statusCode, 200);
    const reloaded = (await app.inject("/routes/r1")).json().route;
    assert.deepEqual([reloaded.status, reloaded.description, reloaded.scheduledDate, reloaded.stops], ["IN_PROGRESS", null, null, ["Rua A, 123"]]);
    assert.equal((await request("/routes/r1", { scheduledDate: "31/02/2026" })).statusCode, 400);
  });
  await t.test("rota: alteração parcial valida o par final; isolamento e perfil", async () => {
    assert.equal((await request("/routes/r1", { driverId: "d2" })).statusCode, 400);
    assert.equal((await request("/routes/r1", { name: "Outra" }, { "x-user": "other" })).statusCode, 400);
    assert.equal((await request("/routes/r1", { name: "Outra" }, { "x-role": "DRIVER" })).statusCode, 403);
    assert.equal((await request("/routes/r1", { vehicleId: "foreign" })).statusCode, 400);
    assert.equal((await request("/routes/r1", { unexpected: true })).statusCode, 400);
    assert.equal(route.driverId, "d1");
  });
  await t.test("rota: falha nas coletas desfaz rota; êxito preserva atribuição histórica", async () => {
    failCollections = true;
    assert.equal((await request("/routes/r1", { driverId: null, vehicleId: null, name: "Não persistir" })).statusCode, 400);
    assert.equal(route.driverId, "d1"); assert.equal(route.name, "Rota");
    failCollections = false;
    assert.equal((await request("/routes/r1", { driverId: null, vehicleId: null, stops: [] })).statusCode, 200);
    assert.equal(collections[0].driverId, null); assert.equal(collections[1].driverId, "d1");
    assert.deepEqual((await app.inject("/routes/r1")).json().route.stops, []);
  });
  await t.test("conflito de serialização retorna 409 sem apresentar confirmação de gravação", async () => {
    concurrentWrite = true;
    assert.equal((await request("/routes/r1", { name: "Concorrente" })).statusCode, 409);
    assert.equal((await request("/routes/r1/status", { status: "COMPLETED" })).statusCode, 409);
    assert.equal((await request("/vehicles/v1", { model: "Concorrente" })).statusCode, 409);
    assert.equal((await request("/vehicles/v1/status", { status: "INACTIVE" })).statusCode, 409);
    assert.equal(route.name, "Rota"); assert.equal(vehicle.model, "Novo");
    concurrentWrite = false;
  });
  await t.test("status dedicado mantém a mesma regra de cancelamento e atomicidade", async () => {
    assert.equal((await request("/routes/r1/status", { status: "CANCELLED" })).statusCode, 400);
    assert.equal(route.status, "IN_PROGRESS");
  });
});
