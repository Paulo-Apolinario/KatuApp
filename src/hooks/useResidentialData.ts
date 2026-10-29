import { useActiveReadRefresh } from "./useActiveReadRefresh";
import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../contexts/AuthContext";
export function useResidentialData<T>(resource: string, fetchData: () => Promise<T>, options: { live?: boolean } = {}) {
  const { user } = useAuth();
  const [data, setData] = useState<T | null>(null), [busy, setBusy] = useState(true), [error, setError] = useState(""), [cached, setCached] = useState(false);
  const fetchRef = useRef(fetchData); fetchRef.current = fetchData;
  const version = useRef(0), owner = useRef(user?.id); owner.current = user?.id;
  const load = useCallback(async () => {
    if (!user?.id) return;
    const request = ++version.current, userId = user.id, storageKey = `@katu:residential:${userId}:${resource}`;
    setBusy(true); setError("");
    try {
      const result = await fetchRef.current();
      if (owner.current !== userId || request !== version.current) return;
      setData(result); setCached(false);
      await AsyncStorage.setItem(storageKey, JSON.stringify(result)).catch(() => {});
    } catch (e: any) {
      if (owner.current !== userId || request !== version.current) return;
      setError(e.message || "Não foi possível atualizar.");
      // Nunca apresenta cache de outro titular. A leitura salva é identificada.
      try { const raw = await AsyncStorage.getItem(storageKey); if (raw && request === version.current && owner.current === userId) { setData(JSON.parse(raw)); setCached(true); } } catch { /* Mantém os dados visíveis. */ }
    } finally { if (request === version.current && owner.current === userId) setBusy(false); }
  }, [user?.id, resource]);
  useFocusEffect(useCallback(() => { setData(null); void load(); return () => { version.current++; }; }, [load]));
  useActiveReadRefresh(load, busy || options.live === false);
  return { data, busy, error, cached, load };
}
