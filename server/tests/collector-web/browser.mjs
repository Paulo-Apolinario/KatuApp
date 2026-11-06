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
const out = path.join(toolsRoot, "collector-web-ui-evidence");
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
await new Promise((r) => server.listen(5185, "127.0.0.1", r));
const browser = await chromium.launch({
  executablePath:
    process.env.KATUA_CHROMIUM_PATH || (await build.executablePath()),
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
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
  user = JSON.parse(localStorage.getItem("qaUserOverride") || "null") || user;
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
const fixture = {
  cooperative: { id: "coop", name: "Coop QA" },
  collectorId: "member",
  generators: [
    {
      id: "g1",
      name: "Maria QA",
      companyName: "Loja da Maria",
      phone: "85911112222",
      street: "Rua das Flores",
      number: "100",
      neighborhood: "São José",
      city: "Fortaleza",
      state: "CE",
      zipCode: "60000000",
      address: "Rua das Flores, 100",
      latitude: -3.7,
      longitude: -38.5,
    },
    {
      id: "g2",
      name: "João QA",
      companyName: "Mercadinho QA",
      phone: "85933334444",
      street: "Rua do Sol",
      number: "20",
      neighborhood: "Centro",
      city: "Fortaleza",
      state: "CE",
      zipCode: "60100000",
      address: "Rua do Sol, 20",
      latitude: -3.8,
      longitude: -38.6,
    },
  ],
  catalog: [
    { id: "paper", name: "Papel", unit: "KG", defaultUnit: "KG" },
    { id: "glass", name: "Vidro", unit: "KG", defaultUnit: "KG" },
  ],
  routes: [],
  schedules: [],
  drivers: [],
  vehicles: [],
};
const orders = [],
  submissions = [],
  errors = [],
  results = [];
await context.route("**/*", async (r) => {
  const req = r.request(),
    url = new URL(req.url());
  if (
    !["fetch", "xhr"].includes(req.resourceType()) &&
    req.method() !== "OPTIONS"
  )
    return url.hostname === "127.0.0.1" ? r.continue() : r.abort();
  if (url.port === "5185") return r.continue();
  if (req.method() === "OPTIONS")
    return r.fulfill({
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "authorization,content-type",
        "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
      },
    });
  let body = {};
  if (url.pathname === "/privacy/notice")
    body = {
      acceptance: { reportedAcceptedAt: new Date().toISOString() },
      documentHash: "local-test-only",
    };
  else if (url.pathname === "/auth/me") body = { user };
  else if (url.pathname === "/collections") body = { collections: [] };
  else if (url.pathname === "/environmental-impact")
    body = {
      data: {
        collections: 0,
        requests: 0,
        pendingRequests: 0,
        totalMassKg: 0,
        co2Kg: 0,
        waterLiters: 0,
        energyKwh: 0,
        treesEquivalent: 0,
        description: "QA",
        reference: { label: "Referência QA", version: "1" },
      },
    };
  else if (url.pathname === "/extra-collection-orders/context") body = fixture;
  else if (
    url.pathname === "/extra-collection-orders" &&
    req.method() === "GET"
  )
    body = { orders, hasMore: false, total: orders.length, page: 1 };
  else if (
    url.pathname === "/extra-collection-orders" &&
    req.method() === "POST"
  ) {
    const input = req.postDataJSON();
    submissions.push(input);
    let order = orders.find((o) => o.id === input.id);
    if (!order) {
      order = {
        id: input.id,
        cooperativeId: input.cooperativeId,
        payload: input.payload,
        status: "PENDING_REVIEW",
        revision: 1,
        createdAt: new Date().toISOString(),
        custody: input.payload.custody,
        custodyNotes: input.payload.custodyNotes,
      };
      orders.push(order);
    }
    body = { order };
  } else if (url.pathname.startsWith("/extra-collection-orders/"))
    body = {
      order: orders.find((o) => o.id === url.pathname.split("/").at(-1)),
    };
  else if (
    url.pathname.includes("inbox") ||
    url.pathname.includes("notifications")
  )
    body = { notifications: [], unreadCount: 0, items: [] };
  else if (url.pathname.includes("routes"))
    body = { routes: [], pagination: { page: 1, total: 0, hasMore: false } };
  return r.fulfill({
    status: 200,
    headers: { "access-control-allow-origin": "*" },
    contentType: "application/json",
    body: JSON.stringify(body),
  });
});
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));
const base = "http://127.0.0.1:5185";
const click = (label) =>
  page.getByRole("button", { name: label, exact: true }).click();
async function test(name, fn) {
  await fn();
  results.push({ name, status: "PASS" });
  console.log("PASS", name);
}
async function newOrder() {
  await page.goto(base + "/(catador)/extra-orders");
  await page
    .getByRole("button", { name: /^(Nova coleta extra|Abrir nova O.C.)$/ })
    .click();
  await page.getByText("O que você quer fazer?", { exact: true }).waitFor();
}
try {
  await test("início mostra cinco ações prioritárias sem indicadores e mapa duplicado", async () => {
    await page.goto(base + "/(catador)/homecat");
    await page
      .getByRole("button", { name: "Coleta extra", exact: true })
      .waitFor();
    for (const label of [
      "Coleta extra",
      "Solicitar coleta em PEV",
      "Minhas rotas",
      "Minha produção em equipe",
      "Registrar coleta",
    ])
      assert(
        await page
          .getByRole("button", { name: label, exact: true })
          .isVisible(),
      );
    assert.equal(
      await page.getByText("Resumo operacional", { exact: true }).count(),
      0,
    );
    assert.equal(
      await page.getByText("Resumo ambiental", { exact: true }).count(),
      0,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Mapa operacional", exact: true })
        .count(),
      0,
    );
    await page.screenshot({
      path: path.join(out, "inicio-mobile.png"),
      fullPage: true,
    });
  });
  await test("dados e impacto ambiental ficam na aba de dados", async () => {
    await page.goto(base + "/(catador)/data");
    await page.getByText("Resumo ambiental", { exact: true }).waitFor();
    await page.getByText("Situação das coletas", { exact: true }).waitFor();
    await page.getByText("Histórico de coletas", { exact: true }).waitFor();
  });
  await test("formulário curto não exige motivo e oferece duas situações", async () => {
    await newOrder();
    assert(
      await page
        .getByRole("button", { name: "Pedir uma coleta", exact: true })
        .isVisible(),
    );
    assert.equal(
      await page.getByLabel("Motivo e circunstâncias", { exact: true }).count(),
      0,
    );
    await click("Continuar");
  });
  await test("busca normaliza acentos e gerador preenche telefone e localização", async () => {
    await click("Gerador cadastrado");
    await page
      .getByLabel("Buscar gerador por nome ou bairro", { exact: true })
      .fill("SAO JOSE");
    await click("Loja da Maria · São José");
    await page.getByText("Telefone: 85911112222", { exact: true }).waitFor();
    await click("Alterar local desta coleta");
    await page.getByLabel("Telefone (opcional)", { exact: true }).waitFor();
    assert.equal(
      await page
        .getByLabel("Telefone (opcional)", { exact: true })
        .inputValue(),
      "85911112222",
    );
    await click("Preencher endereço pelo CEP (opcional)");
    assert.equal(
      await page.getByLabel("Rua / logradouro", { exact: true }).inputValue(),
      "Rua das Flores",
    );
    assert.equal(
      await page.getByLabel("Número ou S/N", { exact: true }).inputValue(),
      "100",
    );
    assert.equal(
      await page.getByLabel("Bairro", { exact: true }).inputValue(),
      "São José",
    );
    await click("Fechar edição do local");
    await click("Continuar");
  });
  await test("material sem pesagem avança e resumo é apresentado antes do envio", async () => {
    await click("Adicionar Papel");
    await click("Continuar");
    await page.getByText("Confira antes de enviar", { exact: true }).waitFor();
    await page
      .getByText("• Papel: quantidade a conferir", { exact: true })
      .waitFor();
    assert.equal(submissions.length, 0);
    await page.screenshot({
      path: path.join(out, "conferencia-mobile.png"),
      fullPage: true,
    });
  });
  await test("envio preserva vínculo, coordenadas e telefone sem inventar quantidade ou motivo", async () => {
    await click("Enviar registro de coleta");
    await page.waitForFunction(() =>
      document.body.innerText.includes("Aguardando análise"),
    );
    assert.equal(submissions.length, 1);
    const p = submissions[0].payload;
    assert.equal(p.generatorId, "g1");
    assert.equal(p.contactPhone, "85911112222");
    assert.equal(p.latitude, -3.7);
    assert.equal(p.reasonNotes, "");
    assert.equal(p.materials[0].quantity, undefined);
    assert(p.occurredAt);
    assert.equal(p.custody, "COLLECTOR");
  });
  await test("trocar gerador limpa dados antigos e mantém os dados do novo", async () => {
    await newOrder();
    await click("Continuar");
    await click("Gerador cadastrado");
    await click("Loja da Maria · São José");
    await click("Escolher outro gerador");
    await page
      .getByLabel("Buscar gerador por nome ou bairro", { exact: true })
      .fill("mercadinho");
    await click("Mercadinho QA · Centro");
    await page.getByText("Telefone: 85933334444", { exact: true }).waitFor();
    assert.equal(
      await page.getByText("Telefone: 85911112222", { exact: true }).count(),
      0,
    );
  });
  await test("rascunho é guardado ao voltar e pode ser retomado", async () => {
    await page.getByRole("button", { name: "Voltar", exact: true }).click();
    await page
      .getByText("Rascunho neste aparelho", { exact: true })
      .first()
      .waitFor();
    const resume = page
      .getByRole("button", {
        name: /Continuar rascunho|Editar rascunho|Abrir rascunho|Retomar/,
      })
      .first();
    await resume.click();
    await click("Continuar");
    await page.getByText("Telefone: 85933334444", { exact: true }).waitFor();
  });
  await test("envio offline fica salvo e é sincronizado uma vez ao reconectar", async () => {
    await click("Continuar");
    await click("Adicionar Vidro");
    await click("Continuar");
    const before = submissions.length;
    await context.setOffline(true);
    await click("Enviar registro de coleta");
    await page
      .getByText("Aguardando envio à cooperativa", { exact: true })
      .first()
      .waitFor();
    assert.equal(submissions.length, before);
    await context.setOffline(false);
    await page.waitForFunction(() => navigator.onLine);
    await page
      .getByRole("button", {
        name: /^(Atualizar lista|Atualizar ordens e sincronização)$/,
      })
      .click();
    await page.waitForFunction(() =>
      document.body.innerText.includes("Aguardando análise"),
    );
    assert.equal(submissions.length, before + 1);
    assert.equal(
      new Set(submissions.map((s) => s.id)).size,
      submissions.length,
    );
  });
  await test("pedido futuro e origem manual: sem data de coleta, com motivo curto opcional", async () => {
    await newOrder();
    await click("Pedir uma coleta");
    await click("Continuar");
    await page
      .getByLabel("Nome da pessoa ou estabelecimento", { exact: true })
      .fill("Dona Ana");
    await page
      .getByLabel("Endereço da retirada", { exact: true })
      .fill("Rua das Coletas, 50, Centro, Fortaleza");
    await click("Continuar");
    await click("Adicionar Papel");
    await click("Continuar");
    await page.getByText("Sem data preferencial", { exact: true }).waitFor();
    assert.equal(
      await page.getByText("Onde está o material?", { exact: true }).count(),
      0,
    );
    await click("Mais detalhes (opcional)");
    await page
      .getByLabel("Data desejada (opcional)", { exact: true })
      .fill("31/12/2026");
    await page.getByLabel("Observações (opcional)", { exact: true }).fill("ok");
    await click("Enviar pedido de coleta");
    await page
      .getByText("Aguardando análise", { exact: true })
      .first()
      .waitFor();
    const p = submissions.at(-1).payload;
    assert.equal(p.mode, "REQUESTED");
    assert.equal(p.custody, "ORIGIN");
    assert.equal(p.occurredAt, undefined);
    assert.equal(p.reasonNotes, "ok");
    assert(p.preferredDate);
    assert.equal(p.generatorId, undefined);
  });
  await test("excluir rascunho exige confirmação e mantém ordens já enviadas", async () => {
    await newOrder();
    await page.getByRole("button", { name: "Voltar", exact: true }).click();
    await page.getByRole("button", {name:"Continuar rascunho",exact:true}).first().waitFor();
    const count = await page.getByRole("button", {name:"Continuar rascunho",exact:true}).count();
    assert(count>0);
    await page.getByRole("button",{name:"Excluir rascunho",exact:true}).first().click();
    await click("Cancelar exclusão");
    assert.equal(await page.getByRole("button",{name:"Continuar rascunho",exact:true}).count(),count);
    await page.getByRole("button",{name:"Excluir rascunho",exact:true}).first().click();
    await click("Confirmar exclusão");
    await page.getByText("Rascunho excluído.",{exact:true}).waitFor();
    assert.equal(await page.getByRole("button",{name:"Continuar rascunho",exact:true}).count(),count-1);
    assert((await page.getByRole("button",{name:"Abrir ordem",exact:true}).count())>0);
  });
  await test("consulta de CEP lenta pode ser cancelada por endereço manual sem bloquear avanço", async () => {
    await newOrder(); await click("Continuar");
    await page.getByLabel("Nome da pessoa ou estabelecimento",{exact:true}).fill("Origem manual QA");
    await click("Preencher endereço pelo CEP (opcional)");
    await page.getByLabel("CEP da retirada (opcional)",{exact:true}).fill("60000000");
    let release;
    const waiting = new Promise(r => { release = r; });
    await page.route("https://viacep.com.br/**", async route => { await waiting; await route.fulfill({json:{logradouro:"Endereço antigo",localidade:"Fortaleza",uf:"CE"}}).catch(()=>{}); });
    await click("Buscar endereço pelo CEP");
    await page.getByLabel("Endereço da retirada",{exact:true}).fill("Rua manual, 50, Centro");
    release();
    await page.waitForTimeout(100);
    assert.equal(await page.getByLabel("Endereço da retirada",{exact:true}).inputValue(),"Rua manual, 50, Centro");
    await click("Continuar");
    await page.getByText("Quais materiais?",{exact:true}).waitFor();
    await page.unroute("https://viacep.com.br/**");
    await page.getByRole("button",{name:"Voltar",exact:true}).click();
  });
  await test("ordem concluída mostra estado em português e a quantidade conferida atual", async () => {
    orders[0].status = "ACCEPTED";
    orders[0].collection = {
      id: "linked",
      status: "COMPLETED",
      quantityReviewVersion: 1,
      collectionMaterials: [
        {
          id: "m",
          nameSnapshot: "Papelão conferido",
          quantity: "8",
          unit: "KG",
        },
      ],
    };
    await page.goto(base + "/(catador)/extra-orders?orderId=" + orders[0].id);
    await page
      .getByText("Coleta vinculada: linked · Concluída", { exact: true })
      .waitFor();
    await page.getByText("Papelão conferido: 8 kg", { exact: true }).waitFor();
    assert.equal(await page.getByText("COMPLETED", { exact: true }).count(), 0);
  });
  await test("cooperativa acessa diretamente o atendimento da coleta no painel", async () => {
    user.role = "COOPERATIVE";
    user.cooperative = { id: "coop", name: "Coop QA" };
    await page.evaluate((user) => {
      localStorage.setItem("qaUserOverride", JSON.stringify(user));
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
    await page.goto(
      base + "/(cooperativa)/extra-orders?orderId=" + orders[0].id,
    );
    await page
      .getByRole("button", {
        name: "Continuar atendimento no painel",
        exact: true,
      })
      .waitFor();
    await page.evaluate(() => {
      window.open = (url) => {
        window.qaPanelUrl = String(url);
        return null;
      };
    });
    await page
      .getByRole("button", {
        name: "Continuar atendimento no painel",
        exact: true,
      })
      .click();
    assert.equal(
      await page.evaluate(() => window.qaPanelUrl),
      "https://painel.katua.com.br/waste-list?coleta=linked",
    );
    assert.equal(
      await page
        .getByLabel("Observações da análise ou conferência", { exact: true })
        .count(),
      0,
    );
    user.role = "COLLECTOR";
    delete user.cooperative;
    await page.evaluate((user) => {
      localStorage.removeItem("qaUserOverride");
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
  });
  await test("desktop adapta ações e tela não transborda", async () => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(base + "/(catador)/homecat");
    await page
      .getByRole("button", { name: "Coleta extra", exact: true })
      .waitFor();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.screenshot({
      path: path.join(out, "inicio-desktop.png"),
      fullPage: true,
    });
  });
  assert.deepEqual(errors, []);
  console.log(`${results.length} testes de navegador aprovados`);
} catch (e) {
  console.error(e);
  console.error("page errors", errors);
  await page.screenshot({
    path: path.join(out, "failure.png"),
    fullPage: true,
  });
  process.exitCode = 1;
} finally {
  fs.writeFileSync(
    path.join(out, "results.json"),
    JSON.stringify({ results, errors, submissions }, null, 2),
  );
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
