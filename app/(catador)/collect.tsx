import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  Modal,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNotification } from "@/src/contexts/NotificationContext";

import { OfflineBanner } from "@/src/components/OfflineBanner";
import { LastSyncBadge } from "@/src/components/LastSyncBadge";
import { useConnectivity } from "@/src/hooks/useConnectivity";
import {
  collectionService,
  type Collection,
  type CollectionMaterial,
  type WasteUnit,
} from "@/src/services/collectionService";
import { wasteCatalogService } from "@/src/services/wasteCatalogService";
import type { WasteCatalogItem } from "@/src/types/collection";

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
  if (
    item.schedule?.requestedBy?.displayName ||
    item.schedule?.requestedBy?.email
  ) {
    return "Pessoa física";
  }
  return "Solicitação";
}

function getSourceName(item: Collection) {
  if (item.generator?.companyName) return item.generator.companyName;
  if (item.generator?.name) return item.generator.name;
  if (item.schedule?.requestedBy?.displayName) {
    return item.schedule.requestedBy.displayName;
  }
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
    return item.materials.map((material) => {
      const unit = material.unit || "KG";
      const quantity =
        material.quantity !== undefined
          ? Number(material.quantity)
          : Number(material.quantityKg || 0);

      return {
        wasteTypeId: material.wasteTypeId || null,
        type: material.type || material.name || "Material",
        name: material.name || material.type || "Material",
        category: material.category || null,
        subcategory: material.subcategory || null,
        quantity,
        quantityKg:
          material.quantityKg !== undefined
            ? Number(material.quantityKg)
            : unit === "KG"
              ? quantity
              : unit === "TON"
                ? quantity * 1000
                : 0,
        unit,
      };
    });
  }

  return extractRequestedMaterials(item.schedule?.notes).map((type) => ({
    type,
    name: type,
    quantity: 0,
    quantityKg: 0,
    unit: "KG",
  }));
}

function formatUnit(unit?: WasteUnit) {
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

function quantityToKg(quantity: number, unit: WasteUnit) {
  if (unit === "KG") return quantity;
  if (unit === "TON") return quantity * 1000;
  return 0;
}

function formatMaterials(materials?: CollectionMaterial[]) {
  if (!Array.isArray(materials) || materials.length === 0) return "-";

  return materials
    .map((item) => {
      const unit = item.unit || "KG";
      const quantity =
        item.quantity !== undefined
          ? Number(item.quantity)
          : Number(item.quantityKg || 0);

      return `${item.name || item.type}: ${quantity.toFixed(1)} ${formatUnit(unit)}`;
    })
    .join(" • ");
}

export default function CollectScreen() {
  const { isOffline } = useConnectivity();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [materialsDraft, setMaterialsDraft] = useState<CollectionMaterial[]>([]);
  const [notesDraft, setNotesDraft] = useState("");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [catalogItems, setCatalogItems] = useState<WasteCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogModalVisible, setCatalogModalVisible] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const { notifyError, notifySuccess } = useNotification();

  const loadCollections = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);

      const response = await collectionService.list();
      const nextCollections = Array.isArray(response) ? response : [];
      setCollections(nextCollections);
      setLastSyncAt(new Date().toISOString());

      setSelectedCollectionId((currentId) => {
        if (!currentId) return currentId;

        const stillExists = nextCollections.some(
          (item) =>
            item.id === currentId &&
            (item.status === "PENDING" || item.status === "IN_PROGRESS")
        );

        return stillExists ? currentId : "";
      });
    } catch (error) {
      console.error("Erro ao carregar coletas delegadas:", error);
      notifyError("Erro", "Não foi possível carregar as coletas delegadas.");
      setCollections([]);
    } finally {
      if (showLoader) setLoading(false);
      setRefreshing(false);
    }
  }, [notifyError]);

  useFocusEffect(
    useCallback(() => {
      void loadCollections(true);
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
    return materialsDraft.reduce((acc, item) => {
      const unit = item.unit || "KG";
      const quantity =
        item.quantity !== undefined
          ? Number(item.quantity)
          : Number(item.quantityKg || 0);

      return acc + quantityToKg(quantity, unit);
    }, 0);
  }, [materialsDraft]);

  const filteredCatalogItems = useMemo(() => {
    const term = catalogSearch.trim().toLocaleLowerCase("pt-BR");

    if (!term) return catalogItems;

    return catalogItems.filter((item) =>
      [
        item.name,
        item.category,
        item.subcategory,
        item.internalCode,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(term)
    );
  }, [catalogItems, catalogSearch]);

  const handleOpenCollection = (collection: Collection) => {
    setSelectedCollectionId(collection.id);
    setMaterialsDraft(normalizeMaterialsForEditing(collection));
    setNotesDraft(collection.notes || "");
  };

  const updateMaterialQuantity = (index: number, value: string) => {
    const numeric = Number(String(value).replace(",", "."));
    const safeValue = Number.isFinite(numeric) ? numeric : 0;

    setMaterialsDraft((prev) =>
      prev.map((item, itemIndex) => {
        if (itemIndex !== index) return item;

        const unit = item.unit || "KG";

        return {
          ...item,
          quantity: safeValue,
          quantityKg: quantityToKg(safeValue, unit),
        };
      })
    );
  };

  const updateMaterialUnit = (index: number, unit: WasteUnit) => {
    setMaterialsDraft((prev) =>
      prev.map((item, itemIndex) => {
        if (itemIndex !== index) return item;

        const quantity =
          item.quantity !== undefined
            ? Number(item.quantity)
            : Number(item.quantityKg || 0);

        return {
          ...item,
          unit,
          quantity,
          quantityKg: quantityToKg(quantity, unit),
        };
      })
    );
  };

  const removeMaterial = (index: number) => {
    setMaterialsDraft((prev) =>
      prev.filter((_, itemIndex) => itemIndex !== index)
    );
  };

  const loadCatalog = async () => {
    try {
      setCatalogLoading(true);
      const items = await wasteCatalogService.list();
      setCatalogItems(items);
      setCatalogModalVisible(true);
    } catch (error: any) {
      notifyError(
        "Erro",
        error?.message || "Não foi possível carregar o catálogo de resíduos."
      );
    } finally {
      setCatalogLoading(false);
    }
  };

  const addCatalogMaterial = (catalogItem: WasteCatalogItem) => {
    const alreadyAdded = materialsDraft.some(
      (item) => item.wasteTypeId === catalogItem.id
    );

    if (alreadyAdded) {
      notifyError("Atenção", "Este resíduo já foi adicionado à coleta.");
      return;
    }

    const unit = catalogItem.unit || catalogItem.defaultUnit || "KG";

    setMaterialsDraft((prev) => [
      ...prev,
      {
        wasteTypeId: catalogItem.id,
        type: catalogItem.name,
        name: catalogItem.name,
        category: catalogItem.category || null,
        subcategory: catalogItem.subcategory || null,
        quantity: 0,
        quantityKg: 0,
        unit,
      },
    ]);

    setCatalogModalVisible(false);
    setCatalogSearch("");
  };

  const showOperationSuccess = (messageOnline: string, messageOffline: string) => {
    notifySuccess("Sucesso", isOffline ? messageOffline : messageOnline);
  };

  const handleStartCollection = async () => {
    if (!selectedCollection) {
      notifyError("Atenção", "Selecione uma coleta delegada.");
      return;
    }

    try {
      setUpdatingId(selectedCollection.id);

      await collectionService.updateStatus(selectedCollection.id, {
        status: "IN_PROGRESS",
        notes: notesDraft,
      });

      await loadCollections(false);
      showOperationSuccess(
        "Coleta iniciada com sucesso.",
        "Coleta iniciada e salva no dispositivo. Será sincronizada quando a internet voltar."
      );
    } catch (error: any) {
      notifyError("Erro", error?.message || "Não foi possível iniciar a coleta.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCompleteCollection = async () => {
    if (!selectedCollection) {
      notifyError("Atenção", "Selecione uma coleta delegada.");
      return;
    }

    if (materialsDraft.length === 0) {
      notifyError("Atenção", "Informe ao menos um material com quantidade para concluir.");
      return;
    }

    const hasInvalidQuantity = materialsDraft.some((item) => {
      const quantity =
        item.quantity !== undefined
          ? Number(item.quantity)
          : Number(item.quantityKg || 0);

      return !Number.isFinite(quantity) || quantity <= 0;
    });

    if (hasInvalidQuantity) {
      notifyError("Atenção", "Todas as quantidades dos materiais devem ser maiores que zero.");
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
      showOperationSuccess(
        "Coleta concluída com sucesso.",
        "Coleta concluída e salva no dispositivo. Será sincronizada quando a internet voltar."
      );
    } catch (error: any) {
      notifyError("Erro", error?.message || "Não foi possível concluir a coleta.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleReportProblem = async () => {
    if (!selectedCollection) {
      notifyError("Atenção", "Selecione uma coleta delegada.");
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
      showOperationSuccess(
        "Problema registrado e coleta cancelada.",
        "Problema registrado no dispositivo. Será sincronizado quando a internet voltar."
      );
    } catch (error: any) {
      notifyError("Erro", error?.message || "Não foi possível atualizar a coleta.");
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

          <TouchableOpacity
            onPress={() => void onRefresh()}
            disabled={refreshing}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: "rgba(255,255,255,0.18)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="refresh-outline" size={20} color="#FFFFFF" />
            )}
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
          Aqui aparecem as coletas atribuídas para este catador com contexto operacional completo.
        </Text>
      </LinearGradient>

      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <OfflineBanner visible={isOffline} />
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <LastSyncBadge value={lastSyncAt} />
      </View>

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

                      {!!item.route?.name && (
                        <Text style={itemText}>Rota: {item.route.name}</Text>
                      )}

                      {!!item.driver?.name && (
                        <Text style={itemText}>Motorista: {item.driver.name}</Text>
                      )}

                      {!!item.vehicle?.model && (
                        <Text style={itemText}>
                          Veículo: {item.vehicle.model}
                          {item.vehicle.plate ? ` • ${item.vehicle.plate}` : ""}
                        </Text>
                      )}

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
            <SectionHeader title="Operação atual" />

            <View style={sectionCard}>
              <InfoRow label="Origem" value={getOriginLabel(selectedCollection)} />
              <InfoRow label="Solicitante" value={getSourceName(selectedCollection)} />
              <InfoRow label="Endereço" value={getAddress(selectedCollection)} />
              <InfoRow
                label="Status"
                value={translateCollectionStatus(selectedCollection.status)}
              />
              <InfoRow
                label="Rota"
                value={selectedCollection.route?.name || "-"}
              />
              <InfoRow
                label="Motorista"
                value={selectedCollection.driver?.name || "-"}
              />
              <InfoRow
                label="Veículo"
                value={
                  selectedCollection.vehicle
                    ? `${selectedCollection.vehicle.model}${
                        selectedCollection.vehicle.plate
                          ? ` • ${selectedCollection.vehicle.plate}`
                          : ""
                      }`
                    : "-"
                }
              />
              <InfoRow
                label="Data"
                value={formatDateTime(
                  selectedCollection.schedule?.scheduledDate ||
                    selectedCollection.schedule?.preferredDate ||
                    selectedCollection.createdAt
                )}
                isLast
              />
            </View>

            <SectionHeader title="Detalhes da coleta" />

            <View style={sectionCard}>
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
                <SectionHeader title="Registrar materiais coletados" />

                <View style={sectionCard}>
                  <TouchableOpacity
                    onPress={() => void loadCatalog()}
                    disabled={catalogLoading}
                    style={{
                      minHeight: 48,
                      borderRadius: 12,
                      backgroundColor: "#ECFDF5",
                      borderWidth: 1,
                      borderColor: "#A7F3D0",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 16,
                    }}
                  >
                    {catalogLoading ? (
                      <ActivityIndicator size="small" color="#028C56" />
                    ) : (
                      <>
                        <Ionicons name="add-circle-outline" size={20} color="#028C56" />
                        <Text
                          style={{
                            marginLeft: 8,
                            color: "#028C56",
                            fontWeight: "800",
                          }}
                        >
                          Adicionar resíduo do catálogo
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {materialsDraft.length > 0 ? (
                    materialsDraft.map((material, index) => {
                      const unit = material.unit || "KG";
                      const quantity =
                        material.quantity !== undefined
                          ? Number(material.quantity)
                          : Number(material.quantityKg || 0);

                      return (
                        <View
                          key={`${material.wasteTypeId || material.type}-${index}`}
                          style={{
                            borderWidth: 1,
                            borderColor: "#E5E7EB",
                            borderRadius: 14,
                            padding: 14,
                            marginBottom:
                              index === materialsDraft.length - 1 ? 0 : 14,
                            backgroundColor: "#F9FAFB",
                          }}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                            }}
                          >
                            <View style={{ flex: 1, paddingRight: 12 }}>
                              <Text
                                style={{
                                  fontSize: 15,
                                  fontWeight: "800",
                                  color: "#111827",
                                }}
                              >
                                {material.name || material.type}
                              </Text>

                              {!!material.category && (
                                <Text
                                  style={{
                                    fontSize: 12,
                                    color: "#6B7280",
                                    marginTop: 3,
                                  }}
                                >
                                  {material.category}
                                  {material.subcategory
                                    ? ` • ${material.subcategory}`
                                    : ""}
                                </Text>
                              )}
                            </View>

                            <TouchableOpacity
                              onPress={() => removeMaterial(index)}
                              accessibilityLabel="Remover material"
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: 17,
                                backgroundColor: "#FEE2E2",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Ionicons name="trash-outline" size={17} color="#DC2626" />
                            </TouchableOpacity>
                          </View>

                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: "700",
                              color: "#374151",
                              marginTop: 14,
                              marginBottom: 7,
                            }}
                          >
                            Unidade
                          </Text>

                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ paddingRight: 4 }}
                          >
                            {(
                              [
                                ["KG", "kg"],
                                ["TON", "t"],
                                ["LITER", "L"],
                                ["UNIT", "un"],
                                ["CUBIC_METER", "m³"],
                              ] as [WasteUnit, string][]
                            ).map(([value, label]) => {
                              const active = unit === value;

                              return (
                                <TouchableOpacity
                                  key={value}
                                  onPress={() => updateMaterialUnit(index, value)}
                                  style={{
                                    paddingHorizontal: 13,
                                    paddingVertical: 8,
                                    borderRadius: 999,
                                    marginRight: 8,
                                    borderWidth: 1,
                                    borderColor: active ? "#028C56" : "#D1D5DB",
                                    backgroundColor: active ? "#DCFCE7" : "#FFFFFF",
                                  }}
                                >
                                  <Text
                                    style={{
                                      color: active ? "#047857" : "#4B5563",
                                      fontWeight: active ? "800" : "600",
                                    }}
                                  >
                                    {label}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>

                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: "700",
                              color: "#374151",
                              marginTop: 14,
                              marginBottom: 7,
                            }}
                          >
                            Quantidade ({formatUnit(unit)})
                          </Text>

                          <TextInput
                            value={quantity > 0 ? String(quantity) : ""}
                            onChangeText={(value) =>
                              updateMaterialQuantity(index, value)
                            }
                            keyboardType="decimal-pad"
                            placeholder={`Quantidade em ${formatUnit(unit)}`}
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

                          {(unit === "KG" || unit === "TON") && (
                            <Text
                              style={{
                                fontSize: 12,
                                color: "#6B7280",
                                marginTop: 7,
                              }}
                            >
                              Equivalente: {Number(material.quantityKg || 0).toFixed(2)} kg
                            </Text>
                          )}
                        </View>
                      );
                    })
                  ) : (
                    <View
                      style={{
                        alignItems: "center",
                        paddingVertical: 18,
                      }}
                    >
                      <Ionicons name="cube-outline" size={30} color="#9CA3AF" />
                      <Text
                        style={{
                          color: "#6B7280",
                          textAlign: "center",
                          marginTop: 8,
                        }}
                      >
                        Nenhum material informado. Adicione os resíduos encontrados na coleta.
                      </Text>
                    </View>
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
                      Peso total calculado: {totalDraftWeight.toFixed(2)} kg
                    </Text>
                    <Text
                      style={{
                        color: "#6B7280",
                        fontSize: 12,
                        marginTop: 4,
                      }}
                    >
                      Litros, unidades e metros cúbicos não entram automaticamente no peso em kg.
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

      <Modal
        visible={catalogModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCatalogModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(17,24,39,0.45)",
            justifyContent: "flex-end",
          }}
        >
          <Pressable
            style={{ flex: 1 }}
            onPress={() => setCatalogModalVisible(false)}
          />

          <View
            style={{
              maxHeight: "78%",
              backgroundColor: "#FFFFFF",
              borderTopLeftRadius: 26,
              borderTopRightRadius: 26,
              paddingHorizontal: 18,
              paddingTop: 18,
              paddingBottom: 28,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <View>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: "800",
                    color: "#111827",
                  }}
                >
                  Catálogo de resíduos
                </Text>
                <Text
                  style={{
                    color: "#6B7280",
                    marginTop: 3,
                  }}
                >
                  Selecione o material coletado
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setCatalogModalVisible(false)}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: "#F3F4F6",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="close" size={22} color="#374151" />
              </TouchableOpacity>
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderWidth: 1,
                borderColor: "#D1D5DB",
                borderRadius: 12,
                paddingHorizontal: 12,
                marginTop: 16,
                marginBottom: 14,
              }}
            >
              <Ionicons name="search-outline" size={20} color="#6B7280" />
              <TextInput
                value={catalogSearch}
                onChangeText={setCatalogSearch}
                placeholder="Pesquisar resíduo ou categoria"
                placeholderTextColor="#9CA3AF"
                style={{
                  flex: 1,
                  minHeight: 46,
                  marginLeft: 8,
                  color: "#111827",
                }}
              />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {filteredCatalogItems.length > 0 ? (
                filteredCatalogItems.map((item) => {
                  const alreadyAdded = materialsDraft.some(
                    (material) => material.wasteTypeId === item.id
                  );

                  return (
                    <TouchableOpacity
                      key={item.id}
                      disabled={alreadyAdded}
                      onPress={() => addCatalogMaterial(item)}
                      style={{
                        borderWidth: 1,
                        borderColor: alreadyAdded ? "#D1FAE5" : "#E5E7EB",
                        borderRadius: 13,
                        padding: 14,
                        marginBottom: 10,
                        backgroundColor: alreadyAdded ? "#F0FDF4" : "#FFFFFF",
                        opacity: alreadyAdded ? 0.7 : 1,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <View style={{ flex: 1, paddingRight: 10 }}>
                          <Text
                            style={{
                              fontWeight: "800",
                              color: "#111827",
                              fontSize: 15,
                            }}
                          >
                            {item.name}
                          </Text>
                          <Text
                            style={{
                              color: "#6B7280",
                              fontSize: 12,
                              marginTop: 3,
                            }}
                          >
                            {item.category || "Sem categoria"}
                            {item.subcategory ? ` • ${item.subcategory}` : ""}
                            {" • "}
                            {formatUnit(item.unit || item.defaultUnit || "KG")}
                          </Text>
                        </View>

                        <Ionicons
                          name={
                            alreadyAdded
                              ? "checkmark-circle"
                              : "add-circle-outline"
                          }
                          size={23}
                          color={alreadyAdded ? "#16A34A" : "#028C56"}
                        />
                      </View>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <EmptyState
                  icon="search-outline"
                  title="Nenhum resíduo encontrado"
                  subtitle="Tente pesquisar por outro nome ou categoria."
                />
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
      <View style={{ flexDirection: "row", alignItems: "center" }}>
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
          <Text
            style={{
              color: "#111827",
              fontSize: 24,
              fontWeight: "800",
              marginTop: 2,
            }}
          >
            {value}
          </Text>
        </View>
      </View>
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View
      style={{
        marginTop: 20,
        marginBottom: 12,
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: "800", color: "#111827" }}>
        {title}
      </Text>
    </View>
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
        backgroundColor: color,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
      }}
    >
      <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "800" }}>
        {label}
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
      <Text style={{ color: "#6B7280", fontSize: 12, marginBottom: 4 }}>
        {label}
      </Text>
      <Text style={{ color: "#111827", fontSize: 14, fontWeight: "700" }}>
        {value}
      </Text>
    </View>
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
        {loading ? (
          <ActivityIndicator size="small" color="#028C56" />
        ) : (
          <Ionicons name={icon} size={22} color="#028C56" />
        )}
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ color: "#111827", fontSize: 15, fontWeight: "800" }}>
          {title}
        </Text>
        <Text style={{ color: "#6B7280", fontSize: 13, marginTop: 2 }}>
          {subtitle}
        </Text>
      </View>
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
    <View style={{ alignItems: "center", paddingVertical: 16 }}>
      <Ionicons name={icon} size={42} color="#9CA3AF" />
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

const listItemCard = {
  borderWidth: 1,
  borderRadius: 16,
  padding: 14,
  marginBottom: 12,
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