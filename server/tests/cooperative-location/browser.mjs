/** Interface web real; API, GPS e tiles controlados. Sem emissão de cadastro e sem VPS. */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const toolsRoot = process.env.KATUA_VALIDATION_TOOLS;
if (!toolsRoot)
  throw Error("Informe KATUA_VALIDATION_TOOLS com Playwright e Chromium.");
const require = createRequire(path.resolve(toolsRoot, "package.json"));
const { chromium } = require("playwright");
const build = (await import(require.resolve("@sparticuz/chromium"))).default;
const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../..",
  ),
  out = path.resolve(toolsRoot, "cooperative-location-evidence");
fs.mkdirSync(out, { recursive: true });
const servers = [];
for (const [port, base] of [
  [8089, root + "/katua-app/dist"],
  [5179, root + "/pev-web/frontend/dist"],
]) {
  const s = http.createServer((req, res) => {
    let name = decodeURIComponent(req.url.split("?")[0]);
    if (name.includes("..")) {
      res.writeHead(403);
      return res.end();
    }
    let f = base + name;
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f += "/index.html";
    if (!fs.existsSync(f) && fs.existsSync(f + ".html")) f += ".html";
    if (!fs.existsSync(f)) f = base + "/index.html";
    res.setHeader(
      "Content-Type",
      {
        ".js": "application/javascript",
        ".css": "text/css",
        ".html": "text/html",
        ".png": "image/png",
        ".ttf": "font/ttf",
      }[path.extname(f)] || "application/octet-stream",
    );
    res.end(fs.readFileSync(f));
  });
  await new Promise((r) => s.listen(port, "127.0.0.1", r));
  servers.push(s);
}
build.setGraphicsMode = false;
const browser = await chromium.launch({
  executablePath:
    process.env.KATUA_BROWSER_EXECUTABLE || "/tmp/katua-pev-browser",
  args: build.args.filter((x) => x !== "--single-process"),
  headless: true,
});
const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, status: "PASS" });
    console.log("PASS", name);
  } catch (e) {
    results.push({ name, status: "FAIL", error: e.message });
    console.log("FAIL", name, e.message);
  }
}
const ctx = await browser.newContext({
  viewport: { width: 1200, height: 960 },
  permissions: ["geolocation"],
  geolocation: { latitude: -3.74, longitude: -38.54, accuracy: 15 },
});
await ctx.route(/tile\.openstreetmap\.org/, (r) =>
  r.fulfill({
    status: 200,
    contentType: "image/png",
    body: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=",
      "base64",
    ),
  }),
);
const p = await ctx.newPage();
p.on("pageerror", (e) => console.log("PAGEERROR", e.message));
const lat = p.getByRole("textbox", { name: "Latitude", exact: true }),
  lng = p.getByRole("textbox", { name: "Longitude", exact: true }),
  confirm = p.getByRole("button", {
    name: "Confirmar localização",
    exact: true,
  });
try {
  await check(
    "Sem ponto inicial: não permite salvar o centro padrão",
    async () => {
      await p.goto("http://127.0.0.1:8089/select-location");
      await confirm.waitFor();
      assert(await confirm.isDisabled());
      assert.equal(await lat.inputValue(), "");
    },
  );
  await check(
    "Coordenadas manuais com vírgula posicionam marcador",
    async () => {
      await lat.fill("-3,731900");
      await lng.fill("-38,526700");
      await p
        .getByRole("button", { name: "Aplicar coordenadas no mapa" })
        .click();
      assert(!(await confirm.isDisabled()));
      await p.locator(".leaflet-marker-draggable").waitFor();
      assert.equal(await lat.inputValue(), "-3.731900");
    },
  );
  await check(
    "Edição incompleta e fora dos limites bloqueia confirmação",
    async () => {
      await lat.fill("-");
      assert(await confirm.isDisabled());
      await p
        .getByRole("button", { name: "Aplicar coordenadas no mapa" })
        .click();
      await p.getByRole("alert").waitFor();
      await lat.fill("91");
      await p
        .getByRole("button", { name: "Aplicar coordenadas no mapa" })
        .click();
      assert(await confirm.isDisabled());
      await lat.fill("-3.731900");
      await p
        .getByRole("button", { name: "Aplicar coordenadas no mapa" })
        .click();
    },
  );
  await check("Arrastar marcador altera as coordenadas", async () => {
    const marker = p.locator(".leaflet-marker-draggable");
    await marker.scrollIntoViewIfNeeded();
    const b = await marker.boundingBox(),
      before = await lng.inputValue();
    await p.mouse.move(b.x + b.width / 2, b.y + 15);
    await p.mouse.down();
    await p.mouse.move(b.x + b.width / 2 + 65, b.y + 35, { steps: 12 });
    await p.mouse.up();
    await p.waitForTimeout(150);
    assert.notEqual(await lng.inputValue(), before);
    assert(!(await confirm.isDisabled()));
  });
  await check("Clique no mapa reposiciona pino", async () => {
    const b = await p.locator(".leaflet-container").boundingBox(),
      before = await lat.inputValue();
    await p.mouse.click(b.x + b.width * 0.65, b.y + b.height * 0.65);
    assert.notEqual(await lat.inputValue(), before);
    await p.screenshot({ path: out + "/mapa-desktop.png", fullPage: true });
  });
  await check(
    "Mobile sem transbordamento e confirmação devolve ponto ao cadastro",
    async () => {
      await p.setViewportSize({ width: 390, height: 844 });
      await confirm.scrollIntoViewIfNeeded();
      assert(await confirm.isVisible());
      assert(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      );
      await p.screenshot({ path: out + "/mapa-mobile.png", fullPage: true });
      const saved = Number(await lat.inputValue());
      await confirm.click();
      await p.waitForURL("**/register?**");
      await p.getByText("Localização selecionada", { exact: true }).waitFor();
      assert(
        (await p.locator("body").innerText()).includes(
          String(saved).slice(0, 7),
        ),
      );
      await p.getByText("SELECIONAR NO MAPA", { exact: true }).click();
      await lat.waitFor();
      assert(Math.abs(Number(await lat.inputValue()) - saved) < 0.000002);
    },
  );
  const panel = await browser.newContext({
    viewport: { width: 1366, height: 900 },
  });
  await panel.addInitScript(() => {
    localStorage.setItem("auth_token", "local-ui-test");
    localStorage.setItem(
      "auth_user",
      JSON.stringify({
        id: "local-coop",
        role: "COOPERATIVE",
        name: "Cooperativa local",
      }),
    );
  });
  let schedules = 0;
  await panel.route("https://vps.katua.com.br/**", async (r) => {
    const u = new URL(r.request().url());
    let data = {};
    if (u.pathname === "/auth/me")
      data = {
        user: {
          id: "local-coop",
          role: "COOPERATIVE",
          name: "Cooperativa local",
        },
      };
    if (u.pathname === "/schedules") {
      schedules++;
      data = { schedules: [] };
      await new Promise((r) => setTimeout(r, 300));
    }
    await r.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(data),
    });
  });
  const q = await panel.newPage();
  await check("Botão de atualizar compacto e funcional no painel", async () => {
    await q.goto("http://127.0.0.1:5179/collection-requests");
    const btn = q.getByRole("button", {
      name: "Atualizar solicitações",
      exact: true,
    });
    await btn.waitFor();
    const b = await btn.boundingBox();
    assert(b.height <= 52, `altura ${b.height}`);
    const before = schedules;
    await btn.click();
    await q.getByRole("button", { name: "Atualizando…" }).waitFor();
    await btn.waitFor();
    assert(schedules > before);
    await q.screenshot({ path: out + "/botao-desktop.png", fullPage: true });
    await q.setViewportSize({ width: 390, height: 844 });
    await btn.scrollIntoViewIfNeeded();
    assert((await btn.boundingBox()).height <= 52);
    await q.screenshot({ path: out + "/botao-mobile.png", fullPage: true });
  });
} finally {
  fs.writeFileSync(out + "/results.json", JSON.stringify(results, null, 2));
  await browser.close();
  for (const s of servers) s.close();
}
if (results.some((r) => r.status !== "PASS")) process.exitCode = 1;
