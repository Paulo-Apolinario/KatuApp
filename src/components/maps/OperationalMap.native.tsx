import MapView, { Marker } from "react-native-maps";

type Props = {
  latitude?: number;
  longitude?: number;
  title?: string;
};

export default function OperationalMapNative({
  latitude,
  longitude,
  title,
}: Props) {
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number"
  ) {
    return null;
  }

  return (
    <MapView
      style={{ width: "100%", height: 320, borderRadius: 16 }}
      initialRegion={{
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }}
    >
      <Marker
        coordinate={{ latitude, longitude }}
        title={title}
      />
    </MapView>
  );
}