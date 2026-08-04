import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNotification } from "@/src/contexts/NotificationContext";
import { LinearGradient } from "expo-linear-gradient";

import {
  scheduleService,
  type Schedule,
} from "@/src/services/scheduleService";
import {
  collectionService,
  type Collection,
} from "@/src/services/collectionService";
import {
  routeService,
  type RouteItem,
} from "@/src/services/routeService";
import {
  driverService,
  type Driver,
} from "@/src/services/driverService";
import {
  vehicleService,
  type Vehicle,
} from "@/src/services/vehicleService";

function formatDate(value?: string | null) {
  if (!value) return "Sem data";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem data";

  return date.toLocaleDateString("pt-BR");
}

function formatDateTime(value?: string | null) {
  if (!value) return "Sem data";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem data";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatWeight(value?: number | null) {
  return `${Number(value ?? 0).toFixed(1)} kg`;
}

function getScheduleStatusLabel(status?: string) {
  switch (status) {
    case "REQUESTED":
      return "Solicitado";
    case "SCHEDULED":
      return "Agendado";
    case "IN_PROGRESS":
      return "Em andamento";
    case "COMPLETED":
      return "Concluído";
    case "CANCELLED":
      return "Cancelado";
    default:
      return "Sem status";
  }
}

function getScheduleStatusColor(status?: string) {
  switch (status) {
    case "REQUESTED":
      return "#F59E0B";
    case "SCHEDULED":
      return "#2563EB";
    case "IN_PROGRESS":
      return "#8B5CF6";
    case "COMPLETED":
      return "#10B981";
    case "CANCELLED":
      return "#DC2626";
    default:
      return "#6B7280";
  }
}

function getRouteStatusLabel(status?: string) {
  switch (status) {
    case "SCHEDULED":
      return "Agendada";
    case "IN_PROGRESS":
      return "Em andamento";
    case "COMPLETED":
      return "Concluída";
    case "CANCELLED":
      return "Cancelada";
    default:
      return "Sem status";
  }
}

function getRouteStatusColor(status?: string) {
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

function getCollectionStatusLabel(status?: string) {
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
      return "Sem status";
  }
}

function getCollectionStatusColor(status?: string) {
  switch (status) {
    case "PENDING":
      return "#F59E0B";
    case "IN_PROGRESS":
      return "#8B5CF6";
    case "COMPLETED":
      return "#10B981";
    case "CANCELLED":
      return "#DC2626";
    default:
      return "#6B7280";
  }
}

function getScheduleName(item: Schedule) {
  return (
    item.generator?.companyName ||
    item.generator?.businessName ||
    item.generator?.name ||
    item.requestedBy?.displayName ||
    "Solicitação operacional"
  );
}

function getCollectionName(item: Collection) {
  return (
    item.generator?.companyName ||
    item.generator?.businessName ||
    item.generator?.name ||
    item.schedule?.generator?.companyName ||
    item.schedule?.generator?.businessName ||
    item.schedule?.generator?.name ||
    "Coleta operacional"
  );
}

function getCollectionAddress(item: Collection) {
  return (
    item.generator?.address ||
    item.schedule?.generator?.address ||
    "Endereço não informado"
  );
}

function getRouteVehicleLabel(item: RouteItem) {
  if (!item.vehicle?.model) return "Veículo não informado";
  return `${item.vehicle.model}${item.vehicle.plate ? ` - ${item.vehicle.plate}` : ""}`;
}

type ExecutiveMetricCardProps = {
  title: string;
  value: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  backgroundColor: string;
};

function ExecutiveMetricCard({
  title,
  value,
  subtitle,
  icon,
  color,
  backgroundColor,
}: ExecutiveMetricCardProps) {
  return (
    <View
      style={{
        width: "48.5%",
        backgroundColor,
        borderRadius: 22,
        padding: 16,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        minHeight: 142,
        justifyContent: "space-between",
      }}
    >
      <View
        style={{
          width: 50,
          height: 50,
          borderRadius: 25,
          backgroundColor: "rgba(255,255,255,0.65)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={24} color={color} />
      </View>

      <View>
        <Text
          style={{
            fontSize: 13,
            color: "#64748B",
            fontWeight: "700",
          }}
        >
          {title}
        </Text>

        <Text
          style={{
            marginTop: 4,
            fontSize: 26,
            fontWeight: "900",
            color: "#0F172A",
          }}
        >
          {value}
        </Text>

        <Text
          style={{
            marginTop: 6,
            fontSize: 12,
            color: "#64748B",
            lineHeight: 17,
          }}
        >
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onPress,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onPress?: () => void;
}) {
  return (
    <View
      style={{
        marginBottom: 12,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-end",
      }}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text
          style={{
            fontSize: 20,
            fontWeight: "900",
            color: "#0F172A",
          }}
        >
          {title}
        </Text>
        {!!subtitle && (
          <Text
            style={{
              fontSize: 13,
              color: "#64748B",
              marginTop: 4,
            }}
          >
            {subtitle}
          </Text>
        )}
      </View>

      {!!actionLabel && !!onPress && (
        <TouchableOpacity onPress={onPress}>
          <Text
            style={{
              color: "#028C56",
              fontWeight: "900",
              fontSize: 12,
            }}
          >
            {actionLabel}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}) {
  return (
    <View
      style={{
        alignItems: "center",
        paddingVertical: 24,
        paddingHorizontal: 14,
      }}
    >
      <Ionicons name={icon} size={42} color="#9CA3AF" />
      <Text
        style={{
          fontSize: 16,
          fontWeight: "800",
          color: "#111827",
          marginTop: 10,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          fontSize: 13,
          color: "#6B7280",
          marginTop: 6,
          textAlign: "center",
          lineHeight: 19,
        }}
      >
        {subtitle}
      </Text>
    </View>
  );
}

function Badge({
  label,
  color,
}: {
  label: string;
  color: string;
}) {
  return (
    <View
      style={{
        backgroundColor: color,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 7,
      }}
    >
      <Text
        style={{
          color: "#FFFFFF",
          fontWeight: "900",
          fontSize: 11,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function CooperativeDashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { notifyError } = useNotification();

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  const loadDashboard = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);

      const [
        schedulesResponse,
        collectionsResponse,
        routesResponse,
        driversResponse,
        vehiclesResponse,
      ] = await Promise.all([
        scheduleService.list(),
        collectionService.list(),
        routeService.list(),
        driverService.list(),
        vehicleService.list(),
      ]);

      setSchedules(Array.isArray(schedulesResponse) ? schedulesResponse : []);
      setCollections(Array.isArray(collectionsResponse) ? collectionsResponse : []);
      setRoutes(Array.isArray(routesResponse) ? routesResponse : []);
      setDrivers(Array.isArray(driversResponse) ? driversResponse : []);
      setVehicles(Array.isArray(vehiclesResponse) ? vehiclesResponse : []);
    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
      notifyError("Não foi possível carregar o dashboard da cooperativa.");
      setSchedules([]);
      setCollections([]);
      setRoutes([]);
      setDrivers([]);
      setVehicles([]);
    } finally {
      if (showLoader) setLoading(false);
      setRefreshing(false);
    }
  }, [notifyError]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard(true);
    }, [loadDashboard])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboard(false);
  }, [loadDashboard]);

  const dashboardMetrics = useMemo(() => {
    const requestedSchedules = schedules.filter(
      (item) => item.status === "REQUESTED"
    );
    const scheduledSchedules = schedules.filter(
      (item) => item.status === "SCHEDULED"
    );
    const inProgressSchedules = schedules.filter(
      (item) => item.status === "IN_PROGRESS"
    );

    const activeRoutes = routes.filter(
      (item) => item.status === "SCHEDULED" || item.status === "IN_PROGRESS"
    );

    const inProgressCollections = collections.filter(
      (item) => item.status === "IN_PROGRESS"
    );

    const completedToday = collections.filter((item) => {
      if (item.status !== "COMPLETED") return false;

      const baseDate = item.collectedAt || item.updatedAt || item.createdAt;
      if (!baseDate) return false;

      const date = new Date(baseDate);
      const today = new Date();

      return (
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear()
      );
    });

    const totalCollectedKg = collections
      .filter((item) => item.status === "COMPLETED")
      .reduce((sum, item) => sum + Number(item.totalWeightKg ?? 0), 0);

    const driversAvailable = drivers.filter(
      (item) => item.status === "AVAILABLE"
    ).length;

    const vehiclesActive = vehicles.filter(
      (item) => item.status === "ACTIVE"
    ).length;

    const nextSchedules = [...schedules]
      .filter(
        (item) => item.status === "REQUESTED" || item.status === "SCHEDULED"
      )
      .sort((a, b) => {
        const aTime = new Date(
          a.scheduledDate || a.preferredDate || a.createdAt || 0
        ).getTime();
        const bTime = new Date(
          b.scheduledDate || b.preferredDate || b.createdAt || 0
        ).getTime();
        return aTime - bTime;
      })
      .slice(0, 4);

    const recentCollections = [...collections]
      .sort((a, b) => {
        const aTime = new Date(a.collectedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.collectedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 4);

    const recentRoutes = [...routes]
      .sort((a, b) => {
        const aTime = new Date(a.scheduledDate || a.createdAt || 0).getTime();
        const bTime = new Date(b.scheduledDate || b.createdAt || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 4);

    return {
      requestedSchedules: requestedSchedules.length,
      scheduledSchedules: scheduledSchedules.length,
      inProgressSchedules: inProgressSchedules.length,
      activeRoutes: activeRoutes.length,
      inProgressCollections: inProgressCollections.length,
      completedToday: completedToday.length,
      totalCollectedKg,
      driversAvailable,
      vehiclesActive,
      nextSchedules,
      recentCollections,
      recentRoutes,
    };
  }, [schedules, collections, routes, drivers, vehicles]);

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
          Carregando dashboard...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#F3F4F6" }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 30 }}
    >
      <LinearGradient
        colors={["#10F35D", "#028C56"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          paddingTop: 50,
          paddingBottom: 28,
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
          <View>
            <Text style={{ color: "#E8FFF1", fontSize: 13, fontWeight: "700" }}>
              Visão executiva
            </Text>
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 28,
                fontWeight: "900",
                marginTop: 4,
              }}
            >
              Dashboard
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: "rgba(255,255,255,0.16)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <Text
          style={{
            color: "#E8FFF1",
            fontSize: 14,
            lineHeight: 20,
            marginTop: 10,
          }}
        >
          Acompanhe os principais indicadores da cooperativa, a operação em campo
          e o ritmo das rotas.
        </Text>
      </LinearGradient>

      <View style={{ paddingHorizontal: 20, paddingTop: 18 }}>
        <SectionHeader
          title="Indicadores principais"
          subtitle="Leitura rápida do cenário atual da cooperativa."
        />

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            flexWrap: "wrap",
            rowGap: 12,
            marginBottom: 22,
          }}
        >
          <ExecutiveMetricCard
            title="Solicitações"
            value={String(dashboardMetrics.requestedSchedules)}
            subtitle="Pedidos aguardando organização"
            icon="document-text-outline"
            color="#F59E0B"
            backgroundColor="#FFF7E8"
          />
          <ExecutiveMetricCard
            title="Agendados"
            value={String(dashboardMetrics.scheduledSchedules)}
            subtitle="Coletas programadas para execução"
            icon="calendar-outline"
            color="#2563EB"
            backgroundColor="#EEF4FF"
          />
          <ExecutiveMetricCard
            title="Rotas ativas"
            value={String(dashboardMetrics.activeRoutes)}
            subtitle="Rotas em agenda ou andamento"
            icon="git-network-outline"
            color="#7C3AED"
            backgroundColor="#F5F3FF"
          />
          <ExecutiveMetricCard
            title="Em campo"
            value={String(dashboardMetrics.inProgressCollections)}
            subtitle="Coletas em execução neste momento"
            icon="trail-sign-outline"
            color="#8B5CF6"
            backgroundColor="#F5F3FF"
          />
          <ExecutiveMetricCard
            title="Concluídas hoje"
            value={String(dashboardMetrics.completedToday)}
            subtitle="Execuções finalizadas no dia"
            icon="checkmark-done-outline"
            color="#10B981"
            backgroundColor="#ECFDF5"
          />
          <ExecutiveMetricCard
            title="Peso coletado"
            value={formatWeight(dashboardMetrics.totalCollectedKg)}
            subtitle="Volume concluído acumulado"
            icon="barbell-outline"
            color="#0F766E"
            backgroundColor="#ECFEFF"
          />
        </View>

        <SectionHeader
          title="Disponibilidade operacional"
          subtitle="Recursos prontos para apoiar a operação."
        />

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            flexWrap: "wrap",
            rowGap: 12,
            marginBottom: 22,
          }}
        >
          <ExecutiveMetricCard
            title="Motoristas disponíveis"
            value={String(dashboardMetrics.driversAvailable)}
            subtitle="Equipe pronta para entrar em rota"
            icon="people-outline"
            color="#028C56"
            backgroundColor="#EAF8F3"
          />
          <ExecutiveMetricCard
            title="Veículos ativos"
            value={String(dashboardMetrics.vehiclesActive)}
            subtitle="Frota apta para operação"
            icon="car-outline"
            color="#E59200"
            backgroundColor="#FFF8E8"
          />
          <ExecutiveMetricCard
            title="Em andamento"
            value={String(dashboardMetrics.inProgressSchedules)}
            subtitle="Agendamentos em execução"
            icon="pulse-outline"
            color="#DC2626"
            backgroundColor="#FEF2F2"
          />
          <ExecutiveMetricCard
            title="Mapa operacional"
            value={String(dashboardMetrics.activeRoutes)}
            subtitle="Rotas para acompanhamento visual"
            icon="map-outline"
            color="#0F766E"
            backgroundColor="#ECFEFF"
          />
        </View>

        <SectionHeader
          title="Próximos agendamentos"
          subtitle="Acompanhe as próximas demandas da operação."
          actionLabel="VER AGENDAMENTOS"
          onPress={() => router.push("/(cooperativa)/schedule")}
        />

        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 20,
            padding: 16,
            borderWidth: 1,
            borderColor: "#E5E7EB",
            marginBottom: 22,
          }}
        >
          {dashboardMetrics.nextSchedules.length > 0 ? (
            dashboardMetrics.nextSchedules.map((item) => (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.88}
                onPress={() =>
                  router.push({
                    pathname: "/(cooperativa)/schedule/[id]",
                    params: { id: item.id },
                  })
                }
                style={{
                  backgroundColor: "#F8FAFC",
                  borderRadius: 16,
                  padding: 14,
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
                        fontSize: 16,
                        fontWeight: "900",
                        color: "#0F172A",
                      }}
                    >
                      {getScheduleName(item)}
                    </Text>

                    <Text
                      style={{
                        fontSize: 13,
                        color: "#64748B",
                        marginTop: 8,
                      }}
                    >
                      Data:{" "}
                      {formatDateTime(
                        item.scheduledDate || item.preferredDate || item.createdAt
                      )}
                    </Text>

                    <Text
                      style={{
                        fontSize: 13,
                        color: "#64748B",
                        marginTop: 6,
                      }}
                    >
                      Endereço: {item.generator?.address || "Não informado"}
                    </Text>
                  </View>

                  <Badge
                    label={getScheduleStatusLabel(item.status)}
                    color={getScheduleStatusColor(item.status)}
                  />
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <EmptyState
              icon="calendar-outline"
              title="Nenhum agendamento em destaque"
              subtitle="As próximas solicitações e programações aparecerão aqui."
            />
          )}
        </View>

        <SectionHeader
          title="Rotas recentes"
          subtitle="Acompanhe as últimas rotas registradas."
          actionLabel="VER ROTAS"
          onPress={() => router.push("/(cooperativa)/rotas")}
        />

        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 20,
            padding: 16,
            borderWidth: 1,
            borderColor: "#E5E7EB",
            marginBottom: 22,
          }}
        >
          {dashboardMetrics.recentRoutes.length > 0 ? (
            dashboardMetrics.recentRoutes.map((item) => (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.88}
                onPress={() =>
                  router.push(`/(cooperativa)/rotas/${item.id}` as any)
                }
                style={{
                  backgroundColor: "#F8FAFC",
                  borderRadius: 16,
                  padding: 14,
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
                        fontSize: 16,
                        fontWeight: "900",
                        color: "#0F172A",
                      }}
                    >
                      {item.name}
                    </Text>

                    <Text
                      style={{
                        fontSize: 13,
                        color: "#64748B",
                        marginTop: 8,
                      }}
                    >
                      Data: {formatDate(item.scheduledDate || item.createdAt)}
                    </Text>

                    <Text
                      style={{
                        fontSize: 13,
                        color: "#64748B",
                        marginTop: 6,
                      }}
                    >
                      Motorista: {item.driver?.name || "Não informado"}
                    </Text>

                    <Text
                      style={{
                        fontSize: 13,
                        color: "#64748B",
                        marginTop: 6,
                      }}
                    >
                      Veículo: {getRouteVehicleLabel(item)}
                    </Text>

                    <Text
                      style={{
                        fontSize: 13,
                        color: "#64748B",
                        marginTop: 6,
                      }}
                    >
                      Coletas: {item.stats?.totalCollections ?? 0}
                    </Text>
                  </View>

                  <Badge
                    label={getRouteStatusLabel(item.status)}
                    color={getRouteStatusColor(item.status)}
                  />
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <EmptyState
              icon="git-network-outline"
              title="Nenhuma rota registrada"
              subtitle="As rotas operacionais aparecerão aqui para acompanhamento."
            />
          )}
        </View>

        <SectionHeader
          title="Coletas recentes"
          subtitle="Últimas movimentações registradas no sistema."
          actionLabel="VER MAPA"
          onPress={() => router.push("/(cooperativa)/mapas")}
        />

        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 20,
            padding: 16,
            borderWidth: 1,
            borderColor: "#E5E7EB",
            marginBottom: 22,
          }}
        >
          {dashboardMetrics.recentCollections.length > 0 ? (
            dashboardMetrics.recentCollections.map((item) => (
              <View
                key={item.id}
                style={{
                  backgroundColor: "#F8FAFC",
                  borderRadius: 16,
                  padding: 14,
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
                        fontSize: 16,
                        fontWeight: "900",
                        color: "#0F172A",
                      }}
                    >
                      {getCollectionName(item)}
                    </Text>

                    <Text
                      style={{
                        fontSize: 13,
                        color: "#64748B",
                        marginTop: 8,
                      }}
                    >
                      Endereço: {getCollectionAddress(item)}
                    </Text>

                    <Text
                      style={{
                        fontSize: 13,
                        color: "#64748B",
                        marginTop: 6,
                      }}
                    >
                      Peso: {formatWeight(item.totalWeightKg)}
                    </Text>

                    <Text
                      style={{
                        fontSize: 13,
                        color: "#64748B",
                        marginTop: 6,
                      }}
                    >
                      Data: {formatDateTime(item.collectedAt || item.createdAt)}
                    </Text>

                    <Text
                      style={{
                        fontSize: 13,
                        color: "#64748B",
                        marginTop: 6,
                      }}
                    >
                      Catador: {item.collector?.name || item.collector?.displayName || "Não informado"}
                    </Text>
                  </View>

                  <Badge
                    label={getCollectionStatusLabel(item.status)}
                    color={getCollectionStatusColor(item.status)}
                  />
                </View>
              </View>
            ))
          ) : (
            <EmptyState
              icon="cube-outline"
              title="Nenhuma coleta recente"
              subtitle="As coletas registradas aparecerão aqui para leitura rápida."
            />
          )}
        </View>

        <SectionHeader
          title="Atalhos executivos"
          subtitle="Acesse rapidamente os módulos estratégicos."
        />

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            flexWrap: "wrap",
            marginBottom: 6,
          }}
        >
          <QuickActionCard
            title="Agendamentos"
            subtitle="Fila de solicitações"
            icon="calendar-outline"
            color="#DC2626"
            backgroundColor="#FEF2F2"
            borderColor="#F6C7C7"
            onPress={() => router.push("/(cooperativa)/schedule")}
          />
          <QuickActionCard
            title="Rotas"
            subtitle="Operação logística"
            icon="git-network-outline"
            color="#7C3AED"
            backgroundColor="#F5F3FF"
            borderColor="#DDD6FE"
            onPress={() => router.push("/(cooperativa)/rotas")}
          />
          <QuickActionCard
            title="Mapas"
            subtitle="Visão geográfica"
            icon="map-outline"
            color="#0F766E"
            backgroundColor="#ECFEFF"
            borderColor="#BDEFF3"
            onPress={() => router.push("/(cooperativa)/mapas")}
          />
          <QuickActionCard
            title="Home"
            subtitle="Painel operacional"
            icon="home-outline"
            color="#028C56"
            backgroundColor="#EAF8F3"
            borderColor="#BDE8D7"
            onPress={() => router.push("/(cooperativa)/home")}
          />
        </View>
      </View>
    </ScrollView>
  );
}

function QuickActionCard({
  title,
  subtitle,
  icon,
  color,
  backgroundColor,
  borderColor,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  backgroundColor: string;
  borderColor: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      style={{
        width: "48.5%",
        backgroundColor,
        borderRadius: 22,
        borderWidth: 1,
        borderColor,
        paddingVertical: 16,
        paddingHorizontal: 14,
        marginBottom: 14,
        minHeight: 138,
        justifyContent: "space-between",
      }}
    >
      <View
        style={{
          width: 54,
          height: 54,
          borderRadius: 27,
          backgroundColor: "rgba(255,255,255,0.55)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={26} color={color} />
      </View>

      <View>
        <Text
          style={{
            color,
            fontSize: 14,
            fontWeight: "900",
          }}
        >
          {title}
        </Text>

        <Text
          style={{
            color: "#475569",
            fontSize: 12,
            marginTop: 6,
            lineHeight: 17,
          }}
        >
          {subtitle}
        </Text>
      </View>
    </TouchableOpacity>
  );
}