/** Regressões dos contratos reais; transporte/armazenamento controlados, sem dados da VPS. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const root = path.resolve(__dirname, "../../..");
const results = [];
const compile = (source) =>
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
function load(file, mocks = {}, cache = new Map(), storage) {
  const full = path.resolve(root, file);
  if (cache.has(full)) return cache.get(full).exports;
  const mod = { exports: {} };
  cache.set(full, mod);
  new Function(
    "require",
    "module",
    "exports",
    "localStorage",
    "__DEV__",
    compile(fs.readFileSync(full, "utf8")),
  )(
    (name) => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (!name.startsWith(".") && !name.startsWith("/")) return require(name);
      let target =
        path.relative(root, path.resolve(path.dirname(full), name)) + ".ts";
      if (target === "src/database/index.ts")
        target = "src/database/index.web.ts";
      return load(target, mocks, cache, storage);
    },
    mod,
    mod.exports,
    storage,
    false,
  );
  return mod.exports;
}
async function check(name, fn) {
  await fn();
  results.push({ name, status: "PASS" });
  console.log("PASS", name);
}
(async () => {
  await check(
    "Data de Fortaleza rejeita calendário impossível e conserva fuso",
    () => {
      const { parseFortalezaDateTime: parse } = load("src/utils/dateTime.ts");
      for (const input of [
        ["31/02/2026", "14:30"],
        ["29/02/2026", "12:00"],
        ["00/10/2026", "12:00"],
        ["23/10/2026", "24:01"],
      ])
        assert.equal(parse(...input), null);
      assert.equal(parse("24/10/2026", "14:30"), "2026-10-24T17:30:00.000Z");
    },
  );
  const materials = load("src/utils/materials.ts");
  await check(
    "Materiais conservam litros e unidades sem inventar massa",
    () => {
      const items = materials.normalizeMaterials([
        { proposedMaterial: { name: "Óleo" }, quantity: 50, unit: "LITER" },
        { name: "Papel", quantity: 2, unit: "TON" },
      ]);
      assert.equal(materials.materialQuantity(items[0]), "50 L");
      assert.equal(items[0].quantityKg, 0);
      assert.equal(items[1].quantityKg, 2000);
      assert.equal(
        materials.groupMaterials([...items, { ...items[0], quantity: 10 }])[0]
          .quantity,
        60,
      );
    },
  );
  await check("PDF escreve 50 L em vez de zero kg", () => {
    const file = "src/services/pdfGenerator.ts",
      source = fs.readFileSync(path.join(root, file), "utf8"),
      sf = ts.createSourceFile(file, source, 99, true, ts.ScriptKind.TS);
    const names = ["escapeHtml", "renderMaterialsTable"],
      chunks = [];
    function walk(n) {
      if (
        (ts.isFunctionDeclaration(n) || ts.isVariableDeclaration(n)) &&
        names.includes(n.name?.text)
      )
        chunks.push(
          (ts.isVariableDeclaration(n) ? "const " : "") + n.getText(sf) + ";",
        );
      ts.forEachChild(n, walk);
    }
    walk(sf);
    const mod = { exports: {} };
    new Function(
      "module",
      "exports",
      "materialQuantity",
      compile(chunks.join("\n") + "\nexport {renderMaterialsTable};"),
    )(mod, mod.exports, materials.materialQuantity);
    const html = mod.exports.renderMaterialsTable([
      { type: "Óleo", quantity: 50, unit: "LITER", quantityKg: 0 },
    ]);
    assert(html.includes("50 L"));
    assert(!html.includes("0.0 kg"));
  });
  await check(
    "Agenda local isola contas inclusive IDs compartilhados",
    async () => {
      const memory = new Map(),
        storage = {
          getItem: (key) => memory.get(key) || null,
          setItem: (key, value) => memory.set(key, value),
        },
        cache = new Map();
      const session = load(
          "src/database/repositories/sessionRepository.ts",
          {},
          cache,
          storage,
        ),
        repo = load(
          "src/database/repositories/scheduleRepository.ts",
          {},
          cache,
          storage,
        );
      await session.saveSession({
        token: "qa-a",
        userId: "a",
        payload: { id: "a" },
      });
      await repo.upsertSchedules([
        { id: "same", payload: { id: "same", notes: "Conta A" } },
      ]);
      await session.saveSession({
        token: "qa-b",
        userId: "b",
        payload: { id: "b" },
      });
      assert.deepEqual(await repo.getAllSchedules(), []);
      assert.equal(await repo.getScheduleById("same"), null);
      await repo.upsertSchedules([
        { id: "same", payload: { id: "same", notes: "Conta B" } },
      ]);
      await session.saveSession({
        token: "qa-a",
        userId: "a",
        payload: { id: "a" },
      });
      assert.equal(
        (await repo.getScheduleById("same")).payload.notes,
        "Conta A",
      );
    },
  );
  await check(
    "401 limpa sessão; erro de rede conserva consulta local",
    async () => {
      let token = "qa",
        cleared = 0,
        unauthorized = true;
      const svc = load("src/services/authService.ts", {
        "./api": {
          api: {
            get: async () => {
              throw Object.assign(Error("Falha controlada"), {
                status: unauthorized ? 401 : 0,
              });
            },
          },
          isApiHttpError: (e) => e.status === 401,
        },
        "./sessionService": {
          sessionService: {
            getToken: async () => token,
            getUser: async () => ({ id: "a" }),
            clearSession: async () => {
              cleared++;
              token = null;
            },
          },
        },
      }).default;
      assert.equal(await svc.getCurrentUserData(), null);
      assert.equal(cleared, 1);
      token = "qa";
      unauthorized = false;
      assert.equal((await svc.getCurrentUserData()).id, "a");
      assert.equal(cleared, 1);
    },
  );
  await check(
    "Resposta antiga de auth/me não apaga uma sessão nova",
    async () => {
      let token = "old";
      const svc = load("src/services/authService.ts", {
        "./api": {
          api: {
            get: async () => {
              token = "new";
              throw Object.assign(Error("Sessão antiga"), { status: 401 });
            },
          },
          isApiHttpError: (e) => e.status === 401,
        },
        "./sessionService": {
          sessionService: {
            getToken: async () => token,
            getUser: async () => ({ id: "new-user" }),
            clearSession: async () => assert.fail("Sessão nova apagada"),
          },
        },
      }).default;
      assert.equal((await svc.getCurrentUserData()).id, "new-user");
    },
  );
  await check(
    "Cofre nativo migra token legado e remove cópia em texto",
    async () => {
      const values = new Map([["@katu:token", "qa-legacy"]]),
        vault = new Map();
      const store = load("src/services/tokenStorage.native.ts", {
        "expo-secure-store": {
          getItemAsync: async (k) => vault.get(k),
          setItemAsync: async (k, v) => vault.set(k, v),
          deleteItemAsync: async (k) => vault.delete(k),
          WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
        },
        "@react-native-async-storage/async-storage": {
          default: {
            getItem: async (k) => values.get(k),
            removeItem: async (k) => values.delete(k),
          },
        },
      });
      assert.equal(await store.readToken(), "qa-legacy");
      assert.equal(values.has("@katu:token"), false);
      assert.equal(vault.get("katu.session.token"), "qa-legacy");
      await store.removeToken();
      assert.equal(await store.readToken(), null);
    },
  );
  await check(
    "Origem reconhece PEV, gerador e endereço PF com faixa válida",
    () => {
      const { collectionOrigin, validCoordinates } = load(
        "src/utils/collectionOrigin.ts",
      );
      assert.equal(
        collectionOrigin({
          bin: { name: "PEV QA", latitude: -3.7, longitude: -38.5 },
        }).name,
        "PEV QA",
      );
      assert.equal(
        collectionOrigin({ generator: { name: "Gerador QA" } }).name,
        "Gerador QA",
      );
      assert.equal(
        collectionOrigin({
          schedule: {
            pickupAddress: "Rua QA 10",
            pickupLatitude: -3.7,
            pickupLongitude: -38.5,
          },
        }).address,
        "Rua QA 10",
      );
      assert(validCoordinates(0, 0));
      assert(!validCoordinates(91, -38));
      assert(!validCoordinates(null, null));
    },
  );
  await check(
    "Rota serializa IDs de coleta e conserva PEV e ordem recebidos",
    async () => {
      let sent;
      const svc = load("src/services/routeService.ts", {
        "./api": {
          api: {
            post: async (url, body) => {
              sent = body;
              return {
                route: {
                  id: "r",
                  teamId: "team-qa",
                  name: body.name,
                  status: "SCHEDULED",
                  collectionOrder: body.collectionIds,
                  collections: [
                    {
                      id: "c",
                      participants: [{id:"member",collectorId:"member-qa",nameSnapshot:"Integrante QA"}],
                      status: "PENDING",
                      materials: [],
                      bin: { name: "PEV QA", latitude: -3.7, longitude: -38.5 },
                    },
                  ],
                },
              };
            },
          },
          isApiNetworkError: () => false,
        },
        "../database/repositories/routeRepository": {
          upsertRoutes: async () => {},
        },
        "../database/repositories/syncQueueRepository": {},
        "../database/schema": {},
      }).routeService;
      const route = await svc.create({
        name: "QA",
        collectionIds: ["c"],
        stops: [],
      });
      assert.deepEqual(sent.collectionIds, ["c"]);
      assert.equal(route.collections[0].bin.name, "PEV QA");
      assert.deepEqual(route.collectionOrder, ["c"]);
      assert.equal(route.teamId,"team-qa");
      assert.equal(route.collections[0].participants[0].collectorId,"member-qa");
    },
  );
  await check("Saída aguarda preparação da cooperativa e distingue veículo em manutenção", async () => {
    const {routeStartIssues} = load("src/utils/routeReadiness.ts");
    const route={scheduledDate:"2026-10-28T11:00:00Z",collections:[{status:"PENDING"}]};
    assert.deepEqual(routeStartIssues(route),["Designar o motorista","Designar o veículo"]);
    assert.equal(routeStartIssues({...route,driverId:"d",vehicleId:"v",vehicle:{status:"ACTIVE"}}).length,0);
    assert.equal(routeStartIssues({...route,driverId:"d",vehicleId:"v",vehicle:{status:"MAINTENANCE"}}).length,1);
    assert(routeStartIssues({...route,collections:[{status:"COLLECTED"}]}).some(s=>s.includes("não há coleta")));
  });
  await check("Seleção inicial prioriza execução em andamento e programação atual do Ceará", async () => {
    const {initialRouteId} = load("src/utils/routeReadiness.ts");
    const routes=[{id:"old",status:"SCHEDULED",scheduledDate:"2026-10-27T11:00:00Z"},{id:"today",status:"SCHEDULED",scheduledDate:"2026-10-28T11:00:00Z"}];
    assert.equal(initialRouteId(routes,new Date("2026-10-28T12:00:00Z")),"today");
    assert.equal(initialRouteId([...routes,{id:"active",status:"IN_PROGRESS"}],new Date("2026-10-28T12:00:00Z")),"active");
    assert.equal(initialRouteId([{id:"cancelled",status:"CANCELLED"}]),undefined);
  });
  console.log(
    JSON.stringify(
      {
        method:
          "Funções/serviços reais transpilados, armazenamento e rede controlados; sem aparelho físico.",
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
