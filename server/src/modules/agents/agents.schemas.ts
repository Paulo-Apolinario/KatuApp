import { z } from "zod";
export const agentKey = z.enum(["COLLECTIONS", "ROUTES", "MANAGER"]);
export const commandKey = z.enum([
  "PENDING_COLLECTIONS",
  "OVERDUE_REQUESTS",
  "COLLECTION_PRIORITIES",
  "SCHEDULED_ROUTES",
  "ROUTES_ATTENTION",
  "OPERATIONAL_SUMMARY",
  "ATTENTION_OCCURRENCES",
]);
export const id = z.string().trim().min(1).max(100);
export const eventId = z
  .string()
  .regex(
    /^[a-zA-Z0-9_-]{8,100}$/,
    "Use um identificador de evento de 8 a 100 letras, números, traços ou sublinhados.",
  );
export const configSchema = z
  .object({
    enabled: z.boolean(),
    automationsEnabled: z.boolean().optional(),
    notificationsEnabled: z.boolean().optional(),
    intervalMinutes: z.number().int().min(15).max(1440).optional(),
    expectedVersion: z.number().int().min(0),
    eventId,
  })
  .strict();
export const runSchema = z.object({ eventId }).strict();
export const chatSchema = z
  .object({
    eventId,
    text: z.string().trim().min(1).max(800).optional(),
    command: commandKey.optional(),
    conversationId: id.optional(),
  })
  .strict()
  .refine(
    (x) => Number(!!x.text) + Number(!!x.command) === 1,
    "Informe um texto ou um comando estruturado.",
  );
export const decisionSchema = z
  .object({
    eventId,
    status: z.enum(["APPROVED", "REJECTED"]),
    expectedVersion: z.number().int().min(1),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();
export const pageSchema = z
  .object({
    cursor: id.optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();
export const runQuery = pageSchema.extend({
  agent: agentKey.optional(),
  status: z.enum(["RUNNING", "SUCCEEDED", "FAILED"]).optional(),
});
export const proposalQuery = pageSchema.extend({
  status: z
    .enum(["PENDING", "APPROVED", "REJECTED", "EXECUTED", "FAILED"])
    .optional(),
});
