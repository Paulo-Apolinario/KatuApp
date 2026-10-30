import assert from "node:assert/strict";
import { createRequire } from "node:module";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const toolsRoot = process.env.KATUA_VALIDATION_TOOLS;
if (!toolsRoot) throw Error("KATUA_VALIDATION_TOOLS obrigatório");
const require = createRequire(path.resolve(toolsRoot, "package.json"));
const { chromium } = require("playwright");
const build = (await import(require.resolve("@sparticuz/chromium"))).default;
const root =
  process.env.KATUA_APP_DIST || path.join(toolsRoot, "app-review-dist");
const out = path.join(toolsRoot, "app-route-ui-evidence");
fs.mkdirSync(out, { recursive: true });
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(
    new URL(req.url, "http://local").pathname,
  );
  let file = path.resolve(root, "." + pathname);
  if (
    !file.startsWith(path.resolve(root) + path.sep) &&
    file !== path.resolve(root)
  ) {
    res.writeHead(403);
    return res.end();
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory())
    file = fs.existsSync(file + ".html")
      ? file + ".html"
      : path.join(root, "index.html");
  const ext = path.extname(file);
  res.setHeader(
    "content-type",
    {
      ".html": "text/html",
      ".js": "application/javascript",
      ".css": "text/css",
      ".woff": "font/woff",
      ".ttf": "font/ttf",
      ".json": "application/json",
    }[ext] || "application/octet-stream",
  );
  res.end(fs.readFileSync(file));
});
await new Promise((r) => server.listen(5180, "127.0.0.1", r));
const browser = await chromium.launch({
  executablePath:
    process.env.KATUA_CHROMIUM_PATH || (await build.executablePath()),
  args: build.args.filter((a) => a !== "--single-process"),
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  locale: "pt-BR",
  timezoneId: "America/Fortaleza",
});
const user = {
  id: "member-user",
  email: "member@test.invalid",
  displayName: "Integrante QA",
  role: "COLLECTOR",
  collector: { id: "member", name: "Integrante QA", cooperativeId: "coop" },
};
await context.addInitScript((user) => {
  localStorage.setItem("@katu:token", "local-ui-fixture");
  localStorage.setItem("@katu:user", JSON.stringify(user));
  localStorage.setItem(
    "@katu:offline:session_local",
    JSON.stringify([
      {
        id: 1,
        token: "local-ui-fixture",
        user_id: user.id,
        payload_json: JSON.stringify(user),
        updated_at: new Date().toISOString(),
      },
    ]),
  );
}, user);
let ready = false,
  status = "SCHEDULED",
  calls = 0;
const point = {
  id: "collection-qa",
  status: "PENDING",
  collectorId: "lead",
  routeId: "route-qa",
  materials: [],
  participants: [
    { id: "participant", collectorId: "member", nameSnapshot: "Integrante QA" },
  ],
  generator: {
    id: "g",
    name: "Ponto QA",
    address: "Rua QA, Fortaleza",
    latitude: -3.73,
    longitude: -38.52,
  },
};
const route = () => ({
  id: "route-qa",
  name: "Diária QA",
  scheduledDate: new Date().toISOString(),
  status,
  collectorIds: ["lead", "member"],
  collectionOrder: [point.id],
  collections: [point],
  driverId: ready ? "driver" : null,
  vehicleId: ready ? "vehicle" : null,
  driver: ready
    ? { id: "driver", name: "Motorista QA", status: "AVAILABLE" }
    : null,
  vehicle: ready ? { id: "vehicle", plate: "QAT2026", status: "ACTIVE" } : null,
});
await context.route("https://vps.katua.com.br/**", async (r) => {
  if (r.request().method() === "OPTIONS")
    return r.fulfill({
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "authorization,content-type",
        "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
      },
    });
  const url = new URL(r.request().url());
  let body = {};
  if (url.pathname === "/auth/me") body = { user };
  else if (url.pathname === "/routes") body = { routes: [route()] };
  else if (url.pathname === "/routes/route-qa") body = { route: route() };
  else if (url.pathname === "/routes/route-qa/field-status") {
    calls++;
    assert(ready);
    status = "IN_PROGRESS";
    body = { route: route() };
  } else if (url.pathname === "/collections") body = { collections: [point] };
  return r.fulfill({
    status: 200,
    headers: { "access-control-allow-origin": "*" },
    contentType: "application/json",
    body: JSON.stringify(body),
  });
});
const p = await context.newPage();
p.setDefaultTimeout(30000);
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
try {
  await p.goto("http://127.0.0.1:5180/roteiro");
  await p
    .getByText("Aguardando preparação pela cooperativa", { exact: true })
    .waitFor();
  const start = p.getByRole("button", {
    name: "Confirmar saída e iniciar rota",
    exact: true,
  });
  assert.equal(await start.getAttribute("aria-disabled"), "true");
  assert.equal(calls, 0);
  await p.screenshot({ path: out + "/rota-pendente.png", fullPage: true });
  console.log(
    "PASS rota incompleta informa a responsabilidade da cooperativa e bloqueia tentativa de saída",
  );
  ready = true;
  await p.reload();
  await p.getByText("Motorista QA · QAT2026", { exact: true }).waitFor();
  await start.click();
  const attend = p.getByRole("button", {
    name: "Atender este ponto",
    exact: true,
  });
  await attend.waitFor();
  assert.notEqual(await attend.getAttribute("aria-disabled"), "true");
  assert.equal(calls, 1);
  await p.screenshot({ path: out + "/rota-liberada.png", fullPage: true });
  console.log(
    "PASS liberação permite saída e atendimento pelo integrante da equipe",
  );
  assert.deepEqual(errors, []);
  console.log("PASS App web sem erros JavaScript na execução da rota");
  fs.writeFileSync(
    out + "/results.json",
    JSON.stringify({ passed: 3, errors }, null, 2),
  );
} finally {
  await context.unrouteAll({ behavior: "ignoreErrors" });
  await browser.close();
  await new Promise((r) => server.close(r));
}
