import assert from "node:assert/strict";
import { prisma } from "../../src/lib/prisma";
export async function documentGroupTests(call:any,manager:string,collector:string,foreign:string,test:any){
 const collection=await prisma.collection.findFirstOrThrow({where:{cooperativeId:"coop"}});
 const order=await prisma.serviceOrder.create({data:{cooperativeId:"coop",number:"OS-GROUP-QA",sourceKey:"GROUP-QA",sourceType:"COLLECTION",sourceId:collection.id}});
 const base={cooperativeId:"coop",createdAt:new Date("2026-11-06T16:00:00Z")};
 const allocation=(id:string,n:number)=>({lotId:`grp-lot-${id}`,lotCode:`GRP-LOTE-${id}`,movementId:`grp-move-${id}`,originCollectionId:collection.id,quantity:String(n),before:String(n+20),after:"20"});
 const a=allocation("1",30), b=allocation("2",70), c=allocation("3",50);
 const createParent=async(number:string,allocations:any[],total:number)=>prisma.internalDocument.create({data:{...base,number,kind:"STOCK_DISPATCH",eventKey:number,snapshot:{dispatch:{materialName:"Papelão Grupo QA",quantity:String(total),unit:"KG",destinationName:"Destino Grupo QA",allocations}},orders:{create:{serviceOrderId:order.id}}}});
 const parent=await createParent("PARENT-GRPCASE-1",[a,b],100),other=await createParent("PARENT-GRPCASE-2",[c],50);
 const child=async(a:any)=>prisma.internalDocument.create({data:{...base,createdAt:new Date("2026-11-06T16:00:01Z"),number:`CHILD-GRPCASE-${a.lotId}`,kind:"TRANSPORT_RECORD",eventKey:a.movementId,lotId:a.lotId,movementId:a.movementId,snapshot:{material:"Papelão Grupo QA",lot:{id:a.lotId,code:a.lotCode},movement:{quantity:a.quantity,unit:"KG",destinationName:"Destino Grupo QA"}},orders:{create:{serviceOrderId:order.id}}}});
 const first=await child(a),second=await child(b),third=await child(c);
 const single=await prisma.internalDocument.create({data:{...base,number:"SINGLE-GRPCASE",kind:"TRANSPORT_RECORD",eventKey:"SINGLE-GRPCASE",movementId:"single-unrelated",lotId:"single-lot",snapshot:{material:"Papelão Grupo QA",movement:{quantity:100,unit:"KG",destinationName:"Destino Grupo QA"}}}});
 const get=(q:string,who=manager)=>call("GET","/internal-documents?"+q,undefined,who);
 const ok=(r:any,status=200)=>assert.equal(r.status,status,JSON.stringify(r.body));
 await test("agrupamento usa movimentos exatos: mesma data/material/destino não fundem saídas distintas",async()=>{
   const r=await get("operation=STOCK_EXIT&grouped=1&q=GRPCASE");ok(r);assert.equal(r.body.pagination.total,3);assert.deepEqual(new Set(r.body.documents.map((d:any)=>d.id)),new Set([parent.id,other.id,single.id]));
 });
 await test("paginação conta destinações antes de paginar e não perde consolidados nem saídas avulsas",async()=>{
   const seen=[];for(let page=1;page<=3;page++){const r=await get(`operation=STOCK_EXIT&grouped=1&q=GRPCASE&limit=1&page=${page}`);ok(r);assert.equal(r.body.pagination.totalPages,3);assert.equal(r.body.documents.length,1);seen.push(r.body.documents[0].id);}assert.equal(new Set(seen).size,3);
 });
 await test("busca pelo comprovante individual e pelo lote retorna seu consolidado",async()=>{
   const byNumber=await get("operation=STOCK_EXIT&grouped=1&q="+encodeURIComponent(second.number));ok(byNumber);assert.deepEqual(byNumber.body.documents.map((d:any)=>d.id),[parent.id]);
   const byLot=await get("operation=STOCK_EXIT&grouped=1&lotId="+b.lotId);ok(byLot);assert.deepEqual(byLot.body.documents.map((d:any)=>d.id),[parent.id]);
 });
 await test("expansão retorna todos os lotes, retiradas, saldos e os comprovantes correspondentes",async()=>{
   const r=await call("GET",`/internal-documents/${parent.id}/lots`,undefined,manager);ok(r);assert.equal(r.body.lots.length,2);assert.deepEqual(r.body.lots.map((l:any)=>[l.lotCode,l.quantity,l.before,l.after]),[[a.lotCode,"30","50","20"],[b.lotCode,"70","90","20"]]);assert.equal(r.body.lots[0].documents[0].id,first.id);assert.equal(r.body.lots[1].documents[0].id,second.id);assert(!r.body.lots.flatMap((l:any)=>l.documents).some((d:any)=>d.id===third.id));
 });
 await test("O.S. distingue quantidade de destinações do total de documentos e detalhes ocultam filhos agrupados",async()=>{
   const orders=await call("GET","/service-orders?q=OS-GROUP-QA",undefined,manager);ok(orders);assert.equal(orders.body.orders[0].stockExitCount,5);assert.equal(orders.body.orders[0].stockOperationCount,2);
   const details=await call("GET",`/service-orders/${order.id}?grouped=1`,undefined,manager);ok(details);assert.deepEqual(new Set(details.body.documents.map((d:any)=>d.id)),new Set([parent.id,other.id]));
 });
 await test("compatibilidade mantém documentos individuais ao consultar sem grupo ou pelo tipo específico",async()=>{
   const flat=await get("operation=STOCK_EXIT&q=GRPCASE");ok(flat);assert.equal(flat.body.pagination.total,6);
   const byType=await get("operation=STOCK_EXIT&grouped=1&kind=TRANSPORT_RECORD&q=GRPCASE");ok(byType);assert.equal(byType.body.pagination.total,4);
 });
 await test("expansão não aplica o limite de seis lotes do resumo",async()=>{
   const lots=Array.from({length:8},(_,i)=>({lotId:`big-${i}`,lotCode:`BIG-${i}`,movementId:`big-move-${i}`,quantity:"1",before:"2",after:"1"}));
   const root=await prisma.internalDocument.create({data:{...base,number:"PARENT-BIG-DETAIL-QA",kind:"STOCK_DISPATCH",eventKey:"BIG-DETAIL-QA",snapshot:{dispatch:{unit:"KG",quantity:"8",materialName:"Papel",allocations:lots}}}});
   const r=await call("GET",`/internal-documents/${root.id}/lots`,undefined,manager);ok(r);assert.equal(r.body.lots.length,8);assert.equal(r.body.lots[7].lotCode,"BIG-7");
 });
 await test("expansão exige sessão e cooperativa proprietária, sem acesso a outros grupos",async()=>{
   ok(await call("GET",`/internal-documents/${parent.id}/lots`,undefined,collector),403);ok(await call("GET",`/internal-documents/${parent.id}/lots`,undefined,foreign),404);ok(await call("GET",`/internal-documents/${parent.id}/lots`,undefined,""),401);ok(await call("GET",`/internal-documents/${first.id}/lots`,undefined,manager),404);
   const r=await get("operation=STOCK_EXIT&grouped=1&q=GRPCASE",foreign);ok(r);assert.equal(r.body.pagination.total,0);
 });
}
