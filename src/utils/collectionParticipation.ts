import type { Collection, CollectionMaterial } from "../types/collection";
/** Materiais da parcela pessoal; a coleta original permanece disponível para operação. */
export function personalMaterialParcels(c: Collection): CollectionMaterial[] {
  if (
    !c.participants?.length ||
    !c.myCollectorId ||
    !c.allocationVersion ||
    c.allocationQuantityVersion !== c.quantityReviewVersion ||
    !["COLLECTED", "RECEIVED", "SORTING", "COMPLETED"].includes(c.status)
  )
    return [];
  const mine = c.participants.find((p) => p.collectorId === c.myCollectorId);
  return (mine?.allocations || []).map((m) => ({
    type: m.name,
    name: m.name,
    quantity: Number(m.quantity),
    unit: m.unit,
    quantityKg:
      Number(m.quantity) * (m.unit === "KG" ? 1 : m.unit === "TON" ? 1000 : 0),
  }));
}
