import { sessionService } from "./sessionService";
export type HistoryPage<T> = {
  items: T[];
  pagination: { page: number; limit: number; total: number; hasMore: boolean; until?: string };
};
export function historyQuery(page: number, until: string) {
  return `page=${page}&limit=25&until=${encodeURIComponent(until)}`;
}

/** Explicit export only: every page must succeed before creating a consolidated document. */
export async function loadCompleteHistory<T extends { id: string }>(fetchPage: (page: number, until: string) => Promise<HistoryPage<T>>) {
  const owner = (await sessionService.getSession())?.userId;
  if (!owner) throw new Error("Entre novamente para gerar o comprovante.");
  const until = new Date().toISOString();
  const items = new Map<string, T>();
  let page = 1;
  while (true) {
    if ((await sessionService.getSession())?.userId !== owner) throw new Error("A conta mudou. Solicite o comprovante novamente.");
    const result = await fetchPage(page, until);
    result.items.forEach(item => items.set(item.id, item));
    if (!result.pagination.hasMore) break;
    if (!result.items.length || page >= 100000) throw new Error("Não foi possível confirmar o histórico completo. Tente novamente.");
    page++;
  }
  if ((await sessionService.getSession())?.userId !== owner) throw new Error("A conta mudou. Solicite o comprovante novamente.");
  return [...items.values()];
}
