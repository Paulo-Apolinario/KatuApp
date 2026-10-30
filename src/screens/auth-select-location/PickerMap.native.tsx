import { useEffect, useRef } from "react";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { DEFAULT_POINT, type PickerMapProps } from "./coordinates";
export default function PickerMap({ point, onPick }: PickerMapProps) {
  const map = useRef<MapView>(null),
    p = point ?? DEFAULT_POINT;
  useEffect(() => {
    if (point)
      map.current?.animateToRegion(
        { ...point, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        250,
      );
  }, [point]);
  return (
    <MapView
      ref={map}
      provider={PROVIDER_GOOGLE}
      style={{ height: 330, width: "100%" }}
      initialRegion={{ ...p, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
      onMapReady={() => {
        if (point)
          map.current?.animateToRegion(
            { ...point, latitudeDelta: 0.01, longitudeDelta: 0.01 },
            250,
          );
      }}
      onPress={(e) => onPick(e.nativeEvent.coordinate)}
      toolbarEnabled={false}
    >
      {point && (
        <Marker
          coordinate={point}
          draggable
          onDragEnd={(e) => onPick(e.nativeEvent.coordinate)}
          title="Sede da cooperativa"
          description="Arraste para ajustar o ponto"
          pinColor="#047857"
        />
      )}
    </MapView>
  );
}
