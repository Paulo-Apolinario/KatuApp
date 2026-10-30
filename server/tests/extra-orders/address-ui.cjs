// UI real com componentes de mapa, transporte e localização controlados.
const { createRequire } = require("node:module"),
  http = require("node:http"),
  assert = require("node:assert/strict"),
  path = require("node:path");
const app = path.resolve(__dirname, "../../..");
if (!process.env.KATUA_VALIDATION_TOOLS)
  throw Error(
    "Defina KATUA_VALIDATION_TOOLS com Playwright e @sparticuz/chromium.",
  );
const req = createRequire(
  path.join(path.resolve(process.env.KATUA_VALIDATION_TOOLS), "package.json"),
);
const esbuild = require("esbuild");
const mocks = `import React from 'react';
export const Text=({children})=><p>{children}</p>;
export const Field=({label,value,onChangeText,editable=true,maxLength})=><label>{label}<input aria-label={label} value={value} disabled={!editable} maxLength={maxLength} onChange={e=>onChangeText(e.target.value)}/></label>;
export const Notice=({text})=><p>{text}</p>;
export const Action=({label,onPress,disabled,busy})=><button disabled={disabled||busy} onClick={onPress}>{label}</button>;
export const Accuracy={High:1};
export const requestForegroundPermissionsAsync=async()=>({granted:true});
export const getCurrentPositionAsync=async()=>({coords:{latitude:-3.7,longitude:-38.5,accuracy:12}});
export const api={getExternalJson:async()=> {if(window.failCep) throw Error('Sem conexão'); if(window.badCep) return {erro:true}; return {logradouro:'Rua Teste',bairro:'Centro',localidade:'Fortaleza',uf:'CE'};}};
export default function Map({onPick}){return <button onClick={()=>onPick(-3.8,-38.6)}>Marcar no mapa</button>}
`;
(async () => {
  const result = await esbuild.build({
    stdin: {
      contents: `import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import Address,{emptyAddressDraft} from './src/screens/extra-orders/ExtraOrderAddress';function App(){const [value,change]=useState({pickupAddress:'Rua Inicial, 10',originName:'QA'}),[draft,onDraft]=useState(emptyAddressDraft),[pending,onPending]=useState(false);window.state={value,draft,pending};window.resetGenerator=()=>change({...value,generatorId:'new',pickupAddress:'Novo gerador, 20'});return <Address value={value} draft={draft} onDraft={onDraft} onChange={change} onPending={onPending}/>};createRoot(document.getElementById('root')).render(<App/>);`,
      resolveDir: app,
      loader: "tsx",
    },
    bundle: true,
    write: false,
    format: "iife",
    jsx: "automatic",
    plugins: [
      {
        name: "mocks",
        setup(build) {
          build.onResolve(
            {
              filter:
                /^(react-native|.*Workspace|.*OperationalMap|.*deviceLocation|.*services\/api)$/,
            },
            (args) => ({ path: args.path, namespace: "mock" }),
          );
          build.onLoad({ filter: /.*/, namespace: "mock" }, () => ({
            contents: mocks,
            loader: "jsx",
            resolveDir: app,
          }));
        },
      },
    ],
  });
  const bundle = result.outputFiles[0].text;
  const server = http
    .createServer((q, s) => {
      s.setHeader(
        "Content-Type",
        q.url === "/app.js" ? "application/javascript" : "text/html",
      );
      s.end(
        q.url === "/app.js"
          ? bundle
          : '<div id="root"></div><script src="/app.js"></script>',
      );
    })
    .listen(0, "127.0.0.1");
  await new Promise((r) => server.on("listening", r));
  const chromium = req("@sparticuz/chromium").default,
    { chromium: pw } = req("playwright");
  const browser = await pw.launch({
    executablePath:
      process.env.KATUA_CHROMIUM_PATH || (await chromium.executablePath()),
    args: chromium.args.filter((a) => a !== "--single-process"),
    headless: true,
  });
  const page = await browser.newPage();
  let n = 0;
  const state = () => page.evaluate(() => window.state);
  const click = (label) =>
    page.getByRole("button", { name: label, exact: true }).click();
  const pass = (label) => {
    n++;
    console.log("PASS " + label);
  };
  try {
    await page.goto("http://127.0.0.1:" + server.address().port);
    await page.getByLabel("Endereço da retirada", { exact: true }).waitFor();
    await click("Selecionar ponto no mapa");
    await click("Marcar no mapa");
    assert.equal((await state()).value.latitude, undefined);
    assert.equal((await state()).pending, true);
    pass("Ponto provisório não modifica payload e bloqueia envio");
    await click("Cancelar seleção");
    await page.waitForFunction(() => !window.state.pending);
    assert.equal((await state()).value.latitude, undefined);
    assert.equal((await state()).pending, false);
    pass("Cancelar descarta seleção");
    await click("Selecionar ponto no mapa");
    await click("Marcar no mapa");
    await click("Confirmar endereço e ponto");
    await page.waitForFunction(() => !window.state.pending);
    assert.equal((await state()).value.latitude, -3.8);
    assert.equal((await state()).pending, false);
    pass("Confirmar salva coordenadas e endereço");
    await click("Selecionar ponto no mapa");
    await click("Marcar no mapa");
    await click("Cancelar seleção");
    await page.waitForFunction(() => !window.state.pending);
    assert.equal((await state()).value.latitude, -3.8);
    pass("Cancelar nova seleção preserva coordenadas anteriores");
    await page
      .getByLabel("CEP da retirada (opcional)", { exact: true })
      .fill("60000-000");
    await click("Buscar endereço pelo CEP");
    await page.waitForFunction(() => window.state.draft.street === "Rua Teste");
    await page.getByLabel("Número ou S/N", { exact: true }).fill("123");
    await page
      .getByLabel("Complemento / referência", { exact: true })
      .fill("Portão azul");
    assert.match(
      (await state()).value.pickupAddress,
      /Rua Teste, 123, Portão azul, Centro, Fortaleza\/CE, CEP 60000-000/,
    );
    assert.equal((await state()).value.latitude, undefined);
    pass(
      "CEP + número + complemento compõem endereço e removem ponto anterior",
    );
    await page.evaluate(() => (window.failCep = true));
    await click("Buscar endereço pelo CEP");
    await page.getByText("Sem conexão", { exact: true }).waitFor();
    assert.match((await state()).value.pickupAddress, /Portão azul/);
    pass("Falha de CEP preserva endereço e permite preenchimento manual");
    await page
      .getByLabel("Endereço da retirada", { exact: true })
      .fill("Endereço manual offline, 15");
    assert.equal(
      (await state()).value.pickupAddress,
      "Endereço manual offline, 15",
    );
    assert.equal((await state()).pending, false);
    pass("Endereço manual sem mapa é permitido");
    await click("Usar localização atual do aparelho");
    await page.getByText(/Ponto selecionado: -3.70000/).waitFor();
    assert.equal((await state()).value.latitude, undefined);
    await click("Confirmar endereço e ponto");
    await page.waitForFunction(() => !window.state.pending);
    assert.equal((await state()).value.accuracyMeters, 12);
    pass("GPS também depende de confirmação e preserva precisão");
    await click("Selecionar ponto no mapa");
    await click("Marcar no mapa");
    await page.evaluate(() => window.resetGenerator());
    await page.waitForFunction(() => !window.state.pending);
    assert.equal(
      await page
        .getByRole("button", {
          name: "Confirmar endereço e ponto",
          exact: true,
        })
        .count(),
      0,
    );
    pass("Trocar gerador descarta ponto provisório");
    await click("Selecionar ponto no mapa");
    await click("Marcar no mapa");
    await page.getByLabel("Endereço da retirada", { exact: true }).fill("");
    await click("Confirmar endereço e ponto");
    await page
      .getByText("Informe o endereço da retirada antes de confirmar o ponto.", {
        exact: true,
      })
      .waitFor();
    assert.equal((await state()).value.latitude, undefined);
    pass("Confirmação exige endereço informado");
    console.log(JSON.stringify({ passed: n, failed: 0 }));
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
