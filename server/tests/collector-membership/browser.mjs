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
      path.resolve(toolsRoot, "collector-membership-fixture.json"),
      "utf8",
    ),
  ),
  out = path.resolve(toolsRoot, "collector-membership-ui-evidence");
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
  executablePath: process.env.KATUA_CHROMIUM_PATH || await build.executablePath(),
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
  await check("Cadastro apresenta filiação, inscrição, quatro categorias e somente status Ativo/Inativo", async () => {
    await go("/create-collector");
    await p.getByLabel("Data de Filiação", { exact: true }).waitFor();
    const ids = await p.locator("#associationDate, #registrationNumber, #membershipCategory, #isAutonomous, #status").evaluateAll(elements => elements.map(e => e.id));
    assert.deepEqual(ids, ["associationDate", "registrationNumber", "membershipCategory", "isAutonomous", "status"]);
    assert.deepEqual(await p.locator("#status option").allTextContents(), ["Ativo", "Inativo"]);
    assert.deepEqual(await p.locator("#membershipCategory option").allTextContents(), ["Selecione a categoria", "Fundador", "Efetivo", "Beneficiado", "Contribuinte"]);
    await p.locator("#name").fill("Catadora interface");
    await p.locator("#email").fill("ui@collector.test.invalid");
    await p.locator("#associationDate").fill("2026-10-28");
    await p.locator("#registrationNumber").fill("001/UI");
    await p.locator("#membershipCategory").selectOption("BENEFICIARY");
    await p.getByRole("button", { name: "Salvar Catador", exact: true }).click();
    await p.waitForURL("**/collector-list");
    await p.getByRole("row").filter({ hasText: "Catadora interface" }).getByRole("link", { name: "Editar cadastro", exact: true }).waitFor();
  });
  await check("Editar cadastro carrega e salva os dados existentes e atualiza a lista", async () => {
    await p.getByRole("row").filter({ hasText: "Catadora interface" }).getByRole("link", { name: "Editar cadastro", exact: true }).click();
    await p.getByRole("heading", { name: "Editar Catador", exact: true }).waitFor();
    await p.locator("#registrationNumber").waitFor();
    assert.equal(await p.locator("#registrationNumber").inputValue(), "001/UI");
    assert.equal(await p.locator("#membershipCategory").inputValue(), "BENEFICIARY");
    assert.equal(await p.locator("#associationDate").inputValue(), "2026-10-28");
    await p.locator("#registrationNumber").fill("0009/UI");
    await p.locator("#membershipCategory").selectOption("CONTRIBUTOR");
    await p.locator("#isAutonomous").selectOption("true");
    await p.locator("#status").selectOption("INACTIVE");
    await p.getByRole("button", { name: "Salvar alterações", exact: true }).click();
    await p.waitForURL("**/collector-list");
    const row=p.getByRole("row").filter({ hasText: "Catadora interface" });
    await row.getByText("Inscrição: 0009/UI", { exact: true }).waitFor();
    await row.getByText("Contribuinte", { exact: true }).waitFor();
    await row.getByText("Inativo", { exact: true }).waitFor();
    await p.screenshot({ path: out + "/lista-catadores.png", fullPage: true });
  });
  await check("Catador anterior à atualização pode receber os novos dados sem recriação", async () => {
    await go("/edit-collector/" + f.id);
    await p.locator("#registrationNumber").waitFor();
    assert.equal(await p.locator("#name").inputValue(), "Nome corrigido");
    assert.equal(await p.getByRole("link", { name: "Gerenciar documentos", exact: true }).count(), 0);
    assert.equal(await p.getByRole("heading", { name: "Documentos do catador", exact: true }).count(), 0);
    assert.equal(await p.locator("input[type=file]").count(), 0);
    await p.locator("#registrationNumber").fill("007/LEG");
    await p.locator("#membershipCategory").selectOption("FOUNDER");
    await p.locator("#associationDate").fill("2020-05-12");
    await p.screenshot({ path: out + "/editar-catador.png", fullPage: true });
    await p.getByRole("button", { name: "Salvar alterações", exact: true }).click();
    await p.waitForURL("**/collector-list");
    await p.getByRole("row").filter({ hasText: "Nome corrigido" }).getByText("Inscrição: 007/LEG", { exact: true }).waitFor();
  });
  await check("Formulário mantém campos acessíveis e sem corte horizontal no celular", async () => {
    await p.setViewportSize({ width: 390, height: 844 });
    await go("/edit-collector/" + f.id);
    await p.locator("#membershipCategory").waitFor();
    await p.locator("#associationDate").scrollIntoViewIfNeeded();
    assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await p.screenshot({ path: out + "/filiacao-mobile.png" });
  });
  await check("Falha ao carregar cadastro não oferece formulário vazio para salvar", async () => {
    await go("/edit-collector/inexistente-teste");
    await p.getByRole("button", { name: "Tentar novamente", exact: true }).waitFor();
    assert.equal(await p.getByRole("button", { name: "Salvar alterações", exact: true }).count(), 0);
  });
  await check("Navegação cadastral sem erros JavaScript", async () => { assert.deepEqual(errors, []); });
} finally {
  fs.writeFileSync(out + "/results.json", JSON.stringify({ passed: checks.filter(c => c.status === "PASS").length, failed: checks.filter(c => c.status === "FAIL").length, checks }, null, 2));
  await context.unrouteAll({ behavior: "ignoreErrors" });
  await browser.close(); vite.kill();
}
if (checks.some(c => c.status === "FAIL")) process.exitCode=1;
