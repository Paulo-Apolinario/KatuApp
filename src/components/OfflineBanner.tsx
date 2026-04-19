import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

type OfflineBannerProps = {
  visible: boolean;
  message?: string;
};

export function OfflineBanner({
  visible,
  message = "Você está offline. Exibindo dados salvos no dispositivo.",
}: OfflineBannerProps) {
  if (!visible) return null;

  return (
    <View
      style={{
        backgroundColor: "#FFF7ED",
        borderWidth: 1,
        borderColor: "#FDBA74",
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      <Ionicons
        name="cloud-offline-outline"
        size={20}
        color="#C2410C"
        style={{ marginTop: 1 }}
      />

      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: "#9A3412",
            fontSize: 14,
            fontWeight: "800",
            marginBottom: 2,
          }}
        >
          Modo offline
        </Text>

        <Text
          style={{
            color: "#7C2D12",
            fontSize: 13,
            lineHeight: 19,
          }}
        >
          {message}
        </Text>
      </View>
    </View>
  );
}

export default OfflineBanner;