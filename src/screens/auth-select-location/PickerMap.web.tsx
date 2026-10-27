import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import "leaflet/dist/leaflet.css";
import { markerSvg } from "@/src/components/maps/mapMarkers";
import { DEFAULT_POINT, type PickerMapProps } from "./coordinates";

export default function PickerMap({ point, onPick }: PickerMapProps) {
  const root = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null),
    marker = useRef<any>(null),
    leaflet = useRef<any>(null);
  const latest = useRef({ point, onPick });
  latest.current = { point, onPick };
  const [ready, setReady] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    let resize: ResizeObserver | undefined;
    void import("leaflet")
      .then((module) => {
        if (!alive || !root.current) return;
        const L = (module as any).default || module;
        leaflet.current = L;
        const p = latest.current.point ?? DEFAULT_POINT;
        const m = L.map(root.current, {
          scrollWheelZoom: false,
          zoomAnimation: false,
          fadeAnimation: false,
        }).setView([p.latitude, p.longitude], latest.current.point ? 16 : 12);
        map.current = m;
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        })
          .addTo(m)
          .on("tileerror", () => {
            if (alive)
              setError(
                "Mapa-base indisponível. Você ainda pode informar as coordenadas abaixo.",
              );
          });
        m.on("click", (e: any) =>
          latest.current.onPick({
            latitude: e.latlng.lat,
            longitude: e.latlng.lng,
          }),
        );
        resize = new ResizeObserver(() => m.invalidateSize());
        resize.observe(root.current);
        setReady(true);
      })
      .catch(() => {
        if (alive)
          setError(
            "Não foi possível carregar o mapa. Informe as coordenadas abaixo.",
          );
      });
    return () => {
      alive = false;
      resize?.disconnect();
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready || !map.current || !point) return;
    const L = leaflet.current,
      xy = [point.latitude, point.longitude];
    if (!marker.current) {
      const pin = L.marker(xy, {
        draggable: true,
        title: "Sede da cooperativa",
        alt: "Sede da cooperativa: arraste para ajustar",
        icon: L.divIcon({
          html: markerSvg("cooperative"),
          className: "",
          iconSize: [46, 56],
          iconAnchor: [23, 56],
        }),
      }).addTo(map.current);
      pin.on("dragend", () => {
        const p = pin.getLatLng();
        latest.current.onPick({ latitude: p.lat, longitude: p.lng });
      });
      marker.current = pin;
    } else marker.current.setLatLng(xy);
    if (!map.current.getBounds().contains(xy))
      map.current.panTo(xy, { animate: false });
  }, [point, ready]);
  return (
    <View>
      <div
        ref={root}
        role="region"
        aria-label="Mapa para localizar a sede da cooperativa"
        style={{ height: 330, width: "100%", borderRadius: 14, zIndex: 0 }}
      />
      {!!error && (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: "#92400e", marginTop: 8 }}
        >
          {error}
        </Text>
      )}
    </View>
  );
}
