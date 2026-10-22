/** Serviços e repositórios reais, armazenamento persistente simulado e transporte controlado.
 * Não substitui testes em aparelho físico nem usa banco/credenciais da VPS. */
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve, dirname } = require("node:path");
const ts = require("typescript");
const root = resolve(__dirname, "../../..");
const memory = new Map();
let storageFails = false,
  networkFails = false,
  loseFieldResponse = false,
  failedStarts = false;
const localStorage = {
  getItem: (key) => memory.get(key) || null,
  setItem: (key, value) => {
    if (storageFails) throw Error("Armazenamento cheio");
    memory.set(key, value);
  },
};
const offline = Object.assign(new Error("Rede indisponível"), {
  offline: true,
});
let server,
  commits = 0,
  calls = [],
  owner = "catador-a";
const operations = new Set();
const api = {
  get: async () => {
    if (networkFails) throw offline;
    return { collections: [structuredClone(server)] };
  },
  post: async (url, body) => {
    calls.push({ url, body });
    if (networkFails || (failedStarts && url.endsWith("/start"))) throw offline;
    if (!operations.has(body.operationId)) {
      operations.add(body.operationId);
      if (url.endsWith("/start")) server = { ...server, status: "IN_PROGRESS" };
      else {
        commits++;
        server = { ...server, status: "COLLECTED", materials: body.materials };
      }
    }
    if (loseFieldResponse && url.endsWith("/complete-field")) {
      loseFieldResponse = false;
      throw offline;
    }
    return { collection: structuredClone(server) };
  },
};
function loadRuntime() {
  const cache = new Map();
  function load(file) {
    if (file.endsWith("/src/database/index.ts"))
      file = resolve(root, "src/database/index.web.ts");
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} };
    cache.set(file, mod);
    const code = ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    new Function("require", "module", "exports", "localStorage", code)(
      (name) => {
        if (name === "./api" || name === "@/src/services/api")
          return { api, isApiNetworkError: (e) => Boolean(e?.offline) };
        if (name === "./connectivity")
          return { getCurrentConnectivity: async () => ({ isOffline: false }) };
        const target = name.startsWith("@/")
          ? resolve(root, name.slice(2))
          : resolve(dirname(file), name);
        return load(target + ".ts");
      },
      mod,
      mod.exports,
      localStorage,
    );
    return mod.exports;
  }
  return {
    session: load(
      resolve(root, "src/database/repositories/sessionRepository.ts"),
    ),
    repo: load(
      resolve(root, "src/database/repositories/collectionRepository.ts"),
    ),
    queue: load(
      resolve(root, "src/database/repositories/syncQueueRepository.ts"),
    ),
    service: load(resolve(root, "src/services/collectionService.ts"))
      .collectionService,
    engine: load(resolve(root, "src/offline/syncEngine.ts")),
  };
}
let runtime = loadRuntime();
const results = [];
async function check(name, fn) {
  await fn();
  results.push({ name, status: "PASS" });
  console.log("PASS", name);
}
async function login(userId) {
  owner = userId;
  await runtime.session.saveSession({
    token: "test-only",
    userId,
    payload: { id: userId },
  });
}
async function seed(id) {
  server = {
    id,
    status: "PENDING",
    collectorId: owner,
    totalWeightKg: 0,
    materials: [],
    collectionMaterials: [],
    createdAt: new Date().toISOString(),
  };
  await runtime.repo.upsertCollections([
    { id, status: server.status, payload: server },
  ]);
}
(async () => {
  await login("catador-a");
  await seed("coleta-a");
  networkFails = true;
  await check(
    "Início offline grava fila antes de confirmar e mantém projeção local",
    async () => {
      const c = await runtime.service.start(server.id, {
        startedAt: "2026-10-22T18:00:00Z",
      });
      assert.equal(c.status, "IN_PROGRESS");
      assert.equal(c.syncStatus, "PENDING");
      assert.equal((await runtime.queue.getPendingSyncItems()).length, 1);
    },
  );
  const material = {
    proposedMaterial: { name: "Óleo QA", unit: "LITER" },
    quantity: 50,
    unit: "LITER",
  };
  await check(
    "Conclusão aguarda início sem perder unidade LITER e sobrevive ao reinício",
    async () => {
      const prior = calls.length;
      const c = await runtime.service.completeField(server.id, {
        materials: [material],
      });
      assert.equal(c.status, "COLLECTED");
      assert.equal(c.syncStatus, "PENDING");
      assert.equal(c.materials[0].name, "Óleo QA");
      assert.equal(c.materials[0].quantity, 50);
      assert.equal(c.materials[0].unit, "LITER");
      assert.equal(calls.length, prior);
      runtime = loadRuntime();
      assert.equal((await runtime.queue.getPendingSyncItems()).length, 2);
      const cached = await runtime.service.list();
      assert.equal(cached[0].status, "COLLECTED");
      assert.equal(
        (await runtime.queue.getPendingSyncItems())[1].payload.body.materials[0]
          .unit,
        "LITER",
      );
    },
  );
  await check(
    "Dados divergentes em etapa já enfileirada são rejeitados",
    async () => {
      await assert.rejects(
        runtime.service.completeField(server.id, {
          materials: [{ ...material, quantity: 99 }],
        }),
        /dados diferentes/,
      );
      assert.equal((await runtime.queue.getPendingSyncItems()).length, 2);
    },
  );
  await check(
    "Falha no início bloqueia envio da conclusão dependente",
    async () => {
      networkFails = false;
      failedStarts = true;
      calls = [];
      const r = await runtime.engine.syncPendingOperations();
      assert.equal(r.success, false);
      assert.equal(calls.length, 1);
      assert(calls[0].url.endsWith("/start"));
    },
  );
  await check(
    "Consulta online preserva projeção de operações pendentes",
    async () => {
      const c = (await runtime.service.list())[0];
      assert.equal(c.status, "COLLECTED");
      assert.equal(c.syncStatus, "PENDING");
    },
  );
  await check(
    "Recuperação envia início e conclusão em ordem e limpa fila após confirmação",
    async () => {
      failedStarts = false;
      calls = [];
      const r = await runtime.engine.syncPendingOperations();
      assert.equal(r.success, true);
      assert.equal(commits, 1);
      assert.deepEqual(
        calls.map((c) => c.url.split("/").at(-1)),
        ["start", "complete-field"],
      );
      assert.equal((await runtime.queue.getPendingSyncItems()).length, 0);
      assert.equal(
        (await runtime.repo.getCollectionById(server.id)).payload.syncStatus,
        "SYNCED",
      );
    },
  );
  await check(
    "Resposta perdida após gravação usa mesmo identificador na nova tentativa",
    async () => {
      await seed("coleta-b");
      await runtime.service.start(server.id, {});
      loseFieldResponse = true;
      const c = await runtime.service.completeField(server.id, {
        materials: [material],
      });
      assert.equal(c.syncStatus, "PENDING");
      const before = commits;
      const id = (await runtime.queue.getPendingSyncItems())[0].payload.body
        .operationId;
      await runtime.engine.syncPendingOperations();
      assert.equal(commits, before);
      assert.equal(calls.at(-1).body.operationId, id);
    },
  );
  await check(
    "Troca de conta isola cache e fila; voltar à conta recupera pendências",
    async () => {
      await seed("coleta-c");
      networkFails = true;
      await runtime.service.start(server.id, {});
      await login("catador-b");
      assert.equal((await runtime.queue.getPendingSyncItems()).length, 0);
      assert.deepEqual(await runtime.service.list(), []);
      assert.equal((await runtime.engine.syncPendingOperations()).processed, 0);
      await runtime.repo.upsertCollections([{ id: server.id, status: "PENDING", payload: { ...server, status: "PENDING" } }]);
      await login("catador-a");
      assert.equal((await runtime.repo.getCollectionById(server.id)).payload.status, "IN_PROGRESS");
      assert.equal((await runtime.queue.getPendingSyncItems()).length, 1);
    },
  );
  await check(
    "Operação interrompida em SYNCING é retomada após reinício",
    async () => {
      const q = (await runtime.queue.getPendingSyncItems())[0];
      await runtime.queue.markSyncItemSyncing(q.id);
      runtime = loadRuntime();
      networkFails = false;
      assert.equal(
        (await runtime.engine.syncPendingOperations()).success,
        true,
      );
      assert.equal((await runtime.queue.getPendingSyncItems()).length, 0);
    },
  );
  await check(
    "Falha de armazenamento não informa operação como salva",
    async () => {
      await seed("coleta-d");
      storageFails = true;
      await assert.rejects(
        runtime.service.start(server.id, {}),
        /Armazenamento cheio/,
      );
      storageFails = false;
      assert.equal((await runtime.queue.getPendingSyncItems()).length, 0);
      assert.equal(
        (await runtime.repo.getCollectionById(server.id)).status,
        "PENDING",
      );
    },
  );
  console.log(
    JSON.stringify(
      {
        method:
          "Serviços/repositórios TypeScript reais e adaptador web real, transporte controlado; sem aparelho físico.",
        results,
      },
      null,
      2,
    ),
  );
})().catch((e) => {
  console.error(e.stack);
  process.exitCode = 1;
});
