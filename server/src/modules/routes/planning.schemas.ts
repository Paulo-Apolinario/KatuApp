import { z } from "zod";
export const dateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Data inválida.",
  );
export const locationSchema = z.object({
  name: z.string().trim().min(2).max(150),
  address: z.string().trim().min(5).max(500),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});
export const pointSchema = locationSchema
  .extend({
    key: z.string().min(1).max(100),
    kind: z.enum(["GENERATOR", "PEV", "ADDRESS"]),
    sourceId: z.string().max(100).optional(),
    zipCode: z.string().max(9).optional(),
    phone: z.string().max(30).optional(),
    notes: z.string().max(1000).optional(),
    materials: z.string().max(500).optional(),
    collectorId: z.string().optional(),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  })
  .superRefine((v, c) => {
    if (v.kind !== "ADDRESS" && !v.sourceId)
      c.addIssue({
        code: "custom",
        message: "Selecione o cadastro de origem.",
      });
  });
export const pointsSchema = z
  .array(pointSchema)
  .max(100)
  .refine(
    (p) => new Set(p.map((x) => x.key)).size === p.length,
    "Não repita identificadores de pontos.",
  )
  .refine(
    (p) =>
      new Set(p.filter((x) => x.sourceId).map((x) => x.kind + ":" + x.sourceId))
        .size === p.filter((x) => x.sourceId).length,
    "O mesmo cadastro já está no roteiro.",
  );
export const planSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(3000).default(""),
    active: z.boolean().default(true),
    startsOn: dateKeySchema,
    endsOn: dateKeySchema.nullable().optional(),
    weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    intervalWeeks: z.number().int().min(1).max(2).default(1),
    departureTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    estimatedMinutes: z.number().int().min(15).max(1440).default(240),
    driverId: z.string().nullable().optional(),
    vehicleId: z.string().nullable().optional(),
    teamId: z.string().min(1).max(100).nullable().optional(),
    collectorIds: z.array(z.string().min(1)).min(1).max(30),
    points: pointsSchema.refine(
      (p) => p.length > 0,
      "Adicione ao menos um ponto.",
    ),
    startPoint: locationSchema,
    endPoint: locationSchema,
    exceptions: z.array(dateKeySchema).max(366).default([]),
    expectedVersion: z.number().int().min(0).optional(),
    applyToScheduled: z.boolean().default(false),
  })
  .superRefine((p, c) => {
    if (
      p.points.some(
        (point) =>
          point.weekdays?.length &&
          !point.weekdays.some((day) => p.weekdays.includes(day)),
      )
    )
      c.addIssue({
        code: "custom",
        message:
          "Os dias específicos de cada ponto devem coincidir com os dias do roteiro.",
      });
    if (p.endsOn && p.endsOn < p.startsOn)
      c.addIssue({
        code: "custom",
        message: "O fim deve ser posterior ao início.",
      });
  });
export type RoutePoint = z.infer<typeof pointSchema>;
export type PlanInput = z.infer<typeof planSchema>;
export const optimizeSchema = z.object({
  start: locationSchema,
  end: locationSchema,
  points: pointsSchema.refine(
    (p) => p.length > 0 && p.length <= 60,
    "Otimize de 1 a 60 pontos por consulta.",
  ),
});
