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

import { useAuth } from "@/src/contexts/AuthContext";
import {
  scheduleService,
  type Schedule,
} from "@/src/services/scheduleService";

type AuthUserLike = {
  id?: string;
  name?: string;
  displayName?: string;
  email?: string;
  cpf?: string;
  phone?: string;
  address?: string;
  createdAt?: string | null;
};

function formatDate(dateString?: string | null) {
  if (!dateString) return "Não informado";

  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return "Não informado";

  return parsed.toLocaleDateString("pt-BR");
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

function getUserDisplayName(user: AuthUserLike | null) {
  return user?.displayName || user?.name || "Usuário";
}

function buildUserCode(userId?: string) {
  if (!userId) return "Não informado";
  return `KATUÁ-${userId.slice(0, 8).toUpperCase()}`;
}

export default function ProfileScreen() {
  const { user } = useAuth();
  const currentUser = user as AuthUserLike | null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  const loadProfileData = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);

      const data = await scheduleService.list();
      setSchedules(data);
    } catch (error) {
      console.error("Erro ao carregar perfil da PF:", error);
      setSchedules([]);
    } finally {
      if (showLoader) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfileData(true);
    }, [loadProfileData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProfileData(false);
  }, [loadProfileData]);

  const metrics = useMemo(() => {
    const totalSolicitacoes = schedules.length;

    const completed = schedules.filter((item) => item.status === "COMPLETED");
    const agendadas = schedules.filter(
      (item) => item.status === "REQUESTED" || item.status === "SCHEDULED"
    );

    const materialsMap: Record<string, number> = {};

    schedules.forEach((item) => {
      const materials = extractRequestedMaterials(item.notes);

      materials.forEach((material) => {
        const key = material.toUpperCase();
        materialsMap[key] = (materialsMap[key] || 0) + 1;
      });
    });

    const topMaterial =
      Object.entries(materialsMap).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";

    return {
      totalSolicitacoes,
      completedCount: completed.length,
      agendadasCount: agendadas.length,
      topMaterial,
    };
  }, [schedules]);

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
        <Text style={{ marginTop: 12, color: "#6B7280" }}>
          Carregando perfil...
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
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text
            style={{
              fontSize: 20,
              fontWeight: "700",
              color: "#FFFFFF",
            }}
          >
            MEU PERFIL
          </Text>

          <TouchableOpacity
            onPress={() => router.push("/(pf-tabs)/edit-profile")}
          >
            <Ionicons name="create-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={{ alignItems: "center", marginTop: 22 }}>
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: "#FFFFFF",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 14,
            }}
          >
            <Ionicons name="person" size={56} color="#028C56" />
          </View>

          <Text
            style={{
              fontSize: 22,
              fontWeight: "800",
              color: "#FFFFFF",
              textAlign: "center",
            }}
          >
            {getUserDisplayName(currentUser)}
          </Text>

          <Text
            style={{
              fontSize: 14,
              color: "#E8FFF1",
              textAlign: "center",
              marginTop: 6,
            }}
          >
            {currentUser?.address?.trim()
              ? currentUser.address
              : "Endereço não informado"}
          </Text>
        </View>
      </LinearGradient>

      <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
        <SectionCard>
          <Text style={sectionTitle}>Meus dados</Text>

          <InfoRow
            label="CPF"
            value={currentUser?.cpf?.trim() || "Não informado"}
          />
          <InfoRow
            label="Contato"
            value={currentUser?.phone?.trim() || "Não informado"}
          />
          <InfoRow
            label="Email"
            value={currentUser?.email?.trim() || "Não informado"}
          />
          <InfoRow
            label="Endereço"
            value={currentUser?.address?.trim() || "Não informado"}
          />
          <InfoRow
            label="Cadastro"
            value={formatDate(currentUser?.createdAt)}
            isLast
          />
        </SectionCard>

        <SectionCard>
          <Text style={sectionTitle}>Visão geral</Text>

          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <MetricCard
              title="Solicitações"
              value={String(metrics.totalSolicitacoes)}
              icon="calendar-outline"
            />
            <MetricCard
              title="Concluídas"
              value={String(metrics.completedCount)}
              icon="checkmark-done-outline"
            />
          </View>

          <View style={{ marginTop: 12 }}>
            <MetricCardFull
              title="Material mais recorrente"
              value={metrics.topMaterial}
              icon="leaf-outline"
            />
          </View>

          <View style={{ marginTop: 12 }}>
            <MetricCardFull
              title="Agendadas / pendentes"
              value={String(metrics.agendadasCount)}
              icon="time-outline"
            />
          </View>
        </SectionCard>

        <SectionCard>
          <Text style={sectionTitle}>Código do usuário</Text>

          <Text
            style={{
              fontSize: 20,
              fontWeight: "800",
              color: "#028C56",
            }}
          >
            {buildUserCode(currentUser?.id)}
          </Text>
        </SectionCard>

        <SectionCard>
          <Text style={sectionTitle}>Ações rápidas</Text>

          <QuickAction
            icon="create-outline"
            title="Editar informações"
            subtitle="Atualizar dados cadastrais da conta"
            onPress={() => router.push("/(pf-tabs)/edit-profile")}
          />
          <QuickAction
            icon="calendar-outline"
            title="Agendar coleta"
            subtitle="Criar uma nova solicitação"
            onPress={() => router.push("/(pf-tabs)/schedule")}
          />
          <QuickAction
            icon="time-outline"
            title="Ver histórico"
            subtitle="Consultar solicitações realizadas"
            onPress={() => router.push("/(pf-tabs)/history")}
            isLast
          />
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

function InfoRow({
  label,
  value,
  isLast = false,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View
      style={{
        paddingBottom: isLast ? 0 : 12,
        marginBottom: isLast ? 0 : 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: "#E5E7EB",
      }}
    >
      <Text style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 15, color: "#111827", fontWeight: "600" }}>
        {value || "Não informado"}
      </Text>
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
      <Text
        style={{
          marginTop: 4,
          fontSize: 21,
          fontWeight: "800",
          color: "#111827",
        }}
      >
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
      <Text
        style={{
          marginTop: 4,
          fontSize: 21,
          fontWeight: "800",
          color: "#111827",
        }}
      >
        {value}
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

const sectionTitle = {
  fontSize: 18,
  fontWeight: "700" as const,
  color: "#111827",
  marginBottom: 14,
} as const;