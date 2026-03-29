import type { CollectionMaterial } from "@/src/types/collection";

export function normalizeMaterials(materials: unknown): CollectionMaterial[] {
  if (!Array.isArray(materials)) return [];

  return materials
    .map((item) => {
      if (typeof item === "string") {
        return { type: item, quantityKg: 0 };
      }

      if (
        item &&
        typeof item === "object" &&
        "type" in item &&
        "quantityKg" in item
      ) {
        return {
          type: String((item as any).type),
          quantityKg: Number((item as any).quantityKg ?? 0),
        };
      }

      return null;
    })
    .filter(Boolean) as CollectionMaterial[];
}

export function getTotalMaterialsKg(materials?: CollectionMaterial[]) {
  return (materials ?? []).reduce(
    (sum, item) => sum + Number(item.quantityKg ?? 0),
    0
  );
}