import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { wasteCooperativeScope } from "../waste-workspace/waste-workspace.routes";
const outgoing = ["SALE", "DONATION", "DIRECT_DESTINATION", "DISPOSAL"];
const input = z.object({
  operationId: z.string().uuid(), expectedVersion: z.number().int().min(1),
  kind: z.enum(["SALE", "DONATION", "DIRECT_DESTINATION", "DISPOSAL", "RESERVE", "RELEASE", "PROCESSING"]),
  quantity: z.number().positive().max(1000000000).refine(n => Math.abs(n*1000-Math.round(n*1000))<0.000001,"Use até três casas decimais.").optional(),
  destinationName: z.string().trim().max(255).optional(), destinationDocument: z.string().trim().max(100).optional(),
  transportDriverName:z.string().trim().max(100).optional(),transportVehiclePlate:z.string().trim().max(20).optional(),
  destinationAddress: z.string().trim().max(500).optional(), transportDocument: z.string().trim().max(255).optional(),
  environmentalDocument: z.string().trim().max(255).optional(), notes: z.string().trim().max(1500).optional(),
  movementDate: z.string().datetime({offset:true}).optional(),
  processingStage: z.enum(["ARMAZENADO","TRIADO","TRITURADO","PRENSADO","ENFARDADO"]).optional(),
}).strict().superRefine((v,c) => {
  if(outgoing.includes(v.kind) && (!v.quantity || !v.destinationName || v.destinationName.length<2)) c.addIssue({code:'custom',message:'Informe a quantidade e o destinatário da saída.'});
  if(v.kind==='DISPOSAL' && (!v.notes || v.notes.length<3)) c.addIssue({code:'custom',message:'Informe a justificativa do descarte.'});
  if(v.kind==='PROCESSING' && !v.processingStage) c.addIssue({code:'custom',message:'Selecione a etapa de processamento.'});
  if(!outgoing.includes(v.kind) && v.quantity!==undefined) c.addIssue({code:'custom',message:'Reserva, liberação e processamento não alteram a quantidade do lote.'});
});
function fail(message:string,statusCode=409):never {throw Object.assign(new Error(message),{statusCode});}
const snapshot = (lot:any) => ({status:lot.status,processingStage:lot.processingStage,availableQuantity:Number(lot.availableQuantity),version:lot.version});
export async function stockMovementRoutes(app:FastifyInstance) {
  app.get('/lots/:lotId/movements',async(r:any,p) => {
    try {
      const cooperativeId=await wasteCooperativeScope(r.user.sub);
      const lot=await prisma.wasteStockLot.findFirst({where:{id:r.params.lotId,cooperativeId},select:{id:true}});
      if(!lot)fail('Lote não encontrado.',404);
      const q=z.object({page:z.coerce.number().int().min(1).default(1),limit:z.coerce.number().int().min(1).max(50).default(20)}).strict().parse(r.query);
      const where={lotId:lot.id,cooperativeId};
      const [movements,total]=await prisma.$transaction([prisma.wasteStockMovement.findMany({where,orderBy:[{createdAt:'desc'},{id:'desc'}],skip:(q.page-1)*q.limit,take:q.limit}),prisma.wasteStockMovement.count({where})]);
      p.header('Cache-Control','private, no-store');return {movements,pagination:{page:q.page,limit:q.limit,total,totalPages:Math.ceil(total/q.limit)}};
    }catch(e:any){return p.code(e instanceof z.ZodError?400:e.code==='P2002'?409:e.statusCode||500).send({error:e instanceof z.ZodError?e.issues.map((i:any)=>i.message).join(' '):e.statusCode?e.message:'Não foi possível consultar o histórico.'});}
  });
  app.post('/lots/:lotId/movements',async(r:any,p) => {
    try {
      const cooperativeId=await wasteCooperativeScope(r.user.sub),data=input.parse(r.body);
      const operationHash=createHash('sha256').update(JSON.stringify({lotId:r.params.lotId,...data})).digest('hex');
      const result=await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT c.id FROM "Collection" c JOIN "WasteStockLot" l ON l."originCollectionId"=c.id WHERE l.id=${r.params.lotId} AND l."cooperativeId"=${cooperativeId} FOR UPDATE OF c`;
        await tx.$queryRaw`SELECT id FROM "WasteStockLot" WHERE id=${r.params.lotId} AND "cooperativeId"=${cooperativeId} FOR UPDATE`;
        const lot=await tx.wasteStockLot.findFirst({where:{id:r.params.lotId,cooperativeId}});
        if(!lot)fail('Lote não encontrado.',404);
        const previous=await tx.wasteStockMovement.findUnique({where:{cooperativeId_operationId:{cooperativeId,operationId:data.operationId}}});
        if(previous){if(previous.operationHash!==operationHash || previous.actorUserId!==r.user.sub)fail('Identificador de operação reutilizado com outros dados.');return {lot,movement:previous,replayed:true};}
        if(lot.version!==data.expectedVersion)fail('O lote foi alterado. Atualize os dados antes de movimentar.');
        if(!['AVAILABLE','RESERVED'].includes(lot.status) || Number(lot.availableQuantity)<=0)fail('Lote sem saldo movimentável. Consulte seu histórico.');
        const before=snapshot(lot);let status=lot.status,available=Number(lot.availableQuantity),processingStage=lot.processingStage;
        if(outgoing.includes(data.kind)) {
          if(status==='RESERVED')fail('Libere a reserva antes de registrar a saída do material.');
          if(data.quantity!>available+0.000001)fail('A quantidade de saída não pode ultrapassar o saldo do lote.');
          available=Math.round((available-data.quantity!)*1000)/1000;
          if(available<=0) {
            const other=await tx.wasteStockMovement.count({where:{lotId:lot.id,kind:{in:outgoing,not:data.kind}}});
            status=other>0 || ['DONATION','DIRECT_DESTINATION'].includes(data.kind)?'DESTINED':data.kind==='SALE'?'SOLD':'DISCARDED';
            processingStage='DESTINADO';
          }
        } else if(data.kind==='RESERVE') {if(status!=='AVAILABLE')fail('Este lote já está reservado.');status='RESERVED';}
        else if(data.kind==='RELEASE') {if(status!=='RESERVED')fail('Este lote não está reservado.');status='AVAILABLE';}
        else {if(processingStage===data.processingStage)fail('O lote já está nesta etapa de processamento.');processingStage=data.processingStage!;}
        const updated=await tx.wasteStockLot.update({where:{id:lot.id},data:{status,availableQuantity:new Prisma.Decimal(available),processingStage,version:{increment:1}}});
        const actor=await tx.user.findUnique({where:{id:r.user.sub},select:{displayName:true}});
        const movement=await tx.wasteStockMovement.create({data:{cooperativeId,lotId:lot.id,operationId:data.operationId,operationHash,kind:data.kind,quantity:new Prisma.Decimal(outgoing.includes(data.kind)?data.quantity!:available),unit:lot.unit,transportDriverName:data.transportDriverName||null,transportVehiclePlate:data.transportVehiclePlate||null,destinationName:data.destinationName||null,destinationDocument:data.destinationDocument||null,destinationAddress:data.destinationAddress||null,transportDocument:data.transportDocument||null,environmentalDocument:data.environmentalDocument||null,notes:data.notes||null,movementDate:data.movementDate?new Date(data.movementDate):new Date(),actorUserId:r.user.sub,actorName:actor?.displayName,before,after:snapshot(updated)}});
        return {lot:updated,movement,replayed:false};
      });
      p.header('Cache-Control','private, no-store');return p.code(result.replayed?200:201).send({success:true,...result});
    }catch(e:any){return p.code(e instanceof z.ZodError?400:e.code==='P2002'?409:e.statusCode||500).send({error:e instanceof z.ZodError?e.issues.map((i:any)=>i.message).join(' '):e.code==='P2002'?'Identificador de operação já utilizado. Atualize o lote.':e.statusCode?e.message:'Não foi possível registrar a movimentação do lote.'});}
  });
}
