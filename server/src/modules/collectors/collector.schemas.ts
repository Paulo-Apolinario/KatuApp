import { z } from "zod";

export const createCollectorSchema = z.object({
  name: z.string().min(2, "Nome inválido"),
  email: z.string().email("E-mail inválido"),
  phone: z.string().optional(),
  rg: z.string().optional(),
  birthDate: z.string().optional(),
  status: z.enum(["AVAILABLE", "ON_ROUTE", "INACTIVE"]).optional(),
});

export const collectorIdParamsSchema = z.object({
  id: z.string().min(1, "ID inválido"),
});

export const updateCollectorStatusSchema = z.object({
  status: z.enum(["AVAILABLE", "ON_ROUTE", "INACTIVE"], {
    errorMap: () => ({ message: "Status inválido" }),
  }),
});

export type CreateCollectorInput = z.infer<typeof createCollectorSchema>;
export type CollectorIdParams = z.infer<typeof collectorIdParamsSchema>;
export type UpdateCollectorStatusInput = z.infer<
  typeof updateCollectorStatusSchema
>;