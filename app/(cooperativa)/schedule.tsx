import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import {
  scheduleService,
  type Schedule,
  type ScheduleStatus,
} from "@/src/services/scheduleService";

function formatDate(value?: string | null) {
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

function mapStatusLabel(status?: string) {
  switch (status) {
    case "REQUESTED":
      return "SOLICITADO";
    case "SCHEDULED":
      return "AGENDADO";
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

function mapStatusColor(status?: string) {
  switch (status) {
    case "REQUESTED":
      return "#F59E0B";
    case "SCHEDULED":
      return "#2563EB";
    case "IN_PROGRESS":
      return "#8B5CF6";
    case "COMPLETED":
      return "#028C56";
    case "CANCELLED":
      return "#DC2626";
    default:
      return "#6B7280";
  }
}

function extractRequestedMaterials(notes?: string | null) {
  if (!notes) return [];

  const match = notes.match(/Materiais solicitados:\s*([^|]+)/i);
  if (!match) return [];

  return match[1]
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getScheduleOrigin(item: Schedule) {
  if (item.generatorId) return "GERADOR";
  if (item.requestedByUserId) return "PESSOA FÍSICA";
  return "SOLICITAÇÃO";
}

function getScheduleTitle(item: Schedule) {
  if (item.generator?.companyName) return item.generator.companyName;
  if (item.generator?.name) return item.generator.name;

  if (item.requestedBy?.displayName) {
    return item.requestedBy.displayName;
  }

  if (item.requestedBy?.email) {
    return item.requestedBy.email;
  }

  return "Solicitação sem identificação";
}

function getScheduleSubtitle(item: Schedule) {
  if (item.generatorId) {
    return "Solicitante: gerador vinculado";
  }

  if (item.requestedBy?.displayName) {
    return `Solicitante: ${item.requestedBy.displayName}`;
  }

  if (item.requestedBy?.email) {
    return `Solicitante: ${item.requestedBy.email}`;
  }

  return "Solicitante não identificado";
}

function getScheduleAddress(item: Schedule) {
  if (item.generator?.address) return item.generator.address;
  if (item.cooperative?.address) return item.cooperative.address;
  return "Não informado";
}

export default function ScheduleScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  const loadSchedules = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);

      const response = await scheduleService.list();
      setSchedules(response);
    } catch (error: any) {
      Alert.alert(
        "Erro",
        error?.message || "Não foi possível carregar os agendamentos."
      );
      setSchedules([]);
    } finally {
      if (showLoader) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSchedules(true);
    }, [loadSchedules])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSchedules(false);
  }, [loadSchedules]);

  const summary = useMemo(() => {
    return {
      total: schedules.length,
      solicitados: schedules.filter((item) => item.status === "REQUESTED")
        .length,
      agendados: schedules.filter((item) => item.status === "SCHEDULED").length,
      concluidos: schedules.filter((item) => item.status === "COMPLETED").length,
    };
  }, [schedules]);

  const handleUpdateStatus = async (
    scheduleId: string,
    status: ScheduleStatus
  ) => {
    try {
      setUpdatingId(scheduleId);

      await scheduleService.updateStatus(scheduleId, { status });
      await loadSchedules(false);

      Alert.alert("Sucesso", "Status do agendamento atualizado.");
    } catch (error: any) {
      Alert.alert(
        "Erro",
        error?.message || "Não foi possível atualizar o status."
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelegate = (schedule: Schedule) => {
    Alert.alert(
      "Próxima etapa",
      `Vamos conectar a delegação do agendamento ${schedule.id} para um catador na próxima fase operacional.`
    );
  };

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
          borderBottomLeftRadius: 30,
          borderBottomRightRadius: 30,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginRight: 15 }}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: "700", color: "#FFFFFF" }}>
            AGENDAMENTOS
          </Text>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#028C56" />
          <Text style={{ marginTop: 12, color: "#6B7280" }}>
            Carregando agendamentos...
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ flex: 1, padding: 20 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 25,
            }}
          >
            <SummaryCard label="Total" value={summary.total} color="#028C56" bg="#F0FDF4" />
            <SummaryCard
              label="Solicitados"
              value={summary.solicitados}
              color="#F59E0B"
              bg="#FEFCE8"
            />
            <SummaryCard
              label="Agendados"
              value={summary.agendados}
              color="#2563EB"
              bg="#EFF6FF"
            />
          </View>

          <View style={{ marginBottom: 18 }}>
            <View
              style={{
                backgroundColor: "#ECFDF5",
                borderRadius: 16,
                padding: 16,
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 14, color: "#4B5563", marginBottom: 5 }}>
                Concluídos
              </Text>
              <Text style={{ fontSize: 28, fontWeight: "800", color: "#028C56" }}>
                {summary.concluidos}
              </Text>
            </View>
          </View>

          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: "#111827",
              marginBottom: 15,
            }}
          >
            Lista de Agendamentos
          </Text>

          {schedules.length === 0 ? (
            <EmptyState
              icon="calendar-outline"
              title="Nenhum agendamento encontrado"
              subtitle="As solicitações de geradores e PF aparecerão aqui."
            />
          ) : (
            schedules.map((item) => {
              const materials = extractRequestedMaterials(item.notes);

              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.9}
                  onPress={() =>
                    router.push({
                      pathname: "/(cooperativa)/schedule/[id]",
                      params: { id: item.id },
                    })
                  }
                  style={{
                    backgroundColor: "#F9FAFB",
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 14,
                    borderLeftWidth: 4,
                    borderLeftColor: mapStatusColor(item.status),
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 10,
                    }}
                  >
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "700",
                          color: "#111827",
                        }}
                      >
                        {getScheduleTitle(item)}
                      </Text>

                      <Text
                        style={{
                          fontSize: 13,
                          color: "#6B7280",
                          marginTop: 4,
                        }}
                      >
                        {getScheduleSubtitle(item)}
                      </Text>
                    </View>

                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <View
                        style={{
                          backgroundColor: mapStatusColor(item.status),
                          paddingHorizontal: 12,
                          paddingVertical: 5,
                          borderRadius: 999,
                          marginRight: 8,
                        }}
                      >
                        <Text
                          style={{
                            color: "#FFFFFF",
                            fontSize: 11,
                            fontWeight: "700",
                          }}
                        >
                          {mapStatusLabel(item.status)}
                        </Text>
                      </View>

                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color="#9CA3AF"
                      />
                    </View>
                  </View>

                  <Text
                    style={{
                      fontSize: 13,
                      color: "#028C56",
                      fontWeight: "700",
                    }}
                  >
                    Origem: {getScheduleOrigin(item)}
                  </Text>

                  <Text style={{ fontSize: 14, color: "#6B7280", marginTop: 6 }}>
                    Endereço: {getScheduleAddress(item)}
                  </Text>

                  <Text style={{ fontSize: 14, color: "#4B5563", marginTop: 4 }}>
                    Data:{" "}
                    {formatDate(
                      item.scheduledDate || item.preferredDate || item.createdAt
                    )}
                  </Text>

                  <Text style={{ fontSize: 14, color: "#4B5563", marginTop: 4 }}>
                    Materiais:{" "}
                    {materials.length > 0
                      ? materials.join(", ")
                      : "Não informado"}
                  </Text>

                  {!!item.notes && (
                    <Text style={{ fontSize: 13, color: "#6B7280", marginTop: 6 }}>
                      Observações: {item.notes}
                    </Text>
                  )}

                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      marginTop: 14,
                    }}
                  >
                    {item.status === "REQUESTED" && (
                      <ActionChip
                        label="Agendar"
                        color="#2563EB"
                        onPress={() => handleUpdateStatus(item.id, "SCHEDULED")}
                        loading={updatingId === item.id}
                      />
                    )}

                    {(item.status === "REQUESTED" || item.status === "SCHEDULED") && (
                      <ActionChip
                        label="Delegar"
                        color="#028C56"
                        onPress={() => handleDelegate(item)}
                      />
                    )}

                    {item.status === "SCHEDULED" && (
                      <ActionChip
                        label="Iniciar"
                        color="#8B5CF6"
                        onPress={() =>
                          handleUpdateStatus(item.id, "IN_PROGRESS")
                        }
                        loading={updatingId === item.id}
                      />
                    )}

                    {item.status === "IN_PROGRESS" && (
                      <ActionChip
                        label="Concluir"
                        color="#028C56"
                        onPress={() =>
                          handleUpdateStatus(item.id, "COMPLETED")
                        }
                        loading={updatingId === item.id}
                      />
                    )}

                    {item.status !== "COMPLETED" &&
                      item.status !== "CANCELLED" && (
                        <ActionChip
                          label="Cancelar"
                          color="#DC2626"
                          onPress={() =>
                            handleUpdateStatus(item.id, "CANCELLED")
                          }
                          loading={updatingId === item.id}
                        />
                      )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

function SummaryCard({
  label,
  value,
  color,
  bg,
}: {
  label: string;
  value: number;
  color: string;
  bg: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: bg,
        borderRadius: 16,
        padding: 16,
        marginRight: 8,
        alignItems: "center",
      }}
    >
      <Text style={{ fontSize: 14, color: "#4B5563", marginBottom: 5 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 24, fontWeight: "800", color }}>{value}</Text>
    </View>
  );
}

function ActionChip({
  label,
  color,
  onPress,
  loading = false,
}: {
  label: string;
  color: string;
  onPress: () => void;
  loading?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading}
      style={{
        backgroundColor: color,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        marginRight: 8,
        marginBottom: 8,
        opacity: loading ? 0.7 : 1,
      }}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "700" }}>
          {label.toUpperCase()}
        </Text>
      )}
    </TouchableOpacity>
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
        backgroundColor: "#F9FAFB",
        borderRadius: 16,
        padding: 24,
        alignItems: "center",
        marginBottom: 20,
      }}
    >
      <Ionicons name={icon} size={42} color="#9CA3AF" />
      <Text
        style={{
          fontSize: 16,
          color: "#111827",
          fontWeight: "700",
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
          marginTop: 6,
          textAlign: "center",
        }}
      >
        {subtitle}
      </Text>
    </View>
  );
}