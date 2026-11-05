import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { NotificationBell } from "@/src/components/NotificationBell";
import { OfflineBanner } from "@/src/components/OfflineBanner";
import { useAuth } from "@/src/contexts/AuthContext";
import { useConnectivity } from "@/src/hooks/useConnectivity";
const actions: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  path: Href;
}[] = [
  {
    title: "Coleta extra",
    icon: "add-circle-outline",
    path: "/(catador)/extra-orders",
  },
  {
    title: "Solicitar coleta em PEV",
    icon: "location-outline",
    path: "/(catador)/pev-atendimento",
  },
  {
    title: "Minhas rotas",
    icon: "navigate-outline",
    path: "/(catador)/roteiro",
  },
  {
    title: "Minha produção em equipe",
    icon: "people-outline",
    path: "/(catador)/producao-equipe",
  },
  {
    title: "Registrar coleta",
    icon: "checkmark-circle-outline",
    path: "/(catador)/collect",
  },
];
export default function CollectorHomeWeb() {
  const { user, signOut } = useAuth();
  const { isOffline } = useConnectivity();
  const { width } = useWindowDimensions();
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abrir meu perfil"
          onPress={() => router.push("/(catador)/profile")}
          style={styles.profile}
        >
          <Ionicons name="person-circle-outline" size={36} color="white" />
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Área do catador</Text>
            <Text style={styles.name}>
              {user?.displayName || "Olá, catador"}
            </Text>
          </View>
        </Pressable>
        <NotificationBell />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sair da conta"
          onPress={() => void signOut()}
          style={styles.exit}
        >
          <Ionicons name="log-out-outline" size={22} color="white" />
          <Text style={{ color: "white", fontWeight: "700" }}>Sair</Text>
        </Pressable>
      </View>
      <OfflineBanner
        visible={isOffline}
        message="Sem internet. Os registros salvos neste aparelho serão enviados quando a conexão voltar."
      />
      <Text accessibilityRole="header" style={styles.title}>
        O que você quer fazer?
      </Text>
      <View style={styles.grid}>
        {actions.map((action) => (
          <Pressable
            key={action.path as string}
            accessibilityRole="button"
            accessibilityLabel={action.title}
            onPress={() => router.push(action.path)}
            style={({ pressed }) => [
              styles.action,
              {
                width: width >= 650 ? "48.5%" : "100%",
                backgroundColor: pressed ? "#E5F5ED" : "white",
              },
            ]}
          >
            <View style={styles.icon}>
              <Ionicons name={action.icon} size={30} color="#047857" />
            </View>
            <Text style={styles.actionText}>{action.title}</Text>
            <Ionicons name="chevron-forward" size={22} color="#047857" />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F3F6F4" },
  content: {
    width: "100%",
    maxWidth: 1000,
    alignSelf: "center",
    padding: 16,
    paddingBottom: 32,
    gap: 14,
  },
  header: {
    backgroundColor: "#145447",
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 150,
    minHeight: 48,
  },
  eyebrow: { color: "#DBF4E8", fontSize: 13 },
  name: { color: "white", fontWeight: "700", fontSize: 20 },
  exit: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  title: { fontSize: 22, fontWeight: "700", color: "#153D31", marginTop: 8 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
  },
  action: {
    minHeight: 94,
    borderWidth: 1,
    borderColor: "#D8E7DF",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: { flex: 1, fontSize: 18, fontWeight: "700", color: "#153D31" },
});
