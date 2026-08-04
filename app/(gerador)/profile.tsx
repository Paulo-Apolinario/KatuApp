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
import {
  type Generator,
  type GeneratorType,
  type GeneratorAccessStatus,
} from "@/src/services/generatorService";

type AuthUserLike = {
  id?: string;
  uid?: string;
  role?: string;
  name?: string;
  displayName?: string;
  email?: string;
  phone?: string | null;
  address?: string | null;
  generator?: Generator | null;
};

function getGeneratorDisplayName(user: AuthUserLike | null) {
  return (
    user?.generator?.companyName ||
    user?.generator?.name ||
    user?.displayName ||
    user?.name ||
    "Gerador"
  );
}

function getGeneratorEmail(user: AuthUserLike | null) {
  return user?.generator?.email || user?.email || "-";
}

function getGeneratorPhone(user: AuthUserLike | null) {
  return user?.generator?.phone || user?.phone || "-";
}

function getGeneratorAddress(user: AuthUserLike | null) {
  return user?.generator?.address || user?.address || "-";
}

function getGeneratorTypeLabel(
  role?: string,
  generatorType?: GeneratorType | null
) {
  if (generatorType === "SMALL" || role === "GENERATOR_SMALL") {
    return "Gerador de Pequeno Porte";
  }

  if (generatorType === "LARGE" || role === "GENERATOR_LARGE") {
    return "Gerador de Grande Porte";
  }

  return "Gerador";
}

function getAccessStatusLabel(status?: GeneratorAccessStatus | null) {
  switch (status) {
    case "ACTIVE":
      return "Ativo";
    case "PENDING_ACTIVATION":
      return "Pendente de ativação";
    case "INACTIVE":
      return "Inativo";
    case "BLOCKED":
      return "Bloqueado";
    default:
      return "Não informado";
  }
}

function getAccessStatusColor(status?: GeneratorAccessStatus | null) {
  switch (status) {
    case "ACTIVE":
      return "#10B981";
    case "PENDING_ACTIVATION":
      return "#F59E0B";
    case "INACTIVE":
      return "#6B7280";
    case "BLOCKED":
      return "#DC2626";
    default:
      return "#6B7280";
  }
}

function formatDate(dateString?: string | null) {
  if (!dateString) return "-";

  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return "-";

  return parsed.toLocaleDateString("pt-BR");
}

function normalizeMaterials(materials: unknown): CollectionMaterial[] {
  if (!Array.isArray(materials)) return [];

  return materials
    .map((item) => {
      if (typeof item === "string") {
        return { type: item, quantityKg: 0 };
      }

      if (item && typeof item === "object" && "type" in item) {
        return {
          type: String((item as { type?: unknown }).type ?? "Não informado"),
          quantityKg: Number(
            (item as { quantityKg?: unknown }).quantityKg ?? 0
          ),
        };
      }

      return null;
    })
    .filter(Boolean) as CollectionMaterial[];
}

function getCollectionTotalKg(collection: Collection) {
  const materialsKg = normalizeMaterials(collection.materials).reduce(
    (sum, item) => sum + Number(item.quantityKg ?? 0),
    0
  );

  if (materialsKg > 0) return materialsKg;
  return Number(collection.totalWeightKg ?? 0);
}

export default function GeneratorProfileScreen() {
  const { user } = useAuth();
  const currentUser: AuthUserLike | null = user
    ? (user as unknown as AuthUserLike)
    : null;
  const { notifyError } = useNotification();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);

  const loadProfileData = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);

      const [scheduleResponse, collectionResponse] = await Promise.all([
        scheduleService.list(),
        collectionService.list(),
      ]);

      setSchedules(Array.isArray(scheduleResponse) ? scheduleResponse : []);
      setCollections(Array.isArray(collectionResponse) ? collectionResponse : []);
    } catch (error) {
      console.error("Erro ao carregar perfil do gerador:", error);
      notifyError("Erro", "Não foi possível carregar os dados do perfil.");
    } finally {
      if (showLoader) setLoading(false);
      setRefreshing(false);
    }
  }, [notifyError]);

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
    const totalSchedules = schedules.length;

    const openSchedules = schedules.filter(
      (item) => item.status === "REQUESTED" || item.status === "SCHEDULED"
    ).length;

    const completedCollections = collections.filter(
      (item) => item.status === "COMPLETED"
    );

    const totalKg = completedCollections.reduce(
      (acc, item) => acc + getCollectionTotalKg(item),
      0
    );

    const lastCollection =
      [...completedCollections].sort((a, b) => {
        const aTime = a.collectedAt
          ? new Date(a.collectedAt).getTime()
          : a.createdAt
            ? new Date(a.createdAt).getTime()
            : 0;

        const bTime = b.collectedAt
          ? new Date(b.collectedAt).getTime()
          : b.createdAt
            ? new Date(b.createdAt).getTime()
            : 0;

        return bTime - aTime;
      })[0] || null;

    return {
      totalSchedules,
      openSchedules,
      completedCollections: completedCollections.length,
      totalKg,
      lastCollectionDate:
        lastCollection?.collectedAt || lastCollection?.createdAt || null,
    };
  }, [schedules, collections]);

  const displayName = getGeneratorDisplayName(currentUser);
  const displayEmail = getGeneratorEmail(currentUser);
  const displayPhone = getGeneratorPhone(currentUser);
  const displayAddress = getGeneratorAddress(currentUser);
  const displayType = getGeneratorTypeLabel(
    currentUser?.role,
    currentUser?.generator?.type
  );
  const accessStatus = currentUser?.generator?.accessStatus || null;
  const accessReleased = currentUser?.generator?.accessReleased;

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#FFFFFF",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color="#028C56" />
        <Text style={{ marginTop: 10, color: "#6B7280" }}>
          Carregando perfil...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#F8FAFC" }}
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
          paddingTop: 28,
          paddingBottom: 28,
          paddingHorizontal: 20,
          borderBottomLeftRadius: 26,
          borderBottomRightRadius: 26,
        }}
      >
        <View style={{ alignItems: "center" }}>
          <View
            style={{
              width: 92,
              height: 92,
              borderRadius: 46,
              backgroundColor: "rgba(255,255,255,0.18)",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 14,
            }}
          >
            <Ionicons name="business-outline" size={44} color="#FFFFFF" />
          </View>

          <Text
            style={{
              fontSize: 24,
              fontWeight: "800",
              color: "#FFFFFF",
              textAlign: "center",
            }}
          >
            {displayName}
          </Text>

          <Text
            style={{
              fontSize: 14,
              color: "#E8FFF1",
              marginTop: 4,
              textAlign: "center",
            }}
          >
            {displayType}
          </Text>

          <View
            style={{
              marginTop: 12,
              backgroundColor: getAccessStatusColor(accessStatus),
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 20,
            }}
          >
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 12,
                fontWeight: "700",
              }}
            >
              {getAccessStatusLabel(accessStatus)}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <View style={{ padding: 16 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 16,
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

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <MetricCard
            title="Coletas concluídas"
            value={String(metrics.completedCollections)}
            icon="checkmark-done-outline"
          />

          <MetricCard
            title="Total coletado"
            value={`${metrics.totalKg.toFixed(1)} kg`}
            icon="leaf-outline"
          />
        </View>

        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 18,
            padding: 18,
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: "#111827",
              marginBottom: 14,
            }}
          >
            Informações da conta
          </Text>

          <InfoRow icon="mail-outline" label="E-mail" value={displayEmail} />
          <InfoRow icon="call-outline" label="Telefone" value={displayPhone} />
          <InfoRow
            icon="location-outline"
            label="Endereço"
            value={displayAddress}
          />
          <InfoRow
            icon="business-outline"
            label="Empresa"
            value={currentUser?.generator?.companyName || "-"}
          />
          <InfoRow
            icon="person-outline"
            label="Responsável"
            value={currentUser?.generator?.name || displayName}
            isLast
          />
        </View>

        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 18,
            padding: 18,
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: "#111827",
              marginBottom: 14,
            }}
          >
            Resumo operacional
          </Text>

          <InfoRow
            icon="calendar-clear-outline"
            label="Última coleta registrada"
            value={formatDate(metrics.lastCollectionDate)}
          />
          <InfoRow
            icon="stats-chart-outline"
            label="Tipo de conta"
            value={displayType}
          />
          <InfoRow
            icon="shield-checkmark-outline"
            label="Situação de acesso"
            value={getAccessStatusLabel(accessStatus)}
          />
          <InfoRow
            icon="checkmark-circle-outline"
            label="Acesso liberado"
            value={accessReleased ? "Sim" : "Não"}
          />
          <InfoRow
            icon="leaf-outline"
            label="Total no gerador"
            value={`${metrics.totalKg.toFixed(1)} kg`}
            isLast
          />
        </View>

        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 18,
            padding: 18,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: "#111827",
              marginBottom: 14,
            }}
          >
            Ações rápidas
          </Text>

          <QuickAction
            icon="create-outline"
            title="Editar perfil"
            subtitle="Atualize as informações da sua conta"
            onPress={() => router.push("/(gerador)/edit-profile" as any)}
          />

          <QuickAction
            icon="calendar-outline"
            title="Solicitar coleta"
            subtitle="Criar um novo agendamento para a cooperativa"
            onPress={() => router.push("/(gerador)/schedule" as any)}
          />

          <QuickAction
            icon="pie-chart-outline"
            title="Ver impacto"
            subtitle="Acompanhe o percentual e os resultados ambientais"
            onPress={() => router.push("/(gerador)/percentual" as any)}
          />

          <QuickAction
            icon="chatbubble-outline"
            title="Enviar feedback"
            subtitle="Compartilhe sua experiência com a operação"
            onPress={() => router.push("/(gerador)/feedback" as any)}
            isLast
          />
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
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        padding: 16,
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
          marginBottom: 12,
        }}
      >
        <Ionicons name={icon} size={20} color="#15803D" />
      </View>

      <Text style={{ fontSize: 13, color: "#6B7280" }}>{title}</Text>
      <Text
        style={{
          fontSize: 21,
          fontWeight: "800",
          color: "#111827",
          marginTop: 4,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
  isLast = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        paddingBottom: isLast ? 0 : 14,
        marginBottom: isLast ? 0 : 14,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: "#E5E7EB",
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: "#F3F4F6",
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        }}
      >
        <Ionicons name={icon} size={18} color="#4B5563" />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12, color: "#6B7280", marginBottom: 3 }}>
          {label}
        </Text>
        <Text style={{ fontSize: 15, color: "#111827", fontWeight: "600" }}>
          {value || "-"}
        </Text>
      </View>
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