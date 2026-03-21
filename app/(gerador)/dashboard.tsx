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
  collectionService,
  type Collection,
} from "@/src/services/collectionService";
import {
  scheduleService,
  type Schedule,
} from "@/src/services/scheduleService";

function formatDate(dateString?: string | null): string {
  if (!dateString) return "Data não informada";

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return "Data inválida";

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(dateString?: string | null): string {
  if (!dateString) return "Data não informada";

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return "Data inválida";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function translateScheduleStatus(status: Schedule["status"]): string {
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

function translateCollectionStatus(status: Collection["status"]): string {
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

function extractMaterials(notes?: string | null): string[] {
  if (!notes) return [];

  const match = notes.match(/materiais solicitados:\s*(.*)/i);
  const raw = match ? match[1] : notes;

  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getScheduleStatusBadgeColor(status: Schedule["status"]) {
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

function getCollectionStatusBadgeColor(status: Collection["status"]) {
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

export default function GeneratorDashboard() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadDashboard = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setIsLoading(true);
      setErrorMessage(null);

      const [schedulesResponse, collectionsResponse] = await Promise.all([
        scheduleService.list(),
        collectionService.list(),
      ]);

      setSchedules(Array.isArray(schedulesResponse) ? schedulesResponse : []);
      setCollections(Array.isArray(collectionsResponse) ? collectionsResponse : []);
    } catch (error) {
      console.error("Erro ao carregar dashboard do gerador:", error);
      setErrorMessage("Não foi possível carregar os dados do dashboard.");
    } finally {
      if (showLoader) setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDashboard(true);
    }, [loadDashboard])
  );

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadDashboard(false);
  }, [loadDashboard]);

  const metrics = useMemo(() => {
    const completedCollections = collections.filter(
      (item) => item.status === "COMPLETED"
    );

    const totalKg = completedCollections.reduce(
      (sum, item) => sum + Number(item.totalWeightKg || 0),
      0
    );

    const totalCollectionsCompleted = completedCollections.length;

    const openSchedules = schedules.filter(
      (item) => item.status === "REQUESTED" || item.status === "SCHEDULED"
    ).length;

    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).getTime();

    const nextSchedules = [...schedules]
      .filter((item) => {
        if (item.status === "COMPLETED" || item.status === "CANCELLED") {
          return false;
        }

        const dateValue = item.scheduledDate || item.preferredDate;
        if (!dateValue) return false;

        const timestamp = new Date(dateValue).getTime();
        return !Number.isNaN(timestamp) && timestamp >= startOfToday;
      })
      .sort((a, b) => {
        const aTime = new Date(a.scheduledDate || a.preferredDate || 0).getTime();
        const bTime = new Date(b.scheduledDate || b.preferredDate || 0).getTime();
        return aTime - bTime;
      })
      .slice(0, 5);

    const recentCollections = [...collections]
      .sort((a, b) => {
        const aDate = new Date(a.createdAt || 0).getTime();
        const bDate = new Date(b.createdAt || 0).getTime();
        return bDate - aDate;
      })
      .slice(0, 5);

    return {
      totalKg,
      totalCollectionsCompleted,
      openSchedules,
      nextSchedules,
      recentCollections,
    };
  }, [collections, schedules]);

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#FFFFFF",
          paddingHorizontal: 24,
        }}
      >
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={{ marginTop: 16, fontSize: 16, color: "#4B5563" }}>
          Carregando dashboard...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#F8FAFC" }}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
      }
      contentContainerStyle={{ paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={["#16a34a", "#22c55e"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          paddingTop: 28,
          paddingBottom: 24,
          paddingHorizontal: 20,
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
        }}
      >
        <Text style={{ color: "#FFFFFF", fontSize: 14, opacity: 0.9 }}>
          Dashboard do Gerador
        </Text>

        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 28,
            fontWeight: "700",
            marginTop: 4,
          }}
        >
          Acompanhe suas solicitações
        </Text>

        <View
          style={{
            flexDirection: "row",
            marginTop: 18,
            gap: 12,
          }}
        >
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push("/(gerador)/schedule")}
            style={{
              backgroundColor: "rgba(255,255,255,0.18)",
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Ionicons name="calendar-outline" size={18} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontWeight: "600" }}>
              Novo agendamento
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onRefresh}
            style={{
              backgroundColor: "rgba(255,255,255,0.18)",
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontWeight: "600" }}>
              Atualizar
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
        {errorMessage ? (
          <View
            style={{
              marginBottom: 16,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "#FECACA",
              backgroundColor: "#FEF2F2",
              padding: 16,
            }}
          >
            <Text style={{ fontWeight: "700", color: "#B91C1C" }}>Erro</Text>
            <Text style={{ marginTop: 4, color: "#DC2626" }}>{errorMessage}</Text>

            <TouchableOpacity
              onPress={() => loadDashboard(true)}
              style={{
                marginTop: 12,
                alignSelf: "flex-start",
                borderRadius: 12,
                backgroundColor: "#DC2626",
                paddingHorizontal: 16,
                paddingVertical: 10,
              }}
            >
              <Text style={{ fontWeight: "700", color: "#FFFFFF" }}>
                Tentar novamente
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
          <MetricCard
            title="Total coletado"
            value={`${metrics.totalKg.toFixed(1)} kg`}
            icon="leaf-outline"
          />
          <MetricCard
            title="Coletas concluídas"
            value={`${metrics.totalCollectionsCompleted}`}
            icon="checkmark-done-outline"
          />
          <MetricCard
            title="Agendamentos abertos"
            value={`${metrics.openSchedules}`}
            icon="time-outline"
          />
        </View>

        <SectionHeader
          title="Próximos agendamentos"
          actionLabel="Ver agenda"
          onPress={() => router.push("/(gerador)/schedule")}
        />

        <View
          style={{
            borderRadius: 18,
            backgroundColor: "#FFFFFF",
            padding: 16,
          }}
        >
          {metrics.nextSchedules.length === 0 ? (
            <EmptyState
              icon="calendar-clear-outline"
              title="Nenhum agendamento próximo"
              subtitle="Quando você criar um novo agendamento, ele aparecerá aqui."
            />
          ) : (
            metrics.nextSchedules.map((schedule) => {
              const materials = extractMaterials(schedule.notes);

              return (
                <View
                  key={schedule.id}
                  style={{
                    marginBottom: 12,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: "#F1F5F9",
                    backgroundColor: "#F8FAFC",
                    padding: 16,
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
                          fontSize: 16,
                          fontWeight: "700",
                          color: "#1E293B",
                        }}
                      >
                        {formatDateTime(
                          schedule.scheduledDate || schedule.preferredDate
                        )}
                      </Text>

                      <Text
                        style={{
                          marginTop: 4,
                          fontSize: 14,
                          color: "#64748B",
                        }}
                      >
                        Status: {translateScheduleStatus(schedule.status)}
                      </Text>

                      {materials.length > 0 ? (
                        <Text
                          style={{
                            marginTop: 8,
                            fontSize: 14,
                            color: "#334155",
                          }}
                        >
                          Materiais: {materials.join(", ")}
                        </Text>
                      ) : null}

                      {schedule.notes ? (
                        <Text
                          style={{
                            marginTop: 8,
                            fontSize: 14,
                            color: "#475569",
                          }}
                        >
                          Observações: {schedule.notes}
                        </Text>
                      ) : null}
                    </View>

                    <View
                      style={{
                        borderRadius: 999,
                        backgroundColor: getScheduleStatusBadgeColor(
                          schedule.status
                        ),
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "700",
                          color: "#FFFFFF",
                        }}
                      >
                        {translateScheduleStatus(schedule.status)}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <SectionHeader
          title="Coletas recentes"
          actionLabel="Ver impacto"
          onPress={() => router.push("/(gerador)/percentual")}
        />

        <View
          style={{
            borderRadius: 18,
            backgroundColor: "#FFFFFF",
            padding: 16,
          }}
        >
          {metrics.recentCollections.length === 0 ? (
            <EmptyState
              icon="cube-outline"
              title="Nenhuma coleta encontrada"
              subtitle="As coletas executadas aparecerão aqui assim que forem registradas."
            />
          ) : (
            metrics.recentCollections.map((collection) => (
              <View
                key={collection.id}
                style={{
                  marginBottom: 12,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: "#F1F5F9",
                  backgroundColor: "#F8FAFC",
                  padding: 16,
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
                        fontSize: 16,
                        fontWeight: "700",
                        color: "#1E293B",
                      }}
                    >
                      {collection.schedule?.scheduledDate
                        ? formatDateTime(collection.schedule.scheduledDate)
                        : formatDate(collection.createdAt)}
                    </Text>

                    <Text
                      style={{
                        marginTop: 4,
                        fontSize: 14,
                        color: "#64748B",
                      }}
                    >
                      Status: {translateCollectionStatus(collection.status)}
                    </Text>

                    <Text
                      style={{
                        marginTop: 8,
                        fontSize: 14,
                        fontWeight: "700",
                        color: "#334155",
                      }}
                    >
                      Total coletado: {Number(collection.totalWeightKg || 0).toFixed(1)} kg
                    </Text>

                    {(collection.materials || []).length > 0 ? (
                      <Text
                        style={{
                          marginTop: 8,
                          fontSize: 14,
                          color: "#475569",
                        }}
                      >
                        Materiais: {collection.materials.join(", ")}
                      </Text>
                    ) : null}
                  </View>

                  <View
                    style={{
                      borderRadius: 999,
                      backgroundColor: getCollectionStatusBadgeColor(
                        collection.status
                      ),
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: "#FFFFFF",
                      }}
                    >
                      {translateCollectionStatus(collection.status)}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        <View
          style={{
            marginTop: 20,
            borderRadius: 18,
            backgroundColor: "#FFFFFF",
            padding: 16,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: "#1E293B",
            }}
          >
            Resumo rápido
          </Text>

          <View style={{ marginTop: 16, gap: 12 }}>
            <QuickAction
              icon="calendar-outline"
              title="Solicitar nova coleta"
              subtitle="Crie um novo agendamento para materiais recicláveis"
              onPress={() => router.push("/(gerador)/schedule")}
            />

            <QuickAction
              icon="pie-chart-outline"
              title="Ver percentual e impacto"
              subtitle="Acompanhe seus indicadores ambientais"
              onPress={() => router.push("/(gerador)/percentual")}
            />

            <QuickAction
              icon="chatbubble-outline"
              title="Enviar feedback"
              subtitle="Compartilhe sua experiência com a cooperativa"
              onPress={() => router.push("/(gerador)/feedback")}
            />

            <QuickAction
              icon="person-outline"
              title="Meu perfil"
              subtitle="Revise e atualize suas informações"
              onPress={() => router.push("/(gerador)/profile")}
            />
          </View>
        </View>
      </View>
    </ScrollView>
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
        marginBottom: 12,
        borderRadius: 18,
        backgroundColor: "#FFFFFF",
        padding: 16,
      }}
    >
      <View
        style={{
          marginBottom: 12,
          height: 44,
          width: 44,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 999,
          backgroundColor: "#DCFCE7",
        }}
      >
        <Ionicons name={icon} size={22} color="#15803D" />
      </View>

      <Text style={{ fontSize: 14, color: "#64748B" }}>{title}</Text>
      <Text
        style={{
          marginTop: 4,
          fontSize: 22,
          fontWeight: "700",
          color: "#1E293B",
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
        marginTop: 20,
        marginBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Text
        style={{
          fontSize: 18,
          fontWeight: "700",
          color: "#1E293B",
        }}
      >
        {title}
      </Text>

      {actionLabel && onPress ? (
        <TouchableOpacity onPress={onPress}>
          <Text style={{ fontWeight: "600", color: "#15803D" }}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      ) : null}
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
        justifyContent: "center",
        paddingVertical: 32,
      }}
    >
      <View
        style={{
          height: 56,
          width: 56,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 999,
          backgroundColor: "#F1F5F9",
        }}
      >
        <Ionicons name={icon} size={28} color="#64748B" />
      </View>

      <Text
        style={{
          marginTop: 12,
          fontSize: 16,
          fontWeight: "700",
          color: "#334155",
        }}
      >
        {title}
      </Text>

      <Text
        style={{
          marginTop: 4,
          paddingHorizontal: 24,
          textAlign: "center",
          fontSize: 14,
          color: "#64748B",
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
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#F1F5F9",
        backgroundColor: "#F8FAFC",
        padding: 16,
      }}
    >
      <View
        style={{
          marginRight: 16,
          height: 48,
          width: 48,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 999,
          backgroundColor: "#DCFCE7",
        }}
      >
        <Ionicons name={icon} size={22} color="#15803D" />
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 16,
            fontWeight: "700",
            color: "#1E293B",
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            marginTop: 4,
            fontSize: 14,
            color: "#64748B",
          }}
        >
          {subtitle}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={20} color="#64748B" />
    </TouchableOpacity>
  );
}