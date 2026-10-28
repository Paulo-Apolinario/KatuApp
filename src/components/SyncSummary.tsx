import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSyncStatus } from "../hooks/useSyncStatus";
export function SyncSummary() {
  const { pending, errors } = useSyncStatus();
  if (!pending) return null;
  return <View style={{ paddingHorizontal: 14, paddingVertical: 8, backgroundColor: errors ? "#FFF7ED" : "#ECFDF5" }}>
    <Pressable accessibilityRole="button" onPress={() => router.push("/sync")} style={{ minHeight: 44, justifyContent: "center" }}>
      <Text style={{ color: "#123C35", fontWeight: "700" }}>{pending} operação(ões) aguardando envio{errors ? ` · ${errors} com falha` : ""}</Text>
      <Text style={{ color: "#475569" }}>Abrir central de sincronização →</Text>
    </Pressable>
  </View>;
}
