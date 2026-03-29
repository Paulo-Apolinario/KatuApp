import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  collectionService,
  type Collection,
  type CollectionMaterial,
} from "@/src/services/collectionService";

function normalizeMaterials(materials: unknown): CollectionMaterial[] {
  if (!Array.isArray(materials)) return [];

  return materials
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const typed = item as {
        type?: unknown;
        quantityKg?: unknown;
      };

      return {
        type: String(typed.type ?? "").trim(),
        quantityKg: Number(typed.quantityKg ?? 0),
      };
    })
    .filter(
      (item): item is CollectionMaterial =>
        !!item && item.type.length > 0
    );
}

function getCollectionTotalKg(collection: Collection) {
  const materials = normalizeMaterials(collection.materials);
  const materialsTotal = materials.reduce(
    (sum, item) => sum + Number(item.quantityKg || 0),
    0
  );

  if (materialsTotal > 0) return materialsTotal;
  return Number(collection.totalWeightKg ?? 0);
}

function formatDateTime(dateString?: string | null) {
  if (!dateString) return "-";

  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return "-";

  return parsed.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMaterials(materials?: CollectionMaterial[]) {
  const normalized = normalizeMaterials(materials);
  if (normalized.length === 0) return "-";

  return normalized
    .map((item) => `${item.type}: ${Number(item.quantityKg || 0).toFixed(1)} kg`)
    .join(" • ");
}

function getStatusColor(status?: CollectorStatus) {
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
}

function getStatusText(status?: CollectorStatus) {
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
}

function getCollectionBadgeColor(status: Collection["status"]) {
  switch (status) {
    case "PENDING":
      return "#64748B";
    case "IN_PROGRESS":
      return "#F59E0B";
    case "COMPLETED":
      return "#10B981";
    case "CANCELLED":
      return "#DC2626";
    default:
      return "#64748B";
  }
}

function getCollectionStatusLabel(status: Collection["status"]) {
  switch (status) {
    case "PENDING":
      return "Pendente";
    case "IN_PROGRESS":
      return "Em andamento";
    case "COMPLETED":
      return "Concluída";
    case "CANCELLED":
      return "Cancelada";
    default:
      return status;
  }
}

function isSameDay(dateA: Date, dateB: Date) {
  return (
    dateA.getDate() === dateB.getDate() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getFullYear() === dateB.getFullYear()
  );
}

export default function CatadorDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const routeId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);
  const [catador, setCatador] = useState<Collector | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);

  const loadCatador = useCallback(async () => {
    if (!routeId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      if (!collectorService || typeof collectorService.getById !== "function") {
        throw new Error("Serviço de catadores não carregado.");
      }

      if (!collectionService || typeof collectionService.list !== "function") {
        throw new Error("Serviço de coletas não carregado.");
      }

      const [collectorData, collectionsData] = await Promise.all([
        collectorService.getById(routeId),
        collectionService.list(),
      ]);

      setCatador(collectorData);
      setCollections(Array.isArray(collectionsData) ? collectionsData : []);
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

  const handleAtribuirRota = () => {
    Alert.alert(
      "Aviso",
      "A atribuição de rota para catador será a próxima etapa do sistema."
    );
  };

  const completedCollections = useMemo(() => {
    if (!catador?.id) return [];

    return collections
      .filter(
        (item) =>
          item.collectorId === catador.id && item.status === "COMPLETED"
      )
      .sort((a, b) => {
        const aTime = new Date(a.collectedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.collectedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      });
  }, [collections, catador?.id]);

  const stats = useMemo(() => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    let totalKg = 0;
    let kgMonth = 0;
    let kgToday = 0;

    for (const collection of completedCollections) {
      const total = getCollectionTotalKg(collection);
      totalKg += total;

      const rawDate = collection.collectedAt || collection.createdAt;
      if (!rawDate) continue;

      const date = new Date(rawDate);
      if (Number.isNaN(date.getTime())) continue;

      if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
        kgMonth += total;
      }

      if (isSameDay(date, today)) {
        kgToday += total;
      }
    }

    return {
      totalKg,
      kgMonth,
      kgToday,
    };
  }, [completedCollections]);

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

  const cpf =
    (catador as any).cpf ||
    (catador as any).document ||
    (catador as any).rg ||
    "-";

  const address =
    (catador as any).address ||
    (catador as any).street ||
    (catador as any).fullAddress ||
    "-";

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
            {catador.name || (catador as any).displayName || "Sem nome"}
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
              {cpf || "-"}
            </Text>
          </View>

          <View style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 12, color: "#6B7280" }}>Telefone</Text>
            <Text style={{ fontSize: 14, color: "#111827", fontWeight: "500" }}>
              {(catador as any).phone || "-"}
            </Text>
          </View>

          <View style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 12, color: "#6B7280" }}>Email</Text>
            <Text style={{ fontSize: 14, color: "#111827", fontWeight: "500" }}>
              {(catador as any).email || "-"}
            </Text>
          </View>

          <View>
            <Text style={{ fontSize: 12, color: "#6B7280" }}>Endereço</Text>
            <Text style={{ fontSize: 14, color: "#111827", fontWeight: "500" }}>
              {address || "-"}
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
                {stats.totalKg.toFixed(1)} kg
              </Text>
              <Text style={{ fontSize: 12, color: "#6B7280" }}>Total</Text>
            </View>

            <View style={{ alignItems: "center" }}>
              <Text style={{ fontSize: 24, fontWeight: "700", color: "#028C56" }}>
                {stats.kgMonth.toFixed(1)} kg
              </Text>
              <Text style={{ fontSize: 12, color: "#6B7280" }}>Este mês</Text>
            </View>

            <View style={{ alignItems: "center" }}>
              <Text style={{ fontSize: 24, fontWeight: "700", color: "#028C56" }}>
                {stats.kgToday.toFixed(1)} kg
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

          {completedCollections.length > 0 ? (
            completedCollections.map((collection) => (
              <View
                key={collection.id}
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "700",
                        color: "#111827",
                      }}
                    >
                      {collection.generator?.companyName ||
                        collection.generator?.businessName ||
                        collection.generator?.name ||
                        "Gerador não informado"}
                    </Text>

                    <Text style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>
                      Data: {formatDateTime(collection.collectedAt || collection.createdAt)}
                    </Text>

                    <Text style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>
                      Peso: {getCollectionTotalKg(collection).toFixed(1)} kg
                    </Text>

                    <Text style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>
                      Materiais: {formatMaterials(collection.materials)}
                    </Text>
                  </View>

                  <View
                    style={{
                      backgroundColor: getCollectionBadgeColor(collection.status),
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                    }}
                  >
                    <Text
                      style={{
                        color: "#FFFFFF",
                        fontSize: 11,
                        fontWeight: "700",
                      }}
                    >
                      {getCollectionStatusLabel(collection.status)}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <Text style={{ fontSize: 14, color: "#6B7280" }}>
              Nenhuma coleta concluída registrada para este catador.
            </Text>
          )}
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