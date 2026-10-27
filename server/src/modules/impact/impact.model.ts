import {
  materials,
  mass,
  quantities,
  EXECUTED,
} from "../reports/reports.model";
export const impactDate = (c: any) =>
  c.collectedAt || c.receivedAt || c.completedAt || c.createdAt;
export const civilMonth = (d: Date | string) =>
  new Date(new Date(d).getTime() - 10800000).toISOString().slice(0, 7);
const factors = {
  co2Kg: "co2PerKg",
  waterLiters: "waterPerKg",
  energyKwh: "energyPerKg",
  treesEquivalent: "treesPerKg",
} as const;
function impactMaterials(c: any): any[] {
  const normalized = materials(c);
  if (normalized.length || !EXECUTED.has(c.status)) return normalized;
  let legacy = c.materials;
  if (typeof legacy === "string") {
    try {
      legacy = JSON.parse(legacy);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(legacy)) return [];
  return legacy.flatMap((m: any, i: number) => {
    let unit = m.unit,
      quantity = m.quantity;
    if (
      quantity == null &&
      m.quantityKg != null &&
      (!unit || ["KG", "TON"].includes(unit))
    ) {
      unit = "KG";
      quantity = m.quantityKg;
    }
    if (
      !["KG", "TON", "LITER", "UNIT", "CUBIC_METER"].includes(unit) ||
      quantity == null ||
      !Number.isFinite(Number(quantity)) ||
      Number(quantity) < 0
    )
      return [];
    return [
      {
        id: m.id || `legacy-${c.id}-${i}`,
        materialId: m.wasteTypeId || null,
        name: m.name || m.type || "Material legado",
        unit,
        quantity: Number(quantity),
      },
    ];
  });
}
export function impactSummary(rows: any[], methodology: any) {
  const totals: any = {
    collections: rows.length,
    totalMassKg: 0,
    provisionalMassKg: 0,
    confirmedMassKg: 0,
    legacyDateCollections: rows.filter((c) => !c.collectedAt).length,
    metricCoverage: {},
  };
  for (const key of Object.keys(factors)) {
    totals[key] = null;
    totals.metricCoverage[key] = 0;
  }
  const byMaterial = new Map<string, any>();
  for (const c of rows) {
    const ms = impactMaterials(c),
      kg = mass(quantities(ms));
    totals.totalMassKg += kg;
    if (c.quantitiesReviewedAt || c.status === "COMPLETED")
      totals.confirmedMassKg += kg;
    else totals.provisionalMassKg += kg;
    for (const m of ms) {
      const b = byMaterial.get(m.name + "|" + m.unit) || {
        name: m.name,
        unit: m.unit,
        quantity: 0,
      };
      b.quantity += Number(m.quantity || 0);
      byMaterial.set(m.name + "|" + m.unit, b);
      if (!["KG", "TON"].includes(m.unit) || !m.quantity) continue;
      const q = Number(m.quantity) * (m.unit === "TON" ? 1000 : 1);
      const f = methodology?.factors?.find(
        (f: any) => f.materialId === m.materialId,
      );
      for (const [key, field] of Object.entries(factors))
        if (
          typeof f?.[field] === "number" &&
          Number.isFinite(f[field]) &&
          f[field] >= 0
        ) {
          totals[key] = (totals[key] ?? 0) + q * f[field];
          totals.metricCoverage[key] += q;
        }
    }
  }
  totals.coveredMassKg = totals.metricCoverage.co2Kg;
  totals.coveragePercent = totals.totalMassKg
    ? (totals.coveredMassKg / totals.totalMassKg) * 100
    : 0;
  return { ...totals, materials: [...byMaterial.values()] };
}
export function monthlyImpact(
  rows: any[],
  schedules: any[],
  orders: any[],
  year: number,
  methodology: any,
) {
  return Array.from({ length: 12 }, (_, i) => {
    const month = `${year}-${String(i + 1).padStart(2, "0")}`;
    const ss = schedules.filter((s) => civilMonth(s.createdAt) === month),
      os = orders.filter((o) => civilMonth(o.createdAt) === month);
    return {
      month,
      ...impactSummary(
        rows.filter((c) => civilMonth(impactDate(c)) === month),
        methodology,
      ),
      requests: ss.length,
      pendingRequests: ss.filter((s) =>
        ["REQUESTED", "SCHEDULED", "IN_PROGRESS"].includes(s.status),
      ).length,
      extraOrders: os.length,
      pendingExtraOrders: os.filter((o) =>
        ["PENDING_REVIEW", "NEEDS_INFO"].includes(o.status),
      ).length,
    };
  });
}
