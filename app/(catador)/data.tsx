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

import { OfflineBanner } from "@/src/components/OfflineBanner";
import { LastSyncBadge } from "@/src/components/LastSyncBadge";
import { useConnectivity } from "@/src/hooks/useConnectivity";
import { useNotification } from "@/src/contexts/NotificationContext";
import {
  collectionService,
  type Collection,
  type CollectionMaterial,
  type WasteUnit,
} from "@/src/services/collectionService";

type CollectionStatus = Collection["status"];
type PeriodFilter = "TODAY" | "WEEK" | "MONTH" | "ALL";
type StatusFilter = "ALL" | CollectionStatus;

type MaterialSummary = {
  name: string;
  quantityKg: number;
  percentage: number;
};

type EvolutionItem = {
  key: string;
  label: string;
  quantityKg: number;
};

const REALIZED_STATUSES: CollectionStatus[] = [
  "COLLECTED",
  "RECEIVED",
  "SORTING",
  "COMPLETED",
];

function safeNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeUnit(value: unknown): WasteUnit {
  const normalized = String(value || "KG").trim().toUpperCase();
  const valid: WasteUnit[] = ["KG", "TON", "LITER", "UNIT", "CUBIC_METER"];
  return valid.includes(normalized as WasteUnit)
    ? (normalized as WasteUnit)
    : "KG";
}

function quantityToKg(quantity: number, unit?: WasteUnit | null) {
  if (unit === "TON") return quantity * 1000;
  if (!unit || unit === "KG") return quantity;
  return 0;
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeMaterials(value: unknown): CollectionMaterial[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): CollectionMaterial | null => {
      if (typeof item === "string") {
        const name = item.trim();
        return name
          ? { type: name, name, quantity: 0, quantityKg: 0, unit: "KG" }
          : null;
      }

      if (!item || typeof item !== "object") return null;
      const material = item as Record<string, unknown>;
      const name = String(
        material.name ??
          material.type ??
          material.nameSnapshot ??
          material.materialNameSnapshot ??
          "Material"
      ).trim();
      const unit = normalizeUnit(material.unit);
      const quantity =
        material.quantity !== undefined
          ? safeNumber(material.quantity)
          : material.collectedQuantity !== undefined
            ? safeNumber(material.collectedQuantity)
            : safeNumber(material.quantityKg);
      const quantityKg =
        material.quantityKg !== undefined
          ? safeNumber(material.quantityKg)
          : quantityToKg(quantity, unit);

      return {
        wasteTypeId:
          typeof material.wasteTypeId === "string" ? material.wasteTypeId : null,
        type: name,
        name,
        category: typeof material.category === "string" ? material.category : null,
        subcategory:
          typeof material.subcategory === "string" ? material.subcategory : null,
        quantity,
        quantityKg,
        unit,
        notes: typeof material.notes === "string" ? material.notes : null,
      };
    })
    .filter((item): item is CollectionMaterial => item !== null);
}

function getCollectionMaterials(collection: Collection) {
  const direct = normalizeMaterials(collection.materials);
  if (direct.length > 0) return direct;

  const normalized = normalizeMaterials(collection.collectionMaterials);
  if (normalized.length > 0) return normalized;

  return normalizeMaterials(collection.collectionWasteEntries);
}

function getCollectionTotalKg(collection: Collection) {
  const explicit = safeNumber(collection.totalWeightKg);
  if (explicit > 0) return explicit;

  return getCollectionMaterials(collection).reduce((sum, material) => {
    const quantityKg = safeNumber(material.quantityKg);
    return (
      sum +
      (quantityKg > 0
        ? quantityKg
        : quantityToKg(safeNumber(material.quantity), material.unit || "KG"))
    );
  }, 0);
}

function getSourceName(collection: Collection) {
  const generator = collection.generator ?? collection.schedule?.generator ?? null;
  return (
    generator?.companyName ||
    generator?.businessName ||
    generator?.name ||
    collection.schedule?.requestedBy?.displayName ||
    collection.schedule?.requestedBy?.email ||
    "Origem não identificada"
  );
}

function getReferenceDate(collection: Collection) {
  return (
    collection.collectedAt ||
    collection.completedAt ||
    collection.receivedAt ||
    collection.sortingStartedAt ||
    collection.startedAt ||
    collection.createdAt ||
    null
  );
}

function translateStatus(status: CollectionStatus) {
  const labels: Record<CollectionStatus, string> = {
    PENDING: "Pendente",
    IN_PROGRESS: "Em andamento",
    COLLECTED: "Coletada",
    RECEIVED: "Recebida",
    SORTING: "Em triagem",
    COMPLETED: "Concluída",
    CANCELLED: "Cancelada",
  };
  return labels[status] || status;
}

function getStatusColor(status: CollectionStatus) {
  const colors: Record<CollectionStatus, string> = {
    PENDING: "#64748B",
    IN_PROGRESS: "#D97706",
    COLLECTED: "#0284C7",
    RECEIVED: "#2563EB",
    SORTING: "#7C3AED",
    COMPLETED: "#15803D",
    CANCELLED: "#DC2626",
  };
  return colors[status] || "#64748B";
}

function getStatusIcon(status: CollectionStatus): keyof typeof Ionicons.glyphMap {
  const icons: Record<CollectionStatus, keyof typeof Ionicons.glyphMap> = {
    PENDING: "time-outline",
    IN_PROGRESS: "navigate-outline",
    COLLECTED: "bag-check-outline",
    RECEIVED: "download-outline",
    SORTING: "git-compare-outline",
    COMPLETED: "checkmark-done-outline",
    CANCELLED: "close-circle-outline",
  };
  return icons[status] || "ellipse-outline";
}

function getPeriodStart(period: PeriodFilter) {
  const start = new Date();

  if (period === "TODAY") {
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (period === "WEEK") {
    const day = start.getDay();
    start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (period === "MONTH") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  return new Date(0);
}

function isInsidePeriod(collection: Collection, period: PeriodFilter) {
  if (period === "ALL") return true;
  const referenceDate = getReferenceDate(collection);
  if (!referenceDate) return false;
  const parsed = new Date(referenceDate);
  return !Number.isNaN(parsed.getTime()) && parsed >= getPeriodStart(period);
}

export default function DataScreen() {
  const { isOffline } = useConnectivity();
  const { notifyError } = useNotification();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("MONTH");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  const loadCollections = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) setLoading(true);
        const response = await collectionService.list();
        setCollections(Array.isArray(response) ? response : []);
        setLastSyncAt(new Date().toISOString());
      } catch (error) {
        console.error("Erro ao carregar dados do catador:", error);
        notifyError("Erro", "Não foi possível carregar os dados do catador.");
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
      void loadCollections(true);
    }, [loadCollections])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCollections(false);
  }, [loadCollections]);

  const metrics = useMemo(() => {
    const periodCollections = collections.filter((item) =>
      isInsidePeriod(item, periodFilter)
    );

    const realizedCollections = periodCollections.filter((item) =>
      REALIZED_STATUSES.includes(item.status)
    );

    const filteredCollections = periodCollections
      .filter((item) => statusFilter === "ALL" || item.status === statusFilter)
      .sort((a, b) => {
        const aDate = getReferenceDate(a);
        const bDate = getReferenceDate(b);
        return (bDate ? new Date(bDate).getTime() : 0) -
          (aDate ? new Date(aDate).getTime() : 0);
      });

    const totalKg = realizedCollections.reduce(
      (sum, item) => sum + getCollectionTotalKg(item),
      0
    );

    const averageKg =
      realizedCollections.length > 0 ? totalKg / realizedCollections.length : 0;

    const materialMap: Record<string, number> = {};
    realizedCollections.forEach((collection) => {
      getCollectionMaterials(collection).forEach((material) => {
        const name = material.name?.trim() || material.type?.trim() || "Não informado";
        const quantityKg =
          safeNumber(material.quantityKg) ||
          quantityToKg(safeNumber(material.quantity), material.unit || "KG");
        materialMap[name] = (materialMap[name] || 0) + quantityKg;
      });
    });

    const totalMaterialKg = Object.values(materialMap).reduce(
      (sum, value) => sum + value,
      0
    );

    const materials: MaterialSummary[] = Object.entries(materialMap)
      .map(([name, quantityKg]) => ({
        name,
        quantityKg,
        percentage: totalMaterialKg > 0 ? (quantityKg / totalMaterialKg) * 100 : 0,
      }))
      .sort((a, b) => b.quantityKg - a.quantityKg);

    const evolutionMap: Record<string, number> = {};
    realizedCollections.forEach((collection) => {
      const date = getReferenceDate(collection);
      if (!date) return;
      const parsed = new Date(date);
      if (Number.isNaN(parsed.getTime())) return;
      const key = parsed.toISOString().slice(0, 10);
      evolutionMap[key] =
        (evolutionMap[key] || 0) + getCollectionTotalKg(collection);
    });

    const evolution: EvolutionItem[] = Object.entries(evolutionMap)
      .map(([key, quantityKg]) => ({
        key,
        label: new Date(`${key}T12:00:00`).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        }),
        quantityKg,
      }))
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-10);

    return {
      totalKg,
      averageKg,
      realizedCount: realizedCollections.length,
      materialCount: materials.length,
      materials,
      evolution,
      filteredCollections,
    };
  }, [collections, periodFilter, statusFilter]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#028C56" />
        <Text style={styles.loadingText}>Carregando dados...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.screen}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 30 }}
      >
        <LinearGradient
          colors={["#16A34A", "#22C55E"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.header}
        >
          <View style={styles.headerRow}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.back()}
              style={styles.headerIconButton}
            >
              <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>DADOS DO CATADOR</Text>
              <Text style={styles.headerSubtitle}>
                Histórico, desempenho e materiais coletados
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => void onRefresh()}
              style={styles.headerIconButton}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="refresh-outline" size={22} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          <OfflineBanner visible={isOffline} />
          <View style={{ marginTop: 12 }}>
            <LastSyncBadge value={lastSyncAt} />
          </View>

          <SectionHeader
            title="Período"
            subtitle="Escolha o intervalo usado nos indicadores"
          />
          <PeriodSelector value={periodFilter} onChange={setPeriodFilter} />

          <SectionHeader
            title="Indicadores"
            subtitle="Resumo das coletas realizadas no período"
          />
          <View style={styles.grid}>
            <MetricCard
              title="Total coletado"
              value={`${metrics.totalKg.toFixed(1)} kg`}
              icon="scale-outline"
            />
            <MetricCard
              title="Coletas realizadas"
              value={String(metrics.realizedCount)}
              icon="checkmark-circle-outline"
            />
            <MetricCard
              title="Média por coleta"
              value={`${metrics.averageKg.toFixed(1)} kg`}
              icon="stats-chart-outline"
            />
            <MetricCard
              title="Tipos de materiais"
              value={String(metrics.materialCount)}
              icon="albums-outline"
            />
          </View>

          <SectionHeader
            title="Evolução do peso"
            subtitle="Últimos dias com coletas registradas"
          />
          <View style={styles.card}>
            {metrics.evolution.length > 0 ? (
              <EvolutionChart items={metrics.evolution} />
            ) : (
              <EmptyState
                icon="analytics-outline"
                title="Sem dados de evolução"
                subtitle="As barras aparecerão após o registro das primeiras coletas."
              />
            )}
          </View>

          <SectionHeader
            title="Materiais mais coletados"
            subtitle="Participação de cada material no peso total"
          />
          <View style={styles.card}>
            {metrics.materials.length > 0 ? (
              metrics.materials.map((item, index) => (
                <MaterialRow
                  key={item.name}
                  item={item}
                  position={index + 1}
                  isLast={index === metrics.materials.length - 1}
                />
              ))
            ) : (
              <EmptyState
                icon="cube-outline"
                title="Sem materiais registrados"
                subtitle="Os materiais aparecerão aqui conforme as coletas forem realizadas."
              />
            )}
          </View>

          <SectionHeader
            title="Histórico de coletas"
            subtitle="Filtre e consulte seus registros operacionais"
          />
          <StatusSelector value={statusFilter} onChange={setStatusFilter} />

          <View style={[styles.card, { marginTop: 12 }]}>
            {metrics.filteredCollections.length > 0 ? (
              metrics.filteredCollections.map((collection, index) => (
                <HistoryCard
                  key={collection.id}
                  collection={collection}
                  isLast={index === metrics.filteredCollections.length - 1}
                />
              ))
            ) : (
              <EmptyState
                icon="clipboard-outline"
                title="Nenhuma coleta encontrada"
                subtitle="Não há registros correspondentes aos filtros selecionados."
              />
            )}
          </View>

          <SectionHeader
            title="Ações rápidas"
            subtitle="Acesse os demais módulos do catador"
          />
          <View style={styles.card}>
            <QuickAction
              icon="grid-outline"
              title="Resumo operacional"
              subtitle="Consultar o dashboard completo"
              onPress={() => router.push("/(catador)/dashboard")}
            />
            <QuickAction
              icon="map-outline"
              title="Mapa operacional"
              subtitle="Visualizar rotas e coletas no mapa"
              onPress={() => router.push("/(catador)/mapas")}
            />
            <QuickAction
              icon="trash-outline"
              title="Executar coleta"
              subtitle="Abrir coletas pendentes e em andamento"
              onPress={() => router.push("/(catador)/collect")}
              isLast
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ marginTop: 20, marginBottom: 10 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function PeriodSelector({
  value,
  onChange,
}: {
  value: PeriodFilter;
  onChange: (value: PeriodFilter) => void;
}) {
  const options: { value: PeriodFilter; label: string }[] = [
    { value: "TODAY", label: "Hoje" },
    { value: "WEEK", label: "Semana" },
    { value: "MONTH", label: "Mês" },
    { value: "ALL", label: "Tudo" },
  ];

  return (
    <View style={styles.segmentedControl}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            activeOpacity={0.85}
            onPress={() => onChange(option.value)}
            style={[styles.segmentButton, selected && styles.segmentButtonActive]}
          >
            <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function StatusSelector({
  value,
  onChange,
}: {
  value: StatusFilter;
  onChange: (value: StatusFilter) => void;
}) {
  const options: { value: StatusFilter; label: string }[] = [
    { value: "ALL", label: "Todos" },
    { value: "PENDING", label: "Pendentes" },
    { value: "IN_PROGRESS", label: "Em andamento" },
    { value: "COLLECTED", label: "Coletadas" },
    { value: "RECEIVED", label: "Recebidas" },
    { value: "SORTING", label: "Triagem" },
    { value: "COMPLETED", label: "Concluídas" },
    { value: "CANCELLED", label: "Canceladas" },
  ];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            activeOpacity={0.85}
            onPress={() => onChange(option.value)}
            style={[styles.filterChip, selected && styles.filterChipActive]}
          >
            <Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
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
    <View style={styles.metricCard}>
      <View style={styles.metricIcon}>
        <Ionicons name={icon} size={20} color="#15803D" />
      </View>
      <Text style={styles.metricTitle}>{title}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function EvolutionChart({ items }: { items: EvolutionItem[] }) {
  const maxValue = Math.max(...items.map((item) => item.quantityKg), 1);
  return (
    <View>
      {items.map((item, index) => {
        const percentage = (item.quantityKg / maxValue) * 100;
        return (
          <View key={item.key} style={{ marginBottom: index === items.length - 1 ? 0 : 14 }}>
            <View style={styles.chartLabelRow}>
              <Text style={styles.chartLabel}>{item.label}</Text>
              <Text style={styles.chartValue}>{item.quantityKg.toFixed(1)} kg</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.max(percentage, 3)}%` }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function MaterialRow({
  item,
  position,
  isLast,
}: {
  item: MaterialSummary;
  position: number;
  isLast: boolean;
}) {
  return (
    <View style={[styles.listRow, isLast && styles.listRowLast]}>
      <View style={styles.rankCircle}>
        <Text style={styles.rankText}>{position}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.materialName}>{item.name}</Text>
        <Text style={styles.materialWeight}>{item.quantityKg.toFixed(1)} kg</Text>
        <View style={[styles.progressTrack, { marginTop: 8 }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(item.percentage, 100)}%` },
            ]}
          />
        </View>
      </View>
      <Text style={styles.materialPercent}>{item.percentage.toFixed(0)}%</Text>
    </View>
  );
}

function HistoryCard({
  collection,
  isLast,
}: {
  collection: Collection;
  isLast: boolean;
}) {
  const color = getStatusColor(collection.status);
  const materials = getCollectionMaterials(collection);

  return (
    <View style={[styles.historyCard, isLast && styles.historyCardLast]}>
      <View style={styles.historyHeader}>
        <View style={[styles.statusIcon, { backgroundColor: `${color}18` }]}>
          <Ionicons name={getStatusIcon(collection.status)} size={21} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.historyTitle}>{getSourceName(collection)}</Text>
          <Text style={[styles.historyStatus, { color }]}>
            {translateStatus(collection.status)}
          </Text>
        </View>
        <Text style={styles.historyWeight}>
          {getCollectionTotalKg(collection).toFixed(1)} kg
        </Text>
      </View>

      <Text style={styles.historyText}>
        Data: {formatDateTime(getReferenceDate(collection))}
      </Text>
      {collection.route?.name ? (
        <Text style={styles.historyText}>Rota: {collection.route.name}</Text>
      ) : null}
      {materials.length > 0 ? (
        <Text style={styles.historyText}>
          Materiais: {materials.map((item) => item.name || item.type).join(", ")}
        </Text>
      ) : null}

      <View style={styles.historyActions}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() =>
            router.push({
              pathname: "/(catador)/collect",
              params: { collectionId: collection.id },
            })
          }
          style={styles.historyActionGreen}
        >
          <Ionicons name="eye-outline" size={16} color="#15803D" />
          <Text style={styles.historyActionGreenText}>Ver coleta</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() =>
            router.push({
              pathname: "/(catador)/mapas",
              params: { collectionId: collection.id },
            })
          }
          style={styles.historyActionBlue}
        >
          <Ionicons name="map-outline" size={16} color="#2563EB" />
          <Text style={styles.historyActionBlueText}>Ver mapa</Text>
        </TouchableOpacity>
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
      style={[styles.quickAction, isLast && styles.quickActionLast]}
    >
      <View style={styles.quickActionIcon}>
        <Ionicons name={icon} size={20} color="#15803D" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.quickActionTitle}>{title}</Text>
        <Text style={styles.quickActionSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
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
    <View style={styles.emptyState}>
      <Ionicons name={icon} size={42} color="#9CA3AF" />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = {
  screen: { flex: 1, backgroundColor: "#F3F4F6" } as const,
  loadingContainer: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  } as const,
  loadingText: { marginTop: 10, color: "#6B7280" } as const,
  header: {
    paddingTop: 48,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  } as const,
  headerRow: { flexDirection: "row", alignItems: "center" } as const,
  headerIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 6,
  } as const,
  headerTitle: { fontSize: 23, fontWeight: "900", color: "#FFFFFF" } as const,
  headerSubtitle: {
    fontSize: 13,
    color: "#E8FFF1",
    marginTop: 4,
    lineHeight: 18,
  } as const,
  content: { paddingHorizontal: 16, paddingTop: 14 } as const,
  sectionTitle: { fontSize: 18, fontWeight: "800", color: "#111827" } as const,
  sectionSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 19,
    marginTop: 3,
  } as const,
  segmentedControl: {
    backgroundColor: "#E5E7EB",
    borderRadius: 14,
    padding: 4,
    flexDirection: "row",
  } as const,
  segmentButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 11,
  } as const,
  segmentButtonActive: { backgroundColor: "#FFFFFF" } as const,
  segmentText: { color: "#6B7280", fontWeight: "600", fontSize: 12 } as const,
  segmentTextActive: { color: "#15803D", fontWeight: "800" } as const,
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  } as const,
  metricCard: {
    width: "48.5%",
    minHeight: 132,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
  } as const,
  metricIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  } as const,
  metricTitle: { fontSize: 13, color: "#6B7280" } as const,
  metricValue: { marginTop: 4, fontSize: 21, fontWeight: "800", color: "#111827" } as const,
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  } as const,
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    marginRight: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  } as const,
  filterChipActive: { backgroundColor: "#15803D", borderColor: "#15803D" } as const,
  filterChipText: { color: "#475569", fontWeight: "800", fontSize: 13 } as const,
  filterChipTextActive: { color: "#FFFFFF" } as const,
  chartLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  } as const,
  chartLabel: { color: "#475569", fontSize: 13, fontWeight: "700" } as const,
  chartValue: { color: "#15803D", fontSize: 13, fontWeight: "900" } as const,
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
    overflow: "hidden",
  } as const,
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: "#22C55E" } as const,
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 14,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  } as const,
  listRowLast: { paddingBottom: 0, marginBottom: 0, borderBottomWidth: 0 } as const,
  rankCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  } as const,
  rankText: { color: "#15803D", fontWeight: "900" } as const,
  materialName: { color: "#111827", fontWeight: "700", fontSize: 15 } as const,
  materialWeight: { color: "#6B7280", fontSize: 12, marginTop: 2 } as const,
  materialPercent: { color: "#15803D", fontWeight: "900", fontSize: 15, marginLeft: 10 } as const,
  historyCard: {
    paddingBottom: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  } as const,
  historyCardLast: { paddingBottom: 0, marginBottom: 0, borderBottomWidth: 0 } as const,
  historyHeader: { flexDirection: "row", alignItems: "flex-start" } as const,
  statusIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  } as const,
  historyTitle: { fontSize: 16, fontWeight: "800", color: "#111827" } as const,
  historyStatus: { fontSize: 13, fontWeight: "800", marginTop: 4 } as const,
  historyWeight: { color: "#15803D", fontWeight: "900", fontSize: 15 } as const,
  historyText: { color: "#6B7280", fontSize: 13, marginTop: 8, lineHeight: 19 } as const,
  historyActions: { flexDirection: "row", marginTop: 12, gap: 10 } as const,
  historyActionGreen: {
    flex: 1,
    backgroundColor: "#ECFDF5",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#86EFAC",
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  } as const,
  historyActionGreenText: { color: "#15803D", fontWeight: "800", fontSize: 13, marginLeft: 6 } as const,
  historyActionBlue: {
    flex: 1,
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  } as const,
  historyActionBlueText: { color: "#2563EB", fontWeight: "800", fontSize: 13, marginLeft: 6 } as const,
  quickAction: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 14,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  } as const,
  quickActionLast: { paddingBottom: 0, marginBottom: 0, borderBottomWidth: 0 } as const,
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  } as const,
  quickActionTitle: { fontSize: 15, fontWeight: "700", color: "#111827" } as const,
  quickActionSubtitle: { fontSize: 13, color: "#6B7280", marginTop: 2, lineHeight: 18 } as const,
  emptyState: { alignItems: "center", paddingVertical: 28 } as const,
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#374151", marginTop: 10 } as const,
  emptySubtitle: { fontSize: 14, color: "#6B7280", textAlign: "center", marginTop: 6, lineHeight: 20 } as const,
};
