import { z } from "zod";

export const binStatusSchema = z.enum([
  "ACTIVE",
  "INACTIVE",
  "FULL",
  "MAINTENANCE",
]);

export const createBinSchema = z.object({
  bin_id: z.string().min(1, "Código da lixeira é obrigatório."),
  bin_type: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  vehicle_id: z.string().optional().nullable(),
  capacity_kg: z.coerce.number().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
  photo_url: z.string().optional().nullable(),
  last_collection_date: z.string().optional().nullable(),
  status: z.string().optional().default("active"),
});

export const updateBinSchema = createBinSchema.partial();

export type CreateBinInput = z.infer<typeof createBinSchema>;
export type UpdateBinInput = z.infer<typeof updateBinSchema>;