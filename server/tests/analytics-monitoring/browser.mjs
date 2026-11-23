// Compiled panel UI. All API requests are mocked; no production access.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
const require=createRequire(path.resolve(process.env.KATUA_VALIDATION_TOOLS,'package.json'));
const {chromium}=require('playwright'),mod=require('@sparticuz/chromium'),binary=mod.default||mod;
const root=process.env.KATUA_PANEL_DIST,out=fs.mkdtempSync(path.join(os.tmpdir(),'katua-monitoring-ui-'));
const server=http.createServer((req,res)=>{let f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!f.startsWith(root+path.sep)&&f!==root){res.writeHead(403);return res.end();}if(!fs.existsSync(f)||fs.statSync(f).isDirectory())f=path.join(root,'index.html');res.setHeader('content-type',{'.html':'text/html','.js':'application/javascript','.css':'text/css','.ttf':'font/ttf'}[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));});
await new Promise(r=>server.listen(5195,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:await binary.executablePath(),args:binary.args.filter(a=>a!=='--single-process'),headless:true});
const now=new Date().toISOString(),errors=[];
const org={id:'coop-a',name:'Cooperativa Alfa',city:'Fortaleza',state:'CE',document:'Documento QA',access_status:'READY',registered_at:now,enabled_at:null,last_login:now,last_activity:now,seconds:150,days:1,web_used:true,app_used:true,accounts:21,measured_accounts:2,collections:5,receipts:4,triages:2,dispatches:1};
const account=i=>({id:'account-'+i,name:'Conta '+i,role:i===21?'COLLECTOR':'COOPERATIVE',access_status:i===21?'PENDING':'READY',registered_at:now,enabled_at:null,first_login:now,last_login:now,last_activity:now,seconds:60,days:1,web_used:true,app_used:false});
try{for(const role of ['ADMIN','COOPERATIVE']){
const c=await browser.newContext({viewport:role==='COOPERATIVE'?{width:390,height:844}:{width:1440,height:960},serviceWorkers:'block',acceptDownloads:true});
await c.addInitScript(({role})=>{localStorage.setItem('auth_token','local-monitoring-token');localStorage.setItem('auth_user',JSON.stringify({id:'local-owner',role,displayName:'Gestor QA'}));},{role});
let fail=false,failExport=false;const requests=[];
await c.route('**/*',async r=>{const req=r.request(),u=new URL(req.url()),p=u.pathname;
if(['document','script','stylesheet','font','image'].includes(req.resourceType()))return u.hostname==='127.0.0.1'?r.continue():r.abort();
const send=(body,status=200)=>r.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
if(p==='/auth/me')return send({user:{id:'local-owner',role,displayName:'Gestor QA'}});
if(p==='/analytics/access/unlock')return send({data:{token:'a'.repeat(64),expiresAt:new Date(Date.now()+1800000).toISOString()}});
if(p.startsWith('/analytics/monitoring')){
requests.push(u);if(fail)return send({error:'Consulta indisponível'},503);if(failExport&&p.endsWith('/export'))return send({error:'Exportação indisponível'},503);
const detail=!!u.searchParams.get('cooperativeId'),page=Number(u.searchParams.get('page')||1),none=u.searchParams.get('search')==='Nenhum';
const items=none?[]:[org,...(role==='ADMIN'&&!detail?[{...org,id:'coop-b',name:'Cooperativa Beta',city:'Sobral',last_login:null,last_activity:null,seconds:0,days:0,measured_accounts:0,web_used:false,app_used:false}]:[])];
return send({data:{scope:role==='ADMIN'?'ALL':'OWN',summary:{cooperatives:items.length,enabled:items.length,measured:none?0:1,seconds:none?0:150},items,accounts:detail?(p.endsWith('/export')?Array.from({length:21},(_,i)=>account(i+1)):page===1?Array.from({length:20},(_,i)=>account(i+1)):[account(21)]):undefined,accountPagination:{total:21,page,totalPages:2},pagination:{total:items.length,page,totalPages:1},meta:{generatedAt:now,start:u.searchParams.get('start'),end:u.searchParams.get('end')},method:'Tempo ativo aproximado. Ausência de medição não comprova ausência de uso.',limitations:'Datas históricas desconhecidas não foram reconstruídas.'}});
}
return send({data:{},items:[],notifications:[],unreadCount:0});});
const page=await c.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5195'+(role==='ADMIN'?'/':'/analytics/participation/monitoring'));
if(role==='COOPERATIVE'){await page.getByLabel('Senha de liberação').fill('local-qa-key');await page.getByRole('button',{name:/Liberar/}).click();}
await page.getByRole('heading',{name:'Uso e adesão',exact:true}).waitFor();await page.getByRole('rowheader',{name:/Cooperativa Alfa/}).waitFor();
if(role==='ADMIN')await page.getByRole('rowheader',{name:/Cooperativa Beta/}).waitFor();else assert.equal(await page.getByText('Cooperativa Beta').count(),0);
await page.getByRole('button',{name:'Ver contas',exact:true}).first().click();await page.getByRole('rowheader',{name:/Conta 1 /}).first().waitFor();await page.getByRole('button',{name:'Próxima',exact:true}).click();await page.getByRole('rowheader',{name:/Conta 21/}).waitFor();assert(await page.getByRole('heading',{name:'Contas vinculadas · Cooperativa Alfa',exact:true}).isVisible());
const xlsx=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar Excel',exact:true}).click();const dl=await xlsx,file=path.join(out,role+'.xlsx');await dl.saveAs(file);
const ExcelJS=require(path.join(root,'../node_modules/exceljs'));const wb=new ExcelJS.Workbook();await wb.xlsx.readFile(file);assert.equal(wb.worksheets[0].rowCount,22);assert(wb.worksheets[0].getRow(22).values.includes('Conta 21'));assert(requests.some(u=>u.pathname.endsWith('/export')&&u.searchParams.get('cooperativeId')==='coop-a'));
const pdfEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Baixar PDF',exact:true}).click();const pdf=await pdfEvent,pdfFile=path.join(out,role+'.pdf');await pdf.saveAs(pdfFile);assert.equal(fs.readFileSync(pdfFile).subarray(0,4).toString(),'%PDF');
failExport=true;await page.getByRole('button',{name:'Exportar Excel',exact:true}).click();await page.getByText('Exportação indisponível',{exact:true}).waitFor();failExport=false;
await page.getByRole('button',{name:'Voltar às cooperativas',exact:true}).click();await page.getByRole('rowheader',{name:/Cooperativa Alfa/}).waitFor();await page.getByLabel('Buscar cooperativa',{exact:true}).fill('Nenhum');await page.getByRole('button',{name:'Aplicar filtros',exact:true}).click();await page.getByText('Nenhum registro encontrado para esta seleção.',{exact:true}).waitFor();assert(await page.getByRole('button',{name:'Exportar Excel',exact:true}).isDisabled());
await page.getByLabel('Buscar cooperativa',{exact:true}).fill('');await page.getByRole('button',{name:'Aplicar filtros',exact:true}).click();await page.getByRole('rowheader',{name:/Cooperativa Alfa/}).waitFor();
fail=true;await page.getByRole('button',{name:'Atualizar',exact:true}).click();await page.getByText('Consulta indisponível',{exact:false}).waitFor();assert.equal(await page.getByRole('rowheader',{name:/Cooperativa Alfa/}).count(),0);fail=false;await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();await page.getByRole('rowheader',{name:/Cooperativa Alfa/}).waitFor();
if(role==='COOPERATIVE'){const region=page.getByRole('region',{name:'Tabela de acompanhamento com rolagem horizontal'});assert(await region.evaluate(e=>e.scrollWidth>e.clientWidth));}
if(role==='ADMIN'){await page.getByRole('button',{name:'Sair da conta',exact:true}).click();await page.waitForURL(/login/);assert.equal(await page.evaluate(()=>localStorage.getItem('auth_token')),null);}
console.log('PASS UI '+role+': acesso, tabela/detalhes, paginação, ausência de sinal, filtros, recuperação de falha e exportação integral Excel/PDF');await c.close();
}assert.deepEqual(errors,[]);console.log('EVIDENCE '+out);}finally{await browser.close();await new Promise(r=>server.close(r));}
