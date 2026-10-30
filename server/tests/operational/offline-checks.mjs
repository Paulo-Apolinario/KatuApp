import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
const require=createRequire(import.meta.url);
export async function runOfflineChecks({appDir,fixture,api,outputDir,report}) {
 const ts=require(appDir+'/server/node_modules/typescript');
 const sqlite=new DatabaseSync(resolve(outputDir,'offline-'+Date.now()+'.sqlite'));
 const adapter={
  getDatabase:async()=>({execAsync:async(sql)=>sqlite.exec(sql)}),
  runQuery:async(sql,params=[])=>{const stmt=sqlite.prepare(sql);return /^\s*(SELECT|PRAGMA)/i.test(sql)?stmt.all(...params):(stmt.run(...params),[]);},
  runSingle:async(sql,params=[])=>sqlite.prepare(sql).get(...params)??null,
 };
 let offline=false;
 const cache=new Map();
 function load(file) {
  file=resolve(file);if(cache.has(file))return cache.get(file).exports;
  const module={exports:{}};cache.set(file,module);
  const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const requireLocal=(name)=>{
   if(name==='./sessionService')return {sessionService:{getToken:async()=>fixture.token}};
   if(name==='./connectivity')return {getCurrentConnectivity:async()=>({isOffline:offline})};
   if(name==='../index'||name==='./index')return adapter;
   let path=name.startsWith('@/')?resolve(appDir,name.slice(2)):resolve(dirname(file),name);
   if(!path.endsWith('.ts'))path+='.ts';return load(path);
  };
  const testFetch=async(...args)=>{if(offline)throw new TypeError('Rede indisponível no teste');return fetch(...args);};
  new Function('require','module','exports','fetch','process',code)(requireLocal,module,module.exports,testFetch,{env:{EXPO_PUBLIC_API_BASE_URL:'http://127.0.0.1:3339'}});
  return module.exports;
 }
 try{
  await load(appDir+'/src/database/migrations.ts').runMigrations();
  const service=load(appDir+'/src/services/routeService.ts').routeService;
  const sync=load(appDir+'/src/offline/syncEngine.ts').syncPendingOperations;
  await service.getById(fixture.routes.blocked.id);offline=true;
  const pending=await service.updateStatus(fixture.routes.blocked.id,'COMPLETED');assert.equal(pending.syncStatus,'PENDING');
  assert.equal((await api('/routes/'+fixture.routes.blocked.id)).data.route.status,'IN_PROGRESS');
  offline=false;const rejected=await sync();
  const failed=sqlite.prepare('SELECT * FROM sync_queue WHERE entity_id = ?').get(fixture.routes.blocked.id);assert.equal(failed.status,'ERROR');assert.match(failed.error_message,/Finalize/);
  report('Offline+SQLite: operação rejeitada permanece na fila ERROR, servidor preservado','PASS');
  report('Offline: resultado da sincronização indica corretamente a rejeição',rejected.success===false?'PASS':'FAIL',`success=${rejected.success}; existe item ERROR`);
  await service.getById(fixture.routes.offline.id);offline=true;await service.updateStatus(fixture.routes.offline.id,'COMPLETED');offline=false;
  await sync();
  assert.equal((await api('/routes/'+fixture.routes.offline.id)).data.route.status,'COMPLETED');
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM sync_queue WHERE entity_id = ?').get(fixture.routes.offline.id).n,0);
  const fresh=await service.getById(fixture.routes.offline.id);assert.equal(fresh.syncStatus,'SYNCED');assert.equal(fresh.status,'COMPLETED');
  report('Offline+SQLite: reconexão sincroniza rota elegível e nova consulta confirma o servidor','PASS');
 }finally{sqlite.close();}
}
