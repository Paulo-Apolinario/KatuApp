import { z } from "zod";

export const createCollectionSchema = z.object({
  scheduleId: z.string().min(1, "Agendamento é obrigatório"),
  collectedAt: z.string().datetime().optional(),
  totalWeightKg: z.number().nonnegative("Peso inválido"),
  materials: z.array(z.string().min(1)).min(1, "Informe ao menos um material"),
  notes: z.string().optional(),
});

export const collectionIdParamsSchema = z.object({
  id: z.string().min(1, "ID inválido"),
});

export const updateCollectionStatusSchema = z.object({
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
});

export type CreateCollectionInput = z.infer<typeof createCollectionSchema>;
export type CollectionIdParams = z.infer<typeof collectionIdParamsSchema>;
export type UpdateCollectionStatusInput = z.infer<
  typeof updateCollectionStatusSchema
>;