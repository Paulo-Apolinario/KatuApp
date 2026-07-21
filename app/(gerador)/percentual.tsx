import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  router,
  useFocusEffect,
} from "expo-router";
import {
  useCallback,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useNotification } from "@/src/contexts/NotificationContext";
import { collectionService } from "@/src/services/collectionService";

import type {
  Collection,
  CollectionMaterial,
  CollectionMaterialRecord,
  WasteUnit,
} from "@/src/types/collection";

/*
 * ============================================================
 * TIPOS LOCAIS
 * ============================================================
 */

type NormalizedImpactMaterial = {
  key: string;
  name: string;
  category?: string | null;
  subcategory?: string | null;
  quantity: number;
  quantityKg: number;
  unit: WasteUnit;
};

type MaterialStats = {
  key: string;
  name: string;
  category?: string | null;
  subcategory?: string | null;
  count: number;
  totalKg: number;
  percent: number;
  color: string;
};

type ImpactMetrics = {
  totalCollections: number;
  totalKg: number;
  totalMaterialTypes: number;
  averageKgPerCollection: number;
  largestCollectionKg: number;
  collectionsWithMaterials: number;
};

/*
 * ============================================================
 * CONSTANTES
 * ============================================================
 */

const MATERIAL_COLORS = [
  "#06B6D4",
  "#EF4444",
  "#8B5CF6",
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EC4899",
  "#14B8A6",
];

const IMPACT_TARGET_KG = 1000;

/*
 * ============================================================
 * FUNÇÕES AUXILIARES
 * ============================================================
 */

function normalizeNumber(
  value: unknown
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const normalized =
    typeof value === "string"
      ? value.replace(",", ".")
      : value;

  const numeric = Number(normalized);

  return Number.isFinite(numeric)
    ? numeric
    : 0;
}

function normalizeText(
  value: unknown
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value).trim();
}

function normalizeWasteUnit(
  value: unknown
): WasteUnit {
  const normalized = String(
    value || ""
  )
    .trim()
    .toUpperCase();

  const acceptedUnits: WasteUnit[] = [
    "KG",
    "TON",
    "LITER",
    "UNIT",
    "CUBIC_METER",
  ];

  return acceptedUnits.includes(
    normalized as WasteUnit
  )
    ? (normalized as WasteUnit)
    : "KG";
}

function convertToKg(
  quantity: number,
  unit: WasteUnit
) {
  if (unit === "KG") {
    return quantity;
  }

  if (unit === "TON") {
    return quantity * 1000;
  }

  return 0;
}

function formatKg(
  value: number
) {
  return value.toLocaleString(
    "pt-BR",
    {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    }
  );
}

function formatPercent(
  value: number
) {
  return value.toLocaleString(
    "pt-BR",
    {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }
  );
}

function getRecordMaterialName(
  material: CollectionMaterialRecord
) {
  return (
    normalizeText(
      material.nameSnapshot
    ) ||
    normalizeText(
      material.wasteType?.name
    ) ||
    normalizeText(
      material.catalogSuggestion?.name
    ) ||
    "Não informado"
  );
}

function getRecordMaterialCategory(
  material: CollectionMaterialRecord
) {
  return (
    normalizeText(
      material.categorySnapshot
    ) ||
    normalizeText(
      material.wasteType?.category
    ) ||
    normalizeText(
      material.catalogSuggestion?.category
    ) ||
    null
  );
}

function getRecordMaterialSubcategory(
  material: CollectionMaterialRecord
) {
  return (
    normalizeText(
      material.subcategorySnapshot
    ) ||
    normalizeText(
      material.wasteType?.subcategory
    ) ||
    normalizeText(
      material.catalogSuggestion
        ?.subcategory
    ) ||
    null
  );
}

function normalizeRecordMaterial(
  material: CollectionMaterialRecord,
  index: number
): NormalizedImpactMaterial {
  const quantity =
    normalizeNumber(
      material.quantity
    );

  const unit = normalizeWasteUnit(
    material.unit
  );

  const name =
    getRecordMaterialName(material);

  return {
    key:
      material.id ||
      `${name}_${index}`,

    name,

    category:
      getRecordMaterialCategory(
        material
      ),

    subcategory:
      getRecordMaterialSubcategory(
        material
      ),

    quantity,

    quantityKg: convertToKg(
      quantity,
      unit
    ),

    unit,
  };
}

function normalizeLegacyMaterial(
  material: CollectionMaterial,
  index: number
): NormalizedImpactMaterial {
  const name =
    normalizeText(material.name) ||
    normalizeText(material.type) ||
    "Não informado";

  const unit = normalizeWasteUnit(
    material.unit
  );

  const explicitQuantity =
    normalizeNumber(
      material.quantity
    );

  const explicitQuantityKg =
    normalizeNumber(
      material.quantityKg
    );

  const quantity =
    explicitQuantity > 0
      ? explicitQuantity
      : unit === "KG"
        ? explicitQuantityKg
        : 0;

  const quantityKg =
    explicitQuantityKg > 0
      ? explicitQuantityKg
      : convertToKg(
          quantity,
          unit
        );

  return {
    key: `${name}_${index}`,

    name,

    category:
      normalizeText(
        material.category
      ) || null,

    subcategory:
      normalizeText(
        material.subcategory
      ) || null,

    quantity,

    quantityKg,

    unit,
  };
}

function getCollectionMaterials(
  collection: Collection
): NormalizedImpactMaterial[] {
  if (
    Array.isArray(
      collection.collectionMaterials
    ) &&
    collection.collectionMaterials.length >
      0
  ) {
    return collection.collectionMaterials.map(
      normalizeRecordMaterial
    );
  }

  if (
    Array.isArray(
      collection.materials
    ) &&
    collection.materials.length > 0
  ) {
    return collection.materials.map(
      normalizeLegacyMaterial
    );
  }

  return [];
}

function getCollectionTotalKg(
  collection: Collection
) {
  const totalWeightKg =
    normalizeNumber(
      collection.totalWeightKg
    );

  if (totalWeightKg > 0) {
    return totalWeightKg;
  }

  return getCollectionMaterials(
    collection
  ).reduce(
    (total, material) =>
      total + material.quantityKg,
    0
  );
}

function buildMaterialKey(
  material: NormalizedImpactMaterial
) {
  return [
    material.name,
    material.category || "",
    material.subcategory || "",
  ]
    .join("|")
    .toLocaleLowerCase("pt-BR");
}

/*
 * ============================================================
 * TELA
 * ============================================================
 */

export default function PercentualScreen() {
  const {
    notifyError,
  } = useNotification();

  const [
    collections,
    setCollections,
  ] = useState<Collection[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const loadCollections =
    useCallback(
      async (
        showLoader = true
      ) => {
        try {
          if (showLoader) {
            setLoading(true);
          }

          const response =
            await collectionService.list();

          setCollections(
            Array.isArray(response)
              ? response
              : []
          );
        } catch (error) {
          console.error(
            "Erro ao carregar impacto das coletas:",
            error
          );

          setCollections([]);

          notifyError(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar os dados de impacto."
          );
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

  const onRefresh =
    useCallback(async () => {
      setRefreshing(true);
      await loadCollections(false);
    }, [loadCollections]);

  /*
   * Apenas coletas totalmente concluídas entram nos indicadores
   * ambientais consolidados.
   */
  const completedCollections =
    useMemo(() => {
      return collections.filter(
        (collection) =>
          collection.status ===
          "COMPLETED"
      );
    }, [collections]);

  const materials =
    useMemo<MaterialStats[]>(
      () => {
        const materialMap =
          new Map<
            string,
            {
              name: string;
              category?: string | null;
              subcategory?: string | null;
              count: number;
              totalKg: number;
            }
          >();

        completedCollections.forEach(
          (collection) => {
            const collectionMaterials =
              getCollectionMaterials(
                collection
              );

            collectionMaterials.forEach(
              (material) => {
                const key =
                  buildMaterialKey(
                    material
                  );

                const current =
                  materialMap.get(key);

                if (current) {
                  current.count += 1;
                  current.totalKg +=
                    material.quantityKg;

                  return;
                }

                materialMap.set(key, {
                  name: material.name,
                  category:
                    material.category,
                  subcategory:
                    material.subcategory,
                  count: 1,
                  totalKg:
                    material.quantityKg,
                });
              }
            );
          }
        );

        const totalMaterialsKg =
          Array.from(
            materialMap.values()
          ).reduce(
            (total, material) =>
              total +
              material.totalKg,
            0
          );

        return Array.from(
          materialMap.entries()
        )
          .map(
            (
              [key, material],
              index
            ) => ({
              key,

              name: material.name,

              category:
                material.category,

              subcategory:
                material.subcategory,

              count:
                material.count,

              totalKg:
                material.totalKg,

              percent:
                totalMaterialsKg > 0
                  ? (material.totalKg /
                      totalMaterialsKg) *
                    100
                  : 0,

              color:
                MATERIAL_COLORS[
                  index %
                    MATERIAL_COLORS.length
                ],
            })
          )
          .sort(
            (first, second) =>
              second.totalKg -
              first.totalKg
          );
      },
      [completedCollections]
    );

  const metrics =
    useMemo<ImpactMetrics>(
      () => {
        const collectionWeights =
          completedCollections.map(
            getCollectionTotalKg
          );

        const totalKg =
          collectionWeights.reduce(
            (total, weight) =>
              total + weight,
            0
          );

        const largestCollectionKg =
          collectionWeights.length > 0
            ? Math.max(
                ...collectionWeights
              )
            : 0;

        const collectionsWithMaterials =
          completedCollections.filter(
            (collection) =>
              getCollectionMaterials(
                collection
              ).length > 0
          ).length;

        return {
          totalCollections:
            completedCollections.length,

          totalKg,

          totalMaterialTypes:
            materials.length,

          averageKgPerCollection:
            completedCollections.length >
            0
              ? totalKg /
                completedCollections.length
              : 0,

          largestCollectionKg,

          collectionsWithMaterials,
        };
      },
      [
        completedCollections,
        materials.length,
      ]
    );

  const targetPercent =
    useMemo(() => {
      if (IMPACT_TARGET_KG <= 0) {
        return 0;
      }

      return (
        metrics.totalKg /
        IMPACT_TARGET_KG
      ) * 100;
    }, [metrics.totalKg]);

  const targetProgress =
    Math.min(
      targetPercent,
      100
    );

  if (loading) {
    return (
      <View
        style={
          styles.loadingContainer
        }
      >
        <ActivityIndicator
          size="large"
          color="#028C56"
        />

        <Text
          style={styles.loadingText}
        >
          Carregando impacto...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={[
          "#10B981",
          "#028C56",
        ]}
        start={{
          x: 0,
          y: 0,
        }}
        end={{
          x: 1,
          y: 0,
        }}
        style={styles.header}
      >
        <View
          style={styles.headerTop}
        >
          <TouchableOpacity
            onPress={() =>
              router.back()
            }
            style={
              styles.headerButton
            }
          >
            <Ionicons
              name="arrow-back"
              size={22}
              color="#FFFFFF"
            />
          </TouchableOpacity>

          <View
            style={
              styles.headerContent
            }
          >
            <Text
              style={styles.headerTitle}
            >
              Impacto da coleta
            </Text>

            <Text
              style={
                styles.headerSubtitle
              }
            >
              Resultados consolidados das coletas concluídas.
            </Text>
          </View>

          <View
            style={
              styles.headerButtonPlaceholder
            }
          />
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
        contentContainerStyle={
          styles.scrollContent
        }
      >
        <View
          style={
            styles.mainImpactCard
          }
        >
          <View
            style={
              styles.mainImpactIcon
            }
          >
            <Ionicons
              name="leaf-outline"
              size={30}
              color="#15803D"
            />
          </View>

          <Text
            style={
              styles.mainImpactLabel
            }
          >
            Total reciclado
          </Text>

          <Text
            style={
              styles.mainImpactValue
            }
          >
            {formatKg(
              metrics.totalKg
            )}{" "}
            kg
          </Text>

          <Text
            style={
              styles.mainImpactDescription
            }
          >
            Soma do peso consolidado de todas as coletas concluídas.
          </Text>

          <View
            style={
              styles.targetContainer
            }
          >
            <View
              style={
                styles.targetHeader
              }
            >
              <Text
                style={
                  styles.targetLabel
                }
              >
                Meta de referência
              </Text>

              <Text
                style={
                  styles.targetPercent
                }
              >
                {formatPercent(
                  targetPercent
                )}
                %
              </Text>
            </View>

            <View
              style={
                styles.targetTrack
              }
            >
              <View
                style={[
                  styles.targetFill,
                  {
                    width: `${targetProgress}%`,
                  },
                ]}
              />
            </View>

            <Text
              style={
                styles.targetDescription
              }
            >
              Referência atual:{" "}
              {IMPACT_TARGET_KG.toLocaleString(
                "pt-BR"
              )}{" "}
              kg
            </Text>
          </View>
        </View>

        <View
          style={
            styles.metricsGrid
          }
        >
          <MetricCard
            title="Coletas concluídas"
            value={String(
              metrics.totalCollections
            )}
            icon="checkmark-done-outline"
          />

          <MetricCard
            title="Tipos de materiais"
            value={String(
              metrics.totalMaterialTypes
            )}
            icon="layers-outline"
          />

          <MetricCard
            title="Média por coleta"
            value={`${formatKg(
              metrics.averageKgPerCollection
            )} kg`}
            icon="analytics-outline"
          />

          <MetricCard
            title="Maior coleta"
            value={`${formatKg(
              metrics.largestCollectionKg
            )} kg`}
            icon="trending-up-outline"
          />
        </View>

        <View
          style={styles.infoBanner}
        >
          <Ionicons
            name="information-circle-outline"
            size={22}
            color="#1D4ED8"
          />

          <Text
            style={styles.infoBannerText}
          >
            {metrics.collectionsWithMaterials} de{" "}
            {metrics.totalCollections} coletas concluídas possuem materiais detalhados. O peso total continua sendo calculado pelo campo consolidado da coleta.
          </Text>
        </View>

        <View
          style={styles.sectionCard}
        >
          <View
            style={
              styles.sectionHeader
            }
          >
            <View
              style={
                styles.sectionIcon
              }
            >
              <Ionicons
                name="pie-chart-outline"
                size={21}
                color="#15803D"
              />
            </View>

            <View
              style={
                styles.sectionTitleBox
              }
            >
              <Text
                style={
                  styles.sectionTitle
                }
              >
                Distribuição por material
              </Text>

              <Text
                style={
                  styles.sectionSubtitle
                }
              >
                Participação no peso total detalhado
              </Text>
            </View>
          </View>

          {materials.length > 0 ? (
            materials.map(
              (material) => (
                <MaterialProgress
                  key={material.key}
                  material={material}
                />
              )
            )
          ) : (
            <EmptyMaterials />
          )}
        </View>

        <View
          style={styles.sectionCard}
        >
          <View
            style={
              styles.sectionHeader
            }
          >
            <View
              style={
                styles.sectionIcon
              }
            >
              <Ionicons
                name="list-outline"
                size={21}
                color="#15803D"
              />
            </View>

            <View
              style={
                styles.sectionTitleBox
              }
            >
              <Text
                style={
                  styles.sectionTitle
                }
              >
                Resumo dos materiais
              </Text>

              <Text
                style={
                  styles.sectionSubtitle
                }
              >
                Quantidade de ocorrências e peso acumulado
              </Text>
            </View>
          </View>

          {materials.length > 0 ? (
            materials.map(
              (
                material,
                index
              ) => (
                <MaterialSummaryRow
                  key={material.key}
                  material={material}
                  isLast={
                    index ===
                    materials.length - 1
                  }
                />
              )
            )
          ) : (
            <Text
              style={
                styles.noLegendText
              }
            >
              O resumo será exibido quando houver materiais registrados nas coletas concluídas.
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/*
 * ============================================================
 * COMPONENTES AUXILIARES
 * ============================================================
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
    <View
      style={styles.metricCard}
    >
      <View
        style={styles.metricIcon}
      >
        <Ionicons
          name={icon}
          size={20}
          color="#15803D"
        />
      </View>

      <Text
        style={styles.metricValue}
        numberOfLines={1}
      >
        {value}
      </Text>

      <Text
        style={styles.metricTitle}
      >
        {title}
      </Text>
    </View>
  );
}

function MaterialProgress({
  material,
}: {
  material: MaterialStats;
}) {
  return (
    <View
      style={
        styles.materialProgress
      }
    >
      <View
        style={
          styles.materialProgressHeader
        }
      >
        <View
          style={
            styles.materialNameBox
          }
        >
          <View
            style={[
              styles.materialDot,
              {
                backgroundColor:
                  material.color,
              },
            ]}
          />

          <View
            style={
              styles.materialNameContent
            }
          >
            <Text
              style={
                styles.materialName
              }
              numberOfLines={1}
            >
              {material.name}
            </Text>

            {material.category ||
            material.subcategory ? (
              <Text
                style={
                  styles.materialCategory
                }
                numberOfLines={1}
              >
                {[
                  material.category,
                  material.subcategory,
                ]
                  .filter(Boolean)
                  .join(" • ")}
              </Text>
            ) : null}
          </View>
        </View>

        <View
          style={
            styles.materialNumbers
          }
        >
          <Text
            style={
              styles.materialPercent
            }
          >
            {formatPercent(
              material.percent
            )}
            %
          </Text>

          <Text
            style={
              styles.materialKg
            }
          >
            {formatKg(
              material.totalKg
            )}{" "}
            kg
          </Text>
        </View>
      </View>

      <View
        style={
          styles.progressTrack
        }
      >
        <View
          style={[
            styles.progressFill,
            {
              width: `${Math.min(
                material.percent,
                100
              )}%`,
              backgroundColor:
                material.color,
            },
          ]}
        />
      </View>
    </View>
  );
}

function MaterialSummaryRow({
  material,
  isLast,
}: {
  material: MaterialStats;
  isLast: boolean;
}) {
  return (
    <View
      style={[
        styles.materialSummaryRow,
        isLast &&
          styles.materialSummaryRowLast,
      ]}
    >
      <View
        style={[
          styles.summaryColor,
          {
            backgroundColor:
              material.color,
          },
        ]}
      />

      <View
        style={
          styles.summaryMaterialContent
        }
      >
        <Text
          style={
            styles.summaryMaterialName
          }
          numberOfLines={1}
        >
          {material.name}
        </Text>

        <Text
          style={
            styles.summaryMaterialCount
          }
        >
          Presente em{" "}
          {material.count}{" "}
          {material.count === 1
            ? "coleta"
            : "coletas"}
        </Text>
      </View>

      <Text
        style={
          styles.summaryMaterialWeight
        }
      >
        {formatKg(
          material.totalKg
        )}{" "}
        kg
      </Text>
    </View>
  );
}

function EmptyMaterials() {
  return (
    <View
      style={styles.emptyState}
    >
      <View
        style={styles.emptyIcon}
      >
        <Ionicons
          name="pie-chart-outline"
          size={36}
          color="#9CA3AF"
        />
      </View>

      <Text
        style={styles.emptyTitle}
      >
        Sem materiais detalhados
      </Text>

      <Text
        style={styles.emptyText}
      >
        Ainda não existem materiais registrados em coletas concluídas para gerar a distribuição.
      </Text>
    </View>
  );
}

/*
 * ============================================================
 * ESTILOS
 * ============================================================
 */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 10,
    color: "#6B7280",
    fontSize: 14,
  },

  header: {
    paddingTop: 22,
    paddingBottom: 24,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },

  headerTop: {
    flexDirection: "row",
    alignItems: "center",
  },

  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor:
      "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  headerButtonPlaceholder: {
    width: 42,
    height: 42,
  },

  headerContent: {
    flex: 1,
    marginHorizontal: 12,
  },

  headerTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
  },

  headerSubtitle: {
    marginTop: 4,
    color: "#E8FFF1",
    fontSize: 13,
    lineHeight: 18,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 40,
  },

  mainImpactCard: {
    padding: 22,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    backgroundColor: "#F0FDF4",
    alignItems: "center",
  },

  mainImpactIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },

  mainImpactLabel: {
    marginTop: 13,
    color: "#4B5563",
    fontSize: 15,
  },

  mainImpactValue: {
    marginTop: 5,
    color: "#028C56",
    fontSize: 38,
    fontWeight: "800",
    textAlign: "center",
  },

  mainImpactDescription: {
    marginTop: 7,
    color: "#6B7280",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },

  targetContainer: {
    width: "100%",
    marginTop: 18,
    padding: 13,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
  },

  targetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  targetLabel: {
    color: "#4B5563",
    fontSize: 12,
    fontWeight: "700",
  },

  targetPercent: {
    color: "#028C56",
    fontSize: 13,
    fontWeight: "800",
  },

  targetTrack: {
    height: 9,
    marginTop: 9,
    borderRadius: 5,
    backgroundColor: "#E5E7EB",
    overflow: "hidden",
  },

  targetFill: {
    height: 9,
    borderRadius: 5,
    backgroundColor: "#16A34A",
  },

  targetDescription: {
    marginTop: 7,
    color: "#9CA3AF",
    fontSize: 10,
  },

  metricsGrid: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  metricCard: {
    width: "48.5%",
    marginBottom: 12,
    padding: 15,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },

  metricIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },

  metricValue: {
    marginTop: 10,
    color: "#111827",
    fontSize: 20,
    fontWeight: "800",
  },

  metricTitle: {
    marginTop: 3,
    color: "#6B7280",
    fontSize: 12,
    lineHeight: 17,
  },

  infoBanner: {
    marginBottom: 14,
    padding: 13,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
    flexDirection: "row",
    alignItems: "flex-start",
  },

  infoBannerText: {
    flex: 1,
    marginLeft: 9,
    color: "#1E3A8A",
    fontSize: 12,
    lineHeight: 18,
  },

  sectionCard: {
    marginBottom: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },

  sectionHeader: {
    marginBottom: 18,
    flexDirection: "row",
    alignItems: "center",
  },

  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },

  sectionTitleBox: {
    flex: 1,
    marginLeft: 10,
  },

  sectionTitle: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "800",
  },

  sectionSubtitle: {
    marginTop: 2,
    color: "#6B7280",
    fontSize: 11,
  },

  materialProgress: {
    marginBottom: 17,
  },

  materialProgressHeader: {
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },

  materialNameBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  materialDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },

  materialNameContent: {
    flex: 1,
  },

  materialName: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "700",
  },

  materialCategory: {
    marginTop: 2,
    color: "#9CA3AF",
    fontSize: 10,
  },

  materialNumbers: {
    marginLeft: 10,
    alignItems: "flex-end",
  },

  materialPercent: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "800",
  },

  materialKg: {
    marginTop: 2,
    color: "#6B7280",
    fontSize: 10,
  },

  progressTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: "#E5E7EB",
    overflow: "hidden",
  },

  progressFill: {
    height: 10,
    borderRadius: 5,
  },

  materialSummaryRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
  },

  materialSummaryRowLast: {
    paddingBottom: 0,
    borderBottomWidth: 0,
  },

  summaryColor: {
    width: 15,
    height: 15,
    borderRadius: 8,
  },

  summaryMaterialContent: {
    flex: 1,
    marginLeft: 9,
  },

  summaryMaterialName: {
    color: "#374151",
    fontSize: 13,
    fontWeight: "700",
  },

  summaryMaterialCount: {
    marginTop: 2,
    color: "#9CA3AF",
    fontSize: 10,
  },

  summaryMaterialWeight: {
    marginLeft: 10,
    color: "#111827",
    fontSize: 12,
    fontWeight: "800",
  },

  noLegendText: {
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 19,
  },

  emptyState: {
    paddingVertical: 24,
    alignItems: "center",
  },

  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },

  emptyTitle: {
    marginTop: 12,
    color: "#374151",
    fontSize: 15,
    fontWeight: "800",
  },

  emptyText: {
    marginTop: 6,
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
});
