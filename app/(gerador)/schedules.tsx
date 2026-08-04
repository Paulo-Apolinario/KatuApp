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
import { scheduleService } from "@/src/services/scheduleService";

import type {
  Schedule,
  ScheduleRequestedMaterialRecord,
  ScheduleStatus,
} from "@/src/types/schedule";

type FilterValue = "ALL" | ScheduleStatus;

type SortValue =
  | "NEWEST"
  | "OLDEST"
  | "PREFERRED_DATE"
  | "STATUS";

const FILTERS: {
  value: FilterValue;
  label: string;
}[] = [
  { value: "ALL", label: "Todas" },
  { value: "REQUESTED", label: "Solicitadas" },
  { value: "SCHEDULED", label: "Agendadas" },
  { value: "IN_PROGRESS", label: "Em andamento" },
  { value: "COMPLETED", label: "Concluídas" },
  { value: "CANCELLED", label: "Canceladas" },
];

const SORT_OPTIONS: {
  value: SortValue;
  label: string;
}[] = [
  { value: "NEWEST", label: "Mais recentes" },
  { value: "OLDEST", label: "Mais antigas" },
  { value: "PREFERRED_DATE", label: "Data preferencial" },
  { value: "STATUS", label: "Status" },
];

function formatDateTime(value?: string | null) {
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

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("pt-BR");
}

function translateStatus(status: ScheduleStatus) {
  const labels: Record<ScheduleStatus, string> = {
    REQUESTED: "Solicitada",
    SCHEDULED: "Agendada",
    IN_PROGRESS: "Em andamento",
    COMPLETED: "Concluída",
    CANCELLED: "Cancelada",
  };

  return labels[status];
}

function getStatusColor(status: ScheduleStatus) {
  const colors: Record<ScheduleStatus, string> = {
    REQUESTED: "#64748B",
    SCHEDULED: "#2563EB",
    IN_PROGRESS: "#F59E0B",
    COMPLETED: "#16A34A",
    CANCELLED: "#DC2626",
  };

  return colors[status];
}

function getStatusIcon(
  status: ScheduleStatus
): keyof typeof Ionicons.glyphMap {
  const icons: Record<
    ScheduleStatus,
    keyof typeof Ionicons.glyphMap
  > = {
    REQUESTED: "time-outline",
    SCHEDULED: "calendar-outline",
    IN_PROGRESS: "sync-outline",
    COMPLETED: "checkmark-circle-outline",
    CANCELLED: "close-circle-outline",
  };

  return icons[status];
}

function getMaterialName(
  material: ScheduleRequestedMaterialRecord
) {
  return (
    material.nameSnapshot ||
    material.wasteType?.name ||
    material.catalogSuggestion?.name ||
    "Material"
  );
}

function getMaterialQuantity(
  material: ScheduleRequestedMaterialRecord
) {
  const quantity = Number(
    material.estimatedQuantity || 0
  );

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }

  return `${quantity.toLocaleString("pt-BR")} ${
    material.unit || "KG"
  }`;
}

function getEstimatedWeight(
  materials?: ScheduleRequestedMaterialRecord[]
) {
  if (!Array.isArray(materials)) {
    return 0;
  }

  return materials.reduce((total, material) => {
    if (material.unit !== "KG") {
      return total;
    }

    const quantity = Number(
      material.estimatedQuantity || 0
    );

    return Number.isFinite(quantity)
      ? total + quantity
      : total;
  }, 0);
}

function getSearchableText(schedule: Schedule) {
  const materials = Array.isArray(
    schedule.requestedMaterials
  )
    ? schedule.requestedMaterials
        .map(getMaterialName)
        .join(" ")
    : "";

  const cooperativeName =
    schedule.cooperative?.name ??
    "";

  return [
    schedule.id,
    schedule.notes,
    cooperativeName,
    materials,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("pt-BR");
}

function getTimestamp(value?: string | null) {
  if (!value) {
    return 0;
  }

  const date = new Date(value);
  const timestamp = date.getTime();

  return Number.isNaN(timestamp)
    ? 0
    : timestamp;
}

export default function GeneratorSchedulesScreen() {
  const { notifyError } = useNotification();

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [schedules, setSchedules] =
    useState<Schedule[]>([]);

  const [searchTerm, setSearchTerm] =
    useState("");

  const [selectedFilter, setSelectedFilter] =
    useState<FilterValue>("ALL");

  const [selectedSort, setSelectedSort] =
    useState<SortValue>("NEWEST");

  const [showSortOptions, setShowSortOptions] =
    useState(false);

  const loadSchedules = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) {
          setLoading(true);
        }

        const response =
          await scheduleService.list();

        setSchedules(
          Array.isArray(response)
            ? response
            : []
        );
      } catch (error) {
        console.error(
          "Erro ao carregar solicitações:",
          error
        );

        notifyError(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar suas solicitações."
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
      void loadSchedules(true);
    }, [loadSchedules])
  );

  const metrics = useMemo(() => {
    return {
      total: schedules.length,
      open: schedules.filter(
        (schedule) =>
          schedule.status === "REQUESTED" ||
          schedule.status === "SCHEDULED" ||
          schedule.status === "IN_PROGRESS"
      ).length,
      scheduled: schedules.filter(
        (schedule) =>
          schedule.status === "SCHEDULED"
      ).length,
      completed: schedules.filter(
        (schedule) =>
          schedule.status === "COMPLETED"
      ).length,
    };
  }, [schedules]);

  const visibleSchedules = useMemo(() => {
    const normalizedSearch = searchTerm
      .trim()
      .toLocaleLowerCase("pt-BR");

    const filtered = schedules.filter(
      (schedule) => {
        const matchesFilter =
          selectedFilter === "ALL" ||
          schedule.status === selectedFilter;

        const matchesSearch =
          !normalizedSearch ||
          getSearchableText(schedule).includes(
            normalizedSearch
          );

        return matchesFilter && matchesSearch;
      }
    );

    return [...filtered].sort(
      (first, second) => {
        if (selectedSort === "OLDEST") {
          return (
            getTimestamp(first.createdAt) -
            getTimestamp(second.createdAt)
          );
        }

        if (selectedSort === "PREFERRED_DATE") {
          return (
            getTimestamp(
              first.preferredDate ||
                first.scheduledDate
            ) -
            getTimestamp(
              second.preferredDate ||
                second.scheduledDate
            )
          );
        }

        if (selectedSort === "STATUS") {
          return translateStatus(
            first.status
          ).localeCompare(
            translateStatus(second.status),
            "pt-BR"
          );
        }

        return (
          getTimestamp(second.createdAt) -
          getTimestamp(first.createdAt)
        );
      }
    );
  }, [
    schedules,
    searchTerm,
    selectedFilter,
    selectedSort,
  ]);

  function handleRefresh() {
    setRefreshing(true);
    void loadSchedules(false);
  }

  function openDetails(scheduleId: string) {
    router.push({
      pathname:
        "/(gerador)/schedule-details",
      params: {
        id: scheduleId,
      },
    } as never);
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color="#028C56"
        />

        <Text style={styles.loadingText}>
          Carregando solicitações...
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
        <View style={styles.headerTop}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerIconButton}
          >
            <Ionicons
              name="arrow-back"
              size={22}
              color="#FFFFFF"
            />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>
              Minhas solicitações
            </Text>

            <Text style={styles.headerSubtitle}>
              Consulte e acompanhe seus pedidos de coleta.
            </Text>
          </View>

          <TouchableOpacity
            onPress={() =>
              router.push(
                "/(gerador)/schedule"
              )
            }
            style={styles.headerIconButton}
          >
            <Ionicons
              name="add"
              size={24}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        }
        contentContainerStyle={
          styles.scrollContent
        }
      >
        <View style={styles.metricsGrid}>
          <MetricCard
            title="Total"
            value={metrics.total}
            icon="documents-outline"
          />

          <MetricCard
            title="Em aberto"
            value={metrics.open}
            icon="time-outline"
          />

          <MetricCard
            title="Agendadas"
            value={metrics.scheduled}
            icon="calendar-outline"
          />

          <MetricCard
            title="Concluídas"
            value={metrics.completed}
            icon="checkmark-done-outline"
          />
        </View>

        <View style={styles.searchCard}>
          <View style={styles.searchInputContainer}>
            <Ionicons
              name="search-outline"
              size={20}
              color="#6B7280"
            />

            <TextInput
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder="Pesquisar material, protocolo ou observação"
              placeholderTextColor="#9CA3AF"
              style={styles.searchInput}
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
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={
              styles.filterContent
            }
          >
            {FILTERS.map((filter) => {
              const selected =
                selectedFilter ===
                filter.value;

              return (
                <TouchableOpacity
                  key={filter.value}
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
            })}
          </ScrollView>

          <TouchableOpacity
            onPress={() =>
              setShowSortOptions(
                (current) => !current
              )
            }
            style={styles.sortButton}
          >
            <Ionicons
              name="swap-vertical-outline"
              size={18}
              color="#028C56"
            />

            <Text style={styles.sortButtonText}>
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
            <View style={styles.sortOptions}>
              {SORT_OPTIONS.map(
                (option, index) => {
                  const selected =
                    option.value ===
                    selectedSort;

                  return (
                    <TouchableOpacity
                      key={option.value}
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
                        {option.label}
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

        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>
            Solicitações
          </Text>

          <Text style={styles.listCount}>
            {visibleSchedules.length}{" "}
            {visibleSchedules.length === 1
              ? "registro"
              : "registros"}
          </Text>
        </View>

        {visibleSchedules.length > 0 ? (
          visibleSchedules.map(
            (schedule) => (
              <ScheduleCard
                key={schedule.id}
                schedule={schedule}
                onPress={() =>
                  openDetails(schedule.id)
                }
              />
            )
          )
        ) : (
          <EmptyState
            hasSearch={
              Boolean(searchTerm) ||
              selectedFilter !== "ALL"
            }
            onCreate={() =>
              router.push(
                "/(gerador)/schedule"
              )
            }
            onClear={() => {
              setSearchTerm("");
              setSelectedFilter("ALL");
            }}
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
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricIcon}>
        <Ionicons
          name={icon}
          size={20}
          color="#15803D"
        />
      </View>

      <Text style={styles.metricValue}>
        {value}
      </Text>

      <Text style={styles.metricTitle}>
        {title}
      </Text>
    </View>
  );
}

function ScheduleCard({
  schedule,
  onPress,
}: {
  schedule: Schedule;
  onPress: () => void;
}) {
  const materials = Array.isArray(
    schedule.requestedMaterials
  )
    ? schedule.requestedMaterials
    : [];

  const estimatedWeight =
    getEstimatedWeight(materials);

  const cooperativeName =
    schedule.cooperative?.name ??
    ""
  return (
    <TouchableOpacity
      activeOpacity={0.86}
      onPress={onPress}
      style={styles.scheduleCard}
    >
      <View style={styles.cardHeader}>
        <View style={styles.protocolContainer}>
          <View
            style={[
              styles.statusIcon,
              {
                backgroundColor: `${getStatusColor(
                  schedule.status
                )}18`,
              },
            ]}
          >
            <Ionicons
              name={getStatusIcon(
                schedule.status
              )}
              size={20}
              color={getStatusColor(
                schedule.status
              )}
            />
          </View>

          <View style={styles.protocolTextContainer}>
            <Text style={styles.protocolLabel}>
              Solicitação
            </Text>

            <Text style={styles.protocolValue}>
              #
              {schedule.id
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
                getStatusColor(
                  schedule.status
                ),
            },
          ]}
        >
          <Text style={styles.statusBadgeText}>
            {translateStatus(
              schedule.status
            )}
          </Text>
        </View>
      </View>

      <View style={styles.infoGrid}>
        <InfoItem
          icon="calendar-outline"
          label="Data preferencial"
          value={formatDateTime(
            schedule.preferredDate
          )}
        />

        <InfoItem
          icon="checkmark-circle-outline"
          label="Data agendada"
          value={formatDateTime(
            schedule.scheduledDate
          )}
        />

        <InfoItem
          icon="business-outline"
          label="Cooperativa"
          value={cooperativeName}
        />

        <InfoItem
          icon="cube-outline"
          label="Materiais"
          value={String(materials.length)}
        />
      </View>

      <View style={styles.materialsSection}>
        <Text style={styles.sectionLabel}>
          Materiais solicitados
        </Text>

        {materials.length > 0 ? (
          <View style={styles.materialChips}>
            {materials
              .slice(0, 4)
              .map((material) => {
                const quantity =
                  getMaterialQuantity(
                    material
                  );

                return (
                  <View
                    key={material.id}
                    style={
                      styles.materialChip
                    }
                  >
                    <Text
                      style={
                        styles.materialChipName
                      }
                      numberOfLines={1}
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
              })}

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
                  +{materials.length - 4}
                </Text>
              </View>
            ) : null}
          </View>
        ) : (
          <Text style={styles.noMaterialsText}>
            Nenhum material informado.
          </Text>
        )}
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>
            Peso estimado
          </Text>

          <Text style={styles.summaryValue}>
            {estimatedWeight > 0
              ? `${estimatedWeight.toLocaleString(
                  "pt-BR"
                )} kg`
              : "-"}
          </Text>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>
            Solicitada em
          </Text>

          <Text style={styles.summaryValue}>
            {formatDate(
              schedule.createdAt
            )}
          </Text>
        </View>
      </View>

      {schedule.notes ? (
        <View style={styles.notesContainer}>
          <Ionicons
            name="document-text-outline"
            size={17}
            color="#6B7280"
          />

          <Text
            style={styles.notesText}
            numberOfLines={2}
          >
            {schedule.notes}
          </Text>
        </View>
      ) : null}

      <View style={styles.cardFooter}>
        <Text style={styles.detailsText}>
          Ver detalhes
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
    <View style={styles.infoItem}>
      <Ionicons
        name={icon}
        size={17}
        color="#15803D"
      />

      <View style={styles.infoTextContainer}>
        <Text style={styles.infoLabel}>
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
  onCreate,
  onClear,
}: {
  hasSearch: boolean;
  onCreate: () => void;
  onClear: () => void;
}) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons
          name={
            hasSearch
              ? "search-outline"
              : "calendar-clear-outline"
          }
          size={38}
          color="#15803D"
        />
      </View>

      <Text style={styles.emptyTitle}>
        {hasSearch
          ? "Nenhuma solicitação encontrada"
          : "Você ainda não possui solicitações"}
      </Text>

      <Text style={styles.emptySubtitle}>
        {hasSearch
          ? "Altere os filtros ou a pesquisa para localizar outros registros."
          : "Crie sua primeira solicitação para que a cooperativa programe uma coleta."}
      </Text>

      <TouchableOpacity
        onPress={
          hasSearch
            ? onClear
            : onCreate
        }
        style={styles.emptyButton}
      >
        <Ionicons
          name={
            hasSearch
              ? "refresh-outline"
              : "add-circle-outline"
          }
          size={19}
          color="#FFFFFF"
        />

        <Text style={styles.emptyButtonText}>
          {hasSearch
            ? "Limpar filtros"
            : "Nova solicitação"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

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
  headerIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor:
      "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
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
    justifyContent: "space-between",
  },
  metricCard: {
    width: "48.5%",
    marginBottom: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 17,
    padding: 15,
    borderWidth: 1,
    borderColor: "#E5E7EB",
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
    fontSize: 23,
    fontWeight: "800",
    color: "#111827",
  },
  metricTitle: {
    marginTop: 2,
    fontSize: 13,
    color: "#6B7280",
  },
  searchCard: {
    marginTop: 4,
    backgroundColor: "#FFFFFF",
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
    backgroundColor: "#FFFFFF",
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
    backgroundColor: "#FFFFFF",
  },
  filterChipSelected: {
    borderColor: "#028C56",
    backgroundColor: "#028C56",
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
    backgroundColor: "#F0FDF4",
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
    borderBottomColor: "#E5E7EB",
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
    justifyContent: "space-between",
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
  scheduleCard: {
    marginBottom: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
    justifyContent: "center",
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
    alignItems: "flex-start",
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
    borderTopColor: "#E5E7EB",
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
    backgroundColor: "#F0FDF4",
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
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
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
  summaryRow: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#F9FAFB",
    flexDirection: "row",
    alignItems: "center",
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryDivider: {
    width: 1,
    height: 34,
    backgroundColor: "#E5E7EB",
  },
  summaryLabel: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  summaryValue: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: "800",
    color: "#374151",
  },
  notesContainer: {
    marginTop: 11,
    padding: 11,
    borderRadius: 11,
    backgroundColor: "#FFFBEB",
    flexDirection: "row",
    alignItems: "flex-start",
  },
  notesText: {
    flex: 1,
    marginLeft: 8,
    color: "#6B7280",
    fontSize: 12,
    lineHeight: 17,
  },
  cardFooter: {
    marginTop: 13,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  detailsText: {
    marginRight: 7,
    color: "#028C56",
    fontSize: 13,
    fontWeight: "800",
  },
  emptyState: {
    marginTop: 2,
    backgroundColor: "#FFFFFF",
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
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
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
    backgroundColor: "#028C56",
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
