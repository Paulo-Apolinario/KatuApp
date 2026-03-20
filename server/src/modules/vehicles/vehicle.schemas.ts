import { z } from "zod";

export const createVehicleSchema = z.object({
  driverId: z.string().optional(),
  plate: z.string().min(3, "Placa inválida"),
  model: z.string().optional(),
  capacityKg: z.number().nonnegative("Capacidade inválida").optional(),
  status: z.enum(["ACTIVE", "MAINTENANCE", "INACTIVE"]).optional(),
});

export const vehicleIdParamsSchema = z.object({
  id: z.string().min(1, "ID inválido"),
});

export const updateVehicleStatusSchema = z.object({
  status: z.enum(["ACTIVE", "MAINTENANCE", "INACTIVE"]),
});

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type VehicleIdParams = z.infer<typeof vehicleIdParamsSchema>;
export type UpdateVehicleStatusInput = z.infer<typeof updateVehicleStatusSchema>;
