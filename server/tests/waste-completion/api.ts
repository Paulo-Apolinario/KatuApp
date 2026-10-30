import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { PrismaClient, WasteDestinationType } from "@prisma/client";
export async function checkWasteCompletion(app: FastifyInstance, p: PrismaClient, users: any, coop: any, pass: (name: string) => void) {
  async function call(who: string, method: any, url: string, payload?: any, status = 200) {
    const user = users[who];
    const response = await app.inject({method,url,payload,headers:{authorization:'Bearer '+app.jwt.sign({sub:user.id,role:user.role})}});
    assert.equal(response.statusCode,status,response.body);return response.json();
  }
  const item=await p.wasteStockItem.create({data:{cooperativeId:coop.id,name:'Papel política QA',category:'Reciclável',unit:'KG',defaultUnit:'KG'}});
  async function fixture(status: 'RECEIVED'|'SORTING'='RECEIVED', linked=false) {
    const schedule=linked ? await p.schedule.create({data:{cooperativeId:coop.id,requestedByUserId:users.owner.id,status:'IN_PROGRESS'}}) : null;
    const collection=await p.collection.create({data:{cooperativeId:coop.id,status,receivedAt:new Date(),collectedAt:new Date(),quantityReviewVersion:1,scheduleId:schedule?.id,collectionMaterials:{create:{nameSnapshot:item.name,quantity:10,unit:'KG',wasteTypeId:item.id}}},include:{collectionMaterials:true}});
    const entry=await p.collectionWasteEntry.create({data:{cooperativeId:coop.id,collectionId:collection.id,collectionMaterialId:collection.collectionMaterials[0].id,wasteTypeId:item.id,materialNameSnapshot:item.name,collectedQuantity:10,remainingQuantity:10,unit:'KG'}});
    return {collection,entry,schedule};
  }
  async function destination(entry: any,type: WasteDestinationType, quantity=10) {
    return (await call('owner','POST','/collection-waste-destinations',{operationId:randomUUID(),collectionWasteEntryId:entry.id,type,quantity,unit:'KG',destinationName:'Receptor QA',notes:'Justificativa QA',...(type==='STOCK'?{stockItemId:item.id}:{})},201)).destination;
  }
  for(const type of ['DIRECT_DESTINATION','REJECT','DISPOSAL','STOCK','TRIAGE','RESERVATION'] as WasteDestinationType[]) {
    const f=await fixture(type==='TRIAGE'?'SORTING':'RECEIVED',type==='DIRECT_DESTINATION');
    const d=await destination(f.entry,type);
    const result=(await call('owner','POST',`/collections/${f.collection.id}/complete`,{})).collection;
    assert.equal(result.status,'COMPLETED');assert.equal(result.completedByUserId,users.owner.id);
    assert.equal(Number((await p.collectionWasteEntry.findUniqueOrThrow({where:{id:f.entry.id}})).remainingQuantity),0);
    if(f.schedule) assert.equal((await p.schedule.findUniqueOrThrow({where:{id:f.schedule.id}})).status,'COMPLETED');
    if(type==='TRIAGE'||type==='RESERVATION') {
      const pending=await call('owner','GET','/waste-workspace/collections?stage=destination');assert(pending.collections.some((c:any)=>c.id===f.collection.id));
      const overview=await call('owner','GET','/dashboard/operations');assert(overview.data.intermediateEntries>0);
      await call('owner','POST',`/collection-waste-destinations/${d.id}/cancel`,{reason:'Teste impedido',operationId:randomUUID()},409);
      const converted=(await call('owner','PATCH',`/collection-waste-destinations/${d.id}`,{operationId:randomUUID(),expectedVersion:d.version,type:'DIRECT_DESTINATION',destinationName:'Receptor final QA'})).destination;
      assert.equal(converted.type,'DIRECT_DESTINATION');
      assert.equal((await p.collection.findUniqueOrThrow({where:{id:f.collection.id}})).completedAt?.toISOString(),new Date(result.completedAt).toISOString());
      assert.equal(await p.collectionWasteDestinationEvent.count({where:{destinationId:d.id}}),2);
      await call('owner','PATCH',`/collection-waste-destinations/${d.id}`,{type:'TRIAGE',destinationName:'Retorno indevido'},409);
      const follow=await call('owner','GET',`/waste-workspace/collections?stage=follow-up&q=${f.collection.id}`);assert.equal(follow.collections.length,0);
    } else {
      await call('owner','PATCH',`/collection-waste-destinations/${d.id}`,{notes:'Mudança após encerramento'},409);
    }
    if(type==='STOCK') {
      assert(d.stockLotId);
      const follow=await call('owner','GET',`/waste-workspace/collections?stage=follow-up&q=${f.collection.id}`);assert.equal(follow.collections.length,1);
      const finals=await call('owner','GET',`/collection-waste-destinations?flow=final&collectionId=${f.collection.id}`);assert.equal(finals.destinations.length,0);
      const stockFinal=await call('owner','GET',`/collection-waste-destinations?flow=final&type=STOCK&collectionId=${f.collection.id}`);assert.equal(stockFinal.destinations.length,0);
      await p.wasteStockLot.update({where:{id:d.stockLotId},data:{status:'SOLD',availableQuantity:0}});
      const soldFinal=await call('owner','GET',`/collection-waste-destinations?flow=final&type=STOCK&collectionId=${f.collection.id}`);assert.equal(soldFinal.destinations.length,1);
      const soldFollow=await call('owner','GET',`/waste-workspace/collections?stage=follow-up&q=${f.collection.id}`);assert.equal(soldFollow.collections.length,0);
    }
    pass(`${type}: conclui coleta sem saldo; material mantém seu fluxo e histórico corretos`);
  }
  const mixed=await fixture();
  const triage=await destination(mixed.entry,'TRIAGE',6);await destination(mixed.entry,'DIRECT_DESTINATION',4);
  assert.equal((await p.collectionWasteEntry.findUniqueOrThrow({where:{id:mixed.entry.id}})).status,'SENT_TO_TRIAGE');
  await call('owner','POST',`/collections/${mixed.collection.id}/complete`,{});
  await call('owner','PATCH',`/collection-waste-destinations/${triage.id}`,{type:'STOCK',stockItemId:item.id});
  assert.equal((await p.collectionWasteEntry.findUniqueOrThrow({where:{id:mixed.entry.id}})).status,'ADDED_TO_STOCK');
  assert.equal(await p.wasteStockLot.count({where:{originCollectionWasteEntryId:mixed.entry.id}}),1);
  pass('Material dividido entre triagem e destino final preserva pendência; conversão em estoque cria um único lote após concluir a coleta');
  const notReady=await fixture();await destination(notReady.entry,'DIRECT_DESTINATION',5);
  await call('owner','POST',`/collections/${notReady.collection.id}/complete`,{},409);
  await destination(notReady.entry,'DIRECT_DESTINATION',5);
  await p.collection.update({where:{id:notReady.collection.id},data:{quantityReviewVersion:0}});
  await call('owner','POST',`/collections/${notReady.collection.id}/complete`,{},409);
  await p.collection.update({where:{id:notReady.collection.id},data:{quantityReviewVersion:1}});
  const incident=await p.collectionIncident.create({data:{collectionId:notReady.collection.id,cooperativeId:coop.id,reportedByUserId:users.owner.id,description:'Ocorrência teste'}});
  await call('owner','POST',`/collections/${notReady.collection.id}/complete`,{},409);
  await p.collectionIncident.delete({where:{id:incident.id}});
  await call('cat','POST',`/collections/${notReady.collection.id}/complete`,{},403);
  await call('foreign','POST',`/collections/${notReady.collection.id}/complete`,{},404);
  pass('Saldo parcial, conferência ausente, ocorrência aberta e acesso indevido continuam bloqueados');
  const refs=await fixture('RECEIVED',true);const rd=await destination(refs.entry,'DIRECT_DESTINATION');
  for(const code of [refs.collection.id,refs.collection.id.slice(-8).toUpperCase(),'#'+refs.collection.id.slice(-8).toUpperCase(),refs.schedule!.id,'#'+refs.schedule!.id.slice(-8).toUpperCase()]) {
    for(const endpoint of ['/waste-workspace/collections?q=','/waste-workspace/field-collections?q=','/collection-entries?search=','/collection-waste-destinations?search=']) {
      const found=await call('owner','GET',endpoint+encodeURIComponent(code));
      const list=found.collections||found.entries||found.destinations;assert(list.length>0,endpoint+code);
      if(found.collections)assert(list.some((c:any)=>c.id===refs.collection.id));
      if(found.destinations)assert(list.some((d:any)=>d.id===rd.id));
      const foreign=await call('foreign','GET',endpoint+encodeURIComponent(code));assert.equal((foreign.collections||foreign.entries||foreign.destinations).length,0);
    }
  }
  pass('Busca por código curto com/sem #, ID completo e solicitação vinculada funciona em quatro listas e respeita cooperativa');
  const page=await call('owner','GET',`/waste-workspace/collections?q=${refs.collection.id}`);assert.equal(page.collections[0].scheduleId,refs.schedule!.id);
  const ready=await call('owner','GET',`/waste-workspace/collections?stage=ready&q=${refs.collection.id}`);assert.equal(ready.collections.length,1);
  pass('Lista retorna referência da solicitação e filtro A concluir encontra material todo encaminhado');
  const ui=await fixture('RECEIVED',true);await destination(ui.entry,'DIRECT_DESTINATION');
  const intermediate=await fixture();const intermediateDestination=await destination(intermediate.entry,'RESERVATION');await call('owner','POST',`/collections/${intermediate.collection.id}/complete`,{});
  return {direct:ui.collection.id,request:ui.schedule!.id,entry:ui.entry.id,intermediate:intermediate.collection.id,intermediateDestination:intermediateDestination.id};
}
