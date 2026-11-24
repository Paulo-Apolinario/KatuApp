import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { initialSimulation, latestDocument, simulationPlan, SIMULATION_NOTICE, type SimState } from "./simulation.model";
import type { SimulationAction } from "./simulation.schemas";
import { saleInput } from "./simulation.schemas";
export class SimulationError extends Error { constructor(message:string,public statusCode=409){super(message);} }
const json=(value:unknown)=>JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export async function simulationScope(userId:string,cooperativeId?:string){
  const user=await prisma.user.findUnique({where:{id:userId},select:{role:true,isActive:true,credentialsReady:true,accountStatus:true,cooperative:{select:{id:true,name:true}}}});
  if(!user?.isActive||!user.credentialsReady||user.accountStatus!=="ACTIVE"||!["ADMIN","COOPERATIVE"].includes(user.role))throw new SimulationError("Simulação disponível à administração e à cooperativa habilitada.",403);
  const id=cooperativeId||user.cooperative?.id;
  if(!id)throw new SimulationError("Selecione uma cooperativa de teste.",400);
  if(user.role!=="ADMIN"&&user.cooperative?.id!==id)throw new SimulationError("Cooperativa não encontrada.",404);
  const cooperative=await prisma.cooperative.findUnique({where:{id},select:{id:true,name:true}});
  if(!cooperative)throw new SimulationError("Cooperativa não encontrada.",404);
  return {admin:user.role==="ADMIN",cooperative};
}
export async function simulationWorkspace(userId:string,cooperativeId?:string){
  const scope=await simulationScope(userId,cooperativeId);
  const workspace=await prisma.simulationWorkspace.findUnique({where:{cooperativeId:scope.cooperative.id},include:{events:{orderBy:[{createdAt:"desc"},{id:"desc"}],take:30,select:{id:true,kind:true,actorUserId:true,createdAt:true,result:true}}}});
  return {notice:SIMULATION_NOTICE,cooperative:scope.cooperative,canEnable:scope.admin,workspace};
}
export async function enableSimulation(userId:string,cooperativeId:string,enabled:boolean){
  const scope=await simulationScope(userId,cooperativeId);
  if(!scope.admin)throw new SimulationError("Somente a administração habilita a simulação.",403);
  await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "Cooperative" WHERE id=${cooperativeId} FOR UPDATE`;
    const old=await tx.simulationWorkspace.findUnique({where:{cooperativeId}});
    if(old?.enabled===enabled)return;
    if(!old&&!enabled)return;
    const workspace=old?await tx.simulationWorkspace.update({where:{id:old.id},data:{enabled,version:{increment:1}}}):await tx.simulationWorkspace.create({data:{cooperativeId,enabled:true,state:json(initialSimulation())}});
    await tx.simulationEvent.create({data:{workspaceId:workspace.id,operationId:randomUUID(),operationHash:"ADMIN_ENABLE",actorUserId:userId,kind:enabled?"ENABLED":"DISABLED",result:{message:enabled?"Simulação habilitada com dados demonstrativos separados.":"Simulação desabilitada; histórico preservado."}}});
  });
  return simulationWorkspace(userId,cooperativeId);
}
function saleLines(state:SimState,input:Prisma.JsonObject|unknown){
  const data=saleInput.parse(input);
  const buyer=state.buyers.find(b=>b.id===data.buyerId);
  if(!buyer)throw new SimulationError("Selecione um comprador da simulação.",400);
  const lines=data.lines.map(line=>{
    const item=state.materials.find(m=>m.id===line.materialId);
    if(!item||item.unit!==line.unit)throw new SimulationError("Material ou unidade não pertence à simulação.",400);
    return {materialId:item.id,name:item.name,unit:item.unit,quantity:new Prisma.Decimal(line.quantity).toFixed(3),unitPrice:new Prisma.Decimal(line.unitPrice).toFixed(4),total:new Prisma.Decimal(line.quantity).mul(line.unitPrice).toFixed(2)};
  });
  return {buyer,lines,total:lines.reduce((n,l)=>n.add(l.total),new Prisma.Decimal(0)).toFixed(2),transport:data.transport,preview:simulationPlan(state,data.lines)};
}
export async function previewSimulation(userId:string,cooperativeId:string,input:unknown){
  await simulationScope(userId,cooperativeId);
  const workspace=await prisma.simulationWorkspace.findUnique({where:{cooperativeId}});
  if(!workspace?.enabled)throw new SimulationError("A administração precisa habilitar a simulação nesta cooperativa.",403);
  return {notice:SIMULATION_NOTICE,version:workspace.version,...saleLines(workspace.state as unknown as SimState,input)};
}
export async function actSimulation(userId:string,cooperativeId:string,input:SimulationAction){
  await simulationScope(userId,cooperativeId);
  const hash=createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const result=await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "SimulationWorkspace" WHERE "cooperativeId"=${cooperativeId} FOR UPDATE`;
    const workspace=await tx.simulationWorkspace.findUnique({where:{cooperativeId}});
    if(!workspace?.enabled)throw new SimulationError("Simulação não habilitada pela administração.",403);
    const old=await tx.simulationEvent.findUnique({where:{workspaceId_operationId:{workspaceId:workspace.id,operationId:input.operationId}}});
    if(old){if(old.operationHash!==hash||old.actorUserId!==userId)throw new SimulationError("Protocolo já usado com outros dados.");return {replayed:true,result:old.result};}
    if(workspace.version!==input.expectedVersion)throw new SimulationError("A simulação mudou. Atualize os dados e confira a operação antes de confirmar.");
    const state=workspace.state as unknown as SimState,at=new Date().toISOString();
    let message="",saleId:string|undefined;
    if(input.action==="ADD_BUYER"){
      if(state.buyers.length>=50)throw new SimulationError("Limite de 50 compradores demonstrativos atingido.",400);
      state.buyers.push({id:randomUUID(),...input.buyer});message="Comprador demonstrativo cadastrado.";
    }else if(input.action==="CREATE_SALE"){
      if(state.sales.length>=20)throw new SimulationError("Limite de 20 vendas demonstrativas atingido.",400);
      const prepared=saleLines(state,input.sale);saleId="SIM-VENDA-"+(state.sales.length+1);
      state.sales.push({id:saleId,...prepared,createdAt:at,stage:"DRAFT",allocations:[],documents:[],payments:[]});message="Venda simulada salva em rascunho. Nenhum saldo foi reduzido.";
    }else{
      saleId=input.saleId;const sale=state.sales.find(s=>s.id===saleId);
      if(!sale)throw new SimulationError("Venda simulada não encontrada.",404);
      if(input.action==="PREPARE_NOTE"){
        if(sale.stage!=="DRAFT"||["APPROVED","UNCERTAIN"].includes(latestDocument(sale,"NFE")?.status||""))throw new SimulationError("Os valores só podem mudar antes da confirmação da nota simulada.");
        if(input.prices.length!==sale.lines.length||new Set(input.prices.map(p=>p.materialId)).size!==sale.lines.length||input.prices.some(p=>!sale.lines.some(l=>l.materialId===p.materialId)))throw new SimulationError("Informe um preço para cada material da venda.",400);
        for(const line of sale.lines){line.unitPrice=new Prisma.Decimal(input.prices.find(p=>p.materialId===line.materialId)!.unitPrice).toFixed(4);line.total=new Prisma.Decimal(line.unitPrice).mul(line.quantity).toFixed(2);}
        sale.total=sale.lines.reduce((n,l)=>n.add(l.total),new Prisma.Decimal(0)).toFixed(2);
        if(new Prisma.Decimal(sale.total).lte(0))throw new SimulationError("Total deve ser de pelo menos R$ 0,01.",400);
        message="Valores definidos na preparação da nota simulada. Nenhum saldo foi alterado.";
      }else if(input.action==="ISSUE_DOCUMENT"){
        if(input.type==="NFE"&&sale.lines.some(l=>new Prisma.Decimal(l.unitPrice).lte(0)))throw new SimulationError("Informe os preços na preparação da nota antes de gerar o documento.",400);
        if(sale.documents.length>=12)throw new SimulationError("Limite de 12 tentativas documentais por venda.",400);
        const oldDoc=latestDocument(sale,input.type);
        if(oldDoc&&["APPROVED","UNCERTAIN"].includes(oldDoc.status))throw new SimulationError("Documento já confirmado ou com resultado pendente. Consulte o resultado existente.");
        if(input.type==="NFE"&&sale.stage!=="DRAFT")throw new SimulationError("Prepare a NF-e demonstrativa antes da saída neste cenário.");
        if(input.type==="MTR"&&latestDocument(sale,"NFE")?.status!=="APPROVED")throw new SimulationError("Neste cenário de venda, confirme primeiro a NF-e simulada.");
        if(input.type==="CDF"&&sale.stage!=="RECEIVED")throw new SimulationError("Registre o recebimento demonstrativo antes do CDF.");
        if(input.type==="CDF"&&latestDocument(sale,"MTR")?.status!=="APPROVED")throw new SimulationError("Confirme o MTR demonstrativo antes do CDF.");
        const id=`SIM-${input.type}-${sale.id.replace("SIM-VENDA-","")}-${sale.documents.length+1}`;
        const lines=input.type==="CDF"&&sale.receipt?sale.lines.map(l=>({...l,quantity:sale.receipt!.quantities.find(q=>q.materialId===l.materialId)!.quantity})):sale.lines;
        message=input.outcome==="APPROVED"?"Documento confirmado apenas pelo simulador.":input.outcome==="REJECTED"?"Rejeição demonstrativa. Altere o cenário de resposta para testar uma nova tentativa.":"Resposta demonstrativa não chegou. Consulte o resultado; não gere outro documento.";
        sale.documents.push({id,type:input.type,status:input.outcome,createdAt:at,message,saleSnapshot:{buyer:json(sale.buyer) as unknown as typeof sale.buyer,lines:json(lines) as unknown as typeof lines,total:sale.total},linkedDocumentIds:sale.documents.filter(d=>d.status==="APPROVED").map(d=>d.id)});
      }else if(input.action==="CHECK_DOCUMENT"){
        const doc=sale.documents.find(d=>d.id===input.documentId);
        if(!doc)throw new SimulationError("Documento demonstrativo não encontrado.",404);
        if(doc.status==="UNCERTAIN"){doc.status="APPROVED";doc.message="Consulta demonstrativa confirmou o mesmo documento, sem duplicar.";}
        message=doc.message;
      }else if(input.action==="CANCEL_NFE"){
        const doc=latestDocument(sale,"NFE");if(!doc||doc.status!=="APPROVED")throw new SimulationError("Não há NF-e demonstrativa confirmada para cancelar.");
        doc.status="CANCELLED";doc.message="Cancelamento demonstrativo, sem retorno físico de materiais.";message="NF-e simulada cancelada. O saldo e a saída física permanecem como registrados.";
      }else if(input.action==="DISPATCH"){
        if(sale.stage!=="DRAFT")throw new SimulationError("A saída desta venda já foi registrada.");
        if(latestDocument(sale,"NFE")?.status!=="APPROVED"||latestDocument(sale,"MTR")?.status!=="APPROVED")throw new SimulationError("Confirme NF-e e MTR simulados antes da saída deste cenário.");
        sale.allocations=simulationPlan(state,sale.lines.map(l=>({materialId:l.materialId,unit:l.unit,quantity:Number(l.quantity)})));
        for(const a of sale.allocations){const lot=state.lots.find(l=>l.id===a.lotId)!;lot.available=a.after;lot.version++;}
        sale.stage="EXPEDITED";message="Saída confirmada somente no estoque de simulação. Lotes reais não foram alterados.";
      }else if(input.action==="RECEIVE"){
        if(sale.stage!=="EXPEDITED")throw new SimulationError("Confirme a saída simulada antes do recebimento.");
        const quantities=input.quantities||sale.lines.map(l=>({materialId:l.materialId,quantity:Number(l.quantity)}));
        if(quantities.length!==sale.lines.length||new Set(quantities.map(q=>q.materialId)).size!==sale.lines.length||quantities.some(q=>!sale.lines.some(l=>l.materialId===q.materialId)))throw new SimulationError("Informe uma quantidade por material da venda.",400);
        if(quantities.some(q=>!new Prisma.Decimal(q.quantity).eq(sale.lines.find(l=>l.materialId===q.materialId)!.quantity))&&input.notes.length<3)throw new SimulationError("Descreva a divergência do recebimento simulado.",400);
        sale.receipt={quantities:quantities.map(q=>({...q,quantity:new Prisma.Decimal(q.quantity).toFixed(3)})),notes:input.notes,receivedAt:at};sale.stage="RECEIVED";message="Recebimento demonstrativo registrado. Quantidade expedida e histórico preservados.";
      }else if(input.action==="PAYMENT"){
        if(sale.payments.length>=20)throw new SimulationError("Limite de 20 pagamentos demonstrativos por venda.",400);
        const paid=sale.payments.reduce((n,p)=>n.add(p.amount),new Prisma.Decimal(0));
        if(paid.add(input.amount).gt(sale.total))throw new SimulationError("O recebimento excede o valor pendente da venda simulada.",400);
        sale.payments.push({amount:new Prisma.Decimal(input.amount).toFixed(2),method:input.method,createdAt:at});message="Pagamento simulado registrado, sem movimentação financeira real.";
      }
    }
    const encoded=json(state);if(JSON.stringify(encoded).length>2*1024*1024)throw new SimulationError("O ambiente demonstrativo atingiu o limite de dados.",400);
    await tx.simulationWorkspace.update({where:{id:workspace.id},data:{state:encoded,version:{increment:1}}});
    const eventResult={message,...(saleId?{saleId}:{})};
    await tx.simulationEvent.create({data:{workspaceId:workspace.id,operationId:input.operationId,operationHash:hash,actorUserId:userId,kind:input.action,result:eventResult}});
    return {replayed:false,result:eventResult};
  },{timeout:20000});
  return {...await simulationWorkspace(userId,cooperativeId),...result};
}
