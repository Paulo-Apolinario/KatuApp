import { z } from "zod";

const materialItemSchema = z.object({
  type: z.string().min(1, "Tipo de material inválido"),
  quantityKg: z.number().nonnegative("Quantidade inválida"),
});

export const createCollectionSchema = z.object({
  scheduleId: z.string().min(1, "Agendamento inválido"),
  collectorId: z.string().min(1, "Catador inválido"),
  driverId: z.string().optional(),
  vehicleId: z.string().optional(),
  routeId: z.string().optional(),
  collectedAt: z.string().datetime().optional(),
  totalWeightKg: z.number().nonnegative().optional(),
  materials: z.array(materialItemSchema).optional(),
  notes: z.string().optional(),
});

export const collectionIdParamsSchema = z.object({
  id: z.string().min(1, "ID inválido"),
});

export const updateCollectionStatusSchema = z.object({
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
  collectedAt: z.string().datetime().optional(),
  totalWeightKg: z.number().nonnegative().optional(),
  materials: z.array(materialItemSchema).optional(),
  notes: z.string().optional(),
});

export type CreateCollectionInput = z.infer<typeof createCollectionSchema>;
export type UpdateCollectionStatusInput = z.infer<typeof updateCollectionStatusSchema>;
export type CollectionIdParams = z.infer<typeof collectionIdParamsSchema>;