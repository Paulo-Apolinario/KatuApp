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
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useNotification } from "@/src/contexts/NotificationContext";
import { collectionService } from "@/src/services/collectionService";

import type {
  Collection,
  CollectionMaterial,
  CollectionMaterialRecord,
  CollectionStatus,
} from "@/src/types/collection";

type CollectionListItem = Collection & {
  cooperative?: {
    id?: string;
    name?: string | null;
    companyName?: string | null;
  } | null;
  generator?: {
    id?: string;
    name?: string | null;
    companyName?: string | null;
    address?: string | null;
    street?: string | null;
    number?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
  } | null;
  collector?: {
    id?: string;
    name?: string | null;
  } | null;
  driver?: {
    id?: string;
    name?: string | null;
  } | null;
  vehicle?: {
    id?: string;
    plate?: string | null;
    model?: string | null;
  } | null;
  route?: {
    id?: string;
    name?: string | null;
    code?: string | null;
  } | null;
};

type FilterValue =
  | "ALL"
  | CollectionStatus;

type SortValue =
  | "NEWEST"
  | "OLDEST"
  | "WEIGHT_DESC"
  | "STATUS";

const FILTERS: {
  value: FilterValue;
  label: string;
}[] = [
  {
    value: "ALL",
    label: "Todas",
  },
  {
    value: "PENDING",
    label: "Pendentes",
  },
  {
    value: "IN_PROGRESS",
    label: "Em coleta",
  },
  {
    value: "COLLECTED",
    label: "Coletadas",
  },
  {
    value: "RECEIVED",
    label: "Recebidas",
  },
  {
    value: "SORTING",
    label: "Em triagem",
  },
  {
    value: "COMPLETED",
    label: "Concluídas",
  },
  {
    value: "CANCELLED",
    label: "Canceladas",
  },
];

const SORT_OPTIONS: {
  value: SortValue;
  label: string;
}[] = [
  {
    value: "NEWEST",
    label: "Mais recentes",
  },
  {
    value: "OLDEST",
    label: "Mais antigas",
  },
  {
    value: "WEIGHT_DESC",
    label: "Maior peso",
  },
  {
    value: "STATUS",
    label: "Status",
  },
];

function formatDateTime(
  value?: string | null
) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTimestamp(
  value?: string | null
) {
  if (!value) {
    return 0;
  }

  const timestamp =
    new Date(value).getTime();

  return Number.isNaN(timestamp)
    ? 0
    : timestamp;
}

function translateCollectionStatus(
  status: CollectionStatus
) {
  const labels: Record<
    CollectionStatus,
    string
  > = {
    PENDING: "Pendente",
    IN_PROGRESS: "Em coleta",
    COLLECTED: "Coletada",
    RECEIVED: "Recebida",
    SORTING: "Em triagem",
    COMPLETED: "Concluída",
    CANCELLED: "Cancelada",
  };

  return labels[status];
}

function getCollectionStatusColor(
  status: CollectionStatus
) {
  const colors: Record<
    CollectionStatus,
    string
  > = {
    PENDING: "#64748B",
    IN_PROGRESS: "#F59E0B",
    COLLECTED: "#7C3AED",
    RECEIVED: "#2563EB",
    SORTING: "#0891B2",
    COMPLETED: "#16A34A",
    CANCELLED: "#DC2626",
  };

  return colors[status];
}

function getCollectionStatusIcon(
  status: CollectionStatus
): keyof typeof Ionicons.glyphMap {
  const icons: Record<
    CollectionStatus,
    keyof typeof Ionicons.glyphMap
  > = {
    PENDING: "time-outline",
    IN_PROGRESS: "car-outline",
    COLLECTED: "cube-outline",
    RECEIVED: "business-outline",
    SORTING: "git-branch-outline",
    COMPLETED: "checkmark-done-outline",
    CANCELLED: "close-circle-outline",
  };

  return icons[status];
}

function getMaterialName(
  material:
    | CollectionMaterial
    | CollectionMaterialRecord
) {
  const item = material as
    CollectionMaterial &
      CollectionMaterialRecord & {
        nameSnapshot?: string | null;
        wasteType?: {
          name?: string | null;
        } | null;
        catalogSuggestion?: {
          name?: string | null;
        } | null;
      };

  return (
    item.nameSnapshot ||
    item.wasteType?.name ||
    item.catalogSuggestion?.name ||
    item.name ||
    item.type ||
    "Material"
  );
}

function getMaterialQuantity(
  material:
    | CollectionMaterial
    | CollectionMaterialRecord
) {
  const item = material as
    CollectionMaterial &
      CollectionMaterialRecord;

  const quantity = Number(
    item.quantity ??
      item.quantityKg ??
      0
  );

  const unit =
    item.unit || "KG";

  if (
    !Number.isFinite(quantity) ||
    quantity <= 0
  ) {
    return null;
  }

  return `${quantity.toLocaleString(
    "pt-BR"
  )} ${unit}`;
}

function getCollectionMaterials(
  collection: CollectionListItem
) {
  if (
    Array.isArray(
      collection.collectionMaterials
    ) &&
    collection.collectionMaterials.length >
      0
  ) {
    return collection.collectionMaterials;
  }

  if (
    Array.isArray(collection.materials)
  ) {
    return collection.materials;
  }

  return [];
}

function getGeneratorName(
  collection: CollectionListItem
) {
  return (
    collection.generator?.name ||
    collection.generator?.companyName ||
    "Gerador não informado"
  );
}

function getCooperativeName(
  collection: CollectionListItem
) {
  return (
    collection.cooperative?.name ||
    collection.cooperative?.companyName ||
    "Cooperativa"
  );
}

function getAddress(
  collection: CollectionListItem
) {
  const generator =
    collection.generator;

  if (!generator) {
    return "-";
  }

  if (generator.address) {
    return generator.address;
  }

  const street = [
    generator.street,
    generator.number,
  ]
    .filter(Boolean)
    .join(", ");

  const city = [
    generator.neighborhood,
    generator.city,
    generator.state,
  ]
    .filter(Boolean)
    .join(" - ");

  return (
    [street, city]
      .filter(Boolean)
      .join(" • ") || "-"
  );
}

function getSearchableText(
  collection: CollectionListItem
) {
  const materials =
    getCollectionMaterials(collection)
      .map(getMaterialName)
      .join(" ");

  return [
    collection.id,
    collection.scheduleId,
    collection.notes,
    collection.cancellationReason,
    getGeneratorName(collection),
    getCooperativeName(collection),
    collection.collector?.name,
    collection.driver?.name,
    collection.vehicle?.plate,
    collection.route?.name,
    collection.route?.code,
    materials,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("pt-BR");
}

function getPrimaryDate(
  collection: CollectionListItem
) {
  return (
    collection.completedAt ||
    collection.sortingStartedAt ||
    collection.receivedAt ||
    collection.collectedAt ||
    collection.startedAt ||
    collection.createdAt
  );
}

export default function GeneratorCollectionsScreen() {
  const { notifyError } =
    useNotification();

  const [loading, setLoading] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    collections,
    setCollections,
  ] = useState<
    CollectionListItem[]
  >([]);

  const [
    searchTerm,
    setSearchTerm,
  ] = useState("");

  const [
    selectedFilter,
    setSelectedFilter,
  ] = useState<FilterValue>("ALL");

  const [
    selectedSort,
    setSelectedSort,
  ] = useState<SortValue>("NEWEST");

  const [
    showSortOptions,
    setShowSortOptions,
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
              ? (response as CollectionListItem[])
              : []
          );
        } catch (error) {
          console.error(
            "Erro ao carregar coletas:",
            error
          );

          notifyError(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar suas coletas."
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

  const metrics = useMemo(() => {
    const totalWeight =
      collections.reduce(
        (
          total,
          collection
        ) => {
          const weight = Number(
            collection.totalWeightKg ||
              0
          );

          return Number.isFinite(
            weight
          )
            ? total + weight
            : total;
        },
        0
      );

    const active =
      collections.filter(
        (collection) =>
          collection.status ===
            "PENDING" ||
          collection.status ===
            "IN_PROGRESS"
      ).length;

    const processing =
      collections.filter(
        (collection) =>
          collection.status ===
            "COLLECTED" ||
          collection.status ===
            "RECEIVED" ||
          collection.status ===
            "SORTING"
      ).length;

    const completed =
      collections.filter(
        (collection) =>
          collection.status ===
          "COMPLETED"
      ).length;

    return {
      total: collections.length,
      active,
      processing,
      completed,
      totalWeight,
    };
  }, [collections]);

  const visibleCollections =
    useMemo(() => {
      const normalizedSearch =
        searchTerm
          .trim()
          .toLocaleLowerCase(
            "pt-BR"
          );

      const filtered =
        collections.filter(
          (collection) => {
            const matchesStatus =
              selectedFilter ===
                "ALL" ||
              collection.status ===
                selectedFilter;

            const matchesSearch =
              !normalizedSearch ||
              getSearchableText(
                collection
              ).includes(
                normalizedSearch
              );

            return (
              matchesStatus &&
              matchesSearch
            );
          }
        );

      return [...filtered].sort(
        (first, second) => {
          if (
            selectedSort ===
            "OLDEST"
          ) {
            return (
              getTimestamp(
                getPrimaryDate(first)
              ) -
              getTimestamp(
                getPrimaryDate(second)
              )
            );
          }

          if (
            selectedSort ===
            "WEIGHT_DESC"
          ) {
            return (
              Number(
                second.totalWeightKg ||
                  0
              ) -
              Number(
                first.totalWeightKg ||
                  0
              )
            );
          }

          if (
            selectedSort ===
            "STATUS"
          ) {
            return translateCollectionStatus(
              first.status
            ).localeCompare(
              translateCollectionStatus(
                second.status
              ),
              "pt-BR"
            );
          }

          return (
            getTimestamp(
              getPrimaryDate(second)
            ) -
            getTimestamp(
              getPrimaryDate(first)
            )
          );
        }
      );
    }, [
      collections,
      searchTerm,
      selectedFilter,
      selectedSort,
    ]);

  function handleRefresh() {
    setRefreshing(true);
    void loadCollections(false);
  }

  function openDetails(
    collectionId: string
  ) {
    router.push({
      pathname:
        "/(gerador)/collection-details",
      params: {
        id: collectionId,
      },
    } as never);
  }

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
          Carregando coletas...
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
              styles.headerIconButton
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
              styles.headerTitleContainer
            }
          >
            <Text
              style={
                styles.headerTitle
              }
            >
              Minhas coletas
            </Text>

            <Text
              style={
                styles.headerSubtitle
              }
            >
              Acompanhe a retirada, o recebimento e a destinação dos seus materiais.
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleRefresh}
            style={
              styles.headerIconButton
            }
          >
            <Ionicons
              name="refresh-outline"
              size={21}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        refreshControl={
          <RefreshControl
            refreshing={
              refreshing
            }
            onRefresh={
              handleRefresh
            }
          />
        }
        contentContainerStyle={
          styles.scrollContent
        }
      >
        <View
          style={
            styles.metricsGrid
          }
        >
          <MetricCard
            title="Total"
            value={String(
              metrics.total
            )}
            icon="documents-outline"
          />

          <MetricCard
            title="Em operação"
            value={String(
              metrics.active
            )}
            icon="car-outline"
          />

          <MetricCard
            title="Em processamento"
            value={String(
              metrics.processing
            )}
            icon="git-branch-outline"
          />

          <MetricCard
            title="Concluídas"
            value={String(
              metrics.completed
            )}
            icon="checkmark-done-outline"
          />
        </View>

        <View
          style={
            styles.weightSummary
          }
        >
          <View
            style={
              styles.weightIcon
            }
          >
            <Ionicons
              name="scale-outline"
              size={23}
              color="#15803D"
            />
          </View>

          <View
            style={
              styles.weightContent
            }
          >
            <Text
              style={
                styles.weightLabel
              }
            >
              Total coletado
            </Text>

            <Text
              style={
                styles.weightValue
              }
            >
              {metrics.totalWeight.toLocaleString(
                "pt-BR",
                {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                }
              )}{" "}
              kg
            </Text>
          </View>

          <Ionicons
            name="leaf-outline"
            size={25}
            color="#16A34A"
          />
        </View>

        <View
          style={styles.searchCard}
        >
          <View
            style={
              styles.searchInputContainer
            }
          >
            <Ionicons
              name="search-outline"
              size={20}
              color="#6B7280"
            />

            <TextInput
              value={searchTerm}
              onChangeText={
                setSearchTerm
              }
              placeholder="Pesquisar protocolo, material, rota ou veículo"
              placeholderTextColor="#9CA3AF"
              style={
                styles.searchInput
              }
            />

            {searchTerm ? (
              <TouchableOpacity
                onPress={() =>
                  setSearchTerm("")
                }
              >
                <Ionicons
                  name="close-circle"
                  size={20}
                  color="#9CA3AF"
                />
              </TouchableOpacity>
            ) : null}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={
              false
            }
            contentContainerStyle={
              styles.filterContent
            }
          >
            {FILTERS.map(
              (filter) => {
                const selected =
                  selectedFilter ===
                  filter.value;

                return (
                  <TouchableOpacity
                    key={
                      filter.value
                    }
                    onPress={() =>
                      setSelectedFilter(
                        filter.value
                      )
                    }
                    style={[
                      styles.filterChip,
                      selected &&
                        styles.filterChipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        selected &&
                          styles.filterChipTextSelected,
                      ]}
                    >
                      {filter.label}
                    </Text>
                  </TouchableOpacity>
                );
              }
            )}
          </ScrollView>

          <TouchableOpacity
            onPress={() =>
              setShowSortOptions(
                (current) =>
                  !current
              )
            }
            style={
              styles.sortButton
            }
          >
            <Ionicons
              name="swap-vertical-outline"
              size={18}
              color="#028C56"
            />

            <Text
              style={
                styles.sortButtonText
              }
            >
              {
                SORT_OPTIONS.find(
                  (option) =>
                    option.value ===
                    selectedSort
                )?.label
              }
            </Text>

            <Ionicons
              name={
                showSortOptions
                  ? "chevron-up"
                  : "chevron-down"
              }
              size={18}
              color="#028C56"
            />
          </TouchableOpacity>

          {showSortOptions ? (
            <View
              style={
                styles.sortOptions
              }
            >
              {SORT_OPTIONS.map(
                (
                  option,
                  index
                ) => {
                  const selected =
                    option.value ===
                    selectedSort;

                  return (
                    <TouchableOpacity
                      key={
                        option.value
                      }
                      onPress={() => {
                        setSelectedSort(
                          option.value
                        );
                        setShowSortOptions(
                          false
                        );
                      }}
                      style={[
                        styles.sortOption,
                        index ===
                          SORT_OPTIONS.length -
                            1 &&
                          styles.sortOptionLast,
                      ]}
                    >
                      <Text
                        style={[
                          styles.sortOptionText,
                          selected &&
                            styles.sortOptionTextSelected,
                        ]}
                      >
                        {
                          option.label
                        }
                      </Text>

                      {selected ? (
                        <Ionicons
                          name="checkmark"
                          size={18}
                          color="#028C56"
                        />
                      ) : null}
                    </TouchableOpacity>
                  );
                }
              )}
            </View>
          ) : null}
        </View>

        <View
          style={
            styles.listHeader
          }
        >
          <Text
            style={styles.listTitle}
          >
            Coletas
          </Text>

          <Text
            style={styles.listCount}
          >
            {
              visibleCollections.length
            }{" "}
            {visibleCollections.length ===
            1
              ? "registro"
              : "registros"}
          </Text>
        </View>

        {visibleCollections.length >
        0 ? (
          visibleCollections.map(
            (collection) => (
              <CollectionCard
                key={collection.id}
                collection={
                  collection
                }
                onPress={() =>
                  openDetails(
                    collection.id
                  )
                }
              />
            )
          )
        ) : (
          <EmptyState
            hasSearch={
              Boolean(
                searchTerm
              ) ||
              selectedFilter !==
                "ALL"
            }
            onClear={() => {
              setSearchTerm("");
              setSelectedFilter(
                "ALL"
              );
            }}
            onSchedules={() =>
              router.push(
                "/(gerador)/schedules"
              )
            }
          />
        )}
      </ScrollView>
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

function CollectionCard({
  collection,
  onPress,
}: {
  collection: CollectionListItem;
  onPress: () => void;
}) {
  const materials =
    getCollectionMaterials(
      collection
    );

  const statusColor =
    getCollectionStatusColor(
      collection.status
    );

  const totalWeight = Number(
    collection.totalWeightKg || 0
  );

  return (
    <TouchableOpacity
      activeOpacity={0.86}
      onPress={onPress}
      style={
        styles.collectionCard
      }
    >
      <View
        style={styles.cardHeader}
      >
        <View
          style={
            styles.protocolContainer
          }
        >
          <View
            style={[
              styles.statusIcon,
              {
                backgroundColor: `${statusColor}18`,
              },
            ]}
          >
            <Ionicons
              name={getCollectionStatusIcon(
                collection.status
              )}
              size={21}
              color={statusColor}
            />
          </View>

          <View
            style={
              styles.protocolTextContainer
            }
          >
            <Text
              style={
                styles.protocolLabel
              }
            >
              Coleta
            </Text>

            <Text
              style={
                styles.protocolValue
              }
            >
              #
              {collection.id
                .slice(-8)
                .toUpperCase()}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor:
                statusColor,
            },
          ]}
        >
          <Text
            style={
              styles.statusBadgeText
            }
          >
            {translateCollectionStatus(
              collection.status
            )}
          </Text>
        </View>
      </View>

      <View
        style={styles.generatorBox}
      >
        <View
          style={
            styles.generatorIcon
          }
        >
          <Ionicons
            name="business-outline"
            size={18}
            color="#15803D"
          />
        </View>

        <View
          style={
            styles.generatorContent
          }
        >
          <Text
            style={
              styles.generatorLabel
            }
          >
            Gerador
          </Text>

          <Text
            style={
              styles.generatorName
            }
            numberOfLines={1}
          >
            {getGeneratorName(
              collection
            )}
          </Text>

          <Text
            style={
              styles.generatorAddress
            }
            numberOfLines={2}
          >
            {getAddress(
              collection
            )}
          </Text>
        </View>
      </View>

      <View style={styles.infoGrid}>
        <InfoItem
          icon="calendar-outline"
          label="Data principal"
          value={formatDateTime(
            getPrimaryDate(
              collection
            )
          )}
        />

        <InfoItem
          icon="scale-outline"
          label="Peso coletado"
          value={`${totalWeight.toLocaleString(
            "pt-BR",
            {
              maximumFractionDigits: 2,
            }
          )} kg`}
        />

        <InfoItem
          icon="people-outline"
          label="Responsável"
          value={
            collection.collector
              ?.name ||
            collection.driver?.name ||
            "-"
          }
        />

        <InfoItem
          icon="car-outline"
          label="Veículo"
          value={
            [
              collection.vehicle
                ?.model,
              collection.vehicle
                ?.plate,
            ]
              .filter(Boolean)
              .join(" • ") || "-"
          }
        />

        <InfoItem
          icon="map-outline"
          label="Rota"
          value={
            collection.route?.name ||
            collection.route?.code ||
            "-"
          }
        />

        <InfoItem
          icon="business-outline"
          label="Cooperativa"
          value={getCooperativeName(
            collection
          )}
        />
      </View>

      <View
        style={
          styles.materialsSection
        }
      >
        <Text
          style={
            styles.sectionLabel
          }
        >
          Materiais coletados
        </Text>

        {materials.length > 0 ? (
          <View
            style={
              styles.materialChips
            }
          >
            {materials
              .slice(0, 4)
              .map(
                (
                  material,
                  index
                ) => {
                  const quantity =
                    getMaterialQuantity(
                      material
                    );

                  return (
                    <View
                      key={`${
                        collection.id
                      }_${index}_${getMaterialName(
                        material
                      )}`}
                      style={
                        styles.materialChip
                      }
                    >
                      <Text
                        style={
                          styles.materialChipName
                        }
                        numberOfLines={
                          1
                        }
                      >
                        {getMaterialName(
                          material
                        )}
                      </Text>

                      {quantity ? (
                        <Text
                          style={
                            styles.materialChipQuantity
                          }
                        >
                          {quantity}
                        </Text>
                      ) : null}
                    </View>
                  );
                }
              )}

            {materials.length > 4 ? (
              <View
                style={
                  styles.moreMaterialsChip
                }
              >
                <Text
                  style={
                    styles.moreMaterialsText
                  }
                >
                  +
                  {materials.length -
                    4}
                </Text>
              </View>
            ) : null}
          </View>
        ) : (
          <Text
            style={
              styles.noMaterialsText
            }
          >
            Os materiais ainda não foram registrados.
          </Text>
        )}
      </View>

      {collection.notes ? (
        <View
          style={
            styles.notesContainer
          }
        >
          <Ionicons
            name="document-text-outline"
            size={17}
            color="#6B7280"
          />

          <Text
            style={styles.notesText}
            numberOfLines={2}
          >
            {collection.notes}
          </Text>
        </View>
      ) : null}

      {collection.status ===
        "CANCELLED" &&
      collection.cancellationReason ? (
        <View
          style={
            styles.cancellationBox
          }
        >
          <Ionicons
            name="alert-circle-outline"
            size={18}
            color="#B91C1C"
          />

          <View
            style={
              styles.cancellationContent
            }
          >
            <Text
              style={
                styles.cancellationLabel
              }
            >
              Motivo do cancelamento
            </Text>

            <Text
              style={
                styles.cancellationText
              }
            >
              {
                collection.cancellationReason
              }
            </Text>
          </View>
        </View>
      ) : null}

      <View
        style={styles.cardFooter}
      >
        <Text
          style={styles.detailsText}
        >
          Acompanhar coleta
        </Text>

        <Ionicons
          name="arrow-forward"
          size={18}
          color="#028C56"
        />
      </View>
    </TouchableOpacity>
  );
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View
      style={styles.infoItem}
    >
      <Ionicons
        name={icon}
        size={17}
        color="#15803D"
      />

      <View
        style={
          styles.infoTextContainer
        }
      >
        <Text
          style={styles.infoLabel}
        >
          {label}
        </Text>

        <Text
          style={styles.infoValue}
          numberOfLines={2}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

function EmptyState({
  hasSearch,
  onClear,
  onSchedules,
}: {
  hasSearch: boolean;
  onClear: () => void;
  onSchedules: () => void;
}) {
  return (
    <View
      style={styles.emptyState}
    >
      <View
        style={styles.emptyIcon}
      >
        <Ionicons
          name={
            hasSearch
              ? "search-outline"
              : "car-outline"
          }
          size={38}
          color="#15803D"
        />
      </View>

      <Text
        style={styles.emptyTitle}
      >
        {hasSearch
          ? "Nenhuma coleta encontrada"
          : "Você ainda não possui coletas"}
      </Text>

      <Text
        style={
          styles.emptySubtitle
        }
      >
        {hasSearch
          ? "Altere os filtros ou a pesquisa para localizar outros registros."
          : "As coletas aparecerão aqui quando uma solicitação for delegada pela cooperativa."}
      </Text>

      <TouchableOpacity
        onPress={
          hasSearch
            ? onClear
            : onSchedules
        }
        style={styles.emptyButton}
      >
        <Ionicons
          name={
            hasSearch
              ? "refresh-outline"
              : "calendar-outline"
          }
          size={19}
          color="#FFFFFF"
        />

        <Text
          style={
            styles.emptyButtonText
          }
        >
          {hasSearch
            ? "Limpar filtros"
            : "Ver solicitações"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor:
        "#F3F4F6",
    },
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent:
        "center",
      backgroundColor:
        "#F8FAFC",
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
    headerIconButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor:
        "rgba(255,255,255,0.18)",
      alignItems: "center",
      justifyContent:
        "center",
    },
    headerTitleContainer: {
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
    metricsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent:
        "space-between",
    },
    metricCard: {
      width: "48.5%",
      marginBottom: 12,
      backgroundColor:
        "#FFFFFF",
      borderRadius: 17,
      padding: 15,
      borderWidth: 1,
      borderColor: "#E5E7EB",
    },
    metricIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor:
        "#DCFCE7",
      alignItems: "center",
      justifyContent:
        "center",
    },
    metricValue: {
      marginTop: 10,
      fontSize: 23,
      fontWeight: "800",
      color: "#111827",
    },
    metricTitle: {
      marginTop: 2,
      fontSize: 13,
      color: "#6B7280",
    },
    weightSummary: {
      marginTop: 2,
      marginBottom: 12,
      padding: 15,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: "#BBF7D0",
      backgroundColor:
        "#F0FDF4",
      flexDirection: "row",
      alignItems: "center",
    },
    weightIcon: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor:
        "#DCFCE7",
      alignItems: "center",
      justifyContent:
        "center",
    },
    weightContent: {
      flex: 1,
      marginLeft: 12,
    },
    weightLabel: {
      color: "#6B7280",
      fontSize: 12,
    },
    weightValue: {
      marginTop: 2,
      color: "#166534",
      fontSize: 21,
      fontWeight: "800",
    },
    searchCard: {
      backgroundColor:
        "#FFFFFF",
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
      borderColor: "#E5E7EB",
    },
    searchInputContainer: {
      height: 48,
      paddingHorizontal: 13,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "#D1D5DB",
      flexDirection: "row",
      alignItems: "center",
      backgroundColor:
        "#FFFFFF",
    },
    searchInput: {
      flex: 1,
      marginHorizontal: 9,
      fontSize: 14,
      color: "#111827",
    },
    filterContent: {
      paddingTop: 12,
      paddingRight: 8,
    },
    filterChip: {
      paddingHorizontal: 13,
      paddingVertical: 8,
      borderRadius: 18,
      marginRight: 8,
      borderWidth: 1,
      borderColor: "#D1D5DB",
      backgroundColor:
        "#FFFFFF",
    },
    filterChipSelected: {
      borderColor: "#028C56",
      backgroundColor:
        "#028C56",
    },
    filterChipText: {
      color: "#4B5563",
      fontSize: 13,
      fontWeight: "700",
    },
    filterChipTextSelected: {
      color: "#FFFFFF",
    },
    sortButton: {
      marginTop: 12,
      height: 44,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: "#BBF7D0",
      backgroundColor:
        "#F0FDF4",
      paddingHorizontal: 13,
      flexDirection: "row",
      alignItems: "center",
    },
    sortButtonText: {
      flex: 1,
      marginLeft: 8,
      color: "#166534",
      fontSize: 13,
      fontWeight: "700",
    },
    sortOptions: {
      marginTop: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "#E5E7EB",
      overflow: "hidden",
    },
    sortOption: {
      paddingHorizontal: 13,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      borderBottomWidth: 1,
      borderBottomColor:
        "#E5E7EB",
    },
    sortOptionLast: {
      borderBottomWidth: 0,
    },
    sortOptionText: {
      flex: 1,
      color: "#4B5563",
      fontSize: 14,
    },
    sortOptionTextSelected: {
      color: "#028C56",
      fontWeight: "800",
    },
    listHeader: {
      marginTop: 19,
      marginBottom: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
    },
    listTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: "#111827",
    },
    listCount: {
      fontSize: 13,
      color: "#6B7280",
    },
    collectionCard: {
      marginBottom: 14,
      backgroundColor:
        "#FFFFFF",
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: "#E5E7EB",
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
    },
    protocolContainer: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
    },
    statusIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent:
        "center",
    },
    protocolTextContainer: {
      marginLeft: 10,
    },
    protocolLabel: {
      fontSize: 12,
      color: "#6B7280",
    },
    protocolValue: {
      marginTop: 2,
      fontSize: 15,
      fontWeight: "800",
      color: "#111827",
    },
    statusBadge: {
      maxWidth: 112,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 14,
    },
    statusBadgeText: {
      color: "#FFFFFF",
      fontSize: 10,
      fontWeight: "800",
      textAlign: "center",
    },
    generatorBox: {
      marginTop: 14,
      padding: 12,
      borderRadius: 13,
      backgroundColor:
        "#F0FDF4",
      flexDirection: "row",
      alignItems: "center",
    },
    generatorIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor:
        "#DCFCE7",
      alignItems: "center",
      justifyContent:
        "center",
    },
    generatorContent: {
      flex: 1,
      marginLeft: 10,
    },
    generatorLabel: {
      color: "#6B7280",
      fontSize: 10,
    },
    generatorName: {
      marginTop: 2,
      color: "#166534",
      fontSize: 14,
      fontWeight: "800",
    },
    generatorAddress: {
      marginTop: 2,
      color: "#6B7280",
      fontSize: 11,
      lineHeight: 15,
    },
    infoGrid: {
      marginTop: 15,
      flexDirection: "row",
      flexWrap: "wrap",
    },
    infoItem: {
      width: "50%",
      marginBottom: 13,
      paddingRight: 8,
      flexDirection: "row",
      alignItems:
        "flex-start",
    },
    infoTextContainer: {
      flex: 1,
      marginLeft: 7,
    },
    infoLabel: {
      fontSize: 11,
      color: "#9CA3AF",
    },
    infoValue: {
      marginTop: 2,
      fontSize: 12,
      fontWeight: "700",
      color: "#374151",
      lineHeight: 17,
    },
    materialsSection: {
      paddingTop: 13,
      borderTopWidth: 1,
      borderTopColor:
        "#E5E7EB",
    },
    sectionLabel: {
      marginBottom: 9,
      fontSize: 12,
      fontWeight: "700",
      color: "#6B7280",
    },
    materialChips: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    materialChip: {
      maxWidth: "72%",
      marginRight: 7,
      marginBottom: 7,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 12,
      backgroundColor:
        "#F0FDF4",
      borderWidth: 1,
      borderColor: "#BBF7D0",
    },
    materialChipName: {
      color: "#166534",
      fontSize: 12,
      fontWeight: "700",
    },
    materialChipQuantity: {
      marginTop: 2,
      color: "#4B5563",
      fontSize: 10,
    },
    moreMaterialsChip: {
      marginBottom: 7,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 12,
      backgroundColor:
        "#E5E7EB",
      justifyContent:
        "center",
    },
    moreMaterialsText: {
      color: "#4B5563",
      fontSize: 12,
      fontWeight: "800",
    },
    noMaterialsText: {
      color: "#9CA3AF",
      fontSize: 13,
    },
    notesContainer: {
      marginTop: 11,
      padding: 11,
      borderRadius: 11,
      backgroundColor:
        "#FFFBEB",
      flexDirection: "row",
      alignItems:
        "flex-start",
    },
    notesText: {
      flex: 1,
      marginLeft: 8,
      color: "#6B7280",
      fontSize: 12,
      lineHeight: 17,
    },
    cancellationBox: {
      marginTop: 11,
      padding: 11,
      borderRadius: 11,
      backgroundColor:
        "#FEF2F2",
      borderWidth: 1,
      borderColor: "#FECACA",
      flexDirection: "row",
      alignItems:
        "flex-start",
    },
    cancellationContent: {
      flex: 1,
      marginLeft: 8,
    },
    cancellationLabel: {
      color: "#B91C1C",
      fontSize: 11,
      fontWeight: "800",
    },
    cancellationText: {
      marginTop: 3,
      color: "#7F1D1D",
      fontSize: 12,
      lineHeight: 17,
    },
    cardFooter: {
      marginTop: 13,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor:
        "#E5E7EB",
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "flex-end",
    },
    detailsText: {
      marginRight: 7,
      color: "#028C56",
      fontSize: 13,
      fontWeight: "800",
    },
    emptyState: {
      marginTop: 2,
      backgroundColor:
        "#FFFFFF",
      borderRadius: 18,
      paddingHorizontal: 24,
      paddingVertical: 34,
      borderWidth: 1,
      borderColor: "#E5E7EB",
      alignItems: "center",
    },
    emptyIcon: {
      width: 70,
      height: 70,
      borderRadius: 35,
      backgroundColor:
        "#DCFCE7",
      alignItems: "center",
      justifyContent:
        "center",
    },
    emptyTitle: {
      marginTop: 15,
      fontSize: 17,
      fontWeight: "800",
      color: "#111827",
      textAlign: "center",
    },
    emptySubtitle: {
      marginTop: 7,
      color: "#6B7280",
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
    },
    emptyButton: {
      marginTop: 17,
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor:
        "#028C56",
      flexDirection: "row",
      alignItems: "center",
    },
    emptyButtonText: {
      marginLeft: 8,
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "800",
    },
  });
