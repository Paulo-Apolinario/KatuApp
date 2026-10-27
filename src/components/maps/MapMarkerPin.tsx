import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { markerColor, markerSymbols, type MapMarkerKind } from "./mapMarkers";
export default function MapMarkerPin({
  kind = "collection",
  label,
  selected = false,
  color,
}: {
  kind?: MapMarkerKind;
  label?: string;
  selected?: boolean;
  color?: string;
}) {
  const fill = markerColor(kind, color, selected);
  return (
    <View style={{ width: 46, height: 56, alignItems: "center" }}>
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 21,
          borderWidth: 3,
          borderColor: "white",
          backgroundColor: fill,
          alignItems: "center",
          justifyContent: "center",
          elevation: 4,
          shadowColor: "#102A22",
          shadowOpacity: 0.25,
          shadowRadius: 3,
          shadowOffset: { width: 0, height: 2 },
        }}
      >
        {label ? (
          <Text style={{ color: "white", fontSize: 16, fontWeight: "800" }}>
            {label}
          </Text>
        ) : (
          <Ionicons name={markerSymbols[kind].icon} color="white" size={23} />
        )}
      </View>
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: 9,
          borderRightWidth: 9,
          borderTopWidth: 12,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderTopColor: fill,
          marginTop: -2,
        }}
      />
      {selected && (
        <View
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: "#FDE68A",
            borderWidth: 2,
            borderColor: "white",
          }}
        />
      )}
    </View>
  );
}
