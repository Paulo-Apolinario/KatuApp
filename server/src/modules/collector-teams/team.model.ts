import { Prisma } from "@prisma/client";
export const executed = new Set([
  "COLLECTED",
  "RECEIVED",
  "SORTING",
  "COMPLETED",
]);
export function creditedMaterials(c: any, collectorId: string) {
  if (!executed.has(c.status)) return [];
  if (c.participants?.length) {
    if (
      !c.allocationVersion ||
      c.allocationQuantityVersion !== c.quantityReviewVersion
    )
      return [];
    const p = c.participants.find((p: any) => p.collectorId === collectorId);
    return Array.isArray(p?.allocations) ? p.allocations : [];
  }
  return c.collectorId === collectorId
    ? (c.collectionMaterials || []).map((m: any) => ({
        materialId: m.id,
        name: m.nameSnapshot,
        unit: m.unit,
        quantity: Number(m.quantity),
      }))
    : [];
}
export function creditedKg(c: any, collectorId: string): number {
  if (!executed.has(c.status)) return 0;
  if (!c.participants?.length)
    return c.collectorId === collectorId ? Number(c.totalWeightKg || 0) : 0;
  return creditedMaterials(c, collectorId).reduce(
    (s: number, m: any) =>
      s +
      Number(m.quantity) * (m.unit === "TON" ? 1000 : m.unit === "KG" ? 1 : 0),
    0,
  );
}
export function allocationSnapshot(
  materials: any[],
  members: any[],
  items: { materialId: string; collectorId: string; quantity: number }[],
) {
  const keys = new Set<string>();
  for (const item of items) {
    const key = item.materialId + ":" + item.collectorId;
    if (
      keys.has(key) ||
      !materials.some((m) => m.id === item.materialId) ||
      !members.some((m) => m.collectorId === item.collectorId)
    )
      throw Error("Material ou participante inválido ou repetido na divisão.");
    keys.add(key);
  }
  if (items.length !== materials.length * members.length)
    throw Error(
      "Informe cada material para todos os participantes, inclusive parcelas iguais a zero.",
    );
  for (const m of materials) {
    const total = items
      .filter((i) => i.materialId === m.id)
      .reduce(
        (sum, i) => sum.add(new Prisma.Decimal(i.quantity)),
        new Prisma.Decimal(0),
      );
    if (!total.eq(new Prisma.Decimal(m.quantity)))
      throw Error(
        `A divisão de ${m.nameSnapshot} deve somar exatamente ${m.quantity} ${m.unit}.`,
      );
  }
  return members.map((p) => ({
    collectorId: p.collectorId,
    name: p.nameSnapshot,
    materials: materials.map((m) => ({
      materialId: m.id,
      name: m.nameSnapshot,
      unit: m.unit,
      quantity: items.find(
        (i) => i.materialId === m.id && i.collectorId === p.collectorId,
      )!.quantity,
    })),
  }));
}
