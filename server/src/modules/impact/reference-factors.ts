/** EPA WARM v16 (December 2023), Management Practices: Exhibits 1-1 and 7-12.
 * Scenario: modeled US landfilling -> recycling. Screening reference, not a Brazilian inventory.
 * Keep the original values so units, signs and both scenarios remain auditable.
 */
export const REFERENCE_VERSION = "epa-warm-v16-2023-12-katua-1";
export const REFERENCE_URL =
  "https://www.epa.gov/system/files/documents/2024-01/warm_management_practices_v16_dec.pdf";
export const SHORT_TON_KG = 907.18474;
export const MMBTU_TO_KWH = 293.0710701722222; // International Table Btu: 1055.05585262 J.
const raw = [
  [
    "ALUMINUM_CANS",
    "ALUMINUM",
    "Latas de alumínio",
    "Aluminum Cans",
    -9.13,
    0.02,
    -152.76,
    0.27,
  ],
  [
    "ALUMINUM_INGOT",
    "ALUMINUM",
    "Lingote de alumínio",
    "Aluminum Ingot",
    -7.2,
    0.02,
    -113.85,
    0.27,
  ],
  [
    "STEEL_CANS",
    "STEEL",
    "Latas de aço",
    "Steel Cans",
    -1.83,
    0.02,
    -19.97,
    0.27,
  ],
  [
    "COPPER_WIRE",
    "COPPER",
    "Fios de cobre",
    "Copper Wire",
    -4.49,
    0.02,
    -82.59,
    0.27,
  ],
  ["GLASS", "GLASS", "Vidro de embalagem", "Glass", -0.28, 0.02, -2.13, 0.27],
  ["HDPE", "HDPE", "PEAD", "HDPE", -0.76, 0.02, -44.78, 0.27],
  ["PET", "PET", "PET", "PET", -1.04, 0.02, -28.59, 0.27],
  ["PP", "PP", "PP — Polipropileno", "PP", -0.79, 0.02, -44.5, 0.27],
  [
    "CORRUGATED",
    "CARDBOARD",
    "Papelão ondulado",
    "Corrugated Containers",
    -3.14,
    0.18,
    -15.1,
    -0.21,
  ],
  [
    "MIXED_PAPER",
    "PAPER",
    "Papel misto",
    "Mixed Paper (general)",
    -3.55,
    0.07,
    -20.56,
    -0.17,
  ],
  [
    "OFFICE_PAPER",
    "PAPER",
    "Papel de escritório",
    "Office Paper",
    -2.86,
    1.13,
    -10.08,
    -0.47,
  ],
  ["NEWSPAPER", "PAPER", "Jornal", "Newspaper", -2.71, -0.85, -16.49, 0.07],
] as const;
export const referenceFactors = raw.map(
  ([
    id,
    materialCode,
    label,
    sourceMaterial,
    recyclingCo2,
    landfillCo2,
    recyclingEnergy,
    landfillEnergy,
  ]) =>
    Object.freeze({
      id,
      materialCode,
      label,
      sourceMaterial,
      source: "US EPA — WARM v16, dezembro de 2023",
      url: REFERENCE_URL,
      version: REFERENCE_VERSION,
      region: "Estados Unidos — referência internacional, sem calibração local",
      co2PerKg: ((landfillCo2 - recyclingCo2) * 1000) / SHORT_TON_KG,
      energyPerKg:
        ((landfillEnergy - recyclingEnergy) * MMBTU_TO_KWH) / SHORT_TON_KG,
      waterPerKg: null,
      treesPerKg: null,
      original: {
        recyclingCo2,
        landfillCo2,
        co2Unit: "t CO2e/short ton",
        recyclingEnergy,
        landfillEnergy,
        energyUnit: "million Btu/short ton",
      },
      scenario:
        "Aterro modelado nos EUA versus reciclagem; emissões e energia líquidas, incluindo créditos de substituição da produção primária no WARM.",
      limitations:
        "Estimativa de cenário, não medição de reciclagem realizada, inventário local ou crédito de carbono. Papel inclui hipóteses de carbono florestal. Água e árvores não possuem fator nesta base. Não adicionar novamente créditos de produção primária, transporte ou perdas já incluídos no modelo.",
    }),
);
const normalize = (s: any) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const codes: [string, RegExp][] = [
  ["ALUMINUM", /\baluminio\b/],
  ["COPPER", /\bcobre\b/],
  ["STEEL", /\baco\b/],
  ["PET", /\bpet\b/],
  ["PP", /\bpp\b|\bpolipropileno\b/],
  ["HDPE", /\bpead\b|\bhdpe\b/],
  ["LDPE", /\bpebd\b|\bldpe\b/],
  ["PVC", /\bpvc\b/],
  ["PS", /\bps\b|\bpoliestireno\b/],
  ["CARDBOARD", /\bpapelao\b/],
  ["PAPER", /\bpapel\b|\bjornal\b/],
  ["GLASS", /\bvidro\b/],
];
export function snapshotMaterialKnown(m: any) {
  const p =
    m?.identificationSnapshot?.confirmed?.profile ||
    m?.identificationSnapshot?.declared;
  return Boolean(p?.materialCode && p.materialCode !== "UNKNOWN");
}
export function referenceMatch(m: any) {
  const p =
    m.profile ||
    m.identificationSnapshot?.confirmed?.profile ||
    m.identificationSnapshot?.declared ||
    {};
  const text = normalize(
    [
      m.name || m.nameSnapshot,
      m.category || m.categorySnapshot,
      m.subcategory || m.subcategorySnapshot,
      m.referenceLabel,
      p.presentation,
    ].join(" "),
  );
  const declared =
    p.materialCode && p.materialCode !== "UNKNOWN"
      ? p.materialCode
      : m.referenceMaterialCode && m.referenceMaterialCode !== "UNKNOWN"
        ? m.referenceMaterialCode
        : null;
  if (
    m.referenceWasteClass === "CLASS_I" ||
    p.hazardClass === "CLASS_1" ||
    p.hazardClass === "CLASS_I" ||
    (p.contaminants &&
      !/^(nenhum|nenhuma|sem contaminantes|nao|não)$/i.test(
        p.contaminants.trim(),
      ))
  )
    return { factor: null, reason: "CONDITIONS_REVIEW" };
  if (
    /\beletron|\blampada|\bespelho|\btemperado|\bceramica|\bcontaminad|\bmulticam|\blonga vida|\bcomposito|\bmistura|\brejeito/.test(
      text,
    )
  )
    return { factor: null, reason: "NO_COMPATIBLE_FACTOR" };
  if (
    p.materialCode === "UNKNOWN" &&
    (m.identificationBasis === "CONFIRMED" ||
      m.identificationSnapshot?.confirmed)
  )
    return { factor: null, reason: "IDENTIFICATION_UNKNOWN" };
  const matches = [
    ...new Set(
      codes.filter(([, regex]) => regex.test(text)).map(([code]) => code),
    ),
  ];
  if (declared && matches.some((code) => code !== declared))
    return { factor: null, reason: "AMBIGUOUS_MATERIAL" };
  if (!declared && matches.length > 1)
    return { factor: null, reason: "AMBIGUOUS_MATERIAL" };
  const code = declared || matches[0];
  let id: string | undefined;
  if (["PP", "PET", "HDPE"].includes(code)) id = code;
  if (code === "CARDBOARD") id = "CORRUGATED";
  if (code === "PAPER")
    id = /\bjornal\b/.test(text)
      ? "NEWSPAPER"
      : /\ba4\b|\bsulfite\b|\bescritorio\b|\bbranco\b/.test(text)
        ? "OFFICE_PAPER"
        : "MIXED_PAPER";
  if (code === "GLASS") id = "GLASS";
  if (code === "ALUMINUM")
    id = /\blatinha\b|\blatas?\b/.test(text)
      ? "ALUMINUM_CANS"
      : /\blingote\b/.test(text)
        ? "ALUMINUM_INGOT"
        : undefined;
  if (code === "STEEL" && /\blatas?\b|\blatinha\b/.test(text))
    id = "STEEL_CANS";
  if (code === "COPPER" && /\bfios?\b|\bcabos?\b/.test(text))
    id = "COPPER_WIRE";
  const factor = referenceFactors.find((f) => f.id === id) || null;
  return {
    factor,
    reason: factor
      ? null
      : code
        ? "NO_COMPATIBLE_FACTOR"
        : "IDENTIFICATION_UNKNOWN",
    mapping: declared ? "DECLARED_MATERIAL" : "CATALOG_LABEL_REFERENCE",
  };
}
export function calculationMode(
  methodology: any,
): "REFERENCE" | "CUSTOM" | "DISABLED" {
  return (
    methodology?.calculationMode ||
    (methodology?.approved && methodology?.factors?.length
      ? "CUSTOM"
      : "REFERENCE")
  );
}
export function referenceMethodology() {
  return {
    calculationMode: "REFERENCE",
    label: "Referência automática internacional — EPA WARM v16",
    source: "US EPA — WARM v16, Management Practices, quadros 1-1 e 7-12",
    url: REFERENCE_URL,
    version: REFERENCE_VERSION,
    approved: false,
    approvedBy: "",
    region: referenceFactors[0].region,
    processScenario: referenceFactors[0].scenario,
    validFrom: "",
    validUntil: "",
    factors: referenceFactors,
  };
}
