import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma";
import { wasteCooperativeScope } from "../waste-workspace/waste-workspace.routes";
const query=z.object({q:z.string().trim().max(120).default(""),page:z.coerce.number().int().min(1).max(100000).default(1),limit:z.coerce.number().int().min(1).max(50).default(20),status:z.enum(["","PENDING","PREPARED"]).default(""),dateFrom:z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/).default(""),dateTo:z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/).default("")}).strict();
const input=z.object({operationId:z.string().uuid(),expectedVersion:z.number().int().min(0),unitPrice:z.number().positive().max(1e9).refine(v=>new Prisma.Decimal(v).decimalPlaces()<=4,"Use até quatro casas no preço."),notes:z.string().trim().max(1500).default("")}).strict();
function fail(message:string,statusCode=409):never{throw Object.assign(new Error(message),{statusCode});}
// One sale per bulk dispatch, regardless of the number of lots. Single-lot movements also appear.
function sales(cooperativeId:string){return Prisma.sql`WITH source AS (
 SELECT CASE WHEN m."operationId" LIKE 'bulk:%' THEN 'dispatch:' || split_part(m."operationId",':',2) ELSE 'movement:' || m.id END AS key,
 m."movementDate", m."destinationName",m."destinationDocument",m."destinationAddress",m."transportDriverName",m."transportVehiclePlate",m.quantity,m.unit,
 l.id AS "lotId",COALESCE(l."lotCode",l.code,l.id) AS "lotCode",i.name AS "materialName",i.ncm,i.id AS "materialId"
 FROM "WasteStockMovement" m JOIN "WasteStockLot" l ON l.id=m."lotId" AND l."cooperativeId"=m."cooperativeId"
 JOIN "WasteStockItem" i ON i.id=l."stockItemId" AND i."cooperativeId"=m."cooperativeId"
 WHERE m."cooperativeId"=${cooperativeId} AND m.kind='SALE'
 ), grouped AS (
 SELECT key,min("movementDate") AS "movementDate",max("destinationName") AS "buyerName",max("destinationDocument") AS "buyerDocument",max("destinationAddress") AS "buyerAddress",
 max("transportDriverName") AS "driver",max("transportVehiclePlate") AS "vehicle",max("materialName") AS "materialName",max(ncm) AS ncm,max("materialId") AS "materialId",min(unit::text) AS unit,
 sum(quantity)::text AS quantity,count(DISTINCT "materialId")::int AS "materialCount",count(DISTINCT unit)::int AS "unitCount",
 jsonb_agg(jsonb_build_object('lotId',"lotId",'lotCode',"lotCode",'quantity',quantity::text,'unit',unit) ORDER BY "lotCode","lotId") AS lots
 FROM source GROUP BY key
 ), sale AS (SELECT g.*,p.id AS "preparationId",COALESCE(p.version,0) AS version,p."unitPrice"::text,p.total::text,p.notes,p.snapshot AS "preparationSnapshot",p."updatedAt" AS "preparedAt"
 FROM grouped g LEFT JOIN "SaleNotePreparation" p ON p."cooperativeId"=${cooperativeId} AND p."sourceKey"=g.key)
 `;}
async function find(tx:Prisma.TransactionClient,cooperativeId:string,key:string){
 const rows=await tx.$queryRaw<any[]>(Prisma.sql`${sales(cooperativeId)} SELECT * FROM sale WHERE key=${key}`);
 if(!rows[0])fail("Venda não encontrada nesta cooperativa.",404);return rows[0];
}
export async function salesRoutes(app:FastifyInstance){
 app.addHook("preHandler",app.authenticate);
 const handle=(fn:(r:any)=>Promise<any>)=>async(r:any,p:any)=>{try{p.header("Cache-Control","private, no-store");return await fn(r);}catch(e:any){const status=e instanceof z.ZodError?400:["P2002","P2034"].includes(e.code)?409:e.statusCode||500;if(status===500)r.log.error({code:e.code},"Sale preparation failed");return p.code(status).send({error:e instanceof z.ZodError?e.issues.map(i=>i.message).join(" "):e.statusCode?e.message:status===409?"Os dados mudaram. Atualize antes de salvar.":"Não foi possível consultar ou preparar a venda."});}};
 app.get("/sales",handle(async r=>{
  const cooperativeId=await wasteCooperativeScope(r.user.sub),q=query.parse(r.query);
  for(const d of [q.dateFrom,q.dateTo])if(d&&(!Number.isFinite(Date.parse(d+"T00:00:00Z"))||new Date(d+"T00:00:00Z").toISOString().slice(0,10)!==d))fail("Data inválida.",400);
  if(q.dateFrom&&q.dateTo&&q.dateFrom>q.dateTo)fail("Confira o período da consulta.",400);
  const filters=Prisma.sql` WHERE (${q.q}='' OR "buyerName" ILIKE ${'%'+q.q+'%'} OR "materialName" ILIKE ${'%'+q.q+'%'} OR key ILIKE ${'%'+q.q+'%'})
   AND (${q.status}='' OR (${q.status}='PENDING' AND "preparationId" IS NULL) OR (${q.status}='PREPARED' AND "preparationId" IS NOT NULL))
   AND (${q.dateFrom}='' OR "movementDate">=NULLIF(${q.dateFrom},'')::date AT TIME ZONE 'America/Fortaleza')
   AND (${q.dateTo}='' OR "movementDate"<(NULLIF(${q.dateTo},'')::date+1) AT TIME ZONE 'America/Fortaleza')`;
  return prisma.$transaction(async tx=>{
   const rows=await tx.$queryRaw<any[]>(Prisma.sql`${sales(cooperativeId)} SELECT * FROM sale ${filters} ORDER BY "movementDate" DESC,key DESC LIMIT ${q.limit} OFFSET ${(q.page-1)*q.limit}`);
   const [summary]=await tx.$queryRaw<any[]>(Prisma.sql`${sales(cooperativeId)} SELECT count(*)::int AS total,count("preparationId")::int AS prepared,COALESCE(sum(total::numeric),0)::text AS "preparedTotal" FROM sale ${filters}`);
   return {items:rows,summary,pagination:{page:q.page,limit:q.limit,total:summary.total,totalPages:Math.max(1,Math.ceil(summary.total/q.limit))}};
  });
 }));
 app.get("/sales/:key",handle(async r=>{
  const cooperativeId=await wasteCooperativeScope(r.user.sub),key=z.string().min(1).max(200).parse(r.params.key);
  const sale=await find(prisma,cooperativeId,key);
  const revisions=sale.preparationId?await prisma.saleNoteRevision.findMany({where:{preparationId:sale.preparationId},orderBy:[{createdAt:"desc"},{id:"desc"}],take:20,select:{id:true,actorUserId:true,createdAt:true,snapshot:true}}):[];
  const cooperative=await prisma.cooperative.findUniqueOrThrow({where:{id:cooperativeId},select:{name:true,registrationNumber:true,address:true,street:true,number:true,neighborhood:true,city:true,state:true,zipCode:true,phone:true,email:true}});
  return {sale,cooperative,revisions,officialIssuanceEnabled:false};
 }));
 app.put("/sales/:key/note",handle(async r=>{
  const cooperativeId=await wasteCooperativeScope(r.user.sub),key=z.string().min(1).max(200).parse(r.params.key),data=input.parse(r.body);
  const operationHash=createHash("sha256").update(JSON.stringify({key,...data})).digest("hex");
  return prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${`sale-note:${cooperativeId}:${key}`}))`;
   const sale=await find(tx,cooperativeId,key),old=await tx.saleNotePreparation.findUnique({where:{cooperativeId_sourceKey:{cooperativeId,sourceKey:key}}});
   const previous=old?await tx.saleNoteRevision.findUnique({where:{preparationId_operationId:{preparationId:old.id,operationId:data.operationId}}}):null;
   if(previous){if(previous.operationHash!==operationHash||previous.actorUserId!==r.user.sub)fail("Protocolo já usado com outros dados.");return {preparation:old,replayed:true};}
   if((old?.version||0)!==data.expectedVersion)fail("A preparação foi alterada. Atualize e confira o preço antes de salvar.");
   if(sale.materialCount!==1||sale.unitCount!==1)fail("Esta saída possui materiais ou unidades diferentes e precisa de conferência individual.",400);
   const price=new Prisma.Decimal(data.unitPrice),total=price.mul(sale.quantity).toDecimalPlaces(2);
   if(total.lte(0))fail("O total precisa ser de pelo menos R$ 0,01.",400);
   const snapshot=JSON.parse(JSON.stringify({sourceKey:key,buyer:{name:sale.buyerName,document:sale.buyerDocument,address:sale.buyerAddress},transport:{driver:sale.driver,vehicle:sale.vehicle},materialId:sale.materialId,materialName:sale.materialName,ncm:sale.ncm,unit:sale.unit,quantity:sale.quantity,lots:sale.lots,unitPrice:price.toFixed(4),total:total.toFixed(2),notes:data.notes,version:(old?.version||0)+1,preparedBy:r.user.sub,preparedAt:new Date().toISOString(),internalOnly:true,officialIssuanceEnabled:false}));
   const values={unitPrice:price,total,notes:data.notes,snapshot,updatedBy:r.user.sub};
   const preparation=old?await tx.saleNotePreparation.update({where:{id:old.id},data:{...values,version:{increment:1}}}):await tx.saleNotePreparation.create({data:{...values,cooperativeId,sourceKey:key}});
   await tx.saleNoteRevision.create({data:{preparationId:preparation.id,operationId:data.operationId,operationHash,actorUserId:r.user.sub,snapshot}});
   return {preparation,replayed:false};
  },{timeout:20000});
 }));
}
