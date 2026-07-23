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
import { useNotification } from "@/src/contexts/NotificationContext";
import { useConnectivity } from "@/src/hooks/useConnectivity";
import {
  collectionService,
  type Collection,
  type CollectionMaterial,
  type WasteUnit,
} from "@/src/services/collectionService";

type CollectionStatus = Collection["status"];

type EnvironmentalMetrics = {
  co2AvoidedKg: number;
  treesEquivalent: number;
  waterSavedLiters: number;
  energySavedKwh: number;
};

const COLLECTED_STATUSES: CollectionStatus[] = [
  "COLLECTED",
  "RECEIVED",
  "SORTING",
  "COMPLETED",
];

function safeNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatDateTime(dateString?: string | null) {
  if (!dateString) return "-";

  const parsed = new Date(dateString);

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

function formatTime(dateString?: string | null) {
  if (!dateString) return "-";

  const parsed = new Date(dateString);

  if (Number.isNaN(parsed.getTime())) {
    return "-";
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

function normalizeMaterials(value: unknown): CollectionMaterial[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item): CollectionMaterial | null => {
      if (typeof item === "string") {
        const name = item.trim();

        if (!name) {
          return null;
        }

        return {
          type: name,
          name,
          quantity: 0,
          quantityKg: 0,
          unit: "KG",
        };
      }

      if (!item || typeof item !== "object") {
        return null;
      }

      const material = item as Record<string, unknown>;

      const name = String(
        material.name ??
          material.type ??
          material.nameSnapshot ??
          material.materialNameSnapshot ??
          "Material"
      ).trim();

      const unit = String(
        material.unit || "KG"
      ).toUpperCase() as WasteUnit;

      const quantity =
        material.quantity !== undefined
          ? safeNumber(material.quantity)
          : material.estimatedQuantity !== undefined
            ? safeNumber(material.estimatedQuantity)
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
        type: name,
        name,
        category:
          typeof material.category === "string"
            ? material.category
            : null,
        subcategory:
          typeof material.subcategory === "string"
            ? material.subcategory
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
  const collectedMaterials = normalizeMaterials(
    collection.materials
  );

  if (collectedMaterials.length > 0) {
    return collectedMaterials;
  }

  const requestedMaterials = normalizeMaterials(
    collection.schedule?.requestedMaterials
  );

  if (requestedMaterials.length > 0) {
    return requestedMaterials;
  }

  return normalizeMaterials(
    collection.collectionMaterials
  );
}

function getCollectionTotalKg(collection: Collection) {
  const explicitWeight = safeNumber(
    collection.totalWeightKg
  );

  if (explicitWeight > 0) {
    return explicitWeight;
  }

  return getCollectionMaterials(collection).reduce(
    (sum, material) => {
      if (safeNumber(material.quantityKg) > 0) {
        return (
          sum + safeNumber(material.quantityKg)
        );
      }

      return (
        sum +
        quantityToKg(
          safeNumber(material.quantity),
          material.unit || "KG"
        )
      );
    },
    0
  );
}

function getCollectionGenerator(collection: Collection) {
  return (
    collection.generator ??
    collection.schedule?.generator ??
    null
  );
}

function getSourceName(collection: Collection) {
  const generator = getCollectionGenerator(collection);

  if (generator?.companyName) {
    return generator.companyName;
  }

  if (generator?.businessName) {
    return generator.businessName;
  }

  if (generator?.name) {
    return generator.name;
  }

  if (
    collection.schedule?.requestedBy?.displayName
  ) {
    return collection.schedule.requestedBy.displayName;
  }

  if (collection.schedule?.requestedBy?.email) {
    return collection.schedule.requestedBy.email;
  }

  return "Origem não identificada";
}

function getAddress(collection: Collection) {
  return (
    getCollectionGenerator(collection)?.address ||
    "-"
  );
}

function getReferenceDate(collection: Collection) {
  return (
    collection.schedule?.scheduledDate ||
    collection.schedule?.preferredDate ||
    collection.startedAt ||
    collection.collectedAt ||
    collection.createdAt ||
    null
  );
}

function formatMaterials(materials: CollectionMaterial[]) {
  if (materials.length === 0) {
    return "Não informado";
  }

  return materials
    .map((item) => {
      const quantity =
        safeNumber(item.quantity) ||
        safeNumber(item.quantityKg);

      return `${item.name || item.type || "Material"}${
        quantity > 0
          ? ` • ${quantity.toFixed(1)} ${formatUnit(
              item.unit
            )}`
          : ""
      }`;
    })
    .join("\n");
}

function translateStatus(status: CollectionStatus) {
  switch (status) {
    case "PENDING":
      return "Pendente";
    case "IN_PROGRESS":
      return "Em rota";
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

function isToday(dateString?: string | null) {
  if (!dateString) {
    return false;
  }

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function calculateEnvironmentalMetrics(
  totalKg: number
): EnvironmentalMetrics {
  return {
    co2AvoidedKg: totalKg * 1.5,
    treesEquivalent: totalKg / 100,
    waterSavedLiters: totalKg * 35,
    energySavedKwh: totalKg * 2.3,
  };
}

export default function HomeCatScreen() {
  const { signOut } = useAuth();
  const { isOffline } = useConnectivity();
  const { notifyError } = useNotification();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [collections, setCollections] =
    useState<Collection[]>([]);
  const [lastSyncAt, setLastSyncAt] =
    useState<string | null>(null);

  const loadCollections = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) {
          setLoading(true);
        }

        const data =
          await collectionService.list();

        setCollections(
          Array.isArray(data) ? data : []
        );
        setLastSyncAt(new Date().toISOString());
      } catch (error) {
        console.error(
          "Erro ao carregar painel do catador:",
          error
        );
        notifyError(
          "Erro",
          "Não foi possível carregar o painel do catador."
        );
        setCollections([]);
      } finally {
        if (showLoader) {
          setLoading(false);
        }

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

  const handleSignOut = useCallback(async () => {
    await signOut();
  }, [signOut]);

  const metrics = useMemo(() => {
    const pendingCollections =
      collections.filter(
        (item) => item.status === "PENDING"
      );

    const inProgressCollections =
      collections.filter(
        (item) =>
          item.status === "IN_PROGRESS"
      );

    const collectedCollections =
      collections.filter((item) =>
        COLLECTED_STATUSES.includes(
          item.status
        )
      );

    const todayCollectedCollections =
      collectedCollections.filter((item) =>
        isToday(
          item.collectedAt ||
            item.completedAt ||
            item.createdAt
        )
      );

    const totalCollectedTodayKg =
      todayCollectedCollections.reduce(
        (sum, item) =>
          sum + getCollectionTotalKg(item),
        0
      );

    const activeOperation =
      inProgressCollections[0] ||
      pendingCollections[0] ||
      null;

    const nextCollections = [
      ...pendingCollections,
      ...inProgressCollections,
    ]
      .sort((a, b) => {
        if (
          a.status === "IN_PROGRESS" &&
          b.status !== "IN_PROGRESS"
        ) {
          return -1;
        }

        if (
          b.status === "IN_PROGRESS" &&
          a.status !== "IN_PROGRESS"
        ) {
          return 1;
        }

        const aTime = getReferenceDate(a)
          ? new Date(
              getReferenceDate(a) as string
            ).getTime()
          : Number.MAX_SAFE_INTEGER;

        const bTime = getReferenceDate(b)
          ? new Date(
              getReferenceDate(b) as string
            ).getTime()
          : Number.MAX_SAFE_INTEGER;

        return aTime - bTime;
      })
      .slice(0, 5);

    const recentCollections = [
      ...collectedCollections,
    ]
      .sort((a, b) => {
        const aDate =
          a.collectedAt ||
          a.completedAt ||
          a.createdAt ||
          "";

        const bDate =
          b.collectedAt ||
          b.completedAt ||
          b.createdAt ||
          "";

        return (
          new Date(bDate).getTime() -
          new Date(aDate).getTime()
        );
      })
      .slice(0, 4);

    const environmental =
      calculateEnvironmentalMetrics(
        totalCollectedTodayKg
      );

    const totalCollectedAllTimeKg =
      collectedCollections.reduce(
        (sum, item) =>
          sum + getCollectionTotalKg(item),
        0
      );

    const uniqueWorkDays = new Set(
      collectedCollections
        .map(
          (item) =>
            item.collectedAt ||
            item.completedAt ||
            item.createdAt
        )
        .filter(Boolean)
        .map((date) =>
          new Date(date as string).toDateString()
        )
    ).size;

    const dailyAverageKg =
      uniqueWorkDays > 0
        ? totalCollectedAllTimeKg /
          uniqueWorkDays
        : 0;

    return {
      pendingCollections,
      inProgressCollections,
      collectedCollections,
      todayCollectedCollections,
      totalCollectedTodayKg,
      activeOperation,
      nextCollections,
      recentCollections,
      environmental,
      totalCollectedAllTimeKg,
      uniqueWorkDays,
      dailyAverageKg,
    };
  }, [collections]);

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
            marginTop: 12,
            color: "#6B7280",
          }}
        >
          Carregando painel...
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
          paddingBottom: 28,
        }}
      >
        <LinearGradient
          colors={["#16A34A", "#22C55E"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            paddingTop: 30,
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
                flexDirection: "row",
                alignItems: "center",
                flex: 1,
              }}
            >
              <View
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 27,
                  backgroundColor:
                    "rgba(255,255,255,0.18)",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                }}
              >
                <Ionicons
                  name="person-outline"
                  size={28}
                  color="#FFFFFF"
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: "#E8FFF1",
                    fontSize: 13,
                  }}
                >
                  Centro operacional
                </Text>

                <Text
                  style={{
                    color: "#FFFFFF",
                    fontSize: 25,
                    fontWeight: "900",
                    marginTop: 3,
                  }}
                >
                  Painel do Catador
                </Text>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginTop: 7,
                  }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor:
                        metrics.inProgressCollections
                          .length > 0
                          ? "#FDE68A"
                          : "#BBF7D0",
                      marginRight: 6,
                    }}
                  />

                  <Text
                    style={{
                      color: "#E8FFF1",
                      fontSize: 13,
                      fontWeight: "700",
                    }}
                  >
                    {metrics.inProgressCollections
                      .length > 0
                      ? "Em rota"
                      : "Disponível"}
                  </Text>
                </View>
              </View>
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
                marginLeft: 8,
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
              marginTop: 14,
              lineHeight: 22,
            }}
          >
            Consulte sua próxima coleta, rota do dia, desempenho e ações rápidas em um único lugar.
          </Text>

          <View
            style={{
              flexDirection: "row",
              marginTop: 18,
            }}
          >
            <HeaderActionButton
              icon="trash-outline"
              label="Executar coleta"
              onPress={() =>
                router.push(
                  "/(catador)/collect"
                )
              }
              style={{
                flex: 1,
                marginRight: 10,
              }}
            />

            <HeaderActionButton
              icon="map-outline"
              label="Mapa"
              onPress={() =>
                router.push(
                  "/(catador)/mapas"
                )
              }
              style={{ flex: 1 }}
            />
          </View>
        </LinearGradient>

        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 14,
          }}
        >
          <OfflineBanner
            visible={isOffline}
          />
        </View>

        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 12,
          }}
        >
          <LastSyncBadge
            value={lastSyncAt}
          />
        </View>

        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 18,
          }}
        >
          <SectionHeader
            title="Resumo operacional"
            subtitle="Situação atual das suas coletas"
          />

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "space-between",
            }}
          >
            <MetricCard
              title="Pendentes"
              value={String(
                metrics.pendingCollections.length
              )}
              icon="time-outline"
            />

            <MetricCard
              title="Em andamento"
              value={String(
                metrics.inProgressCollections
                  .length
              )}
              icon="navigate-outline"
            />

            <MetricCard
              title="Realizadas"
              value={String(
                metrics.collectedCollections.length
              )}
              icon="checkmark-circle-outline"
            />

            <MetricCard
              title="Peso do dia"
              value={`${metrics.totalCollectedTodayKg.toFixed(
                1
              )} kg`}
              icon="scale-outline"
            />
          </View>

          <SectionHeader
            title="Próxima coleta"
            subtitle="Atendimento prioritário da sua operação"
          />

          <View style={sectionCard}>
            {metrics.activeOperation ? (
              <>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                  }}
                >
                  <View
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 23,
                      backgroundColor:
                        metrics.activeOperation
                          .status ===
                        "IN_PROGRESS"
                          ? "#FEF3C7"
                          : "#DBEAFE",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    <Ionicons
                      name={
                        metrics.activeOperation
                          .status ===
                        "IN_PROGRESS"
                          ? "navigate-outline"
                          : "time-outline"
                      }
                      size={22}
                      color={
                        metrics.activeOperation
                          .status ===
                        "IN_PROGRESS"
                          ? "#D97706"
                          : "#2563EB"
                      }
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={itemTitle}>
                      {getSourceName(
                        metrics.activeOperation
                      )}
                    </Text>

                    <Text
                      style={{
                        color:
                          metrics.activeOperation
                            .status ===
                          "IN_PROGRESS"
                            ? "#D97706"
                            : "#2563EB",
                        fontWeight: "800",
                        fontSize: 13,
                        marginTop: 4,
                      }}
                    >
                      {translateStatus(
                        metrics.activeOperation
                          .status
                      )}
                    </Text>
                  </View>
                </View>

                <InfoRow
                  label="Endereço"
                  value={getAddress(
                    metrics.activeOperation
                  )}
                />

                <InfoRow
                  label="Data e horário"
                  value={formatDateTime(
                    getReferenceDate(
                      metrics.activeOperation
                    )
                  )}
                />

                <InfoRow
                  label="Peso previsto"
                  value={`${getCollectionTotalKg(
                    metrics.activeOperation
                  ).toFixed(1)} kg`}
                />

                <InfoRow
                  label="Materiais"
                  value={formatMaterials(
                    getCollectionMaterials(
                      metrics.activeOperation
                    )
                  )}
                  isLast
                />

                <View
                  style={{
                    flexDirection: "row",
                    marginTop: 16,
                  }}
                >
                  <QuickMiniButton
                    icon="play-outline"
                    label={
                      metrics.activeOperation
                        .status === "PENDING"
                        ? "Iniciar"
                        : "Continuar"
                    }
                    onPress={() =>
                      router.push({
                        pathname:
                          "/(catador)/collect",
                        params: {
                          collectionId:
                            metrics
                              .activeOperation
                              ?.id,
                        },
                      })
                    }
                  />

                  <View style={{ width: 10 }} />

                  <QuickMiniButton
                    icon="map-outline"
                    label="Ver mapa"
                    onPress={() =>
                      router.push({
                        pathname:
                          "/(catador)/mapas",
                        params: {
                          collectionId:
                            metrics
                              .activeOperation
                              ?.id,
                        },
                      })
                    }
                  />
                </View>
              </>
            ) : (
              <EmptyState
                icon="trail-sign-outline"
                title="Nenhuma operação ativa"
                subtitle="Quando houver uma coleta pendente ou em andamento, ela aparecerá aqui."
              />
            )}
          </View>

          <SectionHeader
            title="Minha rota"
            subtitle="Próximos atendimentos sugeridos"
          />

          <View style={sectionCard}>
            {metrics.nextCollections.length >
            0 ? (
              metrics.nextCollections.map(
                (item, index) => (
                  <RouteItem
                    key={item.id}
                    position={index + 1}
                    collection={item}
                    isLast={
                      index ===
                      metrics.nextCollections
                        .length -
                        1
                    }
                    onPress={() =>
                      router.push({
                        pathname:
                          "/(catador)/mapas",
                        params: {
                          collectionId:
                            item.id,
                        },
                      })
                    }
                  />
                )
              )
            ) : (
              <EmptyState
                icon="map-outline"
                title="Nenhuma rota disponível"
                subtitle="As próximas coletas aparecerão aqui quando forem delegadas."
              />
            )}
          </View>

          <SectionHeader
            title="Resumo ambiental"
            subtitle="Estimativas com base no peso coletado hoje"
          />

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "space-between",
            }}
          >
            <EnvironmentalCard
              icon="leaf-outline"
              title="CO₂ evitado"
              value={`${metrics.environmental.co2AvoidedKg.toFixed(
                1
              )} kg`}
            />

            <EnvironmentalCard
              icon="water-outline"
              title="Água economizada"
              value={`${metrics.environmental.waterSavedLiters.toFixed(
                0
              )} L`}
            />

            <EnvironmentalCard
              icon="flash-outline"
              title="Energia economizada"
              value={`${metrics.environmental.energySavedKwh.toFixed(
                1
              )} kWh`}
            />

            <EnvironmentalCard
              icon="leaf-outline"
              title="Árvores equivalentes"
              value={metrics.environmental.treesEquivalent.toFixed(
                2
              )}
            />
          </View>

          <SectionHeader
            title="Meu desempenho"
            subtitle="Indicadores acumulados da operação"
          />

          <View style={sectionCard}>
            <PerformanceRow
              label="Coletas realizadas"
              value={String(
                metrics.collectedCollections.length
              )}
              icon="checkmark-circle-outline"
            />

            <PerformanceRow
              label="Peso acumulado"
              value={`${metrics.totalCollectedAllTimeKg.toFixed(
                1
              )} kg`}
              icon="scale-outline"
            />

            <PerformanceRow
              label="Dias trabalhados"
              value={String(
                metrics.uniqueWorkDays
              )}
              icon="calendar-outline"
            />

            <PerformanceRow
              label="Média diária"
              value={`${metrics.dailyAverageKg.toFixed(
                1
              )} kg`}
              icon="stats-chart-outline"
              isLast
            />
          </View>

          <SectionHeader
            title="Coletas recentes"
            subtitle="Últimos registros realizados"
            actionLabel="Ver histórico"
            onPress={() =>
              router.push("/(catador)/data")
            }
          />

          <View style={sectionCard}>
            {metrics.recentCollections.length >
            0 ? (
              metrics.recentCollections.map(
                (item, index) => (
                  <RecentCollectionItem
                    key={item.id}
                    collection={item}
                    isLast={
                      index ===
                      metrics.recentCollections
                        .length -
                        1
                    }
                  />
                )
              )
            ) : (
              <EmptyState
                icon="clipboard-outline"
                title="Nenhuma coleta recente"
                subtitle="As coletas registradas aparecerão aqui conforme forem executadas."
              />
            )}
          </View>

          <SectionHeader
            title="Ações rápidas"
            subtitle="Acesse as principais funções"
          />

          <View style={sectionCard}>
            <QuickAction
              icon="trash-outline"
              title="Executar coleta"
              subtitle="Abrir a fila operacional delegada"
              onPress={() =>
                router.push(
                  "/(catador)/collect"
                )
              }
            />

            <QuickAction
              icon="map-outline"
              title="Mapa operacional"
              subtitle="Visualizar sua rota e os geradores"
              onPress={() =>
                router.push(
                  "/(catador)/mapas"
                )
              }
            />

            <QuickAction
              icon="bar-chart-outline"
              title="Dados e histórico"
              subtitle="Acompanhar resultados e coletas anteriores"
              onPress={() =>
                router.push(
                  "/(catador)/data"
                )
              }
            />

            <QuickAction
              icon="document-text-outline"
              title="Comprovantes"
              subtitle="Gerar e consultar comprovantes"
              onPress={() =>
                router.push(
                  "/(catador)/receipts"
                )
              }
            />

            <QuickAction
              icon="person-outline"
              title="Perfil"
              subtitle="Consultar seus dados cadastrais"
              onPress={() =>
                router.push(
                  "/(catador)/homecat"
                )
              }
            />

            <QuickAction
              icon="refresh-outline"
              title="Atualizar dados"
              subtitle="Sincronizar o painel operacional"
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

function HeaderActionButton({
  icon,
  label,
  onPress,
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  style?: object;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[
        {
          backgroundColor:
            "rgba(255,255,255,0.18)",
          borderRadius: 16,
          paddingVertical: 14,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Ionicons
        name={icon}
        size={18}
        color="#FFFFFF"
      />

      <Text
        style={{
          color: "#FFFFFF",
          fontWeight: "700",
          fontSize: 15,
          marginLeft: 8,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onPress,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onPress?: () => void;
}) {
  return (
    <View
      style={{
        marginTop: 20,
        marginBottom: 12,
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
            fontSize: 18,
            fontWeight: "800",
            color: "#111827",
            flex: 1,
            paddingRight: 10,
          }}
        >
          {title}
        </Text>

        {actionLabel && onPress ? (
          <TouchableOpacity
            onPress={onPress}
          >
            <Text
              style={{
                color: "#028C56",
                fontWeight: "700",
              }}
            >
              {actionLabel}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {subtitle ? (
        <Text
          style={{
            color: "#6B7280",
            fontSize: 13,
            marginTop: 3,
            lineHeight: 19,
          }}
        >
          {subtitle}
        </Text>
      ) : null}
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
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        marginBottom: 12,
        minHeight: 128,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: "#ECFDF5",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
        }}
      >
        <Ionicons
          name={icon}
          size={22}
          color="#028C56"
        />
      </View>

      <Text
        style={{
          color: "#6B7280",
          fontSize: 13,
        }}
      >
        {title}
      </Text>

      <Text
        style={{
          color: "#111827",
          fontSize: 20,
          fontWeight: "800",
          marginTop: 4,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function EnvironmentalCard({
  icon,
  title,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  value: string;
}) {
  return (
    <View
      style={{
        width: "48.5%",
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
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: "#DCFCE7",
          alignItems: "center",
          justifyContent: "center",
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
          color: "#6B7280",
          fontSize: 12,
          marginTop: 10,
        }}
      >
        {title}
      </Text>

      <Text
        style={{
          color: "#111827",
          fontSize: 17,
          fontWeight: "900",
          marginTop: 3,
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
        paddingTop: 12,
        paddingBottom: isLast ? 0 : 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: "#E5E7EB",
      }}
    >
      <Text
        style={{
          color: "#6B7280",
          fontSize: 12,
        }}
      >
        {label}
      </Text>

      <Text
        style={{
          color: "#111827",
          fontSize: 14,
          fontWeight: "600",
          marginTop: 4,
          lineHeight: 20,
        }}
      >
        {value || "-"}
      </Text>
    </View>
  );
}

function QuickMiniButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={{
        flex: 1,
        backgroundColor: "#ECFDF5",
        borderColor: "#86EFAC",
        borderWidth: 1,
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
      }}
    >
      <Ionicons
        name={icon}
        size={16}
        color="#028C56"
      />

      <Text
        style={{
          color: "#0F172A",
          fontWeight: "700",
          marginLeft: 8,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function RouteItem({
  position,
  collection,
  isLast,
  onPress,
}: {
  position: number;
  collection: Collection;
  isLast: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
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
          backgroundColor:
            collection.status ===
            "IN_PROGRESS"
              ? "#FEF3C7"
              : "#DBEAFE",
          alignItems: "center",
          justifyContent: "center",
          marginRight: 11,
        }}
      >
        <Text
          style={{
            color:
              collection.status ===
              "IN_PROGRESS"
                ? "#D97706"
                : "#2563EB",
            fontWeight: "900",
          }}
        >
          {position}
        </Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={itemTitle}>
          {getSourceName(collection)}
        </Text>

        <Text
          style={{
            color: "#6B7280",
            fontSize: 12,
            marginTop: 4,
          }}
        >
          {getAddress(collection)}
        </Text>

        <Text
          style={{
            color: "#6B7280",
            fontSize: 12,
            marginTop: 4,
          }}
        >
          {formatTime(
            getReferenceDate(collection)
          )}
          {" • "}
          {getCollectionTotalKg(
            collection
          ).toFixed(1)}{" "}
          kg
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

function PerformanceRow({
  label,
  value,
  icon,
  isLast = false,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  isLast?: boolean;
}) {
  return (
    <View
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
          width: 42,
          height: 42,
          borderRadius: 21,
          backgroundColor: "#ECFDF5",
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        }}
      >
        <Ionicons
          name={icon}
          size={20}
          color="#028C56"
        />
      </View>

      <Text
        style={{
          flex: 1,
          color: "#374151",
          fontSize: 14,
          fontWeight: "600",
        }}
      >
        {label}
      </Text>

      <Text
        style={{
          color: "#111827",
          fontSize: 15,
          fontWeight: "900",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function RecentCollectionItem({
  collection,
  isLast,
}: {
  collection: Collection;
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
      <Text style={itemTitle}>
        {getSourceName(collection)}
      </Text>

      <Text style={itemText}>
        Peso:{" "}
        {getCollectionTotalKg(
          collection
        ).toFixed(1)}{" "}
        kg
      </Text>

      <Text style={itemSubtext}>
        Data:{" "}
        {formatDateTime(
          collection.collectedAt ||
            collection.completedAt ||
            collection.createdAt
        )}
      </Text>

      <Text style={itemSubtext}>
        Status:{" "}
        {translateStatus(collection.status)}
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
          width: 46,
          height: 46,
          borderRadius: 23,
          backgroundColor: "#ECFDF5",
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        }}
      >
        <Ionicons
          name={icon}
          size={22}
          color="#028C56"
        />
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: "#111827",
            fontSize: 15,
            fontWeight: "800",
          }}
        >
          {title}
        </Text>

        <Text
          style={{
            color: "#6B7280",
            fontSize: 13,
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
        paddingVertical: 16,
      }}
    >
      <Ionicons
        name={icon}
        size={42}
        color="#9CA3AF"
      />

      <Text
        style={{
          color: "#111827",
          fontSize: 16,
          fontWeight: "800",
          marginTop: 12,
        }}
      >
        {title}
      </Text>

      <Text
        style={{
          color: "#6B7280",
          fontSize: 13,
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

const itemTitle = {
  color: "#111827",
  fontSize: 15,
  fontWeight: "800",
} as const;

const itemText = {
  color: "#374151",
  fontSize: 13,
  marginTop: 6,
} as const;

const itemSubtext = {
  color: "#6B7280",
  fontSize: 12,
  marginTop: 6,
} as const;
