const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),ts=require('typescript');
const root=path.resolve(__dirname,'../../..'),store=new Map(),modules=new Map();
const storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
let offline=false;
class NetworkError extends Error {}
function load(file){
 file=path.resolve(file);if(file.endsWith('/database/index.ts'))file=file.replace('/index.ts','/index.web.ts');
 if(modules.has(file))return modules.get(file).exports;const m={exports:{}};modules.set(file,m);
 const src=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports','localStorage',src)(name=>{
  if(name==='react')return {};
  if(name==='./api')return {api:{get:async()=>{if(offline)throw new NetworkError('offline');return {routes:[{id:'route',name:'Rota atualizada',status:'IN_PROGRESS',scheduledDate:'2026-10-29T11:00:00Z'}],pagination:{page:1,total:1,hasMore:false}};}},isApiNetworkError:e=>e instanceof NetworkError};
  let f=name.startsWith('@/')?path.join(root,name.slice(2)):path.resolve(path.dirname(file),name);if(!fs.existsSync(f))f+='.ts';return load(f);
 },m,m.exports,storage);return m.exports;
}
(async()=>{
 const session=load(path.join(root,'src/database/repositories/sessionRepository.ts')),cache=load(path.join(root,'src/database/repositories/routeRepository.ts')),service=load(path.join(root,'src/services/routeService.ts')).routeService;
 await session.saveSession({userId:'cat',token:'qa',payload:{id:'cat'}});
 await cache.upsertRoutes([{id:'route',status:'SCHEDULED',payload:{id:'route',name:'Antigo',status:'SCHEDULED',driverId:'driver',collections:[{id:'point',status:'PENDING'}],activeCollections:[{id:'point',status:'PENDING'}],driver:{id:'driver',name:'Motorista'},collectionOrder:['point']}}]);
 await service.fieldPage();const row=await cache.getRouteById('route');assert.equal(row.payload.name,'Rota atualizada');assert.equal(row.payload.collections[0].id,'point');assert.equal(row.payload.driverId,'driver');
 console.log('PASS Resumo novo atualiza etapa sem apagar pontos ou equipe já salvos para uso offline');
 offline=true;const old=await service.fieldPage();assert.equal(old.routes[0].id,'route');
 await session.saveSession({userId:'other',token:'qa-other',payload:{id:'other'}});assert.equal((await service.fieldPage()).routes.length,0);
 console.log('PASS Consulta de rotas offline conserva o escopo da conta ativa');
})().catch(e=>{console.error(e);process.exitCode=1;});
