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
const out = path.join(toolsRoot, "route-pending-app-ui-evidence");
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
let status = "IN_PROGRESS";
const events = [], submissions = [];
const points = Array.from({length:5},(_,i)=>({id:'point-'+i,status:i<3?'COLLECTED':'PENDING',collectorId:'lead',routeId:'route-qa',materials:[],participants:[{collectorId:'member',nameSnapshot:'Integrante QA'}],generator:{id:'g'+i,name:'Ponto QA '+(i+1),address:'Rua QA',latitude:-3.73,longitude:-38.52}}));
const route=()=>({id:'route-qa',name:'Diária QA',scheduledDate:'2026-10-27T11:00:00Z',status,collectorIds:['lead','member'],collectionOrder:points.map(p=>p.id),collections:points,driverId:'driver',vehicleId:'vehicle',driver:{id:'driver',name:'Motorista QA'},vehicle:{id:'vehicle',plate:'QAT2026'},operationalEvents:events,closureOutcome:status==='COMPLETED'?'PARTIAL':null});
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
  else if (url.pathname.includes('/occurrence') || url.pathname.endsWith('/request-closure')) {
    const input=r.request().postDataJSON();submissions.push({url:url.pathname,...input});
    const collectionId=url.pathname.includes('/occurrence')?url.pathname.split('/').at(-2):null;
    if(!events.some(e=>e.operationId===input.operationId))events.push({id:input.operationId,operationId:input.operationId,kind:collectionId?'NOT_SERVED':'CLOSURE_REQUEST',collectionId,reason:input.reason,actorName:'Integrante QA',at:new Date().toISOString()});
    body={ok:true};
  } else if (url.pathname === '/collections') body={collections:points};
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
 await p.goto('http://127.0.0.1:5180/roteiro');
 await p.getByText('Diária QA',{exact:true}).last().waitFor();
 const pendingButtons=()=>p.getByRole('button',{name:'Visita não realizada',exact:true});
 await pendingButtons().first().click();await p.getByLabel('Motivo da visita não realizada').fill('Local fechado, retorno necessário');await p.getByRole('button',{name:'Confirmar ocorrência',exact:true}).click();
 await p.getByText(/Relato de ponto não atendido: Local fechado/).waitFor();
 assert.equal(points[3].status,'PENDING');assert.equal(submissions[0].reason,'Local fechado, retorno necessário');assert.match(submissions[0].operationId,/^[a-f0-9-]{36}$/i);
 await pendingButtons().nth(1).click();await p.getByLabel('Motivo da visita não realizada').fill('Fim de expediente, faltou tempo');await p.getByRole('button',{name:'Confirmar ocorrência',exact:true}).click();
 const request=p.getByRole('button',{name:'Solicitar encerramento com pendências',exact:true});await request.waitFor();await request.click();await p.getByLabel('Motivo da visita não realizada').fill('Solicitamos encerramento do turno com pendências');await p.getByRole('button',{name:'Confirmar ocorrência',exact:true}).click();
 await p.getByText('Encerramento com pendências solicitado. Aguarde a decisão da cooperativa.',{exact:true}).waitFor();
 assert.equal(status,'IN_PROGRESS');assert.equal(events.filter(e=>e.kind==='NOT_SERVED').length,2);assert.equal(events.filter(e=>e.kind==='CLOSURE_REQUEST').length,1);assert.equal(points.filter(p=>p.status==='COLLECTED').length,3);
 await p.screenshot({path:out+'/catador-relatos-mobile.png',fullPage:true});
 status='COMPLETED';points[3].status='CANCELLED';points[4].status='CANCELLED';await p.reload();await p.getByRole('button',{name:/Diária QA/}).click();await p.getByText('Encerrada com pendências. As coletas realizadas foram preservadas.',{exact:true}).waitFor();
 assert.equal(await p.getByRole('button',{name:'Visita não realizada',exact:true}).count(),0);assert.deepEqual(errors,[]);
 fs.writeFileSync(out+'/results.json',JSON.stringify({passed:5,checks:['Relato envia ponto e motivo com identificador','Relato não cancela atendimento','Solicitação após dois pontos relatados','Três coletas realizadas preservadas','Encerramento parcial é somente leitura, sem erros JavaScript'],errors},null,2));console.log('PASS catador route pending UI (5)');
} finally {await context.unrouteAll({behavior:'ignoreErrors'});await browser.close();await new Promise(r=>server.close(r));}
