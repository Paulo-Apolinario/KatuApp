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
import { useAuth } from "@/src/contexts/AuthContext";
import { useConnectivity } from "@/src/hooks/useConnectivity";
import { collectionService } from "@/src/services/collectionService";
import type {
  Collection,
  CollectionMaterial,
  CollectionStatus,
  WasteUnit,
} from "@/src/types/collection";

type PeriodFilter = "TODAY" | "WEEK" | "MONTH";

type MaterialRankingItem = {
  material: string;
  quantityKg: number;
  percentage: number;
};

type TimelineItem = {
  id: string;
  title: string;
  subtitle: string;
  date: string | null;
  icon: keyof typeof Ionicons.glyphMap;
  completed: boolean;
};

const COLLECTED_STATUSES: CollectionStatus[] = [
  "COLLECTED",
  "RECEIVED",
  "SORTING",
  "COMPLETED",
];

const STATUS_ORDER: CollectionStatus[] = [
  "PENDING",
  "IN_PROGRESS",
  "COLLECTED",
  "RECEIVED",
  "SORTING",
  "COMPLETED",
  "CANCELLED",
];

function safeNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatDate(date?: string | null) {
  if (!date) return "-";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleDateString("pt-BR");
}

function formatDateTime(date?: string | null) {
  if (!date) return "-";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(date?: string | null) {
  if (!date) return "--:--";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "--:--";
  }

  return parsed.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatUnit(unit?: WasteUnit | null) {
  switch (unit) {
    case "TON":
      return "t";
    case "LITER":
      return "L";
    case "UNIT":
      return "un";
    case "CUBIC_METER":
      return "m³";
    case "KG":
    default:
      return "kg";
  }
}

function quantityToKg(quantity: number, unit?: WasteUnit | null) {
  if (unit === "TON") {
    return quantity * 1000;
  }

  if (!unit || unit === "KG") {
    return quantity;
  }

  return 0;
}

function normalizeMaterials(materials: unknown): CollectionMaterial[] {
  if (!Array.isArray(materials)) {
    return [];
  }

  return materials
    .map((item): CollectionMaterial | null => {
      if (typeof item === "string") {
        const type = item.trim();

        if (!type) {
          return null;
        }

        return {
          type,
          name: type,
          quantity: 0,
          quantityKg: 0,
          unit: "KG",
        };
      }

      if (!item || typeof item !== "object") {
        return null;
      }

      const material = item as Record<string, unknown>;

      const type = String(
        material.name ??
          material.type ??
          material.nameSnapshot ??
          material.materialNameSnapshot ??
          "Não informado"
      ).trim();

      const unit = String(material.unit || "KG").toUpperCase() as WasteUnit;

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
          typeof material.wasteTypeId === "string"
            ? material.wasteTypeId
            : null,
        type,
        name: type,
        category:
          typeof material.category === "string"
            ? material.category
            : typeof material.categorySnapshot === "string"
              ? material.categorySnapshot
              : null,
        subcategory:
          typeof material.subcategory === "string"
            ? material.subcategory
            : typeof material.subcategorySnapshot === "string"
              ? material.subcategorySnapshot
              : null,
        quantity,
        quantityKg,
        unit,
        notes:
          typeof material.notes === "string"
            ? material.notes
            : null,
      };
    })
    .filter((item): item is CollectionMaterial => item !== null);
}

function getCollectionMaterials(collection: Collection) {
  const directMaterials = normalizeMaterials(collection.materials);

  if (directMaterials.length > 0) {
    return directMaterials;
  }

  const normalizedCollectionMaterials = normalizeMaterials(
    collection.collectionMaterials
  );

  if (normalizedCollectionMaterials.length > 0) {
    return normalizedCollectionMaterials;
  }

  return normalizeMaterials(collection.collectionWasteEntries);
}

function getCollectionTotalKg(collection: Collection) {
  const explicitWeight = safeNumber(collection.totalWeightKg);

  if (explicitWeight > 0) {
    return explicitWeight;
  }

  return getCollectionMaterials(collection).reduce((sum, item) => {
    if (safeNumber(item.quantityKg) > 0) {
      return sum + safeNumber(item.quantityKg);
    }

    return sum + quantityToKg(
      safeNumber(item.quantity),
      item.unit || "KG"
    );
  }, 0);
}

function getCollectionReferenceDate(collection: Collection) {
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

function getSourceName(collection: Collection) {
  if (collection.generator?.companyName) {
    return collection.generator.companyName;
  }

  if (collection.generator?.name) {
    return collection.generator.name;
  }

  if (collection.schedule?.generator?.companyName) {
    return collection.schedule.generator.companyName;
  }

  if (collection.schedule?.generator?.name) {
    return collection.schedule.generator.name;
  }

  if (collection.schedule?.requestedBy?.displayName) {
    return collection.schedule.requestedBy.displayName;
  }

  if (collection.schedule?.requestedBy?.email) {
    return collection.schedule.requestedBy.email;
  }

  return "Origem não identificada";
}

function getAddress(collection: Collection) {
  return (
    collection.generator?.address ||
    collection.schedule?.generator?.address ||
    "-"
  );
}

function getMaterialsLabel(materials: CollectionMaterial[]) {
  if (materials.length === 0) {
    return "-";
  }

  return materials
    .map((item) => {
      const quantity =
        safeNumber(item.quantity) ||
        safeNumber(item.quantityKg);

      return `${item.name || item.type || "Material"} (${quantity.toFixed(
        1
      )} ${formatUnit(item.unit)})`;
    })
    .join(", ");
}

function translateStatus(status: CollectionStatus) {
  switch (status) {
    case "PENDING":
      return "Pendente";
    case "IN_PROGRESS":
      return "Em coleta";
    case "COLLECTED":
      return "Coletada";
    case "RECEIVED":
      return "Recebida";
    case "SORTING":
      return "Em triagem";
    case "COMPLETED":
      return "Concluída";
    case "CANCELLED":
      return "Cancelada";
    default:
      return status;
  }
}

function getStatusIcon(
  status: CollectionStatus
): keyof typeof Ionicons.glyphMap {
  switch (status) {
    case "PENDING":
      return "time-outline";
    case "IN_PROGRESS":
      return "navigate-outline";
    case "COLLECTED":
      return "bag-check-outline";
    case "RECEIVED":
      return "download-outline";
    case "SORTING":
      return "git-compare-outline";
    case "COMPLETED":
      return "checkmark-done-outline";
    case "CANCELLED":
      return "close-circle-outline";
    default:
      return "ellipse-outline";
  }
}

function getStatusColor(status: CollectionStatus) {
  switch (status) {
    case "PENDING":
      return "#64748B";
    case "IN_PROGRESS":
      return "#D97706";
    case "COLLECTED":
      return "#0284C7";
    case "RECEIVED":
      return "#2563EB";
    case "SORTING":
      return "#7C3AED";
    case "COMPLETED":
      return "#15803D";
    case "CANCELLED":
      return "#DC2626";
    default:
      return "#64748B";
  }
}

function getPeriodStart(period: PeriodFilter) {
  const now = new Date();
  const start = new Date(now);

  if (period === "TODAY") {
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (period === "WEEK") {
    const day = start.getDay();
    const distanceToMonday = day === 0 ? 6 : day - 1;

    start.setDate(start.getDate() - distanceToMonday);
    start.setHours(0, 0, 0, 0);

    return start;
  }

  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  return start;
}

function isCollectionInsidePeriod(
  collection: Collection,
  period: PeriodFilter
) {
  const referenceDate = getCollectionReferenceDate(collection);

  if (!referenceDate) {
    return false;
  }

  const parsed = new Date(referenceDate);

  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return parsed.getTime() >= getPeriodStart(period).getTime();
}

function buildTimeline(collection: Collection | null): TimelineItem[] {
  if (!collection) {
    return [];
  }

  const items: TimelineItem[] = [
    {
      id: "created",
      title: "Coleta delegada",
      subtitle: "A cooperativa encaminhou esta coleta para execução.",
      date: collection.createdAt || null,
      icon: "clipboard-outline",
      completed: true,
    },
    {
      id: "started",
      title: "Coleta iniciada",
      subtitle: "O atendimento em campo foi iniciado.",
      date: collection.startedAt || null,
      icon: "navigate-outline",
      completed:
        STATUS_ORDER.indexOf(collection.status) >=
          STATUS_ORDER.indexOf("IN_PROGRESS") &&
        collection.status !== "CANCELLED",
    },
    {
      id: "collected",
      title: "Etapa de campo concluída",
      subtitle: "Os materiais coletados foram registrados.",
      date: collection.collectedAt || null,
      icon: "bag-check-outline",
      completed:
        COLLECTED_STATUSES.includes(collection.status) ||
        collection.status === "COMPLETED",
    },
    {
      id: "received",
      title: "Recebimento confirmado",
      subtitle: "A cooperativa confirmou a chegada dos materiais.",
      date: collection.receivedAt || null,
      icon: "download-outline",
      completed:
        collection.status === "RECEIVED" ||
        collection.status === "SORTING" ||
        collection.status === "COMPLETED",
    },
    {
      id: "sorting",
      title: "Triagem iniciada",
      subtitle: "Os materiais entraram no processo de triagem.",
      date: collection.sortingStartedAt || null,
      icon: "git-compare-outline",
      completed:
        collection.status === "SORTING" ||
        collection.status === "COMPLETED",
    },
    {
      id: "completed",
      title: "Coleta concluída",
      subtitle: "Todo o ciclo operacional foi finalizado.",
      date: collection.completedAt || null,
      icon: "checkmark-done-outline",
      completed: collection.status === "COMPLETED",
    },
  ];

  if (collection.status === "CANCELLED") {
    return [
      ...items.filter((item) => item.completed),
      {
        id: "cancelled",
        title: "Coleta cancelada",
        subtitle:
          collection.cancellationReason ||
          "A coleta foi encerrada antes da conclusão.",
        date: collection.cancelledAt || null,
        icon: "close-circle-outline",
        completed: true,
      },
    ];
  }

  return items;
}

export default function CollectorDashboardScreen() {
  const { signOut } = useAuth();
  const { isOffline } = useConnectivity();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [period, setPeriod] = useState<PeriodFilter>("MONTH");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  const loadCollections = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      }

      const response = await collectionService.list();

      const normalized = Array.isArray(response)
        ? response.map((item) => ({
            ...item,
            materials: getCollectionMaterials(item),
            totalWeightKg: getCollectionTotalKg(item),
          }))
        : [];

      setCollections(normalized);
      setLastSyncAt(new Date().toISOString());
    } catch (error) {
      console.error(
        "Erro ao carregar dashboard do catador:",
        error
      );
      setCollections([]);
    } finally {
      if (showLoader) {
        setLoading(false);
      }

      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadCollections(true);
    }, [loadCollections])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCollections(false);
  }, [loadCollections]);

  const handleSignOut = useCallback(async () => {
    await signOut();
  }, [signOut]);

  const metrics = useMemo(() => {
    const counts = STATUS_ORDER.reduce(
      (acc, status) => {
        acc[status] = collections.filter(
          (item) => item.status === status
        ).length;

        return acc;
      },
      {} as Record<CollectionStatus, number>
    );

    const collectedCollections = collections.filter((item) =>
      COLLECTED_STATUSES.includes(item.status)
    );

    const periodCollections = collectedCollections.filter((item) =>
      isCollectionInsidePeriod(item, period)
    );

    const totalKg = periodCollections.reduce(
      (acc, item) => acc + getCollectionTotalKg(item),
      0
    );

    const sortedCollectedCollections = [...collectedCollections].sort(
      (a, b) => {
        const aDate = getCollectionReferenceDate(a);
        const bDate = getCollectionReferenceDate(b);

        const aTime = aDate ? new Date(aDate).getTime() : 0;
        const bTime = bDate ? new Date(bDate).getTime() : 0;

        return bTime - aTime;
      }
    );

    const lastCollection =
      sortedCollectedCollections[0] || null;

    const materialsMap: Record<string, number> = {};

    periodCollections.forEach((collection) => {
      getCollectionMaterials(collection).forEach((material) => {
        const materialName =
          material.name?.trim() ||
          material.type?.trim() ||
          "Não informado";

        const quantityKg =
          safeNumber(material.quantityKg) ||
          quantityToKg(
            safeNumber(material.quantity),
            material.unit || "KG"
          );

        materialsMap[materialName] =
          (materialsMap[materialName] || 0) +
          quantityKg;
      });
    });

    const totalRankedKg = Object.values(materialsMap).reduce(
      (sum, quantityKg) => sum + quantityKg,
      0
    );

    const topMaterials: MaterialRankingItem[] = Object.entries(
      materialsMap
    )
      .map(([material, quantityKg]) => ({
        material,
        quantityKg,
        percentage:
          totalRankedKg > 0
            ? (quantityKg / totalRankedKg) * 100
            : 0,
      }))
      .sort((a, b) => b.quantityKg - a.quantityKg)
      .slice(0, 5);

    const recentCollections = [...collections]
      .sort((a, b) => {
        const aDate = getCollectionReferenceDate(a);
        const bDate = getCollectionReferenceDate(b);

        const aTime = aDate ? new Date(aDate).getTime() : 0;
        const bTime = bDate ? new Date(bDate).getTime() : 0;

        return bTime - aTime;
      })
      .slice(0, 5);

    const activeCollection =
      collections.find(
        (item) => item.status === "IN_PROGRESS"
      ) ||
      collections.find(
        (item) => item.status === "PENDING"
      ) ||
      lastCollection;

    return {
      counts,
      totalKg,
      lastCollection,
      topMaterials,
      recentCollections,
      activeCollection,
      timeline: buildTimeline(activeCollection),
      periodCollectionCount: periodCollections.length,
    };
  }, [collections, period]);

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
        <ActivityIndicator
          size="large"
          color="#028C56"
        />

        <Text
          style={{
            marginTop: 10,
            color: "#6B7280",
          }}
        >
          Carregando dashboard...
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#F3F4F6",
      }}
    >
      <OfflineBanner visible={isOffline} />

      <ScrollView
        style={{
          flex: 1,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 30,
        }}
      >
        <LinearGradient
          colors={["#16A34A", "#22C55E"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            paddingTop: 28,
            paddingBottom: 28,
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
            <View
              style={{
                flex: 1,
                paddingRight: 12,
              }}
            >
              <Text
                style={{
                  color: "#E8FFF1",
                  fontSize: 14,
                }}
              >
                Painel operacional
              </Text>

              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 29,
                  fontWeight: "800",
                  marginTop: 5,
                }}
              >
                Dashboard do Catador
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleSignOut}
              style={{
                backgroundColor:
                  "rgba(255,255,255,0.18)",
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 8,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <Ionicons
                name="log-out-outline"
                size={18}
                color="#FFFFFF"
              />

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
              color: "#E8FFF1",
              fontSize: 15,
              marginTop: 10,
              lineHeight: 22,
            }}
          >
            Acompanhe suas coletas desde a delegação até a conclusão
            operacional pela cooperativa.
          </Text>

          <View
            style={{
              marginTop: 16,
              alignSelf: "flex-start",
            }}
          >
            <LastSyncBadge
              value={lastSyncAt}
            />
          </View>
        </LinearGradient>

        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 18,
          }}
        >
          <SectionHeader
            title="Ciclo das coletas"
            subtitle="Quantidade de coletas em cada etapa operacional"
          />

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "space-between",
            }}
          >
            <StatusCard
              title="Pendentes"
              value={metrics.counts.PENDING}
              status="PENDING"
            />

            <StatusCard
              title="Em coleta"
              value={metrics.counts.IN_PROGRESS}
              status="IN_PROGRESS"
            />

            <StatusCard
              title="Realizadas"
              value={metrics.counts.COLLECTED}
              status="COLLECTED"
            />

            <StatusCard
              title="Recebidas"
              value={metrics.counts.RECEIVED}
              status="RECEIVED"
            />

            <StatusCard
              title="Em triagem"
              value={metrics.counts.SORTING}
              status="SORTING"
            />

            <StatusCard
              title="Concluídas"
              value={metrics.counts.COMPLETED}
              status="COMPLETED"
            />

            <StatusCard
              title="Canceladas"
              value={metrics.counts.CANCELLED}
              status="CANCELLED"
              fullWidth
            />
          </View>

          <SectionHeader
            title="Indicadores de desempenho"
            subtitle="Resultados calculados para o período selecionado"
          />

          <PeriodSelector
            value={period}
            onChange={setPeriod}
          />

          <View
            style={{
              marginTop: 12,
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "space-between",
            }}
          >
            <MetricCard
              title="Peso coletado"
              value={`${metrics.totalKg.toFixed(1)} kg`}
              icon="leaf-outline"
            />

            <MetricCard
              title="Coletas no período"
              value={String(
                metrics.periodCollectionCount
              )}
              icon="checkmark-circle-outline"
            />

            <MetricCard
              title="Tipos de materiais"
              value={String(
                metrics.topMaterials.length
              )}
              icon="albums-outline"
            />

            <MetricCard
              title="Em atendimento"
              value={String(
                metrics.counts.PENDING +
                  metrics.counts.IN_PROGRESS
              )}
              icon="trail-sign-outline"
            />
          </View>

          <SectionHeader
            title="Última coleta realizada"
            subtitle="Último registro concluído em campo"
          />

          <View style={sectionCard}>
            {metrics.lastCollection ? (
              <>
                <InfoRow
                  label="Gerador ou origem"
                  value={getSourceName(
                    metrics.lastCollection
                  )}
                />

                <InfoRow
                  label="Endereço"
                  value={getAddress(
                    metrics.lastCollection
                  )}
                />

                <InfoRow
                  label="Data"
                  value={formatDateTime(
                    getCollectionReferenceDate(
                      metrics.lastCollection
                    )
                  )}
                />

                <InfoRow
                  label="Status atual"
                  value={translateStatus(
                    metrics.lastCollection.status
                  )}
                />

                <InfoRow
                  label="Peso"
                  value={`${getCollectionTotalKg(
                    metrics.lastCollection
                  ).toFixed(1)} kg`}
                />

                <InfoRow
                  label="Materiais"
                  value={getMaterialsLabel(
                    getCollectionMaterials(
                      metrics.lastCollection
                    )
                  )}
                  isLast
                />
              </>
            ) : (
              <EmptyState
                icon="bag-check-outline"
                title="Nenhuma coleta realizada"
                subtitle="Assim que você concluir a primeira etapa de campo, ela aparecerá aqui."
              />
            )}
          </View>

          <SectionHeader
            title="Resíduos mais coletados"
            subtitle="Ranking por peso no período selecionado"
          />

          <View style={sectionCard}>
            {metrics.topMaterials.length > 0 ? (
              metrics.topMaterials.map(
                (item, index) => (
                  <MaterialRankingRow
                    key={item.material}
                    position={index + 1}
                    item={item}
                    isLast={
                      index ===
                      metrics.topMaterials.length - 1
                    }
                  />
                )
              )
            ) : (
              <EmptyState
                icon="cube-outline"
                title="Sem materiais registrados"
                subtitle="Os materiais aparecerão aqui conforme as coletas forem concluídas."
              />
            )}
          </View>

          <SectionHeader
            title="Linha do tempo operacional"
            subtitle={
              metrics.activeCollection
                ? `Coleta de ${getSourceName(
                    metrics.activeCollection
                  )}`
                : "Etapas da coleta selecionada"
            }
          />

          <View style={sectionCard}>
            {metrics.timeline.length > 0 ? (
              metrics.timeline.map(
                (item, index) => (
                  <TimelineRow
                    key={item.id}
                    item={item}
                    isLast={
                      index ===
                      metrics.timeline.length - 1
                    }
                  />
                )
              )
            ) : (
              <EmptyState
                icon="git-branch-outline"
                title="Nenhuma coleta para acompanhar"
                subtitle="Quando houver uma coleta delegada, sua evolução aparecerá aqui."
              />
            )}
          </View>

          <SectionHeader
            title="Coletas recentes"
            subtitle="Últimos registros da sua operação"
          />

          <View style={sectionCard}>
            {metrics.recentCollections.length > 0 ? (
              metrics.recentCollections.map(
                (item, index) => (
                  <RecentCollectionCard
                    key={item.id}
                    collection={item}
                    isLast={
                      index ===
                      metrics.recentCollections.length - 1
                    }
                  />
                )
              )
            ) : (
              <EmptyState
                icon="time-outline"
                title="Nenhuma coleta recente"
                subtitle="As coletas registradas aparecerão aqui."
              />
            )}
          </View>

          <SectionHeader
            title="Ações rápidas"
            subtitle="Acesse as principais funções do catador"
          />

          <View style={sectionCard}>
            <QuickAction
              icon="play-circle-outline"
              title="Executar coletas"
              subtitle="Abrir coletas pendentes e em andamento"
              onPress={() =>
                router.push("/(catador)/collect")
              }
            />

            <QuickAction
              icon="map-outline"
              title="Ver mapa operacional"
              subtitle="Consultar localização e rotas disponíveis"
              onPress={() =>
                router.push("/(catador)/mapas")
              }
            />

            <QuickAction
              icon="refresh-outline"
              title="Atualizar dados"
              subtitle={
                isOffline
                  ? "Atualizar informações salvas no dispositivo"
                  : "Buscar dados atualizados no servidor"
              }
              onPress={onRefresh}
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
    </View>
  );
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View
      style={{
        marginTop: 20,
        marginBottom: 10,
      }}
    >
      <Text
        style={{
          fontSize: 18,
          fontWeight: "800",
          color: "#111827",
        }}
      >
        {title}
      </Text>

      {subtitle ? (
        <Text
          style={{
            fontSize: 13,
            color: "#6B7280",
            lineHeight: 19,
            marginTop: 3,
          }}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

function StatusCard({
  title,
  value,
  status,
  fullWidth = false,
}: {
  title: string;
  value: number;
  status: CollectionStatus;
  fullWidth?: boolean;
}) {
  const color = getStatusColor(status);

  return (
    <View
      style={{
        width: fullWidth ? "100%" : "48.5%",
        minHeight: 112,
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        padding: 15,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        marginBottom: 12,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: `${color}18`,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons
            name={getStatusIcon(status)}
            size={21}
            color={color}
          />
        </View>

        <Text
          style={{
            fontSize: 25,
            fontWeight: "900",
            color,
          }}
        >
          {value}
        </Text>
      </View>

      <Text
        style={{
          fontSize: 14,
          color: "#374151",
          fontWeight: "700",
          marginTop: 12,
        }}
      >
        {title}
      </Text>
    </View>
  );
}

function PeriodSelector({
  value,
  onChange,
}: {
  value: PeriodFilter;
  onChange: (period: PeriodFilter) => void;
}) {
  const options: {
    value: PeriodFilter;
    label: string;
  }[] = [
    {
      value: "TODAY",
      label: "Hoje",
    },
    {
      value: "WEEK",
      label: "Semana",
    },
    {
      value: "MONTH",
      label: "Mês",
    },
  ];

  return (
    <View
      style={{
        backgroundColor: "#E5E7EB",
        borderRadius: 14,
        padding: 4,
        flexDirection: "row",
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <TouchableOpacity
            key={option.value}
            activeOpacity={0.85}
            onPress={() =>
              onChange(option.value)
            }
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 10,
              borderRadius: 11,
              backgroundColor: selected
                ? "#FFFFFF"
                : "transparent",
            }}
          >
            <Text
              style={{
                color: selected
                  ? "#15803D"
                  : "#6B7280",
                fontWeight: selected
                  ? "800"
                  : "600",
                fontSize: 13,
              }}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
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
        minHeight: 132,
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        marginBottom: 12,
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
        <Ionicons
          name={icon}
          size={20}
          color="#15803D"
        />
      </View>

      <Text
        style={{
          fontSize: 13,
          color: "#6B7280",
        }}
      >
        {title}
      </Text>

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
      <Text
        style={{
          fontSize: 12,
          color: "#6B7280",
          marginBottom: 4,
        }}
      >
        {label}
      </Text>

      <Text
        style={{
          fontSize: 15,
          color: "#111827",
          fontWeight: "600",
          lineHeight: 21,
        }}
      >
        {value || "-"}
      </Text>
    </View>
  );
}

function MaterialRankingRow({
  position,
  item,
  isLast,
}: {
  position: number;
  item: MaterialRankingItem;
  isLast: boolean;
}) {
  return (
    <View
      style={{
        paddingBottom: isLast ? 0 : 14,
        marginBottom: isLast ? 0 : 14,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: "#E5E7EB",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: "#DCFCE7",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 10,
          }}
        >
          <Text
            style={{
              color: "#15803D",
              fontWeight: "900",
            }}
          >
            {position}
          </Text>
        </View>

        <View
          style={{
            flex: 1,
          }}
        >
          <Text
            style={{
              color: "#111827",
              fontWeight: "700",
              fontSize: 15,
            }}
          >
            {item.material}
          </Text>

          <Text
            style={{
              color: "#6B7280",
              fontSize: 12,
              marginTop: 2,
            }}
          >
            {item.quantityKg.toFixed(1)} kg
          </Text>
        </View>

        <Text
          style={{
            color: "#15803D",
            fontWeight: "900",
            fontSize: 15,
          }}
        >
          {item.percentage.toFixed(0)}%
        </Text>
      </View>

      <View
        style={{
          height: 7,
          borderRadius: 999,
          backgroundColor: "#E5E7EB",
          marginTop: 10,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${Math.min(
              item.percentage,
              100
            )}%`,
            height: "100%",
            borderRadius: 999,
            backgroundColor: "#22C55E",
          }}
        />
      </View>
    </View>
  );
}

function TimelineRow({
  item,
  isLast,
}: {
  item: TimelineItem;
  isLast: boolean;
}) {
  const color = item.completed
    ? "#15803D"
    : "#9CA3AF";

  return (
    <View
      style={{
        flexDirection: "row",
        minHeight: 74,
      }}
    >
      <View
        style={{
          width: 44,
          alignItems: "center",
        }}
      >
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: item.completed
              ? "#DCFCE7"
              : "#F3F4F6",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2,
          }}
        >
          <Ionicons
            name={item.icon}
            size={18}
            color={color}
          />
        </View>

        {!isLast ? (
          <View
            style={{
              width: 2,
              flex: 1,
              backgroundColor: item.completed
                ? "#86EFAC"
                : "#E5E7EB",
            }}
          />
        ) : null}
      </View>

      <View
        style={{
          flex: 1,
          paddingLeft: 10,
          paddingBottom: isLast ? 0 : 18,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text
            style={{
              color: item.completed
                ? "#111827"
                : "#6B7280",
              fontWeight: "800",
              fontSize: 15,
              flex: 1,
              paddingRight: 8,
            }}
          >
            {item.title}
          </Text>

          <Text
            style={{
              color: "#6B7280",
              fontSize: 12,
              fontWeight: "600",
            }}
          >
            {item.date
              ? formatTime(item.date)
              : "Pendente"}
          </Text>
        </View>

        <Text
          style={{
            color: "#6B7280",
            fontSize: 13,
            lineHeight: 19,
            marginTop: 4,
          }}
        >
          {item.subtitle}
        </Text>

        {item.date ? (
          <Text
            style={{
              color: "#9CA3AF",
              fontSize: 11,
              marginTop: 4,
            }}
          >
            {formatDate(item.date)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function RecentCollectionCard({
  collection,
  isLast,
}: {
  collection: Collection;
  isLast: boolean;
}) {
  const color = getStatusColor(
    collection.status
  );
  const materials =
    getCollectionMaterials(collection);

  return (
    <View
      style={{
        paddingBottom: isLast ? 0 : 14,
        marginBottom: isLast ? 0 : 14,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: "#E5E7EB",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
        }}
      >
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: `${color}18`,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 11,
          }}
        >
          <Ionicons
            name={getStatusIcon(
              collection.status
            )}
            size={20}
            color={color}
          />
        </View>

        <View
          style={{
            flex: 1,
          }}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: "800",
              color: "#111827",
            }}
          >
            {getSourceName(collection)}
          </Text>

          <Text
            style={{
              fontSize: 13,
              color,
              fontWeight: "700",
              marginTop: 3,
            }}
          >
            {translateStatus(
              collection.status
            )}
          </Text>

          <Text
            style={{
              fontSize: 13,
              color: "#6B7280",
              marginTop: 5,
            }}
          >
            {formatDateTime(
              getCollectionReferenceDate(
                collection
              )
            )}
          </Text>

          {COLLECTED_STATUSES.includes(
            collection.status
          ) ? (
            <Text
              style={{
                fontSize: 13,
                color: "#4B5563",
                marginTop: 5,
                fontWeight: "600",
              }}
            >
              Peso:{" "}
              {getCollectionTotalKg(
                collection
              ).toFixed(1)}{" "}
              kg
            </Text>
          ) : null}

          {materials.length > 0 ? (
            <Text
              numberOfLines={2}
              style={{
                fontSize: 12,
                color: "#6B7280",
                lineHeight: 18,
                marginTop: 5,
              }}
            >
              Materiais:{" "}
              {getMaterialsLabel(materials)}
            </Text>
          ) : null}
        </View>
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
        <Ionicons
          name={icon}
          size={20}
          color="#15803D"
        />
      </View>

      <View
        style={{
          flex: 1,
        }}
      >
        <Text
          style={{
            fontSize: 15,
            fontWeight: "700",
            color: "#111827",
          }}
        >
          {title}
        </Text>

        <Text
          style={{
            fontSize: 13,
            color: "#6B7280",
            marginTop: 2,
            lineHeight: 18,
          }}
        >
          {subtitle}
        </Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={20}
        color="#9CA3AF"
      />
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
        alignItems: "center",
        paddingVertical: 28,
      }}
    >
      <Ionicons
        name={icon}
        size={42}
        color="#9CA3AF"
      />

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

const sectionCard = {
  backgroundColor: "#FFFFFF",
  borderRadius: 18,
  padding: 16,
  borderWidth: 1,
  borderColor: "#E5E7EB",
} as const;
