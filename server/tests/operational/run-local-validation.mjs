import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { mkdtemp } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const toolsDir = process.env.KATUA_VALIDATION_TOOLS;
if (!toolsDir) throw new Error('Defina KATUA_VALIDATION_TOOLS para dependências isoladas de teste.');
const toolsRequire = createRequire(join(resolve(toolsDir), 'package.json'));
const { PGlite } = await import(pathToFileURL(toolsRequire.resolve('@electric-sql/pglite')));
const { PGLiteSocketServer } = await import(pathToFileURL(toolsRequire.resolve('@electric-sql/pglite-socket')));
const { default: chromium } = await import(pathToFileURL(toolsRequire.resolve('@sparticuz/chromium')));
const { chromium: pw } = toolsRequire(process.env.KATUA_PLAYWRIGHT_MODULE || 'playwright');
const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const serverDir = join(appDir, 'server');
const webDir = process.env.KATUA_WEB_DIR || resolve(appDir, '../Katua_Web/frontend');
const outputDir = await mkdtemp(join(tmpdir(), 'katua-operational-'));
const databaseUrl = 'postgresql://postgres:localtest@127.0.0.1:54329/postgres?connection_limit=1';
const schemaSql = execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', 'prisma/schema.prisma', '--script'], { cwd: serverDir, env: { ...process.env, DATABASE_URL: databaseUrl }, encoding: 'utf8' });
const outcomes=[],children=[];let browser,pgserver,db;
const log=(message)=>console.log(message);
async function check(name,fn){try{await fn();outcomes.push({name,status:'PASS'});log('PASS '+name);}catch(error){outcomes.push({name,status:'FAIL',error:error.message.slice(0,1200)});log('FAIL '+name+': '+error.message.slice(0,250));}}
function child(cmd,args,cwd,env,ready){
 const processChild=spawn(cmd,args,{cwd,env:{...process.env,...env},stdio:['ignore','pipe','pipe']});children.push(processChild);
 const output=[];
 const promise=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Startup timeout: '+cmd+' '+output.join('').slice(-1200))),90000);let matched=false;
 const onData=(chunk)=>{const text=chunk.toString();output.push(text);if(ready.test(text)&&!matched){matched=true;clearTimeout(timer);resolve(processChild);}};
 processChild.stdout.on('data',onData);processChild.stderr.on('data',onData);processChild.on('exit',code=>{if(!matched){clearTimeout(timer);reject(new Error('Startup failed '+code+': '+output.join('').slice(-2000)));}});});
 processChild.output=output;return promise;
}
let fixture;
const api=async(path,method='GET',body,token=fixture.token)=>{const r=await fetch('http://127.0.0.1:3339'+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};};
try{
 db=await PGlite.create();await db.exec(schemaSql);
 pgserver=new PGLiteSocketServer({db,host:'127.0.0.1',port:54329});await pgserver.start();log('DB_READY: PostgreSQL WASM, concurrency not equivalent to native');
 await child(process.execPath,['--import','tsx','tests/operational/local-server.ts'],serverDir,{KATUA_LOCAL_VALIDATION:'1',DATABASE_URL:databaseUrl,KATUA_VALIDATION_DIR:outputDir},/LOCAL_API_READY/);
 fixture=JSON.parse(await readFile(join(outputDir, 'fixture.json'),'utf8'));log('API_READY with isolated fixtures and JWT');
 await check('API: autenticação, perfil DRIVER e isolamento por cooperativa',async()=>{
  assert.equal((await api('/routes/'+fixture.routes.equipe.id,'GET',undefined,null)).status,401);
  assert.equal((await api('/routes/'+fixture.routes.equipe.id,'GET',undefined,fixture.otherToken)).status,404);
  assert.equal((await api('/routes/'+fixture.routes.equipe.id,'PATCH',{name:'Proibido'},fixture.driverToken)).status,403);
  assert.equal((await api('/routes/'+fixture.routes.equipe.id,'PATCH',{driverId:fixture.otherDriver.id})).status,400);
 });
 await check('API+DB: bloqueio de conclusão com pendência, sem gravação parcial',async()=>{
  const id=fixture.routes.blocked.id;
  assert.equal((await api('/routes/'+id,'PATCH',{name:'Não persistir',status:'COMPLETED'})).status,400);
  const fresh=(await api('/routes/'+id)).data.route;assert.equal(fresh.name,'QA blocked');assert.equal(fresh.status,'IN_PROGRESS');
 });
 await check('API+DB: conclusão com COLLECTED e CANCELLED mantém estados e atribuições',async()=>{
  const id=fixture.routes.mixed.id,before=(await api('/routes/'+id)).data.route.collections.map(c=>[c.id,c.status,c.driverId,c.vehicleId]);
  assert.equal((await api('/routes/'+id+'/status','PATCH',{status:'COMPLETED'})).status,200);
  const after=(await api('/routes/'+id)).data.route;assert.equal(after.status,'COMPLETED');assert.equal(after.stats.fieldCompletedCollections,1);assert.deepEqual(after.activeCollections,[]);assert.deepEqual(after.collections.map(c=>[c.id,c.status,c.driverId,c.vehicleId]),before);
 });
 await check('DB: rollback de rota/coletas provocado por trigger SQL',async()=>{
  await db.exec(`CREATE FUNCTION qa_fail_assignment() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id = '${fixture.collections.rollbackPending.id}' THEN RAISE EXCEPTION 'QA rollback'; END IF; RETURN NEW; END $$; CREATE TRIGGER qa_fail BEFORE UPDATE ON "Collection" FOR EACH ROW EXECUTE FUNCTION qa_fail_assignment();`);
  try{
   const r=await api('/routes/'+fixture.routes.rollback.id,'PATCH',{name:'Não persistir',driverId:fixture.driver2.id,vehicleId:fixture.vehicle2.id});assert.equal(r.status,400);
   const fresh=(await api('/routes/'+fixture.routes.rollback.id)).data.route;assert.equal(fresh.name,'QA rollback');assert.equal(fresh.driverId,fixture.driver1.id);assert.equal(fresh.collections[0].driverId,fixture.driver1.id);
  }finally{await db.exec('DROP TRIGGER qa_fail ON "Collection"; DROP FUNCTION qa_fail_assignment();');}
 });
 await child(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5179'],webDir,{VITE_API_BASE_URL:'http://127.0.0.1:3339'},/Local:/);
 browser=await pw.launch({executablePath:process.env.KATUA_CHROMIUM_PATH || await chromium.executablePath(),args:chromium.args,headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.route('**/*',r=>{const h=new URL(r.request().url()).hostname;return ['127.0.0.1','localhost'].includes(h)?r.continue():r.abort();});
 await context.addInitScript(({token,user})=>{localStorage.setItem('auth_token',token);localStorage.setItem('auth_user',JSON.stringify(user));},{token:fixture.token,user:fixture.owner});
 const page=await context.newPage();page.setDefaultTimeout(20000);
 await check('Navegador painel: trocar equipe, salvar, recarregar e conferir histórico no banco',async()=>{
  await page.goto('http://127.0.0.1:5179/edit-route/'+fixture.routes.equipe.id);await page.locator('#name').waitFor();await page.waitForFunction(()=>document.querySelector('button[type=submit]')?.disabled === false);await page.locator('#name').fill('QA equipe editada');
  await page.locator('#vehicleId').selectOption(fixture.vehicle2.id);await page.locator('#driverId').selectOption(fixture.driver2.id);await page.getByRole('button',{name:'Atualizar Rota',exact:true}).click();await page.waitForURL('**/route-list');await page.reload();
  const row=page.locator('tr').filter({hasText:'QA equipe editada'});await row.getByText('QA Motorista Bruno').waitFor();assert.ok((await row.innerText()).includes(fixture.vehicle2.plate));
  const fresh=(await api('/routes/'+fixture.routes.equipe.id)).data.route;assert.equal(fresh.driverId,fixture.driver2.id);assert.equal(fresh.vehicleId,fixture.vehicle2.id);
  assert.equal(fresh.collections.find(c=>c.id===fixture.collections.historical.id).driverId,fixture.driver1.id);
  assert.equal(fresh.collections.find(c=>c.id===fixture.collections.pending.id).driverId,fixture.driver2.id);
 });
 await check('Navegador painel: remover equipe, salvar e recarregar',async()=>{
  await page.goto('http://127.0.0.1:5179/edit-route/'+fixture.routes.equipe.id);await page.waitForFunction(()=>document.querySelector('button[type=submit]')?.disabled === false);await page.locator('#vehicleId').selectOption('');await page.locator('#driverId').selectOption('');await page.getByRole('button',{name:'Atualizar Rota',exact:true}).click();await page.waitForURL('**/route-list');await page.reload();
  const row=page.locator('tr').filter({hasText:'QA equipe editada'});await row.getByText('Não vinculado').first().waitFor();assert.equal(await row.getByText('Não vinculado').count(),2);
  const fresh=(await api('/routes/'+fixture.routes.equipe.id)).data.route;assert.equal(fresh.driverId,null);assert.equal(fresh.vehicleId,null);
 });
 await check('Navegador painel: editar veículo e confirmar persistência após recarga',async()=>{
  await page.goto('http://127.0.0.1:5179/edit-vehicle/'+fixture.vehicle2.id);await page.waitForFunction(()=>document.querySelector('button[type=submit]')?.disabled === false);await page.locator('#model').fill('QA Caminhão Atualizado');await page.getByRole('button',{name:'Atualizar Veículo',exact:true}).click();await page.waitForURL('**/vehicle-list');await page.reload();await page.getByText('QA Caminhão Atualizado',{exact:false}).first().waitFor();
  assert.equal((await api('/vehicles/'+fixture.vehicle2.id)).data.vehicle.model,'QA Caminhão Atualizado');
 });
 await page.screenshot({path:join(outputDir, 'painel.png'),fullPage:true});
 // Native app services + repositories execute against SQLite, with HTTP requests to this actual local API.
 const {runOfflineChecks}=await import('./offline-checks.mjs');
 await check('App services + SQLite: rejeição e reconexão com API local',async()=>{await runOfflineChecks({appDir,fixture,api,db,outputDir,report:(name,status,detail)=>{outcomes.push({name,status,detail});log(status+' '+name);}});});
 await child(process.execPath,['node_modules/expo/bin/cli','start','--web','--port','8089','--localhost','--max-workers','2','--clear'],appDir,{CI:'1',EXPO_PUBLIC_API_BASE_URL:'http://127.0.0.1:3339',EXPO_OFFLINE:'1',EXPO_NO_TELEMETRY:'1',EXPO_NO_DEPENDENCY_VALIDATION:'1',EXPO_NO_DOTENV:'1'},/Waiting on http/);
 const appContext=await browser.newContext({viewport:{width:430,height:932}});
 await appContext.route('**/*',r=>{const url=new URL(r.request().url());if(url.hostname==='vps.katua.com.br')return r.fetch({url:'http://127.0.0.1:3339'+url.pathname+url.search}).then(response=>r.fulfill({response}));return ['127.0.0.1','localhost'].includes(url.hostname)?r.continue():r.abort();});
 await appContext.addInitScript(({token,user})=>{localStorage.setItem('@katu:token',token);localStorage.setItem('@katu:user',JSON.stringify(user));},{token:fixture.token,user:{...fixture.owner,cooperative:fixture.cooperative}});
 const appPage=await appContext.newPage();appPage.setDefaultTimeout(30000);appPage.on('pageerror',error=>console.log('APP_PAGE_ERROR',error.message.slice(0,500))); appPage.on('requestfailed',r=>console.log('APP_REQUEST_FAILED',r.url(),r.failure()?.errorText)); appPage.on('console',m=>{if(m.text().includes('[API]'))console.log('APP_API_LOG',m.text().slice(0,600));});
 await check('App Expo Web: carregar equipe e editar motorista/veículo',async()=>{
  await appPage.goto('http://127.0.0.1:8089/(cooperativa)/rotas/'+fixture.routes.equipe.id,{timeout:90000});await appPage.getByText('Editar motorista e veículo',{exact:true}).waitFor({timeout:45000});await appPage.getByText('Editar motorista e veículo',{exact:true}).click();
  assert.equal(await appPage.getByPlaceholder('DD/MM/AAAA',{exact:true}).inputValue(),'');await appPage.getByText('QA Motorista Bruno',{exact:false}).last().click();await appPage.getByText(new RegExp(fixture.vehicle2.plate)).last().click();await appPage.getByText('Salvar alterações',{exact:true}).click();
  await appPage.getByText('Rota atualizada com sucesso.',{exact:true}).waitFor();await appPage.reload();await appPage.getByText('QA Motorista Bruno',{exact:false}).first().waitFor();
  const fresh=(await api('/routes/'+fixture.routes.equipe.id)).data.route;assert.equal(fresh.driverId,fixture.driver2.id);assert.equal(fresh.vehicleId,fixture.vehicle2.id);
 });
 await check('App Expo Web: remover equipe, recarregar e preservar vínculos históricos',async()=>{
  await appPage.getByText('Editar motorista e veículo',{exact:true}).click();
  await appPage.getByText('Sem motorista',{exact:true}).click();await appPage.getByText('Sem veículo',{exact:true}).click();
  await appPage.getByText('Salvar alterações',{exact:true}).click();await appPage.getByText('Rota atualizada com sucesso.',{exact:true}).waitFor();await appPage.reload();
  await appPage.getByText('Editar motorista e veículo',{exact:true}).waitFor();
  const fresh=(await api('/routes/'+fixture.routes.equipe.id)).data.route;assert.equal(fresh.driverId,null);assert.equal(fresh.vehicleId,null);
  assert.equal(fresh.collections.find(c=>c.id===fixture.collections.historical.id).driverId,fixture.driver1.id);
 });
 await appPage.screenshot({path:join(outputDir, 'app-web.png'),fullPage:true});
}catch(error){outcomes.push({name:'Preparação/execução do ambiente',status:'FAIL',error:error.message});console.error('RUN_ERROR',error.message.slice(0,2000));}
finally{
 await writeFile(join(outputDir, 'results.json'),JSON.stringify({generatedAt:new Date().toISOString(),environment:'API Fastify/Prisma real, PGlite PostgreSQL WASM, Chromium, Expo Web; não é concorrência PostgreSQL nativa nem dispositivo',outcomes},null,2));
 await browser?.close();for(const p of children)p.kill('SIGTERM');await pgserver?.stop();await db?.close();
 console.log('REPORT_DIR',outputDir);console.log('RESULTS',JSON.stringify(outcomes));if(outcomes.some(o=>o.status==='FAIL'))process.exitCode=1;
}
