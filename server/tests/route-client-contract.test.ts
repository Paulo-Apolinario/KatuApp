import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";

function setup() {
  const code = transpileModule(readFileSync(resolve(process.cwd(), "../src/services/routeService.ts"), "utf8"), {
    compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 },
  }).outputText;
  let networkError = false;
  let serverRejects = false;
  let route: any = { id: "r1", name: "Rota", status: "IN_PROGRESS", driverId: "d1", vehicleId: "v1", driver: { id: "d1", name: "Ana" }, vehicle: { id: "v1", plate: "ABC1234", model: "Caminhão" }, stops: ["Rua A, 123"], collections: ["COLLECTED", "RECEIVED", "SORTING", "COMPLETED"].map((status, index) => ({ id: String(index), status })), stats: { collectedCollections: 1, receivedCollections: 1, sortingCollections: 1, completedCollections: 1, fieldCompletedCollections: 4 } };
  let cached: any[] = [];
  const queue: any[] = [];
  const calls: any[] = [];
  class NetworkError extends Error {}
  const api = {
    get: async (url: string) => {
      if (networkError) throw new NetworkError();
      return url === "/routes" ? { routes: [route] } : { route };
    },
    patch: async (url: string, payload: any) => {
      calls.push({ url, payload });
      if (networkError) throw new NetworkError();
      if (serverRejects) throw new Error("Finalize as coletas antes de concluir a rota.");
      route = { ...route, ...payload, driver: payload.driverId === null ? null : route.driver, vehicle: payload.vehicleId === null ? null : route.vehicle };
      return { route };
    },
  };
  const repository = {
    upsertRoutes: async (rows: any[]) => { for (const row of rows) { cached = cached.filter((item) => item.id !== row.id); cached.push(row); } },
    getAllRoutes: async () => cached,
    getRouteById: async (id: string) => cached.find((row) => row.id === id),
    getRoutesByDriver: async (id: string) => cached.filter((row) => row.driverId === id),
  };
  const module = { exports: {} as any };
  new Function("require", "module", "exports", code)((name: string) => {
    if (name === "./api") return { api, isApiNetworkError: (error: unknown) => error instanceof NetworkError };
    if (name.includes("routeRepository")) return repository;
    if (name.includes("syncQueueRepository")) return { enqueueSyncItem: async (item: any) => queue.push(item) };
    if (name.includes("schema")) return { SYNC_ENTITY: { ROUTE: "ROUTE" }, SYNC_OPERATION: { UPDATE_ROUTE_STATUS: "UPDATE_ROUTE_STATUS" } };
    throw new Error(`Dependência inesperada: ${name}`);
  }, module, module.exports);
  return { service: module.exports.routeService, calls, queue, offline: () => { networkError = true; }, reject: () => { serverRejects = true; } };
}

test("app preserva os estados pós-coleta, a equipe e os contadores", async () => {
  const { service } = setup();
  const route = await service.getById("r1");
  assert.deepEqual(route.collections.map((item: any) => item.status), ["COLLECTED", "RECEIVED", "SORTING", "COMPLETED"]);
  assert.equal(route.driver.name, "Ana"); assert.equal(route.vehicle.plate, "ABC1234");
  assert.equal(route.stats.fieldCompletedCollections, 4);
});

test("app envia null para remover motorista e veículo e mantém endereço com vírgula", async () => {
  const { service, calls } = setup();
  const route = await service.update("r1", { driverId: null, vehicleId: null, stops: ["Rua A, 123"] });
  assert.equal(calls[0].payload.driverId, null); assert.equal(calls[0].payload.vehicleId, null);
  assert.equal(route.driver, null); assert.equal(route.vehicle, null);
  assert.deepEqual(route.stops, ["Rua A, 123"]);
});

test("filtro de motorista sem resultados não retorna rotas de outro motorista", async () => {
  const { service } = setup();
  assert.deepEqual(await service.listByDriver("other"), []);
});

test("alteração offline fica pendente; rejeição HTTP não entra na fila", async () => {
  const offline = setup(); await offline.service.getById("r1"); offline.offline();
  const pending = await offline.service.updateStatus("r1", "COMPLETED");
  assert.equal(pending.syncStatus, "PENDING"); assert.equal(offline.queue.length, 1);
  const rejected = setup(); rejected.reject();
  await assert.rejects(rejected.service.updateStatus("r1", "COMPLETED"), /Finalize as coletas/);
  assert.equal(rejected.queue.length, 0);
});
