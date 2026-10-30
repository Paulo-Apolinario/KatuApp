import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdtemp, writeFile, stat } from "node:fs/promises";
import { resolve, join, extname } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
const root = resolve(
  process.env.KATUA_APP_WEB_EXPORT ||
    "../../validation-tools/app-location-export",
);
const out = await mkdtemp(
  join(process.env.KATUA_VALIDATION_OUTPUT_ROOT || tmpdir(), "katua-app-gps-"),
);
const req = createRequire(
  resolve(process.env.KATUA_VALIDATION_TOOLS, "package.json"),
);
const { chromium } = req(process.env.KATUA_PLAYWRIGHT_MODULE || "playwright");
const server = createServer(async (r, p) => {
  try {
    let file = resolve(
      root,
      "." + decodeURIComponent(new URL(r.url, "http://localhost").pathname),
    );
    if (!file.startsWith(root + "/") && file !== root) {
      p.writeHead(403).end();
      return;
    }
    if (file === root) file = join(root, "index.html");
    try {
      if ((await stat(file)).isDirectory()) file = join(file, "index.html");
    } catch {
      file += ".html";
    }
    const body = await readFile(file);
    const types = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".wasm": "application/wasm",
      ".json": "application/json",
      ".png": "image/png",
      ".ttf": "font/ttf",
    };
    p.writeHead(200, {
      "Content-Type": types[extname(file)] || "application/octet-stream",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    });
    p.end(body);
  } catch {
    p.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(8089, "127.0.0.1", r));
let browser;
const outcomes = [];
async function check(name, fn) {
  try {
    await fn();
    outcomes.push({ name, status: "PASS" });
    console.log("PASS", name);
  } catch (e) {
    outcomes.push({ name, status: "FAIL", error: e.message });
    console.log("FAIL", name, e.message);
  }
}
try {
  browser = await chromium.launch({
    executablePath: process.env.KATUA_CHROMIUM_PATH,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
    headless: true,
  });
  const c = await browser.newContext({
    permissions: ["geolocation"],
    geolocation: { latitude: -3.68, longitude: -40.35, accuracy: 20 },
    viewport: { width: 390, height: 844 },
  });
  async function prepare(context) {
    await context.addInitScript(() => {
      localStorage.setItem("@katu:token", "gps-test-session");
      localStorage.setItem("@katu:user", JSON.stringify({id:"gps-test",role:"PF",displayName:"Teste GPS"}));
    });
    await context.route("**/*", (r) => {
      const url = new URL(r.request().url());
      if (url.pathname === "/auth/me") return r.fulfill({status:200,contentType:"application/json",headers:{"Access-Control-Allow-Origin":"*"},body:JSON.stringify({user:{id:"gps-test",role:"PF",displayName:"Teste GPS"}})});
      return ["127.0.0.1", "localhost"].includes(url.hostname) ? r.continue() : r.abort();
    });
  }
  await prepare(c);
  const p = await c.newPage(),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await check(
    "App web exportado: posição permitida mostra precisão sem consulta externa",
    async () => {
      await p.goto("http://127.0.0.1:8089/(pf-tabs)/home");
      await p
        .getByText(/Posição obtida do aparelho.*20 m/)
        .waitFor({ timeout: 30000 });
      await p.screenshot({
        path: join(out, "app-gps-permitido.png"),
        fullPage: true,
      });
      assert.deepEqual(errors, []);
    },
  );
  await check(
    "App web exportado: negação de localização tem mensagem explícita",
    async () => {
      const denied = await browser.newContext({
        viewport: { width: 390, height: 844 },
      });
      await denied.addInitScript(() => {
        Object.defineProperty(navigator, "geolocation", {
          configurable: true,
          value: {
            getCurrentPosition: (_ok, error) =>
              error({ code: 1, message: "denied" }),
          },
        });
      });
      await prepare(denied);
      const page = await denied.newPage();
      await page.goto("http://127.0.0.1:8089/(pf-tabs)/home");
      await page
        .getByText(/Permissão negada\. Libere a localização/)
        .waitFor({ timeout: 30000 });
      await page.screenshot({
        path: join(out, "app-gps-negado.png"),
        fullPage: true,
      });
      await denied.close();
    },
  );
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
  await writeFile(
    join(out, "results.json"),
    JSON.stringify(
      {
        environment:
          "Export Expo web estático real + Chromium com geolocalização simulada do aparelho; sem chamadas externas",
        outcomes,
      },
      null,
      2,
    ),
  );
  console.log("REPORT_DIR", out);
  if (outcomes.some((x) => x.status === "FAIL")) process.exitCode = 1;
}
