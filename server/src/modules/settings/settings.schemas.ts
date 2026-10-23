import { z } from "zod";
const text = (max = 180) => z.string().trim().max(max);
const optionalEmail = z.union([
  z.literal(""),
  z.string().trim().email().max(254),
]);
export const categories = [
  "COLLECTION",
  "WASTE",
  "DOCUMENT",
  "MAINTENANCE",
  "PEV",
  "SMTP",
  "PROFILE",
] as const;
export const defaults = {
  company: {
    legalName: "",
    responsibleName: "",
    responsiblePosition: "",
    website: "",
    logo: "",
  },
  preferences: {
    workingDays: [1, 2, 3, 4, 5],
    openAt: "08:00",
    closeAt: "17:00",
    documentAdvanceDays: 30,
    collectionOverdueHours: 24,
    pendingWasteDays: 7,
    emailEnabled: false,
    frequency: "DAILY",
    digestHour: 8,
    recipients: [] as string[],
    categories: [...categories],
  },
};
export const companySchema = z
  .object({
    version: z.number().int().nonnegative(),
    name: text().min(2),
    registrationNumber: text(18),
    email: optionalEmail,
    phone: text(30),
    zipCode: text(9),
    street: text(250),
    number: text(30),
    neighborhood: text(),
    city: text(),
    state: z.union([z.literal(""), z.string().regex(/^[A-Z]{2}$/)]),
    address: text(500),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    legalName: text(250),
    responsibleName: text(),
    responsiblePosition: text(),
    website: z.union([
      z.literal(""),
      z
        .string()
        .url()
        .max(500)
        .regex(/^https?:\/\//),
    ]),
    logo: z.string().max(350000),
  })
  .strict()
  .superRefine((v, c) => {
    if ((v.latitude === null) !== (v.longitude === null))
      c.addIssue({
        code: "custom",
        message: "Informe latitude e longitude juntas.",
      });
    if (v.registrationNumber && !validCnpj(v.registrationNumber))
      c.addIssue({ code: "custom", message: "CNPJ inválido." });
    if (
      v.logo &&
      !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(v.logo)
    )
      c.addIssue({
        code: "custom",
        message: "Use logotipo PNG ou JPEG de até 250 KB.",
      });
    if (v.logo) {
      const b = Buffer.from(v.logo.split(",")[1] || "", "base64");
      if (
        b.length > 256000 ||
        !(
          b
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
          b.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
        )
      )
        c.addIssue({
          code: "custom",
          message: "Imagem inválida ou acima de 250 KB.",
        });
    }
  });
export function validCnpj(v: string) {
  const s = v.replace(/[.\/\-\s]/g, "").toUpperCase();
  if (!/^[A-Z0-9]{12}\d{2}$/.test(s) || /^(\d)\1+$/.test(s)) return false;
  const digit = (n: number) => {
    let sum = 0,
      p = n - 7;
    for (let i = 0; i < n; i++) {
      sum += (s.charCodeAt(i) - 48) * p;
      p = p === 2 ? 9 : p - 1;
    }
    return sum % 11 < 2 ? 0 : 11 - (sum % 11);
  };
  return digit(12) === Number(s[12]) && digit(13) === Number(s[13]);
}
export const prefsSchema = z
  .object({
    version: z.number().int().nonnegative(),
    workingDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    openAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    closeAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    documentAdvanceDays: z.number().int().min(1).max(180),
    collectionOverdueHours: z.number().int().min(1).max(720),
    pendingWasteDays: z.number().int().min(1).max(365),
    emailEnabled: z.boolean(),
    frequency: z.enum(["IMMEDIATE", "DAILY"]),
    digestHour: z.number().int().min(0).max(23),
    recipients: z.array(z.string().trim().email().max(254)).max(5),
    categories: z.array(z.enum(categories)).max(7),
  })
  .strict()
  .superRefine((v, c) => {
    if (v.closeAt <= v.openAt)
      c.addIssue({
        code: "custom",
        message: "O encerramento deve ser posterior à abertura no mesmo dia.",
      });
    if (v.emailEnabled && (!v.recipients.length || !v.categories.length))
      c.addIssue({
        code: "custom",
        message: "Escolha destinatários e categorias para ativar os e-mails.",
      });
    if (new Set(v.workingDays).size !== v.workingDays.length)
      c.addIssue({ code: "custom", message: "Dias repetidos." });
  });
export const smtpSchema = z
  .object({
    version: z.number().int().nonnegative(),
    enabled: z.boolean(),
    host: z
      .string()
      .trim()
      .min(3)
      .max(253)
      .regex(/^[a-zA-Z0-9.-]+$/),
    port: z.union([z.literal(465), z.literal(587), z.literal(2525)]),
    security: z.enum(["TLS", "STARTTLS"]),
    username: text(254).min(1),
    password: z.string().max(1000).optional(),
    fromName: text().min(1),
    fromAddress: z.string().trim().email().max(254),
    replyTo: optionalEmail,
  })
  .strict()
  .superRefine((v, c) => {
    if ((v.port === 465) !== (v.security === "TLS"))
      c.addIssue({
        code: "custom",
        message: "Porta 465 usa TLS; 587 e 2525 usam STARTTLS.",
      });
  });
