import { z } from "zod";

export const civilDay = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = Date.parse(value + "T12:00:00Z");
    return (
      Number.isFinite(parsed) &&
      new Date(parsed).toISOString().slice(0, 10) === value
    );
  }, "Data inválida.");
export const normalizeLocation = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export const participationQuery = z
  .object({
    start: day,
    end: day,
    profile: z.enum(["", "PF", "SMALL", "LARGE"]).default(""),
    city: z.string().max(100).transform(normalizeLocation).default(""),
    state: z.string().max(30).transform(normalizeLocation).default(""),
    neighborhood: z.string().max(120).transform(normalizeLocation).default(""),
    group: z.enum(["week", "month"]).default("week"),
    search: z.string().trim().max(120).default(""),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(5).max(50).default(20),
  })
  .strict()
  .superRefine((q, ctx) => {
    const span = (Date.parse(q.end) - Date.parse(q.start)) / 86400000;
    if (span < 0 || span > 365)
      ctx.addIssue({
        code: "custom",
        path: ["end"],
        message: "Selecione um período de até 366 dias.",
      });
    if (q.end > civilDay())
      ctx.addIssue({
        code: "custom",
        path: ["end"],
        message: "A data final não pode estar no futuro.",
      });
  });
export type ParticipationQuery = z.infer<typeof participationQuery>;
export function bounds(q: ParticipationQuery, now = new Date()) {
  const start = new Date(q.start + "T00:00:00-03:00");
  const nextDay = new Date(Date.parse(q.end + "T00:00:00-03:00") + 86400000);
  return {
    start,
    end: new Date(Math.min(nextDay.getTime(), now.getTime())),
    now,
    partial: nextDay > now,
  };
}
