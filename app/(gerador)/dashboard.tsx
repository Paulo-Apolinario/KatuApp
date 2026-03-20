import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { collectionService } from "@/src/services/collectionService";
import { scheduleService } from "@/src/services/scheduleService";

/**
 * =========================
 * Tipos locais defensivos
 * =========================
 */

type ScheduleStatus =
  | "REQUESTED"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

type CollectionStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

type ScheduleItem = {
  id: string;
  scheduledDate: string;
  requestedMaterials?: string[] | string | null;
  notes?: string | null;
  status: ScheduleStatus;
  cooperativeId?: string | null;
  generatorId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type CollectionItem = {
  id: string;
  scheduleId?: string | null;
  generatorId?: string | null;
  collectorId?: string | null;
  cooperativeId?: string | null;
  weightKg?: number | null;
  totalKg?: number | null;
  kgCollected?: number | null;
  status: CollectionStatus;
  createdAt?: string;
  updatedAt?: string;
  schedule?: {
    id: string;
    scheduledDate?: string;
    requestedMaterials?: string[] | string | null;
  } | null;
};

type DashboardMetrics = {
  totalKg: number;
  totalCollectionsCompleted: number;
  pendingSchedules: number;
  nextSchedules: ScheduleItem[];
  recentCollections: CollectionItem[];
};

/**
 * =========================
 * Helpers
 * =========================
 */

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractArray<T = unknown>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];

  if (isObject(payload)) {
    if (Array.isArray(payload.data)) return payload.data as T[];
    if (Array.isArray(payload.items)) return payload.items as T[];
    if (Array.isArray(payload.results)) return payload.results as T[];
  }

  return [];
}

function parseNumber(value: unknown): number {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function getCollectionKg(collection: CollectionItem): number {
  return (
    parseNumber(collection.weightKg) ||
    parseNumber(collection.totalKg) ||
    parseNumber(collection.kgCollected) ||
    0
  );
}

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

function translateScheduleStatus(status: ScheduleStatus): string {
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

function translateCollectionStatus(status: CollectionStatus): string {
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

function normalizeRequestedMaterials(
  value?: string[] | string | null
): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * =========================
 * Componente
 * =========================
 */

export default function GeneratorDashboard() {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [collections, setCollections] = useState<CollectionItem[]>([]);
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

      const scheduleItems = extractArray<ScheduleItem>(schedulesResponse);
      const collectionItems = extractArray<CollectionItem>(collectionsResponse);

      setSchedules(scheduleItems);
      setCollections(collectionItems);
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

  const metrics: DashboardMetrics = useMemo(() => {
    const totalKg = collections
      .filter((item) => item.status === "COMPLETED")
      .reduce((sum, item) => sum + getCollectionKg(item), 0);

    const totalCollectionsCompleted = collections.filter(
      (item) => item.status === "COMPLETED"
    ).length;

    const pendingSchedules = schedules.filter(
      (item) => item.status === "REQUESTED" || item.status === "SCHEDULED"
    ).length;

    const now = new Date();

    const nextSchedules = [...schedules]
      .filter(
        (item) =>
          item.status !== "COMPLETED" &&
          item.status !== "CANCELLED" &&
          new Date(item.scheduledDate).getTime() >=
            new Date(now.setHours(0, 0, 0, 0)).getTime()
      )
      .sort(
        (a, b) =>
          new Date(a.scheduledDate).getTime() -
          new Date(b.scheduledDate).getTime()
      )
      .slice(0, 5);

    const recentCollections = [...collections]
      .sort((a, b) => {
        const aDate = new Date(a.createdAt ?? 0).getTime();
        const bDate = new Date(b.createdAt ?? 0).getTime();
        return bDate - aDate;
      })
      .slice(0, 5);

    return {
      totalKg,
      totalCollectionsCompleted,
      pendingSchedules,
      nextSchedules,
      recentCollections,
    };
  }, [collections, schedules]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <ActivityIndicator size="large" color="#16a34a" />
        <Text className="mt-4 text-base text-gray-600">
          Carregando dashboard...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
      }
      contentContainerStyle={{ paddingBottom: 32 }}
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
        <Text style={{ color: "#fff", fontSize: 14, opacity: 0.9 }}>
          Dashboard do Gerador
        </Text>
        <Text
          style={{
            color: "#fff",
            fontSize: 28,
            fontWeight: "700",
            marginTop: 4,
          }}
        >
          Acompanhe suas coletas
        </Text>

        <View
          style={{
            flexDirection: "row",
            gap: 12,
            marginTop: 18,
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
            <Ionicons name="calendar-outline" size={18} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "600" }}>
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
            <Ionicons name="refresh-outline" size={18} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "600" }}>
              Atualizar
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View className="px-4 pt-5">
        {errorMessage ? (
          <View className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4">
            <Text className="font-semibold text-red-700">Erro</Text>
            <Text className="mt-1 text-red-600">{errorMessage}</Text>

            <TouchableOpacity
              onPress={() => loadDashboard(true)}
              className="mt-3 self-start rounded-xl bg-red-600 px-4 py-2"
            >
              <Text className="font-semibold text-white">Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View className="flex-row flex-wrap justify-between">
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
            title="Agendamentos pendentes"
            value={`${metrics.pendingSchedules}`}
            icon="time-outline"
          />
        </View>

        <SectionHeader
          title="Próximos agendamentos"
          actionLabel="Ver agenda"
          onPress={() => router.push("/(gerador)/schedule")}
        />

        <View className="rounded-2xl bg-white p-4 shadow-sm">
          {metrics.nextSchedules.length === 0 ? (
            <EmptyState
              icon="calendar-clear-outline"
              title="Nenhum agendamento próximo"
              subtitle="Quando você criar um novo agendamento, ele aparecerá aqui."
            />
          ) : (
            metrics.nextSchedules.map((schedule) => {
              const materials = normalizeRequestedMaterials(
                schedule.requestedMaterials
              );

              return (
                <View
                  key={schedule.id}
                  className="mb-3 rounded-2xl border border-slate-100 bg-slate-50 p-4"
                >
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-3">
                      <Text className="text-base font-bold text-slate-800">
                        {formatDateTime(schedule.scheduledDate)}
                      </Text>

                      <Text className="mt-1 text-sm text-slate-500">
                        Status: {translateScheduleStatus(schedule.status)}
                      </Text>

                      {materials.length > 0 ? (
                        <Text className="mt-2 text-sm text-slate-700">
                          Materiais: {materials.join(", ")}
                        </Text>
                      ) : null}

                      {schedule.notes ? (
                        <Text className="mt-2 text-sm text-slate-600">
                          Observações: {schedule.notes}
                        </Text>
                      ) : null}
                    </View>

                    <View className="rounded-full bg-green-100 px-3 py-1">
                      <Text className="text-xs font-bold text-green-700">
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
          actionLabel="Atualizar"
          onPress={onRefresh}
        />

        <View className="rounded-2xl bg-white p-4 shadow-sm">
          {metrics.recentCollections.length === 0 ? (
            <EmptyState
              icon="cube-outline"
              title="Nenhuma coleta encontrada"
              subtitle="As coletas executadas aparecerão aqui assim que forem registradas."
            />
          ) : (
            metrics.recentCollections.map((collection) => {
              const kg = getCollectionKg(collection);
              const materials = normalizeRequestedMaterials(
                collection.schedule?.requestedMaterials
              );

              return (
                <View
                  key={collection.id}
                  className="mb-3 rounded-2xl border border-slate-100 bg-slate-50 p-4"
                >
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-3">
                      <Text className="text-base font-bold text-slate-800">
                        {collection.schedule?.scheduledDate
                          ? formatDateTime(collection.schedule.scheduledDate)
                          : formatDate(collection.createdAt)}
                      </Text>

                      <Text className="mt-1 text-sm text-slate-500">
                        Status: {translateCollectionStatus(collection.status)}
                      </Text>

                      <Text className="mt-2 text-sm font-semibold text-slate-700">
                        Total coletado: {kg.toFixed(1)} kg
                      </Text>

                      {materials.length > 0 ? (
                        <Text className="mt-2 text-sm text-slate-600">
                          Materiais: {materials.join(", ")}
                        </Text>
                      ) : null}
                    </View>

                    <View className="rounded-full bg-emerald-100 px-3 py-1">
                      <Text className="text-xs font-bold text-emerald-700">
                        {translateCollectionStatus(collection.status)}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View className="mt-5 rounded-2xl bg-white p-4 shadow-sm">
          <Text className="text-lg font-bold text-slate-800">
            Resumo rápido
          </Text>

          <View className="mt-4 gap-3">
            <QuickAction
              icon="calendar-outline"
              title="Solicitar nova coleta"
              subtitle="Crie um novo agendamento para materiais recicláveis"
              onPress={() => router.push("/(gerador)/schedule")}
            />

            <QuickAction
              icon="stats-chart-outline"
              title="Atualizar dashboard"
              subtitle="Recarregar seus agendamentos e coletas"
              onPress={onRefresh}
            />

            <QuickAction
              icon="information-circle-outline"
              title="Ver histórico"
              subtitle="Acompanhe suas coletas e evolução ambiental"
              onPress={() => {
                Alert.alert(
                  "Histórico",
                  "A próxima etapa pode ligar este botão à tela de histórico do gerador."
                );
              }}
            />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

/**
 * =========================
 * Componentes auxiliares
 * =========================
 */

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
    <View className="mb-3 w-[48.5%] rounded-2xl bg-white p-4 shadow-sm">
      <View className="mb-3 h-11 w-11 items-center justify-center rounded-full bg-green-100">
        <Ionicons name={icon} size={22} color="#15803d" />
      </View>

      <Text className="text-sm text-slate-500">{title}</Text>
      <Text className="mt-1 text-xl font-bold text-slate-800">{value}</Text>
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
    <View className="mb-3 mt-5 flex-row items-center justify-between">
      <Text className="text-lg font-bold text-slate-800">{title}</Text>

      {actionLabel && onPress ? (
        <TouchableOpacity onPress={onPress}>
          <Text className="font-semibold text-green-700">{actionLabel}</Text>
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
    <View className="items-center justify-center rounded-2xl py-8">
      <View className="h-14 w-14 items-center justify-center rounded-full bg-slate-100">
        <Ionicons name={icon} size={28} color="#64748b" />
      </View>
      <Text className="mt-3 text-base font-bold text-slate-700">{title}</Text>
      <Text className="mt-1 px-6 text-center text-sm text-slate-500">
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
      className="flex-row items-center rounded-2xl border border-slate-100 bg-slate-50 p-4"
    >
      <View className="mr-4 h-12 w-12 items-center justify-center rounded-full bg-green-100">
        <Ionicons name={icon} size={22} color="#15803d" />
      </View>

      <View className="flex-1">
        <Text className="text-base font-bold text-slate-800">{title}</Text>
        <Text className="mt-1 text-sm text-slate-500">{subtitle}</Text>
      </View>

      <Ionicons name="chevron-forward" size={20} color="#64748b" />
    </TouchableOpacity>
  );
}