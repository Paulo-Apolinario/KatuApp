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
      path.resolve(toolsRoot, "monthly-ui-evidence"),
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
  const errors = [],
    pc = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
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
    "Painel abre o mês atual com impacto geral de todas as origens",
    async () => {
      await panel.goto("http://127.0.0.1:5179/environmental-impact");
      await panel
        .getByRole("heading", { name: "Impacto ambiental mensal", exact: true })
        .waitFor();
      await panel.getByText("52 kg", { exact: true }).waitFor();
      await panel.getByText("90 kg CO2e", { exact: true }).waitFor();
      await panel.getByRole("cell", { name: "PEVs", exact: true }).waitFor();
      await panel
        .getByRole("cell", {
          name: "Pessoa física / coletas avulsas",
          exact: true,
        })
        .waitFor();
      await panel.screenshot({
        path: out + "/painel-impacto-mensal.png",
        fullPage: true,
      });
    },
  );
  await check(
    "Mês anterior conserva valores e solicitações não entram no peso",
    async () => {
      await panel.getByLabel("Mês de referência").fill("2026-09");
      await panel.getByText("20 kg", { exact: true }).first().waitFor();
      await panel.getByText("40 kg CO2e", { exact: true }).waitFor();
      await panel.getByLabel("Mês de referência").fill("2026-10");
      await panel.getByText("52 kg", { exact: true }).waitFor();
      await panel
        .getByText("1 solicitações registradas · 1 pendentes de atendimento.", {
          exact: true,
        })
        .waitFor();
    },
  );
  await check(
    "Filtro do gerador restringe mês e acumulado sem apagar histórico",
    async () => {
      await panel.getByLabel("Abrangência").selectOption(f.generator.id);
      await panel.getByText("37 kg", { exact: true }).first().waitFor();
      await panel.getByText("60 kg CO2e", { exact: true }).waitFor();
      await panel.getByLabel("Abrangência").selectOption("");
      await panel.getByText("52 kg", { exact: true }).waitFor();
    },
  );
  await check(
    "CSV entrega os doze registros mensais e separa indicadores e solicitações",
    async () => {
      const waiting = panel.waitForEvent("download");
      await panel.getByRole("button", { name: "Baixar CSV mensal" }).click();
      const d = await waiting;
      assert.ok(d.suggestedFilename().startsWith("impacto-ambiental-mensal-"));
      const csv = fs.readFileSync(await d.path(), "utf8");
      assert.equal(csv.trim().split("\r\n").length, 13);
      assert.ok(csv.includes('"2026-10";"4";"52"'));
    },
  );
  await check(
    "Configuração permite fatores de água, energia e árvores junto ao CO2",
    async () => {
      await panel.goto("http://127.0.0.1:5179/analytics-dashboard");
      await panel
        .getByRole("button", { name: "Configurar metas e metodologia" })
        .click();
      await panel
        .getByLabel("Fator 1 — litros de água por kg de material")
        .waitFor();
      await panel.getByLabel("Fator 1 — kWh por kg de material").waitFor();
      await panel
        .getByLabel("Fator 1 — árvores equivalentes por kg de material")
        .waitFor();
    },
  );
  await check(
    "Painel mensal em celular mantém filtros e conteúdo sem transbordar a página",
    async () => {
      await panel.setViewportSize({ width: 390, height: 900 });
      await panel.goto("http://127.0.0.1:5179/environmental-impact");
      await panel.getByText("52 kg", { exact: true }).waitFor();
      assert.ok(
        await panel.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 2,
        ),
      );
      await panel.screenshot({
        path: out + "/painel-impacto-mobile.png",
        fullPage: true,
      });
    },
  );
  await check(
    "App do gerador mostra o mesmo mês, acumulado e histórico com troca de ano",
    async () => {
      const a = await app("gen");
      a.p.on("pageerror", (e) => errors.push(e.message));
      await a.p.goto("http://127.0.0.1:8089/(gerador)/percentual");
      await a.p.getByText("37 kg coletados no mês", { exact: true }).waitFor();
      await a.p.getByText("60 kg CO2e", { exact: true }).waitFor();
      await a.p
        .getByRole("button", { name: "Mês anterior", exact: true })
        .click();
      await a.p.getByText("20 kg coletados no mês", { exact: true }).waitFor();
      await a.p
        .getByRole("button", { name: "Consultar janeiro de 2026", exact: true })
        .click();
      await a.p
        .getByRole("button", { name: "Mês anterior", exact: true })
        .click();
      await a.p.getByText("Acumulado de 2025: 0 kg", { exact: true }).waitFor();
      await a.p
        .getByRole("button", { name: "Próximo mês", exact: true })
        .click();
      await a.p
        .getByRole("button", { name: "Consultar outubro de 2026", exact: true })
        .click();
      await a.p.getByText("37 kg coletados no mês", { exact: true }).waitFor();
      await a.p
        .getByRole("button", { name: "Ocultar histórico mensal", exact: true })
        .click();
      await a.p
        .getByText("Impacto ambiental mensal", { exact: true })
        .scrollIntoViewIfNeeded();
      await a.p.screenshot({ path: out + "/gerador-impacto-mensal.png" });
    },
  );
  await check(
    "Resumo ambiental do catador permanece preenchido antes da divisão da equipe",
    async () => {
      const a = await app("b");
      a.p.on("pageerror", (e) => errors.push(e.message));
      await a.p.goto("http://127.0.0.1:8089/(catador)/homecat");
      await a.p.getByText("Resumo ambiental mensal", { exact: true }).waitFor();
      await a.p.getByText("30 kg coletados no mês", { exact: true }).waitFor();
      await a.p.getByText("60 kg CO2e", { exact: true }).waitFor();
      assert.equal(
        await a.p
          .getByText("Estimativas com base no peso coletado hoje", {
            exact: true,
          })
          .count(),
        0,
      );
      await a.p
        .getByRole("button", { name: "Ver histórico mensal", exact: true })
        .click();
      await a.p
        .getByRole("button", {
          name: "Consultar setembro de 2026",
          exact: true,
        })
        .click();
      await a.p.getByText("0 kg coletados no mês", { exact: true }).waitFor();
      await a.p
        .getByRole("button", { name: "Consultar outubro de 2026", exact: true })
        .click();
      await a.p.getByText("30 kg coletados no mês", { exact: true }).waitFor();
      await a.p
        .getByRole("button", { name: "Ocultar histórico mensal", exact: true })
        .click();
      await a.p
        .getByText("Resumo ambiental mensal", { exact: true })
        .scrollIntoViewIfNeeded();
      await a.p.screenshot({ path: out + "/catador-impacto-mensal.png" });
    },
  );
  await check(
    "Nenhum erro JavaScript nos cenários de impacto mensal",
    async () => assert.deepEqual(errors, []),
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
