import { useHistoryPages } from "@/src/hooks/useHistoryPages";
import { HistoryStatus } from "@/src/components/HistoryStatus";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef } from "react";
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

import { scheduleService } from "@/src/services/scheduleService";

function formatDate(dateString?: string | null) {
  if (!dateString) return "-";

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("pt-BR");
}

function extractMaterials(notes?: string | null) {
  if (!notes) return "-";

  const match = notes.match(/Materiais solicitados:\s*([^|]+)/i);
  return match ? match[1].trim() : notes;
}

function getStatusLabel(status: string) {
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

function getStatusColor(status: string) {
  switch (status) {
    case "REQUESTED":
      return "#F59E0B";
    case "SCHEDULED":
      return "#047857";
    case "IN_PROGRESS":
      return "#3B82F6";
    case "COMPLETED":
      return "#10B981";
    case "CANCELLED":
      return "#EF4444";
    default:
      return "#6B7280";
  }
}

export default function HistoryScreen() {
  const history = useHistoryPages(scheduleService.history);
  const { items: schedules, loading, busy: refreshing } = history;
  const loadRef = useRef(history.load); loadRef.current = history.load;
  useFocusEffect(useCallback(() => { void loadRef.current(); }, []));
  const onRefresh = () => history.load();

  const totalColetas = useMemo(() => schedules.length, [schedules]);

  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      {/* Header */}
      <LinearGradient
        colors={["#123C35", "#17694F"]}
        style={{
          paddingTop: 20,
          paddingBottom: 20,
          paddingHorizontal: 20,
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
            HISTÓRICO
          </Text>
        </View>
      </LinearGradient>

      {loading ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator color="#047857" />
          <Text style={{ marginTop: 10 }}>Carregando histórico...</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ flex: 1, padding: 20 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <HistoryStatus count={schedules.length} total={history.meta.total} error={history.error} busy={history.busy} hasMore={history.meta.hasMore} updatedAt={history.updatedAt} onRefresh={() => void history.load()} onMore={() => void history.load(true)} />
          {/* Total */}
          <View
            style={{
              backgroundColor: "#F0FDF4",
              borderRadius: 16,
              padding: 20,
              alignItems: "center",
              marginBottom: 25,
            }}
          >
            <Text style={{ fontSize: 14, color: "#4B5563", marginBottom: 5 }}>
              Solicitações carregadas
            </Text>

            <Text
              style={{
                fontSize: 36,
                fontWeight: "700",
                color: "#047857",
              }}
            >
              {totalColetas}
            </Text>
          </View>

          {/* Lista */}
          {schedules.length > 0 ? (
            schedules.map((item) => (
              <View
                key={item.id}
                style={{
                  paddingVertical: 15,
                  borderBottomWidth: 1,
                  borderBottomColor: "#F3F4F6",
                }}
              >
                <Text
                  style={{ fontSize: 16, fontWeight: "600", color: "#111827" }}
                >
                  {formatDate(item.scheduledDate || item.createdAt)}
                </Text>

                <Text style={{ fontSize: 14, color: "#6B7280", marginTop: 4 }}>
                  {extractMaterials(item.notes)}
                </Text>

                <Text
                  style={{
                    marginTop: 6,
                    fontSize: 13,
                    fontWeight: "600",
                    color: getStatusColor(item.status),
                  }}
                >
                  {getStatusLabel(item.status)}
                </Text>
              </View>
            ))
          ) : (
            <View style={{ alignItems: "center", marginTop: 40 }}>
              <Ionicons name="time-outline" size={40} color="#9CA3AF" />
              <Text style={{ marginTop: 10, color: "#6B7280" }}>
                {history.error ? "Histórico indisponível no momento" : "Nenhum histórico encontrado"}
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
