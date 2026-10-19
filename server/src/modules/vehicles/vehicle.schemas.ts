import { z } from "zod";

export const createVehicleSchema = z.object({
  driverId: z.string().optional(),
  plate: z.string().min(3, "Placa inválida"),
  model: z.string().min(2, "Modelo inválido"),
  brand: z.string().optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  capacityKg: z.number().nonnegative("Capacidade inválida").optional(),
  status: z.enum(["ACTIVE", "MAINTENANCE", "INACTIVE"]).optional(),
});

export const updateVehicleSchema = createVehicleSchema.partial().extend({
  driverId: z.string().trim().min(1).nullable().optional(),
  plate: z.string().transform((value) => value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")).pipe(z.string().min(3, "Placa inválida")).optional(),
  model: z.string().trim().min(2, "Modelo inválido").optional(),
  brand: z.string().trim().nullable().optional(),
  year: z.number().int().min(1900).max(2100).nullable().optional(),
}).strict().refine((data) => Object.values(data).some((value) => value !== undefined), {
  message: "Informe ao menos um campo para atualizar.",
});

export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;

export const vehicleIdParamsSchema = z.object({
  id: z.string().min(1, "ID inválido"),
});

export const updateVehicleStatusSchema = z.object({
  status: z.enum(["ACTIVE", "MAINTENANCE", "INACTIVE"]),
});

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type VehicleIdParams = z.infer<typeof vehicleIdParamsSchema>;
export type UpdateVehicleStatusInput = z.infer<typeof updateVehicleStatusSchema>;