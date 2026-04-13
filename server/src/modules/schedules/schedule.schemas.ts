import { z } from "zod";

export const createScheduleSchema = z.object({
  generatorId: z.string().optional(),
  cooperativeId: z.string().min(1, "Cooperativa é obrigatória."),
  preferredDate: z.string().datetime().optional(),
  scheduledDate: z.string().datetime().optional(),
  requestedMaterials: z
    .array(z.string().min(1))
    .min(1, "Informe ao menos um tipo de resíduo"),
  notes: z.string().optional(),
});

export const scheduleIdParamsSchema = z.object({
  id: z.string().min(1, "ID inválido"),
});

export const updateScheduleStatusSchema = z.object({
  status: z.enum([
    "REQUESTED",
    "SCHEDULED",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED",
  ]),
});

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type ScheduleIdParams = z.infer<typeof scheduleIdParamsSchema>;
export type UpdateScheduleStatusInput = z.infer<
  typeof updateScheduleStatusSchema
>;