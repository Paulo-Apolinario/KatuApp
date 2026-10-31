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
const out = path.join(tools, 'cooperative-field-ui-evidence');
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
    '.json': 'application/json'
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
}
try {
  browser = await chromium.launch({
    executablePath: '/tmp/katua-pev-browser',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    headless: true
  });
  const owner = await setup(fixture.token, fixture.owner),
    page = await owner.newPage();
  page.on('pageerror', e => errors.push(e.message));
  const operationalRequests = [];
  page.on('request', r => {
    if (r.url().includes('/cooperative-field/')) operationalRequests.push(r.url());
  });
  await page.goto('http://127.0.0.1:5180/(cooperativa)/home');
  await page.getByRole('button', {
    name: 'Catadores',
    exact: true
  }).waitFor();
  for (const label of ['Catadores', 'Motoristas', 'Geradores', 'Adicionar gerador', 'PEVs', 'Relatórios e análises']) assert(await page.getByRole('button', {
    name: label,
    exact: true
  }).isVisible());
  assert.equal(operationalRequests.length, 0);
  await page.screenshot({
    path: out + '/home-mobile.png',
    fullPage: true
  });
  pass('Início tem os seis atalhos solicitados e não consulta indicadores operacionais');
  await page.getByRole('button', {
    name: 'Catadores',
    exact: true
  }).click();
  await page.getByRole('button', {
    name: 'Ver trabalhos',
    exact: true
  }).first().click();
  await page.getByText('Trabalhos', {
    exact: true
  }).waitFor();
  await page.getByText('Óleo campo QA: 50 L', {
    exact: true
  }).waitFor();
  await page.screenshot({
    path: out + '/collector-work.png',
    fullPage: true
  });
  pass('Catador abre seus trabalhos com equipe, ocorrências e óleo em litros');
  await api('/driver-tracking/position', 'PUT', {
    sessionId: ids.sessionId,
    latitude: -3.7301,
    longitude: -38.5201,
    accuracy: 12,
    capturedAt: new Date().toISOString()
  }, ids.driverToken);
  await page.goto('http://127.0.0.1:5180/(cooperativa)/motoristas');
  await page.getByRole('button', {
    name: 'Localização do motorista',
    exact: true
  }).first().click();
  await page.getByText('Localização atualizada', {
    exact: true
  }).waitFor();
  await page.getByText('Precisão aproximada: 12 m', {
    exact: true
  }).waitFor();
  const moved = page.waitForResponse(r => r.url().includes('/driver-tracking/drivers/') && r.request().method() === 'GET');
  await api('/driver-tracking/position', 'PUT', {
    sessionId: ids.sessionId,
    latitude: -3.731,
    longitude: -38.522,
    accuracy: 8,
    capturedAt: new Date().toISOString()
  }, ids.driverToken);
  assert.equal((await (await moved).json()).position.latitude, -3.731);
  await page.screenshot({
    path: out + '/live-driver.png',
    fullPage: true
  });
  await api('/driver-tracking/stop', 'POST', {
    sessionId: ids.sessionId
  }, ids.driverToken);
  await page.getByText('Compartilhamento encerrado ou não iniciado', {
    exact: true
  }).waitFor();
  pass('Localização muda por atualização real da API, mostra precisão e desaparece ao encerrar');
  await page.goto('http://127.0.0.1:5180/(cooperativa)/geradores');
  await page.getByRole('textbox', {
    name: 'Buscar por nome ou local',
    exact: true
  }).fill('Gerador campo QA');
  await page.getByRole('button', {
    name: 'Buscar',
    exact: true
  }).click();
  await page.waitForFunction(() => document.querySelectorAll('button[aria-label="Ver informações"]').length === 1);
  await page.getByRole('button', {
    name: 'Ver informações',
    exact: true
  }).click();
  await page.getByText('Solicitações recentes', {
    exact: true
  }).waitFor();
  await page.getByText('CPF/CNPJ: 529.982.247-25', {
    exact: true
  }).waitFor();
  await page.getByRole('button', {
    name: 'Localizar no mapa',
    exact: true
  }).click();
  await page.getByText('Mapa dos geradores', {
    exact: true
  }).waitFor();
  await page.getByText('Gerador campo QA', {
    exact: true
  }).filter({
    visible: true
  }).first().waitFor();
  pass('Gerador apresenta solicitações, coletas, CPF formatado e mapa do cadastro');
  await page.goto('http://127.0.0.1:5180/(cooperativa)/geradores/novo');
  await page.getByRole('textbox', {
    name: 'Nome / responsável *',
    exact: true
  }).fill('Gerador residencial navegador QA');
  await page.getByRole('textbox', {
    name: 'CPF/CNPJ *',
    exact: true
  }).fill('11144477735');
  await page.getByRole('textbox', {
    name: 'E-mail *',
    exact: true
  }).fill('field-browser-generator@test.invalid');
  await page.getByRole('textbox', {
    name: 'Rua *',
    exact: true
  }).fill('Rua cadastro QA');
  await page.getByRole('textbox', {
    name: 'Número',
    exact: true
  }).fill('123');
  await page.getByRole('textbox', {
    name: 'Cidade *',
    exact: true
  }).fill('Fortaleza');
  await page.getByRole('button', {
    name: 'Salvar gerador',
    exact: true
  }).click();
  await page.getByText('Preencha o endereço e confirme a localização no mapa.', {
    exact: true
  }).waitFor();
  await page.getByRole('button', {
    name: 'Usar minha localização',
    exact: true
  }).click();
  const confirmation = page.getByRole('switch', {
    name: 'Confirmo a localização do cadastro',
    exact: true
  });
  await confirmation.check();
  await page.getByRole('textbox', {
    name: 'Número',
    exact: true
  }).fill('124');
  assert.equal(await confirmation.isChecked(), false);
  await confirmation.check();
  await page.getByRole('button', {
    name: 'Salvar gerador',
    exact: true
  }).click();
  await page.getByText('Gerador residencial cadastrado', {
    exact: true
  }).filter({
    visible: true
  }).waitFor();
  const gen = (await api('/cooperative-field/generators?q=Gerador%20residencial%20navegador%20QA')).items[0];
  assert.equal(gen.documentNumber, '11144477735');
  assert.equal(gen.number, '124');
  assert.equal(gen.type, 'SMALL');
  assert.equal(gen.latitude, -3.7302);
  pass('Cadastro pelo App exige confirmação, invalida coordenadas após mudar endereço e classifica CPF como residencial cadastrado');
  await page.goto('http://127.0.0.1:5180/(cooperativa)/pevs/novo');
  await page.getByRole('textbox', {
    name: 'Nome do PEV *',
    exact: true
  }).fill('PEV navegador campo QA');
  await page.getByRole('textbox', {
    name: 'Rua *',
    exact: true
  }).fill('Rua PEV navegador');
  await page.getByRole('textbox', {
    name: 'Número',
    exact: true
  }).fill('40');
  await page.getByRole('textbox', {
    name: 'Cidade *',
    exact: true
  }).fill('Fortaleza');
  await page.getByRole('textbox', {
    name: 'Materiais aceitos (separados por vírgula)',
    exact: true
  }).fill('Papel, Óleo');
  await page.getByRole('button', {
    name: 'Usar minha localização',
    exact: true
  }).click();
  await page.getByRole('switch', {
    name: 'Confirmo a localização do cadastro',
    exact: true
  }).check();
  await page.getByRole('button', {
    name: 'Salvar PEV',
    exact: true
  }).click();
  await page.getByText('PEV navegador campo QA', {
    exact: true
  }).waitFor();
  const pev = (await api('/cooperative-field/pevs?q=PEV%20navegador%20campo%20QA')).items[0];
  assert.match(pev.binId, /^PEV-/);
  assert.equal(pev.latitude, -3.7302);
  await page.getByRole('button', {
    name: 'Localizar no mapa',
    exact: true
  }).click();
  await page.getByText('Mapa de PEVs', {
    exact: true
  }).waitFor();
  pass('PEV é cadastrado com código próprio, coordenadas confirmadas, materiais e acesso ao mapa');
  await page.goto('http://127.0.0.1:5180/(cooperativa)/relatorios');
  await page.getByRole('textbox', {
    name: 'Data inicial (dd/mm/aaaa)',
    exact: true
  }).fill('01102026');
  await page.getByRole('textbox', {
    name: 'Data final (dd/mm/aaaa)',
    exact: true
  }).fill('31102026');
  assert.equal(await page.getByRole('textbox', {
    name: 'Data inicial (dd/mm/aaaa)',
    exact: true
  }).inputValue(), '01/10/2026');
  await page.getByRole('button', {
    name: 'Aplicar período',
    exact: true
  }).click();
  await page.getByRole('button', {
    name: 'Visão geral',
    exact: true
  }).click();
  await page.getByText('Situação das coletas', {
    exact: true
  }).waitFor();
  await page.getByText('Materiais no período', {
    exact: true
  }).waitFor();
  await page.getByRole('button', {
    name: 'Estoque atual',
    exact: true
  }).click();
  await page.getByText('Saldo atual de estoque; o período não representa um saldo histórico.', {
    exact: true
  }).waitFor();
  await page.screenshot({
    path: out + '/reports.png',
    fullPage: true
  });
  pass('Relatórios usam período com máscara brasileira, indicadores, gráficos e estoque identificado como saldo atual');
  await page.goto('http://127.0.0.1:5180/(cooperativa)/dashboard');
  await page.getByText('Relatórios e análises', {
    exact: true
  }).filter({
    visible: true
  }).waitFor();
  pass('Entrada antiga do dashboard redireciona à nova navegação');
  const driverContext = await setup(ids.driverToken, ids.driverUser),
    driverPage = await driverContext.newPage();
  driverPage.on('pageerror', e => errors.push(e.message));
  await driverPage.goto('http://127.0.0.1:5180/(motorista)/compartilhar-localizacao');
  await driverPage.getByRole('button', {
    name: new RegExp(ids.individual.slice(-8).toUpperCase())
  }).click();
  await driverPage.getByRole('button', {
    name: 'Iniciar compartilhamento',
    exact: true
  }).click();
  await driverPage.getByText('Compartilhamento ativado neste aparelho', {
    exact: true
  }).waitFor();
  await driverPage.getByText('Modo com App aberto:', {
    exact: false
  }).waitFor();
  let live;
  for (let i = 0; i < 20; i++) {
    live = await api('/driver-tracking/drivers/' + ids.driver);
    if (live.state === 'LIVE') break;
    await new Promise(r => setTimeout(r, 250));
  }
  assert.equal(live.state, 'LIVE');
  assert.equal(live.position.latitude, -3.7302);
  await driverPage.getByRole('button', {
    name: 'Encerrar compartilhamento',
    exact: true
  }).click();
  await driverPage.getByRole('button', {
    name: 'Iniciar compartilhamento',
    exact: true
  }).waitFor();
  assert.equal((await api('/driver-tracking/drivers/' + ids.driver)).position, null);
  pass('Motorista inicia GPS pelo próprio aparelho simulado, envia posição à cooperativa e encerra pela tela');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
  assert.deepEqual(errors, []);
  pass('Telas de gestão e navegação verificadas em 390 px, sem erros JavaScript');
  fs.writeFileSync(out + '/results.json', JSON.stringify({
    passed: checks.length,
    checks,
    errors,
    transport: 'Real Expo web export, real local API, disposable PGlite; browser GPS simulated. Native background not device-tested.'
  }, null, 2));
} catch (e) {
  const page = browser?.contexts()?.[0]?.pages()?.[0];
  if (page) {
    await page.screenshot({
      path: out + '/failure.png',
      fullPage: true
    });
    fs.writeFileSync(out + '/failure.txt', (await page.locator('body').innerText()) + '\n' + JSON.stringify(errors));
  }
  throw e;
} finally {
  await browser?.close();
  await new Promise(resolve => staticServer.close(resolve));
}
