import {
  calculationMode,
  referenceMatch,
  snapshotMaterialKnown,
} from "./reference-factors";
import { eligibleImpactFactor } from "./impact-factor";
import { impactMaterials } from "./impact.model";
export const metricFactors = {
  co2Kg: "co2PerKg",
  waterLiters: "waterPerKg",
  energyKwh: "energyPerKg",
  treesEquivalent: "treesPerKg",
} as const;
export type ImpactFilter = {
  materialId?: string;
  materialCode?: string;
  stage?: string;
};
export const civilDay = (d: any) =>
  new Date(new Date(d).getTime() - 10800000).toISOString().slice(0, 10);
export function profileFor(m: any, catalog: Map<string, any>) {
  const snapshot = m.identificationSnapshot;
  return {
    profile:
      snapshot?.confirmed?.profile ||
      snapshot?.declared ||
      catalog.get(m.wasteTypeId || m.materialId)?.technicalProfile ||
      {},
    basis: snapshot?.confirmed
      ? "CONFIRMED"
      : snapshot?.declared
        ? "DECLARED_SNAPSHOT"
        : "CURRENT_CATALOG",
  };
}
export function selectedAnalysisMaterials(
  c: any,
  catalog: Map<string, any>,
  filter: ImpactFilter,
) {
  return impactMaterials(c).filter((m: any) => {
    const source = c.collectionMaterials?.find((x: any) => x.id === m.id) || m;
    const { profile, basis } = profileFor(source, catalog);
    Object.assign(m, {
      profile,
      identificationBasis: basis,
      referenceWasteClass: catalog.get(m.materialId)?.wasteClass,
      referenceMaterialCode: !snapshotMaterialKnown(source)
        ? catalog.get(m.materialId)?.technicalProfile?.materialCode
        : undefined,
      referenceLabel: [
        source.subcategorySnapshot,
        !snapshotMaterialKnown(source)
          ? catalog.get(m.materialId)?.subcategory
          : undefined,
        !snapshotMaterialKnown(source)
          ? catalog.get(m.materialId)?.category
          : undefined,
      ]
        .filter(Boolean)
        .join(" "),
    });
    m.referenceFactor = referenceMatch(m).factor;
    return (
      (!filter.materialId || m.materialId === filter.materialId) &&
      (!filter.materialCode ||
        (profile.materialCode && profile.materialCode !== "UNKNOWN"
          ? profile.materialCode
          : m.referenceFactor?.materialCode || "UNKNOWN") ===
          filter.materialCode)
    );
  });
}
export function newImpactTotals() {
  return {
    collections: 0,
    totalMassKg: 0,
    confirmedMassKg: 0,
    provisionalMassKg: 0,
    units: {} as Record<string, number>,
    unknownUnits: {} as Record<string, number>,
    currentMappingUnits: {} as Record<string, number>,
    factorDiagnostics: {} as Record<string, Record<string, number>>,
    referenceMassKg: 0,
    referenceProvisionalMassKg: 0,
    metrics: Object.fromEntries(
      Object.keys(metricFactors).map((k) => [
        k,
        { value: null as number | null, coveredMassKg: 0 },
      ]),
    ),
  };
}
export function addImpact(
  total: ReturnType<typeof newImpactTotals>,
  c: any,
  ms: any[],
  methodology: any,
) {
  total.collections++;
  const confirmed = Boolean(c.quantitiesReviewedAt);
  for (const m of ms) {
    const q = Number(m.quantity);
    if (!Number.isFinite(q) || q < 0) continue;
    const unit = m.unit === "TON" ? "KG" : m.unit;
    const quantity = q * (m.unit === "TON" ? 1000 : 1);
    total.units[unit] = (total.units[unit] || 0) + quantity;
    if (!m.profile?.materialCode || m.profile.materialCode === "UNKNOWN")
      total.unknownUnits[unit] = (total.unknownUnits[unit] || 0) + quantity;
    if (m.identificationBasis === "CURRENT_CATALOG")
      total.currentMappingUnits[unit] =
        (total.currentMappingUnits[unit] || 0) + quantity;
    const diagnostic = (reason: string) => {
      const units = total.factorDiagnostics[reason] || {};
      units[unit] = (units[unit] || 0) + quantity;
      total.factorDiagnostics[reason] = units;
    };
    if (quantity === 0 && !confirmed) {
      diagnostic("MISSING_QUANTITY");
      continue;
    }
    if (unit !== "KG") {
      diagnostic("NON_MASS_UNIT");
      continue;
    }
    total.totalMassKg += quantity;
    total[confirmed ? "confirmedMassKg" : "provisionalMassKg"] += quantity;
    const factor = eligibleImpactFactor(c, m, methodology);
    if (!factor) {
      diagnostic(
        calculationMode(methodology) === "REFERENCE"
          ? referenceMatch(m).reason || "NO_COMPATIBLE_FACTOR"
          : calculationMode(methodology) === "DISABLED"
            ? "DISABLED"
            : "CUSTOM_REQUIREMENTS",
      );
      continue;
    }
    if (factor.calculationBasis === "REFERENCE") {
      total.referenceMassKg += quantity;
      if (!confirmed) total.referenceProvisionalMassKg += quantity;
    }
    for (const [key, field] of Object.entries(metricFactors)) {
      // Tree equivalents are only allowed for documented paper/cellulosic scenarios.
      if (
        key === "treesEquivalent" &&
        !["PAPER", "CARDBOARD"].includes(m.profile?.materialCode)
      )
        continue;
      const value = factor[field];
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      total.metrics[key].value =
        (total.metrics[key].value ?? 0) + quantity * value;
      total.metrics[key].coveredMassKg += quantity;
    }
  }
}
export function finishImpact(total: ReturnType<typeof newImpactTotals>) {
  return {
    ...total,
    ...Object.fromEntries(
      Object.entries(total.metrics).map(([k, m]) => [k, m.value]),
    ),
    metricCoverage: Object.fromEntries(
      Object.entries(total.metrics).map(([k, m]) => [k, m.coveredMassKg]),
    ),
    coveragePercent: total.totalMassKg
      ? (total.metrics.co2Kg.coveredMassKg / total.totalMassKg) * 100
      : 0,
  };
}
