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
import { useNotification } from "@/src/contexts/NotificationContext";

import { useAuth } from "@/src/contexts/AuthContext";
import {
  scheduleService,
  type Schedule,
} from "@/src/services/scheduleService";
import {
  collectionService,
  type Collection,
  type CollectionMaterial,
} from "@/src/services/collectionService";

type AuthUserLike = {
  name?: string;
  displayName?: string;
  generator?: {
    name?: string | null;
    companyName?: string | null;
  } | null;
};

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

function translateScheduleStatus(status: Schedule["status"]) {
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
      return status;
  }
}

function translateCollectionStatus(status: Collection["status"]) {
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
      return status;
  }
}

function extractMaterials(notes?: string | null) {
  if (!notes) return [];

  const match = notes.match(/materiais solicitados:\s*(.*)/i);
  const raw = match ? match[1] : "";

  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatCollectionMaterials(materials?: CollectionMaterial[]) {
  if (!Array.isArray(materials) || materials.length === 0) return "-";

  return materials
    .map((item) => `${item.type}: ${Number(item.quantityKg || 0).toFixed(1)} kg`)
    .join(", ");
}

function getScheduleBadgeColor(status: Schedule["status"]) {
  switch (status) {
    case "REQUESTED":
      return "#64748B";
    case "SCHEDULED":
      return "#2563EB";
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

export default function GeneratorDashboardScreen() {
  const { user, signOut } = useAuth();
  const currentUser = user as AuthUserLike | null;
  const { notifyError } = useNotification();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);

  const displayName =
    currentUser?.generator?.companyName ||
    currentUser?.generator?.name ||
    currentUser?.displayName ||
    currentUser?.name ||
    "Gerador";

  const loadDashboard = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) setLoading(true);

        if (!scheduleService || typeof scheduleService.list !== "function") {
          throw new Error("Serviço de agendamentos não carregado.");
        }

        if (!collectionService || typeof collectionService.list !== "function") {
          throw new Error("Serviço de coletas não carregado.");
        }

        const [scheduleResponse, collectionResponse] = await Promise.all([
          scheduleService.list(),
          collectionService.list(),
        ]);

        setSchedules(Array.isArray(scheduleResponse) ? scheduleResponse : []);
        setCollections(
          Array.isArray(collectionResponse) ? collectionResponse : []
        );
      } catch (error) {
        console.error("Erro ao carregar dashboard do gerador:", error);
        notifyError(
          "Erro",
          error instanceof Error
            ? error.message
            : "Não foi possível carregar o dashboard do gerador."
        );
        setSchedules([]);
        setCollections([]);
      } finally {
        if (showLoader) setLoading(false);
        setRefreshing(false);
      }
    },
    [notifyError]
  );

  useFocusEffect(
    useCallback(() => {
      loadDashboard(true);
    }, [loadDashboard])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDashboard(false);
  }, [loadDashboard]);

  const handleSignOut = useCallback(async () => {
    await signOut();
  }, [signOut]);

  const metrics = useMemo(() => {
    const openSchedules = schedules.filter(
      (item) => item.status === "REQUESTED" || item.status === "SCHEDULED"
    );

    const completedCollections = collections.filter(
      (item) => item.status === "COMPLETED"
    );

    const totalKg = completedCollections.reduce(
      (sum, item) => sum + Number(item.totalWeightKg || 0),
      0
    );

    const nextSchedules = [...openSchedules]
      .sort((a, b) => {
        const aTime = new Date(a.scheduledDate || a.preferredDate || 0).getTime();
        const bTime = new Date(b.scheduledDate || b.preferredDate || 0).getTime();
        return aTime - bTime;
      })
      .slice(0, 4);

    const recentCollections = [...collections]
      .sort((a, b) => {
        const aTime = new Date(a.createdAt || 0).getTime();
        const bTime = new Date(b.createdAt || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 4);

    return {
      totalKg,
      totalSchedules: schedules.length,
      openSchedules: openSchedules.length,
      completedCollections: completedCollections.length,
      nextSchedules,
      recentCollections,
    };
  }, [schedules, collections]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#F8FAFC",
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
      contentContainerStyle={{ paddingBottom: 28 }}
    >
      <LinearGradient
        colors={["#16a34a", "#22c55e"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          paddingTop: 28,
          paddingBottom: 26,
          paddingHorizontal: 20,
          borderBottomLeftRadius: 30,
          borderBottomRightRadius: 30,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#E8FFF1", fontSize: 14 }}>
            Dashboard do Gerador
          </Text>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleSignOut}
            style={{
              backgroundColor: "rgba(255,255,255,0.18)",
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 8,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
            <Text
              style={{
                color: "#FFFFFF",
                fontWeight: "800",
                marginLeft: 6,
                fontSize: 13,
              }}
            >
              Sair
            </Text>
          </TouchableOpacity>
        </View>

        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 30,
            fontWeight: "800",
            marginTop: 6,
          }}
        >
          Olá, {displayName}
        </Text>

        <Text
          style={{
            color: "#E8FFF1",
            fontSize: 15,
            marginTop: 8,
            lineHeight: 22,
          }}
        >
          Acompanhe agendamentos, coletas concluídas e o impacto gerado pela sua operação.
        </Text>

        <View style={{ flexDirection: "row", marginTop: 18 }}>
          <ActionButton
            icon="calendar-outline"
            label="Novo agendamento"
            onPress={() => router.push("/(gerador)/schedule")}
            style={{ marginRight: 10, flex: 1 }}
          />

          <ActionButton
            icon="refresh-outline"
            label="Atualizar"
            onPress={onRefresh}
            style={{ flex: 1 }}
          />
        </View>
      </LinearGradient>

      <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <MetricCard
            title="Total coletado"
            value={`${metrics.totalKg.toFixed(1)} kg`}
            icon="leaf-outline"
          />
          <MetricCard
            title="Coletas concluídas"
            value={String(metrics.completedCollections)}
            icon="checkmark-done-outline"
          />
        </View>

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginTop: 12,
          }}
        >
          <MetricCard
            title="Agendamentos"
            value={String(metrics.totalSchedules)}
            icon="calendar-outline"
          />
          <MetricCard
            title="Em aberto"
            value={String(metrics.openSchedules)}
            icon="time-outline"
          />
        </View>

        <SectionHeader
          title="Próximos agendamentos"
          actionLabel="Ver agenda"
          onPress={() => router.push("/(gerador)/schedule")}
        />

        <View style={sectionCard}>
          {metrics.nextSchedules.length > 0 ? (
            metrics.nextSchedules.map((item) => {
              const materials = extractMaterials(item.notes);

              return (
                <View key={item.id} style={listItemCard}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={itemTitle}>
                        {formatDateTime(item.scheduledDate || item.preferredDate)}
                      </Text>

                      <Text style={itemText}>
                        Status: {translateScheduleStatus(item.status)}
                      </Text>

                      {materials.length > 0 && (
                        <Text style={itemText}>
                          Materiais: {materials.join(", ")}
                        </Text>
                      )}

                      {!!item.notes && (
                        <Text style={itemSubtext}>
                          Observações: {item.notes}
                        </Text>
                      )}
                    </View>

                    <Badge
                      label={translateScheduleStatus(item.status)}
                      color={getScheduleBadgeColor(item.status)}
                    />
                  </View>
                </View>
              );
            })
          ) : (
            <EmptyState
              icon="calendar-clear-outline"
              title="Nenhum agendamento próximo"
              subtitle="Quando você solicitar uma nova coleta, ela aparecerá aqui."
            />
          )}
        </View>

        <SectionHeader
          title="Coletas recentes"
          actionLabel="Ver impacto"
          onPress={() => router.push("/(gerador)/percentual")}
        />

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
                    <Text style={itemTitle}>
                      {item.schedule?.scheduledDate
                        ? formatDateTime(item.schedule.scheduledDate)
                        : formatDate(item.createdAt)}
                    </Text>

                    <Text style={itemText}>
                      Status: {translateCollectionStatus(item.status)}
                    </Text>

                    <Text style={itemText}>
                      Total coletado:{" "}
                      {Number(item.totalWeightKg || 0).toFixed(1)} kg
                    </Text>

                    {(item.materials || []).length > 0 && (
                      <Text style={itemSubtext}>
                        Materiais: {formatCollectionMaterials(item.materials)}
                      </Text>
                    )}
                  </View>

                  <Badge
                    label={translateCollectionStatus(item.status)}
                    color={getCollectionBadgeColor(item.status)}
                  />
                </View>
              </View>
            ))
          ) : (
            <EmptyState
              icon="cube-outline"
              title="Nenhuma coleta registrada"
              subtitle="As coletas concluídas aparecerão aqui assim que forem executadas."
            />
          )}
        </View>

        <SectionHeader title="Ações rápidas" />

        <View style={sectionCard}>
          <QuickAction
            icon="calendar-outline"
            title="Solicitar coleta"
            subtitle="Criar um novo agendamento"
            onPress={() => router.push("/(gerador)/schedule")}
          />
          <QuickAction
            icon="pie-chart-outline"
            title="Impacto ambiental"
            subtitle="Acompanhar o percentual da coleta"
            onPress={() => router.push("/(gerador)/percentual")}
          />
          <QuickAction
            icon="chatbubble-outline"
            title="Enviar feedback"
            subtitle="Compartilhar sua experiência"
            onPress={() => router.push("/(gerador)/feedback")}
          />
          <QuickAction
            icon="person-outline"
            title="Meu perfil"
            subtitle="Ver e editar dados da conta"
            onPress={() => router.push("/(gerador)/profile")}
          />
          <QuickAction
            icon="log-out-outline"
            title="Sair"
            subtitle="Encerrar sessão neste dispositivo"
            onPress={handleSignOut}
            isLast
          />
        </View>
      </View>
    </ScrollView>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  style?: object;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[
        {
          backgroundColor: "rgba(255,255,255,0.18)",
          borderRadius: 16,
          paddingVertical: 14,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Ionicons name={icon} size={18} color="#FFFFFF" />
      <Text
        style={{
          color: "#FFFFFF",
          fontWeight: "700",
          fontSize: 15,
          marginLeft: 8,
        }}
      >
        {label}
      </Text>
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

function SectionHeader({
  title,
  actionLabel,
  onPress,
}: {
  title: string;
  actionLabel?: string;
  onPress?: () => void;
}) {
  return (
    <View
      style={{
        marginTop: 18,
        marginBottom: 10,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: "800", color: "#111827" }}>
        {title}
      </Text>

      {actionLabel && onPress ? (
        <TouchableOpacity onPress={onPress}>
          <Text style={{ color: "#028C56", fontWeight: "700" }}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      ) : null}
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

function QuickAction({
  icon,
  title,
  subtitle,
  onPress,
  isLast = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingBottom: isLast ? 0 : 14,
        marginBottom: isLast ? 0 : 14,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: "#E5E7EB",
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
          marginRight: 12,
        }}
      >
        <Ionicons name={icon} size={20} color="#15803D" />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: "#111827" }}>
          {title}
        </Text>
        <Text style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>
          {subtitle}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
    </TouchableOpacity>
  );
}

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