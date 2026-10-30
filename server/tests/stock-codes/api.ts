import assert from 'node:assert/strict';
import type {FastifyInstance} from 'fastify';import type {PrismaClient} from '@prisma/client';
export async function checkStockCodes(app:FastifyInstance,p:PrismaClient,users:any,coop:any,pass:(name:string)=>void){
 const call=async(method:any,url:string,payload?:any,status=200)=>{const r=await app.inject({method,url,payload,headers:{authorization:'Bearer '+app.jwt.sign({sub:users.owner.id,role:users.owner.role})}});assert.equal(r.statusCode,status,r.body);return r.json();};
 const item=(await call('POST','/waste-stock/items',{name:'Óleo códigos QA',category:'Óleo',unit:'LITER'},201)).item;assert.match(item.internalCode,/^MAT-\d{8}-[A-F0-9]{16}$/);
 const lot=(await call('POST',`/waste-stock/items/${item.id}/lots`,{quantity:50,unit:'LITER',origin:'Entrada de teste'},201)).lot;assert.match(lot.lotCode,/^LOT-\d{8}-[A-F0-9]{16}$/);
 const second=(await call('POST',`/waste-stock/items/${item.id}/lots`,{quantity:1,lotCode:'',unit:'LITER',origin:'Outra entrada'},201)).lot;assert.notEqual(second.lotCode,lot.lotCode);
 pass('Material e lotes recebem códigos automáticos ao omitir ou deixar o código vazio');
 await call('PATCH',`/waste-stock/items/${item.id}`,{internalCode:null,description:'Conferido'});assert.equal((await p.wasteStockItem.findUniqueOrThrow({where:{id:item.id}})).internalCode,item.internalCode);
 const legacy=await p.wasteStockItem.create({data:{cooperativeId:coop.id,name:'Material sem código QA',category:'Teste',unit:'KG'}});
 await call('POST',`/waste-stock/items/${legacy.id}/lots`,{quantity:1,unit:'KG',origin:'Lote de material antigo'},201);
 assert.match((await p.wasteStockItem.findUniqueOrThrow({where:{id:legacy.id}})).internalCode!,/^MAT-/);
 const filled=(await call('PATCH',`/waste-stock/items/${legacy.id}`,{description:'Revisado'})).item;assert.match(filled.internalCode,/^MAT-/);
 const custom=(await call('POST','/waste-stock/items',{name:'Material código existente QA',category:'Teste',unit:'KG',internalCode:'COD-EXISTENTE'},201)).item;
 await call('PATCH',`/waste-stock/items/${custom.id}`,{description:'Revisado'});assert.equal((await p.wasteStockItem.findUniqueOrThrow({where:{id:custom.id}})).internalCode,'COD-EXISTENTE');
 pass('Edição preserva códigos existentes e preenche o código de um cadastro antigo ainda sem identificação');
 const lots=await Promise.all(Array.from({length:4},(_,i)=>call('POST',`/waste-stock/items/${item.id}/lots`,{quantity:i+1,unit:'LITER',origin:'Entrada concorrente'},201)));
 assert.equal(new Set(lots.map(r=>r.lot.lotCode)).size,4);pass('Criações simultâneas recebem códigos de lote distintos');
 const collection=await p.collection.create({data:{cooperativeId:coop.id,status:'RECEIVED',quantityReviewVersion:1,receivedAt:new Date(),collectedAt:new Date(),collectionMaterials:{create:{nameSnapshot:'Vidro botões QA',quantity:10,unit:'KG'}}},include:{collectionMaterials:true}});
 const entry=await p.collectionWasteEntry.create({data:{cooperativeId:coop.id,collectionId:collection.id,collectionMaterialId:collection.collectionMaterials[0].id,materialNameSnapshot:'Vidro botões QA',collectedQuantity:10,remainingQuantity:10,unit:'KG'}});
 const classified=await call('POST',`/waste-workspace/entries/${entry.id}/catalog`,{name:'Vidro botões QA',category:'Vidro',unit:'KG'});assert.match(classified.item.internalCode,/^MAT-/);
 await call('POST','/collection-waste-destinations',{operationId:crypto.randomUUID(),collectionWasteEntryId:entry.id,type:'STOCK',quantity:10,unit:'KG',stockItemId:classified.item.id},201);
 pass('Material criado durante a destinação também recebe código; lote rastreável continua automático');
 return {item:item.id,lot:lot.id,collection:collection.id,entry:entry.id};
}
