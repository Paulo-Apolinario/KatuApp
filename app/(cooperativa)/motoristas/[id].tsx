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
  driverService,
  type Driver,
  type DriverStatus,
} from "@/src/services/driverService";

export default function MotoristaDetalheScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const driverId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [motorista, setMotorista] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);

  function formatCpf(value?: string | null) {
    const only = (value || "").replace(/\D/g, "");
    if (only.length !== 11) return value || "Não informado";
    return only.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }

  const loadMotorista = useCallback(async () => {
    if (!driverId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await driverService.getById(driverId);
      setMotorista(data);
    } catch (error) {
      console.error("Erro ao carregar motorista:", error);
      Alert.alert("Erro", "Não foi possível carregar o motorista.", [
        {
          text: "OK",
          onPress: () => router.replace("/(cooperativa)/motoristas"),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    loadMotorista();
  }, [loadMotorista]);

  async function handleChangeStatus(status: DriverStatus) {
    if (!driverId) return;

    try {
      setSavingStatus(true);
      const updated = await driverService.updateStatus(driverId, status);
      setMotorista(updated);
      Alert.alert("Sucesso", "Status do motorista atualizado com sucesso.");
    } catch (error) {
      console.error("Erro ao atualizar status do motorista:", error);
      Alert.alert("Erro", "Não foi possível atualizar o status do motorista.");
    } finally {
      setSavingStatus(false);
    }
  }

  const getStatusColor = (status?: string) => {
  switch (status) {
    case "AVAILABLE":
      return "#10B981";
    case "ON_ROUTE":
      return "#F59E0B";
    case "INACTIVE":
      return "#6B7280";
    default:
      return "#6B7280";
  }
};

const getStatusText = (status?: string) => {
  switch (status) {
    case "AVAILABLE":
      return "DISPONÍVEL";
    case "ON_ROUTE":
      return "EM ROTA";
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
          Carregando motorista...
        </Text>
      </View>
    );
  }

  if (!motorista) {
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
          Motorista não encontrado.
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
            onPress={() => router.replace("/(cooperativa)/motoristas")}
            style={{ marginRight: 15 }}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={{ fontSize: 20, fontWeight: "700", color: "#FFFFFF" }}>
            DETALHES DO MOTORISTA
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
                {motorista.name}
              </Text>
            </View>

            <View
              style={{
                backgroundColor: getStatusColor(motorista.status),
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 14,
              }}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "700" }}>
                {getStatusText(motorista.status)}
              </Text>
            </View>
          </View>
          <View style={{ marginBottom: 10 }}>
              <Text style={{ fontSize: 13, color: "#028C56", marginBottom: 4 }}>
                   Email
                </Text>
                 <Text style={{ fontSize: 16, color: "#111827" }}>
                  {motorista.email}
              </Text>
           </View>

          <View style={{ marginBottom: 10 }}>
            <Text style={{ fontSize: 13, color: "#028C56", marginBottom: 4 }}>
              CPF
            </Text>
            <Text style={{ fontSize: 16, color: "#111827" }}>
              {formatCpf(motorista.cpf)}
            </Text>
          </View>

          <View style={{ marginBottom: 10 }}>
            <Text style={{ fontSize: 13, color: "#028C56", marginBottom: 4 }}>
              Telefone
            </Text>
            <Text style={{ fontSize: 16, color: "#111827" }}>
              {motorista.phone || "Não informado"}
            </Text>
          </View>

          <View style={{ marginBottom: 10 }}>
            <Text style={{ fontSize: 13, color: "#028C56", marginBottom: 4 }}>
              CNH
            </Text>
            <Text style={{ fontSize: 16, color: "#111827" }}>
              {motorista.cnh || "Não informada"}
            </Text>
          </View>

          <View style={{ marginBottom: 10 }}>
            <Text style={{ fontSize: 13, color: "#028C56", marginBottom: 4 }}>
              Categoria da CNH
            </Text>
            <Text style={{ fontSize: 16, color: "#111827" }}>
              {motorista.cnhCategory || "Não informada"}
            </Text>
          </View>

          <View>
            <Text style={{ fontSize: 13, color: "#028C56", marginBottom: 4 }}>
              Observações
            </Text>
            <Text style={{ fontSize: 16, color: "#111827" }}>
              {motorista.notes || "Nenhuma observação cadastrada"}
            </Text>
          </View>
        </View>

        <View style={{ marginBottom: 30 }}>
          <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 10 }}>
            Alterar status
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
  {[
    { label: "Disponível", value: "AVAILABLE" },
    { label: "Em rota", value: "ON_ROUTE" },
    { label: "Inativo", value: "INACTIVE" },
  ].map((item) => {
    const selected = motorista.status === item.value;

    return (
      <TouchableOpacity
        key={item.value}
        onPress={() => handleChangeStatus(item.value as DriverStatus)}
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