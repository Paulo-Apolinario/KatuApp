import { z } from "zod";

export const createGeneratorSchema = z.object({
  type: z.enum(["SMALL", "LARGE"]),
  name: z.string().min(2, "Nome inválido"),
  companyName: z.string().optional(),
  email: z.string().email("E-mail inválido"),
  phone: z.string().optional(),

  // endereço estruturado
  zipCode: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),

  // endereço consolidado
  address: z.string().optional(),

  // coordenadas opcionais
  latitude: z.number().optional(),
  longitude: z.number().optional(),

  status: z.string().optional(),
});

export const generatorIdParamsSchema = z.object({
  id: z.string().min(1, "ID inválido"),
});

export type CreateGeneratorInput = z.infer<typeof createGeneratorSchema>;
export type GeneratorIdParams = z.infer<typeof generatorIdParamsSchema>;