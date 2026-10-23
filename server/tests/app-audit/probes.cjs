/** Diagnóstico: PASS significa que o comportamento observado foi reproduzido,
 * inclusive quando ele é um defeito. Não altera o código de produção. */
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const ts=require('typescript');
const root=path.resolve(__dirname,'../../..'), results=[];
function source(file){return fs.readFileSync(path.join(root,file),'utf8');}
function compile(text){return ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;}
function moduleFrom(file,requires){const mod={exports:{}};new Function('require','module','exports',compile(source(file)))(requires,mod,mod.exports);return mod.exports;}
function extract(file,name){const txt=source(file), sf=ts.createSourceFile(file,txt,99,true,ts.ScriptKind.TSX);let found;function walk(n){if((ts.isFunctionDeclaration(n)||ts.isVariableDeclaration(n))&&n.name?.getText(sf)===name){found=n;return;}ts.forEachChild(n,walk);}walk(sf);if(!found)throw Error('Função não encontrada '+name);const text=found.getText(sf);return ts.isVariableDeclaration(found)?'const '+text+';':text;}
function functions(file,names,variables={}){const mod={exports:{}};new Function('module','exports',...Object.keys(variables),compile(names.map(n=>extract(file,n)).join('\n')+'\nexport { '+names.at(-1)+' };'))(mod,mod.exports,...Object.values(variables));return mod.exports[names.at(-1)];}
async function check(id,name,fn){const evidence=await fn();results.push({id,name,status:'REPRODUCED',evidence});console.log('REPRODUCED',id,name);}
(async()=>{
 await check('APP01','PF envia strings a um serviço que exige objetos de material',async()=>{
  let calls=0;
  const svc=moduleFrom('src/services/scheduleService.ts',name=>{
   if(name==='./api')return {api:{post:async()=>{calls++;}},isApiNetworkError:()=>false};
   if(name.includes('scheduleRepository'))return {};
   throw Error(name);
  }).scheduleService;
  await assert.rejects(svc.create({cooperativeId:'coop-qa',preferredDate:'2026-10-23T12:00:00Z',requestedMaterials:['PAPEL']}),/Material inválido na posição 1/);
  assert.equal(calls,0);return {apiCalls:0,error:'Material inválido na posição 1.'};
 });
 await check('APP02','Sair no botão compartilhado PF apenas redireciona',async()=>{
  let buttons,redirect=null;
  const component=moduleFrom('src/components/LogoutButton.tsx.tsx',name=>{
   if(name==='react/jsx-runtime')return {jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
   if(name==='expo-router')return {router:{replace:value=>redirect=value}};
   if(name==='react-native')return {TouchableOpacity:'button',Alert:{alert:(a,b,c)=>{buttons=c;}}};
   if(name==='@expo/vector-icons')return {Ionicons:'icon'};
   throw Error(name);
  }).default;
  component({}).props.onPress();buttons.find(b=>b.text==='Sair').onPress();assert.equal(redirect,'/(public)/access-type');
  assert(!source('src/components/LogoutButton.tsx.tsx').includes('signOut'));
  return {action:'router.replace',sessionClearInvoked:false};
 });
 await check('APP03','Erro 401 em auth/me mantém usuário armazenado',async()=>{
  let cleared=0;const stored={id:'user-qa',role:'COLLECTOR'};
  const svc=moduleFrom('src/services/authService.ts',name=>{
   if(name==='./api')return {api:{get:async()=>{throw Object.assign(Error('Sessão revogada'),{status:401});}}};
   if(name==='./sessionService')return {sessionService:{getToken:async()=>'fixture-only',getUser:async()=>stored,clearSession:async()=>cleared++}};
   throw Error(name);
  }).default;
  const user=await svc.getCurrentUserData();assert.equal(user.id,stored.id);assert.equal(cleared,0);
  return {httpStatus:401,cachedUserReturned:true,sessionCleared:false,note:'Não comprova acesso indevido à API; os endpoints continuam autenticados.'};
 });
 await check('APP04','Cache de agendamentos atravessa troca de conta offline',async()=>{
  const values=new Map();const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};const cache=new Map();
  function load(file){if(file.endsWith('/src/database/index.ts'))file=path.join(root,'src/database/index.web.ts');if(cache.has(file))return cache.get(file).exports;const mod={exports:{}};cache.set(file,mod);new Function('require','module','exports','localStorage',compile(fs.readFileSync(file,'utf8')))(name=>load(path.resolve(path.dirname(file),name)+'.ts'),mod,mod.exports,storage);return mod.exports;}
  const sessions=load(path.join(root,'src/database/repositories/sessionRepository.ts'));
  const repo=load(path.join(root,'src/database/repositories/scheduleRepository.ts'));
  await sessions.saveSession({token:'fixture-a',userId:'account-a',payload:{id:'account-a'}});
  await repo.upsertSchedules([{id:'schedule-account-a',payload:{id:'schedule-account-a',status:'REQUESTED',notes:'dado de teste A'}}]);
  await sessions.saveSession({token:'fixture-b',userId:'account-b',payload:{id:'account-b'}});
  const rows=await repo.getAllSchedules();assert.equal(rows[0].id,'schedule-account-a');return {activeAccount:'account-b',returnedSchedule:'schedule-account-a',sourceAccount:'account-a'};
 });
 await check('APP05','Tabela do PDF imprime material em LITER como zero kg',async()=>{
  const render=functions('src/services/pdfGenerator.ts',['escapeHtml','formatKg','renderMaterialsTable']);
  const html=render([{type:'Óleo',name:'Óleo',quantity:50,unit:'LITER',quantityKg:0}]);assert(html.includes('0.0 kg'));assert(!html.includes('50.0 L'));
  return {input:'50 LITER',printed:'0.0 kg'};
 });
 await check('APP06','Data inexistente PF é normalizada para outro dia',async()=>{
  const parse=functions('app/(pf-tabs)/schedule.tsx',['parseDateTimeToIso']);const value=parse('31/02/2026','14:30');assert(value);assert.equal(new Date(value).getMonth(),2);return {input:'31/02/2026',acceptedDate:new Date(value).toLocaleDateString('pt-BR')};
 });
 await check('APP07','Criar rota pelo serviço do app omite collectionIds',async()=>{
  let sent;
  const svc=moduleFrom('src/services/routeService.ts',name=>{
   if(name==='./api')return {api:{post:async(url,body)=>{sent=body;return {route:{id:'route-qa',name:body.name,status:'SCHEDULED',stops:[],collections:[]}};}},isApiNetworkError:()=>false};
   if(name.includes('routeRepository'))return {upsertRoutes:async()=>{}};
   if(name.includes('syncQueueRepository'))return {};
   if(name.includes('database/schema'))return {};
   throw Error(name);
  }).routeService;
  await svc.create({name:'Rota QA',scheduledDate:'23/10/2026',stops:['Rua QA'],collectionIds:['collection-qa']});assert.equal(sent.collectionIds,undefined);return {inputCollectionIds:1,sentCollectionIds:0};
 });
 await check('APP08','Botão de problema do catador chama cancelamento exclusivo da cooperativa',async()=>{
  const Service=moduleFrom('server/src/modules/collections/collection.service.ts',name=>{
   if(name==='node:crypto'||name==='@prisma/client')return require(name);
   if(name.endsWith('/lib/prisma'))return {prisma:{}};
   if(name==='./collection.types')return require(path.join(root,'server/src/modules/collections/collection.types.ts'));
   throw Error(name);
  }).CollectionService;
  const svc=new Service();svc.getAccessContext=async()=>({role:'COLLECTOR',collectorId:'collector-qa',cooperativeId:'coop-qa'});
  await assert.rejects(svc.cancel('user-qa','COLLECTOR','collection-qa',{cancellationReason:'Coleta inviável'}),e=>e.statusCode===403&&e.code==='ONLY_COOPERATIVE_CAN_CANCEL');
  return {caller:'COLLECTOR',httpStatus:403,code:'ONLY_COOPERATIVE_CAN_CANCEL'};
 });
 await check('APP09','Mapa do motorista ignora coleta com origem PEV',async()=>{
  const getOrigin=functions('app/(motorista)/mapa.tsx',['getCollectionGenerator']);
  const origin=getOrigin({id:'pev-collection-qa',generator:null,schedule:null,bin:{id:'pev-qa',latitude:-3.7,longitude:-38.5}});
  assert.equal(origin,null);return {originType:'PEV',validCoordinatesProvided:true,originReturned:null};
 });
 await check('APP10','Percentual da cooperativa omite as etapas intermediárias',async()=>{
  const groups=functions('app/(cooperativa)/percentual.tsx',['statusGroups'],{collections:[{status:'RECEIVED',totalWeightKg:100}]});
  assert.equal(groups.reduce((sum,g)=>sum+g.items.length,0),0);
  return {input:'100 kg RECEIVED',representedCollections:0,missingStatuses:['COLLECTED','RECEIVED','SORTING']};
 });
 const output={date:'2026-10-22',method:'Serviços/componentes reais transpilados; transporte/armazenamento controlados. Não é execução em aparelho físico.',results};
 if(process.env.KATUA_AUDIT_OUTPUT)fs.writeFileSync(process.env.KATUA_AUDIT_OUTPUT,JSON.stringify(output,null,2)+'\n');
 console.log(JSON.stringify(output,null,2));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
