import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { prisma } from "../../src/lib/prisma";
import { buildApp } from "../../src/app";
async function main(){
 const db=new URL(process.env.DATABASE_URL||"");if(db.hostname!=="127.0.0.1"||db.port!=="54351"||process.env.KATUA_SIMULATION_TEST!=="1")throw Error("Somente banco descartável.");
 let externalCalls=0;global.fetch=async()=>{externalCalls++;throw Error("Chamada externa proibida no simulador.");};
 const app=await buildApp();
 try{
 for(const [id,role] of [["admin","ADMIN"],["a","COOPERATIVE"],["b","COOPERATIVE"],["cat","COLLECTOR"],["pf","PF"]] as const)await prisma.user.create({data:{id,email:id+"@qa.invalid",displayName:id,passwordHash:"unused-local",role}});
 for(const id of ["a","b"])await prisma.cooperative.create({data:{id:"coop-"+id,userId:id,name:id==="a"?"CoopApolinario":"Cooperativa B QA"}});
 await prisma.collector.create({data:{id:"collector",userId:"cat",cooperativeId:"coop-a",name:"Catador QA"}});
 const item=await prisma.wasteStockItem.create({data:{cooperativeId:"coop-a",name:"Papelão operacional preservado",category:"Papel"}});
 await prisma.wasteStockLot.create({data:{id:"real-lot",cooperativeId:"coop-a",stockItemId:item.id,quantity:900,availableQuantity:900,version:7}});
 const real=async()=>JSON.stringify({lots:await prisma.wasteStockLot.findMany(),movements:await prisma.wasteStockMovement.count(),collections:await prisma.collection.count(),materials:await prisma.collectionMaterial.count(),entries:await prisma.collectionWasteEntry.count(),documents:await prisma.internalDocument.count(),environmental:await prisma.environmentalDocument.count(),orders:await prisma.serviceOrder.count()});
 const before=await real(),tokens=new Map<string,string>();
 const call=async(who:string,method:"GET"|"POST",url:string,payload?:any,status=200)=>{
  if(who&&!tokens.has(who)){const u=await prisma.user.findUniqueOrThrow({where:{id:who}});tokens.set(who,app.jwt.sign({sub:who,role:u.role,authVersion:u.authVersion}));}
  const response=await app.inject({method,url,payload,headers:who?{authorization:"Bearer "+tokens.get(who)}:{}});assert.equal(response.statusCode,status,response.body);return response.json();
 };
 const path="/simulation/workspaces/coop-a";
 assert.equal((await call("a","GET","/simulation/context")).workspace,null);
 await call("","GET",path,undefined,401);await call("b","GET",path,undefined,404);await call("cat","GET",path,undefined,403);await call("pf","GET",path,undefined,403);
 await call("a","POST",path+"/enable",{enabled:true},403);
 let data=await call("admin","POST",path+"/enable",{enabled:true});assert(data.workspace.enabled);assert.equal(data.workspace.state.lots.filter((l:any)=>l.materialId==="paper").reduce((n:number,l:any)=>n+Number(l.available),0),500);
 const initialVersion=data.workspace.version;data=await call("admin","POST",path+"/enable",{enabled:true});assert.equal(data.workspace.version,initialVersion);
 const baseSale={buyerId:"buyer-demo",lines:[{materialId:"paper",unit:"KG",quantity:400,unitPrice:.8}],transport:{driver:"Motorista demonstrativo",vehicle:"SIM-0001"}};
 const preview=await call("a","POST",path+"/preview",baseSale);assert.equal(preview.total,"320.00");assert.deepEqual(preview.preview.map((a:any)=>a.quantity),["200.000","170.000","30.000"]);assert.equal(preview.preview[2].after,"100.000");
 const act=async(action:any,status=200)=>{const body={operationId:randomUUID(),expectedVersion:data.workspace.version,...action};const result=await call("a","POST",path+"/actions",body,status);if(status===200)data=result;return {body,result};};
 const created=await act({action:"CREATE_SALE",sale:baseSale});const saleId=created.result.result.saleId;
 assert.equal(data.workspace.state.lots[0].available,"200.000");assert.equal(data.workspace.state.sales[0].stage,"DRAFT");
 const replay=await call("a","POST",path+"/actions",created.body);assert(replay.replayed);assert.equal(replay.workspace.state.sales.length,1);
 await call("a","POST",path+"/actions",{...created.body,sale:{...baseSale,lines:[{...baseSale.lines[0],quantity:401}]}},409);
 await call("admin","POST",path+"/actions",created.body,409);
 await act({action:"DISPATCH",saleId},409);await act({action:"ISSUE_DOCUMENT",saleId,type:"CDF",outcome:"APPROVED"},409);
 await act({action:"ISSUE_DOCUMENT",saleId,type:"NFE",outcome:"REJECTED"});assert.equal(data.workspace.state.sales[0].documents.length,1);
 const lost=await act({action:"ISSUE_DOCUMENT",saleId,type:"NFE",outcome:"UNCERTAIN"});const pendingId=data.workspace.state.sales[0].documents[1].id;
 assert((await call("a","POST",path+"/actions",lost.body)).replayed);assert.equal(data.workspace.state.sales[0].documents.length,2);
 await act({action:"ISSUE_DOCUMENT",saleId,type:"NFE",outcome:"APPROVED"},409);
 await act({action:"CHECK_DOCUMENT",saleId,documentId:pendingId});assert.equal(data.workspace.state.sales[0].documents[1].status,"APPROVED");assert.equal(data.workspace.state.sales[0].documents.length,2);
 await act({action:"ISSUE_DOCUMENT",saleId,type:"MTR",outcome:"APPROVED"});
 const competing=(await act({action:"CREATE_SALE",sale:{...baseSale,lines:[{...baseSale.lines[0],quantity:450}]}})).result.result.saleId;
 await act({action:"ISSUE_DOCUMENT",saleId:competing,type:"NFE",outcome:"APPROVED"});await act({action:"ISSUE_DOCUMENT",saleId:competing,type:"MTR",outcome:"APPROVED"});
 const dispatch=await act({action:"DISPATCH",saleId});assert.equal(data.workspace.state.lots[2].available,"100.000");assert.equal(data.workspace.state.lots[0].available,"0.000");
 const version=data.workspace.version;await call("a","POST",path+"/actions",{operationId:randomUUID(),expectedVersion:version-1,action:"PAYMENT",saleId,amount:1,method:"PIX"},409);
 assert((await call("a","POST",path+"/actions",dispatch.body)).replayed);assert.equal((await call("a","GET",path)).workspace.state.lots[2].available,"100.000");
 await act({action:"DISPATCH",saleId:competing},409);assert.equal((await call("a","GET",path)).workspace.version,version);
 await act({action:"RECEIVE",saleId,quantities:[{materialId:"paper",quantity:350}],notes:""},400);
 await act({action:"RECEIVE",saleId,quantities:[{materialId:"paper",quantity:350}],notes:"Divergência de pesagem simulada."});
 await act({action:"ISSUE_DOCUMENT",saleId,type:"CDF",outcome:"APPROVED"});assert.equal(data.workspace.state.sales[0].documents.at(-1).saleSnapshot.lines[0].quantity,"350.000");assert.equal(data.workspace.state.sales[0].lines[0].quantity,"400.000");
 await act({action:"PAYMENT",saleId,amount:100,method:"PIX"});await act({action:"PAYMENT",saleId,amount:221,method:"PIX"},400);await act({action:"PAYMENT",saleId,amount:220,method:"TRANSFER"});assert.equal(data.workspace.state.sales[0].payments.length,2);
 await act({action:"CANCEL_NFE",saleId});assert.equal(data.workspace.state.lots[2].available,"100.000");assert.equal(data.workspace.state.sales[0].stage,"RECEIVED");
 await act({action:"CREATE_SALE",sale:{...baseSale,lines:[{materialId:"pet",unit:"KG",quantity:3,unitPrice:.3333},{materialId:"oil",unit:"LITER",quantity:5,unitPrice:2} ]}});assert.equal(data.workspace.state.sales.at(-1).total,"11.00");assert.equal(data.workspace.state.sales.at(-1).preview.at(-1).unit,"LITER");
 await act({action:"CREATE_SALE",sale:{...baseSale,lines:[{...baseSale.lines[0],unit:"TON",quantity:1}]}},400);
 await act({action:"CREATE_SALE",sale:{...baseSale,lines:[{...baseSale.lines[0],quantity:.0001}]}},400);
 const withoutPrice=(await act({action:"CREATE_SALE",sale:{...baseSale,lines:[{...baseSale.lines[0],quantity:10,unitPrice:0}]}})).result.result.saleId;
 await act({action:"ISSUE_DOCUMENT",saleId:withoutPrice,type:"NFE",outcome:"APPROVED"},400);
 await act({action:"PREPARE_NOTE",saleId:withoutPrice,prices:[{materialId:"paper",unitPrice:.85}]});assert.equal(data.workspace.state.sales.at(-1).total,"8.50");
 await act({action:"ISSUE_DOCUMENT",saleId:withoutPrice,type:"NFE",outcome:"APPROVED"});
 await act({action:"PREPARE_NOTE",saleId:withoutPrice,prices:[{materialId:"paper",unitPrice:.9}]},409);
 assert.equal((await call("b","GET","/simulation/context")).workspace,null);
 data=await call("admin","POST",path+"/enable",{enabled:false});assert(!data.workspace.enabled);await act({action:"ADD_BUYER",buyer:{name:"Bloqueado"}},403);
 data=await call("admin","POST",path+"/enable",{enabled:true});assert.equal(data.workspace.state.lots[2].available,"100.000");
 assert.equal(await real(),before);assert.equal(externalCalls,0);
 for(const s of data.workspace.state.sales)for(const d of s.documents){assert(d.id.startsWith("SIM-"));assert(!/^\d{44}$/.test(d.id));}
 const oldState=JSON.parse(JSON.stringify(data.workspace.state));
 const resetBody={operationId:randomUUID(),expectedVersion:data.workspace.version,action:"RESET",confirm:true};
 await call("b","POST",path+"/actions",resetBody,404);await call("cat","POST",path+"/actions",resetBody,403);
 await call("a","POST",path+"/actions",{...resetBody,confirm:false},400);
 await call("a","POST",path+"/actions",{...resetBody,expectedVersion:data.workspace.version-1},409);
 data=await call("a","POST",path+"/actions",resetBody);
 assert.equal(data.workspace.state.sales.length,0);assert.equal(data.workspace.state.buyers.length,1);assert.equal(data.workspace.state.generation,2);
 assert.equal(data.workspace.state.lots.filter((l:any)=>l.materialId==="paper").reduce((n:number,l:any)=>n+Number(l.available),0),500);
 assert.equal(data.workspace.enabled,true);assert(!JSON.stringify(data).includes('archivedState'));
 const archive=await prisma.simulationEvent.findUniqueOrThrow({where:{workspaceId_operationId:{workspaceId:data.workspace.id,operationId:resetBody.operationId}}});assert.deepEqual((archive.result as any).archivedState,oldState);
 assert.deepEqual((await call("a","GET",path)).workspace.state,data.workspace.state);
 assert.equal((await call("b","GET","/simulation/context")).workspace,null);
 const fresh=(await act({action:"CREATE_SALE",sale:baseSale})).result.result.saleId;assert.equal(fresh,"SIM-VENDA-2-1");
 const repeat=await call("a","POST",path+"/actions",resetBody);assert(repeat.replayed);assert.equal(repeat.workspace.state.sales.length,1);assert.equal(repeat.workspace.state.generation,2);assert(!JSON.stringify(repeat).includes('archivedState'));
 await call("admin","POST",path+"/actions",resetBody,409);assert.equal(await real(),before);assert.equal(externalCalls,0);
 console.log("PASS: reinício com confirmação, versão, segregação e arquivo técnico; replay não apaga novo cenário; estoque real intacto");
 console.log("PASS: habilitação ADMIN, isolamento entre cooperativas, estoque/vendas/compradores demonstrativos separados, cálculo parcial por lote e dinheiro decimal");
 console.log("PASS: rejeição, consulta após resposta perdida sem duplicar, concorrência, rollback por falta de saldo, recebimento divergente, CDF, pagamento parcial e cancelamento sem devolver estoque");
 console.log("PASS: estoque/documentos/coletas reais preservados, kg e litros separados, desabilitação sem apagar histórico e zero chamadas externas");
 if(process.env.KATUA_SIMULATION_BROWSER){
   await prisma.user.create({data:{id:"ui",email:"ui@qa.invalid",displayName:"CoopApolinario UI",passwordHash:"unused",role:"COOPERATIVE"}});
   await prisma.cooperative.create({data:{id:"coop-ui",userId:"ui",name:"CoopApolinario UI"}});
   await call("admin","POST","/simulation/workspaces/coop-ui/enable",{enabled:true});
   await call("ui","GET","/simulation/context");
   await app.listen({host:"127.0.0.1",port:3341});
   const child=spawn(process.execPath,[process.env.KATUA_SIMULATION_BROWSER],{stdio:"inherit",env:{...process.env,SIMULATION_UI_TOKEN:tokens.get("ui")}});
   assert.equal(await new Promise(resolve=>child.once("exit",resolve)),0,"Browser validation failed");
   assert.equal(await real(),before);assert.equal(externalCalls,0);
 }
 }finally{await app.close();await prisma.$disconnect();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
