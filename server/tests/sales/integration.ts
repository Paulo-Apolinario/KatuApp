import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {prisma} from '../../src/lib/prisma';
import {buildApp} from '../../src/app';
async function main(){
 if(process.env.KATUA_SALES_TEST!=='1'||!process.env.DATABASE_URL?.includes('127.0.0.1:54353'))throw Error('Disposable DB only');
 const app=await buildApp();
 try{
  for(const [id,role] of [['a','COOPERATIVE'],['b','COOPERATIVE'],['cat','COLLECTOR'],['pf','PF'],['admin','ADMIN']] as const)await prisma.user.create({data:{id,email:id+'@qa.invalid',passwordHash:'unused',displayName:id,role}});
  for(const id of ['a','b'])await prisma.cooperative.create({data:{id:'coop-'+id,userId:id,name:'Cooperativa '+id}});
  await prisma.collector.create({data:{userId:'cat',cooperativeId:'coop-a',name:'Catador QA'}});
  const item=await prisma.wasteStockItem.create({data:{id:'paper',cooperativeId:'coop-a',name:'Papelão',category:'Papel',ncm:'TEST'}});
  for(const [id,qty] of [['one',200],['two',170],['three',130]] as const)await prisma.wasteStockLot.create({data:{id,cooperativeId:'coop-a',stockItemId:item.id,quantity:qty,availableQuantity:qty,lotCode:'LOT-'+id}});
  const tokens=new Map<string,string>();
  async function call(who:string,method:any,url:string,payload?:any,status=200){if(who&&!tokens.has(who)){const u=await prisma.user.findUniqueOrThrow({where:{id:who}});tokens.set(who,app.jwt.sign({sub:who,role:u.role,authVersion:u.authVersion}));}const r=await app.inject({method,url,payload,headers:who?{authorization:'Bearer '+tokens.get(who)}:{}});assert.equal(r.statusCode,status,r.body);return r.json();}
  await call('','GET','/sales',undefined,401);await call('pf','GET','/sales',undefined,403);await call('cat','GET','/sales',undefined,403);
  const preview=await call('a','POST','/waste-stock/dispatches/preview',{stockItemId:item.id,unit:'KG',quantity:400});
  const dispatch=await call('a','POST','/waste-stock/dispatches',{stockItemId:item.id,unit:'KG',quantity:400,operationId:randomUUID(),expectedPlanHash:preview.planHash,kind:'SALE',destinationName:'Comprador QA',movementDate:'2026-11-24T13:00:00-03:00'},201);
  assert(dispatch.document);let list=await call('a','GET','/sales');assert.equal(list.items.length,1);assert.equal(list.items[0].lots.length,3);assert.equal(list.summary.total,1);assert.equal(list.summary.prepared,0);
  const key=list.items[0].key,uri='/sales/'+encodeURIComponent(key),stock=JSON.stringify(await prisma.wasteStockLot.findMany());
  const body={operationId:randomUUID(),expectedVersion:0,unitPrice:.8,notes:'Preço informado na preparação.'};
  const first=await call('a','PUT',uri+'/note',body);assert.equal(first.preparation.total,'320');assert.equal(first.preparation.version,1);assert.equal((await call('a','PUT',uri+'/note',body)).replayed,true);assert.equal(await prisma.saleNoteRevision.count(),1);
  await call('a','PUT',uri+'/note',{...body,unitPrice:.9},409);await call('b','GET',uri,undefined,404);await call('b','PUT',uri+'/note',body,404);
  await call('a','PUT',uri+'/note',{...body,operationId:randomUUID(),unitPrice:0},400);await call('a','PUT',uri+'/note',{...body,operationId:randomUUID(),unitPrice:.12345},400);
  const second=await call('a','PUT',uri+'/note',{...body,operationId:randomUUID(),expectedVersion:1,unitPrice:.85});assert.equal(second.preparation.total,'340');
  assert.equal((await call('a','GET',uri)).revisions.length,2);assert.equal(JSON.stringify(await prisma.wasteStockLot.findMany()),stock);
  list=await call('a','GET','/sales?status=PREPARED&dateFrom=2026-11-24&dateTo=2026-11-24&q=Comprador');assert.equal(list.items.length,1);assert.equal(Number(list.summary.preparedTotal),340);assert.equal((await call('a','GET','/sales?status=PENDING')).items.length,0);assert.equal((await call('b','GET','/sales')).items.length,0);
  await call('a','GET','/sales?dateFrom=2026-02-30',undefined,400);await call('a','GET','/sales?dateFrom=2026-11-25&dateTo=2026-11-24',undefined,400);
  // Legacy single-lot sale is separate; non-sale movements are excluded.
  await call('a','POST','/waste-stock/lots/three/movements',{operationId:randomUUID(),expectedVersion:2,kind:'SALE',quantity:20,destinationName:'Comprador avulso'},201);
  list=await call('a','GET','/sales');assert.equal(list.items.length,2);assert.equal(list.items.filter((s:any)=>s.key.startsWith('dispatch:')).length,1);assert.equal(list.items.filter((s:any)=>s.key.startsWith('movement:')).length,1);
  assert.equal(await prisma.simulationWorkspace.count(),0);assert.equal(await prisma.environmentalDocument.count(),0);
  console.log('PASS: venda agrupada por saída sem duplicar lotes, venda individual, filtros, segregação, preços decimais, histórico de revisões, replay e conflito; preparação não altera estoque nem emite documento oficial');
  if(process.env.KATUA_SALES_BROWSER){await app.listen({host:'127.0.0.1',port:3343});const child=spawn(process.execPath,[process.env.KATUA_SALES_BROWSER],{stdio:'inherit',env:{...process.env,SALES_UI_TOKEN:tokens.get('a')}});assert.equal(await new Promise(resolve=>child.once('exit',resolve)),0);}
 }finally{await app.close();await prisma.$disconnect();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
