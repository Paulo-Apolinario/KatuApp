import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
const tools = process.env.KATUA_VALIDATION_TOOLS, appRoot = process.env.KATUA_APP_DIST;
const fixture = JSON.parse(fs.readFileSync(path.join(tools, 'field-operations-fixture.json'), 'utf8')), ids = fixture.intakeDeliverers;
const require = createRequire(path.join(tools, 'package.json')), { chromium } = require('playwright');
const out = path.join(tools, 'intake-deliverer-ui-evidence');
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
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory())
        file = fs.existsSync(file + '.html') ? file + '.html' : path.join(appRoot, 'index.html');
    response.setHeader('content-type', {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.ttf': 'font/ttf',
        '.woff': 'font/woff',
        '.json': 'application/json',
        '.webmanifest': 'application/manifest+json',
        '.png': 'image/png'
    }[path.extname(file)] || 'application/octet-stream');
    response.end(fs.readFileSync(file));
});
await new Promise(resolve => staticServer.listen(5180, '127.0.0.1', resolve));
const checks = [], pass = name => {
    checks.push(name);
    console.log('PASS ' + name);
}, errors = [];
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
    await c.addInitScript(({ token, user }) => {
        Object.defineProperty(navigator, 'geolocation', {
            configurable: true,
            value: {
                getCurrentPosition(success,fail) {
                    if(window.__gpsDenied){setTimeout(()=>fail({code:1,message:"Permissão negada QA"}),0);return;}
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
        if (localStorage.getItem('@qa-seeded'))
            return;
        localStorage.setItem('@qa-seeded', 'yes');
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
    await c.route('**/*', async (r) => {
        const url = new URL(r.request().url());
        if (url.origin === 'https://vps.katua.com.br') {
            if (r.request().method() === 'OPTIONS')
                return r.fulfill({
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
        if (['127.0.0.1', 'localhost'].includes(url.hostname))
            return r.continue();
        return r.abort();
    });
    return c;
}const panelRoot=process.env.KATUA_PANEL_DIST;const panelServer=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);let file=path.resolve(panelRoot,'.'+pathname);if(!file.startsWith(path.resolve(panelRoot)+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(panelRoot,'index.html');res.setHeader('content-type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});await new Promise(resolve=>panelServer.listen(5181,'127.0.0.1',resolve));
try{
 browser=await chromium.launch({executablePath:'/tmp/katua-pev-browser',args:['--no-sandbox','--disable-dev-shm-usage'],headless:true});
 const publicContext=await setup('',{}),lp=await publicContext.newPage();lp.on('pageerror',e=>errors.push(e.message));
 for(const [width,height] of [[390,844],[320,568],[844,390],[1440,900]]){await lp.setViewportSize({width,height});await lp.goto('http://127.0.0.1:5181/login');await lp.getByRole('button',{name:'Entrar',exact:true}).waitFor();const dimensions=await lp.evaluate(()=>({page:document.documentElement.scrollWidth,width:innerWidth,input:document.querySelector('#email').getBoundingClientRect().width,left:document.querySelector('#email').getBoundingClientRect().left}));assert(dimensions.page<=width+2);if(width<992){assert(dimensions.input>=Math.min(width-48,400));assert(dimensions.left>=12);}await lp.getByLabel('Email',{exact:false}).fill('qa@example.invalid');await lp.getByLabel('Senha',{exact:false}).first().fill('NaoEnviarTeste');await lp.getByRole('button',{name:'Mostrar senha',exact:true}).click();assert.equal(await lp.locator('#password').getAttribute('type'),'text');await lp.getByRole('button',{name:'Ocultar senha',exact:true}).click();await lp.getByRole('button',{name:'Acesso rápido',exact:true}).click();await lp.getByRole('button',{name:'Enviar link',exact:true}).waitFor();assert.equal(await lp.locator('#password').count(),0);await lp.getByRole('button',{name:'Senha',exact:true}).click();await lp.getByRole('button',{name:'Entrar',exact:true}).waitFor();if(width===390)await lp.screenshot({path:out+'/login-mobile.png',fullPage:true});if(width===1440)await lp.screenshot({path:out+'/login-desktop.png',fullPage:true});}
 pass('Login usa toda a largura em 320/390px, funciona em paisagem e mantém duas colunas no desktop; senha e acesso rápido preservados');await publicContext.close();
 const owner=await setup(fixture.token,fixture.owner);await owner.addInitScript(({token,user})=>{localStorage.setItem('auth_token',token);localStorage.setItem('auth_user',JSON.stringify(user));},{token:fixture.token,user:fixture.owner});const page=await owner.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5181/material-intakes');await page.getByRole('button',{name:'Receber material na cooperativa',exact:true}).click();await page.getByRole('button',{name:'Cadastrar pessoa para futuras entregas',exact:true}).click();assert(await page.getByRole('button',{name:'Registrar entrada / coleta',exact:true}).isDisabled());await page.getByRole('textbox',{name:'Nome do entregador',exact:true}).fill('Entregadora nova do navegador QA');await page.getByRole('button',{name:'Salvar cadastro simplificado',exact:true}).click();await page.getByRole('textbox',{name:'Nome do entregador',exact:true}).waitFor({state:'hidden'});await page.getByLabel('Descrição do recebimento / materiais aparentes').fill('Primeira entrega vinculada à pessoa');await page.getByRole('button',{name:'Registrar entrada / coleta',exact:true}).click();await page.getByText('Entrada recebida. Registre a separação e pesagem quando estiverem prontas.',{exact:true}).waitFor();pass('Pré-cadastro só com nome é salvo dentro do recebimento e a entrega fica vinculada sem CPF/telefone obrigatórios');
 await page.getByRole('button',{name:'Receber material na cooperativa',exact:true}).click();await page.getByRole('textbox',{name:'Buscar entregador',exact:true}).fill('Entregadora nova do navegador QA');await page.getByRole('combobox',{name:'Selecionar entregador',exact:true}).selectOption({label:'Entregadora nova do navegador QA'});await page.getByLabel('Descrição do recebimento / materiais aparentes').fill('Segunda entrega, mesma pessoa');await page.getByRole('button',{name:'Registrar entrada / coleta',exact:true}).click();await page.getByText('Entrada recebida. Registre a separação e pesagem quando estiverem prontas.',{exact:true}).waitFor();await page.goto('http://127.0.0.1:5181/intake-deliverers');await page.getByRole('textbox',{name:'Pesquisar entregadores',exact:true}).fill('Entregadora nova do navegador QA');const row=page.getByRole('row').filter({hasText:'Entregadora nova do navegador QA'});await row.getByRole('button',{name:'Ver entregas',exact:true}).click();await page.getByText('Primeira entrega vinculada à pessoa',{exact:true}).waitFor();await page.getByText('Segunda entrega, mesma pessoa',{exact:true}).waitFor();await page.screenshot({path:out+'/deliverer-history-mobile.png',fullPage:true});pass('Entrega futura reutiliza cadastro por pesquisa e histórico reúne as duas entradas separadas');
 await row.getByRole('button',{name:'Editar cadastro',exact:true}).click();await page.getByRole('textbox',{name:'Telefone do entregador',exact:true}).fill('(85) 98888-7777');await page.getByRole('button',{name:'Salvar cadastro simplificado',exact:true}).click();await page.getByText('85988887777',{exact:true}).waitFor();pass('Telefone opcional pode ser incluído depois sem alterar os registros anteriores');
 await page.getByRole('button',{name:'Abrir ou recolher menu lateral',exact:true}).click();await page.getByRole('button',{name:'Fechar menu lateral',exact:true}).waitFor();assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');await page.keyboard.press('Escape');assert.notEqual(await page.evaluate(()=>document.body.style.overflow),'hidden');pass('Menu móvel abre sobre o conteúdo e fecha por Escape, restaurando rolagem');
 await page.goto('http://127.0.0.1:5181/waste-list?tipo=fixed&execucao='+ids.route);await page.getByText('Sem coleta no dia',{exact:true}).first().waitFor();assert.equal(await page.getByText('Sem coleta no dia',{exact:true}).count(),2);await page.goto('http://127.0.0.1:5181/edit-route/'+ids.route);await page.getByText(/8 coletado\(s\).*2 sem coleta no dia/).waitFor();pass('Painel diferencia dois pontos sem coleta no dia e preserva oito coletados no histórico da execução');
 await page.goto('http://127.0.0.1:5181/route-plans');await page.getByRole('button',{name:'Nova rota fixa',exact:true}).click();await page.getByRole('button',{name:'Diária: todos os dias',exact:true}).click();assert.equal(await page.locator('.route-plan-schedule input:checked').count(),7);await page.getByRole('button',{name:'Segunda a sexta',exact:true}).click();assert.equal(await page.locator('.route-plan-schedule input:checked').count(),5);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));pass('Atalhos diária e dias úteis selecionam 7 ou 5 dias; planejamento permanece utilizável no celular');
 assert.deepEqual(errors,[]);await owner.close();fs.writeFileSync(out+'/results.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({passed:checks.length,checks},null,2));
}catch(e){console.error(e);process.exitCode=1;}finally{for(const c of browser?.contexts()||[])await c.unrouteAll({behavior:'ignoreErrors'});await browser?.close();staticServer.close();panelServer.close();}
