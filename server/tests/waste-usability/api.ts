import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
export async function checkWasteUsability(app:FastifyInstance,p:PrismaClient,users:any,coop:any,cat:any,pass:(name:string)=>void) {
  async function call(who:string,method:any,url:string,payload?:any,status=200){const user=users[who];const r=await app.inject({method,url,payload,headers:{authorization:'Bearer '+app.jwt.sign({sub:user.id,role:user.role})}});assert.equal(r.statusCode,status,r.body);return r.json();}
  const legacy=await p.wasteStockLot.findUniqueOrThrow({where:{id:'stock-before-ledger'}});assert.equal(legacy.version,1);assert.equal(Number(legacy.availableQuantity),50);assert.equal(legacy.unit,'LITER');
  pass('Migração mantém lote antigo disponível, sua quantidade, unidade e versão inicial sem inventar saídas');
  const item=await p.wasteStockItem.create({data:{cooperativeId:coop.id,name:'Óleo de cozinha QA',category:'Óleo',unit:'LITER',defaultUnit:'LITER'}});
  const c=await p.collection.create({data:{cooperativeId:coop.id,collectorId:cat.id,status:'COLLECTED',quantityReviewVersion:0,collectedAt:new Date(),totalWeightKg:0,collectionMaterials:{create:{wasteTypeId:item.id,nameSnapshot:item.name,quantity:50,unit:'LITER'}}},include:{collectionMaterials:true}});
  const entry=await p.collectionWasteEntry.create({data:{cooperativeId:coop.id,collectionId:c.id,collectionMaterialId:c.collectionMaterials[0].id,wasteTypeId:item.id,collectorId:cat.id,materialNameSnapshot:item.name,collectedQuantity:50,remainingQuantity:50,unit:'LITER'}});
  await call('owner','POST',`/collections/${c.id}/receive`,{});
  await call('owner','POST',`/collections/${c.id}/review-quantities`,{expectedVersion:0,reason:'Volume conferido em recipiente graduado',items:[{materialId:c.collectionMaterials[0].id,quantity:50}]});
  const reviewed=await p.collection.findUniqueOrThrow({where:{id:c.id}});assert.equal(reviewed.quantityReviewVersion,1);assert.equal(reviewed.totalWeightKg,0);
  pass('Recebimento e conferência de óleo preservam 50 L, sem exigir pesagem fictícia nem converter volume em peso');
  const d=(await call('owner','POST','/collection-waste-destinations',{operationId:randomUUID(),collectionWasteEntryId:entry.id,type:'STOCK',stockItemId:item.id,quantity:50,unit:'LITER'},201)).destination;
  await call('owner','POST',`/collections/${c.id}/complete`,{});
  let lot=await p.wasteStockLot.findUniqueOrThrow({where:{id:d.stockLotId}});
  async function move(kind:string,extras:any={},status=201,who='owner') {const response=await call(who,'POST',`/waste-stock/lots/${lot.id}/movements`,{operationId:randomUUID(),expectedVersion:lot.version,kind,...extras},status);if(status<300)lot=response.lot;return response;}
  const reserve=await move('RESERVE');assert.equal(reserve.lot.status,'RESERVED');assert.equal(Number(reserve.lot.availableQuantity),50);
  await move('SALE',{quantity:1,destinationName:'Receptor'},409);await move('RELEASE');
  await move('PROCESSING',{processingStage:'PRENSADO'});assert.equal(lot.processingStage,'PRENSADO');
  const partial=await move('SALE',{quantity:20,destinationName:'Empresa Recicla QA',destinationDocument:'CNPJ QA'});assert.equal(Number(lot.availableQuantity),30);assert.equal(lot.status,'AVAILABLE');
  const repeat=await call('owner','POST',`/waste-stock/lots/${lot.id}/movements`,{operationId:partial.movement.operationId,expectedVersion:partial.movement.before.version,kind:'SALE',quantity:20,destinationName:'Empresa Recicla QA',destinationDocument:'CNPJ QA'});assert.equal(repeat.movement.id,partial.movement.id);assert.equal(Number(repeat.lot.availableQuantity),30);
  pass('Reserva, liberação, processamento e saída parcial preservam origem, saldo e unidade; repetição da mesma operação não duplica saída');
  await move('SALE',{quantity:31,destinationName:'Receptor'},409);await move('DISPOSAL',{quantity:1,destinationName:'Receptor'},400);await move('SALE',{quantity:1,destinationName:''},400);
  await move('SALE',{quantity:1,destinationName:'Receptor'},404,'foreign');await move('SALE',{quantity:1,destinationName:'Receptor'},403,'cat');
  const stale=await call('owner','POST',`/waste-stock/lots/${lot.id}/movements`,{operationId:randomUUID(),expectedVersion:1,kind:'SALE',quantity:1,destinationName:'Receptor'},409);assert.match(stale.error,/alterado/);
  pass('Saída excessiva, descarte sem motivo, destinatário ausente, versão antiga e acesso indevido são bloqueados');
  const version=lot.version;
  const concurrency=await Promise.all([1,2].map(i=>app.inject({method:'POST',url:`/waste-stock/lots/${lot.id}/movements`,headers:{authorization:'Bearer '+app.jwt.sign({sub:users.owner.id,role:users.owner.role})},payload:{operationId:randomUUID(),expectedVersion:version,kind:'DIRECT_DESTINATION',quantity:10,destinationName:'Receptor concorrente '+i}})));
  assert.deepEqual(concurrency.map(r=>r.statusCode).sort(),[201,409]);lot=await p.wasteStockLot.findUniqueOrThrow({where:{id:lot.id}});assert.equal(Number(lot.availableQuantity),20);
  pass('Duas saídas simultâneas da mesma versão não gastam o mesmo saldo');
  await move('DONATION',{quantity:20,destinationName:'Associação destino QA'});assert.equal(lot.status,'DESTINED');assert.equal(Number(lot.availableQuantity),0);assert.equal(lot.processingStage,'DESTINADO');
  await move('RELEASE',{},409);await call('owner','PATCH',`/waste-stock/lots/${lot.id}`,{status:'AVAILABLE'},400);await call('owner','DELETE',`/waste-stock/lots/${lot.id}`,undefined,400);
  const history=await call('owner','GET',`/waste-stock/lots/${lot.id}/movements`);assert.equal(history.movements.length,6);assert.equal(history.movements.filter((m:any)=>['SALE','DONATION','DIRECT_DESTINATION'].includes(m.kind)).reduce((sum:number,m:any)=>sum+Number(m.quantity),0),50);
  const closed=await call('owner','GET',`/waste-workspace/inventory?view=closed&q=${encodeURIComponent(item.name)}`);assert.equal(closed.items.length,1);
  const summary=await call('owner','GET',`/waste-workspace/collections?q=${c.id}`);const dest=summary.collections[0].collectionWasteEntries[0].destinations[0];assert(dest.stockLot.movements.some((m:any)=>m.destinationName==='Associação destino QA'));assert.equal(Number(dest.stockLot.availableQuantity),0);
  pass('Saída total conclui lote, preserva destinatários das partes, mantém histórico e não reabre saldo por edição antiga');
  const mine=await call('cat','GET','/collections');const mineCollections=mine.collections||mine;const own=mineCollections.find((record:any)=>record.id===c.id);assert(own);assert.equal(own.collectionMaterials[0].unit,'LITER');assert.equal(Number(own.collectionMaterials[0].quantity),50);assert.equal(Number(own.totalWeightKg),0);
  pass('Histórico do catador contém a coleta de óleo com 50 litros; peso zero não apaga a coleta nem converte litros em kg');
  const direct=(await p.collection.create({data:{cooperativeId:coop.id,status:'RECEIVED',receivedAt:new Date(),collectedAt:new Date(),quantityReviewVersion:1,collectionMaterials:{create:{nameSnapshot:'Vidro QA',quantity:10,unit:'KG'}}},include:{collectionMaterials:true}}));
  const de=await p.collectionWasteEntry.create({data:{cooperativeId:coop.id,collectionId:direct.id,collectionMaterialId:direct.collectionMaterials[0].id,materialNameSnapshot:'Vidro QA',collectedQuantity:10,remainingQuantity:10,unit:'KG'}});
  const dd=(await call('owner','POST','/collection-waste-destinations',{operationId:randomUUID(),collectionWasteEntryId:de.id,type:'DIRECT_DESTINATION',quantity:10,unit:'KG',destinationName:'Destino de vidro QA'},201)).destination;
  const count=await p.collectionWasteDestinationEvent.count({where:{destinationId:dd.id}});
  await call('owner','PATCH',`/collection-waste-destinations/${dd.id}`,{notes:null});assert.equal(await p.collectionWasteDestinationEvent.count({where:{destinationId:dd.id}}),count);
  await call('owner','PATCH',`/collection-waste-destinations/${dd.id}`,{destinationDocument:'Documento novo QA'});assert.equal(await p.collectionWasteDestinationEvent.count({where:{destinationId:dd.id}}),count+1);
  const finalSummary=await call('owner','GET',`/waste-workspace/collections?q=${direct.id}`);assert.equal(finalSummary.collections[0].collectionWasteEntries[0].destinations[0].destinationName,'Destino de vidro QA');
  pass('Destino direto é retornado na lista sem saldo; salvamento sem mudança não cria auditoria redundante e alteração de documento é auditada');
  await p.wasteStockItem.update({where:{id:item.id},data:{status:'INACTIVE',isActive:false}});
  const inactiveLot=await p.wasteStockLot.create({data:{cooperativeId:coop.id,stockItemId:item.id,unit:'LITER',quantity:2,availableQuantity:2,status:'AVAILABLE'}});
  const inactiveExit=await call('owner','POST',`/waste-stock/lots/${inactiveLot.id}/movements`,{operationId:randomUUID(),expectedVersion:1,kind:'DIRECT_DESTINATION',quantity:2,destinationName:'Receptor de lote antigo'},201);assert.equal(inactiveExit.lot.status,'DESTINED');
  await p.wasteStockItem.update({where:{id:item.id},data:{status:'ACTIVE',isActive:true}});
  for(const unit of ['TON','UNIT','CUBIC_METER'] as const) {
    const unitItem=await p.wasteStockItem.create({data:{cooperativeId:coop.id,name:'Material '+unit,category:'Teste unidade',unit,defaultUnit:unit}});
    const unitLot=await p.wasteStockLot.create({data:{cooperativeId:coop.id,stockItemId:unitItem.id,unit,quantity:1.25,availableQuantity:1.25,status:'AVAILABLE'}});
    const result=await call('owner','POST',`/waste-stock/lots/${unitLot.id}/movements`,{operationId:randomUUID(),expectedVersion:1,kind:'DIRECT_DESTINATION',quantity:1.25,destinationName:'Receptor unidade '+unit},201);
    assert.equal(result.movement.unit,unit);assert.equal(Number(result.movement.quantity),1.25);assert.equal(Number(result.lot.availableQuantity),0);
  }
  const secondPage=await call('owner','GET',`/waste-stock/lots/${lot.id}/movements?page=2&limit=2`);assert.equal(secondPage.movements.length,2);assert.equal(secondPage.pagination.total,6);
  await call('foreign','GET',`/waste-stock/lots/${lot.id}/movements`,undefined,404);
  await call('cat','GET',`/waste-stock/lots/${lot.id}/movements`,undefined,403);
  pass('Lote antigo de catálogo inativo pode sair; toneladas, unidades e m³ preservam quantidade; histórico paginado mantém isolamento');
  // UI gets a fresh, movable 50 L lot without depending on production data.
  const uiLot=await p.wasteStockLot.create({data:{cooperativeId:coop.id,stockItemId:item.id,code:'UI-OLEO-50L',lotCode:'UI-OLEO-50L',unit:'LITER',quantity:50,availableQuantity:50,status:'AVAILABLE',processingStage:'TRIADO',origin:'Entrada manual QA'}});
  return {catToken:app.jwt.sign({sub:users.cat.id,role:users.cat.role}),catUser:{id:users.cat.id,role:users.cat.role,displayName:users.cat.displayName,email:users.cat.email,collector:{id:cat.id,name:cat.name,cooperativeId:coop.id}},oilCollection:c.id,oilLot:lot.id,item:item.id,direct:direct.id,entry:de.id,destination:dd.id,uiLot:uiLot.id};
}
