import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  markerSymbols,
  type OperationalMapPoint,
  type MapMarkerKind,
} from "./mapMarkers";
export function MapLegend({
  points,
  baseKind,
}: {
  points: OperationalMapPoint[];
  baseKind?: MapMarkerKind;
}) {
  const kinds = [
    ...new Set([
      ...(baseKind ? [baseKind] : []),
      ...points.map((p) => p.kind || ("collection" as const)),
    ]),
  ];
  return (
    <View style={{ padding: 12, gap: 8, backgroundColor: "#F3F8F4" }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
        {kinds.map((kind) => (
          <View
            key={kind}
            style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
          >
            <Ionicons
              name={markerSymbols[kind].icon}
              color="#255443"
              size={18}
            />
            <Text style={{ fontSize: 12, color: "#3C5D4D" }}>
              {markerSymbols[kind].label}
            </Text>
          </View>
        ))}
      </View>
      {points.some((p) => p.color === "#7C3AED") && (
        <Text style={{ fontSize: 12, color: "#7C3AED" }}>
          Roxo: coleta em andamento.
        </Text>
      )}
      <Text style={{ fontSize: 11, lineHeight: 18, color: "#5D7468" }}>
        Verde escuro indica seleção. Números informados no roteiro identificam a
        ordem das visitas. Pontos no mesmo local também podem ser selecionados
        na lista.
      </Text>
    </View>
  );
}
