import { z } from "zod";

const validDate = z.string().trim().refine(value => {
  if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value.slice(0, 10);
}, "Informe uma data válida no formato aaaa-mm-dd.");

export const createMaintenanceLogSchema = z.object({
  vehicle_id: z.string().trim().min(1, "Veículo é obrigatório."),
  maintenance_type: z.string().trim().min(1, "Tipo de manutenção é obrigatório."),
  maintenance_date: validDate,
  location: z.string().optional().nullable(),
  cost: z.coerce.number().min(0).optional().nullable(),
  performed_by: z.string().optional().nullable(),
  next_maintenance_date: z.preprocess(v => v === "" ? null : v, validDate.optional().nullable()),
  notes: z.string().optional().nullable(),
  status: z.string().optional().default("completed"),
});

export const updateMaintenanceLogSchema = createMaintenanceLogSchema.partial();

export type CreateMaintenanceLogInput = z.infer<typeof createMaintenanceLogSchema>;
export type UpdateMaintenanceLogInput = z.infer<typeof updateMaintenanceLogSchema>;