/** UI real + API local em banco descartável. Nenhum acesso à VPS. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
const toolsRoot = process.env.KATUA_VALIDATION_TOOLS;
if (!toolsRoot) throw Error("KATUA_VALIDATION_TOOLS obrigatório");
const req = createRequire(path.resolve(toolsRoot, "package.json"));
const { chromium } = req("playwright");
const build = (await import(req.resolve("@sparticuz/chromium"))).default;
build.setGraphicsMode = false;
const panelRoot =
  process.env.KATUA_PANEL_FRONTEND ||
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../../pev-web/frontend",
  );
const f = {
    token: "local-panel-fixture",
    owner: {
      id: "owner-local",
      displayName: "Cooperativa QA",
      role: "COOPERATIVE",
    },
  },
  out = path.resolve(toolsRoot, "route-pending-panel-ui-evidence");
fs.mkdirSync(out, { recursive: true });
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
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(Error("Vite não iniciou")), 30000);
  vite.stdout.on("data", (b) => {
    if (b.toString().includes("Local:")) {
      clearTimeout(timer);
      resolve();
    }
  });
  vite.stderr.on("data", (b) => process.stderr.write(b));
  vite.on("exit", (code) => reject(Error("Vite encerrou " + code)));
});
const browser = await chromium.launch({
  executablePath:
    process.env.KATUA_CHROMIUM_PATH || (await build.executablePath()),
  args: build.args.filter((a) => a !== "--single-process"),
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1366, height: 950 },
  locale: "pt-BR",
  timezoneId: "America/Fortaleza",
});
await context.addInitScript(
  ({ token, user }) => {
    localStorage.setItem("auth_token", token);
    localStorage.setItem("auth_user", JSON.stringify(user));
  },
  { token: f.token, user: f.owner },
);

const basePoint={name:'Sede QA',address:'Rua QA',latitude:-3.73,longitude:-38.52};
const points=Array.from({length:5},(_,i)=>({id:'point-'+i,status:i<3?'COLLECTED':'PENDING',collectorId:'cat',routeId:'route-qa',collectionMaterials:[],participants:[],routePoint:{...basePoint,key:'point-'+i,kind:'ADDRESS',name:'Ponto '+(i+1)}}));
let current={id:'route-qa',name:'Rota diária QA',status:'IN_PROGRESS',revision:3,scheduledDate:'2026-10-27T11:00:00Z',driverId:'driver',vehicleId:'vehicle',collectorIds:['cat'],collectionOrder:points.map(p=>p.id),collections:points,stops:[],startPoint:basePoint,endPoint:basePoint,departureTime:'08:00',estimatedMinutes:240,operationalEvents:[{id:'report-qa',kind:'NOT_SERVED',collectionId:'point-3',reason:'Local fechado no horário da visita',actorName:'Catadora QA',at:'2026-10-27T18:00:00Z'}]};
const sent=[];
await context.route('http://127.0.0.1:3339/**',async r=>{
 const url=new URL(r.request().url());if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,POST,PATCH,OPTIONS'}});
 let body={user:{...f.owner,cooperative:{id:'coop',...basePoint}},routes:[],collections:[],vehicles:[],drivers:[],collectors:[],teams:[]};
 if(url.pathname==='/route-planning/sources')body={...body,base:basePoint,generators:[],bins:[],collectors:[{id:'cat',name:'Catadora QA'}]};
 if(url.pathname==='/routes/route-qa')body={route:current};
 if(url.pathname==='/routes/route-qa/resolve-pending'){
 const input=r.request().postDataJSON();sent.push(input);assert.equal(input.expectedRevision,current.revision);assert.match(input.operationId,/^[a-f0-9-]{36}$/i);
 current={...current,revision:current.revision+1,status:'COMPLETED',closureOutcome:'PARTIAL',operationalEvents:[...current.operationalEvents,{id:'decision-qa',kind:input.action,reason:input.reason,at:new Date().toISOString(),actorName:'Cooperativa QA',pendingCollectionIds:['point-3','point-4']}],collections:current.collections.map(c=>['PENDING','IN_PROGRESS'].includes(c.status)?{...c,status:'CANCELLED',cancellationReason:input.reason}:c)};body={ok:true,routeId:current.id,nextRouteId:null};
 }
 return r.fulfill({status:200,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:JSON.stringify(body)});
});
await context.route(/tile\.openstreetmap\.org/,r=>r.abort());
const p=await context.newPage(),errors=[];p.on("pageerror",e=>errors.push(e.message));
try{
 await p.goto('http://127.0.0.1:5179/edit-route/route-qa');
 const section=p.getByRole('region',{name:'Pendências da execução',exact:true});await section.waitFor();
 await section.getByText('Programação vencida.',{exact:false}).waitFor();await section.getByText('Local fechado no horário da visita',{exact:false}).first().waitFor();
 assert.equal(await section.getByRole('button',{name:'Confirmar decisão sobre pendências',exact:true}).isDisabled(),true);
 await section.getByLabel('Decisão da cooperativa').selectOption('CLOSE_PARTIAL');await section.getByLabel('Justificativa da decisão').fill('Fim de expediente: preservar as três coletas e cancelar os dois pontos restantes');await section.getByRole('checkbox').check();
 await p.screenshot({path:out+'/decisao-desktop.png',fullPage:true});
 await section.getByRole('button',{name:'Confirmar decisão sobre pendências',exact:true}).click();
 await p.getByText('Encerrada com pendências',{exact:true}).first().waitFor();assert.equal(sent.length,1);assert.equal(sent[0].action,'CLOSE_PARTIAL');assert.equal(current.collections.filter(c=>c.status==='COLLECTED').length,3);assert.equal(current.collections.filter(c=>c.status==='CANCELLED').length,2);
 const history=p.getByText('Histórico da execução (2)',{exact:true});await history.click();await p.getByText('Encerramento com pendências',{exact:true}).waitFor();
 await p.setViewportSize({width:390,height:844});const box=await p.getByRole('region',{name:'Pendências da execução',exact:true}).boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390);
 await p.getByRole('region',{name:'Pendências da execução',exact:true}).screenshot({path:out+'/historico-mobile.png'});
 assert.deepEqual(errors,[]);fs.writeFileSync(out+'/results.json',JSON.stringify({passed:5,checks:['Programação vencida e relato visíveis','Confirmação obrigatória','Decisão envia revisão e identificador','Três coletas preservadas e dois pontos cancelados na tela','Histórico responsivo em 390 px e sem erros JavaScript'],errors},null,2));console.log('PASS panel pending UI (5)');
}finally{await browser.close();vite.kill('SIGTERM');}
