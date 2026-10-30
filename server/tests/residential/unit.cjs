const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const ts=require('typescript'),root=path.resolve(__dirname,'../../..');
function compile(file,mocks={}){const module={exports:{}};const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',code)(name=>{if(!(name in mocks))throw Error('Dependência inesperada '+name);return mocks[name]},module,module.exports);return module.exports;}
async function main(){const checks=[],pass=name=>{checks.push(name);console.log('PASS '+name)};
 const {maskDate,maskTime,decimalValue,numberBR,residentialDate}=compile('src/utils/residential.ts');
 assert.equal(maskDate('28102026'),'28/10/2026');assert.equal(maskDate('28/10/2026'),'28/10/2026');assert.equal(maskDate('28/10'),'28/10');assert.equal(maskDate('28/1'),'28/1');assert.equal(maskDate(''),'');
 assert.equal(maskTime('1430'),'14:30');assert.equal(maskTime('14:3'),'14:3');assert.equal(maskTime('14:'),'14');assert.equal(maskTime('999999'),'99:99');
 const {parseFortalezaDateTime:parse}=compile('src/utils/dateTime.ts');assert.equal(parse('31/02/2026','14:30'),null);assert.equal(parse('28/10/2026','24:00'),null);assert.equal(parse('28/10/2026','14:30'),'2026-10-28T17:30:00.000Z');
 pass('Máscaras permitem digitação, colagem e exclusão; datas impossíveis e horários inválidos são rejeitados');
 assert.equal(decimalValue('-5'),null);assert.equal(decimalValue('abc'),null);assert.equal(decimalValue('1,5'),1.5);assert.equal(decimalValue('1.5'),1.5);assert.equal(decimalValue('Infinity'),null);assert.equal(numberBR(12.5),'12,5');assert.equal(numberBR(0.025),'0,025');
 pass('Estimativas rejeitam negativos e texto; apresentação usa vírgula decimal brasileira');
 const date=residentialDate('2026-11-01T01:30:00Z');assert.ok(date.includes('31/10/2026'));assert.ok(date.includes('22:30'));
 pass('Datas do acompanhamento respeitam Fortaleza mesmo na virada de dia e mês');
 const rows=new Map();let owner='resident',online=false,bad=false,quota=false,calls=[];
 const storage={getItem:async k=>rows.get(k)||null,setItem:async(k,v)=>{if(quota)throw Error('Sem espaço');rows.set(k,v)},removeItem:async k=>rows.delete(k)};
 const api={post:async(url,body)=>{calls.push(body);if(!online)throw Error('Resposta perdida');if(bad)throw Object.assign(Error('Data inválida'),{status:typeof bad==='number'?bad:400});return {schedule:{id:'schedule-original'}}},get:async()=>({schedule:{id:'schedule-original'}})};
 const service=compile('src/services/residentialService.ts',{'./api':{api,isApiHttpError:e=>typeof e?.status==='number'},'@react-native-async-storage/async-storage':{default:storage},'expo-crypto':{randomUUID},'./sessionService':{sessionService:{getSession:async()=>({userId:owner})}}}).residentialService;
 const payload={cooperativeId:'coop',pickupAddress:'Rua QA, 100',preferredDate:'2026-11-10T12:00:00Z',requestedMaterials:[{wasteTypeId:'glass',unit:'KG'}]};
 await assert.rejects(()=>service.submit(owner,payload),/Resposta perdida/);const pending=await service.pendingSubmission(owner);assert.ok(pending.operationId);online=true;const confirmed=await service.submit(owner);assert.equal(confirmed.id,'schedule-original');assert.deepEqual(calls[0],calls[1]);assert.equal(await service.pendingSubmission(owner),null);
 pass('Perda de resposta preserva conteúdo e identificador; retomada confirma o mesmo pedido');
 bad=true;await assert.rejects(()=>service.submit(owner,payload),/Data inválida/);assert.equal(await service.pendingSubmission(owner),null);bad=false;
 bad=404;await assert.rejects(()=>service.submit(owner,payload),/Data inválida/);assert.equal(await service.pendingSubmission(owner),null);bad=false;
 pass('Rejeição de validação libera a edição do pedido sem guardar tentativa inválida');
 const count=calls.length;owner='another';await assert.rejects(()=>service.submit('resident',payload),/conta mudou/);assert.equal(calls.length,count);owner='resident';quota=true;await assert.rejects(()=>service.submit(owner,payload),/Sem espaço/);assert.equal(calls.length,count);
 pass('Troca de conta e falha ao persistir interrompem o envio antes de chamar a API');
 fs.writeFileSync(path.join(process.env.KATUA_VALIDATION_TOOLS||'/tmp','residential-unit-results.json'),JSON.stringify({passed:checks.length,checks},null,2));}
main().catch(e=>{console.error(e);process.exitCode=1});
