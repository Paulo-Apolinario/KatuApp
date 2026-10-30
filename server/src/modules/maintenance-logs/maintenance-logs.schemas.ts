import { z } from "zod";

export const createMaintenanceLogSchema = z.object({
  vehicle_id: z.string().min(1, "Veículo é obrigatório."),
  maintenance_type: z.string().min(1, "Tipo de manutenção é obrigatório."),
  maintenance_date: z.string().min(1, "Data da manutenção é obrigatória."),
  location: z.string().optional().nullable(),
  cost: z.coerce.number().min(0).optional().nullable(),
  performed_by: z.string().optional().nullable(),
  next_maintenance_date: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.string().optional().default("completed"),
});

export const updateMaintenanceLogSchema = createMaintenanceLogSchema.partial();

export type CreateMaintenanceLogInput = z.infer<typeof createMaintenanceLogSchema>;
export type UpdateMaintenanceLogInput = z.infer<typeof updateMaintenanceLogSchema>;