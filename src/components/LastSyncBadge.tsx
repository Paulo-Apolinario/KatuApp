import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

type LastSyncBadgeProps = {
  value?: string | null;
};

function formatLastSync(value?: string | null) {
  if (!value) return "Sem sincronização";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Sem sincronização";
  }

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function LastSyncBadge({ value }: LastSyncBadgeProps) {
  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: "#F0FDF4",
        borderWidth: 1,
        borderColor: "#BBF7D0",
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
      }}
    >
      <Ionicons name="sync-outline" size={16} color="#15803D" />

      <Text
        style={{
          color: "#166534",
          fontSize: 12,
          fontWeight: "700",
        }}
      >
        Última sync: {formatLastSync(value)}
      </Text>
    </View>
  );
}

export default LastSyncBadge;