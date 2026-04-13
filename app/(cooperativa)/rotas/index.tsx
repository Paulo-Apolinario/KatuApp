import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { routeService, type RouteItem } from "@/src/services/routeService";

type RouteFilter = "ALL" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export default function RotasScreen() {
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<RouteFilter>("ALL");

  const loadRoutes = useCallback(async () => {
    try {
      const data = await routeService.list();
      setRoutes(data);
    } catch (error) {
      console.error("Erro ao carregar rotas:", error);
      Alert.alert("Erro", "Não foi possível carregar as rotas.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadRoutes();
    }, [loadRoutes])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadRoutes();
  }, [loadRoutes]);

  const filteredRoutes = useMemo(() => {
    if (activeFilter === "ALL") return routes;
    return routes.filter((item) => item.status === activeFilter);
  }, [routes, activeFilter]);

  const overview = useMemo(() => {
    const scheduled = routes.filter((item) => item.status === "SCHEDULED").length;
    const inProgress = routes.filter((item) => item.status === "IN_PROGRESS").length;
    const completed = routes.filter((item) => item.status === "COMPLETED").length;
    const cancelled = routes.filter((item) => item.status === "CANCELLED").length;

    const totalCollections = routes.reduce(
      (acc, item) => acc + Number(item.stats?.totalCollections ?? 0),
      0
    );
    const totalActiveCollections = routes.reduce(
      (acc, item) => acc + Number(item.stats?.inProgressCollections ?? 0),
      0
    );

    return {
      totalRoutes: routes.length,
      scheduled,
      inProgress,
      completed,
      cancelled,
      totalCollections,
      totalActiveCollections,
    };
  }, [routes]);

  function getStatusLabel(status?: string) {
    switch (status) {
      case "SCHEDULED":
        return "AGENDADA";
      case "IN_PROGRESS":
        return "EM ANDAMENTO";
      case "COMPLETED":
        return "CONCLUÍDA";
      case "CANCELLED":
        return "CANCELADA";
      default:
        return "SEM STATUS";
    }
  }

  function getStatusColor(status?: string) {
    switch (status) {
      case "SCHEDULED":
        return "#F59E0B";
      case "IN_PROGRESS":
        return "#10B981";
      case "COMPLETED":
        return "#2563EB";
      case "CANCELLED":
        return "#DC2626";
      default:
        return "#6B7280";
    }
  }

  function formatDate(date?: string | null) {
    if (!date) return "Não informada";

    try {
      const parsed = new Date(date);
      if (Number.isNaN(parsed.getTime())) return String(date);
      return parsed.toLocaleDateString("pt-BR");
    } catch {
      return String(date);
    }
  }

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
        <Text style={{ marginTop: 12, color: "#6B7280" }}>
          Carregando rotas...
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
          paddingTop: 52,
          paddingBottom: 24,
          paddingHorizontal: 20,
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
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
              fontSize: 18,
              fontWeight: "800",
            }}
          >
            ROTAS
          </Text>

          <TouchableOpacity onPress={onRefresh}>
            <Ionicons name="refresh-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 24,
            fontWeight: "800",
            marginTop: 16,
          }}
        >
          Painel operacional
        </Text>

        <Text
          style={{
            color: "#FFFFFF",
            opacity: 0.92,
            marginTop: 6,
            fontSize: 14,
          }}
        >
          Acompanhe rotas, coletas vinculadas e andamento da operação.
        </Text>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 30 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 18,
            padding: 16,
            borderWidth: 1,
            borderColor: "#E5E7EB",
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "800",
              color: "#111827",
              marginBottom: 14,
            }}
          >
            Visão geral
          </Text>

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "space-between",
              rowGap: 12,
            }}
          >
            <MetricCard
              label="Rotas"
              value={String(overview.totalRoutes)}
              color="#111827"
            />
            <MetricCard
              label="Agendadas"
              value={String(overview.scheduled)}
              color="#F59E0B"
            />
            <MetricCard
              label="Em andamento"
              value={String(overview.inProgress)}
              color="#10B981"
            />
            <MetricCard
              label="Concluídas"
              value={String(overview.completed)}
              color="#2563EB"
            />
            <MetricCard
              label="Canceladas"
              value={String(overview.cancelled)}
              color="#DC2626"
            />
            <MetricCard
              label="Coletas"
              value={String(overview.totalCollections)}
              color="#7C3AED"
            />
          </View>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            marginBottom: 16,
          }}
        >
          <TouchableOpacity
            onPress={() => router.push("/(cooperativa)/rotas/novo")}
            style={{
              flex: 1,
              backgroundColor: "#028C56",
              borderRadius: 16,
              paddingVertical: 14,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
            }}
          >
            <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
            <Text
              style={{
                color: "#FFFFFF",
                fontWeight: "800",
                marginLeft: 8,
              }}
            >
              Nova rota
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("../(cooperativa)/mapas")}
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 16,
              paddingVertical: 14,
              paddingHorizontal: 16,
              borderWidth: 1,
              borderColor: "#E5E7EB",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="map-outline" size={20} color="#111827" />
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 8 }}
          style={{ marginBottom: 16 }}
        >
          <View style={{ flexDirection: "row", gap: 10 }}>
            <FilterChip
              label="Todas"
              active={activeFilter === "ALL"}
              onPress={() => setActiveFilter("ALL")}
            />
            <FilterChip
              label="Agendadas"
              active={activeFilter === "SCHEDULED"}
              onPress={() => setActiveFilter("SCHEDULED")}
            />
            <FilterChip
              label="Em andamento"
              active={activeFilter === "IN_PROGRESS"}
              onPress={() => setActiveFilter("IN_PROGRESS")}
            />
            <FilterChip
              label="Concluídas"
              active={activeFilter === "COMPLETED"}
              onPress={() => setActiveFilter("COMPLETED")}
            />
            <FilterChip
              label="Canceladas"
              active={activeFilter === "CANCELLED"}
              onPress={() => setActiveFilter("CANCELLED")}
            />
          </View>
        </ScrollView>

        {filteredRoutes.length === 0 ? (
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 18,
              paddingVertical: 34,
              paddingHorizontal: 20,
              borderWidth: 1,
              borderColor: "#E5E7EB",
              alignItems: "center",
            }}
          >
            <Ionicons name="trail-sign-outline" size={42} color="#9CA3AF" />
            <Text
              style={{
                marginTop: 12,
                color: "#374151",
                fontSize: 16,
                fontWeight: "700",
              }}
            >
              Nenhuma rota encontrada
            </Text>
            <Text
              style={{
                marginTop: 6,
                color: "#6B7280",
                textAlign: "center",
                lineHeight: 20,
              }}
            >
              Não há rotas para este filtro no momento.
            </Text>
          </View>
        ) : (
          filteredRoutes.map((item) => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.9}
              onPress={() =>
                router.push(`/(cooperativa)/rotas/${item.id}` as any)
              }
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 18,
                padding: 16,
                borderWidth: 1,
                borderColor: "#E5E7EB",
                marginBottom: 14,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                }}
              >
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text
                    style={{
                      fontSize: 17,
                      fontWeight: "800",
                      color: "#111827",
                    }}
                  >
                    {item.name}
                  </Text>

                  <Text
                    style={{
                      marginTop: 4,
                      color: "#6B7280",
                      fontSize: 13,
                    }}
                  >
                    {item.description?.trim() || "Rota operacional da cooperativa"}
                  </Text>
                </View>

                <View
                  style={{
                    backgroundColor: getStatusColor(item.status),
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 999,
                  }}
                >
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 10,
                      fontWeight: "800",
                    }}
                  >
                    {getStatusLabel(item.status)}
                  </Text>
                </View>
              </View>

              <View
                style={{
                  marginTop: 14,
                  flexDirection: "row",
                  flexWrap: "wrap",
                  rowGap: 8,
                }}
              >
                <InfoPill
                  icon="calendar-outline"
                  label={formatDate(item.scheduledDate)}
                />
                <InfoPill
                  icon="person-outline"
                  label={item.driver?.name || "Motorista não definido"}
                />
                <InfoPill
                  icon="car-outline"
                  label={
                    item.vehicle?.model
                      ? `${item.vehicle.model}${item.vehicle?.plate ? ` - ${item.vehicle.plate}` : ""}`
                      : "Veículo não definido"
                  }
                />
              </View>

              <View
                style={{
                  marginTop: 14,
                  backgroundColor: "#F9FAFB",
                  borderRadius: 16,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: "#374151",
                    marginBottom: 10,
                  }}
                >
                  Indicadores da rota
                </Text>

                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    justifyContent: "space-between",
                    rowGap: 10,
                  }}
                >
                  <MiniStat
                    label="Coletas"
                    value={String(item.stats?.totalCollections ?? 0)}
                    color="#111827"
                  />
                  <MiniStat
                    label="Pendentes"
                    value={String(item.stats?.pendingCollections ?? 0)}
                    color="#F59E0B"
                  />
                  <MiniStat
                    label="Em andamento"
                    value={String(item.stats?.inProgressCollections ?? 0)}
                    color="#10B981"
                  />
                  <MiniStat
                    label="Concluídas"
                    value={String(item.stats?.completedCollections ?? 0)}
                    color="#2563EB"
                  />
                  <MiniStat
                    label="Canceladas"
                    value={String(item.stats?.cancelledCollections ?? 0)}
                    color="#DC2626"
                  />
                  <MiniStat
                    label="Paradas"
                    value={String(item.stops?.length ?? 0)}
                    color="#7C3AED"
                  />
                </View>
              </View>

              <View
                style={{
                  marginTop: 14,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: "#6B7280",
                    fontSize: 12,
                    fontWeight: "600",
                  }}
                >
                  Toque para gerenciar a operação
                </Text>

                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color="#9CA3AF"
                />
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View
      style={{
        width: "31%",
        minWidth: 96,
        backgroundColor: "#F9FAFB",
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: "#E5E7EB",
      }}
    >
      <Text
        style={{
          fontSize: 12,
          color: "#6B7280",
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          marginTop: 6,
          fontSize: 20,
          fontWeight: "800",
          color,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View
      style={{
        width: "31%",
        minWidth: 82,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          color: "#6B7280",
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          marginTop: 4,
          fontSize: 16,
          fontWeight: "800",
          color,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function InfoPill({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F3F4F6",
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 8,
        marginRight: 8,
      }}
    >
      <Ionicons name={icon} size={14} color="#4B5563" />
      <Text
        style={{
          marginLeft: 6,
          color: "#374151",
          fontSize: 12,
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: active ? "#028C56" : "#FFFFFF",
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: active ? "#028C56" : "#E5E7EB",
      }}
    >
      <Text
        style={{
          color: active ? "#FFFFFF" : "#374151",
          fontWeight: "700",
          fontSize: 12,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}