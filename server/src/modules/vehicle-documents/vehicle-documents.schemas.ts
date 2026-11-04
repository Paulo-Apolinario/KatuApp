import { z } from "zod";

const documentDate = z.preprocess(value => value === "" ? null : value, z.string().refine(value => {
  if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value.slice(0, 10);
}, "Informe uma data válida.").nullable().optional());

export const createVehicleDocumentSchema = z.object({
  vehicle_id: z.string().min(1, "Veículo é obrigatório."),
  document_type: z.string().min(1, "Tipo do documento é obrigatório."),
  document_number: z.string().min(1, "Número do documento é obrigatório."),
  issue_date: documentDate,
  expiry_date: documentDate,
  notes: z.string().optional().nullable(),
});

export const updateVehicleDocumentSchema =
  createVehicleDocumentSchema.partial();

export type CreateVehicleDocumentInput = z.infer<
  typeof createVehicleDocumentSchema
>;
export type UpdateVehicleDocumentInput = z.infer<
  typeof updateVehicleDocumentSchema
>;
