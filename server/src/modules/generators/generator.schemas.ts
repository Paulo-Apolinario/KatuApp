import { z } from "zod";

export const createGeneratorSchema = z.object({
  type: z.enum(["SMALL", "LARGE"]),
  name: z.string().min(2, "Nome inválido"),
  companyName: z.string().optional(),
  email: z.string().email("E-mail inválido"),
  phone: z.string().optional(),
  address: z.string().optional(),
  status: z.string().optional(),
});

export const generatorIdParamsSchema = z.object({
  id: z.string().min(1, "ID inválido"),
});

export type CreateGeneratorInput = z.infer<typeof createGeneratorSchema>;
export type GeneratorIdParams = z.infer<typeof generatorIdParamsSchema>;
