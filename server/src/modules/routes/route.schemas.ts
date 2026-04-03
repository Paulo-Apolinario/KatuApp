import { z } from "zod";

const brDateRegex = /^\d{2}\/\d{2}\/\d{4}$/;

export const createRouteSchema = z.object({
  driverId: z.string().optional(),
  vehicleId: z.string().optional(),
  name: z.string().min(2, "Nome inválido"),
  description: z.string().optional(),

  // 🔥 DATA NO PADRÃO BR
  scheduledDate: z
    .string()
    .regex(brDateRegex, "Data inválida. Use o formato DD/MM/AAAA.")
    .optional(),

  // 🔥 STOPS CORRETO (string[])
  stops: z.array(z.string().min(1, "Parada inválida")).default([]),

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

export const updateRouteAssignmentsSchema = z.object({
  driverId: z.string().nullable().optional(),
  vehicleId: z.string().nullable().optional(),
  name: z.string().min(2, "Nome inválido").optional(),
  description: z.string().nullable().optional(),

  // 🔥 DATA BR TAMBÉM AQUI
  scheduledDate: z
    .string()
    .regex(brDateRegex, "Data inválida. Use o formato DD/MM/AAAA.")
    .nullable()
    .optional(),

  // 🔥 STOPS TIPADO CORRETAMENTE
  stops: z.array(z.string().min(1, "Parada inválida")).optional(),
});

export type CreateRouteInput = z.infer<typeof createRouteSchema>;
export type RouteIdParams = z.infer<typeof routeIdParamsSchema>;
export type RouteCollectionParams = z.infer<typeof routeCollectionParamsSchema>;
export type UpdateRouteStatusInput = z.infer<typeof updateRouteStatusSchema>;
export type UpdateRouteAssignmentsInput = z.infer<
  typeof updateRouteAssignmentsSchema
>;