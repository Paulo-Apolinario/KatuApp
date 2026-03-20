import { z } from "zod";

export const registerPfSchema = z.object({
  displayName: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  phone: z.string().min(8, "Telefone inválido"),
  cpf: z.string().min(11, "CPF inválido"),
  address: z.string().optional(),
  rememberMe: z.boolean().optional().default(false),
});

export const registerCooperativeSchema = z.object({
  displayName: z.string().min(3, "Nome do responsável inválido"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  phone: z.string().min(8, "Telefone inválido"),
  cooperativeName: z.string().min(3, "Nome da cooperativa inválido"),
  registrationNumber: z.string().min(11, "Registro/CNPJ inválido"),
  address: z.string().optional(),
  rememberMe: z.boolean().optional().default(false),
});

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha inválida"),
});

export const activateGeneratorAccessSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

export type RegisterPfInput = z.infer<typeof registerPfSchema>;
export type RegisterCooperativeInput = z.infer<typeof registerCooperativeSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ActivateGeneratorAccessInput = z.infer<
  typeof activateGeneratorAccessSchema
>;
