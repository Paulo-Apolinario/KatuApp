import { z } from "zod";
export const kinds = [
  "overview",
  "collections",
  "waste",
  "staff",
  "vehicles",
] as const;
export const dateBases = [
  "collectedAt",
  "receivedAt",
  "completedAt",
  "createdAt",
  "scheduledDate",
] as const;
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Data inválida.",
  );
export const querySchema = z
  .object({
    start: day,
    end: day,
    dateBasis: z.enum(dateBases).default("collectedAt"),
    binId: z.string().max(100).default(""),
    routeId: z.string().max(100).default(""),
    generatorId: z.string().max(100).default(""),
    collectorId: z.string().max(100).default(""),
    driverId: z.string().max(100).default(""),
    vehicleId: z.string().max(100).default(""),
    generatorType: z.enum(["", "SMALL", "LARGE"]).default(""),
    origin: z.enum(["", "GENERATOR", "PEV", "UNIDENTIFIED"]).default(""),
    city: z.string().max(100).default(""),
    status: z
      .enum([
        "",
        "PENDING",
        "IN_PROGRESS",
        "COLLECTED",
        "RECEIVED",
        "SORTING",
        "COMPLETED",
        "CANCELLED",
      ])
      .default(""),
    execution: z.enum(["", "EXECUTED", "MISSING_QUANTITY"]).default(""),
    search: z.string().trim().max(180).default(""),
    unit: z.enum(["", "KG", "TON", "LITER", "UNIT", "CUBIC_METER"]).default(""),
    materialId: z.string().max(100).default(""),
    stage: z
      .enum(["COLLECTED", "RECEIVED", "DESTINED", "STOCK"])
      .default("COLLECTED"),
    lotStatus: z
      .enum(["", "AVAILABLE", "RESERVED", "SOLD", "DISCARDED", "CANCELLED"])
      .default(""),
    processingStage: z
      .enum([
        "",
        "TRIADO",
        "TRITURADO",
        "PRENSADO",
        "ENFARDADO",
        "ARMAZENADO",
        "DESTINADO",
      ])
      .default(""),
    role: z.enum(["", "COLLECTOR", "DRIVER"]).default(""),
    assetStatus: z
      .enum(["", "AVAILABLE", "ON_ROUTE", "ACTIVE", "MAINTENANCE", "INACTIVE"])
      .default(""),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(5).max(100).default(20),
    sort: z.enum(["date", "name", "count", "massKg"]).default("date"),
    direction: z.enum(["asc", "desc"]).default("desc"),
    export: z.enum(["true", "false"]).default("false"),
  })
  .strict()
  .superRefine((v, c) => {
    const days = (Date.parse(v.end) - Date.parse(v.start)) / 86400000;
    if (days < 0 || days > 365)
      c.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecione um período válido de até 366 dias.",
        path: ["end"],
      });
  });
export type ReportQuery = z.infer<typeof querySchema>;
const nullable = z.number().finite().nonnegative().max(1e12).nullable();
export const configSchema = z
  .object({
    version: z.number().int().nonnegative(),
    goals: z
      .object({
        monthlyCollections: z.number().int().nonnegative().max(1e12).nullable(),
        monthlyMassKg: nullable,
      })
      .strict(),
    methodology: z
      .object({
        label: z.string().trim().max(180),
        source: z.string().trim().max(500),
        url: z.union([z.literal(""), z.string().url().max(1000)]),
        version: z.string().trim().max(80),
        factors: z
          .array(
            z
              .object({
                materialId: z.string().min(1).max(100),
                co2PerKg: z.number().finite().nonnegative().max(1e6),
              })
              .strict(),
          )
          .max(100),
      })
      .strict(),
  })
  .strict()
  .superRefine((v, c) => {
    if (
      v.methodology.factors.length &&
      (!v.methodology.label || !v.methodology.source || !v.methodology.version)
    )
      c.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Informe metodologia, fonte e versão para usar os fatores ambientais.",
      });
    if (
      new Set(v.methodology.factors.map((f) => f.materialId)).size !==
      v.methodology.factors.length
    )
      c.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Cada material pode ter somente um fator.",
      });
  });
export function period(q: Pick<ReportQuery, "start" | "end">) {
  return {
    gte: new Date(q.start + "T00:00:00-03:00"),
    lt: new Date(Date.parse(q.end + "T00:00:00-03:00") + 86400000),
  };
}
export function previous(q: ReportQuery) {
  const p = period(q),
    duration = p.lt.getTime() - p.gte.getTime();
  const civil = (d: number) =>
    new Date(d - 10800000).toISOString().slice(0, 10);
  return {
    ...q,
    start: civil(p.gte.getTime() - duration),
    end: civil(p.gte.getTime() - 86400000),
  };
}
