import { View } from "react-native";
import { MapPointList } from "./MapPointList";
import { MapLegend } from "./MapLegend";
import MapMarkerPin from "./MapMarkerPin";
import { useEffect, useRef, useState } from "react";
import MapView, {
  Marker,
  Polyline,
  Circle,
  PROVIDER_GOOGLE,
} from "react-native-maps";
import { type OperationalMapPoint, type MapMarkerKind } from "./mapMarkers";

export type { OperationalMapPoint } from "./mapMarkers";
type Props = {
  baseLabel?: string | null;
  baseKind?: MapMarkerKind;
  baseLatitude: number;
  baseLongitude: number;
  points: OperationalMapPoint[];
  routeCoordinates?: { latitude: number; longitude: number }[];
  selectedPointId?: string | null;
  onSelectPoint?: (pointId: string) => void;
  onPick?: (latitude: number, longitude: number) => void;
  focusRequest?: number;
  showPointList?: boolean;
  accuracyCircle?: { latitude: number; longitude: number; radius: number };
};

export default function OperationalMapNative({
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
  showPointList = false,
  accuracyCircle,
}: Props) {
  const map = useRef<MapView>(null);
  const centeredGps = useRef(false);
  const [ready, setReady] = useState(false),
    [fitRequest, setFitRequest] = useState(0);
  const selected = points.find((p) => p.id === selectedPointId);
  const selectedLat = selected?.latitude,
    selectedLng = selected?.longitude;
  useEffect(() => {
    if (ready && selectedLat != null && selectedLng != null)
      map.current?.animateCamera(
        { center: { latitude: selectedLat, longitude: selectedLng } },
        { duration: 250 },
      );
  }, [selectedLat, selectedLng, selectedPointId, focusRequest, ready]);
  useEffect(() => {
    if (
      ready &&
      baseLabel === "Minha posição" &&
      !centeredGps.current &&
      !selectedPointId
    ) {
      centeredGps.current = true;
      map.current?.animateCamera(
        {
          center: { latitude: baseLatitude, longitude: baseLongitude },
          zoom: 14,
        },
        { duration: 300 },
      );
    }
  }, [baseLabel, baseLatitude, baseLongitude, selectedPointId, ready]);
  const fitPoints = useRef(points.filter((p) => p.includeInBounds !== false));
  fitPoints.current = points.filter((p) => p.includeInBounds !== false);
  const signature = points
    .filter((p) => p.includeInBounds !== false)
    .map((p) =>
      ["driver", "collector", "location"].includes(p.kind || "")
        ? p.id
        : `${p.id}:${p.latitude}:${p.longitude}`,
    )
    .join("|");
  useEffect(() => {
    if (ready && !selectedPointId && fitPoints.current.length)
      map.current?.fitToCoordinates(fitPoints.current, {
        edgePadding: { top: 72, right: 48, bottom: 48, left: 48 },
        animated: true,
      });
  }, [focusRequest, signature, ready, selectedPointId, fitRequest]);
  const view = (
    <MapView
      onMapReady={() => setReady(true)}
      onPress={(event) =>
        onPick?.(
          event.nativeEvent.coordinate.latitude,
          event.nativeEvent.coordinate.longitude,
        )
      }
      ref={map}
      provider={PROVIDER_GOOGLE}
      style={
        showPointList
          ? { height: 360, width: "100%" }
          : { flex: 1, minHeight: 320 }
      }
      initialRegion={{
        latitude: baseLatitude,
        longitude: baseLongitude,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      }}
      showsUserLocation={false}
      showsMyLocationButton={false}
      toolbarEnabled={false}
    >
      {accuracyCircle &&
        Number.isFinite(accuracyCircle.radius) &&
        accuracyCircle.radius > 0 && (
          <Circle
            center={accuracyCircle}
            radius={accuracyCircle.radius}
            strokeColor={accuracyCircle.radius > 100 ? "#B45309" : "#2563EB"}
            fillColor={
              accuracyCircle.radius > 100
                ? "rgba(245,158,11,0.12)"
                : "rgba(96,165,250,0.12)"
            }
            strokeWidth={1}
          />
        )}
      {routeCoordinates.length >= 2 ? (
        <Polyline
          coordinates={routeCoordinates}
          strokeWidth={5}
          strokeColor="#047857"
        />
      ) : null}

      {baseLabel &&
        !points.some(
          (p) =>
            p.kind ===
              (baseKind ||
                (baseLabel === "Minha posição" ? "location" : "cooperative")) &&
            Math.abs(p.latitude - baseLatitude) < 0.000001 &&
            Math.abs(p.longitude - baseLongitude) < 0.000001,
        ) && (
          <Marker
            coordinate={{
              latitude: baseLatitude,
              longitude: baseLongitude,
            }}
            zIndex={5000}
            title={baseLabel}
            description={baseLabel}
            anchor={{ x: 0.5, y: 1 }}
          >
            <MapMarkerPin
              kind={
                baseKind ||
                (baseLabel === "Minha posição" ? "location" : "cooperative")
              }
            />
          </Marker>
        )}

      {points.map((point, index) => (
        <Marker
          key={point.id}
          coordinate={{
            latitude: point.latitude,
            longitude: point.longitude,
          }}
          zIndex={
            ["driver", "collector", "location"].includes(point.kind || "")
              ? 5000
              : selectedPointId === point.id
                ? 4000
                : point.kind === "cooperative"
                  ? 1000
                  : 0
          }
          title={point.title}
          description={point.description}
          pinColor={
            selectedPointId === point.id ? "#111827" : point.color || "#2563EB"
          }
          onPress={() => onSelectPoint?.(point.id)}
          anchor={{ x: 0.5, y: 1 }}
        >
          <MapMarkerPin
            kind={point.kind || "collection"}
            label={
              point.sequence === null
                ? undefined
                : !point.kind || point.kind === "collection"
                  ? String(
                      point.sequence ??
                        points
                          .slice(0, index + 1)
                          .filter((p) => !p.kind || p.kind === "collection")
                          .length,
                    )
                  : undefined
            }
            sequence={point.sequence}
            color={point.color}
            selected={selectedPointId === point.id}
          />
        </Marker>
      ))}
    </MapView>
  );
  return showPointList ? (
    <View>
      {view}
      <MapLegend
        points={points}
        baseKind={
          baseLabel
            ? baseKind ||
              (baseLabel === "Minha posição" ? "location" : "cooperative")
            : undefined
        }
      />
      <MapPointList
        points={points}
        selectedId={selectedPointId}
        onSelect={(id) => onSelectPoint?.(id)}
        onShowAll={() => {
          onSelectPoint?.("__base__");
          setFitRequest((n) => n + 1);
        }}
      />
    </View>
  ) : (
    view
  );
}
