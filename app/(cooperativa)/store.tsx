import { router } from "expo-router";
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

export default function CooperativaStoreScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <LinearGradient
        colors={["#10F35D", "#028C56"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          paddingTop: 50,
          paddingBottom: 20,
          paddingHorizontal: 20,
          borderBottomLeftRadius: 30,
          borderBottomRightRadius: 30,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: "700", color: "#FFFFFF" }}>
            LOJA / ESTOQUE
          </Text>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, padding: 20 }}>
        <View
          style={{
            backgroundColor: "#F9FAFB",
            borderRadius: 20,
            padding: 24,
            alignItems: "center",
            marginBottom: 25,
          }}
        >
          <Ionicons name="cube-outline" size={54} color="#9CA3AF" />
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: "#111827",
              marginTop: 14,
            }}
          >
            Módulo em preparação
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: "#6B7280",
              marginTop: 8,
              textAlign: "center",
              lineHeight: 20,
            }}
          >
            Esta tela já está pronta para receber integração real com backend assim que definirmos o domínio de estoque, produtos ou materiais comercializados pela cooperativa.
          </Text>
        </View>

        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 16,
            padding: 20,
            borderWidth: 1,
            borderColor: "#E5E7EB",
            marginBottom: 30,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "700",
              color: "#111827",
              marginBottom: 12,
            }}
          >
            Próxima integração prevista
          </Text>

          <Text style={{ fontSize: 14, color: "#4B5563", marginBottom: 8 }}>
            • cadastro de itens
          </Text>
          <Text style={{ fontSize: 14, color: "#4B5563", marginBottom: 8 }}>
            • movimentação de estoque
          </Text>
          <Text style={{ fontSize: 14, color: "#4B5563", marginBottom: 8 }}>
            • saída para venda ou descarte
          </Text>
          <Text style={{ fontSize: 14, color: "#4B5563" }}>
            • indicadores de volume armazenado
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}