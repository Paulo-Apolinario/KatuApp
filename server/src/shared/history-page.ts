import { z } from "zod";
/** Opt-in: legacy list clients keep their response contract. */
export const historyPageSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000),
  limit: z.coerce.number().int().min(1).max(50).default(25),
  until: z.string().datetime().optional(),
});
export type HistoryPage = z.infer<typeof historyPageSchema>;
export function pageQuery(query: unknown): HistoryPage | undefined {
  const q = query as Record<string, unknown>;
  return q?.page === undefined ? undefined : historyPageSchema.parse(q);
}
export function pageResult(total: number, page: HistoryPage) {
  return { page: page.page, limit: page.limit, total, hasMore: page.page * page.limit < total, until: page.until };
}
