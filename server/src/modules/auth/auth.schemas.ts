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

const identifierFields = {
  identifier: z.string().trim().min(3).max(255).optional(),
  email: z.string().trim().min(3).max(255).optional(), // Existing app versions.
};
export const loginSchema = z.object({ ...identifierFields, password: z.string().min(6, "Senha inválida").max(256) })
  .refine(data => Boolean(data.identifier || data.email), "Informe e-mail ou celular.")
  .transform(data => ({ identifier: data.identifier || data.email!, password: data.password }));
export const activateGeneratorAccessSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});
export const forgotPasswordSchema = z.object({
  ...identifierFields,
  identifierType: z.enum(["EMAIL", "PHONE", "CPF"]).optional(),
  audience: z.enum(["APP", "PANEL"]).default("APP"),
}).refine(data => Boolean(data.identifier || data.email), "Informe CPF, celular ou e-mail.")
  .transform(data => ({ ...data, identifier: data.identifier || data.email! }));
export const requestLoginLinkSchema = z.object({
  email: z.string().trim().email("E-mail inválido"),
  audience: z.enum(["APP", "PANEL"]).default("APP"),
  profile: z.enum(["pf", "comercial", "grande", "cooperativa", "catador", "motorista"]).optional(),
});
export const consumeLoginLinkSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/, "Link inválido ou expirado."),
  audience: z.enum(["APP", "PANEL"]),
});

export const resetPasswordSchema = z
  .object({
    email: z.preprocess(value => value === "" ? undefined : value, z.string().email("E-mail inválido").optional()),
    token: z.string().min(1, "Token inválido"),

    temporaryPassword: z.string().optional(),
    temporary_password: z.string().optional(),

    password: z.string().optional(),
    newPassword: z.string().optional(),

    password_confirmation: z.string().optional(),
    confirmPassword: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const temporaryPassword =
      data.temporaryPassword || data.temporary_password;

    const newPassword = data.newPassword || data.password;

    const confirmation =
      data.confirmPassword || data.password_confirmation;

    if (!temporaryPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["temporaryPassword"],
        message: "Senha temporária é obrigatória.",
      });
    }

    if (!newPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message: "Nova senha é obrigatória.",
      });
    }

    if (newPassword && newPassword.length < 6) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message: "A nova senha deve ter pelo menos 6 caracteres.",
      });
    }

    if (!confirmation) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password_confirmation"],
        message: "Confirmação de senha é obrigatória.",
      });
    }

    if (newPassword && confirmation && newPassword !== confirmation) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password_confirmation"],
        message: "As senhas não coincidem.",
      });
    }
  });

export type RegisterPfInput = z.infer<typeof registerPfSchema>;
export type RegisterCooperativeInput = z.infer<typeof registerCooperativeSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ActivateGeneratorAccessInput = z.infer<
  typeof activateGeneratorAccessSchema
>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;