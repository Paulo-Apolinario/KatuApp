import { useCallback, useEffect, useRef, useState } from "react";
import type { HistoryPage } from "../services/historyPage";
/** Failed refresh retains visible records and pagination; a new refresh uses a new snapshot. */
export function useHistoryPages<T extends { id: string }>(fetchPage: (page: number, until: string) => Promise<HistoryPage<T>>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState({ page: 0, total: 0, hasMore: false, until: "" });
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const active = useRef(true), lock = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const load = useCallback(async (more = false) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    const until = more ? meta.until : new Date().toISOString();
    try {
      const result = await fetchPage(more ? meta.page + 1 : 1, until);
      if (!active.current) return;
      setItems(previous => Array.from(new Map((more ? [...previous, ...result.items] : result.items).map(item => [item.id, item])).values()));
      setMeta({ ...result.pagination, until }); setUpdatedAt(new Date().toISOString());
    } catch (e: any) {
      if (active.current) setError(e?.message || "Não foi possível atualizar. Os registros já carregados foram preservados.");
    } finally {
      lock.current = false;
      if (active.current) { setBusy(false); setLoading(false); }
    }
  }, [fetchPage, meta.page, meta.until]);
  return { items, loading, busy, error, meta, updatedAt, load };
}
