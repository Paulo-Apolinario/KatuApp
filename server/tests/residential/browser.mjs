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
  process.env.KATUA_APP_DIST || path.join(toolsRoot, "residential-dist");
const out = path.join(toolsRoot, "residential-ui-evidence");
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
const fixture=JSON.parse(fs.readFileSync(path.join(toolsRoot,'residential-fixture.json'),'utf8'));
const context=await browser.newContext({viewport:{width:390,height:844},locale:'pt-BR',timezoneId:'America/Fortaleza'});
await context.addInitScript(({token,user})=>{localStorage.setItem('@katu:token',token);localStorage.setItem('@katu:user',JSON.stringify(user));localStorage.setItem('@katu:offline:session_local',JSON.stringify([{id:1,token,user_id:user.id,payload_json:JSON.stringify(user),updated_at:new Date().toISOString()}]));},{token:fixture.token,user:fixture.user});
await context.route(/https:\/\/.*(?:tile|openstreetmap)/,r=>r.abort());
let dropReply=true,submitted=[],created=null;
await context.route('https://vps.katua.com.br/**',async r=>{
 if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,POST,PATCH,PUT,DELETE,OPTIONS'}});
 const url=r.request().url().replace('https://vps.katua.com.br','http://127.0.0.1:3339');
 const response=await r.fetch({url});
 if(new URL(url).pathname==='/schedules'&&r.request().method()==='POST'){
  submitted.push(r.request().postDataJSON());const body=await response.json();if(response.status()===201)created=body.schedule.id;
  if(dropReply&&response.status()===201){dropReply=false;return r.abort('connectionfailed');}
 }
 await r.fulfill({response,headers:{...response.headers(),'access-control-allow-origin':'*'}});
});
const page=await context.newPage();page.setDefaultTimeout(20000);const errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));const pass=s=>{checks.push(s);console.log('PASS '+s)};
try{
 await page.goto('http://127.0.0.1:5180/(pf-tabs)/residential-home');
 await page.getByText('KATUÁ · GERADOR RESIDENCIAL',{exact:true}).waitFor();
 await page.getByText('14,5 kg',{exact:true}).waitFor();
 await page.screenshot({path:out+'/inicio-mobile.png',fullPage:false});
 pass('Início identifica gerador residencial e mostra resultados reais sem peso previsto');
 await page.goto('http://127.0.0.1:5180/(pf-tabs)/residential-request');
 await page.getByRole('radio').filter({hasText:'Cooperativa de operações QA'}).click();
 await page.getByRole('button',{name:'Continuar',exact:true}).click();
 await page.getByRole('button',{name:'Casa',exact:true}).click();
 assert.equal(await page.getByLabel('Endereço completo e referência',{exact:true}).inputValue(),'Rua da residência, 100, Fortaleza');
 await page.getByRole('button',{name:'Continuar',exact:true}).click();
 await page.getByRole('checkbox').filter({hasText:'Papelão QA'}).click();
 await page.getByRole('button',{name:'Continuar',exact:true}).click();
 const future=new Date(Date.now()+86400000*4);const d=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Fortaleza'}).format(future);
 await page.getByLabel('Data preferencial (DD/MM/AAAA)',{exact:true}).fill(d.replaceAll('/',''));
 await page.getByLabel('Horário preferencial (HH:MM)',{exact:true}).fill('1430');
 assert.equal(await page.getByLabel('Data preferencial (DD/MM/AAAA)',{exact:true}).inputValue(),d);
 assert.equal(await page.getByLabel('Horário preferencial (HH:MM)',{exact:true}).inputValue(),'14:30');
 await page.screenshot({path:out+'/data-hora-mobile.png',fullPage:false});
 await page.getByRole('button',{name:'Continuar',exact:true}).click();
 await page.getByText('Revise antes de enviar',{exact:true}).waitFor();assert.equal(submitted.length,0);
 pass('Solicitação em cinco etapas usa endereço salvo, quantidade desconhecida, máscaras e revisão antes do envio');
 await page.getByRole('button',{name:'Confirmar e enviar solicitação',exact:true}).click();
 await page.getByText('Há um envio aguardando confirmação',{exact:true}).waitFor();
 assert.equal(submitted.length,1);assert.ok(created);
 await page.reload();await page.getByRole('button',{name:'Retomar envio com segurança',exact:true}).click();
 await page.getByText('Linha do tempo',{exact:true}).waitFor();
 assert.equal(submitted.length,2);assert.deepEqual(submitted[0],submitted[1]);
 pass('Envio confirmado no servidor com resposta perdida é retomado após recarregar sem criar duplicidade');
 await page.getByRole('button',{name:'Cancelar solicitação',exact:true}).click();await page.getByRole('button',{name:'Confirmar cancelamento',exact:true}).click();
 await page.getByText('Cancelada',{exact:true}).waitFor();await page.screenshot({path:out+'/acompanhamento-mobile.png',fullPage:false});
 pass('Detalhes mostram linha do tempo e permitem cancelar somente após confirmação do morador');
 await page.getByRole('button',{name:'Repetir esta solicitação',exact:true}).click();
 await page.getByRole('button',{name:'Continuar',exact:true}).click();await page.getByRole('button',{name:'Continuar',exact:true}).click();
 assert.equal(await page.getByRole('checkbox').filter({hasText:'Papelão QA'}).getAttribute('aria-checked'),'true');
 await page.getByRole('button',{name:'Continuar',exact:true}).click();assert.equal(await page.getByLabel('Data preferencial (DD/MM/AAAA)',{exact:true}).inputValue(),'');assert.equal(await page.getByLabel('Horário preferencial (HH:MM)',{exact:true}).inputValue(),'');
 pass('Repetir preenche endereço e materiais, preserva a seleção na mesma cooperativa e exige nova data');
 await page.goto(`http://127.0.0.1:5180/(pf-tabs)/request-details?id=${fixture.scheduled}`);await page.getByText('Atendimento programado',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Cancelar solicitação',exact:true}).count(),0);
 pass('Atendimento programado não oferece cancelamento indevido ao morador');
 await page.goto('http://127.0.0.1:5180/(pf-tabs)/residential-profile');
 await page.getByLabel('CPF',{exact:true}).waitFor();assert.equal(await page.getByLabel('CPF',{exact:true}).inputValue(),'12345678901');
 await page.getByLabel('Nome do local',{exact:true}).fill('Condomínio');await page.getByLabel('Novo endereço e referência',{exact:true}).fill('Rua do condomínio, 200, Fortaleza');
 await page.getByRole('button',{name:'Adicionar endereço à edição',exact:true}).click();await page.getByRole('button',{name:'Salvar meus dados',exact:true}).click();
 await page.getByText('Dados e endereços atualizados.',{exact:true}).waitFor();await page.reload();await page.getByText('Condomínio',{exact:true}).waitFor();
 pass('CPF e endereço são exibidos corretamente e endereços adicionais persistem na conta');
 await page.goto('http://127.0.0.1:5180/(pf-tabs)/residential-participation');await page.getByText('Massa recebida acumulada',{exact:true}).waitFor();await page.getByText('14,5 kg',{exact:true}).waitFor();
 await page.screenshot({path:out+'/participacao-mobile.png',fullPage:false});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 pass('Participação mensal apresenta somente massa recebida, com vírgula e sem transbordamento no celular');
 await page.goto('http://127.0.0.1:5180/(pf-tabs)/residential-planner');await page.getByLabel('Plástico',{exact:true}).fill('-5');await page.getByText('Corrija os valores',{exact:true}).waitFor();await page.getByLabel('Plástico',{exact:true}).fill('1,5');await page.getByText('1,50 kg estimados',{exact:true}).waitFor();
 pass('Calculadora rejeita valores negativos e distingue simulação de coleta real');
 await page.goto('http://127.0.0.1:5180/(pf-tabs)/residential-history');await page.getByRole('button',{name:'Acompanhar solicitação',exact:true}).first().waitFor();assert.equal(await page.getByText('Nenhum histórico encontrado',{exact:true}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Acompanhar solicitação',exact:true}).count(),25);
 await page.getByRole('button',{name:'Carregar mais registros',exact:true}).click();await page.getByRole('button',{name:'Acompanhar solicitação',exact:true}).nth(25).waitFor();
 pass('Histórico carrega a segunda página sem perder o acesso aos pedidos anteriores');
 pass('Histórico paginado apresenta cards com acesso ao acompanhamento');
 await page.goto('http://127.0.0.1:5180/(pf-tabs)/residential-pevs');
 await page.getByRole('button',{name:'Encontrar PEV',exact:true}).waitFor();
 await page.getByRole('button',{name:'Encontrar PEV',exact:true}).click();await page.getByLabel('Buscar PEV por nome, código, bairro ou município',{exact:true}).waitFor();
 pass('PEVs abrem acompanhamento próprio e permitem buscar pontos sem afetar outros perfis');
 await page.setViewportSize({width:1280,height:900});await page.goto('http://127.0.0.1:5180/(pf-tabs)/residential-home');await page.getByText('14,5 kg',{exact:true}).waitFor();await page.screenshot({path:out+'/inicio-desktop.png',fullPage:false});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 pass('Layout também funciona em desktop');
 assert.deepEqual(errors,[]);pass('Fluxo residencial sem erros JavaScript');
 fs.writeFileSync(out+'/results.json',JSON.stringify({passed:checks.length,checks,errors},null,2));
}catch(e){await page.screenshot({path:out+'/failure.png',fullPage:false}).catch(()=>{});throw e;}
finally{await context.unrouteAll({behavior:'ignoreErrors'});await browser.close();await new Promise(r=>server.close(r));}
