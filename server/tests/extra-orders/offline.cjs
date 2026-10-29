/** Fila e repositórios reais com armazenamento persistente e transporte controlados. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript"),
  crypto = require("node:crypto");
const root = path.resolve(__dirname, "../../.."),
  values = new Map(),
  remote = new Map();
let failNetwork = true,
  loseResponse = false,
  storageFails = false,
  failValidation = false,
  commits = 0,
  owner = "catador-a";
const offline = Object.assign(Error("Sem conexão controlada"), {
  offline: true,
});
const storage = {
  getItem: (k) => values.get(k) || null,
  setItem: (k, v) => {
    if (storageFails) throw Error("Armazenamento cheio");
    values.set(k, v);
  },
};
const api = {
  get: async (url) => {
    if (failNetwork) throw offline;
    if (url.includes("/context"))
      return {
        cooperative: { id: "coop-a", name: "Cooperativa QA" },
        generators: [],
        routes: [],
        catalog: [],
        schedules: [],
        drivers: [],
        vehicles: [],
      };
    if (url.includes("?page="))
      return {
        orders: [...remote.values()],
        hasMore: false,
        total: remote.size,
      };
    const id = url.split("/").at(-1);
    if (!remote.has(id))
      throw Object.assign(Error("Ordem não encontrada"), { status: 404 });
    return { order: remote.get(id) };
  },
  post: async (url, body) => {
    if (failNetwork) throw offline;
    if (failValidation)
      throw Object.assign(Error("Referência precisa de correção"), {
        status: 400,
      });
    const id = body.id || url.split("/")[2];
    if (!remote.has(id)) {
      remote.set(id, {
        id,
        cooperativeId: body.cooperativeId,
        status: "PENDING_REVIEW",
        revision: 1,
        payload: body.payload,
        createdAt: new Date().toISOString(),
        custody: body.payload.custody,
        custodyNotes: body.payload.custodyNotes,
      });
      commits++;
    }
    if (loseResponse) {
      loseResponse = false;
      throw offline;
    }
    return { order: remote.get(id) };
  },
};
function runtime() {
  const cache = new Map();
  function load(file) {
    if (file.endsWith("/database/index.ts"))
      file = file.replace("/database/index.ts", "/database/index.web.ts");
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} };
    cache.set(file, mod);
    const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    new Function("require", "module", "exports", "localStorage", code)(
      (name) => {
        if (name === "expo-crypto") return crypto;
        if (name === "./api" || name.endsWith("/services/api"))
          return {
            api,
            isApiNetworkError: (e) => !!e?.offline,
            isApiHttpError: (e) => !!e?.status,
          };
        if (name === "./connectivity")
          return {
            getCurrentConnectivity: async () => ({ isOffline: failNetwork }),
          };
        const target = name.startsWith("@/")
          ? path.join(root, name.slice(2))
          : path.resolve(path.dirname(file), name);
        return load(target + ".ts");
      },
      mod,
      mod.exports,
      storage,
    );
    return mod.exports;
  }
  return {
    service: load(path.join(root, "src/services/extraOrderService.ts"))
      .extraOrderService,
    session: load(
      path.join(root, "src/database/repositories/sessionRepository.ts"),
    ),
    repo: load(
      path.join(root, "src/database/repositories/extraOrderRepository.ts"),
    ),
    queue: load(
      path.join(root, "src/database/repositories/syncQueueRepository.ts"),
    ),
  };
}
let r = runtime();
const results = [];
async function check(name, fn) {
  await fn();
  results.push({ name, status: "PASS" });
  console.log("PASS", name);
}
async function login(id) {
  owner = id;
  await r.session.saveSession({
    token: "qa-only",
    userId: id,
    payload: { id },
  });
}
const payload = {
  mode: "COLLECTED",
  reason: "UNPLANNED_STOP",
  contextRouteId: "rota-contexto-qa",
  reasonNotes: "Parada extra realizada em campo",
  originType: "PF",
  originName: "Morador QA",
  pickupAddress: "Rua QA, 100, Fortaleza, CE",
  occurredAt: "2026-10-17T15:00:00-03:00",
  custody: "COLLECTOR",
  custodyNotes: "Em transporte para o galpão",
  materials: [
    {
      proposedMaterial: { name: "Óleo QA", unit: "LITER" },
      unit: "LITER",
      quantity: 8,
    },
  ],
  photos: [
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXn8AAAAASUVORK5CYII=",
  ],
};
(async () => {
  await login("catador-a");
  const id = crypto.randomUUID();
  await check(
    "O.C. offline salva protocolo, rota de contexto, foto e unidade sem criar coleta",
    async () => {
      const o = await r.service.submit(id, "coop-a", payload);
      assert.equal(o.id, id);
      assert.equal(o.status, "LOCAL_PENDING");
      assert.equal((await r.queue.getPendingSyncItems()).length, 1);
      assert.equal(commits, 0);
      assert.equal(o.payload.photos.length, 1);
      assert.equal(o.payload.materials[0].unit, "LITER");
    },
  );
  await check(
    "Reinício recupera O.C. e impede duplicar envio pendente",
    async () => {
      r = runtime();
      const list = await r.service.list();
      assert.equal(list.orders[0].id, id);
      assert.equal(list.orders[0].payload.contextRouteId, "rota-contexto-qa");
      await assert.rejects(
        r.service.submit(id, "coop-a", payload),
        /envio pendente/,
      );
    },
  );
  await check(
    "Troca de conta isola ordens, rascunhos e fila; retorno recupera pendências",
    async () => {
      await login("catador-b");
      assert.deepEqual((await r.service.list()).orders, []);
      assert.equal((await r.queue.getPendingSyncItems()).length, 0);
      await login("catador-a");
      assert.equal((await r.queue.getPendingSyncItems()).length, 1);
    },
  );
  await check(
    "Resposta perdida após gravação reenvia mesmo UUID sem duplicar ordem",
    async () => {
      failNetwork = false;
      loseResponse = true;
      await r.service.sync({ manual: true });
      assert.equal(commits, 1);
      assert.equal((await r.queue.getPendingSyncItems()).length, 1);
      r = runtime();
      await r.service.sync({ manual: true });
      assert.equal(commits, 1);
      assert.equal((await r.queue.getPendingSyncItems()).length, 0);
      assert.equal((await r.service.get(id)).status, "PENDING_REVIEW");
    },
  );
  await check("Falha de armazenamento não confirma O.C. salva", async () => {
    storageFails = true;
    await assert.rejects(
      r.service.submit(crypto.randomUUID(), "coop-a", payload),
      /Armazenamento cheio/,
    );
    storageFails = false;
    assert.equal((await r.queue.getPendingSyncItems()).length, 0);
  });
  await check(
    "Rascunho permanece na conta de origem e não é enviado automaticamente",
    async () => {
      const draft = {
        id: crypto.randomUUID(),
        cooperativeId: "coop-a",
        status: "DRAFT",
        revision: 1,
        payload,
        createdAt: new Date().toISOString(),
        custody: payload.custody,
        custodyNotes: payload.custodyNotes,
      };
      await r.service.draft(draft, "catador-a");
      assert.equal((await r.repo.getExtraRecord(draft.id)).status, "DRAFT");
      await login("catador-b");
      await assert.rejects(r.service.draft(draft, "catador-a"), /conta mudou/);
      assert.equal(await r.repo.getExtraRecord(draft.id), null);
    },
  );
  await check(
    "Correção confirmada remove somente sua pendência e preserva outra O.C.",
    async () => {
      await login("catador-a");
      failNetwork = true;
      const a = crypto.randomUUID(),
        b = crypto.randomUUID();
      await r.service.submit(a, "coop-a", payload);
      await r.service.submit(b, "coop-a", payload);
      failNetwork = false;
      failValidation = true;
      await r.service.sync({ manual: true });
      assert.equal((await r.queue.getPendingSyncItems()).length, 2);
      const draft = await r.service.recoverFailed(a);
      assert.equal(draft.status, "DRAFT");
      assert.equal(draft.id, a);
      assert.equal((await r.queue.getPendingSyncItems()).length, 1);
      assert.equal((await r.queue.getPendingSyncItems())[0].entityId, b);
      failValidation = false;
      await r.service.sync({ manual: true });
      await r.service.submit(a, "coop-a", {
        ...payload,
        reasonNotes: "Referência corrigida sem alterar o protocolo",
      });
      assert(remote.has(a));
      assert(remote.has(b));
    },
  );
  console.log(
    JSON.stringify(
      {
        method:
          "Serviços/filas/repositórios reais transpilados; rede e armazenamento controlados, sem aparelho físico.",
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
