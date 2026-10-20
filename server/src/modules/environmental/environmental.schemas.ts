import { z } from "zod";
export const MUNICIPALITIES = [
  { code: "2307254", name: "Jijoca de Jericoacoara", state: "CE", pilot: true },
  { code: "2304251", name: "Cruz", state: "CE", pilot: true },
  { code: "2312908", name: "Sobral", state: "CE", pilot: true },
  { code: "2304400", name: "Fortaleza", state: "CE", pilot: false },
];
const text = (max = 1000) => z.string().trim().max(max);
const yesNo = z.enum(["UNKNOWN", "YES", "NO"]).default("UNKNOWN");
const quantity = z
  .number()
  .finite()
  .nonnegative()
  .max(1e12)
  .nullable()
  .default(null);
export const municipality = z
  .string()
  .refine(
    (v) => MUNICIPALITIES.some((m) => m.code === v),
    "Selecione um município habilitado.",
  );
export const unitSchema = z
  .object({
    municipalityCode: municipality,
    name: text(180).min(3),
    taxId: text(14).regex(
      /^(\d{14})?$/,
      "Informe CNPJ com 14 dígitos ou deixe em branco.",
    ),
    officialUnitCode: text(40).regex(/^\d*$/),
    address: text(500),
    responsibleName: text(180),
    responsiblePosition: text(180),
    appointmentReference: text(500),
    operationalRoles: z
      .array(
        z.enum([
          "GENERATOR",
          "TRANSPORTER",
          "TEMPORARY_STORAGE",
          "DESTINATION",
          "LR_OPERATOR",
          "LR_MANAGER",
          "FINAL_RECYCLER",
        ]),
      )
      .max(7),
    environment: z.enum(["HOMOLOGATION", "PRODUCTION"]),
    shareWithMunicipality: z.boolean().default(false),
  })
  .strict();
export const version = z.number().int().positive();
export const families = [
  "MTR_REGULAR",
  "MTR_LR_ORIGIN",
  "MTR_LR_PROCESS",
  "CDF",
  "MUNICIPAL_DECLARATION",
] as const;
const party = z
  .object({
    name: text(180).default(""),
    taxId: text(14).default(""),
    officialUnitCode: text(40).default(""),
    municipalityCode: text(7).default(""),
    address: text(500).default(""),
  })
  .strict();
const material = z
  .object({
    name: text(180),
    ibamaCode: text(20).regex(/^[\d .-]*$/),
    quantity,
    unit: z.enum(["KG", "TON", "LITER", "CUBIC_METER"]),
    physicalStateCode: text(40),
    classificationCode: text(40),
    packagingCode: text(40),
    treatmentCode: text(40),
  })
  .strict();
const manifest = z
  .object({
    origin: party,
    carrier: party,
    recipient: party,
    vehiclePlate: text(10),
    driverName: text(180),
    departureDate: text(30),
    materials: z.array(material).max(50),
    originManifestNumbers: z.array(text(80)).max(50),
    invoiceNumber: text(40),
    invoiceAccessKey: text(44),
    notes: text(4000),
  })
  .strict();
const cdf = z
  .object({
    manifestNumbers: z.array(text(80)).max(100),
    periodStart: text(10),
    periodEnd: text(10),
    treatmentDescription: text(4000),
    technicalResponsible: text(180),
    technicalRegistration: text(100),
    notes: text(4000),
  })
  .strict();
const declaration = z
  .object({
    diagnosis: z
      .object({
        coverage: z.enum(["OPERATIONAL_ONLY", "MUNICIPAL_CONSOLIDATED"]),
        wasteRows: z
          .array(
            z
              .object({
                category: text(180),
                quantity,
                unit: z.enum(["KG", "TON"]),
                destination: text(300),
                source: text(500),
              })
              .strict(),
          )
          .max(100),
        selectiveTargetTon: quantity,
        recyclingTargetTon: quantity,
        targetYear: z.number().int().min(2000).max(2100).nullable(),
        notes: text(4000),
      })
      .strict(),
    costs: z
      .object({
        sharedServices: text(4000),
        participatingMunicipalities: text(1000),
        cleaningCost: quantity,
        selectiveCost: quantity,
        disposalCost: quantity,
        source: text(500),
      })
      .strict(),
    areas: z
      .object({
        masterPlan: yesNo,
        zoning: yesNo,
        description: text(4000),
        evidence: text(1000),
      })
      .strict(),
    income: z
      .object({
        initiatives: text(4000),
        organizations: text(2000),
        source: text(1000),
      })
      .strict(),
    liabilities: z
      .object({
        exists: yesNo,
        description: text(4000),
        locations: text(2000),
        evidence: text(1000),
      })
      .strict(),
    delivery: z
      .object({
        responsibleName: text(180),
        position: text(180),
        appointmentReference: text(500),
        coverageNotes: text(4000),
        reviewNotes: text(4000),
      })
      .strict(),
  })
  .strict();
export const documentSchema = z
  .object({
    unitId: z.string().min(1).max(100),
    family: z.enum(families),
    title: text(180).min(3),
    referenceYear: z.number().int().min(2000).max(2100).nullable(),
    sourceCollectionId: z.string().max(100).nullable(),
    payload: z.unknown(),
  })
  .strict()
  .transform((v) => ({
    ...v,
    payload: (v.family === "MUNICIPAL_DECLARATION"
      ? declaration
      : v.family === "CDF"
        ? cdf
        : manifest
    ).parse(v.payload),
  }));
export const editDocumentSchema = z
  .object({
    version,
    title: text(180).min(3),
    referenceYear: z.number().int().min(2000).max(2100).nullable(),
    payload: z.unknown(),
  })
  .strict();
export const transitionSchema = z
  .object({
    version,
    action: z.enum(["REQUEST_REVIEW", "APPROVE", "REOPEN", "ARCHIVE"]),
    notes: text(2000).default(""),
  })
  .strict();
export const accessSchema = z
  .object({
    userId: z.string().min(1).max(100),
    municipalityCode: municipality,
    permission: z.enum(["VIEWER", "EDITOR", "REVIEWER"]),
    appointmentReference: text(500).min(3),
    active: z.boolean(),
  })
  .strict();
export function validatePayload(family: string, payload: unknown) {
  return (
    family === "MUNICIPAL_DECLARATION"
      ? declaration
      : family === "CDF"
        ? cdf
        : manifest
  ).parse(payload);
}
export function validTaxId(raw: string) {
  const d = raw.replace(/\D/g, "");
  if (/^(\d)\1+$/.test(d)) return false;
  const mod = (numbers: number[], weights: number[]) => {
    const r = numbers.reduce((s, n, i) => s + n * weights[i], 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const n = [...d].map(Number);
  if (d.length === 14)
    return (
      n[12] === mod(n.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) &&
      n[13] === mod(n.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
    );
  if (d.length === 11)
    return (
      n[9] === mod(n.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]) &&
      n[10] === mod(n.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2])
    );
  return false;
}
