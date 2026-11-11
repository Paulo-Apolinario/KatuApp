import { useEffect, useRef, type ReactNode } from "react";
import { AppState, Platform, View } from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { usePathname } from "expo-router";
import api from "../services/api";
import { createActivityMeter } from "../services/activityMeter";

export default function UsageBoundary({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const path = usePathname();
  const meter = useRef<ReturnType<typeof createActivityMeter> | null>(null);
  useEffect(() => {
    meter.current?.touch();
  }, [path]);
  useEffect(() => {
    if (
      !user?.id ||
      ![
        "COOPERATIVE",
        "COLLECTOR",
        "DRIVER",
        "GENERATOR_SMALL",
        "GENERATOR_LARGE",
      ].includes(user.role || "")
    )
      return;
    const active = createActivityMeter();
    meter.current = active;
    let sent = Date.now(),
      alive = true,
      busy = false;
    const foreground = () =>
      Platform.OS === "web"
        ? typeof document !== "undefined" &&
          document.visibilityState === "visible"
        : AppState.currentState === "active";
    active.setVisible(foreground());
    const flush = async () => {
      const activeSeconds = active.drain();
      if (!activeSeconds || busy || !alive) return;
      busy = true;
      try {
        await api.post(
          "/analytics/usage/heartbeat",
          { activeSeconds, platform: "APP" },
          true,
          user.id,
        );
      } catch {
        /* Online estimates only; do not queue or block a collection. */
      } finally {
        busy = false;
      }
    };
    const changed = () => {
      if (!foreground()) void flush();
      active.setVisible(foreground());
    };
    const state = AppState.addEventListener("change", changed);
    const touch = () => active.touch();
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.addEventListener("visibilitychange", changed);
      ["pointerdown", "keydown", "scroll"].forEach((event) =>
        window.addEventListener(event, touch, { passive: true, capture: true }),
      );
    }
    const timer = setInterval(() => {
      active.tick();
      if (Date.now() - sent >= 30000) {
        sent = Date.now();
        void flush();
      }
    }, 1000);
    return () => {
      alive = false;
      meter.current = null;
      clearInterval(timer);
      state.remove();
      if (Platform.OS === "web" && typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", changed);
        ["pointerdown", "keydown", "scroll"].forEach((event) =>
          window.removeEventListener(event, touch, true),
        );
      }
    };
  }, [user?.id, user?.role]);
  return (
    <View style={{ flex: 1 }} onTouchStart={() => meter.current?.touch()}>
      {children}
    </View>
  );
}
