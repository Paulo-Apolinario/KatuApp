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
import { LinearGradient } from "expo-linear-gradient";

import {
  scheduleService,
  type Schedule,
} from "@/src/services/scheduleService";
import {
  collectionService,
  type Collection,
  type CollectionMaterial,
} from "@/src/services/collectionService";
import {
  collectorService,
  type Collector,
} from "@/src/services/collectorService";
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

function formatDate(dateString?: string | null) {
  if (!dateString) return "-";

  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return "-";

  return parsed.toLocaleDateString("pt-BR");
}

function translateScheduleStatus(status?: string | null) {
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
      return status || "Sem status";
  }
}

function translateCollectionStatus(status?: string | null) {
  switch (status) {
    case "PENDING":
      return "Pendente";
    case "IN_PROGRESS":
      return "Em andamento";
    case "COMPLETED":
      return "Concluído";
    case "CANCELLED":
      return "Cancelado";
    default:
      return status || "Sem status";
  }
}

function getRouteStatusLabel(status?: string | null) {
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
      return status || "Sem status";
  }
}

function getRouteStatusColor(status?: string | null) {
  switch (status) {
    case "SCHEDULED":
      return "#2563EB";
    case "IN_PROGRESS":
      return "#F59E0B";
    case "COMPLETED":
      return "#10B981";
    case "CANCELLED":
      return "#DC2626";
    default:
      return "#6B7280";
  }
}

function getCollectionStatusColor(status?: string | null) {
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
      return "#6B7280";
  }
}

function formatMaterials(materials?: CollectionMaterial[] | null) {
  if (!Array.isArray(materials) || materials.length === 0) return "-";

  return materials
    .map((item) => `${item.type}: ${Number(item.quantityKg || 0).toFixed(1)} kg`)
    .join(" • ");
}

function getScheduleName(item: Schedule) {
  if (item.generator?.companyName) return item.generator.companyName;
  if (item.generator?.name) return item.generator.name;
  if (item.requestedBy?.displayName) return item.requestedBy.displayName;
  if (item.requestedBy?.email) return item.requestedBy.email;
  return "Solicitação sem identificação";
}

function getCollectionOriginName(item: Collection) {
  if (item.generator?.companyName) return item.generator.companyName;
  if (item.generator?.name) return item.generator.name;
  if (item.schedule?.requestedBy?.displayName) {
    return item.schedule.requestedBy.displayName;
  }
  if (item.schedule?.requestedBy?.email) {
    return item.schedule.requestedBy.email;
  }
  return "Origem não identificada";
}

function getCollectionAddress(item: Collection) {
  if (item.generator?.address) return item.generator.address;
  return "-";
}

export default function CooperativeDashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  const loadDashboard = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);

      const [
        scheduleResponse,
        collectionResponse,
        collectorResponse,
        routeResponse,
        driverResponse,
        vehicleResponse,
      ] = await Promise.all([
        scheduleService.list(),
        collectionService.list(),
        collectorService.list(),
        routeService.list(),
        driverService.list(),
        vehicleService.list(),
      ]);

      setSchedules(Array.isArray(scheduleResponse) ? scheduleResponse : []);
      setCollections(Array.isArray(collectionResponse) ? collectionResponse : []);
      setCollectors(Array.isArray(collectorResponse) ? collectorResponse : []);
      setRoutes(Array.isArray(routeResponse) ? routeResponse : []);
      setDrivers(Array.isArray(driverResponse) ? driverResponse : []);
      setVehicles(Array.isArray(vehicleResponse) ? vehicleResponse : []);
    } catch (error) {
      console.error("Erro ao carregar dashboard da cooperativa:", error);
      setSchedules([]);
      setCollections([]);
      setCollectors([]);
      setRoutes([]);
      setDrivers([]);
      setVehicles([]);
    } finally {
      if (showLoader) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDashboard(true);
    }, [loadDashboard])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDashboard(false);
  }, [loadDashboard]);

  const metrics = useMemo(() => {
    const requestedSchedules = schedules.filter((item) => item.status === "REQUESTED");
    const scheduledSchedules = schedules.filter((item) => item.status === "SCHEDULED");
    const inProgressSchedules = schedules.filter((item) => item.status === "IN_PROGRESS");

    const activeRoutes = routes.filter(
      (item) => item.status === "SCHEDULED" || item.status === "IN_PROGRESS"
    );

    const inProgressCollections = collections.filter(
      (item) => item.status === "IN_PROGRESS"
    );

    const completedCollections = collections.filter(
      (item) => item.status === "COMPLETED"
    );

    const completedToday = completedCollections.filter((item) => {
      if (!item.collectedAt && !item.createdAt) return false;

      const sourceDate = new Date(item.collectedAt || item.createdAt || 0);
      const now = new Date();

      return (
        sourceDate.getDate() === now.getDate() &&
        sourceDate.getMonth() === now.getMonth() &&
        sourceDate.getFullYear() === now.getFullYear()
      );
    });

    const totalCollectedKg = completedCollections.reduce(
      (acc, item) => acc + Number(item.totalWeightKg || 0),
      0
    );

    const collectorsAvailable = collectors.filter(
      (item) => item.status === "AVAILABLE"
    ).length;

    const collectorsOnRoute = collectors.filter(
      (item) => item.status === "ON_ROUTE"
    ).length;

    const collectorsInactive = collectors.filter(
      (item) => item.status === "INACTIVE"
    ).length;

    const driversAvailable = drivers.filter(
      (item) => item.status === "AVAILABLE"
    ).length;

    const vehiclesActive = vehicles.filter(
      (item) => item.status === "ACTIVE"
    ).length;

    const nextSchedules = [...schedules]
      .filter((item) => item.status === "REQUESTED" || item.status === "SCHEDULED")
      .sort((a, b) => {
        const aTime = new Date(a.scheduledDate || a.preferredDate || 0).getTime();
        const bTime = new Date(b.scheduledDate || b.preferredDate || 0).getTime();
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
      collectorsAvailable,
      collectorsOnRoute,
      collectorsInactive,
      driversAvailable,
      vehiclesActive,
      nextSchedules,
      recentCollections,
      recentRoutes,
    };
  }, [schedules, collections, collectors, routes, drivers, vehicles]);

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
            <Text style={{ color: "#E8FFF1", fontSize: 14 }}>
              KATUÁ • Cooperativa
            </Text>
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 30,
                fontWeight: "800",
                marginTop: 4,
              }}
            >
              Centro operacional
            </Text>
          </View>

          <TouchableOpacity
            onPress={onRefresh}
            activeOpacity={0.85}
            style={{
              width: 46,
              height: 46,
              borderRadius: 23,
              backgroundColor: "rgba(255,255,255,0.18)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="refresh-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <Text
          style={{
            color: "#E8FFF1",
            fontSize: 15,
            marginTop: 10,
            lineHeight: 22,
          }}
        >
          Visão moderna da operação com acesso rápido para gestão, logística e histórico.
        </Text>

        <View
          style={{
            marginTop: 18,
            backgroundColor: "rgba(255,255,255,0.14)",
            borderRadius: 20,
            padding: 16,
          }}
        >
          <Text style={{ color: "#E8FFF1", fontSize: 13 }}>Volume coletado</Text>
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 28,
              fontWeight: "800",
              marginTop: 6,
            }}
          >
            {metrics.totalCollectedKg.toFixed(1)} kg
          </Text>
          <Text style={{ color: "#E8FFF1", fontSize: 13, marginTop: 6 }}>
            {metrics.completedToday} coletas concluídas hoje • {metrics.inProgressCollections} em andamento
          </Text>
        </View>
      </LinearGradient>

      <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
        <SectionHeader title="Atalhos inteligentes" />

        <View style={gridRow}>
          <GridShortcutCard
            icon="calendar-outline"
            title="Agendamentos"
            subtitle="Solicitações e delegação"
            onPress={() => router.push("/(cooperativa)/schedule")}
          />
          <GridShortcutCard
            icon="time-outline"
            title="Histórico"
            subtitle="Coletas concluídas"
            onPress={() => router.push("/(cooperativa)/history")}
          />
        </View>

        <View style={gridRow}>
          <GridShortcutCard
            icon="trail-sign-outline"
            title="Rotas"
            subtitle="Planejamento logístico"
            onPress={() => router.push("/(cooperativa)/rotas")}
          />
          <GridShortcutCard
            icon="car-outline"
            title="Veículos"
            subtitle="Frota disponível"
            onPress={() => router.push("/(cooperativa)/veiculos")}
          />
        </View>

        <View style={gridRow}>
          <GridShortcutCard
            icon="person-outline"
            title="Motoristas"
            subtitle="Equipe de condução"
            onPress={() => router.push("/(cooperativa)/motoristas")}
          />
          <GridShortcutCard
            icon="people-outline"
            title="Catadores"
            subtitle="Equipe operacional"
            onPress={() => router.push("/(cooperativa)/catadores")}
          />
        </View>

        <SectionHeader title="Indicadores principais" />

        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <MetricCard
            title="Solicitações abertas"
            value={String(metrics.requestedSchedules)}
            icon="mail-unread-outline"
          />
          <MetricCard
            title="Agendadas"
            value={String(metrics.scheduledSchedules)}
            icon="calendar-outline"
          />
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 12 }}>
          <MetricCard
            title="Em execução"
            value={String(metrics.inProgressCollections)}
            icon="cube-outline"
          />
          <MetricCard
            title="Rotas ativas"
            value={String(metrics.activeRoutes)}
            icon="map-outline"
          />
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 12 }}>
          <MetricCard
            title="Motoristas livres"
            value={String(metrics.driversAvailable)}
            icon="person-outline"
          />
          <MetricCard
            title="Veículos ativos"
            value={String(metrics.vehiclesActive)}
            icon="car-sport-outline"
          />
        </View>

        <SectionHeader title="Equipe e disponibilidade" />

        <View style={sectionCard}>
          <StatusRow
            label="Catadores disponíveis"
            value={String(metrics.collectorsAvailable)}
            color="#10B981"
          />
          <StatusRow
            label="Catadores em rota"
            value={String(metrics.collectorsOnRoute)}
            color="#F59E0B"
          />
          <StatusRow
            label="Catadores inativos"
            value={String(metrics.collectorsInactive)}
            color="#6B7280"
          />
          <StatusRow
            label="Solicitações em progresso"
            value={String(metrics.inProgressSchedules)}
            color="#2563EB"
            isLast
          />
        </View>

        <SectionHeader title="Próximos agendamentos" />

        <View style={sectionCard}>
          {metrics.nextSchedules.length > 0 ? (
            metrics.nextSchedules.map((item) => (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.85}
                onPress={() => router.push(`/(cooperativa)/schedule/${item.id}` as any)}
                style={listItemCard}
              >
                <Text style={itemTitle}>{getScheduleName(item)}</Text>
                <Text style={itemText}>
                  Data: {formatDateTime(item.scheduledDate || item.preferredDate)}
                </Text>
                <Text style={itemText}>
                  Status: {translateScheduleStatus(item.status)}
                </Text>
                {!!item.notes && (
                  <Text style={itemSubtext}>Observações: {item.notes}</Text>
                )}
              </TouchableOpacity>
            ))
          ) : (
            <EmptyState
              icon="calendar-clear-outline"
              title="Nenhum agendamento pendente"
              subtitle="As novas solicitações aparecerão aqui."
            />
          )}
        </View>

        <SectionHeader title="Rotas recentes" />

        <View style={sectionCard}>
          {metrics.recentRoutes.length > 0 ? (
            metrics.recentRoutes.map((item) => (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.85}
                onPress={() => router.push(`/(cooperativa)/rotas/${item.id}` as any)}
                style={listItemCard}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={itemTitle}>{item.name}</Text>
                    <Text style={itemText}>
                      Data: {formatDate(item.scheduledDate || item.createdAt)}
                    </Text>
                    <Text style={itemText}>
                      Motorista: {item.driver?.name || "Não informado"}
                    </Text>
                    <Text style={itemSubtext}>
                      Veículo:{" "}
                      {item.vehicle?.model
                        ? `${item.vehicle.model}${item.vehicle.plate ? ` - ${item.vehicle.plate}` : ""}`
                        : "Não informado"}
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
              icon="map-outline"
              title="Nenhuma rota encontrada"
              subtitle="As rotas recentes aparecerão aqui."
            />
          )}
        </View>

        <SectionHeader title="Coletas recentes" />

        <View style={sectionCard}>
          {metrics.recentCollections.length > 0 ? (
            metrics.recentCollections.map((item) => (
              <View key={item.id} style={listItemCard}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={itemTitle}>{getCollectionOriginName(item)}</Text>
                    <Text style={itemText}>
                      Peso: {Number(item.totalWeightKg || 0).toFixed(1)} kg
                    </Text>
                    <Text style={itemText}>
                      Endereço: {getCollectionAddress(item)}
                    </Text>
                    <Text style={itemSubtext}>
                      Materiais: {formatMaterials(item.materials)}
                    </Text>
                    <Text style={itemSubtext}>
                      Data: {formatDateTime(item.collectedAt || item.createdAt)}
                    </Text>
                  </View>

                  <Badge
                    label={translateCollectionStatus(item.status)}
                    color={getCollectionStatusColor(item.status)}
                  />
                </View>
              </View>
            ))
          ) : (
            <EmptyState
              icon="cube-outline"
              title="Nenhuma coleta recente"
              subtitle="As execuções registradas aparecerão aqui."
            />
          )}
        </View>
      </View>
    </ScrollView>
  );
}

function GridShortcutCard({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={{
        width: "48.5%",
        backgroundColor: "#FFFFFF",
        borderRadius: 22,
        padding: 16,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        minHeight: 132,
        justifyContent: "space-between",
      }}
    >
      <View
        style={{
          width: 50,
          height: 50,
          borderRadius: 25,
          backgroundColor: "#ECFDF5",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={24} color="#028C56" />
      </View>

      <View>
        <Text
          style={{
            fontSize: 16,
            fontWeight: "800",
            color: "#111827",
            marginTop: 14,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontSize: 13,
            color: "#6B7280",
            marginTop: 4,
            lineHeight: 18,
          }}
        >
          {subtitle}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function MetricCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
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
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: "#DCFCE7",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 10,
        }}
      >
        <Ionicons name={icon} size={20} color="#15803D" />
      </View>

      <Text style={{ fontSize: 13, color: "#6B7280" }}>{title}</Text>
      <Text
        style={{
          marginTop: 4,
          fontSize: 22,
          fontWeight: "800",
          color: "#111827",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={{ marginTop: 18, marginBottom: 10 }}>
      <Text style={{ fontSize: 18, fontWeight: "800", color: "#111827" }}>
        {title}
      </Text>
    </View>
  );
}

function StatusRow({
  label,
  value,
  color,
  isLast = false,
}: {
  label: string;
  value: string;
  color: string;
  isLast?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingBottom: isLast ? 0 : 12,
        marginBottom: isLast ? 0 : 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: "#E5E7EB",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View
          style={{
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: color,
            marginRight: 10,
          }}
        />
        <Text style={{ fontSize: 15, color: "#374151", fontWeight: "600" }}>
          {label}
        </Text>
      </View>

      <Text style={{ fontSize: 16, fontWeight: "800", color: "#111827" }}>
        {value}
      </Text>
    </View>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View
      style={{
        backgroundColor: color,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 14,
      }}
    >
      <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "700" }}>
        {label}
      </Text>
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
    <View style={{ alignItems: "center", paddingVertical: 28 }}>
      <Ionicons name={icon} size={42} color="#9CA3AF" />
      <Text
        style={{
          fontSize: 16,
          fontWeight: "700",
          color: "#374151",
          marginTop: 10,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: "#6B7280",
          textAlign: "center",
          marginTop: 6,
          lineHeight: 20,
        }}
      >
        {subtitle}
      </Text>
    </View>
  );
}

const gridRow = {
  flexDirection: "row",
  justifyContent: "space-between",
  marginBottom: 12,
} as const;

const sectionCard = {
  backgroundColor: "#FFFFFF",
  borderRadius: 18,
  padding: 16,
  borderWidth: 1,
  borderColor: "#E5E7EB",
} as const;

const listItemCard = {
  backgroundColor: "#F9FAFB",
  borderRadius: 14,
  padding: 14,
  marginBottom: 10,
  borderWidth: 1,
  borderColor: "#E5E7EB",
} as const;

const itemTitle = {
  fontSize: 15,
  fontWeight: "700" as const,
  color: "#111827",
} as const;

const itemText = {
  marginTop: 5,
  fontSize: 14,
  color: "#4B5563",
} as const;

const itemSubtext = {
  marginTop: 6,
  fontSize: 13,
  color: "#6B7280",
} as const;