import { z } from "zod";

const optionalTrimmedString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === "" ? undefined : value));

export const createGeneratorSchema = z.object({
  type: z.enum(["SMALL", "LARGE"]),
  name: z.string().trim().min(2, "Nome inválido"),
  companyName: optionalTrimmedString,
  email: z.string().trim().email("E-mail inválido"),
  phone: optionalTrimmedString,

  zipCode: optionalTrimmedString,
  street: optionalTrimmedString,
  number: optionalTrimmedString,
  neighborhood: optionalTrimmedString,
  city: optionalTrimmedString,
  state: optionalTrimmedString,

  address: optionalTrimmedString,

  latitude: z.number().finite().optional(),
  longitude: z.number().finite().optional(),

  status: optionalTrimmedString,
});

export const generatorIdParamsSchema = z.object({
  id: z.string().trim().min(1, "ID inválido"),
});

export type CreateGeneratorInput = z.infer<typeof createGeneratorSchema>;
export type GeneratorIdParams = z.infer<typeof generatorIdParamsSchema>;