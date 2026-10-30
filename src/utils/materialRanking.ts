import type { CollectionMaterial } from "../types/collection";
import { groupMaterials, unitLabel } from "./materials";

export type MaterialRanking = { name: string; material: string; quantity: number; unit: string; percentage: number; key: string };
/** Shares are meaningful only within the same unit; liters never become zero kg. */
export function rankMaterials(materials: CollectionMaterial[]): MaterialRanking[] {
  const groups = groupMaterials(materials).map(item => ({
    name: item.name || item.type || "Material",
    quantity: item.unit === "TON" ? Number(item.quantity || 0) * 1000 : Number(item.quantity ?? item.quantityKg ?? 0),
    unit: item.unit === "TON" ? "KG" : item.unit || "KG",
  }));
  const merged = new Map<string, { name: string; quantity: number; unit: string }>();
  for (const item of groups) {
    const key = `${item.name.trim().toLocaleLowerCase("pt-BR")}:${item.unit}`;
    const previous = merged.get(key);
    merged.set(key, { ...item, quantity: item.quantity + (previous?.quantity || 0) });
  }
  const totals: Record<string, number> = {};
  for (const item of merged.values()) totals[item.unit] = (totals[item.unit] || 0) + item.quantity;
  const order = ["KG", "LITER", "UNIT", "CUBIC_METER"];
  return [...merged.entries()].filter(([,item]) => item.quantity > 0).map(([key,item]) => ({
    ...item, key, material: item.name, percentage: totals[item.unit] > 0 ? item.quantity / totals[item.unit] * 100 : 0,
  })).sort((a,b) => order.indexOf(a.unit) - order.indexOf(b.unit) || b.quantity-a.quantity || a.name.localeCompare(b.name,"pt-BR"));
}
export const rankedQuantity = (item: { quantity: number; unit: string }) =>
  `${item.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ${unitLabel(item.unit)}`;
export function materialTotalsLabel(materials: CollectionMaterial[]) {
  const totals = new Map<string, number>();
  for (const item of rankMaterials(materials)) totals.set(item.unit,(totals.get(item.unit)||0)+item.quantity);
  return [...totals.entries()].map(([unit,quantity]) => rankedQuantity({unit,quantity})).join(" · ") || "Sem quantidade registrada";
}
