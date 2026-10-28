const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { transpileModule, ModuleKind, ScriptTarget } = require('typescript');
const root = path.resolve(__dirname, '../../..');
const storage = new Map();
global.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) };
class NetworkError extends Error {}
let online = false, loseReply = false;
let netState = { isConnected: null, isInternetReachable: null };
const effects = new Map(), calls = [];
const api = { post: async (url, body) => {
  calls.push({url,body});
  if (!online) throw new NetworkError('Sem conexão QA');
  let collection=effects.get(body.operationId);
  if (!collection) { collection={id:url.split('/')[2], status:url.endsWith('/start')?'IN_PROGRESS':'COLLECTED', materials:[], totalWeightKg:10};effects.set(body.operationId,collection); }
  if (loseReply) { loseReply=false; throw new NetworkError('Resposta perdida QA'); }
  return {collection};
}, patch: async (url,body)=>({route:{id:url.split('/')[2],...body}}) };
let modules = new Map();
function load(file) {
  file=path.resolve(file);
  if (file===path.join(root,'src/database/index.ts'))file=path.join(root,'src/database/index.web.ts');
  if (modules.has(file))return modules.get(file).exports;
  const mod={exports:{}};modules.set(file,mod);
  const js=transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ModuleKind.CommonJS,target:ScriptTarget.ES2022}}).outputText;
  const customRequire = name => {
    if(name==='react')return {};
    if(name==='@react-native-community/netinfo')return { default: { fetch: async()=>netState } };
    if(name==='./sessionService')return {sessionService:get('src/database/repositories/sessionRepository.ts')};
    if(name.endsWith('/services/api') || name==='./api')return {api,isApiNetworkError:e=>e instanceof NetworkError};
    if(name==='./connectivity')return {getCurrentConnectivity:async()=>({isOffline:!online})};
    let target=name.startsWith('@/')?path.join(root,name.slice(2)):path.resolve(path.dirname(file),name);
    if(!fs.existsSync(target))target += '.ts';
    return load(target);
  };
  new Function('require','module','exports',js)(customRequire,mod,mod.exports);return mod.exports;
}
const get = p=>load(path.join(root,p));
async function main(){
 const session=get('src/database/repositories/sessionRepository.ts');
 const cache=get('src/database/repositories/collectionRepository.ts');
 const queue=get('src/database/repositories/syncQueueRepository.ts');
 const service=get('src/services/collectionService.ts').collectionService;
 const engine=get('src/offline/syncEngine.ts');
 const checks=[];const pass=s=>{checks.push(s);console.log('PASS '+s)};
 await session.saveSession({token:'local',userId:'cat',payload:{id:'cat'}});
 await cache.upsertCollections([{id:'point-a',status:'PENDING',payload:{id:'point-a',status:'PENDING',materials:[]}}]);
 await service.start('point-a',{});
 await service.completeField('point-a',{totalWeightKg:10,materials:[{wasteTypeId:'glass',quantity:10,unit:'KG'}]});
 let rows=await queue.getPendingSyncItems();assert.equal(rows.length,2);assert.equal(rows[0].payload.action,'start');assert.equal(rows[1].payload.action,'complete-field');
 const ids=rows.map(r=>r.payload.body.operationId);assert.equal(new Set(ids).size,2);assert.equal((await cache.getCollectionById('point-a')).status,'COLLECTED');
 pass('Início e conclusão offline são persistidos em ordem e projetados na coleta');
 const before=calls.length;const offline=await engine.syncPendingOperations();assert.equal(offline.processed,0);assert.equal(calls.length,before);assert.equal((await queue.getPendingSyncItems()).length,2);
 pass('Sem conexão não há envio e nenhuma pendência é apagada');
 // reload module graph to simulate closing/reopening the JavaScript runtime (same persistent storage)
 modules=new Map();const persisted=get('src/database/repositories/syncQueueRepository.ts');assert.equal((await persisted.getPendingSyncItems()).length,2);
 pass('Reinicialização do runtime recupera a fila persistente com os mesmos identificadores');
 online=true;loseReply=true;const lost=await engine.syncPendingOperations({manual:true});assert.equal(lost.success,false);assert.equal(effects.size,1);assert.equal((await queue.getPendingSyncItems()).length,2);assert.equal(calls.at(-1).body.operationId,ids[0]);
 pass('Resposta perdida preserva início e bloqueia conclusão da mesma coleta');
 const num=calls.length;await engine.syncPendingOperations();assert.equal(calls.length,num);
 pass('Tentativas automáticas respeitam intervalo após falha');
 const result=await engine.syncPendingOperations({entityId:'point-a',manual:true});assert.equal(result.success,true);assert.equal(effects.size,2);assert.deepEqual(calls.slice(-2).map(x=>x.body.operationId),ids);assert.equal((await queue.getPendingSyncItems()).length,0);assert.equal((await cache.getCollectionById('point-a')).status,'COLLECTED');
 pass('Reenvio manual usa operationId original, respeita ordem e confirma sem duplicar efeito');
 for(const id of ['point-b','point-c'])await queue.enqueueSyncItem({id,operationType:'UPDATE_ROUTE_STATUS',entityType:'ROUTE',entityId:id,payload:{id,status:'COMPLETED'}});
 await engine.syncPendingOperations({entityId:'point-b',manual:true});assert.deepEqual((await queue.getPendingSyncItems()).map(x=>x.id),['point-c']);
 pass('Nova tentativa individual preserva pendências de outras entidades');
 await session.saveSession({token:'other',userId:'other',payload:{id:'other'}});assert.equal((await queue.getPendingSyncItems()).length,0);assert.equal(await cache.getCollectionById('point-a'),null);
 await engine.syncPendingOperations({manual:true});await session.saveSession({token:'local',userId:'cat',payload:{id:'cat'}});assert.equal((await queue.getPendingSyncItems()).length,1);
 pass('Troca de conta não exibe nem envia a fila e o cache de outro usuário');
 const {loadCompleteHistory}=get('src/services/historyPage.ts');
 const exports=[];
 const all=await loadCompleteHistory(async(page,until)=>{exports.push({page,until});return {items:[{id:'receipt-'+page}],pagination:{page,limit:1,total:3,hasMore:page<3}}});
 assert.equal(all.length,3);assert.deepEqual(exports.map(p=>p.page),[1,2,3]);assert.equal(new Set(exports.map(p=>p.until)).size,1);
 pass('Exportação consolidada consulta todas as páginas sob demanda com a mesma data de corte');
 await assert.rejects(()=>loadCompleteHistory(async(page)=>{if(page===2)throw Error('Página indisponível');return {items:[{id:'one'}],pagination:{page,limit:1,total:2,hasMore:true}}}),/Página indisponível/);
 pass('Falha intermediária bloqueia documento consolidado parcial');
 await assert.rejects(()=>loadCompleteHistory(async(page)=>{await session.saveSession({userId:'changed',payload:{id:'changed'}});return {items:[{id:'one'}],pagination:{page,limit:1,total:1,hasMore:false}}}),/conta mudou/);
 pass('Exportação é interrompida se a conta mudar durante a consulta');
 const network=get('src/offline/connectivity.ts');
 assert.equal((await network.getCurrentConnectivity()).isOffline,false);
 netState={isConnected:true,isInternetReachable:false};assert.equal((await network.getCurrentConnectivity()).isOffline,true);
 pass('Conectividade desconhecida não é confundida com offline; falta de acesso confirmada bloqueia envio');
 global.window={isSecureContext:true};
 const nav={geolocation:{getCurrentPosition:ok=>ok({coords:{latitude:-3.73,longitude:-38.52},timestamp:Date.now()})}};
 Object.defineProperty(global,'navigator',{value:nav,configurable:true});
 const gps=get('src/services/locationBrowser.ts');
 assert.equal((await gps.browserPosition()).coords.latitude,-3.73);
 nav.geolocation.getCurrentPosition=(_,fail)=>fail({code:1});await assert.rejects(()=>gps.browserPosition(),/Permissão negada/);
 nav.geolocation.getCurrentPosition=ok=>ok({coords:{latitude:999,longitude:-38.52},timestamp:Date.now()});await assert.rejects(()=>gps.browserPosition(),/coordenadas inválidas/);
 window.isSecureContext=false;await assert.rejects(()=>gps.browserPosition(),/HTTPS/);
 pass('GPS no navegador valida posição e informa permissão negada, coordenadas inválidas e HTTPS ausente');
 const {sortCollectionHistory}=get('src/utils/collectionDates.ts');
 const unordered=[{id:'b',createdAt:'2026-10-27',collectedAt:'2026-10-27'},{id:'a',createdAt:'2026-10-01',collectedAt:'2026-10-28'}];
 assert.deepEqual(sortCollectionHistory(unordered).map(i=>i.id),['a','b']);assert.deepEqual(unordered.map(i=>i.id),['b','a']);
 pass('Consolidado ordena pelo dia efetivo da coleta, mesmo quando a criação tem ordem diferente');
 fs.writeFileSync(path.join(process.env.KATUA_VALIDATION_TOOLS || '/tmp','app-reliability-offline-results.json'),JSON.stringify({passed:checks.length,checks},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1});
