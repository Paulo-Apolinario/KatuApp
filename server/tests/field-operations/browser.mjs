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
const f = JSON.parse(
    fs.readFileSync(
      path.resolve(toolsRoot, "field-operations-fixture.json"),
      "utf8",
    ),
  ),
  out = path.resolve(toolsRoot, "field-operations-ui-evidence");
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
await context.route("http://127.0.0.1:3339/**", async (r) => {
  if (r.request().method() === "OPTIONS")
    return r.fulfill({
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "authorization,content-type",
        "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
      },
    });
  const response = await r.fetch();
  return r.fulfill({
    response,
    headers: { ...response.headers(), "access-control-allow-origin": "*" },
  });
});
await context.route(/tile\.openstreetmap\.org/, (r) => r.abort());
const p = await context.newPage();
p.setDefaultTimeout(15000);
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
    "Painel informa três operações, separando rota fixa, avulsa e coleta individual",
    async () => {
      await go("/");
      const card = p
        .locator("article")
        .filter({
          has: p.getByRole("heading", {
            name: "Operações em campo",
            exact: true,
          }),
        });
      await card.getByText("3", { exact: true }).waitFor();
      await card.getByText(/1 rota\(s\) fixa\(s\)/).waitFor();
      await card
        .getByRole("button", { name: "Ver operação →", exact: true })
        .click();
      await p
        .getByRole("link", { name: "Acompanhar rota", exact: true })
        .first()
        .waitFor();
      await p.screenshot({
        path: out + "/operacoes-em-campo.png",
        fullPage: false,
      });
    },
  );
  await check(
    "Acompanhar rota abre uma execução com seus três pontos e contexto Em campo",
    async () => {
      await p
        .locator(`a[href*="execucao=${f.route}"]`)
        .filter({ hasText: "Acompanhar rota" })
        .click();
      await p.waitForURL(/tipo=fixed/);
      const region = p.getByRole("region", {
        name: "Pontos da execução Fixa diária QA",
        exact: true,
      });
      await region.getByText("PEV · PEV Grupo QA", { exact: true }).waitFor();
      assert.equal(await region.getByRole("row").count(), 4);
      assert.equal(
        await region
          .locator(".badge")
          .filter({ hasText: /^Em campo$/ })
          .count(),
        2,
      );
      await p.screenshot({
        path: out + "/execucao-agrupada.png",
        fullPage: true,
      });
    },
  );
  await check(
    "Cooperativa pode conferir material de um ponto mantendo os demais independentes",
    async () => {
      const region = p.getByRole("region", {
        name: "Pontos da execução Fixa diária QA",
        exact: true,
      });
      const row = region
        .getByRole("row")
        .filter({ hasText: "#" + f.point.slice(-8).toUpperCase() });
      await row
        .getByRole("button", { name: "Ver detalhes", exact: true })
        .click();
      const dialog = p.getByRole("dialog");
      await dialog
        .locator('input[aria-label^="Quantidade recebida de"]')
        .fill("9");
      await dialog
        .locator("#quantity-review-reason")
        .fill("Pesagem conferida na balança de teste.");
      await dialog
        .getByRole("button", {
          name: "Salvar conferência de quantidade",
          exact: true,
        })
        .click();
      await dialog
        .getByRole("button", { name: "Corrigir conferência", exact: true })
        .waitFor();
      await dialog
        .getByRole("button", { name: "Fechar detalhes", exact: true })
        .click();
      await region
        .getByRole("row")
        .filter({ hasText: "PEV Grupo QA" })
        .getByText("Aguardando atendimento neste ponto", { exact: true })
        .waitFor();
    },
  );
  await check(
    "Rotas fixas apresentam um tópico por execução e data, sem repetir pontos na lista principal",
    async () => {
      await go("/waste-list?tipo=fixed");
      await p
        .getByRole("button", { name: "Ver 3 pontos", exact: true })
        .waitFor();
      assert.equal(await p.locator(".fixed-route-operation").count(), 3);
      assert.equal(
        await p.getByRole("region", { name: /Pontos da execução/ }).count(),
        0,
      );
      assert.equal(
        await p
          .locator(".fixed-route-operation")
          .filter({ hasText: "Fixa diária QA" })
          .count(),
        2,
      );
    },
  );
  await check(
    "Coletas normais usam aba própria com atendimento e saída identificados",
    async () => {
      await p
        .getByRole("navigation", { name: "Tipos de coleta", exact: true })
        .getByRole("button", { name: "Coletas normais", exact: true })
        .click();
      const results = p.getByRole("region", {
        name: "Resultados das coletas",
        exact: true,
      });
      await results.getByText("Em atendimento", { exact: true }).waitFor();
      await results.getByText("Em campo", { exact: true }).waitFor();
      assert.equal(await results.getByRole("row").count(), 3);
      await p.locator("#collection-status").selectOption("PENDING");
      await results
        .getByText("Nenhuma coleta corresponde aos filtros selecionados.", {
          exact: true,
        })
        .waitFor();
    },
  );
  await check(
    "Execução e pontos permanecem acessíveis no celular sem transbordamento da página",
    async () => {
      await p.setViewportSize({ width: 390, height: 844 });
      await go(`/waste-list?tipo=fixed&execucao=${f.route}`);
      await p
        .getByRole("region", {
          name: "Pontos da execução Fixa diária QA",
          exact: true,
        })
        .getByText("PEV · PEV Grupo QA", { exact: true })
        .waitFor();
      assert(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await p.screenshot({
        path: out + "/execucao-mobile.png",
        fullPage: true,
      });
    },
  );
  await check(
    "Nenhum erro JavaScript na navegação e conferência dos pontos",
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
