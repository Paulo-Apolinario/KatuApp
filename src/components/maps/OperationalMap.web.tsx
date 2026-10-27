import { useEffect, useRef, useState } from "react";
import { View, Text } from "react-native";
import "leaflet/dist/leaflet.css";
import { MapPointList } from "./MapPointList";
import {
  markerSvg,
  type OperationalMapPoint,
  type MapMarkerKind,
} from "./mapMarkers";
export type { OperationalMapPoint } from "./mapMarkers";
type Props = {
  baseLabel?: string | null;
  baseKind?: MapMarkerKind;
  baseLatitude: number;
  baseLongitude: number;
  points: OperationalMapPoint[];
  routeCoordinates?: { latitude: number; longitude: number }[];
  selectedPointId?: string | null;
  onSelectPoint?: (id: string) => void;
  onPick?: (lat: number, lng: number) => void;
  focusRequest?: number;
};
export default function OperationalMapWeb({
  baseLabel = "Base operacional",
  baseKind,
  baseLatitude,
  baseLongitude,
  points,
  routeCoordinates = [],
  selectedPointId,
  onSelectPoint,
  onPick,
  focusRequest,
}: Props) {
  const container = useRef<HTMLDivElement>(null),
    mapRef = useRef<any>(null),
    leaflet = useRef<any>(null),
    layer = useRef<any>(null),
    fitKey = useRef(""),
    gpsCentered = useRef(false);
  const [localId, setLocalId] = useState<string | null>(null);
  const activeId = localId ?? selectedPointId;
  const [fitRequest, setFitRequest] = useState(0);
  function selectPoint(id: string) {
    setLocalId(id);
    onSelectPoint?.(id);
  }
  function showAll() {
    setLocalId(null);
    onSelectPoint?.("__base__");
    fitKey.current = "";
    setFitRequest((n) => n + 1);
  }
  useEffect(() => {
    setLocalId(null);
    fitKey.current = "";
    setFitRequest((n) => n + 1);
  }, [focusRequest, selectedPointId]);
  const latest = useRef({ onSelectPoint: selectPoint, onPick });
  latest.current = { onSelectPoint: selectPoint, onPick };
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
          zoomAnimation: false,
          fadeAnimation: false,
          markerZoomAnimation: false,
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
      mapRef.current?.stop();
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
    const pin = (
      kind: MapMarkerKind,
      label = "",
      color?: string,
      selected = false,
    ) =>
      L.divIcon({
        className: "katua-map-pin",
        html: markerSvg(kind, label, color, selected),
        iconSize: [46, 56],
        iconAnchor: [23, 53],
        popupAnchor: [0, -48],
      });
    if (
      baseLabel &&
      !valid.some(
        (p) =>
          p.kind ===
            (baseKind ||
              (baseLabel === "Minha posição" ? "location" : "cooperative")) &&
          Math.abs(p.latitude - baseLatitude) < 0.000001 &&
          Math.abs(p.longitude - baseLongitude) < 0.000001,
      )
    )
      L.marker([baseLatitude, baseLongitude], {
        zIndexOffset: 5000,
        icon: pin(
          baseKind ||
            (baseLabel === "Minha posição" ? "location" : "cooperative"),
        ),
      })
        .bindTooltip(document.createTextNode(baseLabel))
        .addTo(group);
    let visit = 0;
    valid.forEach((point) => {
      const kind = point.kind || "collection";
      const label = kind === "collection" ? String(++visit) : "";
      const content = document.createElement("div");
      content.textContent = [point.title, point.description]
        .filter(Boolean)
        .join(" · ");
      L.marker([point.latitude, point.longitude], {
        icon: pin(kind, label, point.color, activeId === point.id),
        title: point.title,
        alt: point.title,
        zIndexOffset: ["driver", "collector", "location"].includes(kind)
          ? 5000
          : activeId === point.id
            ? 4000
            : kind === "cooperative"
              ? 1000
              : 0,
      })
        .bindPopup(content, { autoPan: false })
        .on("click", () => latest.current.onSelectPoint?.(point.id))
        .addTo(group);
    });
    if (routeCoordinates.length > 1)
      L.polyline(
        routeCoordinates.map((p) => [p.latitude, p.longitude]),
        { color: "#047857", weight: 3, dashArray: "6 6" },
      ).addTo(group);
    if (
      baseLabel === "Minha posição" &&
      !gpsCentered.current &&
      !selectedPointId
    ) {
      map.setView([baseLatitude, baseLongitude], 14, { animate: false });
      gpsCentered.current = true;
    }
    const selected = valid.find((p) => p.id === activeId);
    if (selected)
      map.panTo([selected.latitude, selected.longitude], { animate: false });
    else if (fitKey.current !== signature && valid.length) {
      map.fitBounds(
        valid.map((p) => [p.latitude, p.longitude]),
        { padding: [35, 35], maxZoom: 14, animate: false },
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
    baseKind,
    activeId,
    selectedPointId,
    fitRequest,
    routeCoordinates,
    points,
  ]);
  return (
    <View style={{ flexShrink: 0, minHeight: 360, backgroundColor: "#F8FAFC" }}>
      <div
        ref={container}
        aria-label="Mapa operacional de coletas"
        role="region"
        style={{
          width: "100%",
          height: 360,
          flexShrink: 0,
          minHeight: 360,
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
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 14,
          paddingHorizontal: 18,
          paddingVertical: 10,
          backgroundColor: "#F6F9F6",
        }}
      >
        {[
          ["#2563EB", "Motorista / GPS"],
          ["#087F8C", "Catador"],
          ["#B45309", "PEV"],
          ["#047857", "Sede"],
          ["#345D4F", "Coletas numeradas"],
        ].map(([color, label]) => (
          <View
            key={label}
            style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
          >
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: color,
              }}
            />
            <Text style={{ fontSize: 10, color: "#5F7366" }}>{label}</Text>
          </View>
        ))}
      </View>
      {!!points.length && (
        <MapPointList
          points={points}
          selectedId={activeId}
          onSelect={selectPoint}
          onShowAll={showAll}
        />
      )}
    </View>
  );
}
