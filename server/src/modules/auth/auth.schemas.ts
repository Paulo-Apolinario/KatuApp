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

  zipCode: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),

  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
});

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha inválida"),
});

export const activateGeneratorAccessSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("E-mail inválido"),
});

export const resetPasswordSchema = z
  .object({
    email: z.string().email("E-mail inválido"),
    token: z.string().min(6, "Token inválido"),
    newPassword: z.string().min(6, "A nova senha deve ter pelo menos 6 caracteres"),
    confirmPassword: z
      .string()
      .min(6, "A confirmação da senha deve ter pelo menos 6 caracteres"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

export type RegisterPfInput = z.infer<typeof registerPfSchema>;
export type RegisterCooperativeInput = z.infer<typeof registerCooperativeSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ActivateGeneratorAccessInput = z.infer<
  typeof activateGeneratorAccessSchema
>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;