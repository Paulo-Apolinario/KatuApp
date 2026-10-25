import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdtemp, writeFile, stat } from "node:fs/promises";
import { resolve, join, extname } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
const root = resolve(
  process.env.KATUA_APP_WEB_EXPORT || "../../validation-tools/inbox-design-web",
);
const out = await mkdtemp(
  join(
    process.env.KATUA_VALIDATION_OUTPUT_ROOT || tmpdir(),
    "katua-inbox-design-",
  ),
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
  async function setup({ empty = false, role = "COLLECTOR" } = {}) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const user = {
      id: "inbox-design",
      role,
      displayName: "Pessoa de teste",
      collector: { id: "collector", cooperative: { name: "Cooperativa QA" } },
    };
    const notices = empty
      ? []
      : [
          {
            id: "review",
            collectionId: "coleta-qa",
            kind: "QUANTITY_REVIEW",
            title: "Quantidade recebida ajustada",
            message: "Conferência",
            readAt: null,
            createdAt: new Date().toISOString(),
            data: {
              actorName: "Cooperativa QA",
              reason: "Pesagem conferida na balança da cooperativa",
              items: [
                {
                  name: "Papelão",
                  unit: "KG",
                  reportedQuantity: 50,
                  previousQuantity: 50,
                  confirmedQuantity: 40,
                },
              ],
            },
          },
          {
            id: "received",
            collectionId: "coleta-qa",
            kind: "COLLECTION_STAGE",
            title: "Coleta recebida pela cooperativa",
            message: "A entrega foi recebida e aguarda conferência.",
            readAt: null,
            createdAt: new Date().toISOString(),
          },
          {
            id: "old",
            collectionId: "coleta-antiga",
            kind: "COLLECTION_STAGE",
            title: "Operação da coleta concluída",
            message: "Todas as etapas foram concluídas.",
            readAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
        ];
    await context.addInitScript(
      ({ user }) => {
        localStorage.setItem("@katu:token", "design-test-token");
        localStorage.setItem("@katu:user", JSON.stringify(user));
        Object.defineProperty(navigator, "geolocation", {
          configurable: true,
          value: {
            getCurrentPosition: (_ok, error) => error({ code: 1 }),
            watchPosition: () => 1,
            clearWatch: () => {},
          },
        });
      },
      { user },
    );
    let fail = false;
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === "127.0.0.1" && url.port === "8089")
        return route.continue();
      if (url.hostname !== "127.0.0.1" || url.port !== "3339")
        return route.abort();
      if (fail) return route.abort();
      let body = {};
      const pathname = url.pathname;
      if (pathname === "/auth/me") body = { user };
      else if (pathname === "/notifications")
        body = {
          userId: user.id,
          notifications: notices,
          unreadCount: notices.filter((n) => !n.readAt).length,
          nextCursor: null,
        };
      else if (pathname === "/notifications/read-all") {
        notices.forEach((n) => (n.readAt = new Date().toISOString()));
        body = { success: true };
      } else if (pathname.match(/^\/notifications\/[^/]+\/read$/)) {
        const id = pathname.split("/")[2];
        notices.find((n) => n.id === id).readAt = new Date().toISOString();
        body = { success: true };
      } else if (pathname.startsWith("/collections/"))
        body = { collection: { id: "coleta-qa", status: "RECEIVED" } };
      else if (pathname === "/collections") body = { collections: [] };
      else if (pathname === "/routes") body = { routes: [] };
      else if (pathname === "/schedules") body = { schedules: [] };
      else if (pathname === "/drivers/me")
        body = { driver: { ...user, cooperative: { name: "Cooperativa QA" } } };
      else if (pathname === "/vehicles") body = { vehicles: [] };
      else if (pathname === "/extra-collection-orders") body = { orders: [] };
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
        },
        body: JSON.stringify(body),
      });
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    return {
      context,
      page,
      errors,
      fail: (value) => {
        fail = value;
      },
    };
  }
  const state = await setup();
  const { page } = state;
  await check(
    "Faixa global removida; sino junto de recarregar na tela Dados",
    async () => {
      await page.goto("http://127.0.0.1:8089/(catador)/data");
      await page.getByText("DADOS DO CATADOR", { exact: true }).waitFor();
      await page
        .getByRole("button", { name: "Notificações, 2 não lidas", exact: true })
        .waitFor();
      assert.equal(await page.getByText("KATUÁ", { exact: true }).count(), 0);
      for (const width of [320, 390, 1366]) {
        await page.setViewportSize({ width, height: 844 });
        const a = await page
            .getByRole("button", { name: /Notificações,/ })
            .boundingBox(),
          b = await page
            .getByRole("button", { name: "Recarregar dados", exact: true })
            .boundingBox();
        assert(a && b);
        assert(Math.abs(a.y + a.height / 2 - (b.y + b.height / 2)) < 4);
        assert(a.x >= 0 && b.x + b.width <= width);
        assert(a.width >= 44 && a.height >= 44);
      }
    },
  );
  await check(
    "Central usa cabeçalho, cartões de conferência e comparação 50 → 40",
    async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole("button", { name: /Notificações,/ }).click();
      await page
        .getByRole("heading", { name: "Notificações", exact: true })
        .waitFor();
      await page.getByText("Informado em campo", { exact: true }).waitFor();
      await page.getByText("Conferido", { exact: true }).waitFor();
      await page
        .getByText("Pesagem conferida na balança da cooperativa", {
          exact: true,
        })
        .waitFor();
      assert.equal(
        await page.getByRole("button", { name: /^(Não lida|Lida):/ }).count(),
        3,
      );
      await page.screenshot({
        path: join(out, "central-mobile.png"),
        fullPage: true,
      });
    },
  );
  await check(
    "Filtro Não lidas e leitura abrem detalhes em janela",
    async () => {
      await page
        .getByRole("button", { name: "Não lidas", exact: true })
        .click();
      assert.equal(
        await page.getByRole("button", { name: /^Não lida:/ }).count(),
        2,
      );
      await page
        .getByRole("button", {
          name: "Não lida: Quantidade recebida ajustada",
          exact: true,
        })
        .click();
      await page.getByText("Etapa atual: Recebida", { exact: true }).waitFor();
      await page
        .getByRole("button", { name: "Fechar detalhes", exact: true })
        .click();
      await page
        .getByText("Detalhes da coleta", { exact: true })
        .waitFor({ state: "hidden" });
      assert.equal(
        await page.getByRole("button", { name: /^Não lida:/ }).count(),
        1,
      );
    },
  );
  await check(
    "Marcar todas como lidas e histórico permanecem funcionais",
    async () => {
      await page
        .getByRole("button", { name: "Marcar todas como lidas", exact: true })
        .click();
      await page
        .getByText("Nenhum aviso não lido nesta página", { exact: true })
        .waitFor();
      await page.getByRole("button", { name: "Todas", exact: true }).click();
      assert.equal(
        await page.getByRole("button", { name: /^Lida:/ }).count(),
        3,
      );
      await page.setViewportSize({ width: 1366, height: 850 });
      await page.screenshot({
        path: join(out, "central-desktop.png"),
        fullPage: true,
      });
    },
  );
  await check(
    "Falha de rede preserva avisos e apresenta mensagem",
    async () => {
      state.fail(true);
      await page
        .getByRole("button", { name: "Atualizar avisos", exact: true })
        .click();
      await page.getByText(/Sem atualização no momento/).waitFor();
      assert.equal(
        await page.getByRole("button", { name: /^Lida:/ }).count(),
        3,
      );
      state.fail(false);
    },
  );
  await check("Cartões sem transbordamento em largura de 320 px", async () => {
    await page.setViewportSize({ width: 320, height: 720 });
    const cards = await page
      .getByRole("button", { name: /^Lida:/ })
      .evaluateAll((nodes) =>
        nodes.map((n) => {
          const r = n.getBoundingClientRect();
          return { left: r.left, right: r.right, width: innerWidth };
        }),
      );
    assert(cards.every((c) => c.left >= 0 && c.right <= c.width));
    assert.deepEqual(state.errors, []);
  });
  await state.context.close();
  const empty = await setup({ empty: true });
  await check(
    "Central vazia profissional, sem ação de leitura ativa",
    async () => {
      await empty.page.goto("http://127.0.0.1:8089/notifications");
      await empty.page
        .getByText("Tudo tranquilo por aqui", { exact: true })
        .waitFor();
      assert(
        await empty.page
          .getByRole("button", { name: "Marcar todas como lidas", exact: true })
          .isDisabled(),
      );
      await empty.page.screenshot({
        path: join(out, "central-vazia.png"),
        fullPage: true,
      });
      assert.deepEqual(empty.errors, []);
    },
  );
  await empty.context.close();
  for (const [role, path] of [
    ["COLLECTOR", "/(catador)/homecat"],
    ["COLLECTOR", "/(catador)/collect"],
    ["COLLECTOR", "/(catador)/receipts"],
    ["COLLECTOR", "/(catador)/mapas"],
    ["COOPERATIVE", "/(cooperativa)/mapas"],
    ["PF", "/(pf-tabs)/home"],
    ["GENERATOR_SMALL", "/(gerador)/dashboard"],
    ["DRIVER", "/(motorista)/home"],
    ["COOPERATIVE", "/(cooperativa)/home"],
  ]) {
    const s = await setup({ role });
    await check(`Sino acessível no cabeçalho ${path}`, async () => {
      await s.page.setViewportSize({ width: 320, height: 720 });
      await s.page.goto("http://127.0.0.1:8089" + path);
      const bell = s.page.getByRole("button", { name: /Notificações,/ });
      await bell.waitFor();
      assert.equal(await bell.count(), 1);
      const box = await bell.boundingBox();
      assert(box && box.x >= 0 && box.x + box.width <= 320);
      assert.deepEqual(s.errors, []);
    });
    await s.context.close();
  }
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
  await writeFile(join(out, "results.json"), JSON.stringify(outcomes, null, 2));
  console.log("EVIDENCE", out);
  if (outcomes.some((o) => o.status !== "PASS")) process.exitCode = 1;
}
