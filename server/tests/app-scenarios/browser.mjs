import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
const tools = process.env.KATUA_VALIDATION_TOOLS,
  appRoot = process.env.KATUA_APP_DIST;
const fixture = JSON.parse(fs.readFileSync(path.join(tools, 'field-operations-fixture.json'), 'utf8')),
  ids = fixture.cooperativeField;
const require = createRequire(path.join(tools, 'package.json')),
  {
    chromium
  } = require('playwright');
const out = path.join(tools, 'app-scenarios-ui-evidence');
fs.mkdirSync(out, {
  recursive: true
});
const staticServer = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://local').pathname);
  let file = path.resolve(appRoot, '.' + pathname);
  if (!file.startsWith(path.resolve(appRoot) + path.sep) && file !== path.resolve(appRoot)) {
    response.writeHead(403);
    return response.end();
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = fs.existsSync(file + '.html') ? file + '.html' : path.join(appRoot, 'index.html');
  response.setHeader('content-type', {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.ttf': 'font/ttf',
    '.woff': 'font/woff',
    '.json': 'application/json', '.webmanifest':'application/manifest+json'
  }[path.extname(file)] || 'application/octet-stream');
  response.end(fs.readFileSync(file));
});
await new Promise(resolve => staticServer.listen(5180, '127.0.0.1', resolve));
const checks = [],
  pass = name => {
    checks.push(name);
    console.log('PASS ' + name);
  },
  errors = [];
let browser;
const api = async (url, method = 'GET', body, token = fixture.token) => {
  const r = await fetch('http://127.0.0.1:3339' + url, {
    method,
    headers: {
      authorization: 'Bearer ' + token,
      'content-type': 'application/json'
    },
    ...(body ? {
      body: JSON.stringify(body)
    } : {})
  });
  assert(r.ok, await r.clone().text());
  return r.json();
};
async function setup(token, user) {
  const c = await browser.newContext({
    viewport: {
      width: 390,
      height: 844
    },
    locale: 'pt-BR',
    timezoneId: 'America/Fortaleza',
    geolocation: {
      latitude: -3.7302,
      longitude: -38.5202
    },
    permissions: ['geolocation']
  });
  c.setDefaultTimeout(20000);
  await c.addInitScript(({
    token,
    user
  }) => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition(success, fail) {
          if(window.__gpsDenied){setTimeout(()=>fail({code:1,message:'GPS negado QA'}),0);return;}
          setTimeout(() => success({
            timestamp: Date.now(),
            coords: {
              latitude: -3.7302,
              longitude: -38.5202,
              accuracy: 10,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null
            }
          }), 0);
        },
        watchPosition(success) {
          const fix = () => success({
            timestamp: Date.now(),
            coords: {
              latitude: -3.7302,
              longitude: -38.5202,
              accuracy: 10,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null
            }
          });
          setTimeout(fix, 0);
          return setInterval(fix, 5000);
        },
        clearWatch(id) {
          clearInterval(id);
        }
      }
    });
    if(localStorage.getItem('@qa-seeded')) return;
    localStorage.setItem('@qa-seeded','yes');
    localStorage.setItem('@katu:token', token);
    localStorage.setItem('@katu:user', JSON.stringify(user));
    localStorage.setItem('@katu:offline:session_local', JSON.stringify([{
      id: 1,
      token,
      user_id: user.id,
      payload_json: JSON.stringify(user),
      updated_at: new Date().toISOString()
    }]));
  }, {
    token,
    user
  });
  await c.route('**/*', async r => {
    const url = new URL(r.request().url());
    if (url.origin === 'https://vps.katua.com.br') {
      if (r.request().method() === 'OPTIONS') return r.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': 'authorization,content-type',
          'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS'
        }
      });
      const response = await r.fetch({
        url: r.request().url().replace('https://vps.katua.com.br', 'http://127.0.0.1:3339')
      });
      return r.fulfill({
        response,
        headers: {
          ...response.headers(),
          'access-control-allow-origin': '*'
        }
      });
    }
    if (['127.0.0.1', 'localhost'].includes(url.hostname)) return r.continue();
    return r.abort();
  });
  return c;
}const headers={'access-control-allow-origin':'*'};
const cases=[];
let currentCase='', activePage;
async function scenario(id, name, run){
 currentCase=id;console.log('RUN '+id+' '+name);await run();cases.push({id,name,status:'PASS'});pass(id+' '+name);
}
const button=(p,name)=>p.getByRole('button',{name,exact:true});
const input=(p,name)=>p.getByRole('textbox',{name,exact:true});
const coordinate=(p,lat,lng)=>p.getByText(`Latitude ${lat.toFixed(6)} · Longitude ${lng.toFixed(6)}`,{exact:true});
const confirmation=p=>p.getByRole('switch',{name:'Confirmo a localização do cadastro',exact:true});
const contexts=[];
try {
 browser=await chromium.launch({executablePath:'/tmp/katua-pev-browser',args:['--no-sandbox','--disable-dev-shm-usage'],headless:true});
 const owner=await setup(fixture.token,fixture.owner);contexts.push(owner);
 const page=await owner.newPage();activePage=page;page.on('pageerror',e=>errors.push(e.message));
 let slowZip=false,slowGeo=false,geoCalls=[];
 await owner.route('https://viacep.com.br/**',async r=>{
  const zip=r.request().url().match(/ws\/(\d+)/)?.[1];
  if(zip==='60000001'&&slowZip)await new Promise(resolve=>setTimeout(resolve,1100));
  return r.fulfill({json:zip==='99999999'?{erro:true}:{logradouro:zip==='60000001'?'Rua Primeiro CEP QA':zip==='60000002'?'Rua Segundo CEP QA':'Rua Terceiro CEP QA',bairro:'Bairro QA',localidade:'Fortaleza',uf:'CE'},headers});
 });
 await owner.route('**/cooperative-field/geocode',async r=>{
  if(r.request().method()==='OPTIONS')return r.fallback();
  const address=r.request().postDataJSON().address;geoCalls.push(address);
  if(slowGeo)await new Promise(resolve=>setTimeout(resolve,1100));
  const second=address.includes('Segundo'),third=address.includes('Terceiro');
  return r.fulfill({json:{latitude:second?-3.85:third?-3.9:-3.74,longitude:second?-38.65:third?-38.7:-38.51},headers});
 });
 await scenario('UC01','Cooperativa corrige CEP depois de selecionar e confirmar o ponto',async()=>{
  await page.goto('http://127.0.0.1:5180/(cooperativa)/geradores/novo');
  await input(page,'CEP').fill('60000001');await page.waitForFunction(()=>Array.from(document.querySelectorAll('input')).some(e=>e.value==='Rua Primeiro CEP QA'));
  await input(page,'Número').fill('123');await coordinate(page,-3.74,-38.51).waitFor();
  await page.locator('.leaflet-marker-icon[title="Novo local"]').click({force:true});await confirmation(page).check();
  await input(page,'CEP').fill('60000002');assert(await confirmation(page).isDisabled());assert.equal(await confirmation(page).isChecked(),false);
  await coordinate(page,-3.85,-38.65).waitFor();assert.equal(await input(page,'Rua *').inputValue(),'Rua Segundo CEP QA');
  await button(page,'Buscar CEP').click();await coordinate(page,-3.85,-38.65).waitFor();
  await button(page,'Buscar endereço no mapa').click();await coordinate(page,-3.85,-38.65).waitFor();
  const map=await page.locator('.leaflet-container').boundingBox(),pin=await page.locator('.leaflet-marker-icon[title="Novo local"]').boundingBox();
  assert(pin.x>=map.x&&pin.x+pin.width<=map.x+map.width);assert(pin.y>=map.y&&pin.y+pin.height<=map.y+map.height);
  assert(geoCalls.at(-1).includes('60000002'));await page.screenshot({path:out+'/cep-corrigido.png',fullPage:true});
 });
 await scenario('UC02','Respostas atrasadas de CEP e mapa não sobrescrevem endereço mais recente',async()=>{
  slowZip=true;const started=page.waitForRequest('https://viacep.com.br/ws/60000001/json/');await input(page,'CEP').fill('60000001');await started;await input(page,'CEP').fill('60000003');
  await coordinate(page,-3.9,-38.7).waitFor();assert.equal(await input(page,'Rua *').inputValue(),'Rua Terceiro CEP QA');slowZip=false;
  slowGeo=true;const startedGeo=page.waitForRequest(r=>r.url().endsWith('/cooperative-field/geocode')&&r.method()==='POST');await button(page,'Buscar endereço no mapa').click();await startedGeo;await input(page,'CEP').fill('60000002');
  await coordinate(page,-3.85,-38.65).waitFor();assert.equal(await input(page,'Rua *').inputValue(),'Rua Segundo CEP QA');slowGeo=false;
 });
 await scenario('UC03','CEP inexistente invalida o ponto; correção manual e rascunho recuperado permanecem seguros',async()=>{
  await confirmation(page).check();await input(page,'CEP').fill('99999999');await page.getByText('CEP não encontrado.',{exact:true}).waitFor();assert(await confirmation(page).isDisabled());
  await button(page,'Buscar endereço no mapa').click();await page.getByText('Busque o novo CEP antes de localizar o endereço no mapa.',{exact:true}).waitFor();
  await input(page,'Nome / responsável *').fill('Rascunho endereço QA');
  await button(page,'Usar minha localização').click();await coordinate(page,-3.7302,-38.5202).waitFor();await confirmation(page).check();
  await page.getByText('Rascunho salvo neste aparelho.',{exact:true}).waitFor();await page.reload();await input(page,'Nome / responsável *').waitFor();await page.waitForFunction(()=>Array.from(document.querySelectorAll('input')).some(e=>e.value==='Rascunho endereço QA'));
  await coordinate(page,-3.7302,-38.5202).waitFor();assert(await confirmation(page).isChecked());
  await input(page,'CPF/CNPJ *').fill('12345678909');await input(page,'E-mail *').fill('gerador-corrigido-app@test.invalid');await page.getByText('Rascunho salvo neste aparelho.',{exact:true}).waitFor();await button(page,'Salvar gerador').click();await page.getByText('Sincronizado · cadastro confirmado no sistema.',{exact:true}).waitFor();await button(page,'Abrir cadastro').click();await page.getByText('Gerador residencial cadastrado',{exact:true}).filter({visible:true}).waitFor();
 });
 await scenario('UC04','PEV troca CEP e grava somente as coordenadas do endereço corrigido',async()=>{
  await page.goto('http://127.0.0.1:5180/(cooperativa)/pevs/novo');await input(page,'Nome do PEV *').fill('PEV CEP corrigido QA');await input(page,'CEP').fill('60000001');await input(page,'Número').fill('40');await coordinate(page,-3.74,-38.51).waitFor();
  await confirmation(page).check();await input(page,'CEP').fill('60000002');await coordinate(page,-3.85,-38.65).waitFor();await confirmation(page).check();
  await page.getByText('Rascunho salvo neste aparelho.',{exact:true}).waitFor();await button(page,'Salvar PEV').click();await page.getByText('Sincronizado · cadastro confirmado no sistema.',{exact:true}).waitFor();await button(page,'Abrir cadastro').click();await page.getByText('PEV CEP corrigido QA',{exact:true}).waitFor();
  const items=(await api('/cooperative-field/pevs?q=PEV%20CEP%20corrigido%20QA')).items;assert.equal(items.length,1);assert.equal(items[0].latitude,-3.85);assert.equal(items[0].longitude,-38.65);
 });
 await scenario('UC05','Cooperativa pesquisa geradores, pagina resultados e abre atendimentos e mapa',async()=>{
  await page.goto('http://127.0.0.1:5180/(cooperativa)/geradores');await input(page,'Buscar por nome ou local').fill('Paginação campo');await button(page,'Buscar').click();await page.getByText('22 registro(s) · Página 1 de 2',{exact:true}).waitFor();assert.equal(await button(page,'Ver informações').count(),20);
  await button(page,'Próxima').click();await page.getByText('22 registro(s) · Página 2 de 2',{exact:true}).waitFor();assert.equal(await button(page,'Ver informações').count(),2);
  await input(page,'Buscar por nome ou local').fill('Gerador campo QA');await button(page,'Buscar').click();await page.getByText('1 registro(s) · Página 1 de 1',{exact:true}).waitFor();await button(page,'Ver informações').click();await page.getByText('Solicitações recentes',{exact:true}).waitFor();await button(page,'Localizar no mapa').click();await page.getByText('Mapa dos geradores',{exact:true}).waitFor();
 });
 await scenario('UC06','Relatórios validam datas e recuperam falha sem apresentar período inválido como resultado',async()=>{
  await page.goto('http://127.0.0.1:5180/(cooperativa)/relatorios');await input(page,'Data inicial (dd/mm/aaaa)').fill('31022026');await button(page,'Aplicar período').click();await page.getByText('Data inválida.',{exact:true}).waitFor();
  await input(page,'Data inicial (dd/mm/aaaa)').fill('31102026');await input(page,'Data final (dd/mm/aaaa)').fill('01102026');await button(page,'Aplicar período').click();await page.getByText('Escolha um período de até 366 dias, em ordem crescente.',{exact:true}).waitFor();
  await input(page,'Data inicial (dd/mm/aaaa)').fill('01102026');await input(page,'Data final (dd/mm/aaaa)').fill('31102026');await button(page,'Aplicar período').click();
  let fail=true;await owner.route('**/reports/overview?**',r=>r.request().method()==='OPTIONS'?r.fallback():fail?r.fulfill({status:503,json:{message:'Relatório temporariamente indisponível QA'},headers}):r.fallback());
  await button(page,'Visão geral').click();await button(page,'Tentar novamente').waitFor();assert.equal(await page.getByText('Nenhum registro no período selecionado.',{exact:true}).count(),0);
  fail=false;await button(page,'Tentar novamente').click();await page.getByText('Materiais no período',{exact:true}).waitFor();await button(page,'Estoque atual').click();await page.getByText('Saldo atual de estoque; o período não representa um saldo histórico.',{exact:true}).waitFor();
 });
 const driver=await setup(fixture.fieldMeeting.driverToken,fixture.fieldMeeting.driverUser);contexts.push(driver);const dp=await driver.newPage();dp.on('pageerror',e=>errors.push(e.message));
 await scenario('UC07','Motorista recusa GPS, autoriza envio, cooperativa acompanha e encerramento oculta posição',async()=>{
  activePage=dp;await driver.addInitScript(()=>window.__gpsDenied=true);await dp.goto('http://127.0.0.1:5180/(motorista)/home');await button(dp,'Ativar GPS e enviar localização').click();await dp.getByText(/Ative a localização do aparelho e permita o acesso/).waitFor();
  await dp.evaluate(()=>window.__gpsDenied=false);await button(dp,'Ativar GPS e enviar localização').click();await dp.getByText('Enviar localização durante o serviço?',{exact:true}).waitFor({state:'hidden'});
  await page.goto('http://127.0.0.1:5180/(cooperativa)/motoristas/localizacao?id='+fixture.fieldMeeting.driver);await page.getByText('Localização atualizada',{exact:true}).waitFor();
  await dp.goto('http://127.0.0.1:5180/(motorista)/rotas?highlightRouteId='+fixture.fieldMeeting.route);await dp.evaluate(()=>window.__gpsDenied=false);await button(dp,'Adicionar ponto durante a rota').click();await input(dp,'Nome do local').fill('Ponto novo motorista UC07');await input(dp,'Endereço do ponto').fill('Rua nova parada, 20, Fortaleza');await button(dp,'Usar GPS neste ponto avulso').click();await dp.getByText(/Posição selecionada:/).waitFor();await button(dp,'Adicionar ponto à execução').click();await dp.getByText('Ponto novo motorista UC07',{exact:true}).waitFor();
  await dp.goto('http://127.0.0.1:5180/(motorista)/compartilhar-localizacao');await button(dp,'Encerrar compartilhamento').click();await button(dp,'Iniciar compartilhamento').waitFor();assert.equal((await api('/driver-tracking/drivers/'+fixture.fieldMeeting.driver)).position,null);
 });
 const cat=await setup(fixture.browserOffline.catToken,fixture.browserOffline.catUser);contexts.push(cat);const cp=await cat.newPage();cp.on('pageerror',e=>errors.push(e.message));
 await scenario('UC08','Catador inicia offline, recupera observações no reload e sincroniza sem antecipar registro remoto',async()=>{
  activePage=cp;await cp.goto('http://127.0.0.1:5180/(catador)/collect?highlightCollectionId='+fixture.browserOffline.collection);await cp.getByText('Iniciar coleta',{exact:true}).waitFor();await cp.waitForFunction(async()=>{for(const k of await caches.keys())if(await(await caches.open(k)).match('/__katua_ready__'))return true;return false;},{},{timeout:60000});
  await cp.waitForFunction(()=>!!navigator.serviceWorker.controller);await cat.setOffline(true);await cp.reload();await cp.getByText('Iniciar coleta',{exact:true}).click();await cp.getByText('Finalizar etapa de campo',{exact:true}).waitFor();await cp.getByPlaceholder('Observações da execução da coleta').fill('Recebimento protegido UC08');await cp.getByText('Rascunho de campo salvo neste aparelho.',{exact:true}).waitFor();await cp.reload();await cp.waitForFunction(()=>document.querySelector('textarea')?.value==='Recebimento protegido UC08');assert.equal((await api('/collections/'+fixture.browserOffline.collection)).collection.status,'PENDING');
  await cat.setOffline(false);await cp.goto('http://127.0.0.1:5180/sync');await button(cp,'Tentar enviar pendências').first().click();
  for(let i=0;i<30;i++){if((await api('/collections/'+fixture.browserOffline.collection)).collection.status==='IN_PROGRESS')break;await new Promise(resolve=>setTimeout(resolve,200));}assert.equal((await api('/collections/'+fixture.browserOffline.collection)).collection.status,'IN_PROGRESS');
 });
 await scenario('UC09','Catador consulta coleta de óleo em litros e cooperativa vê o mesmo trabalho',async()=>{
  await cp.goto('http://127.0.0.1:5180/(catador)/receipts');await cp.getByText(/Óleo de cozinha QA/).first().waitFor();assert((await cp.locator('body').innerText()).includes('50 L'));
  await page.goto('http://127.0.0.1:5180/(cooperativa)/catadores/'+fixture.cooperativeField.collector);await page.getByText('Óleo de cozinha QA: 50 L',{exact:true}).waitFor();
 });
 const gen=await setup(fixture.fieldMeeting.generatorToken,fixture.fieldMeeting.generatorUser);contexts.push(gen);const gp=await gen.newPage();gp.on('pageerror',e=>errors.push(e.message));
 await scenario('UC10','Gerador aceita termo, corrige data e envia solicitação com material e quantidade',async()=>{
  activePage=gp;await gp.goto('http://127.0.0.1:5180/(gerador)/dashboard');const confirm=button(gp,'Confirmar e continuar');await confirm.waitFor();assert(await confirm.isDisabled());await gp.getByRole('switch',{name:'Li e concordo com os Termos de Uso e estou ciente do Aviso de Privacidade'}).click();await confirm.click();await confirm.waitFor({state:'hidden'});
  await gp.goto('http://127.0.0.1:5180/(gerador)/schedule');await gp.getByPlaceholder('DD/MM/AAAA').fill('31022027');await gp.getByPlaceholder('HH:MM').fill('2561');assert.equal(await gp.getByPlaceholder('DD/MM/AAAA').inputValue(),'31/02/2027');assert.equal(await gp.getByPlaceholder('HH:MM').inputValue(),'25:61');
  await gp.getByText('Solicitar coleta',{exact:true}).last().click();await gp.getByText('Informe uma data e um horário válidos.',{exact:true}).waitFor();assert((await api('/privacy/notice','GET',undefined,fixture.fieldMeeting.generatorToken)).acceptance);
  const future=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Fortaleza'}).format(new Date(Date.now()+7*86400000));await gp.getByPlaceholder('DD/MM/AAAA').fill(future.replaceAll('/',''));await gp.getByPlaceholder('HH:MM').fill('1430');await gp.getByText('Papel entrada QA',{exact:true}).first().click();await gp.getByPlaceholder('Quantidade estimada, opcional').fill('2,5');
  const sent=gp.waitForResponse(r=>new URL(r.url()).pathname==='/schedules'&&r.request().method()==='POST');await gp.getByText('Solicitar coleta',{exact:true}).last().click();const response=await sent;assert.equal(response.status(),201);const saved=(await response.json()).schedule;assert(saved.id);assert.equal(Number(saved.requestedMaterials[0].estimatedQuantity),2.5);await gp.waitForURL(/dashboard/);

 });
 assert.deepEqual(errors,[]);
}catch(e){cases.push({id:currentCase,status:'FAIL',error:String(e)});console.error(e);await activePage?.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});if(activePage)fs.writeFileSync(out+'/failure.txt',await activePage.locator('body').innerText());process.exitCode=1;}
finally{
 fs.writeFileSync(out+'/results.json',JSON.stringify({date:'2026-11-04',passed:cases.filter(c=>c.status==='PASS').length,cases,errors,environment:'App Web export + API local + banco descartável. CEP, geocodificação e GPS simulados; nenhum acesso à produção. Sem testes nativos.'},null,2));
 for(const c of contexts)await c.unrouteAll({behavior:'ignoreErrors'});await browser?.close();await new Promise(resolve=>staticServer.close(resolve));
}
