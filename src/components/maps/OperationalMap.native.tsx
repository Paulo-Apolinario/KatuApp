import MapMarkerPin from "./MapMarkerPin";
import { useEffect, useRef } from "react";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
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
}: Props) {
  const map = useRef<MapView>(null);
  const centeredGps = useRef(false);
  const selected = points.find((p) => p.id === selectedPointId);
  const selectedLat = selected?.latitude,
    selectedLng = selected?.longitude;
  useEffect(() => {
    if (selectedLat != null && selectedLng != null)
      map.current?.animateCamera(
        { center: { latitude: selectedLat, longitude: selectedLng } },
        { duration: 250 },
      );
  }, [selectedLat, selectedLng]);
  useEffect(() => {
    if (
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
  }, [baseLabel, baseLatitude, baseLongitude, selectedPointId]);
  const fitPoints = useRef(points);
  fitPoints.current = points;
  useEffect(() => {
    if (focusRequest !== undefined && fitPoints.current.length)
      map.current?.fitToCoordinates(fitPoints.current, {
        edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
        animated: true,
      });
  }, [focusRequest]);
  return (
    <MapView
      onPress={(event) =>
        onPick?.(
          event.nativeEvent.coordinate.latitude,
          event.nativeEvent.coordinate.longitude,
        )
      }
      ref={map}
      provider={PROVIDER_GOOGLE}
      style={{ flex: 1, minHeight: 320 }}
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
              !point.kind || point.kind === "collection"
                ? String(
                    points
                      .slice(0, index + 1)
                      .filter((p) => !p.kind || p.kind === "collection").length,
                  )
                : undefined
            }
            color={point.color}
            selected={selectedPointId === point.id}
          />
        </Marker>
      ))}
    </MapView>
  );
}
