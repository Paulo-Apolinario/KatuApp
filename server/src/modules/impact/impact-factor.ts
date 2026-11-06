import {
  calculationMode,
  referenceMatch,
  snapshotMaterialKnown,
  REFERENCE_VERSION,
} from "./reference-factors";
/** One eligibility rule shared by environmental summaries and operational reports. */
export function eligibleImpactFactor(c: any, m: any, methodology: any) {
  const raw = c.collectionMaterials?.find((x: any) => x.id === m.id);
  const profile = raw?.identificationSnapshot?.confirmed?.profile;
  const mode = calculationMode(methodology);
  if (mode === "DISABLED") return null;
  if (mode === "REFERENCE") {
    const matched = referenceMatch({
      ...raw,
      ...m,
      referenceWasteClass: m.referenceWasteClass || raw?.wasteType?.wasteClass,
      referenceMaterialCode:
        m.referenceMaterialCode ||
        (!snapshotMaterialKnown(raw)
          ? raw?.wasteType?.technicalProfile?.materialCode
          : undefined),
      referenceLabel: [
        m.referenceLabel,
        !snapshotMaterialKnown(raw) ? raw?.wasteType?.subcategory : undefined,
      ]
        .filter(Boolean)
        .join(" "),
      profile:
        m.profile ||
        profile ||
        raw?.identificationSnapshot?.declared ||
        raw?.wasteType?.technicalProfile,
    });
    return matched.factor
      ? {
          ...matched.factor,
          materialId: m.materialId,
          calculationBasis: "REFERENCE",
          mapping: matched.mapping,
          version: REFERENCE_VERSION,
        }
      : null;
  }
  const date = c.collectedAt || c.receivedAt || c.completedAt || c.createdAt;
  const day = date
    ? new Date(new Date(date).getTime() - 10800000).toISOString().slice(0, 10)
    : "";
  if (
    !c.quantitiesReviewedAt ||
    !profile ||
    profile.identification !== "VERIFIED" ||
    ["UNKNOWN", "MIXED", "ELECTRONICS", "REJECT"].includes(
      profile.materialCode || "UNKNOWN",
    ) ||
    methodology?.approved !== true ||
    !methodology.source ||
    !methodology.version ||
    !methodology.approvedBy ||
    !methodology.region ||
    !methodology.processScenario ||
    !methodology.validFrom ||
    day < methodology.validFrom ||
    (methodology.validUntil && day > methodology.validUntil)
  )
    return null;
  return (
    methodology.factors?.find(
      (f: any) =>
        f.materialId === m.materialId &&
        f.materialCode === profile.materialCode,
    ) || null
  );
}
