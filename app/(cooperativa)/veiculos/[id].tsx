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
  vehicleService,
  type Vehicle,
  type VehicleStatus,
} from "@/src/services/vehicleService";

export default function VeiculoDetalheScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const routeId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [veiculo, setVeiculo] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);

  const loadVeiculo = useCallback(async () => {
    if (!routeId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await vehicleService.getById(routeId);
      setVeiculo(data);
    } catch (error) {
      console.error("Erro ao carregar veículo:", error);
      Alert.alert("Erro", "Não foi possível carregar o veículo.", [
        {
          text: "OK",
          onPress: () => router.replace("/(cooperativa)/veiculos"),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [routeId]);

  useEffect(() => {
    loadVeiculo();
  }, [loadVeiculo]);

  async function handleChangeStatus(status: VehicleStatus) {
    if (!routeId) return;

    try {
      setSavingStatus(true);
      const updated = await vehicleService.updateStatus(routeId, status);
      setVeiculo(updated);
      Alert.alert("Sucesso", "Status do veículo atualizado com sucesso.");
    } catch (error) {
      console.error("Erro ao atualizar status do veículo:", error);
      Alert.alert("Erro", "Não foi possível atualizar o status do veículo.");
    } finally {
      setSavingStatus(false);
    }
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "ACTIVE":
        return "#10B981";
      case "MAINTENANCE":
        return "#F59E0B";
      case "INACTIVE":
        return "#6B7280";
      default:
        return "#6B7280";
    }
  };

  const getStatusText = (status?: string) => {
    switch (status) {
      case "ACTIVE":
        return "ATIVO";
      case "MAINTENANCE":
        return "MANUTENÇÃO";
      case "INACTIVE":
        return "INATIVO";
      default:
        return "NÃO DEFINIDO";
    }
  };

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#FFFFFF",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color="#028C56" />
        <Text style={{ marginTop: 10, color: "#6B7280" }}>
          Carregando veículo...
        </Text>
      </View>
    );
  }

  if (!veiculo) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#FFFFFF",
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        }}
      >
        <Ionicons name="alert-circle-outline" size={48} color="#9CA3AF" />
        <Text
          style={{
            marginTop: 10,
            color: "#6B7280",
            textAlign: "center",
            fontSize: 16,
          }}
        >
          Veículo não encontrado.
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
            onPress={() => router.replace("/(cooperativa)/veiculos")}
            style={{ marginRight: 15 }}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={{ fontSize: 20, fontWeight: "700", color: "#FFFFFF" }}>
            DETALHES DO VEÍCULO
          </Text>
        </View>
      </LinearGradient>

      <ScrollView style={{ flex: 1, padding: 20 }} showsVerticalScrollIndicator={false}>
        <View
          style={{
            backgroundColor: "#F9FAFB",
            borderRadius: 16,
            padding: 18,
            borderWidth: 1,
            borderColor: "#E5E7EB",
            marginBottom: 20,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 12,
            }}
          >
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={{ fontSize: 20, fontWeight: "800", color: "#111827" }}>
                {veiculo.model}
              </Text>
              <Text style={{ fontSize: 15, color: "#6B7280", marginTop: 4 }}>
                {veiculo.plate}
              </Text>
            </View>

            <View
              style={{
                backgroundColor: getStatusColor(veiculo.status),
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 14,
              }}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "700" }}>
                {getStatusText(veiculo.status)}
              </Text>
            </View>
          </View>

          <View style={{ marginBottom: 10 }}>
            <Text style={{ fontSize: 13, color: "#028C56", marginBottom: 4 }}>
              Marca
            </Text>
            <Text style={{ fontSize: 16, color: "#111827" }}>
              {veiculo.brand || "Não informada"}
            </Text>
          </View>

          <View style={{ marginBottom: 10 }}>
            <Text style={{ fontSize: 13, color: "#028C56", marginBottom: 4 }}>
              Ano
            </Text>
            <Text style={{ fontSize: 16, color: "#111827" }}>
              {veiculo.year ?? "Não informado"}
            </Text>
          </View>

          <View>
            <Text style={{ fontSize: 13, color: "#028C56", marginBottom: 4 }}>
              Capacidade
            </Text>
            <Text style={{ fontSize: 16, color: "#111827" }}>
              {veiculo.capacityKg ?? "Não informada"}{" "}
              {veiculo.capacityKg ? "kg" : ""}
            </Text>
          </View>
        </View>

        <View style={{ marginBottom: 30 }}>
          <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 10 }}>
            Alterar status
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {[
              { label: "Ativo", value: "ACTIVE" },
              { label: "Manutenção", value: "MAINTENANCE" },
              { label: "Inativo", value: "INACTIVE" },
            ].map((item) => {
              const selected = veiculo.status === item.value;

              return (
                <TouchableOpacity
                  key={item.value}
                  onPress={() => handleChangeStatus(item.value as VehicleStatus)}
                  disabled={savingStatus}
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

          {savingStatus && (
            <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center" }}>
              <ActivityIndicator size="small" color="#028C56" />
              <Text style={{ marginLeft: 8, color: "#6B7280" }}>
                Atualizando status...
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}