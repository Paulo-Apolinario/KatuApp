import { Text, TouchableOpacity, View, Linking, Platform } from "react-native";
import { useEffect, useState } from "react";
import type { LocationObject } from "expo-location";
export function LocationStatus({
  position,
  error,
  loading,
  retry,
  active = true,
}: {
  position: LocationObject | null;
  error: string;
  loading: boolean;
  retry: () => void;
  active?: boolean;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((v) => v + 1), 15000);
    return () => clearInterval(id);
  }, []);
  const age = position ? Date.now() - position.timestamp : Infinity;
  return (
    <View
      style={{
        backgroundColor: error ? "#FFF5E5" : "#F0F8F3",
        padding: 12,
        borderRadius: 12,
        marginVertical: 10,
      }}
    >
      <Text accessibilityLiveRegion="polite" style={{ color: "#203B2D" }}>
        {!active ? "Localização pausada enquanto esta tela está inativa." : error ||
          (loading
            ? "Obtendo posição do aparelho..."
            : position
              ? `${age > 60000 ? "Última posição — desatualizada" : "Posição obtida do aparelho"} · precisão aproximada ${position.coords.accuracy == null || !Number.isFinite(position.coords.accuracy) || position.coords.accuracy < 0 ? "não informada" : Math.round(position.coords.accuracy) + " m"}`
              : "Posição do aparelho ainda não obtida.")}
      </Text>
      {position && (
        <Text style={{ fontSize: 12, color: "#526458", marginTop: 4 }}>
          Leitura: {new Date(position.timestamp).toLocaleTimeString("pt-BR")} ·{" "}
          {position.coords.latitude.toFixed(5)},{" "}
          {position.coords.longitude.toFixed(5)}
        </Text>
      )}
      <TouchableOpacity
        accessibilityRole="button"
        disabled={loading || !active}
        onPress={retry}
        style={{ paddingVertical: 10 }}
      >
        <Text style={{ fontWeight: "700", color: "#176944" }}>
          {loading ? "Obtendo localização..." : "Atualizar localização"}
        </Text>
      </TouchableOpacity>
      {position && position.coords.accuracy != null && position.coords.accuracy > 100 && (
        <Text style={{ color: "#8A4B11", fontSize: 12 }}>Precisão reduzida. Em local fechado, aproxime-se de uma janela ou área aberta e atualize a localização.</Text>
      )}
      {error && Platform.OS !== "web" && (
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => Linking.openSettings()}
        >
          <Text style={{ color: "#176944" }}>Abrir permissões do aparelho</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
