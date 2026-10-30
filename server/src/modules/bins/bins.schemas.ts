import { z } from "zod";
const text = (max = 255) => z.string().trim().max(max).nullable().optional();
const positive = z.coerce.number().finite().positive().nullable().optional();
const coordinate = (min: number, max: number) =>
  z.coerce.number().finite().min(min).max(max).nullable().optional();
export const binStatusSchema = z.enum([
  "active",
  "inactive",
  "maintenance",
  "full",
]);
const interval = z
  .object({
    start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  })
  .strict()
  .refine(
    (v) => v.start < v.end,
    "O fim do horário deve ser posterior ao início.",
  );
const hours = z
  .array(
    z
      .object({
        day: z.number().int().min(0).max(6),
        intervals: z.array(interval).max(4),
      })
      .strict(),
  )
  .max(7)
  .superRefine((days, ctx) => {
    if (new Set(days.map((d) => d.day)).size !== days.length)
      ctx.addIssue({ code: "custom", message: "Dia da semana repetido." });
    for (const d of days) {
      const sorted = [...d.intervals].sort((a, b) =>
        a.start.localeCompare(b.start),
      );
      if (sorted.some((v, i) => i && v.start < sorted[i - 1].end))
        ctx.addIssue({ code: "custom", message: "Horários sobrepostos." });
    }
  });
const shape = {
  bin_id: z.string().trim().min(1, "Informe o código do PEV.").max(100),
  name: text(150),
  publicAccess: z.boolean().optional(),
  pointKind: z.enum(["PEV", "ECOPONTO", "PARTNER", "COOPERATIVE"]).optional(),
  bin_type: text(50),
  location: text(500),
  vehicle_id: text(100),
  capacity_kg: positive,
  notes: text(2000),
  last_collection_date: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .optional(),
  status: binStatusSchema.optional(),
  zipCode: z
    .string()
    .regex(/^\d{8}$/, "Informe um CEP com 8 dígitos.")
    .nullable()
    .optional(),
  street: text(),
  number: text(30),
  neighborhood: text(100),
  city: text(100),
  state: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .nullable()
    .optional(),
  regional: text(100),
  reference: text(),
  latitude: coordinate(-90, 90),
  longitude: coordinate(-180, 180),
  acceptedMaterials: z
    .array(z.string().trim().min(1).max(100))
    .max(30)
    .optional(),
  restrictions: text(1500),
  openingHours: hours.nullable().optional(),
  hoursExceptions: text(1000),
  responsibleName: text(150),
  responsibleContact: text(100),
  capacityValue: positive,
  capacityUnit: z.enum(["KG", "LITER", "CUBIC_METER"]).nullable().optional(),
  needsPickup: z.boolean().optional(),
  pickupReason: text(1000),
};
function pairCoordinates(
  data: { latitude?: number | null; longitude?: number | null },
  ctx: z.RefinementCtx,
) {
  if (
    Object.hasOwn(data, "latitude") !== Object.hasOwn(data, "longitude") ||
    (data.latitude == null) !== (data.longitude == null)
  )
    ctx.addIssue({
      code: "custom",
      path: ["latitude"],
      message: "Informe latitude e longitude juntas, ou limpe ambas.",
    });
}
export const createBinSchema = z
  .object(shape)
  .strict()
  .superRefine(pairCoordinates);
export const updateBinSchema = z
  .object(shape)
  .partial()
  .strict()
  .refine((d) => Object.keys(d).length > 0, "Nenhuma alteração informada.")
  .superRefine(pairCoordinates);
export const binEventSchema = z
  .object({
    kind: z.enum(["INSPECTION", "INCIDENT"]),
    notes: z.string().trim().min(3).max(1500),
    condition: z.enum(["GOOD", "DAMAGED", "CONTAMINATED"]).optional(),
    needsPickup: z.boolean().optional(),
  })
  .strict();
export const binPickupSchema = z
  .object({
    collectorId: z.string().min(1),
    routeId: z.string().min(1).nullable().optional(),
    notes: text(1500),
  })
  .strict();
export type CreateBinInput = z.infer<typeof createBinSchema>;
export type UpdateBinInput = z.infer<typeof updateBinSchema>;
