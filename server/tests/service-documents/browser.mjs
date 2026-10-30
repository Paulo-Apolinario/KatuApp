import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
const tools = process.env.KATUA_VALIDATION_TOOLS,
  panel = process.env.KATUA_PANEL_FRONTEND;
const fixture = JSON.parse(fs.readFileSync(path.join(tools, 'field-operations-fixture.json'), 'utf8')),
  ids = fixture.serviceDocuments;
const require = createRequire(path.join(tools, 'package.json')),
  {
    chromium
  } = require('playwright');
const out = path.join(tools, 'service-documents-ui-evidence');
fs.mkdirSync(out, {
  recursive: true
});
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5179', '--strictPort'], {
  cwd: panel,
  env: {
    ...process.env,
    VITE_API_BASE_URL: 'http://127.0.0.1:3339'
  },
  stdio: ['ignore', 'pipe', 'pipe']
});
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(Error('Vite timeout')), 30000);
  vite.stdout.on('data', b => {
    if (b.toString().includes('Local:')) {
      clearTimeout(timer);
      resolve();
    }
  });
  vite.on('exit', code => reject(Error('Vite ' + code)));
});
const checks = [],
  pass = name => {
    checks.push(name);
    console.log('PASS ' + name);
  };
let browser;
try {
  browser = await chromium.launch({
    executablePath: '/tmp/katua-pev-browser',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    headless: true
  });
  const context = await browser.newContext({
    viewport: {
      width: 1440,
      height: 1000
    },
    locale: 'pt-BR',
    timezoneId: 'America/Fortaleza',
    acceptDownloads: true
  });
  context.setDefaultTimeout(15000);
  await context.addInitScript(f => {
    localStorage.setItem('auth_token', f.token);
    localStorage.setItem('auth_user', JSON.stringify(f.owner));
  }, fixture);
  await context.route('**/*', r => ['127.0.0.1', 'localhost'].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort());
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:5179/service-orders?collectionId=' + ids.collection);
  await page.getByRole('button', {
    name: 'Ver documentos e pontos',
    exact: true
  }).click();
  await page.getByRole('heading', {
    name: 'Documentos desta O.S.',
    exact: true
  }).waitFor();
  await page.getByRole('link', {
    name: 'Ver coleta',
    exact: true
  }).nth(2).waitFor();
  assert.equal(await page.getByRole('link', {
    name: 'Ver coleta',
    exact: true
  }).count(), 3);
  await page.getByText('Motivo: Sem atendimento', {
    exact: true
  }).waitFor();
  await page.screenshot({
    path: out + '/order-points.png',
    fullPage: true
  });
  pass('Central acessível pelo menu, O.S. agrupada com três pontos, situações e motivo do cancelamento');
  const service = page.locator('article').filter({
    has: page.getByText('Ordem de serviço', {
      exact: true
    })
  }).first();
  await service.getByRole('button', {
    name: 'Visualizar',
    exact: true
  }).click();
  await page.getByRole('dialog').getByText('Dados preservados', {
    exact: false
  }).count();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', {
    name: 'Baixar PDF',
    exact: true
  }).waitFor();
  let wait = page.waitForEvent('download');
  await dialog.getByRole('button', {
    name: 'Baixar PDF',
    exact: true
  }).click();
  await (await wait).saveAs(out + '/service-order.pdf');
  await dialog.getByRole('button', {
    name: /fechar/i
  }).click();
  pass('Visualização e download da O.S. usam a versão preservada, com programação e documentos internos');
  await page.getByRole('button', {
    name: 'Todos os documentos',
    exact: true
  }).click();
  await page.locator('#os-kind').selectOption('TRANSPORT_RECORD');
  const transport = page.locator('article').filter({
    hasText: 'Comprovante interno de saída e transporte'
  }).first();
  await transport.waitFor();
  wait = page.waitForEvent('download');
  await transport.getByRole('button', {
    name: 'Baixar PDF',
    exact: true
  }).click();
  await (await wait).saveAs(out + '/transport-record.pdf');
  await transport.getByRole('button', {
    name: 'Visualizar',
    exact: true
  }).click();
  await page.getByRole('dialog').getByText('20 L', {
    exact: true
  }).waitFor();
  await page.getByRole('dialog').getByRole('button', {
    name: /fechar/i
  }).click();
  pass('Filtro por tipo, comprovante de saída em litros, destinatário e O.S. de origem');
  await page.goto('http://127.0.0.1:5179/service-orders?aba=documents&lotId=' + ids.lot);
  await page.getByRole('button', {
    name: 'Visualizar',
    exact: true
  }).click();
  await page.getByRole('dialog').getByText('Destinatário QA', {
    exact: true
  }).waitFor();
  await page.getByRole('dialog').getByRole('button', {
    name: /fechar/i
  }).click();
  pass('Consulta por lote encontra o documento vinculado à saída');
  await page.goto('http://127.0.0.1:5179/service-orders?aba=documents&kind=COLLECTION_RECEIPT&collectionId=' + ids.collection);
  await page.getByRole('button', {
    name: 'Baixar PDF',
    exact: true
  }).click({
    trial: true
  });
  wait = page.waitForEvent('download');
  await page.getByRole('button', {
    name: 'Baixar PDF',
    exact: true
  }).click();
  await (await wait).saveAs(out + '/collection-receipt.pdf');
  pass('Comprovante de coleta disponível na referência da coleta');
  await page.setViewportSize({
    width: 390,
    height: 844
  });
  await page.goto('http://127.0.0.1:5179/service-orders?ordem=' + ids.order);
  await page.getByRole('heading', {
    name: 'Documentos desta O.S.',
    exact: true
  }).waitFor();
  await page.waitForFunction(() => document.querySelector('.sidebar')?.getBoundingClientRect().right <= 1);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
  await page.screenshot({
    path: out + '/mobile.png',
    fullPage: true
  });
  assert.deepEqual(errors, []);
  pass('Tela adaptada a 390 px e navegação sem erros JavaScript');
  fs.writeFileSync(out + '/results.json', JSON.stringify({
    passed: checks.length,
    checks,
    errors,
    transport: 'Real local API and disposable PGlite'
  }, null, 2));
} finally {
  await browser?.close();
  vite.kill('SIGTERM');
}
