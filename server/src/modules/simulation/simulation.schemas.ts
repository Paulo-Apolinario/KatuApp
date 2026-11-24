import { z } from "zod";
import { Prisma } from "@prisma/client";
const quantity=z.number().finite().positive().max(1e9).refine(v=>new Prisma.Decimal(v).decimalPlaces()<=3,"Use até três casas decimais para quantidade.");
const line=z.object({materialId:z.string().min(1).max(100),unit:z.enum(["KG","TON","LITER","UNIT","CUBIC_METER"]),quantity,unitPrice:z.number().finite().nonnegative().max(1e9).refine(v=>new Prisma.Decimal(v).decimalPlaces()<=4,"Preço admite até quatro casas decimais.")}).strict();
export const saleInput=z.object({buyerId:z.string().min(1).max(100),lines:z.array(line).min(1).max(20).refine(v=>new Set(v.map(l=>l.materialId)).size===v.length,"Agrupe o mesmo material em um único item."),transport:z.object({driver:z.string().trim().min(2).max(100),vehicle:z.string().trim().min(2).max(20)}).strict()}).strict();
const base=z.object({operationId:z.string().uuid(),expectedVersion:z.number().int().positive()});
const saleId=z.string().min(1).max(100);
export const simulationAction=z.discriminatedUnion("action",[
  base.extend({action:z.literal("RESET"),confirm:z.literal(true)}).strict(),
  base.extend({action:z.literal("ADD_BUYER"),buyer:z.object({name:z.string().trim().min(2).max(150),document:z.string().trim().max(30).default(""),address:z.string().trim().max(300).default("")}).strict()}).strict(),
  base.extend({action:z.literal("CREATE_SALE"),sale:saleInput}).strict(),
  base.extend({action:z.literal("PREPARE_NOTE"),saleId,prices:z.array(z.object({materialId:z.string().min(1).max(100),unitPrice:z.number().positive().max(1e9).refine(v=>new Prisma.Decimal(v).decimalPlaces()<=4,"Use até quatro casas no preço.")}).strict()).min(1).max(20)}).strict(),
  base.extend({action:z.literal("ISSUE_DOCUMENT"),saleId,type:z.enum(["NFE","MTR","CDF"]),outcome:z.enum(["APPROVED","REJECTED","UNCERTAIN"])}).strict(),
  base.extend({action:z.literal("CHECK_DOCUMENT"),saleId,documentId:z.string().min(1).max(100)}).strict(),
  base.extend({action:z.literal("CANCEL_NFE"),saleId}).strict(),
  base.extend({action:z.literal("DISPATCH"),saleId}).strict(),
  base.extend({action:z.literal("RECEIVE"),saleId,quantities:z.array(z.object({materialId:z.string().min(1).max(100),quantity:z.number().finite().min(0).max(1e9).refine(v=>new Prisma.Decimal(v).decimalPlaces()<=3,"Quantidade admite até três casas decimais.")}).strict()).max(20).optional(),notes:z.string().trim().max(1000).default("")}).strict(),
  base.extend({action:z.literal("PAYMENT"),saleId,amount:z.number().finite().positive().max(1e12).refine(v=>new Prisma.Decimal(v).decimalPlaces()<=2,"Pagamento admite até duas casas decimais."),method:z.enum(["PIX","CASH","TRANSFER","OTHER"])}).strict(),
]);
export type SimulationAction=z.infer<typeof simulationAction>;
