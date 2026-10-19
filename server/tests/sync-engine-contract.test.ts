import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";

function setup(rejectedIds: string[]) {
  const items = ["accepted", "rejected"].map((id) => ({ id, entityId: id, entityType: "ROUTE", operationType: "UPDATE_ROUTE_STATUS", payload: { id, status: "COMPLETED" } }));
  const errors: string[] = [], synced: string[] = [], cached: any[] = [];
  const code = transpileModule(readFileSync(resolve(process.cwd(), "../src/offline/syncEngine.ts"), "utf8"), { compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} as any };
  new Function("require", "module", "exports", code)((name: string) => {
    if (name.endsWith("/api")) return { api: { patch: async (url: string) => {
      if (rejectedIds.some((id) => url.includes(`/${id}/`))) throw new Error("Operação rejeitada pelo servidor.");
      return { route: { id: "accepted", status: "COMPLETED" } };
    } } };
    if (name.includes("syncQueueRepository")) return {
      getPendingSyncItems: async () => items,
      markSyncItemSyncing: async () => {},
      markSyncItemSynced: async (id: string) => { synced.push(id); },
      markSyncItemError: async (id: string) => { errors.push(id); },
      clearSyncedSyncItems: async () => {},
    };
    if (name.includes("routeRepository")) return { upsertRoutes: async (rows: any[]) => { cached.push(...rows); } };
    if (name.includes("collectionRepository")) return { upsertCollections: async () => {} };
    if (name === "./connectivity") return { getCurrentConnectivity: async () => ({ isOffline: false }) };
    throw new Error(`Dependência inesperada: ${name}`);
  }, module, module.exports);
  return { run: module.exports.syncPendingOperations, errors, synced, cached };
}

test("sincronização com rejeição parcial retorna falha sem impedir o envio dos demais itens", async () => {
  const fixture = setup(["rejected"]);
  const result = await fixture.run();
  assert.equal(result.success, false); assert.equal(result.synced, 1); assert.equal(result.failed, 1);
  assert.deepEqual(fixture.errors, ["rejected"]); assert.deepEqual(fixture.synced, ["accepted"]);
  assert.equal(fixture.cached[0].payload.syncStatus, "SYNCED");
});

test("sincronização sem rejeições confirma sucesso", async () => {
  const result = await setup([]).run();
  assert.equal(result.success, true); assert.equal(result.synced, 2); assert.equal(result.failed, 0);
});
