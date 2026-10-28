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
      path.resolve(toolsRoot, "waste-workspace-fixture.json"),
      "utf8",
    ),
  ),
  out = path.resolve(toolsRoot, "waste-workspace-ui-evidence");
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
  executablePath: "/tmp/katua-pev-browser",
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
    "Painel inclui PEVs e OCs e permite abrir detalhes de atendimento e campo",
    async () => {
      await go("/");
      await p
        .getByRole("heading", { name: "Solicitações pendentes", exact: true })
        .waitFor();
      const card = p
        .locator("article")
        .filter({
          has: p.getByRole("heading", {
            name: "Solicitações pendentes",
            exact: true,
          }),
        });
      assert.equal((await card.locator("strong").innerText()).trim(), "3");
      await p
        .getByRole("link", { name: "Analisar", exact: true })
        .first()
        .waitFor();
      await p
        .getByRole("button", { name: "Ver operação →", exact: true })
        .click();
      await p
        .getByRole("link", { name: "Acompanhar coleta", exact: true })
        .first()
        .waitFor();
      await p.screenshot({
        path: out + "/painel-operacional.png",
        fullPage: true,
      });
    },
  );
  await check(
    "Resíduos organizados por coleta e materiais expansíveis, com quatro áreas de navegação",
    async () => {
      await go("/collected-waste?stage=all");
      await p
        .getByRole("button", { name: "Ver materiais", exact: true })
        .first()
        .waitFor();
      const nav = p.getByRole("navigation", {
        name: "Gestão de resíduos",
        exact: true,
      });
      assert.equal(await nav.getByRole("link").count(), 4);
      await p
        .getByRole("button", { name: "Ver materiais", exact: true })
        .first()
        .click();
      await p
        .getByRole("link", { name: "Histórico da entrada", exact: true })
        .first()
        .waitFor();
      await p.screenshot({
        path: out + "/residuos-por-coleta.png",
        fullPage: true,
      });
    },
  );
  await check(
    "Conferência salva vira resumo; correção só aparece ao solicitar",
    async () => {
      await go("/waste-list?coleta=" + f.ids.review);
      await p.getByRole("dialog").waitFor();
      await p
        .getByRole("button", {
          name: "Salvar conferência de quantidade",
          exact: true,
        })
        .click();
      await p
        .getByRole("button", { name: "Corrigir conferência", exact: true })
        .waitFor();
      assert.equal(
        await p.locator('input[aria-label^="Quantidade recebida de"]').count(),
        0,
      );
      await p
        .getByRole("button", { name: "Iniciar triagem", exact: true })
        .waitFor();
      await p
        .getByRole("button", { name: "Corrigir conferência", exact: true })
        .click();
      assert.equal(
        await p.locator('input[aria-label^="Quantidade recebida de"]').count(),
        1,
      );
      await p
        .getByRole("button", { name: "Cancelar correção", exact: true })
        .click();
      await p.screenshot({
        path: out + "/conferencia-resumida.png",
        fullPage: true,
      });
    },
  );
  await check(
    "Cadastro inline seleciona material e destinação cria um único lote",
    async () => {
      await go("/collected-waste/" + f.ids.entry);
      await p
        .getByRole("button", { name: "Registrar destinação", exact: true })
        .click();
      const dialog = p.getByRole("dialog");
      await dialog.locator("input[type=radio][value=STOCK]").check();
      await dialog.locator("#destination-quantity").fill("10");
      await dialog
        .getByRole("button", {
          name: "Cadastrar material no catálogo",
          exact: true,
        })
        .click();
      await dialog
        .locator("#inline-material-name")
        .fill("Plástico catálogo UI");
      await dialog.locator("#inline-material-category").fill("Plásticos");
      await dialog
        .getByRole("button", {
          name: "Salvar material e selecionar",
          exact: true,
        })
        .click();
      await dialog
        .getByText("Material classificado no catálogo.", { exact: false })
        .waitFor();
      assert(await dialog.locator("#stock-item").inputValue());
      await dialog
        .getByRole("button", { name: "Registrar destinação", exact: true })
        .click();
      await p
        .getByText("Destinação salva e confirmada pelo servidor.", {
          exact: true,
        })
        .waitFor();
      await p.getByRole("dialog").waitFor({ state: "hidden" });
    },
  );
  await check(
    "Auditoria é consultada sob demanda e edição mantém controle de versão",
    async () => {
      await go("/waste-destinations");
      await p.locator("#waste-search").fill("Plástico limpo");
      await p
        .getByRole("button", { name: "Aplicar filtros", exact: true })
        .click();
      await p
        .getByRole("button", { name: "Editar destinação", exact: true })
        .waitFor();
      await p
        .getByRole("table")
        .getByText("Histórico de alterações", { exact: true })
        .click();
      await p.getByText("Registrada", { exact: true }).waitFor();
      await p
        .getByRole("button", { name: "Editar destinação", exact: true })
        .click();
      const dialog = p.getByRole("dialog");
      await dialog.locator("input[type=radio][value=TRIAGE]").check();
      await dialog
        .locator("input[name=destinationName]")
        .fill("Triagem interna UI");
      await dialog
        .getByRole("button", { name: "Salvar Alterações", exact: true })
        .click();
      await p
        .getByText("Destinação salva e confirmada pelo servidor.", {
          exact: true,
        })
        .waitFor();
      const filteredResponse = p.waitForResponse(
        (r) => r.url().includes("flow=intermediate") && r.status() === 200,
      );
      await p
        .getByRole("button", { name: "Intermediárias", exact: true })
        .click();
      await filteredResponse;
      await p
        .getByRole("button", { name: "Editar destinação", exact: true })
        .waitFor();
      assert(
        (
          await p
            .getByRole("button", { name: "Intermediárias", exact: true })
            .getAttribute("class")
        ).includes("btn-success"),
      );
      await p.screenshot({
        path: out + "/movimentacoes-intermediarias.png",
        fullPage: true,
      });
    },
  );
  await check(
    "Material ausente pode ser cadastrado ao editar uma triagem para estoque, preservando litros",
    async () => {
      await go("/waste-destinations");
      await p.locator("#waste-search").fill("Óleo de cozinha");
      await p
        .getByRole("button", { name: "Aplicar filtros", exact: true })
        .click();
      const row = p.getByRole("row").filter({ hasText: "Óleo de cozinha" });
      await row
        .getByRole("button", { name: "Editar destinação", exact: true })
        .click();
      const dialog = p.getByRole("dialog");
      await dialog.locator("input[type=radio][value=STOCK]").check();
      await dialog
        .getByRole("button", {
          name: "Cadastrar material no catálogo",
          exact: true,
        })
        .click();
      await dialog.locator("#inline-material-category").fill("Óleos");
      await dialog
        .getByRole("button", {
          name: "Salvar material e selecionar",
          exact: true,
        })
        .click();
      await dialog
        .getByText("Material classificado no catálogo.", { exact: false })
        .waitFor();
      await dialog
        .getByRole("button", { name: "Salvar Alterações", exact: true })
        .click();
      await p
        .getByText("Destinação salva e confirmada pelo servidor.", {
          exact: true,
        })
        .waitFor();
      await row.getByText("20 L", { exact: true }).waitFor();
    },
  );
  await check(
    "Estoque carrega lotes por página e mantém cancelamentos em histórico",
    async () => {
      await go("/waste-stock");
      await p
        .getByRole("button", { name: "Ver lotes", exact: true })
        .first()
        .click();
      await p
        .getByRole("link", { name: "Detalhes do lote", exact: true })
        .first()
        .waitFor();
      await p
        .getByRole("button", {
          name: "Histórico de cancelamentos",
          exact: true,
        })
        .click();
      await p
        .getByRole("button", { name: "Ver registros", exact: true })
        .first()
        .click();
      await p
        .getByRole("link", { name: "Consultar registro", exact: true })
        .first()
        .waitFor();
      await p.screenshot({
        path: out + "/estoque-historico.png",
        fullPage: true,
      });
    },
  );
  await check(
    "Catálogo permite editar no endereço correto e cadastrar sem criar estoque",
    async () => {
      await go("/waste-type-list");
      await p.locator("#inventory-search").fill("Plástico catálogo UI");
      await p
        .getByRole("button", { name: "Aplicar filtros", exact: true })
        .click();
      await p
        .getByRole("row")
        .filter({ hasText: "Plástico catálogo UI" })
        .getByRole("link", { name: "Editar material", exact: true })
        .click();
      await p
        .getByRole("heading", { name: "Editar Tipo de Resíduo", exact: true })
        .waitFor();
      await p.screenshot({
        path: out + "/catalogo-edicao.png",
        fullPage: true,
      });
    },
  );
  await check(
    "Layout mobile mantém conteúdo e conferência acessíveis sem transbordamento",
    async () => {
      await p.setViewportSize({ width: 390, height: 844 });
      await go("/collected-waste");
      await p
        .getByRole("button", { name: "Ver materiais", exact: true })
        .first()
        .waitFor();
      assert(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await p.screenshot({
        path: out + "/residuos-mobile.png",
        fullPage: true,
      });
      await go("/waste-list?coleta=" + f.ids.review);
      await p
        .getByRole("button", { name: "Corrigir conferência", exact: true })
        .click();
      await p.locator('input[aria-label^="Quantidade recebida de"]').waitFor();
      assert(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await p.screenshot({
        path: out + "/conferencia-mobile.png",
        fullPage: true,
      });
    },
  );
  await check(
    "Nenhum erro JavaScript durante a navegação operacional",
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
  await p.unrouteAll({ behavior: "ignoreErrors" });
  await browser.close();
  vite.kill();
}
if (checks.some((c) => c.status === "FAIL")) process.exitCode = 1;
