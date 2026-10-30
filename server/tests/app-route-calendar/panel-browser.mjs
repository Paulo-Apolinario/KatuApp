/** UI real + API local em banco descartável. Nenhum acesso à VPS. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
const toolsRoot = process.env.KATUA_VALIDATION_TOOLS;
if (!toolsRoot) throw Error("KATUA_VALIDATION_TOOLS obrigatório");
const req = createRequire(path.resolve(toolsRoot, "package.json"));
const { chromium } = req("playwright");
const build = (await import(req.resolve("@sparticuz/chromium"))).default;
build.setGraphicsMode = false;
const panelRoot =
  process.env.KATUA_PANEL_FRONTEND ||
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../../pev-web/frontend",
  );
const f = {
    token: "local-panel-fixture",
    owner: {
      id: "owner-local",
      displayName: "Cooperativa QA",
      role: "COOPERATIVE",
    },
  },
  out = path.resolve(toolsRoot, "app-calendar-ui-evidence");
fs.mkdirSync(out, { recursive: true });
const vite = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "5179",
    "--strictPort",
  ],
  {
    cwd: panelRoot,
    env: { ...process.env, VITE_API_BASE_URL: "http://127.0.0.1:3339" },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(Error("Vite não iniciou")), 30000);
  vite.stdout.on("data", (b) => {
    if (b.toString().includes("Local:")) {
      clearTimeout(timer);
      resolve();
    }
  });
  vite.stderr.on("data", (b) => process.stderr.write(b));
  vite.on("exit", (code) => reject(Error("Vite encerrou " + code)));
});
const browser = await chromium.launch({
  executablePath:
    process.env.KATUA_CHROMIUM_PATH || (await build.executablePath()),
  args: build.args.filter((a) => a !== "--single-process"),
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1366, height: 950 },
  locale: "pt-BR",
  timezoneId: "America/Fortaleza",
});
await context.addInitScript(
  ({ token, user }) => {
    localStorage.setItem("auth_token", token);
    localStorage.setItem("auth_user", JSON.stringify(user));
  },
  { token: f.token, user: f.owner },
);
const day = "2026-10-28",
  previous = "2026-10-27T12:00:00Z";
const collections = [1, 2].map((i) => ({
  id: "collection-" + i,
  status: "PENDING",
  createdAt: previous,
  scheduleId: i === 1 ? "linked-request" : null,
  route: { id: "route", name: "Diária QA", scheduledDate: day + "T11:00:00Z" },
  generator: { name: "Ponto QA " + i },
  collectionMaterials: [],
}));
const requests = [
  {
    id: "linked-request",
    status: "SCHEDULED",
    scheduledDate: day + "T11:00:00Z",
  },
  {
    id: "unlinked-request",
    status: "REQUESTED",
    preferredDate: "2026-10-29T11:00:00Z",
    createdAt: previous,
    generator: { name: "Solicitação QA" },
    collections: [],
  },
];
let fail = false;
await context.route("http://127.0.0.1:3339/**", async (r) => {
  if (r.request().method() === "OPTIONS")
    return r.fulfill({
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "authorization,content-type",
        "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
      },
    });
  const u = new URL(r.request().url());
  let body = { user: f.owner };
  let status = 200;
  if (u.pathname === "/dashboard/overview")
    body = {
      data: {
        operational: { openAlerts: 0, pendingUnits: {} },
        todayRows: [],
        period: { summary: { units: {} }, series: [], warnings: [] },
        stock: {},
        map: { points: [] },
        recent: [],
        cooperative: { name: "Cooperativa QA" },
      },
    };
  else if (u.pathname === "/dashboard/operations") status = 503;
  else if (u.pathname === "/collections") {
    body = {
      collections: [
        ...collections,
        { id: "undated", status: "PENDING", createdAt: previous },
      ],
    };
    if (fail) status = 503;
  } else if (u.pathname.startsWith("/collections/"))
    body = {
      collection: collections.find(
        (c) => c.id === u.pathname.split("/").at(-1),
      ),
    };
  else if (u.pathname === "/schedules") body = { schedules: requests };
  else if (u.pathname.startsWith("/schedules/"))
    body = {
      schedule: requests.find((s) => s.id === u.pathname.split("/").at(-1)),
    };
  else if (u.pathname === "/waste-workspace/field-collections")
    body = {
      collections,
      pagination: { total: 2, page: 1, limit: 10 },
      stats: { active: 2, awaitingReceipt: 0, incidents: 0, units: [] },
    };
  else if (u.pathname === "/waste-workspace/field-options")
    body = {
      collectors: [],
      generators: [],
      drivers: [],
      vehicles: [],
      routes: [],
    };
  else if (u.pathname === "/collectors") body = { collectors: [] };
  else if (u.pathname === "/drivers") body = { drivers: [] };
  else if (u.pathname === "/vehicles") body = { vehicles: [] };
  else if (u.pathname === "/routes") body = { routes: [] };
  return r.fulfill({
    status,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify(body),
  });
});
await context.route(/tile\.openstreetmap\.org/, (r) => r.abort());
const p = await context.newPage();
p.setDefaultTimeout(10000);
await p.clock.setFixedTime(new Date("2026-10-28T12:00:00-03:00"));
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
const checks = [];
async function check(name, fn) {
  try {
    await fn();
    checks.push({ name, status: "PASS" });
    console.log("PASS", name);
  } catch (e) {
    checks.push({ name, status: "FAIL", error: e.message });
    console.error("FAIL", name, e.message);
    await p
      .screenshot({
        path: out + "/failure-" + checks.length + ".png",
        fullPage: true,
      })
      .catch(() => {});
  }
}
const go = (url) => p.goto("http://127.0.0.1:5179" + url);
try {
  await check(
    "Abrir calendário no painel inicial alcança a página operacional",
    async () => {
      await go("/");
      await p
        .getByRole("link", { name: "Abrir calendário", exact: true })
        .click();
      await p.waitForURL("**/operational-calendar");
      await p
        .getByRole("heading", { name: "Calendário Operacional", exact: true })
        .waitFor();
    },
  );
  await check(
    "Endereço antigo do calendário também é redirecionado",
    async () => {
      await go("/calendar");
      await p.waitForURL("**/operational-calendar");
    },
  );
  await check(
    "Data programada abre todos os pontos do dia, sem duplicar agendamento vinculado",
    async () => {
      await p
        .getByRole("button", { name: "Ver agenda de 28/10/2026", exact: true })
        .click();
      const section = p.getByRole("region", {
        name: "Agenda de 28/10/2026",
        exact: true,
      });
      await section.waitFor();
      assert.equal(await section.getByRole("link").count(), 2);
      await p.screenshot({ path: out + "/agenda-dia.png", fullPage: true });
    },
  );
  await check("Evento de coleta abre os detalhes daquela coleta", async () => {
    await p
      .getByRole("region", { name: "Agenda de 28/10/2026", exact: true })
      .getByRole("link")
      .first()
      .click();
    await p.waitForURL("**/waste-list?coleta=collection-1");
    await p
      .getByText("Origem, materiais e histórico da coleta", { exact: true })
      .click();
    await p
      .getByText("Identificador completo: collection-1", { exact: true })
      .waitFor();
  });
  await check("Dia com uma solicitação abre o registro correto", async () => {
    await go("/operational-calendar");
    await p
      .getByRole("link", { name: /Abrir agendamento de Solicitação QA/ })
      .waitFor();
    await p
      .getByRole("button", { name: "Ver agenda de 29/10/2026", exact: true })
      .click();
    await p.waitForURL("**/collection-requests?solicitacao=unlinked-request");
    await p.getByRole("heading", { name: /Solicitação #/ }).waitFor();
    await p.getByText("Solicitação QA", { exact: true }).last().waitFor();
  });
  await check(
    "Falha de consulta é informada; criação não vira agendamento; layout cabe no celular",
    async () => {
      fail = true;
      await go("/operational-calendar");
      await p
        .getByRole("alert")
        .filter({ hasText: "Não foi possível atualizar todos os eventos" })
        .waitFor();
      fail = false;
      await p
        .getByRole("button", { name: "Atualizar calendário", exact: true })
        .click();
      await p.getByText(/1 registro sem data/).waitFor();
      await p.setViewportSize({ width: 390, height: 844 });
      assert(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
    },
  );
  await check(
    "Navegação do calendário e detalhes sem erros JavaScript",
    async () => {
      assert.deepEqual(errors, []);
    },
  );
} finally {
  fs.writeFileSync(
    out + "/results.json",
    JSON.stringify(
      {
        passed: checks.filter((c) => c.status === "PASS").length,
        failed: checks.filter((c) => c.status === "FAIL").length,
        checks,
      },
      null,
      2,
    ),
  );
  await context.unrouteAll({ behavior: "ignoreErrors" });
  await browser.close();
  vite.kill();
}
if (checks.some((c) => c.status === "FAIL")) process.exitCode = 1;
