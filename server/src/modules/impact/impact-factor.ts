/** One eligibility rule shared by environmental summaries and operational reports. */
export function eligibleImpactFactor(c: any, m: any, methodology: any) {
  const raw = c.collectionMaterials?.find((x: any) => x.id === m.id);
  const profile = raw?.identificationSnapshot?.confirmed?.profile;
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
