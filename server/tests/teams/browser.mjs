/** Interface real e API em banco local descartável; GPS e tiles controlados. Sem VPS. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const toolsRoot = process.env.KATUA_VALIDATION_TOOLS;
if (!toolsRoot)
  throw Error(
    "Informe KATUA_VALIDATION_TOOLS com Playwright e Chromium de validação.",
  );
const req = createRequire(path.resolve(toolsRoot, "package.json"));
const { chromium } = req("playwright");
const chromiumBuild = (await import(req.resolve("@sparticuz/chromium")))
  .default;
const appRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../..",
  ),
  panelRoot = path.resolve(appRoot, "../pev-web/frontend");
if (!panelRoot || !process.env.KATUA_TEAM_UI_FIXTURE)
  throw Error(
    "Informe KATUA_PANEL_FRONTEND e KATUA_TEAM_UI_FIXTURE gerada pela API local descartável.",
  );
const f = JSON.parse(
    fs.readFileSync(process.env.KATUA_TEAM_UI_FIXTURE, "utf8"),
  ),
  out = path.resolve(
    process.env.KATUA_PEV_UI_OUTPUT ||
      path.resolve(toolsRoot, "teams-ui-evidence"),
  );
fs.mkdirSync(out, { recursive: true });
const results = [];
let browser;
chromiumBuild.setGraphicsMode = false;
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=",
  "base64",
);
const server = http.createServer((req, res) => {
  const name = decodeURIComponent((req.url || "/").split("?")[0]);
  if (name.includes("..")) {
    res.writeHead(403);
    return res.end();
  }
  let file = appRoot + "/dist" + name;
  if (fs.existsSync(file) && fs.statSync(file).isDirectory())
    file += "/index.html";
  if (!fs.existsSync(file) && fs.existsSync(file + ".html")) file += ".html";
  if (!fs.existsSync(file)) file = appRoot + "/dist/index.html";
  res.setHeader(
    "Content-Type",
    {
      ".html": "text/html",
      ".js": "application/javascript",
      ".css": "text/css",
      ".png": "image/png",
      ".ttf": "font/ttf",
    }[path.extname(file)] || "application/octet-stream",
  );
  res.end(fs.readFileSync(file));
});
await new Promise((r) => server.listen(8089, "127.0.0.1", r));
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
await new Promise((r, j) => {
  let t = setTimeout(() => j(Error("Vite timeout")), 30000);
  vite.stdout.on("data", (b) => {
    if (b.toString().includes("Local:")) {
      clearTimeout(t);
      r();
    }
  });
  vite.stderr.on("data", (b) => process.stderr.write(b));
});
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, status: "PASS" });
    console.log("PASS", name);
  } catch (e) {
    results.push({ name, status: "FAIL", error: e.message });
    console.error("FAIL", name, e.message);
    for (const [i, c] of (browser?.contexts() || []).entries())
      for (const [j, p] of c.pages().entries())
        await p
          .screenshot({
            path: `${out}/failure-${results.length}-${i}-${j}.png`,
            fullPage: true,
          })
          .catch(() => {});
  }
}
async function app(name, width = 390) {
  const c = await browser.newContext({
    viewport: { width, height: 900 },
    geolocation: { latitude: -3.73, longitude: -38.52, accuracy: 15 },
    permissions: ["geolocation"],
    timezoneId: "America/Fortaleza",
  });
  await c.addInitScript(
    ({ token, user }) => {
      const fix = () => ({
        coords: {
          latitude: -3.73,
          longitude: -38.52,
          accuracy: 15,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      });
      Object.defineProperty(navigator, "geolocation", {
        value: {
          getCurrentPosition: (success) => setTimeout(() => success(fix()), 10),
          watchPosition: (success) => {
            setTimeout(() => success(fix()), 10);
            return setInterval(() => success(fix()), 1000);
          },
          clearWatch: (id) => clearInterval(id),
        },
      });
      localStorage.setItem("@katu:token", token);
      localStorage.setItem("@katu:user", JSON.stringify(user));
    },
    { token: f.tokens[name], user: f.users[name] },
  );
  await c.route("https://vps.katua.com.br/**", async (r) => {
    const u = new URL(r.request().url()),
      response = await r.fetch({
        url: "http://127.0.0.1:3339" + u.pathname + u.search,
      });
    await r.fulfill({
      response,
      headers: { ...response.headers(), "access-control-allow-origin": "*" },
    });
  });
  await c.route(/https:\/\/.*tile\.openstreetmap\.org\//, (r) =>
    r.fulfill({ status: 200, contentType: "image/png", body: png }),
  );
  return { c, p: await c.newPage() };
}
try {
  browser = await chromium.launch({
    executablePath: process.env.KATUA_CHROMIUM_PATH,
    args: chromiumBuild.args.filter((a) => a !== "--single-process"),
    headless: true,
  });
  const errors = [];
  const pc = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await pc.addInitScript(
    ({ token, user }) => {
      localStorage.setItem("auth_token", token);
      localStorage.setItem("auth_user", JSON.stringify(user));
    },
    { token: f.tokens.owner, user: f.users.owner },
  );
  const panel = await pc.newPage();
  panel.on("pageerror", (e) => errors.push(e.message));
  await check(
    "Painel separa gestão de motoristas e de catadores e abre equipes",
    async () => {
      await panel.goto("http://127.0.0.1:5179/collector-teams");
      await panel
        .getByRole("heading", { name: "Equipes de catadores", exact: true })
        .waitFor();
      await panel.getByText("Gestão de Motoristas", { exact: true }).waitFor();
      await panel.getByText("Gestão de Catadores", { exact: true }).waitFor();
      await panel
        .getByRole("cell", { name: "Equipe Aurora", exact: true })
        .waitFor();
    },
  );
  await check(
    "Cadastro visual de equipe salva dois participantes na API real",
    async () => {
      await panel.getByRole("button", { name: "Nova equipe" }).click();
      await panel.getByLabel("Nome da equipe").fill("Equipe Litoral");
      const d = panel.getByRole("dialog");
      await d.getByLabel("Catador a", { exact: true }).check();
      await d.getByLabel("Catador b", { exact: true }).check();
      await d
        .getByRole("button", { name: "Salvar equipe", exact: true })
        .click();
      await panel
        .getByRole("cell", { name: "Equipe Litoral", exact: true })
        .waitFor();
      await panel.screenshot({
        path: out + "/equipes-desktop.png",
        fullPage: true,
      });
    },
  );
  await check(
    "Construção de rota oferece equipe e bloqueia alterações individuais incompatíveis",
    async () => {
      await panel.goto("http://127.0.0.1:5179/create-route");
      await panel.getByLabel("Equipe de trabalho conjunto").waitFor();
      await panel
        .getByLabel("Equipe de trabalho conjunto")
        .selectOption({ label: "Equipe Litoral · 2 catadores" });
      assert.equal(
        await panel.locator('input[type="checkbox"]:checked:disabled').count(),
        2,
      );
    },
  );
  await check(
    "Conferência permite rateio por material com total preservado",
    async () => {
      await panel.goto(
        "http://127.0.0.1:5179/waste-list?coleta=" + f.collectionId,
      );
      const area = panel.getByRole("region", {
        name: "Equipe e divisão dos materiais",
      });
      await area.getByRole("button", { name: "Dividir igualmente" }).waitFor();
      await area.getByRole("button", { name: "Dividir igualmente" }).click();
      await area
        .getByLabel("Justificativa / critério da divisão")
        .fill("Conferência visual: rateio igual entre três participantes");
      await area
        .getByRole("button", { name: "Confirmar divisão", exact: true })
        .click();
      await area.getByText("Divisão confirmada", { exact: true }).waitFor();
      await area
        .getByText("Histórico de divisões (3)", { exact: true })
        .waitFor();
      await panel.screenshot({
        path: out + "/divisao-material-desktop.png",
        fullPage: true,
      });
    },
  );
  await check(
    "Relatórios exibem resumo automático sem configuração nem histórico mensal",
    async () => {
      await panel.goto("http://127.0.0.1:5179/environmental-impact");
      await panel
        .getByRole("heading", { name: "Impacto ambiental", exact: true })
        .waitFor();
      await panel.getByText("118,5 kg CO2e", { exact: true }).waitFor();
      assert.equal(await panel.getByText(/Histórico mensal/).count(), 0);
      await panel.screenshot({
        path: out + "/impacto-geradores-desktop.png",
        fullPage: true,
      });
    },
  );
  await check(
    "Painel de equipes funciona em 390px sem corte horizontal",
    async () => {
      await panel.setViewportSize({ width: 390, height: 900 });
      await panel.goto("http://127.0.0.1:5179/collector-teams");
      await panel
        .getByRole("cell", { name: "Equipe Litoral", exact: true })
        .waitFor();
      assert.ok(
        await panel.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 2,
        ),
      );
      await panel.screenshot({
        path: out + "/equipes-mobile.png",
        fullPage: true,
      });
    },
  );
  await check(
    "App mostra apenas a parcela individual na produção em equipe",
    async () => {
      const a = await app("b");
      a.p.on("pageerror", (e) => errors.push(e.message));
      await a.p.goto("http://127.0.0.1:8089/(catador)/producao-equipe");
      await a.p.getByText("Minha parcela: 13 kg", { exact: true }).waitFor();
      await a.p.getByText("Total da coleta: 39 kg", { exact: true }).waitFor();
      assert.equal(await a.p.getByRole("tab").count(), 5);
      await a.p.screenshot({
        path: out + "/app-producao-equipe.png",
        fullPage: true,
      });
    },
  );
  await check(
    "Aba impacto do gerador usa os mesmos fatores do painel",
    async () => {
      const a = await app("gen");
      a.p.on("pageerror", (e) => errors.push(e.message));
      await a.p.goto("http://127.0.0.1:8089/(gerador)/percentual");
      await a.p.getByText("118,5 kg CO2e", { exact: true }).waitFor();
      await a.p.getByText("Resumo ambiental", { exact: true }).waitFor();
      await a.p.screenshot({
        path: out + "/app-impacto-gerador.png",
        fullPage: true,
      });
    },
  );
  await check("Interfaces sem erros JavaScript durante os cenários", async () =>
    assert.deepEqual(errors, []),
  );
} finally {
  fs.writeFileSync(
    out + "/results.json",
    JSON.stringify(
      {
        passed: results.filter((r) => r.status === "PASS").length,
        failed: results.filter((r) => r.status === "FAIL").length,
        results,
      },
      null,
      2,
    ),
  );
  await browser?.close();
  vite.kill();
  await new Promise((r) => server.close(r));
}
if (results.some((r) => r.status === "FAIL")) process.exitCode = 1;
