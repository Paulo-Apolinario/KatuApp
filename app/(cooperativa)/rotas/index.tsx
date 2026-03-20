import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  Image,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { routeService, type RouteItem } from "@/src/services/routeService";

export default function RotasScreen() {
  const [rotas, setRotas] = useState<RouteItem[]>([]);
  const [loading, setLoading] = useState(true);

  const carregarRotas = useCallback(async () => {
    try {
      setLoading(true);
      const data = await routeService.list();
      setRotas(data);
    } catch (error) {
      console.error("Erro ao carregar rotas:", error);
      Alert.alert("Erro", "Não foi possível carregar as rotas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregarRotas();
    }, [carregarRotas])
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "SCHEDULED":
        return "#F59E0B";
      case "IN_PROGRESS":
        return "#10B981";
      case "COMPLETED":
        return "#6B7280";
      default:
        return "#6B7280";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "SCHEDULED":
        return "AGENDADA";
      case "IN_PROGRESS":
        return "EM ANDAMENTO";
      case "COMPLETED":
        return "CONCLUÍDA";
      default:
        return status.toUpperCase();
    }
  };

  const formatarData = (data?: string | null) => {
    if (!data) return "Sem data";

    try {
      return new Date(data).toLocaleDateString("pt-BR");
    } catch {
      return String(data);
    }
  };

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
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <TouchableOpacity onPress={() => router.replace("/(cooperativa)/home")}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Image
              source={require("../../../assets/images/logo.png")}
              resizeMode="contain"
              style={{ width: 36, height: 36, marginRight: 8 }}
            />
            <Text style={{ fontSize: 22, fontWeight: "800", color: "#FFFFFF" }}>
              KATUÁ
            </Text>
          </View>

          <TouchableOpacity onPress={() => router.push("/(cooperativa)/rotas/novo")}>
            <Ionicons name="add-circle-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <Text
          style={{
            fontSize: 24,
            fontWeight: "700",
            color: "#FFFFFF",
            marginTop: 15,
          }}
        >
          ROTAS
        </Text>

        <Text
          style={{
            fontSize: 14,
            color: "#FFFFFF",
            opacity: 0.9,
            marginTop: 5,
          }}
        >
          {rotas.length} rotas cadastradas
        </Text>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1, padding: 20 }}
      >
        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <ActivityIndicator size="large" color="#028C56" />
            <Text style={{ marginTop: 12, color: "#6B7280" }}>
              Carregando rotas...
            </Text>
          </View>
        ) : rotas.length > 0 ? (
          rotas.map((rota) => (
            <TouchableOpacity
              key={rota.id}
              onPress={() => router.push(`/(cooperativa)/rotas/${rota.id}` as any)}
              activeOpacity={0.85}
              style={{
                backgroundColor: "#F9FAFB",
                borderRadius: 16,
                padding: 16,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: "#E5E7EB",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "700",
                      color: "#111827",
                    }}
                  >
                    {rota.name}
                  </Text>

                  <Text style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>
                    {formatarData(rota.scheduledDate)}
                  </Text>

                  <Text style={{ fontSize: 13, color: "#6B7280" }}>
                    {rota.stops?.length || 0} pontos na rota
                  </Text>
                </View>

                <View
                  style={{
                    backgroundColor: getStatusColor(rota.status),
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 12,
                  }}
                >
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 10,
                      fontWeight: "600",
                    }}
                  >
                    {getStatusText(rota.status)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <Ionicons name="map-outline" size={48} color="#9CA3AF" />
            <Text
              style={{
                fontSize: 16,
                color: "#6B7280",
                marginTop: 10,
                textAlign: "center",
              }}
            >
              Nenhuma rota cadastrada{"\n"}Clique no + para adicionar
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}