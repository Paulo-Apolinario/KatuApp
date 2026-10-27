/** App exportado com API, GPS e tiles controlados. Sem acesso à VPS. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../..",
  ),
  req = createRequire(
    path.resolve(process.env.KATUA_VALIDATION_TOOLS, "package.json"),
  ),
  { chromium } = req("playwright"),
  chromiumBuild = (await import(req.resolve("@sparticuz/chromium"))).default;
chromiumBuild.setGraphicsMode = false;
const out = fs.mkdtempSync(
    path.resolve(
      process.env.KATUA_VALIDATION_OUTPUT_ROOT || "/tmp",
      "katua-driver-map-",
    ),
  ),
  results = [],
  errors = [],
  mutations = [];
let browser;
const coop = {
    id: "coop",
    name: "Cooperativa QA",
    address: "Sede cadastrada",
    latitude: -3.73,
    longitude: -38.52,
  },
  car = {
    id: "car",
    plate: "QA00001",
    model: "Caminhão QA",
    status: "ACTIVE",
    driverId: "d1",
  },
  driver = {
    id: "d1",
    name: "Motorista QA",
    status: "AVAILABLE",
    cooperativeId: "coop",
    cooperative: coop,
  };
const c = (id, name, status = "PENDING", routeId = "r1", more = {}) => ({
  id,
  cooperativeId: "coop",
  driverId: "d1",
  routeId,
  status,
  createdAt: "2026-10-26T10:00:00Z",
  generator: {
    id: "g-" + id,
    name,
    address: "Rua " + name,
    latitude: -3.75,
    longitude: -38.5,
  },
  ...more,
});
const done = c("done", "Já atendido", "COMPLETED", "r1", {
    generator: {
      id: "g-done",
      name: "Já atendido",
      address: "Rua passada",
      latitude: -4.4,
      longitude: -40,
    },
  }),
  two = c("two", "Gerador Dois"),
  three = c("three", "PEV Três", "PENDING", "r1", {
    routePoint: {
      key: "pev",
      kind: "PEV",
      name: "PEV Três",
      address: "Rua do PEV",
      latitude: -3.76,
      longitude: -38.49,
    },
  }),
  old = c("old", "Ponto Cancelado", "CANCELLED", "r1", {
    cancellationReason: "Substituída por revisão do roteiro fixo",
  }),
  other = c("other", "Outro Roteiro", "PENDING", "r2"),
  extra = c("extra", "Coleta Avulsa", "PENDING", null);
const r1 = {
    id: "r1",
    name: "Rota A",
    status: "IN_PROGRESS",
    scheduledDate: "2026-10-26T12:00:00Z",
    driverId: "d1",
    cooperative: coop,
    vehicle: car,
    stops: [],
    collectionOrder: ["done", "two", "three", "old"],
    collections: [three, done, old, two],
    startPoint: {
      name: "Saída planejada",
      address: "Rua da saída",
      latitude: -3.74,
      longitude: -38.51,
    },
    endPoint: {
      name: "Retorno planejado",
      address: "Rua do retorno",
      latitude: -3.77,
      longitude: -38.51,
    },
  },
  r2 = {
    id: "r2",
    name: "Rota B",
    status: "SCHEDULED",
    scheduledDate: "2026-10-27T12:00:00Z",
    driverId: "d1",
    cooperative: coop,
    vehicle: car,
    stops: [],
    collectionOrder: ["other"],
    collections: [other],
  };
const server = http.createServer((req, res) => {
  let u = decodeURIComponent((req.url || "/").split("?")[0]);
  if (u.includes("..")) {
    res.writeHead(403);
    return res.end();
  }
  let f = root + "/dist" + u;
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f += "/index.html";
  if (!fs.existsSync(f) && fs.existsSync(f + ".html")) f += ".html";
  if (!fs.existsSync(f)) f = root + "/dist/index.html";
  res.setHeader(
    "Content-Type",
    {
      ".html": "text/html",
      ".js": "application/javascript",
      ".css": "text/css",
      ".ttf": "font/ttf",
      ".png": "image/png",
    }[path.extname(f)] || "application/octet-stream",
  );
  res.end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(8089, "127.0.0.1", r));
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, status: "PASS" });
    console.log("PASS", name);
  } catch (e) {
    results.push({ name, status: "FAIL", error: e.message });
    console.error("FAIL", name, e.message);
    for (const con of browser?.contexts() || [])
      for (const p of con.pages())
        await p
          .screenshot({
            path: path.join(out, `failure-${results.length}.png`),
            fullPage: true,
          })
          .catch(() => {});
  }
}
async function setup(role = "DRIVER") {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      timezoneId: "America/Fortaleza",
    }),
    user = {
      id: role === "DRIVER" ? "u-driver" : "u-cat",
      displayName: role,
      role,
      driver: role === "DRIVER" ? driver : undefined,
      collector:
        role === "COLLECTOR" ? { id: "cat", cooperativeId: "coop" } : undefined,
    };
  let missing = false,
    offline = false;
  await context.addInitScript((user) => {
    localStorage.setItem("@katu:token", "local-validation");
    localStorage.setItem("@katu:user", JSON.stringify(user));
    window.__gps = { latitude: -3.73, longitude: -38.52, accuracy: 275 };
    window.__gpsListeners = [];
    const fix = () => ({
      coords: {
        ...window.__gps,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    });
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: (fn) => setTimeout(() => fn(fix()), 10),
        watchPosition: (fn) => {
          window.__gpsListeners.push(() => fn(fix()));
          setTimeout(() => fn(fix()), 10);
          return 1;
        },
        clearWatch: () => {},
      },
    });
  }, user);
  await context.route("https://vps.katua.com.br/**", async (route) => {
    if (offline) return route.abort("failed");
    const p = new URL(route.request().url()).pathname;
    if (route.request().method() !== "GET") mutations.push(p);
    let body = { success: true };
    if (p === "/auth/me") body = { user };
    else if (p === "/drivers/me") body = { driver };
    else if (p === "/vehicles") body = { vehicles: [car] };
    else if (p === "/routes") body = { routes: [r2, r1] };
    else if (p === "/routes/r1")
      body = {
        route: {
          ...r1,
          collections: r1.collections.map((v) =>
            missing && v.id === "two"
              ? {
                  ...v,
                  generator: {
                    ...v.generator,
                    latitude: null,
                    longitude: null,
                  },
                }
              : v,
          ),
        },
      };
    else if (p === "/routes/r2") body = { route: r2 };
    else if (p === "/collections")
      body = { collections: [done, two, three, old, other, extra] };
    else if (p === "/notifications")
      body = {
        notifications: [],
        unreadCount: 0,
        userId: user.id,
        nextCursor: null,
      };
    else if (p === "/pev-requests") body = { requests: [], total: 0, page: 1 };
    else if (p === "/pev-points") body = { bins: [], total: 0, page: 1 };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await context.route(/https:\/\/.*tile\.openstreetmap\.org\//, (r) =>
    r.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  return {
    context,
    page,
    setMissing: (v) => {
      missing = v;
    },
    setOffline: (v) => {
      offline = v;
    },
  };
}
try {
  browser = await chromium.launch({
    executablePath: process.env.KATUA_CHROMIUM_PATH,
    args: chromiumBuild.args.filter((a) => a !== "--single-process"),
    headless: true,
  });
  let a, p;
  await check(
    "Mapa inicia na rota em andamento e não mistura coletas de outras rotas",
    async () => {
      a = await setup();
      p = a.page;
      await p.goto("http://127.0.0.1:8089/(motorista)/mapa");
      await p.getByText("Roteiro em exibição", { exact: true }).waitFor();
      await p.getByText("2. Gerador Dois", { exact: true }).first().waitFor();
      await p.locator(".katua-map-pin svg").first().waitFor();
      assert.equal(
        await p.locator('.leaflet-marker-icon[title*="Outro Roteiro"]').count(),
        0,
      );
      assert.equal(
        await p.locator('.leaflet-marker-icon[title*="Já atendido"]').count(),
        0,
      );
      assert.equal(
        await p.locator('.leaflet-marker-icon[title*="Cancelado"]').count(),
        0,
      );
      assert.equal(
        await p.locator('.leaflet-marker-icon[title*="Coleta Avulsa"]').count(),
        0,
      );
    },
  );
  await check(
    "Números oficiais 2 e 3 preservados; PEV mantém símbolo e partida/chegada reais",
    async () => {
      assert.ok(
        await p
          .locator('.leaflet-marker-icon[title="Parada 2 · Gerador Dois"] text')
          .filter({ hasText: "2" })
          .count(),
      );
      assert.ok(
        await p
          .locator('.leaflet-marker-icon[title="Parada 3 · PEV Três"] text')
          .filter({ hasText: "3" })
          .count(),
      );
      assert.ok(
        await p
          .locator('.leaflet-marker-icon[title="Partida · Saída planejada"]')
          .count(),
      );
      assert.ok(
        await p
          .locator('.leaflet-marker-icon[title="Chegada · Retorno planejado"]')
          .count(),
      );
      assert.equal(await p.locator('svg circle[fill="#FDE68A"]').count(), 0);
      await p
        .getByRole("region", { name: "Mapa operacional de coletas" })
        .scrollIntoViewIfNeeded();
      await p.screenshot({
        path: path.join(out, "driver-rota-desktop.png"),
        fullPage: true,
      });
    },
  );
  await check(
    "Precisão de 275 m fica em aviso e círculo; mapa não inventa linha viária",
    async () => {
      const notice = p.getByText(/Posição obtida do aparelho.*275 m/);
      await notice.waitFor();
      const color = await notice.evaluate(
        (el) => getComputedStyle(el.parentElement).backgroundColor,
      );
      assert.equal(color, "rgb(255, 245, 229)");
      assert.ok(
        await p.locator('.leaflet-overlay-pane path[stroke="#B45309"]').count(),
      );
      assert.equal(
        await p.locator('.leaflet-overlay-pane path[stroke="#047857"]').count(),
        0,
      );
    },
  );
  await check(
    "Atendidas podem ser exibidas sem renumerar pendências; canceladas ficam fora",
    async () => {
      await p
        .getByRole("button", { name: "Exibir visitas atendidas", exact: true })
        .click();
      await p
        .locator('.leaflet-marker-icon[title="Parada 1 · Já atendido"]')
        .waitFor();
      assert.ok(
        await p
          .locator('.leaflet-marker-icon[title="Parada 2 · Gerador Dois"]')
          .count(),
      );
      assert.equal(
        await p.locator('.leaflet-marker-icon[title*="Cancelado"]').count(),
        0,
      );
      await p
        .getByRole("button", { name: "Ocultar visitas atendidas", exact: true })
        .click();
    },
  );
  await check(
    "Coletas sem rota aparecem em visão própria, sem número ou percurso fictício",
    async () => {
      await p
        .getByRole("button", { name: "Coletas sem rota", exact: true })
        .click();
      await p.getByText("Coleta Avulsa", { exact: true }).first().waitFor();
      assert.equal(
        await p.locator('.leaflet-marker-icon[title*="Gerador Dois"]').count(),
        0,
      );
      assert.equal(await p.locator(".leaflet-marker-icon text").count(), 0);
      await p
        .getByRole("button", { name: "Todas as rotas", exact: true })
        .click();
      await p
        .getByText(
          "Escolha uma rota ou as coletas sem rota para visualizar a próxima parada.",
        )
        .waitFor();
      assert.equal(await p.locator(".leaflet-marker-icon text").count(), 0);
    },
  );
  await check(
    "Troca de rota usa apenas seus pontos e recalcula próxima visita",
    async () => {
      await p
        .getByRole("button", { name: "Rota B · Agendada", exact: true })
        .click();
      await p.getByText("1. Outro Roteiro", { exact: true }).first().waitFor();
      assert.equal(
        await p.locator('.leaflet-marker-icon[title*="Gerador Dois"]').count(),
        0,
      );
      await p.getByRole("button", { name: /Rota A · Em andamento/ }).click();
      await p.getByText("2. Gerador Dois", { exact: true }).first().waitFor();
    },
  );
  await check(
    "Ponto sem coordenadas continua como próximo e a navegação fica bloqueada",
    async () => {
      a.setMissing(true);
      await p.getByRole("button", { name: "Recarregar", exact: true }).click();
      await p
        .getByText(
          "A próxima parada não possui coordenadas confirmadas. A cooperativa precisa ajustar o endereço; ela não foi pulada na sequência.",
        )
        .waitFor();
      assert.ok(
        await p
          .getByRole("button", {
            name: "Navegar até a próxima parada",
            exact: true,
          })
          .isDisabled(),
      );
      assert.equal(
        await p.locator('.leaflet-marker-icon[title*="Gerador Dois"]').count(),
        0,
      );
      a.setMissing(false);
      await p.getByRole("button", { name: "Recarregar", exact: true }).click();
      await p.locator('.leaflet-marker-icon[title*="Gerador Dois"]').waitFor();
    },
  );
  await check(
    "GPS e sede coincidentes continuam acessíveis e selecionáveis",
    async () => {
      await p
        .getByRole("button", { name: "Minha posição", exact: true })
        .click();
      await p
        .locator(
          '.leaflet-marker-icon[title="Motorista · posição deste aparelho"]',
        )
        .click();
      await p.getByText("Também neste local:", { exact: true }).waitFor();
      await p.locator('button[aria-label="Sede · Cooperativa QA"]').click();
      await p.getByText("PONTO SELECIONADO", { exact: true }).waitFor();
    },
  );
  await check(
    "Atualização do GPS não recentraliza o mapa sobre uma visita selecionada",
    async () => {
      await p
        .getByRole("button", { name: "Localizar próxima parada", exact: true })
        .click();
      const map = p.getByRole("region", {
        name: "Mapa operacional de coletas",
      });
      await map.scrollIntoViewIfNeeded();
      const box = await map.boundingBox();
      await p.mouse.move(box.x + box.width / 2, box.y + 160);
      await p.mouse.down();
      await p.mouse.move(box.x + box.width / 2 + 85, box.y + 190, { steps: 8 });
      await p.mouse.up();
      await p.waitForTimeout(650);
      const marker = p.locator(
          '.leaflet-marker-icon[title="Parada 2 · Gerador Dois"]',
        ),
        before = await marker.boundingBox();
      await p.evaluate(() => {
        window.__gps.longitude -= 0.001;
        window.__gpsListeners.forEach((fn) => fn());
      });
      await p.waitForTimeout(400);
      const after = await marker.boundingBox();
      assert.ok(
        Math.abs(before.x - after.x) < 2 && Math.abs(before.y - after.y) < 2,
        JSON.stringify({ before, after }),
      );
    },
  );
  await check("Mapa e ações cabem em 390 px sem corte horizontal", async () => {
    await p.setViewportSize({ width: 390, height: 844 });
    await p
      .getByRole("button", {
        name: "Enquadrar pontos desta visão",
        exact: true,
      })
      .click();
    const b = await p.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    assert.ok(b.scroll <= b.width + 1, JSON.stringify(b));
    await p
      .getByRole("region", { name: "Mapa operacional de coletas" })
      .scrollIntoViewIfNeeded();
    await p.screenshot({
      path: path.join(out, "driver-rota-mobile.png"),
      fullPage: true,
    });
  });
  await check(
    "Catador acessa Solicitações de PEV pelo mapa, separado da nova O.C.",
    async () => {
      const cat = await setup("COLLECTOR");
      await cat.page.goto("http://127.0.0.1:8089/(catador)/mapas");
      await cat.page
        .getByRole("button", { name: /Solicitações de PEV/ })
        .waitFor();
      await cat.page
        .getByText("Nova O.C. · coleta extra ou parada não programada", {
          exact: true,
        })
        .waitFor();
      await cat.page
        .getByRole("button", { name: /Solicitações de PEV/ })
        .click();
      await cat.page.waitForURL(/pev-atendimento/);
      await cat.page
        .getByText("PEVs · cuidado compartilhado", { exact: true })
        .waitFor();
      await cat.page.screenshot({
        path: path.join(out, "catador-acesso-pev.png"),
        fullPage: true,
      });
      await cat.context.close();
    },
  );
  await check(
    "Link do calendário abre a rota e a coleta solicitadas",
    async () => {
      const deep = await setup();
      await deep.page.goto(
        "http://127.0.0.1:8089/(motorista)/mapa?routeId=r2&collectionId=other",
      );
      await deep.page
        .getByText("1. Outro Roteiro", { exact: true })
        .first()
        .waitFor();
      await deep.page
        .locator('.leaflet-marker-icon[title="Parada 1 · Outro Roteiro"]')
        .waitFor();
      assert.equal(
        await deep.page
          .locator('.leaflet-marker-icon[title*="Gerador Dois"]')
          .count(),
        0,
      );
      await deep.context.close();
    },
  );
  await check(
    "Telas não geram erros de JavaScript ou alterações operacionais",
    async () => {
      assert.deepEqual(errors, []);
      assert.deepEqual(mutations, []);
    },
  );
} finally {
  fs.writeFileSync(
    path.join(out, "results.json"),
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
  console.log("EVIDENCE", out);
  await browser?.close();
  await new Promise((r) => server.close(r));
}
if (results.some((r) => r.status === "FAIL")) process.exitCode = 1;
