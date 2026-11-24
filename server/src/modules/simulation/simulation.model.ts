import { Prisma, type WasteStockLot, type WasteUnit } from "@prisma/client";
import { allocateDispatch } from "../waste-stock/stock-dispatch";
export const SIMULATION_NOTICE = "SIMULAÇÃO — SEM VALIDADE FISCAL OU AMBIENTAL";
export type SimMaterial = { id: string; name: string; unit: WasteUnit };
export type SimLot = { id: string; materialId: string; code: string; original: string; available: string; version: number; receivedAt: string };
export type SimBuyer = { id: string; name: string; address: string; document: string };
export type SimAllocation = ReturnType<typeof allocateDispatch>[number] & { materialId: string; unit: WasteUnit };
export type SimLine = { materialId: string; name: string; unit: WasteUnit; quantity: string; unitPrice: string; total: string };
export type SimDocument = { id: string; type: "NFE" | "MTR" | "CDF"; status: "APPROVED" | "REJECTED" | "UNCERTAIN" | "CANCELLED"; createdAt: string; message: string; saleSnapshot: { buyer: SimBuyer; lines: SimLine[]; total: string }; linkedDocumentIds: string[] };
export type SimSale = { id: string; buyer: SimBuyer; lines: SimLine[]; total: string; createdAt: string; stage: "DRAFT" | "EXPEDITED" | "RECEIVED"; preview: SimAllocation[]; allocations: SimAllocation[]; documents: SimDocument[]; payments: { amount: string; method: string; createdAt: string }[]; receipt?: { quantities: { materialId: string; quantity: string }[]; notes: string; receivedAt: string }; transport: { driver: string; vehicle: string }; };
export type SimState = { generation?: number; materials: SimMaterial[]; lots: SimLot[]; buyers: SimBuyer[]; sales: SimSale[] };
export function initialSimulation(): SimState {
  const at = "2026-01-01T12:00:00.000Z";
  return { materials: [{ id:"paper",name:"Papelão",unit:"KG" },{id:"pet",name:"PET",unit:"KG"},{id:"oil",name:"Óleo",unit:"LITER"}],
    lots: [["paper",200],["paper",170],["paper",130],["pet",120],["oil",80]].map(([materialId,quantity],index)=>({id:"sim-lot-"+(index+1),materialId:String(materialId),code:"SIM-LOT-"+String(index+1).padStart(3,"0"),original:new Prisma.Decimal(quantity).toFixed(3),available:new Prisma.Decimal(quantity).toFixed(3),version:1,receivedAt:new Date(Date.parse(at)+index*60000).toISOString()})),
    buyers:[{id:"buyer-demo",name:"Comprador demonstrativo",address:"Endereço fictício para testes",document:""}], sales:[] };
}
export function simulationPlan(state: SimState, lines: { materialId: string; quantity: number; unit: WasteUnit }[]) {
  return lines.flatMap(line => {
    const lots: WasteStockLot[] = state.lots.filter(l=>l.materialId===line.materialId&&new Prisma.Decimal(l.available).gt(0)).sort((a,b)=>a.receivedAt.localeCompare(b.receivedAt)||a.id.localeCompare(b.id)).map(l=>({id:l.id,cooperativeId:"SIMULATION_ONLY",stockItemId:l.materialId,code:l.code,lotCode:l.code,quantity:new Prisma.Decimal(l.original),availableQuantity:new Prisma.Decimal(l.available),quantityKg:0,unit:line.unit,storageLocation:null,processingStage:"TRIADO",origin:"SIMULATION",notes:null,status:"AVAILABLE",receivedAt:new Date(l.receivedAt),originCollectionId:null,originCollectionMaterialId:null,originCollectionWasteEntryId:null,createdByUserId:null,createdAt:new Date(l.receivedAt),updatedAt:new Date(l.receivedAt),version:l.version}));
    return allocateDispatch(lots,line.quantity).map(a=>({...a,materialId:line.materialId,unit:line.unit}));
  });
}
export const latestDocument = (sale: SimSale, type: SimDocument["type"]) => [...sale.documents].reverse().find(d=>d.type===type);
