import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import * as Location from "../services/deviceLocation";
import { locationMessage } from "../services/locationBrowser";
export function useForegroundLocation() {
  const focused = useIsFocused(),
    [revision, setRevision] = useState(0),
    [position, setPosition] = useState<Location.LocationObject | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [active, setActive] = useState(AppState.currentState !== "background" && AppState.currentState !== "inactive");
  useEffect(() => {
    const s = AppState.addEventListener("change", (v) =>
      setActive(v === "active"),
    );
    return () => s.remove();
  }, []);
  useEffect(() => {
    if (!focused || !active) return;
    let cancelled = false,
      subscription: Location.LocationSubscription | undefined;
    setLoading(true);
    setError("");
    setPosition(null);
    (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (!permission.granted)
          throw Object.assign(new Error("Permissão negada."), { code: 1 });
        const first = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        if (cancelled) return;
        setPosition(first);
        setLoading(false);
        const watch = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 10,
            timeInterval: 5000,
          },
          (p) => {
            if (!cancelled) {
              setPosition(p);
              setError("");
            }
          },
          (reason) => {
            if (!cancelled) {
              setPosition(null);
              setError(reason);
            }
          },
        );
        if (cancelled) watch.remove();
        else subscription = watch;
      } catch (e) {
        if (!cancelled) {
          setPosition(null);
          setError(locationMessage(e));
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [focused, active, revision]);
  const retry = useCallback(() => setRevision((v) => v + 1), []);
  return { position, error, loading, active: focused && active, retry };
}
