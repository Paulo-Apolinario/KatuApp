import { useEffect, useRef } from "react";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";

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
  onSelectPoint?: (pointId: string) => void;
};

export default function OperationalMapNative({
  baseLabel = "Base operacional",
  baseLatitude,
  baseLongitude,
  points,
  routeCoordinates = [],
  selectedPointId,
  onSelectPoint,
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
  return (
    <MapView
      ref={map}
      provider={PROVIDER_GOOGLE}
      style={{ flex: 1 }}
      initialRegion={{
        latitude: baseLatitude,
        longitude: baseLongitude,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      }}
      showsUserLocation
      showsMyLocationButton
      toolbarEnabled={false}
    >
      {routeCoordinates.length >= 2 ? (
        <Polyline
          coordinates={routeCoordinates}
          strokeWidth={5}
          strokeColor="#028C56"
        />
      ) : null}

      {baseLabel && (
        <Marker
          coordinate={{
            latitude: baseLatitude,
            longitude: baseLongitude,
          }}
          title={baseLabel}
          description={baseLabel}
          pinColor="#028C56"
        />
      )}

      {points.map((point) => (
        <Marker
          key={point.id}
          coordinate={{
            latitude: point.latitude,
            longitude: point.longitude,
          }}
          title={point.title}
          description={point.description}
          pinColor={
            selectedPointId === point.id ? "#111827" : point.color || "#2563EB"
          }
          onPress={() => onSelectPoint?.(point.id)}
        />
      ))}
    </MapView>
  );
}
