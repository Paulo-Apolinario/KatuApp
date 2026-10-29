import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';import fs from 'node:fs';
const tools=process.env.KATUA_VALIDATION_TOOLS, panel=process.env.KATUA_PANEL_FRONTEND;
if(!tools||!panel)throw Error('Informe ferramentas e frontend local.');
const require=createRequire(path.join(tools,'package.json'));const {chromium}=require('playwright');
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5179','--strictPort'],{cwd:panel,env:{...process.env,VITE_API_BASE_URL:'http://127.0.0.1:3339'},stdio:['ignore','pipe','pipe']});
await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Vite timeout')),30000);vite.stdout.on('data',b=>{if(b.toString().includes('Local:')){clearTimeout(t);resolve();}});vite.on('exit',c=>reject(Error('Vite '+c)));});
let browser;const checks=[];const pass=s=>{checks.push(s);console.log('PASS '+s);};
try{
 browser=await chromium.launch({executablePath:process.env.KATUA_CHROMIUM_PATH||'/tmp/katua-pev-browser',args:['--no-sandbox','--disable-dev-shm-usage'],headless:true});
 const context=await browser.newContext({viewport:{width:1366,height:950},locale:'pt-BR',timezoneId:'America/Fortaleza'});
 const owner={id:'owner',displayName:'Cooperativa QA',role:'COOPERATIVE'};
 await context.addInitScript(owner=>{localStorage.setItem('auth_token','test-local');localStorage.setItem('auth_user',JSON.stringify(owner));},owner);
 let reads=0, requests=0, schedules=[{id:'schedule-qa',status:'REQUESTED',createdAt:'2026-10-29T12:00:00Z',requestedBy:{displayName:'Morador QA'},pickupAddress:'Rua QA',requestedMaterials:[],collections:[]}];
 const notices=[{id:'notice-1',title:'Pendência em rota',message:'Ponto sem atendimento',data:{routeId:'route-qa'},createdAt:'2026-10-29T12:00:00Z',readAt:null},{id:'notice-2',title:'O.C. recebida',message:'Nova ordem',data:{extraOrderId:'order-qa'},createdAt:'2026-10-29T11:00:00Z',readAt:null}];
 await context.route('http://127.0.0.1:3339/**',async r=>{
  const u=new URL(r.request().url());let data={},status=200;
  if(u.pathname==='/auth/me')data={user:owner};
  else if(u.pathname==='/notifications'){reads++;data={userId:owner.id,notifications:notices,unreadCount:notices.filter(n=>!n.readAt).length,nextCursor:null};}
  else if(u.pathname==='/notifications/read-all'){notices.forEach(n=>n.readAt='now');data={success:true};}
  else if(u.pathname.endsWith('/read')){notices.find(n=>u.pathname.includes(n.id)).readAt='now';data={success:true};}
  else if(u.pathname==='/schedules'){requests++;data={schedules};}
  else if(u.pathname==='/schedules/schedule-qa')data={schedule:schedules[0]};
  else if(u.pathname==='/collectors')data={collectors:[{id:'cat',name:'Catador QA',status:'AVAILABLE'}]};
  else if(u.pathname==='/drivers')data={drivers:[]};else if(u.pathname==='/vehicles')data={vehicles:[]};else if(u.pathname==='/routes')data={routes:[]};
  else if(u.pathname==='/slow'){await new Promise(q=>setTimeout(q,300));data={ok:true};}
  else if(u.pathname==='/old-session'){await new Promise(q=>setTimeout(q,100));status=401;data={error:'Expired'};}
  else if(u.pathname==='/expired'){status=401;data={error:'Expired'};}
  else {status=404;data={error:'Fixture não configurado: '+u.pathname};}
  await r.fulfill({status,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type'},contentType:'application/json',body:JSON.stringify(data)});
 });
 const page=await context.newPage();await page.goto('http://127.0.0.1:5179/notifications');await page.getByRole('heading',{name:'Central de avisos'}).waitFor();
 await page.getByText('2 aviso(s) não lido(s).',{exact:true}).waitFor();
 assert.equal(await page.getByRole('link',{name:'Abrir atendimento'}).first().getAttribute('href'),'/edit-route/route-qa');
 assert.equal(await page.getByRole('link',{name:'Abrir atendimento'}).nth(1).getAttribute('href'),'/extra-collection-orders?ordem=order-qa');pass('Central exibe avisos e encaminha para a rota e O.C. corretas');
 await page.getByRole('button',{name:'Marcar como lido',exact:true}).first().click();await page.getByText('1 aviso(s) não lido(s).',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Marcar todos como lidos'}).click();await page.getByText('0 aviso(s) não lido(s).',{exact:true}).waitFor();pass('Leitura individual e geral atualiza a central e o sino');
 await page.setViewportSize({width:390,height:844});await page.waitForFunction(() => document.querySelector(".sidebar").getBoundingClientRect().right <= 1);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));await page.screenshot({path:path.join(tools,'communication-inbox-mobile.png'),fullPage:true});pass('Central utilizável a 390px sem transbordamento horizontal');
 await page.setViewportSize({width:1366,height:950});await page.clock.install();await page.goto('http://127.0.0.1:5179/collection-requests');await page.getByRole('button',{name:'Analisar solicitação'}).waitFor();
 const before=requests;await page.clock.fastForward(31000);await page.waitForFunction(()=>true);await page.getByRole('button',{name:'Analisar solicitação'}).waitFor();assert(requests>before);pass('Solicitações abertas recebem atualização automática');
 await page.getByRole('button',{name:'Analisar solicitação'}).click();await page.getByRole('dialog').waitFor();
 const notes=page.getByRole('dialog').locator('textarea');if(await notes.count())await notes.first().fill('Rascunho que deve permanecer');
 const paused=requests;await page.clock.fastForward(31000);assert.equal(requests,paused);if(await notes.count())assert.equal(await notes.first().inputValue(),'Rascunho que deve permanecer');pass('Atualização automática respeita o diálogo e preserva o rascunho de atribuição');
 await page.clock.resume();
 const timeout=await page.evaluate(async()=>{const {apiRequest}=await import('/src/services/apiClient.js');try{await apiRequest('/slow',{timeoutMs:30});}catch(e){return {code:e.code,message:e.message};}});assert.equal(timeout.code,'TIMEOUT');pass('Tempo limite informa conexão lenta sem confirmar uma operação incerta');
 const retained=await page.evaluate(async()=>{const {apiRequest}=await import('/src/services/apiClient.js');const pending=apiRequest('/old-session').catch(e=>e.status);localStorage.setItem('auth_token','new-token');await pending;return localStorage.getItem('auth_token');});assert.equal(retained,'new-token');pass('401 de uma sessão antiga não remove o token de uma sessão nova');
 await page.evaluate(async()=>{const {apiRequest}=await import('/src/services/apiClient.js');try{await apiRequest('/expired');}catch{}});await page.waitForURL('**/login');assert.equal(await page.evaluate(()=>localStorage.getItem('auth_token')),null);pass('401 da sessão ativa encerra a sessão e leva ao login');
 fs.writeFileSync(path.join(tools,'communication-panel-results.json'),JSON.stringify({passed:checks.length,checks},null,2));
}finally{await browser?.close();vite.kill('SIGTERM');}
