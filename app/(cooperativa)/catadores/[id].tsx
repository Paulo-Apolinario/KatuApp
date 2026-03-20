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

import {
  collectorService,
  type Collector,
  type CollectorStatus,
} from "@/src/services/collectorService";

export default function CatadorDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const routeId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);
  const [catador, setCatador] = useState<Collector | null>(null);

  const loadCatador = useCallback(async () => {
    if (!routeId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await collectorService.getById(routeId);
      setCatador(data);
    } catch (error) {
      console.error("Erro ao carregar catador:", error);
      Alert.alert("Erro", "Não foi possível carregar os dados do catador.", [
        {
          text: "OK",
          onPress: () => router.replace("/(cooperativa)/catadores"),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [routeId]);

  useEffect(() => {
    loadCatador();
  }, [loadCatador]);

  async function handleChangeStatus(status: CollectorStatus) {
    if (!routeId || savingStatus) return;

    try {
      setSavingStatus(true);
      const updated = await collectorService.updateStatus(routeId, status);
      setCatador(updated);
      Alert.alert("Sucesso", "Status do catador atualizado com sucesso.");
    } catch (error: any) {
      console.error("Erro ao atualizar status do catador:", error);
      Alert.alert(
        "Erro",
        error?.message || "Não foi possível atualizar o status."
      );
    } finally {
      setSavingStatus(false);
    }
  }

  const getStatusColor = (status?: CollectorStatus) => {
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

  const getStatusText = (status?: CollectorStatus) => {
    switch (status) {
      case "AVAILABLE":
        return "DISPONÍVEL";
      case "ON_ROUTE":
        return "EM COLETA";
      case "INACTIVE":
        return "INATIVO";
      default:
        return "SEM STATUS";
    }
  };

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
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <TouchableOpacity
            onPress={() => router.replace("/(cooperativa)/catadores")}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={{ fontSize: 20, fontWeight: "700", color: "#FFFFFF" }}>
            Detalhes do Catador
          </Text>

          <View style={{ width: 24 }} />
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1, padding: 20 }}
      >
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
            {catador.name || "Sem nome"}
          </Text>

          <View
            style={{
              backgroundColor: getStatusColor(catador.status),
              paddingHorizontal: 12,
              paddingVertical: 4,
              borderRadius: 20,
              marginTop: 5,
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "600" }}>
              {getStatusText(catador.status)}
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
          <Text
            style={{
              fontSize: 16,
              fontWeight: "600",
              color: "#111827",
              marginBottom: 12,
            }}
          >
            Informações Pessoais
          </Text>

          <View style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 12, color: "#6B7280" }}>CPF</Text>
            <Text style={{ fontSize: 14, color: "#111827", fontWeight: "500" }}>
              {catador.document || "-"}
            </Text>
          </View>

          <View style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 12, color: "#6B7280" }}>Telefone</Text>
            <Text style={{ fontSize: 14, color: "#111827", fontWeight: "500" }}>
              {catador.phone || "-"}
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
              {catador.address || "-"}
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
          <Text
            style={{
              fontSize: 16,
              fontWeight: "600",
              color: "#111827",
              marginBottom: 12,
            }}
          >
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
                {Number(catador.kgMonth || 0)} kg
              </Text>
              <Text style={{ fontSize: 12, color: "#6B7280" }}>Este mês</Text>
            </View>

            <View style={{ alignItems: "center" }}>
              <Text style={{ fontSize: 24, fontWeight: "700", color: "#028C56" }}>
                {Number(catador.collectionsToday || 0)}
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
          <Text
            style={{
              fontSize: 16,
              fontWeight: "600",
              color: "#111827",
              marginBottom: 12,
            }}
          >
            Alterar status
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {[
              { label: "Disponível", value: "AVAILABLE" as CollectorStatus },
              { label: "Em coleta", value: "ON_ROUTE" as CollectorStatus },
              { label: "Inativo", value: "INACTIVE" as CollectorStatus },
            ].map((item) => {
              const selected = catador.status === item.value;

              return (
                <TouchableOpacity
                  key={item.value}
                  disabled={savingStatus}
                  onPress={() => handleChangeStatus(item.value)}
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
            <View
              style={{ marginTop: 8, flexDirection: "row", alignItems: "center" }}
            >
              <ActivityIndicator size="small" color="#028C56" />
              <Text style={{ marginLeft: 8, color: "#6B7280" }}>
                Atualizando status...
              </Text>
            </View>
          )}
        </View>

        <View
          style={{
            backgroundColor: "#F9FAFB",
            borderRadius: 16,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "600",
              color: "#111827",
              marginBottom: 12,
            }}
          >
            Histórico
          </Text>

          <Text style={{ fontSize: 14, color: "#6B7280" }}>
            O histórico detalhado de coletas deste catador será integrado na
            próxima etapa.
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