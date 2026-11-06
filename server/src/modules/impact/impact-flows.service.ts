import { profileFor } from "./impact-analysis.model";
// Read physical events, never count internal STOCK/TRIAGE transfers as external destinations.
export async function physicalFlows(
  tx: any,
  cooperativeId: string,
  originScope: any,
  catalog: Map<string, any>,
  input: any,
  range: any,
  restricted: boolean,
) {
  const dispatched: Record<string, number> = {},
    rejected: Record<string, number> = {},
    stock: Record<string, number> = {};
  const trace: any[] = [];
  let total = 0;
  const matches = (cm: any, itemId: string | null) => {
    const profile = profileFor(cm || { wasteTypeId: itemId }, catalog).profile;
    return (
      (!input.materialId || (cm?.wasteTypeId || itemId) === input.materialId) &&
      (!input.materialCode ||
        (profile.materialCode || "UNKNOWN") === input.materialCode)
    );
  };
  const add = (map: Record<string, number>, q: any, u: string) => {
    const unit = u === "TON" ? "KG" : u;
    map[unit] = (map[unit] || 0) + Number(q) * (u === "TON" ? 1000 : 1);
  };
  const remember = (row: any) => {
    total++;
    trace.push(row);
    trace.sort(
      (a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime() ||
        a.id.localeCompare(b.id),
    );
    if (trace.length > 50) trace.pop();
  };
  async function pages(
    model: any,
    where: any,
    select: any,
    accept: (r: any) => void,
  ) {
    let cursor: string | undefined;
    while (true) {
      const rows = await model.findMany({
        where,
        select,
        orderBy: { id: "asc" },
        take: 500,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      for (const row of rows) accept(row);
      if (rows.length < 500) break;
      cursor = rows.at(-1).id;
    }
  }
  const cSelect = {
    id: true,
    generator: { select: { name: true, companyName: true } },
  };
  const lotScope = {
    cooperativeId,
    ...(restricted
      ? { originCollection: originScope }
      : {
          OR: [{ originCollectionId: null }, { originCollection: originScope }],
        }),
  };
  await pages(
    tx.wasteStockMovement,
    {
      cooperativeId,
      kind: { in: ["SALE", "DONATION", "DIRECT_DESTINATION", "DISPOSAL"] },
      ...(range ? { movementDate: range } : {}),
      lot: lotScope,
    },
    {
      id: true,
      lotId: true,
      kind: true,
      quantity: true,
      unit: true,
      movementDate: true,
      destinationName: true,
      environmentalDocument: true,
      lot: {
        select: {
          stockItemId: true,
          lotCode: true,
          originCollectionId: true,
          originCollectionMaterial: true,
          originCollection: { select: cSelect },
        },
      },
    },
    (r) => {
      if (!matches(r.lot.originCollectionMaterial, r.lot.stockItemId)) return;
      add(r.kind === "DISPOSAL" ? rejected : dispatched, r.quantity, r.unit);
      remember({
        id: r.id,
        lotId: r.lotId,
        lotCode: r.lot.lotCode,
        collectionId: r.lot.originCollectionId,
        date: r.movementDate,
        quantity: Number(r.quantity),
        unit: r.unit,
        kind: r.kind,
        destination: r.destinationName,
        origin:
          r.lot.originCollection?.generator?.companyName ||
          r.lot.originCollection?.generator?.name ||
          "Origem sem gerador vinculado",
        document: r.environmentalDocument || null,
      });
    },
  );
  await pages(
    tx.collectionWasteDestination,
    {
      cooperativeId,
      status: "ACTIVE",
      type: { in: ["DIRECT_DESTINATION", "REJECT", "DISPOSAL"] },
      ...(range ? { destinationDate: range } : {}),
      collectionWasteEntry: { collection: originScope },
    },
    {
      id: true,
      type: true,
      quantity: true,
      unit: true,
      destinationDate: true,
      destinationName: true,
      environmentalDocument: true,
      collectionWasteEntry: {
        select: {
          collectionId: true,
          wasteTypeId: true,
          collectionMaterial: true,
          collection: { select: cSelect },
        },
      },
    },
    (r) => {
      const e = r.collectionWasteEntry;
      if (!matches(e.collectionMaterial, e.wasteTypeId)) return;
      add(
        r.type === "DIRECT_DESTINATION" ? dispatched : rejected,
        r.quantity,
        r.unit,
      );
      remember({
        id: r.id,
        collectionId: e.collectionId,
        date: r.destinationDate,
        quantity: Number(r.quantity),
        unit: r.unit,
        kind: r.type,
        destination: r.destinationName,
        origin:
          e.collection?.generator?.companyName ||
          e.collection?.generator?.name ||
          "Origem sem gerador vinculado",
        document: r.environmentalDocument || null,
      });
    },
  );
  await pages(
    tx.wasteStockLot,
    { ...lotScope, status: { in: ["AVAILABLE", "RESERVED"] } },
    {
      id: true,
      stockItemId: true,
      availableQuantity: true,
      unit: true,
      originCollectionMaterial: true,
    },
    (r) => {
      if (matches(r.originCollectionMaterial, r.stockItemId))
        add(stock, r.availableQuantity, r.unit);
    },
  );
  return {
    dispatched,
    rejected,
    currentStock: stock,
    stockBasis:
      "Saldo atual, incluindo reservas; não é posição histórica no fim do período.",
    dateBasis:
      "Destinações pela data de saída, independentemente da data de coleta. Saídas registradas não comprovam reciclagem.",
    trace,
    total,
  };
}
