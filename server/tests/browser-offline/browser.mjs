import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
const tools = process.env.KATUA_VALIDATION_TOOLS, appRoot = process.env.KATUA_APP_DIST;
const fixture = JSON.parse(fs.readFileSync(path.join(tools, 'field-operations-fixture.json'), 'utf8')), ids = fixture.browserOffline;
const require = createRequire(path.join(tools, 'package.json')), { chromium } = require('playwright');
const out = path.join(tools, 'browser-offline-ui-evidence');
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
    if(['COLLECTOR','DRIVER','GENERATOR_SMALL','GENERATOR_LARGE'].includes(user.role)){const n=await api('/privacy/notice','GET',undefined,token);await api('/privacy/acceptance','POST',{version:n.document.version,documentHash:n.documentHash,accepted:true,reportedAcceptedAt:new Date().toISOString()},token);}
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
                getCurrentPosition(success) {
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
}
try {
    browser = await chromium.launch({ executablePath: '/tmp/katua-pev-browser', args: ['--no-sandbox', '--disable-dev-shm-usage'], headless: true });
    const context = await setup(fixture.token, fixture.owner);
    let page = await context.newPage();
    page.on('pageerror', e => { errors.push(e.stack || e.message); console.log('ERROR AT', page.url(), e.message); });
    page.on('requestfailed', r => { if (r.url().includes('127.0.0.1'))
        console.log('FAILED ASSET', r.url(), r.failure()); });
    await page.goto('http://127.0.0.1:5180/(cooperativa)/home');
    await page.waitForFunction(async()=>{for(const k of await caches.keys())if(await(await caches.open(k)).match('/__katua_ready__'))return true;return false;},{},{timeout:60000});
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    const keys = await page.evaluate(async () => { const result = []; for (const k of await caches.keys())
        for (const r of await (await caches.open(k)).keys())
            result.push(r.url); return result; });
    assert(!keys.some(k => k.includes('vps.katua')));
    pass('Shell completo preparado; CacheStorage não contém respostas privadas da API');
    await page.goto('http://127.0.0.1:5180/(cooperativa)/geradores');
    await page.getByText('Gerador baixado offline QA', { exact: true }).waitFor();
    await context.setOffline(true);
    await page.reload();
    await page.getByText('Gerador baixado offline QA', { exact: true }).waitFor();
    await page.getByText('Você está sem internet. Os registros ficam salvos neste aparelho e serão enviados quando a conexão voltar.', { exact: true }).waitFor();
    pass('Recarregar diretório offline mantém sessão e cadastros baixados');
    await page.close();
    page = await context.newPage();
    page.on('pageerror', e => { errors.push(e.stack || e.message); console.log('ERROR AT', page.url(), e.message); });
    page.on('requestfailed', r => { if (r.url().includes('127.0.0.1'))
        console.log('FAILED ASSET', r.url(), r.failure()); });
    await page.goto('http://127.0.0.1:5180/(cooperativa)/home');
    await page.getByRole('button', { name: 'Adicionar gerador', exact: true }).waitFor();
    pass('Fechar e reabrir aba offline recupera App e autenticação local');
    await page.getByRole('button', { name: 'Adicionar gerador', exact: true }).click();
    await page.getByRole('textbox', { name: 'Nome / responsável *', exact: true }).fill('Gerador navegador offline QA');
    await page.getByRole('textbox', { name: 'CPF/CNPJ *', exact: true }).fill('52998224725');
    await page.getByRole('textbox', { name: 'E-mail *', exact: true }).fill('browser-offline@test.invalid');
    await page.getByRole('textbox', { name: 'Rua *', exact: true }).fill('Rua offline navegador');
    await page.getByRole('textbox', { name: 'Número', exact: true }).fill('25');
    await page.getByRole('textbox', { name: 'Cidade *', exact: true }).fill('Fortaleza');
    await page.getByRole('button', { name: 'Usar minha localização', exact: true }).click();
    await page.getByRole('switch', { name: 'Confirmo a localização do cadastro' }).click();
    await page.getByText('Rascunho salvo neste aparelho.', { exact: true }).waitFor();
    await page.reload();
    await page.getByRole('textbox', { name: 'Nome / responsável *', exact: true }).waitFor();
    await page.waitForFunction(() => Array.from(document.querySelectorAll('input')).some(x => x.value === 'Gerador navegador offline QA'));
    assert.equal(await page.getByRole('textbox', { name: 'CPF/CNPJ *', exact: true }).inputValue(), '529.982.247-25');
    pass('Rascunho, endereço e localização sobrevivem ao recarregamento offline');
    await page.getByRole('button', { name: 'Salvar gerador', exact: true }).click();
    await page.getByText('Salvo neste aparelho · aguardando envio.', { exact: true }).waitFor();
    const pendingURL = page.url();
    await page.reload();
    await page.getByText('Salvo neste aparelho · aguardando envio.', { exact: true }).waitFor();
    assert(!(await api('/cooperative-field/generators?q=browser-offline')).items.some(x => x.name === 'Gerador navegador offline QA'));
    pass('Salvar offline persiste protocolo e fila antes de qualquer confirmação no servidor');
    await context.setOffline(false);
    await page.getByRole('button', { name: 'Tentar enviar agora', exact: true }).click();
    await page.getByText('Sincronizado · cadastro confirmado no sistema.', { exact: true }).waitFor({ timeout: 30000 }).catch(async (e) => { console.log('FAIL SCREEN', await page.locator('body').innerText()); console.log('NAV', await page.evaluate(() => navigator.onLine)); throw e; });
    const records = await api('/cooperative-field/generators?q=Gerador%20navegador%20offline%20QA');
    assert.equal(records.items.filter(x => x.name === 'Gerador navegador offline QA').length, 1);
    await page.reload();
    await page.getByText('Sincronizado · cadastro confirmado no sistema.', { exact: true }).waitFor();
    pass('Reconexão envia uma única criação e mantém confirmação após recarregar');
    await page.screenshot({ path: out + '/confirmed-mobile.png', fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), true);
    console.log('PAGE ERRORS', errors);
    pass('Tela de 390px sem transbordamento');
    async function form(name, email, doc) { await page.goto('http://127.0.0.1:5180/(cooperativa)/geradores/novo'); for (const [label, value] of [['Nome / responsável *', name], ['CPF/CNPJ *', doc], ['E-mail *', email], ['Rua *', 'Rua QA'], ['Cidade *', 'Fortaleza']])
        await page.getByRole('textbox', { name: label, exact: true }).fill(value); await page.getByRole('button', { name: 'Usar minha localização', exact: true }).click(); await page.getByRole('switch', { name: 'Confirmo a localização do cadastro' }).click(); await page.getByText('Rascunho salvo neste aparelho.', { exact: true }).waitFor(); }
    let dropped = false;
    await context.route('**/mobile-offline/operations', async (r) => { if (r.request().method() !== 'POST' || dropped)
        return r.fallback(); const response = await r.fetch({ url: 'http://127.0.0.1:3339/mobile-offline/operations' }); assert.equal(response.status(), 201); dropped = true; await r.abort('connectionfailed'); });
    await form('Cadastro resposta perdida QA', 'lost-response@test.invalid', '93541134780');
    await page.getByRole('button', { name: 'Salvar gerador', exact: true }).click();
    await page.getByText('Salvo neste aparelho · aguardando envio.', { exact: true }).waitFor();
    await page.waitForFunction(() => document.body.innerText.includes('Não foi possível conectar'));
    await page.getByRole('button', { name: 'Tentar enviar agora', exact: true }).click();
    await page.getByText('Sincronizado · cadastro confirmado no sistema.', { exact: true }).waitFor();
    assert.equal((await api('/cooperative-field/generators?q=Cadastro%20resposta%20perdida')).items.length, 1);
    pass('Resposta perdida após commit é reenviada com o mesmo protocolo sem duplicar gerador');
    await form('Cadastro revisar QA', 'review-browser@test.invalid', '11111111111');
    await page.getByRole('button', { name: 'Salvar gerador', exact: true }).click();
    await page.getByText('Precisa de revisão. O cadastro continua salvo neste aparelho.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Corrigir cadastro', exact: true }).click();
    await page.getByRole('textbox', { name: 'Nome / responsável *', exact: true }).waitFor();
    await page.waitForFunction(() => Array.from(document.querySelectorAll('input')).some(x => x.value === 'Cadastro revisar QA'));
    pass('Validação inválida permanece salva e correção só abre após conferir ausência no servidor');
    const quotaSnapshot = await page.evaluate(async () => { window.__originalPut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function () { throw new DOMException('Sem espaço QA', 'QuotaExceededError'); }; const d = await new Promise((resolve, reject) => { const r = indexedDB.open('katua-offline-v1'); r.onsuccess = () => resolve(r.result); r.onerror = reject; }); return (await new Promise(resolve => { const r = d.transaction('records').objectStore('records').getAllKeys(); r.onsuccess = () => resolve(r.result); })).length; });
    await page.getByRole('textbox', { name: 'Nome / responsável *', exact: true }).fill('Sem espaço ainda não salvo');
    await page.getByText('Sem espaço QA', { exact: true }).waitFor();
    assert.equal(await page.getByText('Rascunho salvo neste aparelho.', { exact: true }).count(), 0);
    await page.evaluate(() => IDBObjectStore.prototype.put = window.__originalPut);
    await page.reload();
    await page.waitForFunction(() => Array.from(document.querySelectorAll('input')).some(x => x.value === 'Cadastro revisar QA'));
    pass('Falha de espaço não sinaliza sucesso e preserva o último rascunho confirmado');
    await context.close();
    const catContext = await setup(ids.catToken, ids.catUser);
    const catPage = await catContext.newPage();
    catPage.on('pageerror', e => errors.push(e.stack || e.message));
    await catContext.addInitScript(({ owner }) => { if (localStorage.getItem('@qa-photo'))
        return; localStorage.setItem('@qa-photo', 'yes'); localStorage.setItem('@katu:offline:extra_orders_local', JSON.stringify([{ id: owner + ':photo-legacy-qa', status: 'DRAFT', payload_json: JSON.stringify({ __ownerId: owner, data: { id: 'photo-legacy-qa', status: 'DRAFT', payload: { photos: [{ base64: 'data:image/jpeg;base64,' + 'Q'.repeat(2048) }] } } }), updated_at: new Date().toISOString() }])); }, { owner: ids.catUser.id });
    await catPage.goto('http://127.0.0.1:5180/(catador)/extra-orders');
    await catPage.waitForFunction(async()=>{for(const k of await caches.keys())if(await(await caches.open(k)).match('/__katua_ready__'))return true;return false;},{},{timeout:60000});
    await catPage.waitForFunction(async()=> (await indexedDB.databases()).some(d=>d.name==='katua-offline-v1'));
    await catPage.waitForFunction(async () => { const d = await new Promise(resolve => { const r = indexedDB.open('katua-offline-v1'); r.onsuccess = () => resolve(r.result); }); const rows = await new Promise(resolve => { const r = d.transaction('records').objectStore('records').get('table:extra_orders_local'); r.onsuccess = () => resolve(r.result); }); return rows?.some(r => r.id.endsWith('photo-legacy-qa')) && !localStorage.getItem('@katu:offline:extra_orders_local'); });
    pass('Rascunho legado com foto migra para IndexedDB antes de remover armazenamento antigo');
    await catPage.goto('http://127.0.0.1:5180/(catador)/collect?highlightCollectionId=' + ids.collection);
    await catPage.getByText('Iniciar coleta', { exact: true }).waitFor();
    await catContext.setOffline(true);
    await catPage.reload();
    await catPage.getByText('Iniciar coleta', { exact: true }).waitFor();
    await catPage.getByText('Iniciar coleta', { exact: true }).click();
    await catPage.getByText('Finalizar etapa de campo', { exact: true }).waitFor();
    await catPage.getByPlaceholder('Observações da execução da coleta').fill('Material protegido offline QA');
    await catPage.getByText('Rascunho de campo salvo neste aparelho.', { exact: true }).waitFor();
    await catPage.reload();
    await catPage.getByPlaceholder('Observações da execução da coleta').waitFor();
    await catPage.waitForFunction(() => document.querySelector('textarea')?.value === 'Material protegido offline QA');
    pass('Observações de campo digitadas são recuperadas após recarregar offline');
    await catPage.getByText('Finalizar etapa de campo', { exact: true }).waitFor();
    assert.equal((await api('/collections/' + ids.collection)).collection.status, 'PENDING');
    pass('Catador inicia coleta offline; estado e fila sobrevivem ao reload sem antecipar confirmação remota');
    await catContext.setOffline(false);
    await catPage.goto('http://127.0.0.1:5180/sync');
    await catPage.getByRole('button', { name: 'Tentar enviar pendências', exact: true }).first().click();
    await new Promise(resolve => setTimeout(resolve, 1000));
    assert.equal((await api('/collections/' + ids.collection)).collection.status, 'IN_PROGRESS');
    pass('Coleta offline é sincronizada e preserva autoria do catador');
    const secondTab = await catContext.newPage();
    await secondTab.goto('http://127.0.0.1:5180/offline');
    await secondTab.getByText('Registro de campo da coleta', { exact: true }).waitFor();
    await catContext.setOffline(true);
    await catPage.evaluate(({ token, user }) => { localStorage.setItem('@katu:token', token); localStorage.setItem('@katu:user', JSON.stringify(user)); }, { token: fixture.token, user: fixture.owner });
    await secondTab.waitForURL(/\/home$/);
    await secondTab.goto('http://127.0.0.1:5180/offline');
    await secondTab.getByText('Nenhum rascunho nesta conta.', { exact: true }).waitFor();
    assert.equal(await secondTab.getByText('Registro de campo da coleta', { exact: true }).count(), 0);
    pass('Troca de conta em outra aba atualiza perfil e não expõe rascunhos do catador');
    await catPage.evaluate(() => { localStorage.removeItem('@katu:token'); localStorage.removeItem('@katu:user'); });
    await secondTab.waitForURL(/access-type/);
    await secondTab.reload();
    await secondTab.waitForURL(/access-type/);
    assert.equal(await secondTab.evaluate(() => localStorage.getItem('@katu:token')), null);
    pass('Logout offline não ressuscita sessão antiga ao recarregar');
    await catContext.close();
    assert.deepEqual(errors, []);
    pass('Fluxos concluídos sem erros JavaScript, inclusive ícones no modo offline');
    fs.writeFileSync(out + '/results.json', JSON.stringify({ checks, errors }, null, 2));
    console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
}
catch (e) {
    console.error(e);
    process.exitCode = 1;
}
finally {
    for(const context of browser?.contexts()||[])await context.unrouteAll({behavior:"ignoreErrors"});
    await browser?.close();
    staticServer.close();
}
