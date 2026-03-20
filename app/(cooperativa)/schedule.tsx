import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
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

import { scheduleService, Schedule } from "@/src/services/scheduleService";

type ScheduleCard = {
  id: string;
  title: string;
  address: string;
  dateLabel: string;
  status: string;
};

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

function mapScheduleToCard(item: Schedule): ScheduleCard {
  return {
    id: item.id,
    title:
      item.generator?.companyName ||
      item.generator?.name ||
      "Gerador não identificado",
    address: item.generator?.address || "Endereço não informado",
    dateLabel: formatDate(item.scheduledDate || item.preferredDate || item.createdAt),
    status: item.status || "REQUESTED",
  };
}

export default function ScheduleScreen() {
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<ScheduleCard[]>([]);

  const loadSchedules = useCallback(async () => {
    try {
      setLoading(true);

      const response = await scheduleService.list();
      const list = response.map(mapScheduleToCard);

      setSchedules(list);
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Não foi possível carregar os agendamentos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSchedules();
    }, [loadSchedules])
  );

  const summary = useMemo(() => {
    return {
      total: schedules.length,
      pendentes: schedules.filter((item) => item.status === "REQUESTED").length,
      concluidos: schedules.filter((item) => item.status === "COMPLETED").length,
    };
  }, [schedules]);

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
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: "700", color: "#FFFFFF" }}>
            AGENDAMENTOS
          </Text>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, padding: 20 }}>
        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: 50 }}>
            <ActivityIndicator size="large" color="#028C56" />
            <Text style={{ marginTop: 12, color: "#6B7280" }}>
              Carregando agendamentos...
            </Text>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 25 }}>
              <View
                style={{
                  flex: 1,
                  backgroundColor: "#F0FDF4",
                  borderRadius: 16,
                  padding: 16,
                  marginRight: 10,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 14, color: "#4B5563", marginBottom: 5 }}>
                  Total
                </Text>
                <Text style={{ fontSize: 24, fontWeight: "800", color: "#028C56" }}>
                  {summary.total}
                </Text>
              </View>

              <View
                style={{
                  flex: 1,
                  backgroundColor: "#FEFCE8",
                  borderRadius: 16,
                  padding: 16,
                  marginRight: 10,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 14, color: "#4B5563", marginBottom: 5 }}>
                  Solicitados
                </Text>
                <Text style={{ fontSize: 24, fontWeight: "800", color: "#F59E0B" }}>
                  {summary.pendentes}
                </Text>
              </View>

              <View
                style={{
                  flex: 1,
                  backgroundColor: "#ECFDF5",
                  borderRadius: 16,
                  padding: 16,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 14, color: "#4B5563", marginBottom: 5 }}>
                  Concluídos
                </Text>
                <Text style={{ fontSize: 24, fontWeight: "800", color: "#028C56" }}>
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
              <View
                style={{
                  backgroundColor: "#F9FAFB",
                  borderRadius: 16,
                  padding: 24,
                  alignItems: "center",
                  marginBottom: 20,
                }}
              >
                <Ionicons name="calendar-outline" size={42} color="#9CA3AF" />
                <Text
                  style={{
                    fontSize: 16,
                    color: "#6B7280",
                    marginTop: 10,
                    textAlign: "center",
                  }}
                >
                  Nenhum agendamento encontrado.
                </Text>
              </View>
            ) : (
              schedules.map((item) => (
                <View
                  key={item.id}
                  style={{
                    backgroundColor: "#F9FAFB",
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 12,
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
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "700",
                        color: "#111827",
                        flex: 1,
                        paddingRight: 12,
                      }}
                    >
                      {item.title}
                    </Text>

                    <View
                      style={{
                        backgroundColor: mapStatusColor(item.status),
                        paddingHorizontal: 12,
                        paddingVertical: 5,
                        borderRadius: 999,
                      }}
                    >
                      <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "700" }}>
                        {mapStatusLabel(item.status)}
                      </Text>
                    </View>
                  </View>

                  <Text style={{ fontSize: 14, color: "#6B7280", marginBottom: 6 }}>
                    {item.address}
                  </Text>

                  <Text style={{ fontSize: 14, color: "#4B5563" }}>
                    Data: {item.dateLabel}
                  </Text>
                </View>
              ))
            )}

            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  "Próxima etapa",
                  "A criação manual de agendamentos será integrada na próxima etapa operacional da cooperativa."
                )
              }
              style={{
                backgroundColor: "#F0FDF4",
                borderRadius: 12,
                padding: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                marginTop: 10,
                marginBottom: 30,
                borderWidth: 1,
                borderColor: "#028C56",
                borderStyle: "dashed",
              }}
            >
              <Ionicons name="add-circle-outline" size={24} color="#028C56" />
              <Text
                style={{
                  fontSize: 16,
                  color: "#028C56",
                  fontWeight: "600",
                  marginLeft: 8,
                }}
              >
                NOVO AGENDAMENTO
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}