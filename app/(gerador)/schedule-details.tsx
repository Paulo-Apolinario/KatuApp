import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
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
import { scheduleService } from "@/src/services/scheduleService";

import type {
  Schedule,
  ScheduleRequestedMaterialRecord,
  ScheduleStatus,
} from "@/src/types/schedule";

import type {
  Collection,
  CollectionStatus,
} from "@/src/types/collection";

type ScheduleDetails = Schedule & {
  collection?: Collection | null;
  collections?: Collection[];
  cooperative?: {
    id?: string;
    name?: string | null;
    companyName?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  generator?: {
    id?: string;
    name?: string | null;
    companyName?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    street?: string | null;
    number?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
  } | null;
};

type TimelineStep = {
  key: string;
  title: string;
  description: string;
  completed: boolean;
  current: boolean;
  date?: string | null;
  icon: keyof typeof Ionicons.glyphMap;
};

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

function translateScheduleStatus(
  status: ScheduleStatus
) {
  const labels: Record<
    ScheduleStatus,
    string
  > = {
    REQUESTED: "Solicitada",
    SCHEDULED: "Agendada",
    IN_PROGRESS: "Em andamento",
    COMPLETED: "Concluída",
    CANCELLED: "Cancelada",
  };

  return labels[status];
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

function getScheduleStatusColor(
  status: ScheduleStatus
) {
  const colors: Record<
    ScheduleStatus,
    string
  > = {
    REQUESTED: "#64748B",
    SCHEDULED: "#2563EB",
    IN_PROGRESS: "#F59E0B",
    COMPLETED: "#16A34A",
    CANCELLED: "#DC2626",
  };

  return colors[status];
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

function getMaterialCategory(
  material: ScheduleRequestedMaterialRecord
) {
  return (
    material.wasteType?.category ||
    material.catalogSuggestion?.category ||
    material.categorySnapshot ||
    null
  );
}

function getMaterialSubcategory(
  material: ScheduleRequestedMaterialRecord
) {
  return (
    material.wasteType?.subcategory ||
    material.catalogSuggestion?.subcategory ||
    material.subcategorySnapshot ||
    null
  );
}

function getQuantityLabel(
  material: ScheduleRequestedMaterialRecord
) {
  const quantity = Number(
    material.estimatedQuantity || 0
  );

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return "Quantidade não informada";
  }

  return `${quantity.toLocaleString("pt-BR")} ${
    material.unit || "KG"
  }`;
}

function getEstimatedWeight(
  materials: ScheduleRequestedMaterialRecord[]
) {
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

function getCollections(
  schedule: ScheduleDetails
) {
  if (
    Array.isArray(schedule.collections) &&
    schedule.collections.length > 0
  ) {
    return schedule.collections;
  }

  if (schedule.collection) {
    return [schedule.collection];
  }

  return [];
}

function buildGeneratorAddress(
  generator?: ScheduleDetails["generator"]
) {
  if (!generator) {
    return "-";
  }

  if (generator.address) {
    return generator.address;
  }

  const streetLine = [
    generator.street,
    generator.number,
  ]
    .filter(Boolean)
    .join(", ");

  const districtLine = [
    generator.neighborhood,
    generator.city,
    generator.state,
  ]
    .filter(Boolean)
    .join(" - ");

  return (
    [streetLine, districtLine, generator.zipCode]
      .filter(Boolean)
      .join(" • ") || "-"
  );
}

function buildTimeline(
  schedule: ScheduleDetails,
  linkedCollection?: Collection
): TimelineStep[] {
  const scheduleStatus = schedule.status;
  const collectionStatus =
    linkedCollection?.status;

  const cancelled =
    scheduleStatus === "CANCELLED" ||
    collectionStatus === "CANCELLED";

  if (cancelled) {
    return [
      {
        key: "requested",
        title: "Solicitação criada",
        description:
          "A solicitação foi registrada pelo gerador.",
        completed: true,
        current: false,
        date: schedule.createdAt,
        icon: "document-text-outline",
      },
      {
        key: "cancelled",
        title: "Fluxo cancelado",
        description:
          "A solicitação ou a coleta vinculada foi cancelada.",
        completed: true,
        current: true,
        date:
          linkedCollection?.updatedAt ||
          schedule.updatedAt,
        icon: "close-circle-outline",
      },
    ];
  }

  const hasSchedule =
    scheduleStatus === "SCHEDULED" ||
    scheduleStatus === "IN_PROGRESS" ||
    scheduleStatus === "COMPLETED" ||
    Boolean(schedule.scheduledDate);

  const hasCollection =
    Boolean(linkedCollection);

  const collectionStarted =
    collectionStatus === "IN_PROGRESS" ||
    collectionStatus === "COLLECTED" ||
    collectionStatus === "RECEIVED" ||
    collectionStatus === "SORTING" ||
    collectionStatus === "COMPLETED";

  const collected =
    collectionStatus === "COLLECTED" ||
    collectionStatus === "RECEIVED" ||
    collectionStatus === "SORTING" ||
    collectionStatus === "COMPLETED";

  const received =
    collectionStatus === "RECEIVED" ||
    collectionStatus === "SORTING" ||
    collectionStatus === "COMPLETED";

  const sorting =
    collectionStatus === "SORTING" ||
    collectionStatus === "COMPLETED";

  const completed =
    scheduleStatus === "COMPLETED" ||
    collectionStatus === "COMPLETED";

  const currentKey = completed
    ? "completed"
    : sorting
      ? "sorting"
      : received
        ? "received"
        : collected
          ? "collected"
          : collectionStarted
            ? "in_progress"
            : hasCollection
              ? "delegated"
              : hasSchedule
                ? "scheduled"
                : "requested";

  return [
    {
      key: "requested",
      title: "Solicitação criada",
      description:
        "A solicitação foi registrada e enviada para a cooperativa.",
      completed: true,
      current: currentKey === "requested",
      date: schedule.createdAt,
      icon: "document-text-outline",
    },
    {
      key: "scheduled",
      title: "Coleta agendada",
      description:
        "A cooperativa confirmou a data da coleta.",
      completed: hasSchedule,
      current: currentKey === "scheduled",
      date: schedule.scheduledDate,
      icon: "calendar-outline",
    },
    {
      key: "delegated",
      title: "Coleta delegada",
      description:
        "A solicitação foi transformada em coleta operacional.",
      completed: hasCollection,
      current: currentKey === "delegated",
      date: linkedCollection?.createdAt,
      icon: "people-outline",
    },
    {
      key: "in_progress",
      title: "Coleta em andamento",
      description:
        "A equipe responsável iniciou o atendimento.",
      completed: collectionStarted,
      current: currentKey === "in_progress",
      date:
        linkedCollection?.startedAt ||
        linkedCollection?.updatedAt,
      icon: "car-outline",
    },
    {
      key: "collected",
      title: "Materiais coletados",
      description:
        "O catador registrou os materiais retirados no local.",
      completed: collected,
      current: currentKey === "collected",
      date:
        linkedCollection?.collectedAt ||
        linkedCollection?.updatedAt,
      icon: "cube-outline",
    },
    {
      key: "received",
      title: "Recebido pela cooperativa",
      description:
        "Os resíduos chegaram à cooperativa para conferência.",
      completed: received,
      current: currentKey === "received",
      date:
        linkedCollection?.receivedAt ||
        linkedCollection?.updatedAt,
      icon: "business-outline",
    },
    {
      key: "sorting",
      title: "Em triagem",
      description:
        "Os materiais estão sendo classificados e destinados.",
      completed: sorting,
      current: currentKey === "sorting",
      date:
        linkedCollection?.sortingStartedAt ||
        linkedCollection?.updatedAt,
      icon: "git-branch-outline",
    },
    {
      key: "completed",
      title: "Processo concluído",
      description:
        "A coleta e o processamento dos resíduos foram finalizados.",
      completed,
      current: currentKey === "completed",
      date:
        linkedCollection?.completedAt ||
        schedule.updatedAt,
      icon: "checkmark-done-outline",
    },
  ];
}

export default function GeneratorScheduleDetailsScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();

  const scheduleId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const { notifyError } = useNotification();

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [schedule, setSchedule] =
    useState<ScheduleDetails | null>(null);

  const loadSchedule = useCallback(
    async (showLoader = true) => {
      if (!scheduleId) {
        setLoading(false);
        notifyError(
          "ID da solicitação não informado."
        );
        return;
      }

      try {
        if (showLoader) {
          setLoading(true);
        }

        const response =
          await scheduleService.getById(
            scheduleId
          );

        setSchedule(
          response as ScheduleDetails
        );
      } catch (error) {
        console.error(
          "Erro ao carregar detalhes da solicitação:",
          error
        );

        notifyError(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os detalhes da solicitação."
        );
      } finally {
        if (showLoader) {
          setLoading(false);
        }

        setRefreshing(false);
      }
    },
    [
      notifyError,
      scheduleId,
    ]
  );

  useFocusEffect(
    useCallback(() => {
      void loadSchedule(true);
    }, [loadSchedule])
  );

  const materials = useMemo(
    () =>
      Array.isArray(
        schedule?.requestedMaterials
      )
        ? schedule.requestedMaterials
        : [],
    [schedule]
  );

  const collections = useMemo(
    () =>
      schedule
        ? getCollections(schedule)
        : [],
    [schedule]
  );

  const linkedCollection =
    collections[0];

  const timeline = useMemo(
    () =>
      schedule
        ? buildTimeline(
            schedule,
            linkedCollection
          )
        : [],
    [
      schedule,
      linkedCollection,
    ]
  );

  const estimatedWeight =
    getEstimatedWeight(materials);

  function handleRefresh() {
    setRefreshing(true);
    void loadSchedule(false);
  }

  function openCollection(
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color="#028C56"
        />

        <Text style={styles.loadingText}>
          Carregando solicitação...
        </Text>
      </View>
    );
  }

  if (!schedule) {
    return (
      <View style={styles.notFoundContainer}>
        <View style={styles.notFoundIcon}>
          <Ionicons
            name="alert-circle-outline"
            size={42}
            color="#B45309"
          />
        </View>

        <Text style={styles.notFoundTitle}>
          Solicitação não encontrada
        </Text>

        <Text style={styles.notFoundText}>
          Não foi possível localizar os dados desta solicitação.
        </Text>

        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.notFoundButton}
        >
          <Text style={styles.notFoundButtonText}>
            Voltar
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const cooperativeName =
    schedule.cooperative?.name ||
    schedule.cooperative?.companyName ||
    "Cooperativa responsável";

  const generatorName =
    schedule.generator?.name ||
    schedule.generator?.companyName ||
    "Gerador";

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
            style={styles.headerButton}
          >
            <Ionicons
              name="arrow-back"
              size={22}
              color="#FFFFFF"
            />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerEyebrow}>
              Detalhes da solicitação
            </Text>

            <Text style={styles.headerTitle}>
              #
              {schedule.id
                .slice(-8)
                .toUpperCase()}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleRefresh}
            style={styles.headerButton}
          >
            <Ionicons
              name="refresh-outline"
              size={21}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>

        <View style={styles.headerStatusRow}>
          <View
            style={[
              styles.headerStatusBadge,
              {
                backgroundColor:
                  getScheduleStatusColor(
                    schedule.status
                  ),
              },
            ]}
          >
            <Text
              style={
                styles.headerStatusText
              }
            >
              {translateScheduleStatus(
                schedule.status
              )}
            </Text>
          </View>

          <Text style={styles.headerDate}>
            Criada em{" "}
            {formatDateTime(
              schedule.createdAt
            )}
          </Text>
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
        <SectionCard
          title="Resumo da solicitação"
          icon="information-circle-outline"
        >
          <View style={styles.summaryGrid}>
            <SummaryItem
              label="Data preferencial"
              value={formatDateTime(
                schedule.preferredDate
              )}
              icon="calendar-outline"
            />

            <SummaryItem
              label="Data agendada"
              value={formatDateTime(
                schedule.scheduledDate
              )}
              icon="checkmark-circle-outline"
            />

            <SummaryItem
              label="Materiais"
              value={String(
                materials.length
              )}
              icon="cube-outline"
            />

            <SummaryItem
              label="Peso estimado"
              value={
                estimatedWeight > 0
                  ? `${estimatedWeight.toLocaleString(
                      "pt-BR"
                    )} kg`
                  : "-"
              }
              icon="scale-outline"
            />
          </View>
        </SectionCard>

        <SectionCard
          title="Acompanhamento"
          icon="git-branch-outline"
        >
          <View style={styles.timeline}>
            {timeline.map(
              (step, index) => (
                <TimelineItem
                  key={step.key}
                  step={step}
                  isLast={
                    index ===
                    timeline.length - 1
                  }
                />
              )
            )}
          </View>
        </SectionCard>

        <SectionCard
          title={`Materiais solicitados (${materials.length})`}
          icon="list-outline"
        >
          {materials.length > 0 ? (
            materials.map(
              (material, index) => (
                <MaterialCard
                  key={
                    material.id ||
                    `${getMaterialName(
                      material
                    )}_${index}`
                  }
                  material={material}
                  isLast={
                    index ===
                    materials.length - 1
                  }
                />
              )
            )
          ) : (
            <InlineEmptyState
              icon="cube-outline"
              text="Nenhum material foi informado nesta solicitação."
            />
          )}
        </SectionCard>

        <SectionCard
          title="Cooperativa responsável"
          icon="business-outline"
        >
          <DetailRow
            label="Nome"
            value={cooperativeName}
          />

          <DetailRow
            label="E-mail"
            value={
              schedule.cooperative?.email ||
              "-"
            }
          />

          <DetailRow
            label="Telefone"
            value={
              schedule.cooperative?.phone ||
              "-"
            }
            isLast
          />
        </SectionCard>

        <SectionCard
          title="Local da coleta"
          icon="location-outline"
        >
          <DetailRow
            label="Gerador"
            value={generatorName}
          />

          <DetailRow
            label="Endereço"
            value={buildGeneratorAddress(
              schedule.generator
            )}
          />

          <DetailRow
            label="Telefone"
            value={
              schedule.generator?.phone ||
              "-"
            }
            isLast
          />
        </SectionCard>

        <SectionCard
          title="Observações"
          icon="document-text-outline"
        >
          {schedule.notes ? (
            <Text style={styles.notesText}>
              {schedule.notes}
            </Text>
          ) : (
            <InlineEmptyState
              icon="chatbox-ellipses-outline"
              text="Nenhuma observação foi adicionada."
            />
          )}
        </SectionCard>

        <SectionCard
          title={`Coletas vinculadas (${collections.length})`}
          icon="car-outline"
        >
          {collections.length > 0 ? (
            collections.map(
              (collection, index) => (
                <CollectionCard
                  key={collection.id}
                  collection={collection}
                  onPress={() =>
                    openCollection(
                      collection.id
                    )
                  }
                  isLast={
                    index ===
                    collections.length - 1
                  }
                />
              )
            )
          ) : (
            <InlineEmptyState
              icon="hourglass-outline"
              text="A cooperativa ainda não vinculou uma coleta a esta solicitação."
            />
          )}
        </SectionCard>

        <SectionCard
          title="Informações do registro"
          icon="code-slash-outline"
        >
          <DetailRow
            label="Identificador"
            value={schedule.id}
          />

          <DetailRow
            label="Criada em"
            value={formatDateTime(
              schedule.createdAt
            )}
          />

          <DetailRow
            label="Última atualização"
            value={formatDateTime(
              schedule.updatedAt
            )}
            isLast
          />
        </SectionCard>
      </ScrollView>
    </View>
  );
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Ionicons
            name={icon}
            size={19}
            color="#15803D"
          />
        </View>

        <Text style={styles.sectionTitle}>
          {title}
        </Text>
      </View>

      {children}
    </View>
  );
}

function SummaryItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.summaryItem}>
      <Ionicons
        name={icon}
        size={18}
        color="#15803D"
      />

      <View style={styles.summaryText}>
        <Text style={styles.summaryLabel}>
          {label}
        </Text>

        <Text
          style={styles.summaryValue}
          numberOfLines={2}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

function TimelineItem({
  step,
  isLast,
}: {
  step: TimelineStep;
  isLast: boolean;
}) {
  const color = step.current
    ? "#028C56"
    : step.completed
      ? "#16A34A"
      : "#D1D5DB";

  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineRail}>
        <View
          style={[
            styles.timelineCircle,
            {
              backgroundColor: step.completed
                ? color
                : "#FFFFFF",
              borderColor: color,
            },
          ]}
        >
          <Ionicons
            name={step.icon}
            size={16}
            color={
              step.completed
                ? "#FFFFFF"
                : color
            }
          />
        </View>

        {!isLast ? (
          <View
            style={[
              styles.timelineLine,
              {
                backgroundColor:
                  step.completed
                    ? "#86EFAC"
                    : "#E5E7EB",
              },
            ]}
          />
        ) : null}
      </View>

      <View
        style={[
          styles.timelineContent,
          isLast &&
            styles.timelineContentLast,
        ]}
      >
        <View style={styles.timelineTitleRow}>
          <Text
            style={[
              styles.timelineTitle,
              step.current &&
                styles.timelineTitleCurrent,
              !step.completed &&
                styles.timelineTitlePending,
            ]}
          >
            {step.title}
          </Text>

          {step.current ? (
            <View
              style={
                styles.currentStepBadge
              }
            >
              <Text
                style={
                  styles.currentStepText
                }
              >
                Etapa atual
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.timelineDescription}>
          {step.description}
        </Text>

        {step.date ? (
          <Text style={styles.timelineDate}>
            {formatDateTime(step.date)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function MaterialCard({
  material,
  isLast,
}: {
  material: ScheduleRequestedMaterialRecord;
  isLast: boolean;
}) {
  const category =
    getMaterialCategory(material);

  const subcategory =
    getMaterialSubcategory(material);

  const sourceLabel = material.wasteTypeId
    ? "Catálogo oficial"
    : "Material proposto";

  return (
    <View
      style={[
        styles.materialCard,
        isLast &&
          styles.materialCardLast,
      ]}
    >
      <View style={styles.materialIcon}>
        <Ionicons
          name={
            material.wasteTypeId
              ? "leaf-outline"
              : "create-outline"
          }
          size={20}
          color="#15803D"
        />
      </View>

      <View style={styles.materialContent}>
        <Text style={styles.materialName}>
          {getMaterialName(material)}
        </Text>

        <Text style={styles.materialSource}>
          {sourceLabel}
        </Text>

        {category || subcategory ? (
          <Text style={styles.materialCategory}>
            {[category, subcategory]
              .filter(Boolean)
              .join(" • ")}
          </Text>
        ) : null}

        <View style={styles.materialQuantityBadge}>
          <Ionicons
            name="scale-outline"
            size={14}
            color="#166534"
          />

          <Text
            style={
              styles.materialQuantityText
            }
          >
            {getQuantityLabel(material)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function DetailRow({
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
      style={[
        styles.detailRow,
        isLast && styles.detailRowLast,
      ]}
    >
      <Text style={styles.detailLabel}>
        {label}
      </Text>

      <Text
        style={styles.detailValue}
        selectable
      >
        {value}
      </Text>
    </View>
  );
}

function CollectionCard({
  collection,
  onPress,
  isLast,
}: {
  collection: Collection;
  onPress: () => void;
  isLast: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[
        styles.collectionCard,
        isLast &&
          styles.collectionCardLast,
      ]}
    >
      <View style={styles.collectionHeader}>
        <View style={styles.collectionTitleBox}>
          <Text
            style={
              styles.collectionEyebrow
            }
          >
            Coleta
          </Text>

          <Text
            style={
              styles.collectionProtocol
            }
          >
            #
            {collection.id
              .slice(-8)
              .toUpperCase()}
          </Text>
        </View>

        <View
          style={[
            styles.collectionStatusBadge,
            {
              backgroundColor:
                getCollectionStatusColor(
                  collection.status
                ),
            },
          ]}
        >
          <Text
            style={
              styles.collectionStatusText
            }
          >
            {translateCollectionStatus(
              collection.status
            )}
          </Text>
        </View>
      </View>

      <View style={styles.collectionSummary}>
        <View style={styles.collectionSummaryItem}>
          <Text
            style={
              styles.collectionSummaryLabel
            }
          >
            Peso registrado
          </Text>

          <Text
            style={
              styles.collectionSummaryValue
            }
          >
            {Number(
              collection.totalWeightKg || 0
            ).toLocaleString("pt-BR")}{" "}
            kg
          </Text>
        </View>

        <View style={styles.collectionSummaryItem}>
          <Text
            style={
              styles.collectionSummaryLabel
            }
          >
            Data
          </Text>

          <Text
            style={
              styles.collectionSummaryValue
            }
          >
            {formatDate(
              collection.collectedAt ||
                collection.createdAt
            )}
          </Text>
        </View>
      </View>

      <View style={styles.collectionFooter}>
        <Text style={styles.collectionLink}>
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

function InlineEmptyState({
  icon,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}) {
  return (
    <View style={styles.inlineEmpty}>
      <Ionicons
        name={icon}
        size={28}
        color="#9CA3AF"
      />

      <Text style={styles.inlineEmptyText}>
        {text}
      </Text>
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
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  loadingText: {
    marginTop: 10,
    color: "#6B7280",
    fontSize: 14,
  },
  notFoundContainer: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  notFoundIcon: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  notFoundTitle: {
    marginTop: 18,
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },
  notFoundText: {
    marginTop: 8,
    color: "#6B7280",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  notFoundButton: {
    marginTop: 20,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#028C56",
  },
  notFoundButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  header: {
    paddingTop: 22,
    paddingBottom: 22,
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
  headerCenter: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerEyebrow: {
    color: "#E8FFF1",
    fontSize: 12,
  },
  headerTitle: {
    marginTop: 2,
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: "800",
  },
  headerStatusRow: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
  },
  headerStatusBadge: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 15,
  },
  headerStatusText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  headerDate: {
    flex: 1,
    marginLeft: 10,
    color: "#E8FFF1",
    fontSize: 12,
    textAlign: "right",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
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
    marginBottom: 15,
    flexDirection: "row",
    alignItems: "center",
  },
  sectionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    flex: 1,
    marginLeft: 10,
    color: "#111827",
    fontSize: 17,
    fontWeight: "800",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  summaryItem: {
    width: "50%",
    marginBottom: 15,
    paddingRight: 10,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  summaryText: {
    flex: 1,
    marginLeft: 8,
  },
  summaryLabel: {
    color: "#9CA3AF",
    fontSize: 11,
  },
  summaryValue: {
    marginTop: 3,
    color: "#374151",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  timeline: {
    paddingTop: 2,
  },
  timelineItem: {
    flexDirection: "row",
  },
  timelineRail: {
    width: 34,
    alignItems: "center",
  },
  timelineCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 54,
  },
  timelineContent: {
    flex: 1,
    marginLeft: 10,
    paddingBottom: 20,
  },
  timelineContentLast: {
    paddingBottom: 0,
  },
  timelineTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  timelineTitle: {
    flex: 1,
    color: "#374151",
    fontSize: 14,
    fontWeight: "800",
  },
  timelineTitleCurrent: {
    color: "#028C56",
  },
  timelineTitlePending: {
    color: "#9CA3AF",
  },
  timelineDescription: {
    marginTop: 4,
    color: "#6B7280",
    fontSize: 12,
    lineHeight: 17,
  },
  timelineDate: {
    marginTop: 4,
    color: "#9CA3AF",
    fontSize: 11,
  },
  currentStepBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "#DCFCE7",
  },
  currentStepText: {
    color: "#166534",
    fontSize: 9,
    fontWeight: "800",
  },
  materialCard: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    flexDirection: "row",
  },
  materialCardLast: {
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  materialIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  materialContent: {
    flex: 1,
    marginLeft: 11,
  },
  materialName: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "800",
  },
  materialSource: {
    marginTop: 2,
    color: "#028C56",
    fontSize: 11,
    fontWeight: "700",
  },
  materialCategory: {
    marginTop: 3,
    color: "#6B7280",
    fontSize: 12,
  },
  materialQuantityBadge: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 11,
    backgroundColor: "#F0FDF4",
    flexDirection: "row",
    alignItems: "center",
  },
  materialQuantityText: {
    marginLeft: 5,
    color: "#166534",
    fontSize: 11,
    fontWeight: "700",
  },
  detailRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  detailRowLast: {
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  detailLabel: {
    color: "#9CA3AF",
    fontSize: 11,
  },
  detailValue: {
    marginTop: 4,
    color: "#374151",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  notesText: {
    color: "#4B5563",
    fontSize: 14,
    lineHeight: 22,
  },
  collectionCard: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  collectionCardLast: {
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  collectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  collectionTitleBox: {
    flex: 1,
  },
  collectionEyebrow: {
    color: "#9CA3AF",
    fontSize: 11,
  },
  collectionProtocol: {
    marginTop: 2,
    color: "#111827",
    fontSize: 15,
    fontWeight: "800",
  },
  collectionStatusBadge: {
    maxWidth: 112,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 13,
  },
  collectionStatusText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center",
  },
  collectionSummary: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#F9FAFB",
    flexDirection: "row",
  },
  collectionSummaryItem: {
    flex: 1,
  },
  collectionSummaryLabel: {
    color: "#9CA3AF",
    fontSize: 10,
  },
  collectionSummaryValue: {
    marginTop: 3,
    color: "#374151",
    fontSize: 12,
    fontWeight: "800",
  },
  collectionFooter: {
    marginTop: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  collectionLink: {
    marginRight: 7,
    color: "#028C56",
    fontSize: 12,
    fontWeight: "800",
  },
  inlineEmpty: {
    paddingVertical: 18,
    alignItems: "center",
  },
  inlineEmptyText: {
    marginTop: 8,
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
});
