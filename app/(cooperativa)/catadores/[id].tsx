import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { doc, getDoc } from "firebase/firestore";

import { db } from "@/src/services/firebaseConfig";

export default function CatadorDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const routeId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [loading, setLoading] = useState(true);
  const [catador, setCatador] = useState<any>(null);

  const loadCatador = useCallback(async () => {
    if (!routeId) {
      setLoading(false);
      return;
    }

    try {
      const docRef = doc(db, "catadores", routeId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        Alert.alert("Erro", "Catador não encontrado.");
        router.replace("/(cooperativa)/catadores");
        return;
      }

      const data = docSnap.data();

      setCatador({
        id: docSnap.id,
        ...data,
      });
    } catch (error) {
      console.error("Erro ao carregar catador:", error);
      Alert.alert("Erro", "Não foi possível carregar os dados do catador.");
    } finally {
      setLoading(false);
    }
  }, [routeId]);

  useEffect(() => {
    loadCatador();
  }, [loadCatador]);

  const handleAtribuirRota = () => {
    Alert.alert(
      "Aviso",
      "A atribuição de rota para catador será a próxima etapa do sistema."
    );
  };

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#FFFFFF",
        }}
      >
        <ActivityIndicator size="large" color="#028C56" />
        <Text style={{ marginTop: 10, color: "#6B7280" }}>Carregando...</Text>
      </View>
    );
  }

  if (!catador) return null;

  const statusColor =
    catador.status === "disponivel"
      ? "#10B981"
      : catador.status === "em_coleta"
      ? "#F59E0B"
      : "#6B7280";

  const statusText =
    catador.status === "disponivel"
      ? "DISPONÍVEL"
      : catador.status === "em_coleta"
      ? "EM COLETA"
      : "INATIVO";

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
        }}
      >
        <View
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
        >
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={{ fontSize: 20, fontWeight: "700", color: "#FFFFFF" }}>
            Detalhes do Catador
          </Text>

          <TouchableOpacity
            onPress={() => Alert.alert("Opções", "Funcionalidade em desenvolvimento")}
          >
            <Ionicons name="ellipsis-vertical" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, padding: 20 }}>
        <View style={{ alignItems: "center", marginBottom: 25 }}>
          <View
            style={{
              width: 100,
              height: 100,
              borderRadius: 50,
              backgroundColor: "#E5E7EB",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
            }}
          >
            <Ionicons name="person" size={60} color="#9CA3AF" />
          </View>

          <Text style={{ fontSize: 22, fontWeight: "700", color: "#111827" }}>
            {catador.nome || "Sem nome"}
          </Text>

          <View
            style={{
              backgroundColor: statusColor,
              paddingHorizontal: 12,
              paddingVertical: 4,
              borderRadius: 20,
              marginTop: 5,
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "600" }}>
              {statusText}
            </Text>
          </View>
        </View>

        <View
          style={{
            backgroundColor: "#F9FAFB",
            borderRadius: 16,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 12 }}>
            Informações Pessoais
          </Text>

          <View style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 12, color: "#6B7280" }}>CPF</Text>
            <Text style={{ fontSize: 14, color: "#111827", fontWeight: "500" }}>
              {catador.cpf || "-"}
            </Text>
          </View>

          <View style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 12, color: "#6B7280" }}>Telefone</Text>
            <Text style={{ fontSize: 14, color: "#111827", fontWeight: "500" }}>
              {catador.telefone || "-"}
            </Text>
          </View>

          <View style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 12, color: "#6B7280" }}>Email</Text>
            <Text style={{ fontSize: 14, color: "#111827", fontWeight: "500" }}>
              {catador.email || "-"}
            </Text>
          </View>

          <View>
            <Text style={{ fontSize: 12, color: "#6B7280" }}>Endereço</Text>
            <Text style={{ fontSize: 14, color: "#111827", fontWeight: "500" }}>
              {catador.endereco || "-"}
            </Text>
          </View>
        </View>

        <View
          style={{
            backgroundColor: "#F9FAFB",
            borderRadius: 16,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 12 }}>
            Estatísticas
          </Text>

          <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
            <View style={{ alignItems: "center" }}>
              <Text style={{ fontSize: 24, fontWeight: "700", color: "#028C56" }}>
                {Number(catador.totalKg || 0)} kg
              </Text>
              <Text style={{ fontSize: 12, color: "#6B7280" }}>Total</Text>
            </View>

            <View style={{ alignItems: "center" }}>
              <Text style={{ fontSize: 24, fontWeight: "700", color: "#028C56" }}>
                {Number(catador.kgMes || 0)} kg
              </Text>
              <Text style={{ fontSize: 12, color: "#6B7280" }}>Este mês</Text>
            </View>

            <View style={{ alignItems: "center" }}>
              <Text style={{ fontSize: 24, fontWeight: "700", color: "#028C56" }}>
                {Number(catador.coletasHoje || 0)}
              </Text>
              <Text style={{ fontSize: 12, color: "#6B7280" }}>Hoje</Text>
            </View>
          </View>
        </View>

        <View
          style={{
            backgroundColor: "#F9FAFB",
            borderRadius: 16,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 12 }}>
            Histórico
          </Text>

          <Text style={{ fontSize: 14, color: "#6B7280" }}>
            O histórico detalhado de coletas deste catador será integrado na próxima etapa.
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleAtribuirRota}
          style={{
            backgroundColor: "#028C56",
            borderRadius: 8,
            padding: 16,
            alignItems: "center",
            marginBottom: 30,
          }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>
            ATRIBUIR ROTA
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}