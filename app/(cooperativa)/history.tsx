import { useCallback, useMemo, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import {
  collectionService,
  type Collection,
  type CollectionMaterial,
} from "@/src/services/collectionService";

function formatDate(value?: string | null) {
  try {
    if (!value) return "Sem data";

    return new Date(value).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Sem data";
  }
}

function getSortDate(value?: string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function getStatusLabel(status?: string) {
  switch (status) {
    case "PENDING":
      return "PENDENTE";
    case "IN_PROGRESS":
      return "EM ANDAMENTO";
    case "COMPLETED":
      return "CONCLUÍDO";
    case "CANCELLED":
      return "CANCELADO";
    default:
      return "SEM STATUS";
  }
}

function getStatusColors(status?: string) {
  switch (status) {
    case "PENDING":
      return { bg: "#FEFCE8", text: "#A16207" };
    case "IN_PROGRESS":
      return { bg: "#EEF2FF", text: "#4338CA" };
    case "COMPLETED":
      return { bg: "#DCFCE7", text: "#166534" };
    case "CANCELLED":
      return { bg: "#FEE2E2", text: "#991B1B" };
    default:
      return { bg: "#F3F4F6", text: "#374151" };
  }
}

function formatMaterials(materials?: CollectionMaterial[] | null) {
  if (!Array.isArray(materials) || materials.length === 0) return "-";

  return materials
    .map((item) => `${item.type}: ${Number(item.quantityKg || 0).toFixed(1)} kg`)
    .join(" • ");
}

type CooperativaHistoryItem = {
  id: string;
  geradorNome: string;
  peso: number;
  status: string;
  dateLabel: string;
  sortDate: number;
  materialsLabel: string;
};

export default function CooperativaHistoryScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [history, setHistory] = useState<CooperativaHistoryItem[]>([]);

  const loadHistory = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);

      const collections = await collectionService.list();

      const items: CooperativaHistoryItem[] = collections.map((item: Collection) => {
        const rawDate = item.collectedAt || item.createdAt || null;

        return {
          id: item.id,
          geradorNome:
            item.generator?.companyName ||
            item.generator?.name ||
            item.schedule?.requestedBy?.displayName ||
            item.schedule?.requestedBy?.email ||
            "Origem não identificada",
          peso: Number(item.totalWeightKg ?? 0),
          status: item.status || "PENDING",
          dateLabel: formatDate(rawDate),
          sortDate: getSortDate(rawDate),
          materialsLabel: formatMaterials(item.materials),
        };
      });

      const orderedItems = items.sort((a, b) => b.sortDate - a.sortDate);
      setHistory(orderedItems);
    } catch (error: any) {
      Alert.alert(
        "Erro",
        error?.message || "Não foi possível carregar o histórico."
      );
      setHistory([]);
    } finally {
      if (showLoader) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory(true);
    }, [loadHistory])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadHistory(false);
  }, [loadHistory]);

  const totalKg = useMemo(() => {
    return history.reduce((acc, item) => acc + Number(item.peso || 0), 0);
  }, [history]);

  const completedCount = useMemo(() => {
    return history.filter((item) => item.status === "COMPLETED").length;
  }, [history]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#F3F4F6",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color="#028C56" />
        <Text style={{ marginTop: 10, color: "#6B7280" }}>
          Carregando histórico...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F3F4F6" }}>
      <LinearGradient
        colors={["#10F35D", "#028C56"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          paddingTop: 50,
          paddingBottom: 24,
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
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 22,
              fontWeight: "800",
            }}
          >
            HISTÓRICO
          </Text>

          <View style={{ width: 24 }} />
        </View>

        <Text
          style={{
            color: "#E8FFF1",
            fontSize: 14,
            marginTop: 10,
          }}
        >
          Histórico consolidado das coletas da cooperativa
        </Text>
      </LinearGradient>

      <View style={{ paddingHorizontal: 16, paddingTop: 18, flex: 1 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View
            style={{
              width: "48.5%",
              backgroundColor: "#FFFFFF",
              borderRadius: 18,
              padding: 16,
              borderWidth: 1,
              borderColor: "#E5E7EB",
            }}
          >
            <Text style={{ color: "#6B7280", fontSize: 13 }}>Total coletado</Text>
            <Text
              style={{
                color: "#111827",
                fontSize: 24,
                fontWeight: "800",
                marginTop: 6,
              }}
            >
              {totalKg.toFixed(1)} kg
            </Text>
          </View>

          <View
            style={{
              width: "48.5%",
              backgroundColor: "#FFFFFF",
              borderRadius: 18,
              padding: 16,
              borderWidth: 1,
              borderColor: "#E5E7EB",
            }}
          >
            <Text style={{ color: "#6B7280", fontSize: 13 }}>Concluídas</Text>
            <Text
              style={{
                color: "#111827",
                fontSize: 24,
                fontWeight: "800",
                marginTop: 6,
              }}
            >
              {completedCount}
            </Text>
          </View>
        </View>

        <Text
          style={{
            fontSize: 18,
            fontWeight: "800",
            color: "#111827",
            marginTop: 20,
            marginBottom: 12,
          }}
        >
          Coletas registradas
        </Text>

        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: 30,
            flexGrow: history.length === 0 ? 1 : undefined,
          }}
          renderItem={({ item }) => {
            const statusColors = getStatusColors(item.status);

            return (
              <View
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 18,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                  marginBottom: 12,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text
                      style={{
                        color: "#111827",
                        fontSize: 16,
                        fontWeight: "800",
                        marginBottom: 6,
                      }}
                    >
                      {item.geradorNome}
                    </Text>

                    <Text style={{ color: "#374151", fontSize: 14, marginBottom: 4 }}>
                      Peso total: {item.peso.toFixed(1)} kg
                    </Text>

                    <Text style={{ color: "#6B7280", fontSize: 13, marginBottom: 4 }}>
                      Data: {item.dateLabel}
                    </Text>

                    <Text style={{ color: "#6B7280", fontSize: 13 }}>
                      Materiais: {item.materialsLabel}
                    </Text>
                  </View>

                  <View
                    style={{
                      backgroundColor: statusColors.bg,
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                    }}
                  >
                    <Text
                      style={{
                        color: statusColors.text,
                        fontSize: 11,
                        fontWeight: "800",
                      }}
                    >
                      {getStatusLabel(item.status)}
                    </Text>
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 40,
              }}
            >
              <Ionicons name="document-text-outline" size={48} color="#9CA3AF" />
              <Text
                style={{
                  marginTop: 12,
                  fontSize: 16,
                  fontWeight: "700",
                  color: "#111827",
                  textAlign: "center",
                }}
              >
                Nenhuma coleta registrada
              </Text>
              <Text
                style={{
                  marginTop: 6,
                  color: "#6B7280",
                  textAlign: "center",
                  lineHeight: 22,
                  paddingHorizontal: 24,
                }}
              >
                Quando as coletas forem executadas pelos catadores, elas aparecerão aqui.
              </Text>
            </View>
          }
        />
      </View>
    </View>
  );
}