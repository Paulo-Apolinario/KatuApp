import type { CollectionMaterial, WasteUnit } from "../types/collection";
export function normalizeMaterials(materials: unknown): CollectionMaterial[] {
  if (!Array.isArray(materials)) return [];
  return materials.filter(Boolean).map((raw) => {
    const item = typeof raw === "string" ? { name: raw } : raw;
    const name =
      item.name ||
      item.type ||
      item.nameSnapshot ||
      item.proposedMaterial?.name ||
      item.wasteType?.name ||
      "Material";
    const unit: WasteUnit = item.unit || "KG";
    const quantity = Number(item.quantity ?? item.quantityKg ?? 0);
    const quantityKg =
      unit === "KG" ? quantity : unit === "TON" ? quantity * 1000 : 0;
    return {
      ...item,
      name,
      type: name,
      unit,
      quantity: Number.isFinite(quantity) ? quantity : 0,
      quantityKg: Number.isFinite(quantityKg) ? quantityKg : 0,
    };
  });
}
export const unitLabel = (unit?: string) =>
  ({ KG: "kg", TON: "t", LITER: "L", UNIT: "un", CUBIC_METER: "m³" })[
    unit || "KG"
  ] ||
  unit ||
  "kg";
export function materialQuantity(item: Partial<CollectionMaterial>) {
  return `${Number(item.quantity ?? item.quantityKg ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ${unitLabel(item.unit)}`;
}
export function getTotalMaterialsKg(materials?: CollectionMaterial[]) {
  return normalizeMaterials(materials).reduce(
    (sum, item) => sum + item.quantityKg,
    0,
  );
}
export function groupMaterials(materials: unknown): CollectionMaterial[] {
  const groups = new Map<string, CollectionMaterial>();
  for (const item of normalizeMaterials(materials)) {
    const key = `${item.type}:${item.unit}`;
    const old = groups.get(key);
    groups.set(
      key,
      old
        ? {
            ...old,
            quantity: (old.quantity || 0) + (item.quantity || 0),
            quantityKg: old.quantityKg + item.quantityKg,
          }
        : item,
    );
  }
  return [...groups.values()];
}
