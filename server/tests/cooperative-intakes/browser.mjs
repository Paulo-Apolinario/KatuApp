// Tests compiled web screens with mocked requests; no production API calls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(path.resolve(process.env.KATUA_VALIDATION_TOOLS,'package.json'));
const {chromium}=require('playwright'), binaryModule=require('@sparticuz/chromium'),binary=binaryModule.default||binaryModule;
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../dist');
async function serve(root,port){const s=http.createServer((req,res)=>{let f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!f.startsWith(root+path.sep)&&f!==root){res.writeHead(403);return res.end();}if(!fs.existsSync(f)||fs.statSync(f).isDirectory())f=fs.existsSync(f+'.html')?f+'.html':path.join(root,'index.html');res.setHeader('content-type',{'.html':'text/html','.js':'application/javascript','.css':'text/css','.ttf':'font/ttf','.json':'application/json'}[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));});await new Promise(r=>s.listen(port,'127.0.0.1',r));return s;}
const servers=await Promise.all([serve(root,5191),serve(process.env.KATUA_PANEL_DIST,5192)]);
const browser=await chromium.launch({executablePath:await binary.executablePath(),args:binary.args.filter(a=>a!=='--single-process'),headless:true});
const user={id:'owner',role:'COOPERATIVE',name:'Cooperativa QA',displayName:'Cooperativa QA',email:'qa@test.invalid'},generator={id:'generator-qa',name:'Mercado QA',address:'Rua da Coleta, 123',phone:'85999991111',type:'SMALL',neighborhood:'Centro'};
const errors=[];
try{for(const kind of ['panel','app']){
const c=await browser.newContext({viewport:kind==='app'?{width:390,height:844}:{width:1365,height:960},serviceWorkers:'block'});
await c.addInitScript(({user})=>{localStorage.setItem('auth_token','qa-token');localStorage.setItem('auth_user',JSON.stringify(user));localStorage.setItem('@katu:token','qa-token');localStorage.setItem('@katu:user',JSON.stringify(user));localStorage.setItem('@katu:offline:session_local',JSON.stringify([{id:1,token:'qa-token',user_id:user.id,payload_json:JSON.stringify(user),updated_at:new Date().toISOString()}]));},{user});
const posted=[],records=[];let rejectSearch=false,loseConfirmation=kind==='app';
await c.route('**/*',async r=>{const req=r.request(),u=new URL(req.url()),p=u.pathname;
if(req.resourceType()==='document'||['script','stylesheet','font','image'].includes(req.resourceType()))return u.hostname==='127.0.0.1'?r.continue():r.abort();
const send=(data,status=200)=>r.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)});
if(req.method()==='OPTIONS')return r.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
if(p==='/auth/me')return send({user});
if(p==='/cooperative-field/generators')return rejectSearch?send({error:'Busca indisponível'},503):send({items:[generator],pagination:{page:1,totalPages:1,total:1}});
if(p==='/material-intakes'&&req.method()==='POST'){const b=req.postDataJSON();posted.push(b);const collection={id:'collection-qa',collectionMaterials:[],status:b.kind==='DIRECT'?'RECEIVED':'COLLECTED',intakeKind:b.kind,generatorId:b.generatorId,createdAt:new Date().toISOString(),intakeOrigin:{...b.origin,name:b.generatorId?generator.name:b.origin.name,...(b.performedByCooperative?{performedBy:'COOPERATIVE'}:{})}};if(!records.length)records.push(collection);if(loseConfirmation){loseConfirmation=false;return r.abort();}return send({collection},201);}
if(p==='/material-intakes')return send({items:records,pagination:{page:1,totalPages:1,total:records.length}});
if(p.includes('planning-sources'))return send({collectors:[]});
return send({items:[],routes:[],vehicles:[],drivers:[],notifications:[],unreadCount:0,total:0,summary:{},pagination:{page:1,totalPages:1,total:0}});});
const page=await c.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
if(kind==='panel'){
await page.goto('http://127.0.0.1:5192/material-intakes');
await page.getByRole('button',{name:'Receber material na cooperativa',exact:true}).click();
await page.getByLabel('Origem da entrega').selectOption('GENERATOR');
assert(await page.getByRole('button',{name:'Registrar entrada / coleta'}).isDisabled());
await page.getByLabel('Gerador cadastrado',{exact:true}).selectOption(generator.id);
await page.getByRole('button',{name:'Registrar entrada / coleta'}).click();await page.waitForURL(/waste-list/);
assert.equal(posted.length,1);assert.equal(posted[0].generatorId,generator.id);assert.equal(posted[0].kind,'DIRECT');assert.equal(posted[0].delivererId,undefined);
await page.goto('http://127.0.0.1:5192/material-intakes');await page.getByText('Entrega do gerador na cooperativa',{exact:false}).waitFor();
await page.getByRole('button',{name:'Receber material na cooperativa',exact:true}).click();await page.getByLabel('Origem da entrega').selectOption('GENERATOR');await page.getByLabel('Gerador cadastrado',{exact:true}).selectOption(generator.id);await page.getByLabel('Origem da entrega').selectOption('OTHER');assert.equal(await page.getByLabel('Pessoa / órgão / origem (opcional)').inputValue(),'');
}else{
await page.goto('http://127.0.0.1:5191/coleta-cooperativa');await page.getByRole('button',{name:'Mercado QA · Centro',exact:true}).click();
assert.equal(await page.getByLabel('Endereço onde a coleta foi efetuada *').inputValue(),generator.address);
await page.getByRole('button',{name:'Registrar coleta efetuada',exact:true}).click();await page.getByRole('button',{name:'Reenviar o mesmo registro'}).click();await page.getByText('Coleta registrada pela cooperativa',{exact:true}).waitFor();assert.equal(posted.length,2);assert.deepEqual(posted[0],posted[1]);assert.equal(records.length,1);assert.equal(posted[0].performedByCooperative,true);assert.equal(posted[0].generatorId,generator.id);assert.equal(posted[0].collectorId,undefined);
await page.getByRole('button',{name:'Registrar outra coleta'}).click();await page.getByRole('button',{name:'Pessoa ou local sem cadastro',exact:true}).click();assert.equal(await page.getByLabel('Endereço onde a coleta foi efetuada *').inputValue(),'');await page.getByRole('button',{name:'Gerador cadastrado',exact:true}).click();rejectSearch=true;await page.getByLabel('Buscar gerador por nome ou local').fill('falha');await page.getByText('Busca indisponível',{exact:true}).waitFor();assert(await page.getByRole('button',{name:'Registrar coleta efetuada',exact:true}).isDisabled());
}
console.log('PASS UI '+kind+': linked origin, confirmation/history, origin switch and error protection');await c.close();
}assert.deepEqual(errors,[]);}finally{await browser.close();for(const s of servers)await new Promise(r=>s.close(r));}
