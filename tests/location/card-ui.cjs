/** Componentes reais React Native Web; transporte e leituras do aparelho controlados. */
const path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../..');
const esbuild = createRequire(path.join(root, 'server/package.json'))('esbuild');
const req = createRequire(path.resolve(process.env.KATUA_VALIDATION_TOOLS, 'package.json'));
(async () => {
  const built = await esbuild.build({stdin:{contents:`
    import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
    import {DeviceLocationCard} from './src/components/DeviceLocationCard';
    window.livePosition=()=>({timestamp:Date.now(),coords:{latitude:-3.73,longitude:-38.52,accuracy:12}});
    function App(){const [location,setLocation]=useState({position:window.livePosition(),loading:false,error:'',active:true});
      window.changeLocation=(next)=>setLocation(old=>({...old,...next}));
      return <DeviceLocationCard location={{...location,retry:()=>{window.retries=(window.retries||0)+1;setLocation(old=>({...old,position:window.livePosition()}))}}}/>;}
    createRoot(document.getElementById('root')).render(<App/>);`, resolveDir:root, loader:'tsx'},
    bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"test"'},
    alias:{'react-native':'react-native-web'},plugins:[{name:'device',setup(build){
      build.onResolve({filter:/services\/deviceLocation$/},()=>({path:'device',namespace:'mock'}));
      build.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const Accuracy={High:1};export const getCurrentPositionAsync=async()=>window.livePosition();'}));
    }}]});
  const server=http.createServer((q,s)=>{s.setHeader('Content-Type',q.url==='/app.js'?'application/javascript':'text/html');s.end(q.url==='/app.js'?built.outputFiles[0].text:'<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script src="/app.js"></script>');}).listen(0,'127.0.0.1');
  await new Promise(r=>server.on('listening',r));
  const chrome=req('@sparticuz/chromium').default;
  const browser=await req('playwright').chromium.launch({executablePath:process.env.KATUA_CHROMIUM_PATH,args:chrome.args.filter(a=>a!=='--single-process'),headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  let requests=0,fail=false;const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://api.bigdatacloud.net/**',async route=>{
    requests++;const url=new URL(route.request().url());
    await route.fulfill({status:fail?503:200,contentType:'application/json',body:JSON.stringify({latitude:Number(url.searchParams.get('latitude')),longitude:Number(url.searchParams.get('longitude')),lookupSource:'coordinates',city:'Fortaleza',principalSubdivision:'Ceará'})});
  });
  const click=name=>page.getByRole('button',{name,exact:true}).click();let count=0;const pass=name=>{count++;console.log('PASS',name)};
  try{
    await page.goto('http://127.0.0.1:'+server.address().port);
    await page.getByText(/Posição obtida do aparelho/).waitFor();assert.equal(requests,0);pass('Posição obtida não dispara consulta externa');
    await page.getByText(/precisão aproximada 12 m/).waitFor();await page.getByText(/-3.73000, -38.52000/).waitFor();pass('Precisão e coordenadas recebidas são exibidas');
    await click('Identificar cidade');await page.getByText(/seu aparelho enviará a posição atual ao BigDataCloud/).waitFor();await click('Agora não');assert.equal(requests,0);pass('Cancelar consentimento não envia coordenadas');
    await click('Identificar cidade');await click('Continuar e identificar cidade');await page.getByText('Localidade aproximada: Fortaleza · Ceará',{exact:true}).waitFor();assert.equal(requests,1);pass('Consentimento identifica cidade pelas coordenadas atuais');
    await click('Atualizar localização');assert.equal(await page.evaluate(()=>window.retries),1);pass('Atualizar fica disponível após sucesso');
    await page.evaluate(()=>window.changeLocation({position:{...window.livePosition(),coords:{latitude:-3.8,longitude:-38.6,accuracy:180}}}));
    await page.getByText(/Precisão reduzida/).waitFor();assert.equal(await page.getByText('Localidade aproximada: Fortaleza · Ceará',{exact:true}).count(),0);pass('Mudança de posição descarta cidade anterior e alerta baixa precisão');
    await page.evaluate(()=>window.changeLocation({position:window.livePosition()}));fail=true;
    await click('Identificar cidade');await click('Continuar e identificar cidade');await page.getByText(/Serviço de identificação da cidade indisponível/).waitFor();await page.getByText(/Posição obtida do aparelho/).waitFor();pass('Falha da cidade preserva posição do aparelho');
    await page.evaluate(()=>window.changeLocation({position:null,error:'Permissão negada. Libere a localização nas permissões deste site ou aplicativo.'}));
    await page.getByText(/Permissão negada/).waitFor();assert.equal(await page.getByRole('button',{name:'Identificar cidade',exact:true}).count(),0);await click('Atualizar localização');pass('Permissão negada oferece nova tentativa sem cidade fictícia');
    await page.evaluate(()=>window.changeLocation({active:false,error:''}));await page.getByText(/Localização pausada/).waitFor();pass('Tela inativa informa pausa');
    assert.deepEqual(errors,[]);pass('Sem exceções JavaScript na interface');
    if(process.env.KATUA_GPS_SCREENSHOT){await page.evaluate(()=>window.changeLocation({active:true,position:window.livePosition()}));await page.getByText(/Posição obtida do aparelho/).waitFor();await page.screenshot({path:process.env.KATUA_GPS_SCREENSHOT,fullPage:true});}
    console.log('PASS TOTAL',count);
  }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
