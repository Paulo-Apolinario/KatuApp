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

import { scheduleService, type Schedule } from "@/src/services/scheduleService";
import { useAuth } from "@/src/contexts/AuthContext";

type AuthUserLike = {
  id?: string;
  name?: string;
  displayName?: string;
};

function extractRequestedMaterials(notes?: string | null) {
  if (!notes) return [];

  const match = notes.match(/Materiais solicitados:\s*([^|]+)/i);
  if (!match) return [];

  return match[1]
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function RankingScreen() {
  const { user } = useAuth();
  const currentUser = user as AuthUserLike | null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  const loadData = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);

      const data = await scheduleService.list();
      setSchedules(data);
    } catch (error) {
      console.error("Erro ao carregar ranking:", error);
      setSchedules([]);
    } finally {
      if (showLoader) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData(true);
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(false);
  }, [loadData]);

  const stats = useMemo(() => {
    const completed = schedules.filter((item) => item.status === "COMPLETED");
    const requested = schedules.filter((item) => item.status === "REQUESTED");
    const scheduled = schedules.filter((item) => item.status === "SCHEDULED");

    const materialMap: Record<string, number> = {};

    schedules.forEach((item) => {
      const materials = extractRequestedMaterials(item.notes);
      materials.forEach((material) => {
        const key = material.toUpperCase();
        materialMap[key] = (materialMap[key] || 0) + 1;
      });
    });

    const topMaterials = Object.entries(materialMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const engagementScore =
      completed.length * 3 + scheduled.length * 2 + requested.length;

    return {
      completed: completed.length,
      requested: requested.length,
      scheduled: scheduled.length,
      topMaterials,
      engagementScore,
    };
  }, [schedules]);

  const displayName =
    currentUser?.displayName || currentUser?.name || "Usuário";

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#F3F4F6",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color="#028C56" />
        <Text style={{ marginTop: 10, color: "#6B7280" }}>
          Carregando ranking...
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
      contentContainerStyle={{ paddingBottom: 28 }}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={["#10F35D", "#028C56"]}
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

          <Text style={{ fontSize: 20, fontWeight: "700", color: "#FFFFFF" }}>
            RANKING
          </Text>

          <Ionicons name="trophy-outline" size={24} color="#FFFFFF" />
        </View>

        <View style={{ marginTop: 24, alignItems: "center" }}>
          <View
            style={{
              width: 84,
              height: 84,
              borderRadius: 42,
              backgroundColor: "#FFFFFF",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
            }}
          >
            <Ionicons name="person" size={48} color="#028C56" />
          </View>

          <Text
            style={{
              fontSize: 22,
              fontWeight: "800",
              color: "#FFFFFF",
              textAlign: "center",
            }}
          >
            {displayName}
          </Text>

          <Text
            style={{
              marginTop: 8,
              color: "#E8FFF1",
              fontSize: 14,
              textAlign: "center",
            }}
          >
            O ranking global será exibido quando o endpoint oficial estiver ativo.
          </Text>
        </View>
      </LinearGradient>

      <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
        <SectionCard>
          <Text style={sectionTitle}>Minha participação</Text>

          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <MetricCard
              title="Concluídas"
              value={String(stats.completed)}
              icon="checkmark-done-outline"
            />
            <MetricCard
              title="Agendadas"
              value={String(stats.scheduled)}
              icon="calendar-outline"
            />
          </View>

          <View style={{ marginTop: 12 }}>
            <MetricCardFull
              title="Pontuação de engajamento"
              value={String(stats.engagementScore)}
              icon="flash-outline"
            />
          </View>
        </SectionCard>

        <SectionCard>
          <Text style={sectionTitle}>Materiais mais recorrentes</Text>

          {stats.topMaterials.length > 0 ? (
            stats.topMaterials.map((item, index) => (
              <View
                key={item.name}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingBottom: index === stats.topMaterials.length - 1 ? 0 : 12,
                  marginBottom: index === stats.topMaterials.length - 1 ? 0 : 12,
                  borderBottomWidth:
                    index === stats.topMaterials.length - 1 ? 0 : 1,
                  borderBottomColor: "#E5E7EB",
                }}
              >
                <Text style={{ fontSize: 15, color: "#111827", fontWeight: "600" }}>
                  {item.name}
                </Text>
                <Text style={{ fontSize: 15, color: "#028C56", fontWeight: "800" }}>
                  {item.count}
                </Text>
              </View>
            ))
          ) : (
            <EmptyState
              icon="albums-outline"
              title="Sem dados suficientes"
              subtitle="Os materiais mais recorrentes aparecerão aqui conforme você usar o sistema."
            />
          )}
        </SectionCard>
      </View>
    </ScrollView>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        marginBottom: 14,
      }}
    >
      {children}
    </View>
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
        backgroundColor: "#F9FAFB",
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: "#E5E7EB",
      }}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 21,
          backgroundColor: "#DCFCE7",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 10,
        }}
      >
        <Ionicons name={icon} size={20} color="#15803D" />
      </View>

      <Text style={{ fontSize: 13, color: "#6B7280" }}>{title}</Text>
      <Text style={{ marginTop: 4, fontSize: 21, fontWeight: "800", color: "#111827" }}>
        {value}
      </Text>
    </View>
  );
}

function MetricCardFull({
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
        backgroundColor: "#F9FAFB",
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: "#E5E7EB",
      }}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 21,
          backgroundColor: "#DCFCE7",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 10,
        }}
      >
        <Ionicons name={icon} size={20} color="#15803D" />
      </View>

      <Text style={{ fontSize: 13, color: "#6B7280" }}>{title}</Text>
      <Text style={{ marginTop: 4, fontSize: 21, fontWeight: "800", color: "#111827" }}>
        {value}
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
    <View style={{ alignItems: "center", paddingVertical: 20 }}>
      <Ionicons name={icon} size={40} color="#9CA3AF" />
      <Text style={{ marginTop: 10, fontSize: 16, fontWeight: "700", color: "#374151" }}>
        {title}
      </Text>
      <Text
        style={{
          marginTop: 6,
          fontSize: 14,
          color: "#6B7280",
          textAlign: "center",
          lineHeight: 20,
        }}
      >
        {subtitle}
      </Text>
    </View>
  );
}

const sectionTitle = {
  fontSize: 18,
  fontWeight: "700" as const,
  color: "#111827",
  marginBottom: 14,
} as const;