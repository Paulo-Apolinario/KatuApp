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
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import {
  collectionService,
  type Collection,
  type CollectionMaterial,
} from "@/src/services/collectionService";

function formatDateTime(dateString?: string | null) {
  if (!dateString) return "-";

  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return "-";

  return parsed.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function translateCollectionStatus(status: Collection["status"]) {
  switch (status) {
    case "PENDING":
      return "Pendente";
    case "IN_PROGRESS":
      return "Em andamento";
    case "COMPLETED":
      return "Concluída";
    case "CANCELLED":
      return "Cancelada";
    default:
      return status;
  }
}

function getCollectionStatusColor(status: Collection["status"]) {
  switch (status) {
    case "PENDING":
      return "#64748B";
    case "IN_PROGRESS":
      return "#F59E0B";
    case "COMPLETED":
      return "#10B981";
    case "CANCELLED":
      return "#DC2626";
    default:
      return "#64748B";
  }
}

function getOriginLabel(item: Collection) {
  if (item.generatorId) return "Gerador";
  if (item.schedule?.requestedBy?.displayName || item.schedule?.requestedBy?.email) {
    return "Pessoa física";
  }
  return "Solicitação";
}

function getSourceName(item: Collection) {
  if (item.generator?.companyName) return item.generator.companyName;
  if (item.generator?.name) return item.generator.name;
  if (item.schedule?.requestedBy?.displayName) return item.schedule.requestedBy.displayName;
  if (item.schedule?.requestedBy?.email) return item.schedule.requestedBy.email;
  return "Origem não identificada";
}

function getAddress(item: Collection) {
  return item.generator?.address || "-";
}

function extractRequestedMaterials(notes?: string | null): string[] {
  if (!notes) return [];

  const match = notes.match(/Materiais solicitados:\s*([^|]+)/i);
  if (!match) return [];

  return match[1]
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeMaterialsForEditing(item: Collection): CollectionMaterial[] {
  if (Array.isArray(item.materials) && item.materials.length > 0) {
    return item.materials.map((material) => ({
      type: material.type,
      quantityKg: Number(material.quantityKg || 0),
    }));
  }

  return extractRequestedMaterials(item.schedule?.notes).map((type) => ({
    type,
    quantityKg: 0,
  }));
}

function formatMaterials(materials?: CollectionMaterial[]) {
  if (!Array.isArray(materials) || materials.length === 0) return "-";

  return materials
    .map((item) => `${item.type}: ${Number(item.quantityKg || 0).toFixed(1)} kg`)
    .join(" • ");
}

export default function CollectScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [materialsDraft, setMaterialsDraft] = useState<CollectionMaterial[]>([]);
  const [notesDraft, setNotesDraft] = useState("");

  const loadCollections = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);

      const response = await collectionService.list();
      setCollections(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error("Erro ao carregar coletas delegadas:", error);
      Alert.alert("Erro", "Não foi possível carregar as coletas delegadas.");
      setCollections([]);
    } finally {
      if (showLoader) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCollections(true);
    }, [loadCollections])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCollections(false);
  }, [loadCollections]);

  const delegatedCollections = useMemo(() => {
    return collections.filter(
      (item) => item.status === "PENDING" || item.status === "IN_PROGRESS"
    );
  }, [collections]);

  const selectedCollection = useMemo(() => {
    return (
      delegatedCollections.find((item) => item.id === selectedCollectionId) || null
    );
  }, [delegatedCollections, selectedCollectionId]);

  const metrics = useMemo(() => {
    const pending = delegatedCollections.filter(
      (item) => item.status === "PENDING"
    ).length;

    const inProgress = delegatedCollections.filter(
      (item) => item.status === "IN_PROGRESS"
    ).length;

    return {
      pending,
      inProgress,
      total: delegatedCollections.length,
    };
  }, [delegatedCollections]);

  const totalDraftWeight = useMemo(() => {
    return materialsDraft.reduce(
      (acc, item) => acc + Number(item.quantityKg || 0),
      0
    );
  }, [materialsDraft]);

  const handleOpenCollection = (collection: Collection) => {
    setSelectedCollectionId(collection.id);
    setMaterialsDraft(normalizeMaterialsForEditing(collection));
    setNotesDraft(collection.notes || "");
  };

  const updateMaterialQuantity = (index: number, value: string) => {
    const numeric = Number(String(value).replace(",", "."));
    const safeValue = Number.isNaN(numeric) ? 0 : numeric;

    setMaterialsDraft((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              quantityKg: safeValue,
            }
          : item
      )
    );
  };

  const handleStartCollection = async () => {
    if (!selectedCollection) {
      Alert.alert("Atenção", "Selecione uma coleta delegada.");
      return;
    }

    try {
      setUpdatingId(selectedCollection.id);

      await collectionService.updateStatus(selectedCollection.id, {
        status: "IN_PROGRESS",
      });

      await loadCollections(false);
      Alert.alert("Sucesso", "Coleta iniciada com sucesso.");
    } catch (error: any) {
      Alert.alert(
        "Erro",
        error?.message || "Não foi possível iniciar a coleta."
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCompleteCollection = async () => {
    if (!selectedCollection) {
      Alert.alert("Atenção", "Selecione uma coleta delegada.");
      return;
    }

    if (materialsDraft.length === 0) {
      Alert.alert(
        "Atenção",
        "Informe ao menos um material com quantidade para concluir."
      );
      return;
    }

    const hasInvalidQuantity = materialsDraft.some(
      (item) => Number(item.quantityKg) <= 0
    );

    if (hasInvalidQuantity) {
      Alert.alert(
        "Atenção",
        "Todas as quantidades dos materiais devem ser maiores que zero."
      );
      return;
    }

    try {
      setUpdatingId(selectedCollection.id);

      await collectionService.updateStatus(selectedCollection.id, {
        status: "COMPLETED",
        collectedAt: new Date().toISOString(),
        totalWeightKg: totalDraftWeight,
        materials: materialsDraft,
        notes: notesDraft,
      });

      await loadCollections(false);
      Alert.alert("Sucesso", "Coleta concluída com sucesso.");
    } catch (error: any) {
      Alert.alert(
        "Erro",
        error?.message || "Não foi possível concluir a coleta."
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const handleReportProblem = async () => {
    if (!selectedCollection) {
      Alert.alert("Atenção", "Selecione uma coleta delegada.");
      return;
    }

    try {
      setUpdatingId(selectedCollection.id);

      await collectionService.updateStatus(selectedCollection.id, {
        status: "CANCELLED",
        notes:
          notesDraft?.trim() ||
          "Problema operacional informado pelo catador.",
      });

      await loadCollections(false);
      Alert.alert("Sucesso", "Problema registrado e coleta cancelada.");
    } catch (error: any) {
      Alert.alert(
        "Erro",
        error?.message || "Não foi possível atualizar a coleta."
      );
    } finally {
      setUpdatingId(null);
    }
  };

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
        <ActivityIndicator size="large" color="#028C56" />
        <Text style={{ marginTop: 10, color: "#6B7280" }}>
          Carregando coletas delegadas...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#F3F4F6" }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 28 }}
    >
      <LinearGradient
        colors={["#16a34a", "#22c55e"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          paddingTop: 28,
          paddingBottom: 26,
          paddingHorizontal: 20,
          borderBottomLeftRadius: 30,
          borderBottomRightRadius: 30,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 24,
              fontWeight: "800",
            }}
          >
            Coletas delegadas
          </Text>

          <View style={{ width: 24 }} />
        </View>

        <Text
          style={{
            color: "#E8FFF1",
            fontSize: 15,
            marginTop: 10,
            lineHeight: 22,
          }}
        >
          Aqui aparecem as coletas que a cooperativa delegou para este catador.
        </Text>
      </LinearGradient>

      <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <MetricCard
            title="Delegadas"
            value={String(metrics.total)}
            icon="clipboard-outline"
          />
          <MetricCard
            title="Pendentes"
            value={String(metrics.pending)}
            icon="time-outline"
          />
        </View>

        <View style={{ marginTop: 12 }}>
          <MetricCardFull
            title="Em andamento"
            value={String(metrics.inProgress)}
            icon="trail-sign-outline"
          />
        </View>

        <SectionHeader title="Fila operacional" />

        <View style={sectionCard}>
          {delegatedCollections.length > 0 ? (
            delegatedCollections.map((item) => {
              const selected = item.id === selectedCollectionId;

              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.85}
                  onPress={() => handleOpenCollection(item)}
                  style={[
                    listItemCard,
                    {
                      borderColor: selected ? "#028C56" : "#E5E7EB",
                      backgroundColor: selected ? "#F0FDF4" : "#F9FAFB",
                    },
                  ]}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={itemTitle}>{getSourceName(item)}</Text>

                      <Text style={itemText}>Origem: {getOriginLabel(item)}</Text>

                      <Text style={itemText}>Endereço: {getAddress(item)}</Text>

                      <Text style={itemText}>
                        Materiais:{" "}
                        {formatMaterials(
                          item.materials?.length
                            ? item.materials
                            : normalizeMaterialsForEditing(item)
                        )}
                      </Text>

                      <Text style={itemSubtext}>
                        Data:{" "}
                        {formatDateTime(
                          item.schedule?.scheduledDate ||
                            item.schedule?.preferredDate ||
                            item.createdAt
                        )}
                      </Text>

                      {!!item.notes && (
                        <Text style={itemSubtext}>Observações: {item.notes}</Text>
                      )}
                    </View>

                    <StatusBadge
                      label={translateCollectionStatus(item.status)}
                      color={getCollectionStatusColor(item.status)}
                    />
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <EmptyState
              icon="clipboard-outline"
              title="Nenhuma coleta delegada"
              subtitle="Quando a cooperativa atribuir coletas a este catador, elas aparecerão aqui."
            />
          )}
        </View>

        {selectedCollection && (
          <>
            <SectionHeader title="Detalhes da coleta" />

            <View style={sectionCard}>
              <InfoRow label="Origem" value={getOriginLabel(selectedCollection)} />
              <InfoRow label="Solicitante" value={getSourceName(selectedCollection)} />
              <InfoRow label="Endereço" value={getAddress(selectedCollection)} />
              <InfoRow
                label="Status"
                value={translateCollectionStatus(selectedCollection.status)}
              />
              <InfoRow
                label="Data"
                value={formatDateTime(
                  selectedCollection.schedule?.scheduledDate ||
                    selectedCollection.schedule?.preferredDate ||
                    selectedCollection.createdAt
                )}
              />
              <InfoRow
                label="Materiais"
                value={formatMaterials(
                  materialsDraft.length > 0
                    ? materialsDraft
                    : normalizeMaterialsForEditing(selectedCollection)
                )}
              />
              <InfoRow
                label="Peso total"
                value={`${Number(
                  selectedCollection.status === "COMPLETED"
                    ? selectedCollection.totalWeightKg || 0
                    : totalDraftWeight
                ).toFixed(1)} kg`}
                isLast
              />
            </View>

            {selectedCollection.status === "IN_PROGRESS" && (
              <>
                <SectionHeader title="Registrar quantidade por material" />

                <View style={sectionCard}>
                  {materialsDraft.length > 0 ? (
                    materialsDraft.map((material, index) => (
                      <View
                        key={`${material.type}-${index}`}
                        style={{
                          marginBottom: index === materialsDraft.length - 1 ? 0 : 14,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: "700",
                            color: "#111827",
                            marginBottom: 6,
                          }}
                        >
                          {material.type}
                        </Text>

                        <TextInput
                          value={String(material.quantityKg || "")}
                          onChangeText={(value) => updateMaterialQuantity(index, value)}
                          keyboardType="numeric"
                          placeholder="Quantidade em kg"
                          placeholderTextColor="#9CA3AF"
                          style={{
                            borderWidth: 1,
                            borderColor: "#D1D5DB",
                            borderRadius: 10,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            backgroundColor: "#FFFFFF",
                            color: "#111827",
                          }}
                        />
                      </View>
                    ))
                  ) : (
                    <Text style={{ color: "#6B7280" }}>
                      Nenhum material disponível para informar.
                    </Text>
                  )}

                  <View
                    style={{
                      marginTop: 16,
                      paddingTop: 14,
                      borderTopWidth: 1,
                      borderTopColor: "#E5E7EB",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "800",
                        color: "#028C56",
                      }}
                    >
                      Total calculado: {totalDraftWeight.toFixed(1)} kg
                    </Text>
                  </View>

                  <View style={{ marginTop: 16 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        color: "#111827",
                        fontWeight: "700",
                        marginBottom: 6,
                      }}
                    >
                      Observações finais
                    </Text>

                    <TextInput
                      value={notesDraft}
                      onChangeText={setNotesDraft}
                      multiline
                      placeholder="Observações da execução da coleta"
                      placeholderTextColor="#9CA3AF"
                      style={{
                        minHeight: 90,
                        borderWidth: 1,
                        borderColor: "#D1D5DB",
                        borderRadius: 10,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        backgroundColor: "#FFFFFF",
                        color: "#111827",
                        textAlignVertical: "top",
                      }}
                    />
                  </View>
                </View>
              </>
            )}

            <SectionHeader title="Ações" />

            <View style={sectionCard}>
              {selectedCollection.status === "PENDING" && (
                <QuickAction
                  icon="play-outline"
                  title="Iniciar coleta"
                  subtitle="Coloca a coleta em andamento"
                  onPress={handleStartCollection}
                  loading={updatingId === selectedCollection.id}
                />
              )}

              {selectedCollection.status === "IN_PROGRESS" && (
                <QuickAction
                  icon="checkmark-circle-outline"
                  title="Concluir coleta"
                  subtitle="Finaliza a coleta com peso real por material"
                  onPress={handleCompleteCollection}
                  loading={updatingId === selectedCollection.id}
                />
              )}

              {(selectedCollection.status === "PENDING" ||
                selectedCollection.status === "IN_PROGRESS") && (
                <QuickAction
                  icon="alert-circle-outline"
                  title="Relatar problema"
                  subtitle="Cancelar a coleta por problema operacional"
                  onPress={handleReportProblem}
                  loading={updatingId === selectedCollection.id}
                  isLast
                />
              )}
            </View>
          </>
        )}
      </View>
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
    <View
      style={{
        width: "48.5%",
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: "#E5E7EB",
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
        <Ionicons name={icon} size={22} color="#028C56" />
      </View>

      <Text style={{ color: "#6B7280", fontSize: 13 }}>{title}</Text>
      <Text style={{ color: "#111827", fontSize: 24, fontWeight: "800", marginTop: 4 }}>
        {value}
      </Text>
    </View>
  );
}

function MetricCardFull({
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
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: "#E5E7EB",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: "#FEF3C7",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Ionicons name={icon} size={22} color="#D97706" />
        </View>

        <View>
          <Text style={{ color: "#6B7280", fontSize: 13 }}>{title}</Text>
          <Text style={{ color: "#111827", fontSize: 24, fontWeight: "800", marginTop: 2 }}>
            {value}
          </Text>
        </View>
      </View>
    </View>
  );
}

function SectionHeader({
  title,
}: {
  title: string;
}) {
  return (
    <Text
      style={{
        fontSize: 18,
        fontWeight: "800",
        color: "#111827",
        marginTop: 20,
        marginBottom: 12,
      }}
    >
      {title}
    </Text>
  );
}

function QuickAction({
  icon,
  title,
  subtitle,
  onPress,
  loading = false,
  isLast = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
  loading?: boolean;
  isLast?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={loading}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingBottom: isLast ? 0 : 16,
        marginBottom: isLast ? 0 : 16,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: "#E5E7EB",
        opacity: loading ? 0.7 : 1,
      }}
    >
      <View
        style={{
          width: 46,
          height: 46,
          borderRadius: 23,
          backgroundColor: "#F3F4F6",
          alignItems: "center",
          justifyContent: "center",
          marginRight: 14,
        }}
      >
        {loading ? (
          <ActivityIndicator color="#028C56" />
        ) : (
          <Ionicons name={icon} size={22} color="#028C56" />
        )}
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: "#111827" }}>
          {title}
        </Text>
        <Text style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>
          {subtitle}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function StatusBadge({
  label,
  color,
}: {
  label: string;
  color: string;
}) {
  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: color,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
      }}
    >
      <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "800" }}>
        {label.toUpperCase()}
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
      <Text style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 15, color: "#111827", fontWeight: "600" }}>
        {value || "-"}
      </Text>
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
    <View style={{ alignItems: "center", paddingVertical: 28 }}>
      <Ionicons name={icon} size={42} color="#9CA3AF" />
      <Text
        style={{
          marginTop: 12,
          fontSize: 16,
          fontWeight: "700",
          color: "#111827",
          textAlign: "center",
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          marginTop: 6,
          fontSize: 14,
          color: "#6B7280",
          textAlign: "center",
          lineHeight: 22,
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

const listItemCard = {
  borderWidth: 1,
  borderRadius: 16,
  padding: 14,
  marginBottom: 12,
} as const;

const itemTitle = {
  fontSize: 15,
  fontWeight: "800" as const,
  color: "#111827",
} as const;

const itemText = {
  fontSize: 14,
  color: "#374151",
  marginTop: 4,
} as const;

const itemSubtext = {
  fontSize: 12,
  color: "#6B7280",
  marginTop: 4,
} as const;