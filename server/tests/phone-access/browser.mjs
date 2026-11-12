import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { createRequire } from "node:module";
const tools = process.env.KATUA_VALIDATION_TOOLS;
if (!tools || !process.env.KATUA_APP_DIST || !process.env.KATUA_PANEL_DIST)
  throw Error("Informe os builds locais.");
const f = JSON.parse(
  fs.readFileSync(path.join(tools, "phone-access-fixture.json"), "utf8"),
);
const require = createRequire(path.join(tools, "package.json")),
  { chromium } = require("playwright"),
  m = require("@sparticuz/chromium"),
  packaged = m.default || m;
const out = path.join(tools, "phone-access-evidence");
fs.mkdirSync(out, { recursive: true });
async function serve(root, port) {
  root = path.resolve(root);
  const s = http.createServer((req, res) => {
    let file = path.resolve(
      root,
      "." + decodeURIComponent(new URL(req.url, "http://local").pathname),
    );
    if (
      !file.startsWith(root + path.sep) ||
      !fs.existsSync(file) ||
      fs.statSync(file).isDirectory()
    )
      file = fs.existsSync(file + ".html")
        ? file + ".html"
        : path.join(root, "index.html");
    res.setHeader(
      "content-type",
      {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".ttf": "font/ttf",
        ".woff": "font/woff",
        ".png": "image/png",
        ".svg": "image/svg+xml",
      }[path.extname(file)] || "application/octet-stream",
    );
    res.end(fs.readFileSync(file));
  });
  await new Promise((r) => s.listen(port, "127.0.0.1", r));
  return s;
}
const servers = await Promise.all([
  serve(process.env.KATUA_PANEL_DIST, 5190),
  serve(process.env.KATUA_APP_DIST, 5191),
]);
const requests = [],
  errors = [],
  records = { generators: [f.generator], collectors: [f.collector] };
let browser,
  failCreate = false;
async function setup(app, logged = true) {
  const c = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  c.setDefaultTimeout(20000);
  if (logged)
    await c.addInitScript(
      ({ user, app }) => {
        const token = "qa-local";
        if (app) {
          localStorage.setItem("@katu:token", token);
          localStorage.setItem("@katu:user", JSON.stringify(user));
          localStorage.setItem(
            "@katu:offline:session_local",
            JSON.stringify([
              {
                id: 1,
                token,
                user_id: user.id,
                payload_json: JSON.stringify(user),
                updated_at: new Date().toISOString(),
              },
            ]),
          );
        } else {
          localStorage.setItem("auth_token", token);
          localStorage.setItem("auth_user", JSON.stringify(user));
        }
      },
      { user: f.user, app },
    );
  await c.route("**/*", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    if (
      !["fetch", "xhr"].includes(req.resourceType()) &&
      req.method() !== "OPTIONS"
    )
      return url.hostname === "127.0.0.1" ? route.continue() : route.abort();
    if (
      url.hostname === "127.0.0.1" &&
      !/^\/(auth|registrations|generators|collectors|analytics|settings|inbox|privacy)\b/.test(
        url.pathname,
      )
    )
      return route.continue();
    const headers = {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "authorization,content-type",
        "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
        "content-type": "application/json",
      },
      send = (data, status = 200) =>
        route.fulfill({ status, headers, body: JSON.stringify(data) });
    if (req.method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    const body = req.postData() ? JSON.parse(req.postData()) : undefined;
    requests.push({ app, path: url.pathname, method: req.method(), body });
    if (url.pathname === "/auth/me") return send({ user: f.user });
    if (url.pathname === "/auth/login")
      return send({ token: "qa-login", user: f.user });
    if (url.pathname === "/auth/forgot-password")
      return send({
        success: true,
        message:
          "Se os dados identificarem uma conta habilitada, enviaremos as instruções ao e-mail de recuperação cadastrado.",
      });
    if (url.pathname.match(/^\/registrations\/\w+\/[^/]+\/access-link$/))
      return send({
        success: true,
        message:
          "Solicitação de acesso recebida. Confira o e-mail de recuperação cadastrado.",
      });
    const direct = url.pathname.match(
      /^\/(generators|collectors)(?:\/([^/]+))?$/,
    );
    if (direct) {
      const [, kind, id] = direct,
        singular = kind === "generators" ? "generator" : "collector";
      if (req.method() === "GET")
        return send(
          id
            ? { [singular]: records[kind].find((r) => r.id === id) }
            : { [kind]: records[kind] },
        );
      if (req.method() === "POST") {
        if (failCreate)
          return send({ error: "Falha de teste. Rascunho preservado." }, 503);
        const record = {
          ...body,
          id: "app-" + kind + "-" + requests.length,
          cooperativeId: "coop-a",
          userId: null,
          email: body.email || null,
          recoveryEmail: body.recoveryEmail || null,
          registrationStatus: "TO_COMPLETE",
          missingRegistrationFields: ["email"],
          hasOnlineAccess: false,
          accessActivationPending: false,
          status: "AVAILABLE",
          totalKg: 0,
        };
        records[kind].push(record);
        return send({ success: true, [singular]: record }, 201);
      }
      if (req.method() === "PATCH") {
        const i = records[kind].findIndex((r) => r.id === id);
        records[kind][i] = { ...records[kind][i], ...body };
        return send({ success: true, [singular]: records[kind][i] });
      }
    }
    const field = url.pathname.match(
      /^\/cooperative-field\/(generators|collectors)(?:\/([^/]+))?$/,
    );
    if (field) {
      const [, kind, id] = field;
      return send(
        id
          ? {
              item: records[kind].find((r) => r.id === id),
              collections: [],
              requests: [],
              summary: { pending: 0, active: 0, incidents: 0 },
              pagination: { page: 1, total: 0, totalPages: 1 },
            }
          : {
              items: records[kind],
              pagination: {
                page: 1,
                total: records[kind].length,
                totalPages: 1,
              },
            },
      );
    }
    if (url.pathname === "/collections") return send({ collections: [] });
    if (url.pathname.startsWith("/inbox"))
      return send({ data: [], items: [], unreadCount: 0 });
    return send({ data: [], items: [] });
  });
  return c;
}
try {
  browser = await chromium.launch({
    executablePath: await packaged.executablePath(),
    args: packaged.args.filter(arg=>arg!=="--single-process"),
    headless: true,
  });
  const cp = await setup(false, false),
    p = await cp.newPage();
  await p.goto("http://127.0.0.1:5190/login");
  await p.locator("#email").fill("85988880001");
  await p.locator('input[type="password"]').fill("ValidLocalPass2026");
  await p.getByRole("button", { name: "Entrar", exact: true }).click();
  await p.waitForURL("http://127.0.0.1:5190/");
  assert(
    requests.some(
      (r) =>
        !r.app &&
        r.path === "/auth/login" &&
        r.body.identifier === "85988880001",
    ),
  );
  await cp.close();
  const cf = await setup(false, false),
    fp = await cf.newPage();
  await fp.goto("http://127.0.0.1:5190/forgot-password");
  await fp.getByLabel("Identificar por").selectOption("CPF");
  await fp.locator("#email").fill("11144477735");
  await fp
    .getByRole("button", { name: "Enviar recuperação", exact: true })
    .click();
  await fp
    .getByText("Solicitação de recuperação recebida", { exact: true })
    .waitFor();
  assert(
    requests.some(
      (r) =>
        !r.app &&
        r.path === "/auth/forgot-password" &&
        r.body.identifierType === "CPF",
    ),
  );
  await fp.screenshot({
    path: path.join(out, "panel-recovery-cpf.png"),
    fullPage: true,
  });
  await cf.close();
  const ce = await setup(false),
    pe = await ce.newPage();
  pe.on("pageerror", (e) => errors.push(e.message));
  await pe.goto("http://127.0.0.1:5190/edit-generator/" + f.generator.id);
  await pe
    .getByRole("button", { name: "Usar e-mail da cooperativa", exact: true })
    .click();
  assert.equal(
    await pe.getByLabel("E-mail de recuperação (opcional)").inputValue(),
    f.user.email,
  );
  await ce.close();
  const ca = await setup(true),
    a = await ca.newPage();
  a.on("pageerror", (e) => errors.push(e.message));
  await a.goto("http://127.0.0.1:5191/(cooperativa)/geradores");
  await a.getByRole("button", { name: "Cadastro rápido", exact: true }).click();
  await a
    .getByLabel("Nome da pessoa ou estabelecimento *", { exact: true })
    .fill("Gerador rápido no tablet");
  await a
    .getByLabel("Celular com DDD (opcional)", { exact: true })
    .fill("85999995555");
  await a
    .getByRole("button", {
      name: "Adicionar documento, e-mail ou recuperação",
      exact: true,
    })
    .click();
  await a
    .getByRole("button", { name: "Usar e-mail da cooperativa", exact: true })
    .click();
  failCreate = true;
  await a
    .getByRole("button", { name: "Salvar cadastro rápido", exact: true })
    .click();
  await a
    .getByText("Falha de teste. Rascunho preservado.", { exact: true })
    .waitFor();
  await a.reload();
  await a.waitForFunction(() =>
    [...document.querySelectorAll("input")].some(
      (e) => e.value === "Gerador rápido no tablet",
    ),
  );
  failCreate = false;
  await a
    .getByRole("button", { name: "Salvar cadastro rápido", exact: true })
    .click();
  await a
    .getByRole("button", { name: "Completar cadastro e acesso", exact: true })
    .waitFor();
  const created = requests.findLast(
    (r) => r.app && r.path === "/generators" && r.method === "POST",
  );
  assert.equal(created.body.recoveryEmail, f.user.email);
  assert.equal(created.body.email, undefined);
  assert.equal(created.body.documentNumber, undefined);
  await a
    .getByRole("button", { name: "Completar cadastro e acesso", exact: true })
    .click();
  await a
    .getByRole("button", {
      name: "Enviar link para definir acesso",
      exact: true,
    })
    .click();
  await a
    .getByText(
      "Solicitação de acesso recebida. Confira o e-mail de recuperação cadastrado.",
      { exact: true },
    )
    .waitFor();
  await a.screenshot({
    path: path.join(out, "app-generator-access-mobile.png"),
    fullPage: true,
  });
  await a.goto("http://127.0.0.1:5191/(cooperativa)/catadores");
  await a.getByRole("button", { name: "Cadastro rápido", exact: true }).click();
  await a
    .getByLabel("Nome do catador *", { exact: true })
    .fill("Catadora no rodízio");
  await a
    .getByRole("button", { name: "Salvar cadastro rápido", exact: true })
    .click();
  await a
    .getByRole("button", { name: "Completar cadastro e acesso", exact: true })
    .waitFor();
  assert(
    requests.some(
      (r) =>
        r.app &&
        r.path === "/collectors" &&
        r.method === "POST" &&
        r.body.name === "Catadora no rodízio" &&
        !r.body.email &&
        !r.body.cpf,
    ),
  );
  await a.setViewportSize({ width: 1280, height: 900 });
  await a
    .getByRole("button", { name: "Completar cadastro e acesso", exact: true })
    .click();
  await a.screenshot({
    path: path.join(out, "app-collector-tablet.png"),
    fullPage: true,
  });
  await ca.close();
  const publicApp = await setup(true, false),
    fa = await publicApp.newPage();
  await fa.goto("http://127.0.0.1:5191/(auth)/forgot?profile=catador");
  await fa.getByRole("button", { name: "CPF", exact: true }).click();
  await fa.getByPlaceholder("Seu CPF", { exact: true }).fill("11144477735");
  await fa.screenshot({path:path.join(out,"app-recovery-before.png"),fullPage:true});
  try {
    await Promise.all([fa.waitForResponse(r=>r.url().includes("/auth/forgot-password")),fa.getByText("CONTINUAR",{exact:true}).click()]);
  } catch(error) {
    await fa.screenshot({path:path.join(out,"app-recovery-error.png"),fullPage:true});
    console.log("RECOVERY_DIAGNOSTIC",(await fa.locator("body").innerText()).slice(-2200),JSON.stringify(requests.filter(r=>r.app&&r.path.includes("auth"))));
    throw error;
  }
  assert(
    requests.some(
      (r) =>
        r.app &&
        r.path === "/auth/forgot-password" &&
        r.body.identifierType === "CPF",
    ),
  );
  await publicApp.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: panel phone login/CPF recovery, shared-recipient shortcut, app quick registration, durable draft across failure/reload, saved-recipient access instructions, mobile/tablet layouts",
  );
} finally {
  await browser?.close();
  await Promise.all(servers.map((s) => new Promise((r) => s.close(r))));
}
