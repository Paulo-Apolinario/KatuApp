import { useEffect, useRef } from "react";
import { Text, View } from "react-native";
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
  onPick?: (latitude: number, longitude: number) => void;
};

export default function OperationalMapNative({
  baseLabel = "Base operacional",
  baseLatitude,
  baseLongitude,
  points,
  routeCoordinates = [],
  selectedPointId,
  onSelectPoint,
  onPick,
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

      {points.map((point, index) => (
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
          anchor={{ x: 0.5, y: 1 }}
        >
          <View style={{ alignItems: "center" }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor:
                  selectedPointId === point.id
                    ? "#111827"
                    : point.color || "#2563EB",
                borderWidth: 3,
                borderColor: "white",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "white", fontWeight: "800" }}>
                {index + 1}
              </Text>
            </View>
            <View
              style={{
                width: 0,
                height: 0,
                borderLeftWidth: 6,
                borderRightWidth: 6,
                borderTopWidth: 8,
                borderLeftColor: "transparent",
                borderRightColor: "transparent",
                borderTopColor:
                  selectedPointId === point.id
                    ? "#111827"
                    : point.color || "#2563EB",
                marginTop: -1,
              }}
            />
          </View>
        </Marker>
      ))}
    </MapView>
  );
}
