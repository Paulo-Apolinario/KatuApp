import { z } from "zod";

export const createVehicleDocumentSchema = z.object({
  vehicle_id: z.string().optional().nullable(),
  document_type: z.string().min(1, "Tipo do documento é obrigatório."),
  document_number: z.string().min(1, "Número do documento é obrigatório."),
  issue_date: z.string().optional().nullable(),
  expiry_date: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateVehicleDocumentSchema = createVehicleDocumentSchema.partial();

export type CreateVehicleDocumentInput = z.infer<typeof createVehicleDocumentSchema>;
export type UpdateVehicleDocumentInput = z.infer<typeof updateVehicleDocumentSchema>;