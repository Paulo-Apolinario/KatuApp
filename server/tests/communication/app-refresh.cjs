const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),ts=require('typescript');
const root=path.resolve(__dirname,'../../..');
const code=ts.transpileModule(fs.readFileSync(path.join(root,'src/hooks/useActiveReadRefresh.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
async function check(role, paused=false){
 let effect,timer,resume,network,cleared=0,calls=0;
 const m={exports:{}};
 new Function('require','module','exports','setInterval','clearInterval',code)(name=>{
  if(name==='react')return {useCallback:f=>f,useRef:v=>({current:v})};
  if(name==='react-native')return {AppState:{currentState:'active',addEventListener:(_event,f)=>{resume=f;return {remove:()=>cleared++};}}};
  if(name==='expo-router')return {useFocusEffect:f=>effect=f};
  if(name.includes('AuthContext'))return {useAuth:()=>({user:{id:'qa',role}})};
  if(name.includes('connectivity'))return {subscribeToConnectivity:f=>{network=f;return ()=>cleared++;}};
  throw Error(name);
 },m,m.exports,f=>{timer=f;return 1;},()=>cleared++);
 m.exports.useActiveReadRefresh(()=>{calls++;}, paused);const cleanup=effect();
 if(role==='COOPERATIVE'){assert.equal(timer,undefined);assert.equal(resume,undefined);assert.equal(network,undefined);return;}
 if(paused){await timer();resume("active");network({isOffline:true});network({isOffline:false});await Promise.resolve();assert.equal(calls,0);cleanup();return;}
 await timer();assert.equal(calls,1);resume('active');await Promise.resolve();assert.equal(calls,2);
 network({isOffline:true});network({isOffline:false});await Promise.resolve();assert.equal(calls,3);
 cleanup();await timer();assert.equal(calls,3);assert.equal(cleared,3);
}
(async()=>{await check('COOPERATIVE');console.log('PASS Perfil Cooperativa não instala atualização, listeners ou timers novos');await check('COLLECTOR');await check('GENERATOR_SMALL');await check('COLLECTOR',true);console.log('PASS Perfis de campo e gerador atualizam por timer, retorno e reconexão, com limpeza ao sair');})();
