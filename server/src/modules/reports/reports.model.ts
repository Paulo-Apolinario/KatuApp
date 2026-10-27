import { creditedMaterials } from "../collector-teams/team.model";
export const EXECUTED = new Set([
  "COLLECTED",
  "RECEIVED",
  "SORTING",
  "COMPLETED",
]);
export const labels: Record<string, string> = {
  PENDING: "Pendente",
  IN_PROGRESS: "Em andamento",
  COLLECTED: "Coletada em campo",
  RECEIVED: "Recebida",
  SORTING: "Em triagem",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
  STOCK: "Entrada em estoque",
  TRIAGE: "Triagem",
  REJECT: "Rejeito",
  DISPOSAL: "Descarte",
  DIRECT_DESTINATION: "Destinação direta",
  RESERVATION: "Reserva",
  AVAILABLE: "Disponível",
  RESERVED: "Reservado",
  SOLD: "Vendido",
  DISCARDED: "Descartado",
  ACTIVE: "Ativo",
  MAINTENANCE: "Em manutenção",
  INACTIVE: "Inativo",
  ON_ROUTE: "Em rota",
  COLLECTOR: "Catador",
  DRIVER: "Motorista",
  SMALL: "Pequeno gerador",
  LARGE: "Grande gerador",
};
export const emptyConfig = {
  goals: { monthlyCollections: null, monthlyMassKg: null },
  methodology: { label: "", source: "", url: "", version: "", factors: [] },
};
export function amount(v: unknown) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
export function quantities(materials: any[]) {
  const units: Record<string, number> = {};
  for (const m of materials) {
    const q = amount(m.quantity);
    if (
      q != null &&
      ["KG", "TON", "LITER", "UNIT", "CUBIC_METER"].includes(m.unit)
    )
      units[m.unit] = (units[m.unit] || 0) + q;
  }
  return units;
}
export function mass(units: Record<string, number>) {
  return (units.KG || 0) + (units.TON || 0) * 1000;
}
export function materials(c: any) {
  if (!EXECUTED.has(c.status)) return [];
  if (c.collectionMaterials?.length)
    return c.collectionMaterials.map((m: any) => ({
      id: m.id,
      materialId: m.wasteTypeId,
      name: m.nameSnapshot,
      category: m.categorySnapshot,
      unit: m.unit,
      quantity: amount(m.quantity),
      entry: m.wasteEntry,
    }));
  // Somente peso legado explicitamente positivo; zero padrão não comprova pesagem.
  const kg = amount(c.totalWeightKg);
  return kg && kg > 0
    ? [
        {
          id: "legacy-" + c.id,
          materialId: null,
          name: "Peso legado sem classificação",
          category: "Legado",
          unit: "KG",
          quantity: kg,
          entry: null,
          legacy: true,
        },
      ]
    : [];
}
export function selectedMaterials(c: any, q: any) {
  return materials(c).filter(
    (m: any) =>
      (!q.unit || m.unit === q.unit) &&
      (!q.materialId || m.materialId === q.materialId),
  );
}
export function collectionRow(c: any, q: any) {
  const ms = selectedMaterials(c, q),
    units = quantities(ms);
  return {
    id: c.id,
    date:
      c[q.dateBasis] ||
      (q.dateBasis === "scheduledDate" ? c.schedule?.scheduledDate : null),
    name:
      c.bin?.name ||
      c.bin?.binId ||
      c.generator?.companyName ||
      c.generator?.name ||
      "Origem não identificada",
    origin: c.binId ? "PEV" : c.generatorId ? "Gerador" : "Não identificada",
    city: c.bin?.city || c.generator?.city || "Não informado",
    generatorType: labels[c.generator?.type] || "Não se aplica",
    status: labels[c.status] || c.status,
    collector: c.collector?.name || "Não informado",
    driver: c.driver?.name || "Não informado",
    vehicle: c.vehicle?.plate || "Não informado",
    route: c.route?.name || "Sem rota",
    units,
    massKg: mass(units),
    measured: ms.some((m: any) => m.quantity != null),
    materials: ms.map((m: any) => ({
      id: m.id,
      materialId: m.materialId,
      name: m.name,
      unit: m.unit,
      quantity: m.quantity,
      legacy: !!m.legacy,
    })),
    collectedAt: c.collectedAt,
    receivedAt: c.receivedAt,
    completedAt: c.completedAt,
    createdAt: c.createdAt,
    scheduledDate: c.schedule?.scheduledDate || null,
  };
}
export function summarize(collections: any[], q: any) {
  const ms = collections.flatMap((c) => selectedMaterials(c, q));
  return {
    records: collections.length,
    executed: collections.filter((c) => EXECUTED.has(c.status)).length,
    completed: collections.filter((c) => c.status === "COMPLETED").length,
    units: quantities(ms),
    massKg: mass(quantities(ms)),
    missingQuantity: collections.filter(
      (c) =>
        EXECUTED.has(c.status) &&
        !selectedMaterials(c, q).some((m: any) => m.quantity != null),
    ).length,
    legacy: ms.filter((m: any) => m.legacy).length,
    missingCollector: collections.filter(
      (c) => EXECUTED.has(c.status) && !c.collectorId,
    ).length,
    missingVehicle: collections.filter(
      (c) => EXECUTED.has(c.status) && !c.vehicleId,
    ).length,
    points: new Set(
      collections
        .filter((c) => EXECUTED.has(c.status))
        .map((c) => c.binId || c.generatorId)
        .filter(Boolean),
    ).size,
  };
}
export function buildCharts(collections: any[], q: any, config: any) {
  const series = new Map<string, any>(),
    byMaterial = new Map<string, any>(),
    points = new Map<string, any>(),
    status = new Map<string, number>();
  let coveredMass = 0,
    co2 = 0;
  for (const c of collections) {
    const ms = selectedMaterials(c, q);
    const date =
      q.dateBasis === "scheduledDate"
        ? c.schedule?.scheduledDate
        : c[q.dateBasis];
    const day = date
      ? new Date(new Date(date).getTime() - 10800000).toISOString().slice(0, 10)
      : "Sem data";
    const bucket = series.get(day) || { date: day, count: 0, units: {} };
    bucket.count++;
    bucket.units = addUnits(bucket.units, quantities(ms));
    series.set(day, bucket);
    status.set(c.status, (status.get(c.status) || 0) + 1);
    for (const m of ms) {
      const key = (m.materialId || m.name) + "|" + m.unit;
      const b = byMaterial.get(key) || {
        id: m.materialId || key,
        name: m.name,
        unit: m.unit,
        quantity: 0,
        collections: new Set(),
      };
      b.quantity += m.quantity || 0;
      b.collections.add(c.id);
      byMaterial.set(key, b);
      const factor = config.methodology?.factors?.find(
        (f: any) => f.materialId === m.materialId,
      );
      if (factor && ["KG", "TON"].includes(m.unit) && m.quantity != null) {
        const kg = m.quantity * (m.unit === "TON" ? 1000 : 1);
        coveredMass += kg;
        co2 += kg * factor.co2PerKg;
      }
    }
    const id = c.binId || c.generatorId;
    if (id && EXECUTED.has(c.status)) {
      const origin = c.bin || c.generator;
      const point = points.get(id) || {
        id,
        kind: c.binId ? "PEV" : "GENERATOR",
        name: origin.name || origin.companyName || origin.binId,
        latitude: origin.latitude,
        longitude: origin.longitude,
        city: origin.city,
        count: 0,
        units: {},
      };
      point.count++;
      point.units = addUnits(point.units, quantities(ms));
      points.set(id, point);
    }
  }
  return {
    series: [...series.values()].sort((a, b) => a.date.localeCompare(b.date)),
    materialTotals: [...byMaterial.values()]
      .map((b) => ({ ...b, count: b.collections.size, collections: undefined }))
      .sort((a, b) => b.quantity - a.quantity),
    statusCounts: [...status.entries()].map(([key, count]) => ({
      key,
      name: labels[key] || key,
      count,
    })),
    points: [...points.values()],
    environmental: {
      co2Kg: coveredMass > 0 ? co2 : null,
      coveredMassKg: coveredMass,
      totalMassKg: summarize(collections, q).massKg,
      methodology: config.methodology,
      description:
        "Potencial estimado dos materiais coletados com fator cadastrado; não comprova reciclagem ou crédito ambiental.",
    },
  };
}
export function addUnits(a: any, b: any) {
  const out = { ...a };
  for (const key of Object.keys(b)) out[key] = (out[key] || 0) + b[key];
  return out;
}
export function wasteRows(data: any, q: any) {
  if (q.stage === "STOCK")
    return data.lots.map((l: any) => ({
      id: l.id,
      name: l.stockItem.name,
      unit: l.unit,
      quantity: amount(l.availableQuantity),
      originalQuantity: amount(l.quantity),
      status: labels[l.status] || l.status,
      stage: l.processingStage,
      lotCode: l.lotCode || l.code || l.id,
      date: l.receivedAt,
      collectionId: l.originCollectionId,
      entryId: l.originCollectionWasteEntryId,
      origin: l.originCollection?.binId
        ? "PEV"
        : l.originCollection?.generatorId
          ? "Gerador"
          : "Sem coleta vinculada",
      storageLocation: l.storageLocation || "Não informado",
      units: quantities([{ quantity: l.availableQuantity, unit: l.unit }]),
      massKg: mass(
        quantities([{ quantity: l.availableQuantity, unit: l.unit }]),
      ),
    }));
  if (q.stage === "DESTINED")
    return data.destinations.map((d: any) => ({
      id: d.id,
      name: d.collectionWasteEntry.materialNameSnapshot,
      unit: d.unit,
      quantity: amount(d.quantity),
      status: labels[d.type] || d.type,
      date: d.destinationDate,
      destination: d.destinationName || "Não informado",
      collectionId: d.collectionWasteEntry.collectionId,
      entryId: d.collectionWasteEntryId,
      lotCode: d.stockLot?.lotCode || d.stockLot?.code || "Sem lote",
      units: quantities([d]),
      massKg: mass(quantities([d])),
    }));
  return data.collections.flatMap((c: any) =>
    selectedMaterials(c, q).map((m: any) => ({
      id: m.id,
      name: m.name,
      unit: m.unit,
      quantity: m.quantity,
      date: q.stage === "RECEIVED" ? c.receivedAt : collectionRow(c, q).date,
      status: labels[c.status],
      collectionId: c.id,
      entryId: m.entry?.id || null,
      pendingQuantity: amount(m.entry?.remainingQuantity),
      pendingUnit: m.unit,
      source: m.legacy ? "Peso legado" : "Material normalizado",
      units: quantities([m]),
      massKg: mass(quantities([m])),
    })),
  );
}
export function assetRows(data: any, q: any, kind: string) {
  const collections = data.collections;
  const create = (asset: any, role: string) => {
    const matches = collections.filter(
      (c: any) =>
        c[
          role === "COLLECTOR"
            ? "collectorId"
            : role === "DRIVER"
              ? "driverId"
              : "vehicleId"
        ] === asset.id || (role === "COLLECTOR" && c.participants?.some((p: any) => p.collectorId === asset.id)),
    );
    const sum = summarize(matches, q);
    if (role === "COLLECTOR") {
      sum.units = quantities(matches.flatMap((c: any) => c.participants?.length ? creditedMaterials(c, asset.id).filter((m: any) => (!q.unit || m.unit === q.unit) && (!q.materialId || c.collectionMaterials?.some((cm: any) => cm.id === m.materialId && cm.wasteTypeId === q.materialId))) : selectedMaterials(c, q)));
      sum.massKg = mass(sum.units);
    }
    const routes = new Set(matches.map((c: any) => c.routeId).filter(Boolean));
    const routeAssigned = data.routes.filter(
      (r: any) =>
        r[role === "DRIVER" ? "driverId" : "vehicleId"] === asset.id &&
        (!q.routeId || r.id === q.routeId),
    );
    return {
      id: role + "-" + asset.id,
      rawId: asset.id,
      name:
        role === "VEHICLE"
          ? [asset.plate, asset.brand, asset.model].filter(Boolean).join(" · ")
          : asset.name,
      role: role === "VEHICLE" ? "Veículo" : labels[role],
      status: labels[asset.status] || asset.status,
      count: sum.executed,
      units: sum.units,
      massKg: sum.massKg,
      missingQuantity: sum.missingQuantity,
      routes: routes.size,
      assignedRoutes: routeAssigned.length,
      capacityKg: role === "VEHICLE" ? asset.capacityKg : null,
      maintenanceCost:
        role === "VEHICLE"
          ? data.maintenance
              .filter((m: any) => m.vehicleId === asset.id)
              .reduce((s: number, m: any) => s + (amount(m.cost) || 0), 0)
          : null,
      maintenanceWithoutCost:
        role === "VEHICLE"
          ? data.maintenance.filter(
              (m: any) => m.vehicleId === asset.id && m.cost == null,
            ).length
          : 0,
      expiringDocuments:
        role === "VEHICLE"
          ? data.documents.filter((d: any) => d.vehicleId === asset.id).length
          : 0,
      collectionIds: matches.map((c: any) => c.id),
    };
  };
  const rows =
    kind === "vehicles"
      ? data.vehicles.map((v: any) => create(v, "VEHICLE"))
      : [
          ...data.collectors.map((v: any) => create(v, "COLLECTOR")),
          ...data.drivers.map((v: any) => create(v, "DRIVER")),
        ];
  return rows.filter(
    (r: any) =>
      (!q.role || r.role === labels[q.role]) &&
      (!q.assetStatus || r.status === labels[q.assetStatus]) &&
      (!q.search ||
        r.name
          .toLocaleLowerCase("pt-BR")
          .includes(q.search.toLocaleLowerCase("pt-BR"))),
  );
}
