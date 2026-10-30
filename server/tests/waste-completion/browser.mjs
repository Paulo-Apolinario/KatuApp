import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
const tools=process.env.KATUA_VALIDATION_TOOLS,panel=process.env.KATUA_PANEL_FRONTEND;
if(!tools||!panel)throw Error('KATUA_VALIDATION_TOOLS e KATUA_PANEL_FRONTEND obrigatórios.');
const fixture=JSON.parse(fs.readFileSync(path.join(tools,'field-operations-fixture.json'),'utf8')),ids=fixture.wasteCompletion;
const require=createRequire(path.join(tools,'package.json')),{chromium}=require('playwright');
const out=path.join(tools,'waste-completion-ui-evidence');fs.mkdirSync(out,{recursive:true});
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5179','--strictPort'],{cwd:panel,env:{...process.env,VITE_API_BASE_URL:'http://127.0.0.1:3339'},stdio:['ignore','pipe','pipe']});
await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Vite timeout')),30000);vite.stdout.on('data',b=>{if(b.toString().includes('Local:')){clearTimeout(timer);resolve();}});vite.on('exit',code=>reject(Error('Vite '+code)));});
const checks=[],pass=name=>{checks.push(name);console.log('PASS '+name);};
const api=async(url)=>{const response=await fetch('http://127.0.0.1:3339'+url,{headers:{authorization:'Bearer '+fixture.token}});assert(response.ok);return response.json();};
let browser;
try {
 browser=await chromium.launch({executablePath:process.env.KATUA_CHROMIUM_PATH||'/tmp/katua-pev-browser',args:['--no-sandbox','--disable-dev-shm-usage'],headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'pt-BR',timezoneId:'America/Fortaleza'});context.setDefaultTimeout(15000);
 await context.addInitScript(f=>{localStorage.setItem('auth_token',f.token);localStorage.setItem('auth_user',JSON.stringify(f.owner));},fixture);
 await context.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 // A fully directed, received collection does not require an artificial sorting step.
 await page.goto('http://127.0.0.1:5179/waste-list?coleta='+ids.direct);
 const dialog=page.getByRole('dialog');await dialog.getByRole('heading',{name:'Concluir coleta',exact:true}).waitFor();
 await dialog.getByRole('region',{name:'Situação dos materiais'}).getByText('Etapa do material finalizada',{exact:true}).waitFor();
 const complete=dialog.getByRole('button',{name:'Concluir coleta',exact:true});assert(await complete.isDisabled());
 await dialog.getByRole('checkbox',{name:'Confirmo a conclusão da coleta e conferi os encaminhamentos dos materiais.',exact:true}).check();assert(await complete.isEnabled());await page.screenshot({path:out+'/direct-ready.png',fullPage:true});await complete.click();
 await dialog.getByText('Concluída',{exact:true}).first().waitFor();assert.equal((await api('/collections/'+ids.direct)).collection.status,'COMPLETED');
 pass('Destinação direta finaliza o material e permite concluir coleta recebida, com confirmação explícita e sem triagem artificial');
 // Search collected waste by collection and request references, with and without #.
 await page.goto('http://127.0.0.1:5179/collected-waste');
 for(const query of ['#'+ids.direct.slice(-8).toUpperCase(),ids.direct.slice(-8),'#'+ids.request.slice(-8).toUpperCase(),ids.direct]) {
   await page.locator('#collected-search').fill(query);await page.getByRole('button',{name:'Aplicar filtros',exact:true}).click();
   await page.getByRole('row').filter({hasText:'#'+ids.direct.slice(-8).toUpperCase()}).waitFor();
   await page.waitForFunction(()=>document.querySelectorAll('tbody > tr').length===1);
 }
 await page.screenshot({path:out+'/reference-search.png',fullPage:true});
 pass('Resíduos coletados encontra código curto, #código, identificador completo e número da solicitação');
 await page.goto('http://127.0.0.1:5179/collection-requests');
 await page.locator('#request-group').selectOption('');await page.locator('#request-search').fill('#'+ids.request.slice(-8).toUpperCase());
 await page.getByRole('row').filter({hasText:'#'+ids.request.slice(-8).toUpperCase()}).waitFor();
 await page.locator('#request-search').fill('#'+ids.direct.slice(-8).toUpperCase());await page.getByRole('row').filter({hasText:'#'+ids.request.slice(-8).toUpperCase()}).waitFor();
 pass('Solicitações permite pesquisar seu protocolo e o código da coleta vinculada');
 // A completed collection with a reserved material remains actionable.
 await page.goto('http://127.0.0.1:5179/waste-destinations');await page.locator('#waste-search').fill('#'+ids.intermediate.slice(-8).toUpperCase());await page.getByRole('button',{name:'Aplicar filtros',exact:true}).click();
 await page.getByRole('button',{name:'Definir destino do material',exact:true}).waitFor();assert(await page.getByRole('button',{name:'Cancelar',exact:true}).isDisabled());
 await page.getByRole('button',{name:'Definir destino do material',exact:true}).click();const edit=page.getByRole('dialog');
 await edit.locator('input[type=radio][value=STOCK]').waitFor();assert(await edit.locator('input[type=radio][value=STOCK]').isEnabled());
 await edit.locator('input[type=radio][value=DIRECT_DESTINATION]').check();await page.screenshot({path:out+'/intermediate-conversion.png',fullPage:true});
 await edit.getByRole('button',{name:'Salvar Alterações',exact:true}).click();await edit.waitFor({state:'hidden'});
 const saved=(await api('/collection-waste-destinations/'+ids.intermediateDestination)).destination;assert.equal(saved.type,'DIRECT_DESTINATION');assert.equal((await api('/collections/'+ids.intermediate)).collection.status,'COMPLETED');
 await page.getByText('Etapa do material finalizada',{exact:true}).waitFor();assert(await page.getByRole('button',{name:'Definir destino do material',exact:true}).isDisabled());
 pass('Reserva de coleta concluída pode virar destino direto, mantém conclusão e histórico e impede alteração após etapa final');
 await page.goto('http://127.0.0.1:5179/collected-waste');await page.getByRole('button',{name:'Materiais em acompanhamento',exact:true}).click();
 await page.getByText('Materiais em acompanhamento',{exact:true}).first().waitFor();
 await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().right<=1);await page.screenshot({path:out+'/follow-up-mobile.png',fullPage:true});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
 pass('Filtro de materiais em acompanhamento permanece acessível e sem transbordamento em 390 px');
 assert.deepEqual(errors,[]);pass('Sem erros JavaScript nos fluxos completos de conclusão, conversão e busca');
 fs.writeFileSync(out+'/results.json',JSON.stringify({passed:checks.length,checks,errors,transport:'Real API + disposable PGlite database; no production access'},null,2));
}finally{await browser?.close();vite.kill('SIGTERM');}
