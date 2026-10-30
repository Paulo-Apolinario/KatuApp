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
    "katua-route-execution-",
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
  async function setup(role = "COLLECTOR") {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const user = {
      id: "route-ui",
      role,
      displayName: "Pessoa QA",
      collector: { id: "col", cooperative: { name: "Cooperativa QA" } },
      driver: { id: "driver", name: "Motorista QA" },
    };
    const collection = (id, name, status = "PENDING") => ({
      id,
      status,
      cooperativeId: "coop",
      collectorId: "col",
      routeId: "route",
      routePoint: {
        key: id,
        kind: "ADDRESS",
        name,
        address: "Rua QA, 50, Fortaleza, CE",
        latitude: -3.73,
        longitude: -38.53,
      },
      collector: { id: "col", name: "Catador QA" },
      totalWeightKg: 0,
      materials: [],
      createdAt: "2026-10-26T12:00:00Z",
    });
    const detail = {
      id: "route",
      name: "Rota Centro QA",
      status: "SCHEDULED",
      scheduledDate: "2026-10-26T12:00:00-03:00",
      collectorIds: ["col"],
      driverId: "driver",
      vehicleId: "vehicle",
      driver: { id: "driver", name: "Motorista QA" },
      vehicle: { id: "vehicle", plate: "QAT1234" },
      startPoint: { name: "Sede QA", latitude: -3.73, longitude: -38.52 },
      endPoint: { name: "Sede QA", latitude: -3.73, longitude: -38.52 },
      collectionOrder: ["a", "b", "c"],
      collections: [
        collection("a", "Residência QA"),
        collection("b", "PEV Praça QA"),
        collection("c", "Mercado QA"),
      ],
      planId: "fixed",
    };
    detail.collections.push({...collection("old","Visita substituída QA","CANCELLED"),cancellationReason:"Substituída por revisão do roteiro fixo"});
    detail.collectionOrder.push("old");
    let fail = false;
    await context.addInitScript(
      ({ user }) => {
        localStorage.setItem("@katu:token", "qa-token");
        localStorage.setItem("@katu:user", JSON.stringify(user));
      },
      { user },
    );
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === "127.0.0.1" && url.port === "8089")
        return route.continue();
      if (url.hostname !== "127.0.0.1" || url.port !== "3339")
        return route.abort();
      if (fail) return route.abort();
      const path = url.pathname;
      let body = {};
      if (path === "/auth/me") body = { user };
      else if (path === "/routes") body = { routes: [detail] };
      else if (path === "/routes/route") body = { route: detail };
      else if (path === "/routes/route/field-status") {
        detail.status = route.request().postDataJSON().status;
        body = { route: detail };
      } else if (path.includes("/occurrence")) {
        const id = path.split("/")[4];
        detail.collections.find((c) => c.id === id).status = "CANCELLED";
        body = { ok: true };
      } else if (path === "/collections")
        body = { collections: detail.collections };
      else if (path === "/notifications")
        body = {
          notifications: [{id:"route-notice",collectionId:null,kind:"ROUTE_UPDATED",title:"Rota QA alterada",message:"Confira a próxima execução",data:{routeId:"route"},readAt:null,createdAt:"2026-10-26T12:00:00Z"}],
          unreadCount: 0,
          userId: user.id,
          nextCursor: null,
        };
      else if (path === "/vehicles") body = { vehicles: [] };
      else if (path === "/schedules") body = { schedules: [] };
      else if (path === "/waste-stock/items") body = { items: [] };
      else if (path === "/drivers/me") body = { driver: user.driver };
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
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    return {
      context,
      page,
      detail,
      errors,
      setFail: (value) => {
        fail = value;
      },
    };
  }
  const state = await setup(),
    { page, detail } = state;
  await check(
    "Catador consulta sequência numerada de pontos avulsos, PEV e gerador",
    async () => {
      await page.goto("http://127.0.0.1:8089/(catador)/roteiro");
      await page.getByText("Sequência de visitas", { exact: true }).waitFor();
      assert(
        await page
          .getByText("PRÓXIMA PARADA · PONTO 1", { exact: true })
          .isVisible(),
      );
      assert(
        await page
          .getByText("0 de 3 pontos encerrados · 3 pendentes", { exact: true })
          .isVisible(),
      );
      await page.screenshot({
        path: join(out, "catador-route-mobile.png"),
        fullPage: true,
      });
    },
  );
  await check(
    "Confirmação de saída libera atendimento e mantém referência da coleta",
    async () => {
      assert(
        await page
          .getByRole("button", { name: "Atender este ponto", exact: true })
          .isDisabled(),
      );
      await page
        .getByRole("button", {
          name: "Confirmar saída e iniciar rota",
          exact: true,
        })
        .click();
      await page.waitForFunction(
        () =>
          !document.body.textContent.includes("Confirmar saída e iniciar rota"),
      );
      assert(
        !(await page
          .getByRole("button", { name: "Atender este ponto", exact: true })
          .isDisabled()),
      );
    },
  );
  await check(
    "Adiar ponto orienta próxima parada sem trocar ordem oficial",
    async () => {
      await page
        .getByRole("button", { name: "Deixar para depois", exact: true })
        .first()
        .click();
      assert(
        await page
          .getByText("PRÓXIMA PARADA · PONTO 2", { exact: true })
          .isVisible(),
      );
      assert.deepEqual(detail.collectionOrder, ["a", "b", "c", "old"]);
    },
  );
  await check(
    "Ocorrência com motivo encerra visita e atualiza progresso",
    async () => {
      await page
        .getByRole("button", { name: "Visita não realizada", exact: true })
        .first()
        .click();
      await page
        .getByLabel("Motivo da visita não realizada", { exact: true })
        .fill("Sem material disponível no local");
      await page
        .getByRole("button", { name: "Confirmar ocorrência", exact: true })
        .click();
      await page
        .getByText("1 de 3 pontos encerrados · 2 pendentes", { exact: true })
        .waitFor();
    },
  );
  await check(
    "Reabertura offline preserva sequência e detalhes em cache",
    async () => {
      state.setFail(true);
      await page.reload();
      await page.getByText("Sequência de visitas", { exact: true }).waitFor();
      assert(
        (await page.getByText("Residência QA", { exact: true }).count()) > 0,
      );
      state.setFail(false);
    },
  );
  await check("Layout em 320px não corta cartões ou controles", async () => {
    await page.setViewportSize({ width: 320, height: 740 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.screenshot({
      path: join(out, "catador-route-320.png"),
      fullPage: true,
    });
    assert.deepEqual(state.errors, []);
  });
  await check("Notificação da rota abre a execução correta no app",async()=>{
    await page.goto("http://127.0.0.1:8089/notifications");
    await page.getByRole("button",{name:"Não lida: Rota QA alterada",exact:true}).click();
    await page.getByText("Sequência de visitas",{exact:true}).waitFor();
    assert(page.url().includes("highlightRouteId=route"));
  });
  const driver = await setup("DRIVER");
  await check(
    "Motorista usa a mesma execução sem ação exclusiva de coleta do catador",
    async () => {
      await driver.page.goto("http://127.0.0.1:8089/(motorista)/rotas");
      await driver.page
        .getByText("Sequência de visitas", { exact: true })
        .waitFor();
      assert.equal(
        await driver.page
          .getByRole("button", { name: "Atender este ponto", exact: true })
          .count(),
        0,
      );
      assert.deepEqual(driver.errors, []);
      await driver.page.screenshot({
        path: join(out, "driver-route-mobile.png"),
        fullPage: true,
      });
    },
  );
} catch (e) {
  outcomes.push({ name: "Ambiente", status: "FAIL", error: e.message });
  console.error(e.stack);
} finally {
  await writeFile(
    join(out, "results.json"),
    JSON.stringify(
      {
        environment:
          "Expo export real + Chromium + API controlada; sem serviços externos",
        outcomes,
      },
      null,
      2,
    ),
  );
  await browser?.close();
  await new Promise((r) => server.close(r));
  console.log("REPORT_DIR", out);
  if (outcomes.some((o) => o.status === "FAIL")) process.exitCode = 1;
}
