import { z } from "zod";

export const cooperativeIdParamsSchema = z.object({
  id: z.string().min(1, "ID da cooperativa é obrigatório."),
});

export const updateCooperativeLocationSchema = z.object({
  zipCode: z.string().trim().optional().nullable(),
  street: z.string().trim().optional().nullable(),
  number: z.string().trim().optional().nullable(),
  neighborhood: z.string().trim().optional().nullable(),
  city: z.string().trim().optional().nullable(),
  state: z.string().trim().optional().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
});

export type UpdateCooperativeLocationInput = z.infer<
  typeof updateCooperativeLocationSchema
>;