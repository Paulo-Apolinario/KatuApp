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
  panelRoot = process.env.KATUA_PANEL_FRONTEND;
if (!panelRoot || !process.env.KATUA_PEV_UI_FIXTURE)
  throw Error(
    "Informe KATUA_PANEL_FRONTEND e KATUA_PEV_UI_FIXTURE gerada pela API local descartável.",
  );
const f = JSON.parse(fs.readFileSync(process.env.KATUA_PEV_UI_FIXTURE, "utf8")),
  out = path.resolve(
    process.env.KATUA_PEV_UI_OUTPUT || "/tmp/katua-pev-ui-evidence",
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
  let pf, pc, panel, panelContext, reportId;
  await check(
    "PF encontra PEVs públicos no celular com marcador próprio",
    async () => {
      const a = await app("pf");
      pf = a.p;
      pc = a.c;
      pf.on("pageerror", (e) => console.log("BROWSER_ERROR", e.message));
      await pf.goto("http://127.0.0.1:8089/(pf-tabs)/pevs-publicos");
      await pf
        .getByText("PEVs · cuidado compartilhado", { exact: true })
        .waitFor();
      await pf
        .getByRole("button", { name: "Solicitar coleta / informar situação" })
        .first()
        .waitFor();
      await pf.locator(".katua-map-pin svg").first().waitFor();
      await pf.screenshot({
        path: out + "/pf-pevs-mobile.png",
        fullPage: true,
      });
    },
  );
  await check(
    "PF envia pedido com foto e confirmação da cooperativa",
    async () => {
      await pf
        .getByLabel("Buscar PEV por nome, código, bairro ou município")
        .fill("Teste de interface");
      await pf
        .getByRole("button", { name: "Buscar pontos", exact: true })
        .click();
      await pf.waitForTimeout(600);
      await pf
        .getByRole("button", { name: "Solicitar coleta / informar situação" })
        .click();
      await pf
        .getByLabel("Descreva a situação")
        .fill("PEV cheio na calçada. Teste de interface.");
      const chosen = pf.waitForEvent("filechooser");
      await pf
        .getByRole("button", { name: "Escolher foto", exact: true })
        .click();
      await (
        await chosen
      ).setFiles({ name: "pev.png", mimeType: "image/png", buffer: png });
      await pf.getByRole("button", { name: "Remover foto 1" }).waitFor();
      await pf
        .getByRole("button", {
          name: "Confirmo o PEV e a cooperativa de destino",
          exact: true,
        })
        .click();
      const response = pf.waitForResponse(
        (r) =>
          r.url().endsWith("/pev-requests") && r.request().method() === "POST",
      );
      await pf
        .getByRole("button", { name: "Enviar solicitação", exact: true })
        .click();
      const r = await response;
      assert.equal(r.status(), 201);
      const data = await r.json();
      reportId = data.request.id;
      assert.equal(data.request.photos.length, 1);
      await pf
        .getByText(
          "Pedido enviado à cooperativa responsável. Guarde o protocolo para acompanhar.",
        )
        .waitFor();
      await pf.screenshot({
        path: out + "/pf-protocolo-mobile.png",
        fullPage: true,
      });
    },
  );
  await check("Painel exibe relato, foto e catadores reais", async () => {
    panelContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await panelContext.addInitScript(
      ({ token, user }) => {
        localStorage.setItem("auth_token", token);
        localStorage.setItem("auth_user", JSON.stringify(user));
      },
      { token: f.tokens.owner, user: f.users.owner },
    );
    panel = await panelContext.newPage();
    await panel.goto("http://127.0.0.1:5179/bin-list");
    await panel
      .getByRole("heading", { name: "Solicitações recebidas pelo App" })
      .waitFor();
    const card = panel
      .locator("article")
      .filter({ hasText: "PEV cheio na calçada. Teste de interface." })
      .first();
    await card
      .getByRole("button", { name: "Ver relato, fotos e tratar pedido" })
      .click();
    await panel.getByAltText("Situação do PEV, foto 1").waitFor();
    await panel
      .getByLabel("Catador para retirada")
      .selectOption({ label: "Catador da Rua" });
    await panel.screenshot({
      path: out + "/painel-relato-desktop.png",
      fullPage: true,
    });
  });
  await check("Cooperativa delega retirada e responde pela tela", async () => {
    await panel
      .getByRole("button", { name: "Vincular retirada ao catador" })
      .click();
    await panel
      .getByText(
        "Retirada vinculada ao fluxo de coletas. Materiais e peso serão registrados em campo.",
      )
      .waitFor();
    await panel
      .getByLabel("Resposta / justificativa")
      .fill("Equipe acionada para retirar os materiais deste ponto.");
    await panel
      .getByRole("button", { name: "Registrar resposta", exact: true })
      .click();
    await panel
      .getByText("Resposta registrada. O solicitante receberá um aviso no App.")
      .waitFor();
    await pf.getByRole("button", { name: "Atualizar protocolo" }).click();
    await pf
      .getByText(
        "Cooperativa: Equipe acionada para retirar os materiais deste ponto.",
      )
      .waitFor();
  });
  await check("Aviso no sino do PF abre o protocolo correto", async () => {
    await pf.getByRole("button", { name: /Notificações, / }).click();
    await pf
      .getByRole("button", { name: /Resposta à solicitação do PEV/ })
      .first()
      .click();
    await pf.waitForURL(/pevs-publicos\?requestId=/);
    await pf
      .getByText(`PROTOCOLO · ${reportId}`, { exact: true })
      .filter({ visible: true })
      .waitFor();
  });
  await check(
    "Catador abre coleta pelo protocolo sem duplicar retirada",
    async () => {
      const a = await app("cat");
      await a.p.goto(
        `http://127.0.0.1:8089/(catador)/pev-atendimento?requestId=${reportId}`,
      );
      await a.p
        .getByText(`PROTOCOLO · ${reportId}`, { exact: true })
        .filter({ visible: true })
        .waitFor();
      await a.p.screenshot({
        path: out + "/catador-pedido-mobile.png",
        fullPage: true,
      });
      await a.p.getByRole("button", { name: "Abrir coleta deste PEV" }).click();
      await a.p.waitForURL(/\/collect/);
      await a.c.close();
    },
  );
  await check("Rascunho offline permanece ao recarregar", async () => {
    await pf.goto("http://127.0.0.1:8089/(pf-tabs)/pevs-publicos");
    await pf
      .getByRole("button", { name: "Solicitar coleta / informar situação" })
      .first()
      .waitFor();
    await pf
      .getByRole("button", { name: "Encontrar PEV", exact: true })
      .click();
    await pf
      .getByRole("button", { name: "Solicitar coleta / informar situação" })
      .first()
      .click();
    await pf
      .getByLabel("Descreva a situação")
      .fill("Rascunho offline preservado neste aparelho.");
    await pf.waitForTimeout(300);
    await pc.setOffline(true);
    await pf.evaluate(() => window.dispatchEvent(new Event("offline")));
    await pf
      .getByRole("button", {
        name: "Confirmo o PEV e a cooperativa de destino",
        exact: true,
      })
      .click();
    await pf
      .getByRole("button", { name: "Enviar solicitação", exact: true })
      .click();
    await pf
      .getByText(
        "Conecte-se para enviar. O rascunho do novo pedido permanece neste aparelho.",
      )
      .waitFor();
    assert.ok(
      await pf.evaluate(() =>
        Object.keys(localStorage).some(
          (k) =>
            k.startsWith("@katu:pev-request-draft:") &&
            localStorage.getItem(k).includes("Rascunho offline"),
        ),
      ),
    );
    await pc.setOffline(false);
    await pf.reload();
    await pf.getByRole("button", { name: "Retomar pedido" }).waitFor();
    await pf.getByRole("button", { name: "Retomar pedido" }).click();
    assert.equal(
      await pf.getByLabel("Descreva a situação").inputValue(),
      "Rascunho offline preservado neste aparelho.",
    );
  });
  await check(
    "Motorista tem marcador de veículo na posição do GPS",
    async () => {
      const a = await app("driver");
      await a.p.goto("http://127.0.0.1:8089/(motorista)/mapa");
      await a.p
        .locator(
          '.katua-map-pin svg path[d="m5 9 2-5h10l2 5M4 9h16v9H4zM7 18v2m10-2v2M7 13h1m8 0h1"]',
        )
        .first()
        .waitFor();
      await a.p.screenshot({
        path: out + "/motorista-marcadores-mobile.png",
        fullPage: true,
      });
      await a.c.close();
    },
  );
  await check(
    "Catador tem símbolo de pessoa e pontos PEV usam ícone próprio",
    async () => {
      const a = await app("cat");
      await a.p.goto("http://127.0.0.1:8089/(catador)/mapas");
      await a.p
        .locator('.katua-map-pin svg circle[cx="12"][cy="7"]')
        .first()
        .waitFor();
      await a.p
        .locator(
          '.katua-map-pin svg path[d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"]',
        )
        .first()
        .waitFor();
      await a.p.screenshot({
        path: out + "/catador-marcadores-mobile.png",
        fullPage: true,
      });
      await a.c.close();
    },
  );
  await check("Protocolo cabe em celular de 320 px", async () => {
    await pc.setOffline(false);
    await pf.setViewportSize({ width: 320, height: 800 });
    await pf.goto(
      `http://127.0.0.1:8089/(pf-tabs)/pevs-publicos?requestId=${reportId}`,
    );
    await pf
      .getByText(`PROTOCOLO · ${reportId}`, { exact: true })
      .filter({ visible: true })
      .waitFor();
    const b = await pf.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    assert.ok(b.scroll <= b.width + 1, JSON.stringify(b));
    await pf.screenshot({
      path: out + "/pf-protocolo-320.png",
      fullPage: true,
    });
  });
  await check(
    "Cadastro do PEV permite habilitar publicação no App",
    async () => {
      await panel.goto(`http://127.0.0.1:5179/edit-bin/${f.bin.id}`);
      const checkbox = panel.getByRole("checkbox", {
        name: /PEV de acesso público/,
      });
      await checkbox.waitFor();
      assert.ok(await checkbox.isChecked());
      await panel.screenshot({
        path: out + "/painel-publicacao-pev.png",
        fullPage: true,
      });
    },
  );
} finally {
  fs.writeFileSync(
    out + "/results.json",
    JSON.stringify(
      {
        passed: results.filter((r) => r.status === "PASS").length,
        failed: results.filter((r) => r.status === "FAIL").length,
        checks: results,
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
