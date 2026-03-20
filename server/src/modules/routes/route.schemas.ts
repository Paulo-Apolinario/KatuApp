import { z } from "zod";

export const createRouteSchema = z.object({
  driverId: z.string().optional(),
  vehicleId: z.string().optional(),
  name: z.string().min(2, "Nome inválido"),
  routeDate: z.string().datetime().optional(),
  points: z.array(z.string().min(1)).default([]),
  status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
});

export const routeIdParamsSchema = z.object({
  id: z.string().min(1, "ID inválido"),
});

export const updateRouteStatusSchema = z.object({
  status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
});

export type CreateRouteInput = z.infer<typeof createRouteSchema>;
export type RouteIdParams = z.infer<typeof routeIdParamsSchema>;
export type UpdateRouteStatusInput = z.infer<typeof updateRouteStatusSchema>;
