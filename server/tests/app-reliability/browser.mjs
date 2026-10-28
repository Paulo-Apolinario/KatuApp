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
  process.env.KATUA_APP_DIST || path.join(toolsRoot, "app-reliability-dist");
const out = path.join(toolsRoot, "app-reliability-ui-evidence");
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
const checks=[],errors=[]; const pass=s=>{checks.push(s);console.log('PASS '+s)};
async function setup(role, extra=()=>{}) {
 const user={id:'qa-'+role,displayName:'QA '+role,email:'qa@test.invalid',role,...(role==='COLLECTOR'?{collector:{id:'qa-cat',name:'QA',cooperativeId:'coop'}}:{})};
 const context=await browser.newContext({viewport:{width:390,height:844},locale:'pt-BR',timezoneId:'America/Fortaleza'});
 await context.addInitScript(({user})=>{
  localStorage.setItem('@katu:token','local-fixture');localStorage.setItem('@katu:user',JSON.stringify(user));
  localStorage.setItem('@katu:offline:session_local',JSON.stringify([{id:1,token:'local-fixture',user_id:user.id,payload_json:JSON.stringify(user),updated_at:new Date().toISOString()}]));
 },{user});
 const state={fail:false,empty:false,allow:false,posts:[],pages:[]};
 await context.route('https://vps.katua.com.br/**', async r=>{
  const req=r.request(),url=new URL(req.url());
  if(req.method()==='OPTIONS')return r.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,POST,PATCH,OPTIONS'}});
  let status=200,body={};
  if(url.pathname==='/auth/me')body={user};
  else if(['/schedules','/collections','/drivers/me/reports'].includes(url.pathname)){
   if(state.fail){status=503;body={message:'Atualização indisponível QA'};}
   else {
    const total=state.empty?0:27,page=Number(url.searchParams.get('page')||1),limit=25;state.pages.push(page);
    const items=Array.from({length:Math.max(0,Math.min(limit,total-(page-1)*limit))},(_,i)=>({id:'item-'+((page-1)*limit+i),status:'COMPLETED',createdAt:'2026-10-01T12:00:00Z',collectedAt:'2026-10-01T12:00:00Z',notes:'Registro QA '+((page-1)*limit+i),materials:[],totalWeightKg:5,type:'GENERAL_NOTE',description:'Ocorrência QA '+((page-1)*limit+i)}));
    const key=url.pathname==='/schedules'?'schedules':url.pathname==='/collections'?'collections':'reports';
    body={[key]:items,pagination:{page,limit,total,hasMore:page*limit<total}};
   }
  }
  else if(url.pathname.includes('/collections/')&&req.method()==='POST'){
   state.posts.push(req.postDataJSON());
   if(!state.allow){status=409;body={message:'Confira a situação com a cooperativa QA'};}
   else body={collection:{id:'sync-point',status:url.pathname.endsWith('/start')?'IN_PROGRESS':'COLLECTED',materials:[],totalWeightKg:10}};
  }
  await r.fulfill({status,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:JSON.stringify(body)});
 });
 const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 await extra(context,user);
 return {context,page,state};
}
try {
 const pf=await setup('PF');
 await pf.page.goto('http://127.0.0.1:5180/(pf-tabs)/history');
 await pf.page.getByText(/25 de 27 registro/).waitFor();
 assert.deepEqual(pf.state.pages,[1]);
 await pf.page.getByRole('button',{name:'Carregar mais registros',exact:true}).click();
 await pf.page.getByText(/27 de 27 registro/).waitFor();assert.deepEqual(pf.state.pages,[1,2]);
 pass('Histórico em celular carrega somente a primeira página e busca mais sob demanda');
 pf.state.fail=true;await pf.page.getByRole('button',{name:'Atualizar histórico',exact:true}).click();
 await pf.page.getByRole('button',{name:'Tentar novamente',exact:true}).waitFor();
 assert.equal(await pf.page.getByText('Registro QA 26',{exact:true}).count(),1);
 await pf.page.screenshot({path:out+'/historico-com-falha.png',fullPage:true});
 pass('Falha na atualização mantém os 27 registros visíveis e oferece nova tentativa');
 pf.state.fail=false;pf.state.empty=true;await pf.page.getByRole('button',{name:'Tentar novamente',exact:true}).click();
 await pf.page.getByText('Nenhum histórico encontrado',{exact:true}).waitFor();
 pass('Resposta vazia confirmada é apresentada separadamente de falha de conexão');
 await pf.context.close();
 const cat=await setup('COLLECTOR',async (context,user)=>{
  await context.addInitScript(({owner})=>{
   const now=new Date().toISOString();
   localStorage.setItem('@katu:offline:sync_queue',JSON.stringify(['start','complete-field'].map((action,i)=>({id:'op-'+i,operation_type:'COLLECTION_FIELD_ACTION',entity_type:'COLLECTION',entity_id:'sync-point',payload_json:JSON.stringify({__ownerId:owner,id:'sync-point',action,body:{operationId:'op-'+i}}),status:'ERROR',retry_count:1,error_message:'Falha de conexão QA',created_at:new Date(Date.now()-1000+i).toISOString(),updated_at:now}))));
  },{owner:user.id});
 });
 await cat.page.goto('http://127.0.0.1:5180/sync');
 await cat.page.getByText('Início da coleta',{exact:true}).waitFor();
 await cat.page.getByText('Conclusão em campo',{exact:true}).waitFor();
 await cat.page.getByRole('button',{name:'Tentar enviar esta operação',exact:true}).last().click();
 await cat.page.getByText('Confira a situação com a cooperativa QA',{exact:true}).waitFor();
 assert.equal(cat.state.posts.length,1);assert.equal(cat.state.posts[0].operationId,'op-0');
 await cat.page.screenshot({path:out+'/central-falha-mobile.png',fullPage:true});
 pass('Central identifica cada etapa e impede enviar conclusão antes de um início rejeitado');
 cat.state.allow=true;await cat.page.getByRole('button',{name:'Tentar enviar esta operação',exact:true}).last().click();
 await cat.page.getByText('Nenhuma operação aguardando envio nesta conta.',{exact:true}).waitFor();
 assert.deepEqual(cat.state.posts.slice(-2).map(p=>p.operationId),['op-0','op-1']);
 pass('Nova tentativa confirma as etapas em ordem com os mesmos identificadores');
 await cat.page.goto('http://127.0.0.1:5180/(catador)/receipts');
 await cat.page.getByText(/25 de 27 registro/).waitFor();
 await cat.page.getByRole('button',{name:'Carregar mais registros',exact:true}).click();
 await cat.page.getByText(/27 de 27 registro/).waitFor();
 assert.equal(await cat.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await cat.page.screenshot({path:out+'/comprovantes-mobile.png',fullPage:true});
 pass('Comprovantes paginam em celular sem rolagem horizontal');
 await cat.context.close();
 const driver=await setup('DRIVER');await driver.page.goto('http://127.0.0.1:5180/(motorista)/historico-relatorios');
 await driver.page.getByText(/25 de 27 registro/).waitFor();await driver.page.getByRole('button',{name:'Carregar mais registros',exact:true}).click();await driver.page.getByText('Ocorrência QA 26',{exact:true}).waitFor();
 await driver.context.close();pass('Ocorrências do motorista carregam a segunda página sem perder a primeira');
 assert.deepEqual(errors,[]);pass('Telas revisadas sem erros JavaScript');
 fs.writeFileSync(out+'/results.json',JSON.stringify({passed:checks.length,checks,errors},null,2));
} catch(e){fs.writeFileSync(out+'/failure.txt',String(e));throw e;}
finally{await browser.close();await new Promise(r=>server.close(r));}
