import assert from "node:assert/strict";
import { prisma } from "../../src/lib/prisma";
export async function documentSearchTests(call:any,manager:string,collector:string,foreign:string,test:any){
 const createdAt=new Date("2026-11-06T13:00:00Z");
 const snap={dispatch:{materialName:"Papelão reciclado",quantity:"400.000",unit:"KG",destinationName:"Recicladora São José",movementDate:"2026-11-06T12:00:00Z",kind:"SALE",operationId:"protocol-search-qa",allocations:[{lotId:"historic-first",lotCode:"LOTE-101",quantity:"370.000",before:"370.000",after:"0.000"},{lotId:"historic-partial",lotCode:"LOTE-102",quantity:"30.000",before:"60.000",after:"30.000"}]}};
 const doc=await prisma.internalDocument.create({data:{cooperativeId:"coop",number:"SAI-SEARCH-QA",kind:"STOCK_DISPATCH",eventKey:"SEARCH-QA",createdAt,snapshot:snap}});
 await prisma.internalDocument.create({data:{cooperativeId:"other",number:"SAI-FOREIGN-QA",kind:"STOCK_DISPATCH",eventKey:"SEARCH-QA",createdAt,snapshot:snap}});
 const get=(query:string,who=manager)=>call("GET","/internal-documents?"+query,undefined,who);
 const ok=(r:any,status=200)=>assert.equal(r.status,status,JSON.stringify(r.body));
 await test("lista de saída identifica material, quantidade, destinatário e lotes sem carregar snapshot completo",async()=>{
   const r=await get("operation=STOCK_EXIT&q=SAI-SEARCH-QA");ok(r);assert.equal(r.body.documents.length,1);
   const d=r.body.documents[0];assert.equal(d.id,doc.id);assert.equal(d.context.materials[0].name,"Papelão reciclado");assert.equal(d.context.materials[0].quantity,"400.000");assert.equal(d.context.destinationName,"Recicladora São José");assert.equal(d.context.lotCount,2);assert.equal(d.context.lots[1].code,"LOTE-102");assert.equal(d.orders.length,0);assert(!("snapshot" in d));
 });
 await test("busca cruza material e destinatário com acentos e caixa normalizados",async()=>{
   for(const q of ["PAPELAO","sao jose","papelao sao jose","Recicladora São José"]){const r=await get("operation=STOCK_EXIT&q="+encodeURIComponent(q));ok(r);assert(r.body.documents.some((d:any)=>d.id===doc.id));assert(!r.body.documents.some((d:any)=>d.number==="SAI-FOREIGN-QA"));}
 });
 await test("busca e filtro de lote encontram comprovante consolidado sem lotId principal",async()=>{
   for(const q of ["q=lote-102","lotId=historic-partial"]){const r=await get("operation=STOCK_EXIT&"+q);ok(r);assert(r.body.documents.some((d:any)=>d.id===doc.id));}
 });
 await test("filtros de tipo, operação e data são combinados e paginação preserva todos os resultados",async()=>{
   const r=await get("operation=STOCK_EXIT&kind=STOCK_DISPATCH&dateFrom=2026-11-06&dateTo=2026-11-06&q=SAI-SEARCH-QA&limit=1");ok(r);assert.equal(r.body.pagination.total,1);assert.equal(r.body.documents[0].id,doc.id);
   const none=await get("operation=COLLECTION&kind=STOCK_DISPATCH&q=SAI-SEARCH-QA");ok(none);assert.equal(none.body.pagination.total,0);
   const old=await get("dateTo=2026-11-05&q=SAI-SEARCH-QA");ok(old);assert.equal(old.body.pagination.total,0);
   const second=await get("q=SAI-SEARCH-QA&limit=1&page=2");ok(second);assert.equal(second.body.documents.length,0);assert.equal(second.body.pagination.total,1);
 });
 await test("O.S. apresenta tipos e saídas vinculadas, mantendo o download da programação",async()=>{
   const r=await call("GET","/service-orders?operation=STOCK_EXIT&q=Recicladora",undefined,manager);ok(r);
   const order=r.body.orders.find((o:any)=>o.number==="OS-DISPATCH-QA");assert(order);assert(order.stockExitCount>0);assert(order.documentTypes.some((t:any)=>t.kind==="STOCK_DISPATCH"));
   for(const d of order.documents)assert(!d.document.kind||d.document.kind==="SERVICE_ORDER");
   const scoped=await get("operation=STOCK_EXIT&serviceOrderId="+order.id);ok(scoped);assert(scoped.body.documents.length>0);assert(scoped.body.documents.every((d:any)=>d.orders.some((l:any)=>l.serviceOrder.id===order.id)));
 });
 await test("leitura de documentos e busca mantém autenticação e isolamento entre cooperativas",async()=>{
   ok(await get("operation=STOCK_EXIT",collector),403);ok(await get("q=SAI-SEARCH-QA",""),401);
   const r=await get("q=SAI-SEARCH-QA",foreign);ok(r);assert.equal(r.body.documents.length,0);
   ok(await call("GET","/internal-documents/"+doc.id,undefined,foreign),404);
   const list=await call("GET","/service-orders?q=SAI-SEARCH-QA",undefined,foreign);ok(list);assert.equal(list.body.orders.length,0);
 });
 await test("caracteres SQL e curingas são tratados como texto literal da busca",async()=>{
   for(const term of ["%","_","' OR 1=1 --","\\"]){const r=await get("q="+encodeURIComponent(term));ok(r);assert.equal(r.body.documents.length,0,term);}
 });
 await test("documentos legados sem campos novos continuam listados e visíveis",async()=>{
   const legacy=await prisma.internalDocument.create({data:{cooperativeId:"coop",number:"LEGACY-SEARCH-QA",kind:"RECEIVING_RECEIPT",eventKey:"LEGACY-SEARCH-QA",snapshot:{collections:[{id:"legacy-c",origin:"Origem Antiga",materials:[{name:"Óleo vegetal",unit:"LITER",quantity:80}]}]}}});
   const r=await get("q=oleo vegetal");ok(r);assert(r.body.documents.some((d:any)=>d.id===legacy.id));
   const d=r.body.documents.find((d:any)=>d.id===legacy.id);assert.equal(d.context.materials[0].unit,"LITER");assert.equal(d.context.materials[0].quantity,80);
   const detail=await call("GET","/internal-documents/"+legacy.id,undefined,manager);ok(detail);assert(detail.body.document.snapshot.collections);
 });
}
