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
  baseLatitude: number;
  baseLongitude: number;
  points: OperationalMapPoint[];
  routeCoordinates?: { latitude: number; longitude: number }[];
  selectedPointId?: string | null;
  onSelectPoint?: (pointId: string) => void;
};

export default function OperationalMapNative({
  baseLatitude,
  baseLongitude,
  points,
  routeCoordinates = [],
  selectedPointId,
  onSelectPoint,
}: Props) {
  return (
    <MapView
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

      <Marker
        coordinate={{
          latitude: baseLatitude,
          longitude: baseLongitude,
        }}
        title="Base operacional"
        description="Cooperativa / localização atual"
        pinColor="#028C56"
      />

      {points.map((point) => (
        <Marker
          key={point.id}
          coordinate={{
            latitude: point.latitude,
            longitude: point.longitude,
          }}
          title={point.title}
          description={point.description}
          pinColor={selectedPointId === point.id ? "#111827" : point.color || "#2563EB"}
          onPress={() => onSelectPoint?.(point.id)}
        />
      ))}
    </MapView>
  );
}