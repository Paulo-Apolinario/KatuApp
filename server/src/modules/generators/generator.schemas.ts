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

export const updateGeneratorSchema = createGeneratorSchema
  .omit({ email: true, status: true })
  .partial()
  .extend({
    latitude: z.number().finite().min(-90).max(90).optional(),
    longitude: z.number().finite().min(-180).max(180).optional(),
  })
  .strict()
  .refine((data) => (data.latitude === undefined) === (data.longitude === undefined), {
    message: "Informe latitude e longitude juntas.",
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Informe ao menos um dado para atualizar.",
  });
export type UpdateGeneratorInput = z.infer<typeof updateGeneratorSchema>;
