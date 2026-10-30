import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GeneratorImpact from "@/src/components/impact/GeneratorImpact";
export default function PercentualScreen() {
  const inset = useSafeAreaInsets();
  return (
    <View style={s.screen}>
      <LinearGradient
        colors={["#123C35", "#17694F"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[s.header, { paddingTop: inset.top + 18 }]}
      >
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={() => router.back()}
          style={s.back}
        >
          <Ionicons name="arrow-back" size={23} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Impacto das coletas</Text>
          <Text style={s.subtitle}>
            Resultado acumulado das suas solicitações e coletas concluídas.
          </Text>
        </View>
      </LinearGradient>
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: inset.bottom + 36,
        }}
        showsVerticalScrollIndicator={false}
      >
        <GeneratorImpact />
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F3F7F5" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 22,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  back: {
    padding: 10,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,.15)",
  },
  title: { fontSize: 24, color: "#fff", fontWeight: "800" },
  subtitle: { color: "#DBEEE5", lineHeight: 20, marginTop: 4 },
});
