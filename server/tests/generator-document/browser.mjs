import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';import {spawn} from 'node:child_process';
const tools=process.env.KATUA_VALIDATION_TOOLS,panel=process.env.KATUA_PANEL_FRONTEND;
if(!tools||!panel)throw Error('Ferramentas e frontend local obrigatórios');
const fixture=JSON.parse(fs.readFileSync(path.join(tools,'field-operations-fixture.json'),'utf8'));
const require=createRequire(path.join(tools,'package.json'));const {chromium}=require('playwright');
const out=path.join(tools,'generator-document-ui-evidence');fs.mkdirSync(out,{recursive:true});
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5179','--strictPort'],{cwd:panel,env:{...process.env,VITE_API_BASE_URL:'http://127.0.0.1:3339'},stdio:['ignore','pipe','pipe']});
await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Vite timeout')),30000);vite.stdout.on('data',b=>{if(b.toString().includes('Local:')){clearTimeout(timer);resolve();}});vite.on('exit',code=>reject(Error('Vite '+code)));});
const checks=[];const pass=name=>{checks.push(name);console.log('PASS '+name);};
const api=async(url,method='GET',body)=>{const r=await fetch('http://127.0.0.1:3339'+url,{method,headers:{authorization:'Bearer '+fixture.token,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});assert(r.ok,await r.clone().text());return r.json();};
function cpf(base){const digit=s=>{const sum=[...s].reduce((n,c,i)=>n+Number(c)*(s.length+1-i),0);const r=sum%11;return String(r<2?0:11-r);};const a=base+digit(base);return a+digit(a);}
const cpfNumber=cpf('111222333'),secondCpf=cpf('222333444'),cnpj='12345678000195';
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.KATUA_CHROMIUM_PATH||'/tmp/katua-pev-browser',args:['--no-sandbox','--disable-dev-shm-usage'],headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'pt-BR',timezoneId:'America/Fortaleza'});
 await context.addInitScript(f=>{
  localStorage.setItem('auth_token',f.token);localStorage.setItem('auth_user',JSON.stringify(f.owner));
  // Controlled map interaction only; all API writes below use the real local server.
  window.google={maps:{Map:class{constructor(el){this.listeners={};el.setAttribute('aria-label','Mapa de teste');el.addEventListener('click',()=>this.listeners.click?.({latLng:{lat:()=>-3.73,lng:()=>-38.52}}));}addListener(name,fn){this.listeners[name]=fn;}panTo(){}setZoom(){}},Marker:class{addListener(){}setVisible(){}setPosition(){}}}};
 },fixture);
 await context.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));let posts=0;
 page.on('request',r=>{if(r.method()==='POST'&&new URL(r.url()).pathname==='/generators')posts++;});
 await page.goto('http://127.0.0.1:5179/create-generator');
 await page.getByLabel('CPF/CNPJ *',{exact:true}).waitFor();
 await page.locator('input[name=name]').fill('Residencial documento navegador QA');await page.locator('input[name=email]').fill('browser-cpf@test.invalid');
 await page.getByLabel('CPF/CNPJ *',{exact:true}).fill('52998224726');await page.getByRole('button',{name:'Salvar gerador',exact:true}).click();
 await page.getByText('Informe um CPF ou CNPJ válido, incluindo os dígitos verificadores.',{exact:true}).waitFor();assert.equal(posts,0);
 await page.getByLabel('CPF/CNPJ *',{exact:true}).fill(cpfNumber);assert.match(await page.getByLabel('CPF/CNPJ *',{exact:true}).inputValue(),/^\d{3}\.\d{3}\.\d{3}-\d{2}$/);
 await page.getByText('CPF · Gerador residencial cadastrado',{exact:true}).waitFor();pass('Cadastro aplica máscara CPF, mostra classificação e bloqueia documento inválido antes do envio');
 await page.getByLabel('Mapa de teste').click();await page.getByRole('button',{name:'Confirmar localização',exact:true}).click();await page.getByRole('button',{name:'Salvar gerador',exact:true}).click();await page.waitForURL('**/generator-list');
 const row=page.getByRole('row').filter({hasText:'Residencial documento navegador QA'});await row.waitFor();assert(await row.getByText('Gerador residencial cadastrado',{exact:true}).isVisible());
 const saved=(await api('/generators')).generators.find(g=>g.email==='browser-cpf@test.invalid');assert.equal(saved.documentNumber,cpfNumber);assert.equal(saved.type,'SMALL');assert.equal(saved.registrationCategory,'REGISTERED_RESIDENTIAL');pass('Painel e API local persistem CPF normalizado no mesmo cadastro SMALL');
 await page.goto('http://127.0.0.1:5179/create-generator');await page.locator('input[name=name]').fill('Pequeno CNPJ navegador QA');await page.locator('input[name=email]').fill('browser-cnpj@test.invalid');
 await page.getByLabel('CPF/CNPJ *',{exact:true}).fill('12abc34501de35');assert.equal(await page.getByLabel('CPF/CNPJ *',{exact:true}).inputValue(),'12.ABC.345/01DE-35');await page.getByText('CNPJ · Pequeno gerador',{exact:true}).waitFor();
 await page.getByLabel('CPF/CNPJ *',{exact:true}).fill(cnpj);assert.equal(await page.getByLabel('CPF/CNPJ *',{exact:true}).inputValue(),'12.345.678/0001-95');
 await page.getByLabel('Mapa de teste').click();await page.getByRole('button',{name:'Confirmar localização',exact:true}).click();await page.getByRole('button',{name:'Salvar gerador',exact:true}).click();await page.waitForURL('**/generator-list');
 const business=(await api('/generators')).generators.find(g=>g.email==='browser-cnpj@test.invalid');assert.equal(business.documentNumber,cnpj);assert.equal(business.registrationCategory,'SMALL_BUSINESS');pass('Cadastro aceita máscara numérica/alfanumérica de CNPJ e grava pequeno gerador');
 await page.getByLabel('Classificação',{exact:true}).selectOption('REGISTERED_RESIDENTIAL');assert.equal(await page.getByRole('row').filter({hasText:'Pequeno CNPJ navegador QA'}).count(),0);assert.equal(await row.count(),1);
 await page.getByLabel('Classificação',{exact:true}).selectOption('');await page.getByLabel('Buscar gerador...',{exact:true}).fill('12.345.678/0001-95');await page.getByRole('row').filter({hasText:'Pequeno CNPJ navegador QA'}).waitFor();assert.equal(await row.count(),0);pass('Lista filtra classificação e pesquisa documento com pontuação');
 const legacy=(await api('/generators','POST',{type:'SMALL',name:'Legado navegador QA',email:'browser-legacy@test.invalid',latitude:-3.73,longitude:-38.52})).generator;
 await page.goto('http://127.0.0.1:5179/edit-generator/'+legacy.id);await page.getByText('Cadastro anterior sem documento.',{exact:false}).waitFor();
 await page.getByLabel('CPF/CNPJ',{exact:true}).fill(secondCpf);await page.getByRole('button',{name:'Salvar alterações',exact:true}).click();await page.waitForURL('**/generator-list');
 assert.equal((await api('/generators/'+legacy.id)).generator.registrationCategory,'REGISTERED_RESIDENTIAL');pass('Edição completa CPF de cadastro legado e reclassifica sem recriar o gerador');
 await page.goto('http://127.0.0.1:5179/edit-generator/'+legacy.id);await page.getByLabel('CPF/CNPJ *',{exact:true}).waitFor();await page.getByLabel('CPF/CNPJ *',{exact:true}).fill(cpfNumber);await page.getByRole('button',{name:'Salvar alterações',exact:true}).click();await page.getByText('Já existe um gerador nesta cooperativa com este CPF/CNPJ.',{exact:true}).waitFor();assert.equal((await api('/generators/'+legacy.id)).generator.documentNumber,secondCpf);pass('Documento duplicado apresenta erro e preserva o cadastro original');
 await page.getByText("Já existe um gerador nesta cooperativa com este CPF/CNPJ.",{exact:true}).waitFor({state:"hidden"});
 await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().right<=1);await page.getByLabel('CPF/CNPJ *',{exact:true}).fill(secondCpf);await page.getByLabel('CPF/CNPJ *',{exact:true}).scrollIntoViewIfNeeded();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));await page.screenshot({path:out+'/document-field-mobile.png',fullPage:true});pass('Campo e indicação de classificação permanecem utilizáveis em tela de 390px');
 assert.deepEqual(errors,[]);pass('Fluxos de cadastro, lista e edição sem erros JavaScript');
 fs.writeFileSync(out+'/results.json',JSON.stringify({passed:checks.length,checks,errors,transport:'Real local Fastify API + disposable PGlite; controlled map'},null,2));
}finally{await browser?.close();vite.kill('SIGTERM');}
