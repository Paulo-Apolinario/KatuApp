import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useAuth } from "@/src/contexts/AuthContext";
import { useNotification } from "@/src/contexts/NotificationContext";
import { collectionService } from "@/src/services/collectionService";
import { scheduleService } from "@/src/services/scheduleService";

import type {
  Collection,
  CollectionMaterial,
  CollectionStatus,
} from "@/src/types/collection";
import type {
  Schedule,
  ScheduleRequestedMaterialRecord,
  ScheduleStatus,
} from "@/src/types/schedule";

type AuthUserLike = {
  name?: string;
  displayName?: string;
  generator?: {
    id?: string;
    name?: string | null;
    companyName?: string | null;
  } | null;
};

type DashboardMetrics = {
  totalKg: number;
  totalSchedules: number;
  openSchedules: number;
  completedCollections: number;
  activeCollections: number;
  nextSchedules: Schedule[];
  recentCollections: Collection[];
  latestActiveCollection?: Collection;
};

type TimelineStep = {
  key: CollectionStatus;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const ACTIVE_SCHEDULE_STATUSES: ScheduleStatus[] = [
  "REQUESTED",
  "SCHEDULED",
  "IN_PROGRESS",
];

const ACTIVE_COLLECTION_STATUSES: CollectionStatus[] = [
  "PENDING",
  "IN_PROGRESS",
  "COLLECTED",
  "RECEIVED",
  "SORTING",
];

const COLLECTION_STATUS_ORDER: CollectionStatus[] = [
  "PENDING",
  "IN_PROGRESS",
  "COLLECTED",
  "RECEIVED",
  "SORTING",
  "COMPLETED",
];

const COLLECTION_TIMELINE: TimelineStep[] = [
  {
    key: "PENDING",
    label: "Coleta delegada",
    description: "A cooperativa preparou a operação de coleta.",
    icon: "clipboard-outline",
  },
  {
    key: "IN_PROGRESS",
    label: "Em coleta",
    description: "A equipe está realizando a coleta dos materiais.",
    icon: "car-outline",
  },
  {
    key: "COLLECTED",
    label: "Material coletado",
    description: "O catador registrou os materiais coletados.",
    icon: "checkmark-circle-outline",
  },
  {
    key: "RECEIVED",
    label: "Recebido pela cooperativa",
    description: "Os resíduos chegaram à cooperativa.",
    icon: "business-outline",
  },
  {
    key: "SORTING",
    label: "Em triagem",
    description: "Os materiais estão sendo separados e classificados.",
    icon: "git-branch-outline",
  },
  {
    key: "COMPLETED",
    label: "Processo concluído",
    description: "A coleta e o processamento foram finalizados.",
    icon: "ribbon-outline",
  },
];

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Data não informada";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Data não informada";
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
    return "Data não informada";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Data não informada";
  }

  return date.toLocaleDateString("pt-BR");
}

function formatNumber(value: unknown, fractionDigits = 1) {
  const parsed = Number(value ?? 0);

  if (!Number.isFinite(parsed)) {
    return Number(0).toLocaleString("pt-BR", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
  }

  return parsed.toLocaleString("pt-BR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function formatUnit(unit?: string | null) {
  const labels: Record<string, string> = {
    KG: "kg",
    TON: "t",
    LITER: "L",
    UNIT: "un",
    CUBIC_METER: "m³",
  };

  if (!unit) {
    return "kg";
  }

  return labels[unit] || unit;
}

function translateScheduleStatus(status: ScheduleStatus) {
  const labels: Record<ScheduleStatus, string> = {
    REQUESTED: "Solicitado",
    SCHEDULED: "Agendado",
    IN_PROGRESS: "Em andamento",
    COMPLETED: "Concluído",
    CANCELLED: "Cancelado",
  };

  return labels[status] || status;
}

function translateCollectionStatus(status: CollectionStatus) {
  const labels: Record<CollectionStatus, string> = {
    PENDING: "Pendente",
    IN_PROGRESS: "Em coleta",
    COLLECTED: "Coletado",
    RECEIVED: "Recebido",
    SORTING: "Em triagem",
    COMPLETED: "Concluído",
    CANCELLED: "Cancelado",
  };

  return labels[status] || status;
}

function getScheduleBadgeColor(status: ScheduleStatus) {
  const colors: Record<ScheduleStatus, string> = {
    REQUESTED: "#64748B",
    SCHEDULED: "#2563EB",
    IN_PROGRESS: "#F59E0B",
    COMPLETED: "#10B981",
    CANCELLED: "#DC2626",
  };

  return colors[status] || "#64748B";
}

function getCollectionBadgeColor(status: CollectionStatus) {
  const colors: Record<CollectionStatus, string> = {
    PENDING: "#64748B",
    IN_PROGRESS: "#F59E0B",
    COLLECTED: "#7C3AED",
    RECEIVED: "#2563EB",
    SORTING: "#0891B2",
    COMPLETED: "#10B981",
    CANCELLED: "#DC2626",
  };

  return colors[status] || "#64748B";
}

function getRequestedMaterialName(
  material: ScheduleRequestedMaterialRecord
) {
  return material.nameSnapshot || "Material";
}

function formatRequestedMaterials(
  materials?: ScheduleRequestedMaterialRecord[]
) {
  if (!Array.isArray(materials) || materials.length === 0) {
    return "Nenhum material informado";
  }

  return materials
    .map((material) => {
      const quantity = Number(material.estimatedQuantity ?? 0);
      const quantityLabel =
        Number.isFinite(quantity) && quantity > 0
          ? ` — ${formatNumber(quantity)} ${formatUnit(material.unit)}`
          : "";

      return `${getRequestedMaterialName(material)}${quantityLabel}`;
    })
    .join(", ");
}

function formatCollectionMaterials(collection: Collection) {
  if (
    Array.isArray(collection.collectionMaterials) &&
    collection.collectionMaterials.length > 0
  ) {
    return collection.collectionMaterials
      .map((material) => {
        const name =
          material.nameSnapshot ||
          material.wasteType?.name ||
          "Material";

        return `${name}: ${formatNumber(material.quantity)} ${formatUnit(
          material.unit
        )}`;
      })
      .join(", ");
  }

  const legacyMaterials = collection.materials;

  if (!Array.isArray(legacyMaterials) || legacyMaterials.length === 0) {
    return "Nenhum material registrado";
  }

  return legacyMaterials
    .map((material: CollectionMaterial) => {
      const quantity = material.quantity ?? material.quantityKg ?? 0;
      const name = material.name || material.type || "Material";

      return `${name}: ${formatNumber(quantity)} ${formatUnit(material.unit)}`;
    })
    .join(", ");
}

function getCollectionReferenceDate(collection: Collection) {
  return (
    collection.updatedAt ||
    collection.collectedAt ||
    collection.createdAt ||
    collection.schedule?.scheduledDate ||
    collection.schedule?.preferredDate ||
    null
  );
}

function getScheduleReferenceDate(schedule: Schedule) {
  return schedule.scheduledDate || schedule.preferredDate || schedule.createdAt;
}

function getCollectionProgress(status: CollectionStatus) {
  if (status === "CANCELLED") {
    return 0;
  }

  const index = COLLECTION_STATUS_ORDER.indexOf(status);
  return index >= 0 ? index : 0;
}

function navigate(pathname: string, id?: string) {
  if (id) {
    router.push(`${pathname}?id=${encodeURIComponent(id)}` as never);
    return;
  }

  router.push(pathname as never);
}

export default function GeneratorDashboardScreen() {
  const { user, signOut } = useAuth();
  const { notifyError } = useNotification();

  const currentUser = user as AuthUserLike | null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);

  const displayName =
    currentUser?.generator?.companyName ||
    currentUser?.generator?.name ||
    currentUser?.displayName ||
    currentUser?.name ||
    "Gerador";

  const loadDashboard = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) {
          setLoading(true);
        }

        const [scheduleResponse, collectionResponse] = await Promise.all([
          scheduleService.list(),
          collectionService.list(),
        ]);

        setSchedules(Array.isArray(scheduleResponse) ? scheduleResponse : []);
        setCollections(
          Array.isArray(collectionResponse) ? collectionResponse : []
        );
      } catch (error) {
        console.error("Erro ao carregar dashboard do gerador:", error);

        notifyError(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar o dashboard."
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
      void loadDashboard(true);
    }, [loadDashboard])
  );

  const metrics = useMemo<DashboardMetrics>(() => {
    const openSchedules = schedules.filter((schedule) =>
      ACTIVE_SCHEDULE_STATUSES.includes(schedule.status)
    );

    const completedCollections = collections.filter(
      (collection) => collection.status === "COMPLETED"
    );

    const activeCollections = collections.filter((collection) =>
      ACTIVE_COLLECTION_STATUSES.includes(collection.status)
    );

    const totalKg = completedCollections.reduce(
      (total, collection) => total + Number(collection.totalWeightKg || 0),
      0
    );

    const nextSchedules = [...openSchedules]
      .sort((first, second) => {
        const firstTime = new Date(
          getScheduleReferenceDate(first) || 0
        ).getTime();
        const secondTime = new Date(
          getScheduleReferenceDate(second) || 0
        ).getTime();

        return firstTime - secondTime;
      })
      .slice(0, 3);

    const recentCollections = [...collections]
      .sort((first, second) => {
        const firstTime = new Date(
          getCollectionReferenceDate(first) || 0
        ).getTime();
        const secondTime = new Date(
          getCollectionReferenceDate(second) || 0
        ).getTime();

        return secondTime - firstTime;
      })
      .slice(0, 3);

    const latestActiveCollection = [...activeCollections].sort(
      (first, second) => {
        const firstTime = new Date(
          getCollectionReferenceDate(first) || 0
        ).getTime();
        const secondTime = new Date(
          getCollectionReferenceDate(second) || 0
        ).getTime();

        return secondTime - firstTime;
      }
    )[0];

    return {
      totalKg,
      totalSchedules: schedules.length,
      openSchedules: openSchedules.length,
      completedCollections: completedCollections.length,
      activeCollections: activeCollections.length,
      nextSchedules,
      recentCollections,
      latestActiveCollection,
    };
  }, [collections, schedules]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDashboard(false);
  }, [loadDashboard]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Erro ao sair:", error);
      notifyError("Não foi possível encerrar a sessão.");
    }
  }, [notifyError, signOut]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#028C56" />
        <Text style={styles.loadingText}>Carregando dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.screenContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#028C56"
          colors={["#028C56"]}
        />
      }
    >
      <LinearGradient
        colors={["#16A34A", "#028C56"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerTopRow}>
          <View style={styles.headerIdentity}>
            <Text style={styles.headerEyebrow}>Dashboard do Gerador</Text>
            <Text style={styles.headerTitle} numberOfLines={2}>
              Olá, {displayName}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleSignOut}
            activeOpacity={0.8}
            style={styles.logoutButton}
          >
            <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
            <Text style={styles.logoutText}>Sair</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.headerDescription}>
          Acompanhe suas solicitações, coletas e o processamento dos resíduos.
        </Text>

        <View style={styles.headerActionsRow}>
          <HeaderAction
            icon="add-circle-outline"
            label="Nova solicitação"
            onPress={() => navigate("/(gerador)/schedule")}
            style={styles.headerActionSpacing}
          />

          <HeaderAction
            icon="refresh-outline"
            label="Atualizar"
            onPress={() => void onRefresh()}
          />
        </View>
      </LinearGradient>

      <View style={styles.mainContent}>
        <View style={styles.metricsRow}>
          <MetricCard
            title="Total coletado"
            value={`${formatNumber(metrics.totalKg)} kg`}
            icon="leaf-outline"
            description="Coletas concluídas"
          />

          <MetricCard
            title="Coletas concluídas"
            value={String(metrics.completedCollections)}
            icon="checkmark-done-outline"
            description="Processos finalizados"
          />
        </View>

        <View style={[styles.metricsRow, styles.metricsRowSpacing]}>
          <MetricCard
            title="Solicitações"
            value={String(metrics.totalSchedules)}
            icon="calendar-outline"
            description={`${metrics.openSchedules} em aberto`}
          />

          <MetricCard
            title="Coletas ativas"
            value={String(metrics.activeCollections)}
            icon="sync-outline"
            description="Em processamento"
          />
        </View>

        <SectionHeader
          title="Acompanhamento atual"
          subtitle="Etapa mais recente da operação"
        />

        <View style={styles.sectionCard}>
          {metrics.latestActiveCollection ? (
            <CollectionTimeline collection={metrics.latestActiveCollection} />
          ) : (
            <EmptyState
              icon="trail-sign-outline"
              title="Nenhuma coleta em andamento"
              subtitle="Quando uma coleta for delegada, o acompanhamento aparecerá aqui."
            />
          )}
        </View>

        <SectionHeader
          title="Próximas solicitações"
          subtitle="Solicitações que ainda estão em aberto"
          actionLabel="Ver todas"
          onAction={() => navigate("/(gerador)/schedules")}
        />

        <View style={styles.sectionCard}>
          {metrics.nextSchedules.length > 0 ? (
            metrics.nextSchedules.map((schedule, index) => (
              <ScheduleCard
                key={schedule.id}
                schedule={schedule}
                isLast={index === metrics.nextSchedules.length - 1}
                onPress={() =>
                  navigate("/(gerador)/schedule-details", schedule.id)
                }
              />
            ))
          ) : (
            <EmptyState
              icon="calendar-clear-outline"
              title="Nenhuma solicitação em aberto"
              subtitle="Crie uma nova solicitação de coleta para começar."
              actionLabel="Solicitar coleta"
              onAction={() => navigate("/(gerador)/schedule")}
            />
          )}
        </View>

        <SectionHeader
          title="Coletas recentes"
          subtitle="Últimas movimentações registradas"
          actionLabel="Ver todas"
          onAction={() => navigate("/(gerador)/collections")}
        />

        <View style={styles.sectionCard}>
          {metrics.recentCollections.length > 0 ? (
            metrics.recentCollections.map((collection, index) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                isLast={index === metrics.recentCollections.length - 1}
                onPress={() =>
                  navigate("/(gerador)/collection-details", collection.id)
                }
              />
            ))
          ) : (
            <EmptyState
              icon="cube-outline"
              title="Nenhuma coleta registrada"
              subtitle="As coletas aparecerão aqui após a delegação da cooperativa."
            />
          )}
        </View>

        <SectionHeader
          title="Ações rápidas"
          subtitle="Acesse os principais recursos"
        />

        <View style={styles.sectionCard}>
          <QuickAction
            icon="add-circle-outline"
            title="Solicitar coleta"
            subtitle="Criar uma nova solicitação"
            onPress={() => navigate("/(gerador)/schedule")}
          />

          <QuickAction
            icon="calendar-number-outline"
            title="Histórico de solicitações"
            subtitle="Consultar solicitações e agendamentos"
            onPress={() => navigate("/(gerador)/schedules")}
          />

          <QuickAction
            icon="cube-outline"
            title="Histórico de coletas"
            subtitle="Acompanhar coletas e processamento"
            onPress={() => navigate("/(gerador)/collections")}
          />

          <QuickAction
            icon="pie-chart-outline"
            title="Impacto ambiental"
            subtitle="Acompanhar seus indicadores"
            onPress={() => navigate("/(gerador)/percentual")}
          />

          <QuickAction
            icon="chatbubble-ellipses-outline"
            title="Enviar feedback"
            subtitle="Compartilhar sua experiência"
            onPress={() => navigate("/(gerador)/feedback")}
          />

          <QuickAction
            icon="person-outline"
            title="Meu perfil"
            subtitle="Ver e editar os dados"
            onPress={() => navigate("/(gerador)/profile")}
            isLast
          />
        </View>
      </View>
    </ScrollView>
  );
}

function HeaderAction({
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
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.headerAction, style]}
    >
      <Ionicons name={icon} size={18} color="#FFFFFF" />
      <Text style={styles.headerActionText}>{label}</Text>
    </TouchableOpacity>
  );
}

function MetricCard({
  title,
  value,
  icon,
  description,
}: {
  title: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricIconContainer}>
        <Ionicons name={icon} size={21} color="#15803D" />
      </View>

      <Text style={styles.metricTitle}>{title}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricDescription}>{description}</Text>
    </View>
  );
}

function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderTextContainer}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>

      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction} activeOpacity={0.7}>
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function ScheduleCard({
  schedule,
  isLast,
  onPress,
}: {
  schedule: Schedule;
  isLast: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={[styles.listCard, isLast && styles.listCardLast]}
    >
      <View style={styles.listCardHeader}>
        <View style={styles.listCardIcon}>
          <Ionicons name="calendar-outline" size={19} color="#15803D" />
        </View>

        <View style={styles.listCardTitleContainer}>
          <Text style={styles.listCardTitle}>
            {formatDateTime(schedule.scheduledDate || schedule.preferredDate)}
          </Text>
          <Text style={styles.listCardIdentifier} numberOfLines={1}>
            Solicitação #{schedule.id.slice(0, 8).toUpperCase()}
          </Text>
        </View>

        <Badge
          label={translateScheduleStatus(schedule.status)}
          color={getScheduleBadgeColor(schedule.status)}
        />
      </View>

      <Text style={styles.listCardLabel}>Materiais solicitados</Text>
      <Text style={styles.listCardText} numberOfLines={3}>
        {formatRequestedMaterials(schedule.requestedMaterials)}
      </Text>

      {schedule.notes ? (
        <Text style={styles.listCardNote} numberOfLines={2}>
          Observações: {schedule.notes}
        </Text>
      ) : null}

      <View style={styles.detailsLinkRow}>
        <Text style={styles.detailsLinkText}>Ver detalhes</Text>
        <Ionicons name="arrow-forward" size={16} color="#028C56" />
      </View>
    </TouchableOpacity>
  );
}

function CollectionCard({
  collection,
  isLast,
  onPress,
}: {
  collection: Collection;
  isLast: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={[styles.listCard, isLast && styles.listCardLast]}
    >
      <View style={styles.listCardHeader}>
        <View style={styles.listCardIcon}>
          <Ionicons name="cube-outline" size={19} color="#15803D" />
        </View>

        <View style={styles.listCardTitleContainer}>
          <Text style={styles.listCardTitle}>
            {formatDateTime(getCollectionReferenceDate(collection))}
          </Text>
          <Text style={styles.listCardIdentifier} numberOfLines={1}>
            Coleta #{collection.id.slice(0, 8).toUpperCase()}
          </Text>
        </View>

        <Badge
          label={translateCollectionStatus(collection.status)}
          color={getCollectionBadgeColor(collection.status)}
        />
      </View>

      <View style={styles.collectionSummaryRow}>
        <View style={styles.collectionSummaryItem}>
          <Text style={styles.collectionSummaryLabel}>Peso registrado</Text>
          <Text style={styles.collectionSummaryValue}>
            {formatNumber(collection.totalWeightKg)} kg
          </Text>
        </View>

        <View style={styles.collectionSummaryDivider} />

        <View style={styles.collectionSummaryItem}>
          <Text style={styles.collectionSummaryLabel}>Data da coleta</Text>
          <Text style={styles.collectionSummaryValue}>
            {formatDate(collection.collectedAt || collection.createdAt)}
          </Text>
        </View>
      </View>

      <Text style={styles.listCardLabel}>Materiais registrados</Text>
      <Text style={styles.listCardText} numberOfLines={3}>
        {formatCollectionMaterials(collection)}
      </Text>

      <View style={styles.detailsLinkRow}>
        <Text style={styles.detailsLinkText}>Ver detalhes</Text>
        <Ionicons name="arrow-forward" size={16} color="#028C56" />
      </View>
    </TouchableOpacity>
  );
}

function CollectionTimeline({ collection }: { collection: Collection }) {
  const progress = getCollectionProgress(collection.status);

  return (
    <View>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() =>
          navigate("/(gerador)/collection-details", collection.id)
        }
        style={styles.timelineSummary}
      >
        <View style={styles.timelineSummaryIcon}>
          <Ionicons name="navigate-outline" size={22} color="#15803D" />
        </View>

        <View style={styles.timelineSummaryText}>
          <Text style={styles.timelineSummaryTitle}>
            Coleta #{collection.id.slice(0, 8).toUpperCase()}
          </Text>
          <Text style={styles.timelineSummarySubtitle}>
            Atualizada em {formatDateTime(getCollectionReferenceDate(collection))}
          </Text>
        </View>

        <Badge
          label={translateCollectionStatus(collection.status)}
          color={getCollectionBadgeColor(collection.status)}
        />
      </TouchableOpacity>

      {COLLECTION_TIMELINE.map((step, index) => {
        const stepIndex = COLLECTION_STATUS_ORDER.indexOf(step.key);
        const completed = progress >= stepIndex;
        const current = collection.status === step.key;
        const last = index === COLLECTION_TIMELINE.length - 1;

        return (
          <View key={step.key} style={styles.timelineStepRow}>
            <View style={styles.timelineRail}>
              <View
                style={[
                  styles.timelineDot,
                  completed && styles.timelineDotCompleted,
                  current && styles.timelineDotCurrent,
                ]}
              >
                <Ionicons
                  name={step.icon}
                  size={15}
                  color={completed ? "#FFFFFF" : "#94A3B8"}
                />
              </View>

              {!last ? (
                <View
                  style={[
                    styles.timelineLine,
                    progress > stepIndex && styles.timelineLineCompleted,
                  ]}
                />
              ) : null}
            </View>

            <View style={[styles.timelineContent, last && styles.timelineLast]}>
              <Text
                style={[
                  styles.timelineLabel,
                  completed && styles.timelineLabelCompleted,
                ]}
              >
                {step.label}
              </Text>
              <Text style={styles.timelineDescription}>{step.description}</Text>
            </View>
          </View>
        );
      })}

      <TouchableOpacity
        onPress={() =>
          navigate("/(gerador)/collection-details", collection.id)
        }
        activeOpacity={0.75}
        style={styles.timelineDetailsButton}
      >
        <Text style={styles.timelineDetailsButtonText}>
          Acompanhar coleta completa
        </Text>
        <Ionicons name="arrow-forward" size={17} color="#028C56" />
      </TouchableOpacity>
    </View>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={styles.badgeText} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

function EmptyState({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyStateIcon}>
        <Ionicons name={icon} size={34} color="#64748B" />
      </View>

      <Text style={styles.emptyStateTitle}>{title}</Text>
      <Text style={styles.emptyStateSubtitle}>{subtitle}</Text>

      {actionLabel && onAction ? (
        <TouchableOpacity
          onPress={onAction}
          activeOpacity={0.8}
          style={styles.emptyStateButton}
        >
          <Text style={styles.emptyStateButtonText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
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
      activeOpacity={0.75}
      onPress={onPress}
      style={[styles.quickAction, isLast && styles.quickActionLast]}
    >
      <View style={styles.quickActionIcon}>
        <Ionicons name={icon} size={21} color="#15803D" />
      </View>

      <View style={styles.quickActionTextContainer}>
        <Text style={styles.quickActionTitle}>{title}</Text>
        <Text style={styles.quickActionSubtitle}>{subtitle}</Text>
      </View>

      <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  screenContent: {
    paddingBottom: 32,
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
  header: {
    paddingTop: 26,
    paddingBottom: 26,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  headerIdentity: {
    flex: 1,
    paddingRight: 12,
  },
  headerEyebrow: {
    color: "#D1FAE5",
    fontSize: 14,
    fontWeight: "600",
  },
  headerTitle: {
    marginTop: 5,
    color: "#FFFFFF",
    fontSize: 29,
    lineHeight: 36,
    fontWeight: "800",
  },
  headerDescription: {
    marginTop: 9,
    color: "#ECFDF5",
    fontSize: 15,
    lineHeight: 22,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  logoutText: {
    marginLeft: 6,
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  headerActionsRow: {
    flexDirection: "row",
    marginTop: 18,
  },
  headerAction: {
    flex: 1,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  headerActionSpacing: {
    marginRight: 10,
  },
  headerActionText: {
    marginLeft: 7,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  mainContent: {
    paddingTop: 18,
    paddingHorizontal: 16,
  },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metricsRowSpacing: {
    marginTop: 12,
  },
  metricCard: {
    width: "48.5%",
    minHeight: 168,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
  },
  metricIconContainer: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "#DCFCE7",
  },
  metricTitle: {
    marginTop: 12,
    color: "#6B7280",
    fontSize: 13,
  },
  metricValue: {
    marginTop: 4,
    color: "#111827",
    fontSize: 22,
    fontWeight: "800",
  },
  metricDescription: {
    marginTop: 5,
    color: "#94A3B8",
    fontSize: 12,
    lineHeight: 17,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 22,
    marginBottom: 10,
  },
  sectionHeaderTextContainer: {
    flex: 1,
    paddingRight: 10,
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "800",
  },
  sectionSubtitle: {
    marginTop: 3,
    color: "#6B7280",
    fontSize: 13,
  },
  sectionAction: {
    color: "#028C56",
    fontSize: 13,
    fontWeight: "800",
  },
  sectionCard: {
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
  },
  listCard: {
    paddingBottom: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  listCardLast: {
    paddingBottom: 0,
    marginBottom: 0,
    borderBottomWidth: 0,
  },
  listCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  listCardIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: "#DCFCE7",
  },
  listCardTitleContainer: {
    flex: 1,
    paddingHorizontal: 10,
  },
  listCardTitle: {
    color: "#111827",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
  },
  listCardIdentifier: {
    marginTop: 2,
    color: "#94A3B8",
    fontSize: 11,
  },
  listCardLabel: {
    marginTop: 13,
    color: "#374151",
    fontSize: 12,
    fontWeight: "800",
  },
  listCardText: {
    marginTop: 4,
    color: "#4B5563",
    fontSize: 13,
    lineHeight: 19,
  },
  listCardNote: {
    marginTop: 7,
    color: "#6B7280",
    fontSize: 12,
    lineHeight: 18,
  },
  detailsLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 12,
  },
  detailsLinkText: {
    marginRight: 5,
    color: "#028C56",
    fontSize: 13,
    fontWeight: "800",
  },
  collectionSummaryRow: {
    flexDirection: "row",
    marginTop: 13,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
  },
  collectionSummaryItem: {
    flex: 1,
    paddingHorizontal: 10,
  },
  collectionSummaryDivider: {
    width: 1,
    backgroundColor: "#E2E8F0",
  },
  collectionSummaryLabel: {
    color: "#64748B",
    fontSize: 11,
  },
  collectionSummaryValue: {
    marginTop: 3,
    color: "#111827",
    fontSize: 13,
    fontWeight: "800",
  },
  badge: {
    maxWidth: 108,
    minHeight: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center",
  },
  timelineSummary: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 16,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  timelineSummaryIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "#DCFCE7",
  },
  timelineSummaryText: {
    flex: 1,
    paddingHorizontal: 10,
  },
  timelineSummaryTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "800",
  },
  timelineSummarySubtitle: {
    marginTop: 3,
    color: "#64748B",
    fontSize: 11,
    lineHeight: 16,
  },
  timelineStepRow: {
    flexDirection: "row",
  },
  timelineRail: {
    width: 34,
    alignItems: "center",
  },
  timelineDot: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 15,
    backgroundColor: "#F8FAFC",
  },
  timelineDotCompleted: {
    borderColor: "#16A34A",
    backgroundColor: "#16A34A",
  },
  timelineDotCurrent: {
    borderWidth: 3,
    borderColor: "#BBF7D0",
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 34,
    backgroundColor: "#E2E8F0",
  },
  timelineLineCompleted: {
    backgroundColor: "#22C55E",
  },
  timelineContent: {
    flex: 1,
    minHeight: 66,
    paddingLeft: 10,
    paddingBottom: 12,
  },
  timelineLast: {
    minHeight: 44,
    paddingBottom: 0,
  },
  timelineLabel: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "700",
  },
  timelineLabelCompleted: {
    color: "#166534",
  },
  timelineDescription: {
    marginTop: 3,
    color: "#94A3B8",
    fontSize: 12,
    lineHeight: 17,
  },
  timelineDetailsButton: {
    height: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#86EFAC",
    borderRadius: 12,
    backgroundColor: "#F0FDF4",
  },
  timelineDetailsButtonText: {
    marginRight: 7,
    color: "#028C56",
    fontSize: 13,
    fontWeight: "800",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 8,
  },
  emptyStateIcon: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 32,
    backgroundColor: "#F1F5F9",
  },
  emptyStateTitle: {
    marginTop: 12,
    color: "#374151",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  emptyStateSubtitle: {
    marginTop: 6,
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  emptyStateButton: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#028C56",
  },
  emptyStateButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  quickAction: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 14,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  quickActionLast: {
    paddingBottom: 0,
    marginBottom: 0,
    borderBottomWidth: 0,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderRadius: 22,
    backgroundColor: "#DCFCE7",
  },
  quickActionTextContainer: {
    flex: 1,
  },
  quickActionTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "800",
  },
  quickActionSubtitle: {
    marginTop: 2,
    color: "#6B7280",
    fontSize: 13,
  },
});
