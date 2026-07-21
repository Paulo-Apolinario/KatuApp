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
import { collectionService } from "@/src/services/collectionService";

import type {
  Collection,
  CollectionMaterial,
  CollectionMaterialRecord,
  CollectionStatus,
  CollectionWasteEntrySummary,
} from "@/src/types/collection";

type CollectionDetails = Collection & {
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

  collector?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;

  driver?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;

  vehicle?: {
    id?: string;
    plate?: string | null;
    model?: string | null;
    brand?: string | null;
  } | null;

  route?: {
    id?: string;
    name?: string | null;
    code?: string | null;
    status?: string | null;
  } | null;

  schedule?: {
    id?: string;
    status?: string | null;
    preferredDate?: string | null;
    scheduledDate?: string | null;
    createdAt?: string | null;
  } | null;
};

type TimelineStep = {
  key: string;
  title: string;
  description: string;
  date?: string | null;
  completed: boolean;
  current: boolean;
  icon: keyof typeof Ionicons.glyphMap;
};

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
          category?: string | null;
          subcategory?: string | null;
        } | null;
        catalogSuggestion?: {
          name?: string | null;
          category?: string | null;
          subcategory?: string | null;
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

function getMaterialCategory(
  material:
    | CollectionMaterial
    | CollectionMaterialRecord
) {
  const item = material as
    CollectionMaterial &
      CollectionMaterialRecord & {
        categorySnapshot?: string | null;
        subcategorySnapshot?: string | null;
        wasteType?: {
          category?: string | null;
          subcategory?: string | null;
        } | null;
        catalogSuggestion?: {
          category?: string | null;
          subcategory?: string | null;
        } | null;
      };

  const category =
    item.categorySnapshot ||
    item.wasteType?.category ||
    item.catalogSuggestion?.category ||
    null;

  const subcategory =
    item.subcategorySnapshot ||
    item.wasteType?.subcategory ||
    item.catalogSuggestion?.subcategory ||
    null;

  return [category, subcategory]
    .filter(Boolean)
    .join(" • ");
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

  const unit = item.unit || "KG";

  if (
    !Number.isFinite(quantity) ||
    quantity <= 0
  ) {
    return "Quantidade não informada";
  }

  return `${quantity.toLocaleString(
    "pt-BR",
    {
      maximumFractionDigits: 2,
    }
  )} ${unit}`;
}

function getCollectionMaterials(
  collection: CollectionDetails
) {
  if (
    Array.isArray(
      collection.collectionMaterials
    ) &&
    collection.collectionMaterials.length > 0
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

function getWasteEntries(
  collection: CollectionDetails
) {
  return Array.isArray(
    collection.collectionWasteEntries
  )
    ? collection.collectionWasteEntries
    : [];
}

function getGeneratorName(
  collection: CollectionDetails
) {
  return (
    collection.generator?.name ||
    collection.generator?.companyName ||
    "Gerador não informado"
  );
}

function getCooperativeName(
  collection: CollectionDetails
) {
  return (
    collection.cooperative?.name ||
    collection.cooperative?.companyName ||
    "Cooperativa"
  );
}

function getAddress(
  collection: CollectionDetails
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

  const location = [
    generator.neighborhood,
    generator.city,
    generator.state,
  ]
    .filter(Boolean)
    .join(" - ");

  return (
    [
      street,
      location,
      generator.zipCode,
    ]
      .filter(Boolean)
      .join(" • ") || "-"
  );
}

function buildTimeline(
  collection: CollectionDetails
): TimelineStep[] {
  const status = collection.status;

  if (status === "CANCELLED") {
    return [
      {
        key: "created",
        title: "Coleta criada",
        description:
          "A cooperativa criou a coleta e vinculou os responsáveis.",
        date: collection.createdAt,
        completed: true,
        current: false,
        icon: "document-text-outline",
      },
      {
        key: "cancelled",
        title: "Coleta cancelada",
        description:
          collection.cancellationReason ||
          "A coleta foi cancelada.",
        date:
          collection.cancelledAt ||
          collection.updatedAt,
        completed: true,
        current: true,
        icon: "close-circle-outline",
      },
    ];
  }

  const started =
    status === "IN_PROGRESS" ||
    status === "COLLECTED" ||
    status === "RECEIVED" ||
    status === "SORTING" ||
    status === "COMPLETED";

  const collected =
    status === "COLLECTED" ||
    status === "RECEIVED" ||
    status === "SORTING" ||
    status === "COMPLETED";

  const received =
    status === "RECEIVED" ||
    status === "SORTING" ||
    status === "COMPLETED";

  const sorting =
    status === "SORTING" ||
    status === "COMPLETED";

  const completed =
    status === "COMPLETED";

  const currentKey =
    status === "PENDING"
      ? "created"
      : status === "IN_PROGRESS"
        ? "started"
        : status === "COLLECTED"
          ? "collected"
          : status === "RECEIVED"
            ? "received"
            : status === "SORTING"
              ? "sorting"
              : "completed";

  return [
    {
      key: "created",
      title: "Coleta criada",
      description:
        "A solicitação foi transformada em coleta operacional.",
      date: collection.createdAt,
      completed: true,
      current: currentKey === "created",
      icon: "document-text-outline",
    },
    {
      key: "started",
      title: "Coleta iniciada",
      description:
        "A equipe responsável iniciou o atendimento no local.",
      date: collection.startedAt,
      completed: started,
      current: currentKey === "started",
      icon: "car-outline",
    },
    {
      key: "collected",
      title: "Materiais coletados",
      description:
        "Os materiais efetivamente retirados foram registrados.",
      date: collection.collectedAt,
      completed: collected,
      current: currentKey === "collected",
      icon: "cube-outline",
    },
    {
      key: "received",
      title: "Recebida pela cooperativa",
      description:
        "Os resíduos chegaram à cooperativa para conferência.",
      date: collection.receivedAt,
      completed: received,
      current: currentKey === "received",
      icon: "business-outline",
    },
    {
      key: "sorting",
      title: "Triagem iniciada",
      description:
        "Os materiais estão sendo separados e classificados.",
      date: collection.sortingStartedAt,
      completed: sorting,
      current: currentKey === "sorting",
      icon: "git-branch-outline",
    },
    {
      key: "completed",
      title: "Processo concluído",
      description:
        "A coleta e o processamento foram finalizados.",
      date: collection.completedAt,
      completed,
      current: currentKey === "completed",
      icon: "checkmark-done-outline",
    },
  ];
}

export default function GeneratorCollectionDetailsScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();

  const collectionId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const { notifyError } =
    useNotification();

  const [loading, setLoading] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    collection,
    setCollection,
  ] = useState<CollectionDetails | null>(
    null
  );

  const loadCollection =
    useCallback(
      async (
        showLoader = true
      ) => {
        if (!collectionId) {
          setLoading(false);

          notifyError(
            "ID da coleta não informado."
          );

          return;
        }

        try {
          if (showLoader) {
            setLoading(true);
          }

          const response =
            await collectionService.getById(
              collectionId
            );

          setCollection(
            response as CollectionDetails
          );
        } catch (error) {
          console.error(
            "Erro ao carregar detalhes da coleta:",
            error
          );

          notifyError(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar os detalhes da coleta."
          );
        } finally {
          if (showLoader) {
            setLoading(false);
          }

          setRefreshing(false);
        }
      },
      [
        collectionId,
        notifyError,
      ]
    );

  useFocusEffect(
    useCallback(() => {
      void loadCollection(true);
    }, [loadCollection])
  );

  const materials = useMemo(
    () =>
      collection
        ? getCollectionMaterials(
            collection
          )
        : [],
    [collection]
  );

  const wasteEntries = useMemo(
    () =>
      collection
        ? getWasteEntries(collection)
        : [],
    [collection]
  );

  const timeline = useMemo(
    () =>
      collection
        ? buildTimeline(collection)
        : [],
    [collection]
  );

  function handleRefresh() {
    setRefreshing(true);
    void loadCollection(false);
  }

  function openSchedule() {
    const scheduleId =
      collection?.scheduleId ||
      collection?.schedule?.id;

    if (!scheduleId) {
      notifyError(
        "Esta coleta não possui solicitação vinculada."
      );
      return;
    }

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
          Carregando coleta...
        </Text>
      </View>
    );
  }

  if (!collection) {
    return (
      <View
        style={
          styles.notFoundContainer
        }
      >
        <View
          style={styles.notFoundIcon}
        >
          <Ionicons
            name="alert-circle-outline"
            size={42}
            color="#B45309"
          />
        </View>

        <Text
          style={styles.notFoundTitle}
        >
          Coleta não encontrada
        </Text>

        <Text
          style={styles.notFoundText}
        >
          Não foi possível localizar os dados desta coleta.
        </Text>

        <TouchableOpacity
          onPress={() =>
            router.back()
          }
          style={
            styles.notFoundButton
          }
        >
          <Text
            style={
              styles.notFoundButtonText
            }
          >
            Voltar
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusColor =
    getCollectionStatusColor(
      collection.status
    );

  const totalWeight = Number(
    collection.totalWeightKg || 0
  );

  const scheduleId =
    collection.scheduleId ||
    collection.schedule?.id;

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
              styles.headerCenter
            }
          >
            <Text
              style={
                styles.headerEyebrow
              }
            >
              Detalhes da coleta
            </Text>

            <Text
              style={
                styles.headerTitle
              }
            >
              #
              {collection.id
                .slice(-8)
                .toUpperCase()}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleRefresh}
            style={
              styles.headerButton
            }
          >
            <Ionicons
              name="refresh-outline"
              size={21}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>

        <View
          style={
            styles.headerStatusRow
          }
        >
          <View
            style={[
              styles.headerStatusBadge,
              {
                backgroundColor:
                  statusColor,
              },
            ]}
          >
            <Ionicons
              name={getCollectionStatusIcon(
                collection.status
              )}
              size={15}
              color="#FFFFFF"
            />

            <Text
              style={
                styles.headerStatusText
              }
            >
              {translateCollectionStatus(
                collection.status
              )}
            </Text>
          </View>

          <Text
            style={styles.headerDate}
          >
            Atualizada em{" "}
            {formatDateTime(
              collection.updatedAt
            )}
          </Text>
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
        <SectionCard
          title="Resumo da coleta"
          icon="information-circle-outline"
        >
          <View
            style={
              styles.summaryGrid
            }
          >
            <SummaryItem
              label="Status"
              value={translateCollectionStatus(
                collection.status
              )}
              icon={getCollectionStatusIcon(
                collection.status
              )}
            />

            <SummaryItem
              label="Peso total"
              value={`${totalWeight.toLocaleString(
                "pt-BR",
                {
                  maximumFractionDigits: 2,
                }
              )} kg`}
              icon="scale-outline"
            />

            <SummaryItem
              label="Materiais"
              value={String(
                materials.length
              )}
              icon="cube-outline"
            />

            <SummaryItem
              label="Coletada em"
              value={formatDateTime(
                collection.collectedAt
              )}
              icon="calendar-outline"
            />
          </View>
        </SectionCard>

        <SectionCard
          title="Acompanhamento"
          icon="git-branch-outline"
        >
          <View
            style={styles.timeline}
          >
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
          title={`Materiais coletados (${materials.length})`}
          icon="cube-outline"
        >
          {materials.length > 0 ? (
            materials.map(
              (
                material,
                index
              ) => (
                <MaterialCard
                  key={`${collection.id}_${index}_${getMaterialName(
                    material
                  )}`}
                  material={
                    material
                  }
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
              text="Os materiais coletados ainda não foram registrados."
            />
          )}
        </SectionCard>

        <SectionCard
          title={`Entradas para destinação (${wasteEntries.length})`}
          icon="swap-horizontal-outline"
        >
          {wasteEntries.length >
          0 ? (
            wasteEntries.map(
              (
                entry,
                index
              ) => (
                <WasteEntryCard
                  key={
                    entry.id ||
                    `${collection.id}_entry_${index}`
                  }
                  entry={entry}
                  isLast={
                    index ===
                    wasteEntries.length - 1
                  }
                />
              )
            )
          ) : (
            <InlineEmptyState
              icon="hourglass-outline"
              text="A cooperativa ainda não iniciou a destinação dos materiais."
            />
          )}
        </SectionCard>

        <SectionCard
          title="Gerador e local"
          icon="location-outline"
        >
          <DetailRow
            label="Gerador"
            value={getGeneratorName(
              collection
            )}
          />

          <DetailRow
            label="Endereço"
            value={getAddress(
              collection
            )}
          />

          <DetailRow
            label="Telefone"
            value={
              collection.generator
                ?.phone || "-"
            }
          />

          <DetailRow
            label="E-mail"
            value={
              collection.generator
                ?.email || "-"
            }
            isLast
          />
        </SectionCard>

        <SectionCard
          title="Equipe responsável"
          icon="people-outline"
        >
          <DetailRow
            label="Catador"
            value={
              collection.collector
                ?.name || "-"
            }
          />

          <DetailRow
            label="Motorista"
            value={
              collection.driver
                ?.name || "-"
            }
          />

          <DetailRow
            label="Veículo"
            value={
              [
                collection.vehicle
                  ?.brand,
                collection.vehicle
                  ?.model,
                collection.vehicle
                  ?.plate,
              ]
                .filter(Boolean)
                .join(" • ") || "-"
            }
          />

          <DetailRow
            label="Rota"
            value={
              collection.route?.name ||
              collection.route?.code ||
              "-"
            }
            isLast
          />
        </SectionCard>

        <SectionCard
          title="Cooperativa"
          icon="business-outline"
        >
          <DetailRow
            label="Nome"
            value={getCooperativeName(
              collection
            )}
          />

          <DetailRow
            label="Telefone"
            value={
              collection.cooperative
                ?.phone || "-"
            }
          />

          <DetailRow
            label="E-mail"
            value={
              collection.cooperative
                ?.email || "-"
            }
            isLast
          />
        </SectionCard>

        {scheduleId ? (
          <SectionCard
            title="Solicitação vinculada"
            icon="calendar-outline"
          >
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={openSchedule}
              style={
                styles.linkedScheduleCard
              }
            >
              <View
                style={
                  styles.linkedScheduleIcon
                }
              >
                <Ionicons
                  name="document-text-outline"
                  size={21}
                  color="#15803D"
                />
              </View>

              <View
                style={
                  styles.linkedScheduleContent
                }
              >
                <Text
                  style={
                    styles.linkedScheduleLabel
                  }
                >
                  Solicitação
                </Text>

                <Text
                  style={
                    styles.linkedScheduleProtocol
                  }
                >
                  #
                  {scheduleId
                    .slice(-8)
                    .toUpperCase()}
                </Text>

                <Text
                  style={
                    styles.linkedScheduleDate
                  }
                >
                  Preferencial:{" "}
                  {formatDateTime(
                    collection.schedule
                      ?.preferredDate
                  )}
                </Text>
              </View>

              <Ionicons
                name="arrow-forward"
                size={20}
                color="#028C56"
              />
            </TouchableOpacity>
          </SectionCard>
        ) : null}

        <SectionCard
          title="Observações"
          icon="document-text-outline"
        >
          {collection.notes ? (
            <Text
              style={styles.notesText}
            >
              {collection.notes}
            </Text>
          ) : (
            <InlineEmptyState
              icon="chatbox-ellipses-outline"
              text="Nenhuma observação foi registrada."
            />
          )}
        </SectionCard>

        {collection.status ===
          "CANCELLED" ? (
          <SectionCard
            title="Cancelamento"
            icon="close-circle-outline"
          >
            <View
              style={
                styles.cancellationBox
              }
            >
              <Ionicons
                name="alert-circle-outline"
                size={22}
                color="#B91C1C"
              />

              <View
                style={
                  styles.cancellationContent
                }
              >
                <Text
                  style={
                    styles.cancellationTitle
                  }
                >
                  Coleta cancelada
                </Text>

                <Text
                  style={
                    styles.cancellationText
                  }
                >
                  {collection.cancellationReason ||
                    "Motivo não informado."}
                </Text>

                <Text
                  style={
                    styles.cancellationDate
                  }
                >
                  {formatDateTime(
                    collection.cancelledAt
                  )}
                </Text>
              </View>
            </View>
          </SectionCard>
        ) : null}

        <SectionCard
          title="Informações do registro"
          icon="code-slash-outline"
        >
          <DetailRow
            label="Identificador"
            value={collection.id}
          />

          <DetailRow
            label="Criada em"
            value={formatDateTime(
              collection.createdAt
            )}
          />

          <DetailRow
            label="Última atualização"
            value={formatDateTime(
              collection.updatedAt
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
    <View
      style={styles.sectionCard}
    >
      <View
        style={
          styles.sectionHeader
        }
      >
        <View
          style={styles.sectionIcon}
        >
          <Ionicons
            name={icon}
            size={19}
            color="#15803D"
          />
        </View>

        <Text
          style={styles.sectionTitle}
        >
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
    <View
      style={styles.summaryItem}
    >
      <Ionicons
        name={icon}
        size={18}
        color="#15803D"
      />

      <View
        style={
          styles.summaryText
        }
      >
        <Text
          style={styles.summaryLabel}
        >
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
    <View
      style={styles.timelineItem}
    >
      <View
        style={styles.timelineRail}
      >
        <View
          style={[
            styles.timelineCircle,
            {
              backgroundColor:
                step.completed
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
        <View
          style={
            styles.timelineTitleRow
          }
        >
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
                styles.currentBadge
              }
            >
              <Text
                style={
                  styles.currentBadgeText
                }
              >
                Etapa atual
              </Text>
            </View>
          ) : null}
        </View>

        <Text
          style={
            styles.timelineDescription
          }
        >
          {step.description}
        </Text>

        {step.date ? (
          <Text
            style={
              styles.timelineDate
            }
          >
            {formatDateTime(
              step.date
            )}
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
  material:
    | CollectionMaterial
    | CollectionMaterialRecord;
  isLast: boolean;
}) {
  const category =
    getMaterialCategory(material);

  return (
    <View
      style={[
        styles.materialCard,
        isLast &&
          styles.materialCardLast,
      ]}
    >
      <View
        style={styles.materialIcon}
      >
        <Ionicons
          name="leaf-outline"
          size={20}
          color="#15803D"
        />
      </View>

      <View
        style={
          styles.materialContent
        }
      >
        <Text
          style={styles.materialName}
        >
          {getMaterialName(
            material
          )}
        </Text>

        {category ? (
          <Text
            style={
              styles.materialCategory
            }
          >
            {category}
          </Text>
        ) : null}

        <View
          style={
            styles.materialQuantityBadge
          }
        >
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
            {getMaterialQuantity(
              material
            )}
          </Text>
        </View>

        {"notes" in material &&
        material.notes ? (
          <Text
            style={
              styles.materialNotes
            }
          >
            {material.notes}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function WasteEntryCard({
  entry,
  isLast,
}: {
  entry: CollectionWasteEntrySummary;
  isLast: boolean;
}) {
  const item =
    entry as CollectionWasteEntrySummary & {
      nameSnapshot?: string | null;
      originalQuantity?: number | null;
      availableQuantity?: number | null;
      quantity?: number | null;
      unit?: string | null;
      wasteType?: {
        name?: string | null;
      } | null;
      catalogSuggestion?: {
        name?: string | null;
      } | null;
      destinationsCount?: number | null;
      status?: string | null;
    };

  const name =
    item.nameSnapshot ||
    item.wasteType?.name ||
    item.catalogSuggestion?.name ||
    "Material";

  const originalQuantity = Number(
    item.originalQuantity ??
      item.quantity ??
      0
  );

  const availableQuantity = Number(
    item.availableQuantity ??
      originalQuantity
  );

  return (
    <View
      style={[
        styles.wasteEntryCard,
        isLast &&
          styles.wasteEntryCardLast,
      ]}
    >
      <View
        style={
          styles.wasteEntryHeader
        }
      >
        <View
          style={
            styles.wasteEntryIcon
          }
        >
          <Ionicons
            name="swap-horizontal-outline"
            size={19}
            color="#0E7490"
          />
        </View>

        <View
          style={
            styles.wasteEntryTitleBox
          }
        >
          <Text
            style={
              styles.wasteEntryName
            }
          >
            {name}
          </Text>

          <Text
            style={
              styles.wasteEntryStatus
            }
          >
            {item.status ||
              "Aguardando destinação"}
          </Text>
        </View>
      </View>

      <View
        style={
          styles.wasteEntrySummary
        }
      >
        <View
          style={
            styles.wasteEntrySummaryItem
          }
        >
          <Text
            style={
              styles.wasteEntrySummaryLabel
            }
          >
            Quantidade original
          </Text>

          <Text
            style={
              styles.wasteEntrySummaryValue
            }
          >
            {originalQuantity.toLocaleString(
              "pt-BR",
              {
                maximumFractionDigits: 2,
              }
            )}{" "}
            {item.unit || "KG"}
          </Text>
        </View>

        <View
          style={
            styles.wasteEntrySummaryItem
          }
        >
          <Text
            style={
              styles.wasteEntrySummaryLabel
            }
          >
            Saldo disponível
          </Text>

          <Text
            style={
              styles.wasteEntrySummaryValue
            }
          >
            {availableQuantity.toLocaleString(
              "pt-BR",
              {
                maximumFractionDigits: 2,
              }
            )}{" "}
            {item.unit || "KG"}
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
        isLast &&
          styles.detailRowLast,
      ]}
    >
      <Text
        style={styles.detailLabel}
      >
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

function InlineEmptyState({
  icon,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}) {
  return (
    <View
      style={styles.inlineEmpty}
    >
      <Ionicons
        name={icon}
        size={28}
        color="#9CA3AF"
      />

      <Text
        style={
          styles.inlineEmptyText
        }
      >
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
    flexDirection: "row",
    alignItems: "center",
  },
  headerStatusText: {
    marginLeft: 5,
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
  currentBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "#DCFCE7",
  },
  currentBadgeText: {
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
  materialNotes: {
    marginTop: 8,
    color: "#6B7280",
    fontSize: 12,
    lineHeight: 17,
  },
  wasteEntryCard: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  wasteEntryCardLast: {
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  wasteEntryHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  wasteEntryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ECFEFF",
    alignItems: "center",
    justifyContent: "center",
  },
  wasteEntryTitleBox: {
    flex: 1,
    marginLeft: 10,
  },
  wasteEntryName: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "800",
  },
  wasteEntryStatus: {
    marginTop: 2,
    color: "#0E7490",
    fontSize: 11,
    fontWeight: "700",
  },
  wasteEntrySummary: {
    marginTop: 10,
    padding: 11,
    borderRadius: 12,
    backgroundColor: "#F9FAFB",
    flexDirection: "row",
  },
  wasteEntrySummaryItem: {
    flex: 1,
  },
  wasteEntrySummaryLabel: {
    color: "#9CA3AF",
    fontSize: 10,
  },
  wasteEntrySummaryValue: {
    marginTop: 3,
    color: "#374151",
    fontSize: 12,
    fontWeight: "800",
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
  linkedScheduleCard: {
    padding: 13,
    borderRadius: 13,
    backgroundColor: "#F0FDF4",
    flexDirection: "row",
    alignItems: "center",
  },
  linkedScheduleIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  linkedScheduleContent: {
    flex: 1,
    marginLeft: 10,
  },
  linkedScheduleLabel: {
    color: "#6B7280",
    fontSize: 10,
  },
  linkedScheduleProtocol: {
    marginTop: 2,
    color: "#166534",
    fontSize: 15,
    fontWeight: "800",
  },
  linkedScheduleDate: {
    marginTop: 3,
    color: "#6B7280",
    fontSize: 11,
  },
  notesText: {
    color: "#4B5563",
    fontSize: 14,
    lineHeight: 22,
  },
  cancellationBox: {
    padding: 13,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    flexDirection: "row",
    alignItems: "flex-start",
  },
  cancellationContent: {
    flex: 1,
    marginLeft: 10,
  },
  cancellationTitle: {
    color: "#B91C1C",
    fontSize: 14,
    fontWeight: "800",
  },
  cancellationText: {
    marginTop: 4,
    color: "#7F1D1D",
    fontSize: 13,
    lineHeight: 18,
  },
  cancellationDate: {
    marginTop: 6,
    color: "#991B1B",
    fontSize: 11,
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
