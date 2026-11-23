// Validates the public app web without real API traffic.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(path.resolve(process.env.KATUA_VALIDATION_TOOLS,'package.json'));
const {chromium}=require('playwright'),mod=require('@sparticuz/chromium'),binary=mod.default||mod;
const root=process.env.KATUA_APP_DIST;
const server=http.createServer((req,res)=>{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);return res.end();}if(!fs.existsSync(file)||fs.statSync(file).isDirectory())file=fs.existsSync(file+'.html')?file+'.html':path.join(root,'index.html');res.setHeader('content-type',{'.html':'text/html','.js':'application/javascript','.css':'text/css','.ttf':'font/ttf','.json':'application/json'}[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
await new Promise(r=>server.listen(5196,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:await binary.executablePath(),args:binary.args.filter(a=>a!=='--single-process'),headless:true});
const errors=[],writes=[];
try{for(const width of [390,1280]){
const c=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
await c.route('**/*',async route=>{const r=route.request(),u=new URL(r.url());if(['document','script','stylesheet','font','image'].includes(r.resourceType()))return u.hostname==='127.0.0.1'?route.continue():route.abort();if(r.method()==='POST'&&u.pathname.includes('register/cooperative'))writes.push(u.pathname);return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({items:[],data:{},success:true})});});
const page=await c.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5196/(public)/access-type');await page.getByRole('button',{name:/Cooperativa \/ OSC/}).click();
await page.getByText('O cadastro de cooperativas é realizado exclusivamente pela administração do KATUÁ. Entre com o acesso fornecido pela administração.',{exact:true}).waitFor();
assert.equal(await page.getByText('Criar uma conta',{exact:true}).count(),0);assert(await page.getByText('Esqueceu a senha?',{exact:true}).isVisible());
await page.goto('http://127.0.0.1:5196/(auth)/register?profile=cooperativa');await page.getByText('O cadastro de cooperativas é realizado exclusivamente pela administração do KATUÁ. Solicite seu acesso à administração da plataforma.',{exact:true}).waitFor();assert.equal(await page.getByRole('textbox').count(),0);assert.equal(await page.getByPlaceholder('Digite o nome da cooperativa').count(),0);
await page.goto('http://127.0.0.1:5196/(auth)/login?profile=pf');await page.getByText('Criar uma conta',{exact:true}).waitFor();await page.getByText('Criar uma conta',{exact:true}).click();assert((await page.getByRole('textbox').count())>2);
console.log('PASS app '+width+'px: cooperativa somente login/recuperação, link antigo bloqueado e cadastro residencial preservado');await c.close();
}assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);}finally{await browser.close();await new Promise(r=>server.close(r));}
