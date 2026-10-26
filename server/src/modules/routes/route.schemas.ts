import { pointsSchema, pointSchema, locationSchema } from "./planning.schemas";
import { z } from "zod";

const collectionIds = z
  .array(z.string().trim().min(1))
  .max(200, "Selecione até 200 coletas por rota.")
  .refine(
    (ids) => new Set(ids).size === ids.length,
    "Não repita uma coleta na rota.",
  );
const brDateRegex = /^\d{2}\/\d{2}\/\d{4}$/;

export const createRouteSchema = z.object({
  visitOrder: z.array(z.string().min(1)).max(200).optional(),
  pointUpdates: z
    .array(z.object({ collectionId: z.string().min(1), point: pointSchema }))
    .max(100)
    .refine(
      (items) =>
        new Set(items.map((i) => i.collectionId)).size === items.length,
      "Não repita atualizações de uma mesma coleta.",
    )
    .optional(),
  plannedPoints: pointsSchema.optional(),
  collectorIds: z.array(z.string().min(1)).max(30).optional(),
  startPoint: locationSchema.optional(),
  endPoint: locationSchema.optional(),
  departureTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional(),
  estimatedMinutes: z.number().int().min(15).max(1440).optional(),
  expectedRevision: z.number().int().min(0).optional(),
  driverId: z.string().optional(),
  vehicleId: z.string().optional(),
  name: z.string().trim().min(2, "Nome inválido").max(120),
  description: z.string().trim().max(3000).optional(),

  // 🔥 DATA NO PADRÃO BR
  scheduledDate: z
    .string()
    .regex(brDateRegex, "Data inválida. Use o formato DD/MM/AAAA.")
    .optional(),

  // 🔥 STOPS CORRETO (string[])
  stops: z.array(z.string().trim().min(1).max(500)).max(100).default([]),
  collectionIds: collectionIds.optional(),

  status: z
    .enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"])
    .optional(),
});

export const routeIdParamsSchema = z.object({
  id: z.string().min(1, "ID inválido"),
});

export const routeCollectionParamsSchema = z.object({
  id: z.string().min(1, "ID da rota inválido"),
  collectionId: z.string().min(1, "ID da coleta inválido"),
});

export const updateRouteStatusSchema = z.object({
  status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
});

export const updateRouteAssignmentsSchema = z
  .object({
    visitOrder: z.array(z.string().min(1)).max(200).optional(),
    pointUpdates: z
      .array(z.object({ collectionId: z.string().min(1), point: pointSchema }))
      .max(100)
      .refine(
        (items) =>
          new Set(items.map((i) => i.collectionId)).size === items.length,
        "Não repita atualizações de uma mesma coleta.",
      )
      .optional(),
    plannedPoints: pointsSchema.optional(),
    collectorIds: z.array(z.string().min(1)).max(30).optional(),
    startPoint: locationSchema.optional(),
    endPoint: locationSchema.optional(),
    departureTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .optional(),
    estimatedMinutes: z.number().int().min(15).max(1440).optional(),
    expectedRevision: z.number().int().min(0).optional(),

    driverId: z.string().trim().min(1).nullable().optional(),
    vehicleId: z.string().trim().min(1).nullable().optional(),
    name: z.string().trim().min(2, "Nome inválido").max(120).optional(),
    description: z.string().trim().max(3000).nullable().optional(),

    // 🔥 DATA BR TAMBÉM AQUI
    scheduledDate: z
      .string()
      .regex(brDateRegex, "Data inválida. Use o formato DD/MM/AAAA.")
      .nullable()
      .optional(),

    status: z
      .enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"])
      .optional(),

    // 🔥 STOPS TIPADO CORRETAMENTE
    stops: z.array(z.string().trim().min(1).max(500)).max(100).optional(),
    collectionIds: collectionIds.optional(),
  })
  .strict()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Informe ao menos um campo para atualizar.",
  });

export type CreateRouteInput = z.infer<typeof createRouteSchema>;
export type RouteIdParams = z.infer<typeof routeIdParamsSchema>;
export type RouteCollectionParams = z.infer<typeof routeCollectionParamsSchema>;
export type UpdateRouteStatusInput = z.infer<typeof updateRouteStatusSchema>;
export type UpdateRouteAssignmentsInput = z.infer<
  typeof updateRouteAssignmentsSchema
>;
