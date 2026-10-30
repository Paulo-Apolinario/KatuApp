import { useCallback, useRef } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { subscribeToConnectivity } from "../offline/connectivity";

/** Opt-in for non-cooperative read screens; does not touch shared app bootstrap. */
export function useActiveReadRefresh(refresh: () => unknown | Promise<unknown>, paused = false) {
  const { user } = useAuth();
  const userId = user?.id, role = user?.role;
  const current = useRef({ refresh, paused }); current.current = { refresh, paused };
  useFocusEffect(useCallback(() => {
    if (!userId || role === "COOPERATIVE") return;
    let active = true, running = false, wasOffline = false;
    const update = async () => {
      if (!active || running || current.current.paused || AppState.currentState !== "active") return;
      running = true;
      try { await current.current.refresh(); } catch { /* The read screen presents its own failure. */ }
      finally { running = false; }
    };
    const timer = setInterval(update, 30000);
    const resume = AppState.addEventListener("change", state => { if (state === "active") void update(); });
    const off = subscribeToConnectivity(status => {
      if (status.isOffline) wasOffline = true;
      else if (wasOffline) { wasOffline = false; void update(); }
    });
    return () => { active = false; clearInterval(timer); resume.remove(); off(); };
  }, [userId, role]));
}
