import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable } from "react-native";
import "leaflet/dist/leaflet.css";
export type OperationalMapPoint = {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  description?: string;
  color?: string;
};
type Props = {
  baseLabel?: string | null;
  baseLatitude: number;
  baseLongitude: number;
  points: OperationalMapPoint[];
  routeCoordinates?: { latitude: number; longitude: number }[];
  selectedPointId?: string | null;
  onSelectPoint?: (id: string) => void;
  onPick?: (lat: number, lng: number) => void;
};
export default function OperationalMapWeb({
  baseLabel = "Base operacional",
  baseLatitude,
  baseLongitude,
  points,
  routeCoordinates = [],
  selectedPointId,
  onSelectPoint,
  onPick,
}: Props) {
  const container = useRef<HTMLDivElement>(null),
    mapRef = useRef<any>(null),
    leaflet = useRef<any>(null),
    layer = useRef<any>(null),
    fitKey = useRef(""),
    gpsCentered = useRef(false);
  const latest = useRef({ onSelectPoint, onPick });
  latest.current = { onSelectPoint, onPick };
  const [ready, setReady] = useState(false),
    [tileError, setTileError] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    void import("leaflet")
      .then((module) => {
        if (!alive || !container.current) return;
        const L = (module as any).default || module;
        leaflet.current = L;
        const map = L.map(container.current, {
          scrollWheelZoom: false,
        }).setView([baseLatitude, baseLongitude], 12);
        mapRef.current = map;
        const tile = L.tileLayer(
          "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19,
          },
        ).addTo(map);
        tile.on("tileerror", () => {
          if (alive) setTileError(true);
        });
        layer.current = L.layerGroup().addTo(map);
        map.on("click", (e: any) =>
          latest.current.onPick?.(e.latlng.lat, e.latlng.lng),
        );
        setReady(true);
      })
      .catch(() =>
        setError(
          "Não foi possível abrir o mapa. Atualize a página para tentar novamente.",
        ),
      );
    return () => {
      alive = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // Initial position only; live positions are updated in the marker effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const signature = points
    .map((p) => `${p.id}:${p.latitude}:${p.longitude}`)
    .join("|");
  useEffect(() => {
    if (!ready) return;
    const L = leaflet.current,
      map = mapRef.current,
      group = layer.current;
    group.clearLayers();
    const valid = points.filter(
      (p) =>
        Number.isFinite(p.latitude) &&
        Number.isFinite(p.longitude) &&
        Math.abs(p.latitude) <= 90 &&
        Math.abs(p.longitude) <= 180,
    );
    const pin = (label: string, color: string) =>
      L.divIcon({
        className: "katua-map-pin",
        html: `<span style="display:flex;align-items:center;justify-content:center;width:30px;height:38px;border-radius:16px 16px 16px 2px;background:${color};border:2px solid white;box-shadow:0 2px 8px #0004;transform:rotate(-45deg)"><b style="transform:rotate(45deg);color:white;font-size:12px">${label}</b></span>`,
        iconSize: [34, 42],
        iconAnchor: [17, 40],
      });
    if (baseLabel)
      L.marker([baseLatitude, baseLongitude], {
        icon: pin(baseLabel === "Minha posição" ? "GPS" : "SE", "#065F46"),
      })
        .bindTooltip(document.createTextNode(baseLabel))
        .addTo(group);
    valid.forEach((point, index) => {
      const content = document.createElement("div");
      content.textContent = [point.title, point.description]
        .filter(Boolean)
        .join(" · ");
      L.marker([point.latitude, point.longitude], {
        icon: pin(
          String(index + 1),
          selectedPointId === point.id ? "#0F172A" : "#028C56",
        ),
      })
        .bindPopup(content)
        .on("click", () => latest.current.onSelectPoint?.(point.id))
        .addTo(group);
    });
    if (routeCoordinates.length > 1)
      L.polyline(
        routeCoordinates.map((p) => [p.latitude, p.longitude]),
        { color: "#028C56", weight: 3, dashArray: "6 6" },
      ).addTo(group);
    if (
      baseLabel === "Minha posição" &&
      !gpsCentered.current &&
      !selectedPointId
    ) {
      map.setView([baseLatitude, baseLongitude], 14);
      gpsCentered.current = true;
    }
    const selected = valid.find((p) => p.id === selectedPointId);
    if (selected) map.panTo([selected.latitude, selected.longitude]);
    else if (fitKey.current !== signature && valid.length) {
      map.fitBounds(
        valid.map((p) => [p.latitude, p.longitude]),
        { padding: [35, 35], maxZoom: 14 },
      );
      fitKey.current = signature;
    }
    const timer = setTimeout(() => map.invalidateSize(), 0);
    return () => clearTimeout(timer);
  }, [
    ready,
    signature,
    baseLatitude,
    baseLongitude,
    baseLabel,
    selectedPointId,
    routeCoordinates,
    points,
  ]);
  return (
    <View style={{ flexShrink: 0, minHeight: 320, backgroundColor: "#F8FAFC" }}>
      <div
        ref={container}
        aria-label="Mapa operacional de coletas"
        role="region"
        style={{
          width: "100%",
          height: 320,
          flexShrink: 0,
          minHeight: 320,
          zIndex: 0,
        }}
      />
      {error && (
        <Text
          accessibilityRole="alert"
          style={{ padding: 8, color: "#B91C1C" }}
        >
          {error}
        </Text>
      )}
      {tileError && (
        <Text style={{ padding: 8, color: "#92400E", fontSize: 12 }}>
          Mapa de fundo indisponível. Os pontos continuam na lista abaixo;
          confira sua conexão.
        </Text>
      )}
      {onPick && (
        <Text style={{ padding: 8, color: "#475569" }}>
          Toque no mapa para confirmar o ponto de retirada.
        </Text>
      )}
      {routeCoordinates.length > 1 && (
        <Text style={{ padding: 8, color: "#475569", fontSize: 12 }}>
          Linha pontilhada: sequência de visitas; não representa percurso
          viário.
        </Text>
      )}
      <View
        style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 8 }}
      >
        {points.map((p, i) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Localizar ${p.title}`}
            key={p.id}
            onPress={() => onSelectPoint?.(p.id)}
            style={{
              padding: 8,
              minHeight: 44,
              backgroundColor: p.id === selectedPointId ? "#DCFCE7" : "white",
              borderRadius: 8,
              borderWidth: 1,
              borderColor: "#E2E8F0",
            }}
          >
            <Text>
              {i + 1}. {p.title}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
