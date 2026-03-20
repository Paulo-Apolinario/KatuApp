import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import {
  routeService,
  type RouteItem,
  type RouteStatus,
} from "@/src/services/routeService";

export default function RotaDetalheScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const routeId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [rota, setRota] = useState<RouteItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);

  const loadRota = useCallback(async () => {
    if (!routeId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await routeService.getById(routeId);
      setRota(data);
    } catch (error) {
      console.error("Erro ao carregar rota:", error);
      Alert.alert("Erro", "Não foi possível carregar a rota.", [
        {
          text: "OK",
          onPress: () => router.replace("/(cooperativa)/rotas"),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [routeId]);

  useEffect(() => {
    loadRota();
  }, [loadRota]);

  async function updateStatus(newStatus: RouteStatus) {
    if (!routeId) return;

    try {
      setSavingStatus(true);
      const updated = await routeService.updateStatus(routeId, newStatus);
      setRota(updated);
      Alert.alert("Sucesso", "Status da rota atualizado com sucesso.");
    } catch (error) {
      console.error("Erro ao atualizar status da rota:", error);
      Alert.alert("Erro", "Não foi possível atualizar o status.");
    } finally {
      setSavingStatus(false);
    }
  }

  const getStatusColor = (status?: string) => {
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

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case "SCHEDULED":
        return "AGENDADA";
      case "IN_PROGRESS":
        return "EM ANDAMENTO";
      case "COMPLETED":
        return "CONCLUÍDA";
      default:
        return "SEM STATUS";
    }
  };

  const formatarData = (data?: string | null) => {
    if (!data) return "Não informada";

    try {
      return new Date(data).toLocaleString("pt-BR");
    } catch {
      return data;
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#028C56" />
        <Text style={{ marginTop: 10, color: "#6B7280" }}>Carregando rota...</Text>
      </View>
    );
  }

  if (!rota) {
    return (
      <View style={{ flex: 1, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center", padding: 24 }}>
        <Ionicons name="alert-circle-outline" size={48} color="#9CA3AF" />
        <Text style={{ marginTop: 10, color: "#6B7280", textAlign: "center", fontSize: 16 }}>
          Rota não encontrada.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <LinearGradient
        colors={["#10F35D", "#028C56"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => router.replace("/(cooperativa)/rotas")}
            style={{ marginRight: 15 }}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={{ fontSize: 20, fontWeight: "700", color: "#FFFFFF" }}>
            DETALHES DA ROTA
          </Text>
        </View>
      </LinearGradient>

      <ScrollView style={{ flex: 1, padding: 20 }} showsVerticalScrollIndicator={false}>
        <View
          style={{
            backgroundColor: "#F9FAFB",
            borderRadius: 16,
            padding: 18,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: "#E5E7EB",
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: "800", color: "#111827", marginBottom: 10 }}>
            {rota.name}
          </Text>

          <View
            style={{
              alignSelf: "flex-start",
              backgroundColor: getStatusColor(rota.status),
              borderRadius: 20,
              paddingHorizontal: 12,
              paddingVertical: 5,
              marginBottom: 12,
            }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 12 }}>
              {getStatusLabel(rota.status)}
            </Text>
          </View>

          <Text style={{ fontSize: 14, color: "#4B5563", marginBottom: 6 }}>
            Data: {formatarData(rota.scheduledDate)}
          </Text>

          <Text style={{ fontSize: 14, color: "#4B5563", marginBottom: 6 }}>
            Motorista ID: {rota.driverId || "Não informado"}
          </Text>

          <Text style={{ fontSize: 14, color: "#4B5563", marginBottom: 6 }}>
            Veículo ID: {rota.vehicleId || "Não informado"}
          </Text>

          <Text style={{ fontSize: 14, color: "#4B5563" }}>
            Descrição: {rota.description || "Não informada"}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 16,
            padding: 18,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: "#E5E7EB",
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 12 }}>
            Pontos da rota
          </Text>

          {Array.isArray(rota.stops) && rota.stops.length > 0 ? (
            rota.stops.map((ponto: string, index: number) => (
              <View
                key={`${ponto}-${index}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <Ionicons name="location-outline" size={18} color="#028C56" />
                <Text style={{ marginLeft: 8, color: "#374151", fontSize: 15 }}>
                  {ponto}
                </Text>
              </View>
            ))
          ) : (
            <Text style={{ color: "#6B7280" }}>Nenhum ponto cadastrado.</Text>
          )}
        </View>

        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 16,
            padding: 18,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: "#E5E7EB",
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 12 }}>
            Alterar status
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {[
              { label: "Agendada", value: "SCHEDULED" },
              { label: "Em andamento", value: "IN_PROGRESS" },
              { label: "Concluída", value: "COMPLETED" },
            ].map((item) => {
              const selected = rota.status === item.value;

              return (
                <TouchableOpacity
                  key={item.value}
                  disabled={savingStatus}
                  onPress={() => updateStatus(item.value as RouteStatus)}
                  style={{
                    backgroundColor: selected ? "#028C56" : "#F3F4F6",
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 20,
                    marginRight: 10,
                    marginBottom: 10,
                    opacity: savingStatus ? 0.7 : 1,
                  }}
                >
                  <Text
                    style={{
                      color: selected ? "#FFFFFF" : "#4B5563",
                      fontWeight: "600",
                    }}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}