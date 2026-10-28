import { useSyncExternalStore } from "react";
type State = { cached: boolean; error: string };
const initial: State = { cached: false, error: "" };
const states = new Map<string, State>();
const listeners = new Set<() => void>();
export function setReadState(key: string, state: State) { states.set(key, state); listeners.forEach(fn => fn()); }
export function useReadState(key: string) {
  return useSyncExternalStore(fn => { listeners.add(fn); return () => { listeners.delete(fn); }; }, () => states.get(key) || initial, () => initial);
}
