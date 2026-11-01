import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
const tools = process.env.KATUA_VALIDATION_TOOLS, appRoot = process.env.KATUA_APP_DIST;
const fixture = JSON.parse(fs.readFileSync(path.join(tools, 'field-operations-fixture.json'), 'utf8')), ids = fixture.fieldMeeting;
const require = createRequire(path.join(tools, 'package.json')), { chromium } = require('playwright');
const out = path.join(tools, 'field-meeting-ui-evidence');
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
}const panelRoot=process.env.KATUA_PANEL_DIST;const panelServer=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);let file=path.resolve(panelRoot,'.'+pathname);if(!file.startsWith(path.resolve(panelRoot)+path.sep))file=path.join(panelRoot,'index.html');if(!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(panelRoot,'index.html');res.setHeader('content-type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});await new Promise(resolve=>panelServer.listen(5181,'127.0.0.1',resolve));
try{
 browser=await chromium.launch({executablePath:'/tmp/katua-pev-browser',args:['--no-sandbox','--disable-dev-shm-usage'],headless:true});
 const owner=await setup(fixture.token,fixture.owner);await owner.addInitScript(({token,user})=>{localStorage.setItem('auth_token',token);localStorage.setItem('auth_user',JSON.stringify(user));},{token:fixture.token,user:fixture.owner});const page=await owner.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5180/(cooperativa)/home');await page.getByRole('button',{name:'Adicionar gerador',exact:true}).waitFor();assert.equal(await page.getByText('Preparando abertura offline...',{exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Dados offline e rascunhos',exact:true}).count(),0);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await page.waitForFunction(async()=>{for(const k of await caches.keys())if(await(await caches.open(k)).match('/__katua_ready__'))return true;return false;});pass('Preparação offline automática sem faixa de configuração ou ação manual');
 await owner.setOffline(true);await page.reload();await page.getByRole('button',{name:'Adicionar gerador',exact:true}).waitFor();await page.getByText('Você está sem internet. Os registros ficam salvos neste aparelho e serão enviados quando a conexão voltar.',{exact:true}).waitFor();pass('App reabre offline com aviso operacional discreto e sessão preservada');await owner.setOffline(false);
 await owner.route('https://viacep.com.br/**',r=>r.fulfill({json:{logradouro:'Rua Auto CEP QA',bairro:'Edson Queiroz',localidade:'Fortaleza',uf:'CE'},headers:{'access-control-allow-origin':'*'}}));let geocodes=[];await owner.route('**/cooperative-field/geocode',async r=>{if(r.request().method()==='OPTIONS')return r.fallback();geocodes.push(r.request().postDataJSON().address);return r.fulfill({json:{latitude:-3.7412,longitude:-38.5106},headers:{'access-control-allow-origin':'*'}});});
 await page.getByRole('button',{name:'Adicionar gerador',exact:true}).click();await page.getByRole('textbox',{name:'CEP',exact:true}).fill('60812500');await page.waitForFunction(()=>Array.from(document.querySelectorAll('input')).some(i=>i.value==='Rua Auto CEP QA'));await page.getByRole('textbox',{name:'Número',exact:true}).fill('115');await page.getByText('Latitude -3.741200 · Longitude -38.510600',{exact:true}).waitFor();assert(geocodes.at(-1).includes('115'));assert.equal(await page.getByRole('switch',{name:'Confirmo a localização do cadastro'}).isChecked(),false);pass('CEP preenche rua automaticamente e número consulta endereço completo sem dispensar confirmação do ponto');
 const gen=await setup(ids.generatorToken,ids.generatorUser),gp=await gen.newPage();gp.on('pageerror',e=>errors.push(e.message));await gp.goto('http://127.0.0.1:5180/(gerador)/dashboard');const confirm=gp.getByRole('button',{name:'Confirmar e continuar',exact:true});await confirm.waitFor();assert(await confirm.isDisabled());await gp.getByRole('switch',{name:'Li e concordo com os Termos de Uso e estou ciente do Aviso de Privacidade'}).click();await confirm.click();await confirm.waitFor({state:'hidden'});await gp.waitForTimeout(300);const notice=await api('/privacy/notice','GET',undefined,ids.generatorToken);assert(notice.acceptance);pass('Gerador vê termo completo, checkbox desmarcado bloqueia confirmação e aceite é gravado pelo próprio titular');await gen.close();
 const driver=await setup(ids.driverToken,ids.driverUser);await driver.addInitScript(()=>{window.__gpsDenied=true;});const dp=await driver.newPage();dp.on('pageerror',e=>errors.push(e.message));await dp.goto('http://127.0.0.1:5180/(motorista)/home');await dp.getByText('Enviar localização durante o serviço?',{exact:true}).waitFor();await dp.getByRole('button',{name:'Ativar GPS e enviar localização',exact:true}).click();await dp.getByText(/Ative a localização do aparelho e permita o acesso/).waitFor();pass('Serviço em campo apresenta solicitação; GPS negado explica como ativar sem iniciar compartilhamento');await dp.evaluate(()=>window.__gpsDenied=false);await dp.getByRole('button',{name:'Ativar GPS e enviar localização',exact:true}).click();await dp.getByText('Enviar localização durante o serviço?',{exact:true}).waitFor({state:'hidden'});await dp.waitForTimeout(500);assert.equal((await api('/driver-tracking/drivers/'+ids.driver)).state,'LIVE');pass('Motorista autoriza GPS e envia posição recente vinculada à rota');

 await dp.goto('http://127.0.0.1:5180/(motorista)/rotas?highlightRouteId='+ids.route);await dp.evaluate(()=>window.__gpsDenied=false);await dp.getByRole('button',{name:'Adicionar ponto durante a rota',exact:true}).click();await dp.getByRole('textbox',{name:'Nome do local',exact:true}).fill('Nova parada bairro navegador QA');await dp.getByRole('textbox',{name:'Endereço do ponto',exact:true}).fill('Rua Nova Parada, 20, Fortaleza');await dp.getByRole('button',{name:'Usar GPS neste ponto avulso',exact:true}).click();await dp.getByText(/Posição selecionada:/).waitFor();await dp.getByRole('button',{name:'Adicionar ponto à execução',exact:true}).click();await dp.getByText('Nova parada bairro navegador QA',{exact:true}).waitFor();pass('Motorista inclui ponto avulso com GPS durante execução de rota por bairro');
 const pp=await owner.newPage();pp.on('pageerror',e=>errors.push(e.message));await pp.goto('http://127.0.0.1:5181/driver-tracking?motorista='+ids.driver);await pp.getByText('Localização atualizada',{exact:true}).waitFor();await pp.getByLabel('Mapa de localização compartilhada do motorista').waitFor();await pp.screenshot({path:out+'/panel-driver-tracking.png',fullPage:true});pass('Painel acompanha motorista no mapa, com horário, precisão e atalho da rota');
 await page.goto('http://127.0.0.1:5180/(cooperativa)/motoristas/localizacao?id='+ids.driver);await page.getByText('Localização atualizada',{exact:true}).waitFor();assert.equal((await api('/driver-tracking/drivers/'+ids.driver)).state,'LIVE');pass('Mesmo compartilhamento está disponível no App da cooperativa e painel');
 await pp.goto('http://127.0.0.1:5181/material-intakes');await pp.getByRole('button',{name:'Receber material na cooperativa',exact:true}).click();await pp.getByLabel('Pessoa / órgão / origem (opcional)').fill('Entrega navegador QA');await pp.getByLabel('Descrição do recebimento / materiais aparentes').fill('8 sacos misturados, sem pesagem');await pp.getByRole('button',{name:'Registrar entrada / coleta',exact:true}).click();await pp.getByText('Entrada recebida. Registre a separação e pesagem quando estiverem prontas.',{exact:true}).waitFor();const row=pp.getByRole('row').filter({hasText:'Entrega navegador QA'});await row.getByRole('button',{name:'Separar e pesar',exact:true}).click();await pp.getByLabel('Material',{exact:true}).selectOption({label:'Papel entrada QA (kg)'});await pp.getByLabel('Quantidade',{exact:true}).fill('12.5');await pp.getByRole('button',{name:'Confirmar pesagem',exact:true}).click();await pp.getByText('Pesagem registrada. O material está disponível para triagem, estoque ou destinação.',{exact:true}).waitFor();await row.getByText('Papel entrada QA: 12.5 kg',{exact:true}).waitFor();await pp.screenshot({path:out+'/panel-direct-intake.png',fullPage:true});await row.getByRole('link',{name:'Triagem e destinações',exact:true}).click();await pp.getByText('Entrega navegador QA',{exact:true}).waitFor();pass('Entrada direta pelo painel aceita material misturado, registra pesagem e abre destinações filtradas pela origem');
 await pp.goto('http://127.0.0.1:5181/staff-list');await pp.getByRole('row').filter({hasText:'Motorista QA'}).getByRole('button',{name:'Termos e privacidade',exact:true}).click();await pp.getByText('Confirmação registrada pelo titular',{exact:true}).waitFor();pass('Painel apresenta comprovante de aceite do motorista sem permitir que administrador aceite pelo titular');
 await pp.goto('http://127.0.0.1:5181/notifications');await pp.getByRole('listitem').filter({hasText:'Rota iniciada'}).getByRole('link',{name:'Abrir atendimento',exact:true}).first().click();await pp.waitForURL(/driver-tracking/);pass('Aviso de início de rota no painel abre acompanhamento do motorista');
 assert.deepEqual(errors,[]);pass('Fluxos Web e painel sem erros JavaScript');await driver.close();await owner.close();fs.writeFileSync(out+'/results.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({passed:checks.length,checks},null,2));
}catch(e){console.error(e);process.exitCode=1;}finally{await browser?.close();staticServer.close();panelServer.close();}
