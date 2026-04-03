import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import {
  routeService,
  type RouteItem,
  type RouteStatus,
} from "@/src/services/routeService";
import { driverService, type Driver } from "@/src/services/driverService";
import { vehicleService, type Vehicle } from "@/src/services/vehicleService";
import type { Collection } from "@/src/types/collection";

export default function RotaDetalheScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const routeId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [rota, setRota] = useState<RouteItem | null>(null);
  const [availableCollections, setAvailableCollections] = useState<Collection[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [mutatingCollectionId, setMutatingCollectionId] = useState<
    string | null
  >(null);

  // 1. NOVOS STATES
  const [editMode, setEditMode] = useState(false);

  const [editName, setEditName] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStopsInput, setEditStopsInput] = useState("");

  const [editDriverId, setEditDriverId] = useState("");
  const [editVehicleId, setEditVehicleId] = useState("");

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  const [savingEdit, setSavingEdit] = useState(false);

  // 5. FUNÇÕES AUXILIARES
  function isBrazilianDate(value: string) {
    return /^\d{2}\/\d{2}\/\d{4}$/.test(value.trim());
  }

  function normalizeStops(value: string) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function formatDate(date?: string | null) {
    if (!date) return "Não informada";

    try {
      const parsed = new Date(date);
      if (Number.isNaN(parsed.getTime())) return String(date);
      return parsed.toLocaleDateString("pt-BR");
    } catch {
      return String(date);
    }
  }

  function formatWeight(value?: number | null) {
    return `${Number(value ?? 0).toFixed(1)} kg`;
  }

  function getRouteStatusColor(status?: string) {
    switch (status) {
      case "SCHEDULED":
        return "#F59E0B";
      case "IN_PROGRESS":
        return "#10B981";
      case "COMPLETED":
        return "#6B7280";
      case "CANCELLED":
        return "#DC2626";
      default:
        return "#6B7280";
    }
  }

  function getRouteStatusLabel(status?: string) {
    switch (status) {
      case "SCHEDULED":
        return "AGENDADA";
      case "IN_PROGRESS":
        return "EM ANDAMENTO";
      case "COMPLETED":
        return "CONCLUÍDA";
      case "CANCELLED":
        return "CANCELADA";
      default:
        return "SEM STATUS";
    }
  }

  function getCollectionStatusColor(status?: string) {
    switch (status) {
      case "PENDING":
        return "#F59E0B";
      case "IN_PROGRESS":
        return "#10B981";
      case "COMPLETED":
        return "#2563EB";
      case "CANCELLED":
        return "#DC2626";
      default:
        return "#6B7280";
    }
  }

  function getCollectionStatusLabel(status?: string) {
    switch (status) {
      case "PENDING":
        return "PENDENTE";
      case "IN_PROGRESS":
        return "EM ANDAMENTO";
      case "COMPLETED":
        return "CONCLUÍDA";
      case "CANCELLED":
        return "CANCELADA";
      default:
        return "SEM STATUS";
    }
  }

  function getCollectionOriginName(item: Collection) {
    return (
      item.generator?.companyName ||
      item.generator?.name ||
      item.schedule?.generator?.companyName ||
      item.schedule?.generator?.name ||
      "Origem não identificada"
    );
  }

  function getCollectionAddress(item: Collection) {
    return (
      item.generator?.address ||
      item.schedule?.generator?.address ||
      "Endereço não informado"
    );
  }

  // 2. CARREGAR MOTORISTAS E VEÍCULOS
  const loadOptions = useCallback(async () => {
    try {
      const [driversData, vehiclesData] = await Promise.all([
        driverService.list(),
        vehicleService.list(),
      ]);

      setDrivers(driversData);
      setVehicles(vehiclesData);
    } catch (error) {
      console.error("Erro ao carregar opções da rota:", error);
    }
  }, []);

  const loadScreen = useCallback(async () => {
    if (!routeId) {
      setLoading(false);
      return;
    }

    try {
      const [routeData, available] = await Promise.all([
        routeService.getById(routeId),
        routeService.listAvailableCollections(),
      ]);

      setRota(routeData);
      setAvailableCollections(available);
      await loadOptions();
    } catch (error) {
      console.error("Erro ao carregar detalhes da rota:", error);
      Alert.alert("Erro", "Não foi possível carregar os dados da rota.", [
        {
          text: "OK",
          onPress: () => router.replace("/(cooperativa)/rotas"),
        },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [routeId, loadOptions]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadScreen();
    }, [loadScreen])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadScreen();
  }, [loadScreen]);

  async function updateStatus(newStatus: RouteStatus) {
    if (!routeId) return;

    try {
      setSavingStatus(true);
      const updated = await routeService.updateStatus(routeId, newStatus);
      setRota(updated);
      Alert.alert("Sucesso", "Status da rota atualizado com sucesso.");
    } catch (error) {
      console.error("Erro ao atualizar status da rota:", error);
      Alert.alert("Erro", "Não foi possível atualizar o status da rota.");
    } finally {
      setSavingStatus(false);
    }
  }

  async function addCollection(collectionId: string) {
    if (!routeId) return;

    try {
      setMutatingCollectionId(collectionId);
      await routeService.addCollectionToRoute(routeId, collectionId);
      await loadScreen();
      Alert.alert("Sucesso", "Coleta adicionada à rota com sucesso.");
    } catch (error) {
      console.error("Erro ao adicionar coleta na rota:", error);
      Alert.alert("Erro", "Não foi possível adicionar a coleta na rota.");
    } finally {
      setMutatingCollectionId(null);
    }
  }

  async function removeCollection(collectionId: string) {
    if (!routeId) return;

    Alert.alert("Remover coleta", "Deseja remover esta coleta da rota?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: async () => {
          try {
            setMutatingCollectionId(collectionId);
            await routeService.removeCollectionFromRoute(routeId, collectionId);
            await loadScreen();
            Alert.alert("Sucesso", "Coleta removida da rota com sucesso.");
          } catch (error) {
            console.error("Erro ao remover coleta da rota:", error);
            Alert.alert("Erro", "Não foi possível remover a coleta da rota.");
          } finally {
            setMutatingCollectionId(null);
          }
        },
      },
    ]);
  }

  // 3. PREENCHER FORMULÁRIO AO ENTRAR NO MODO EDIT
  function startEdit() {
    if (!rota) return;

    setEditName(rota.name);
    setEditDate(formatDate(rota.scheduledDate));
    setEditDescription(rota.description || "");
    setEditStopsInput((rota.stops || []).join(", "));
    setEditDriverId(rota.driver?.id || "");
    setEditVehicleId(rota.vehicle?.id || "");

    setEditMode(true);
  }

  // 4. CANCELAR EDIÇÃO
  function cancelEdit() {
    setEditMode(false);
  }

  // 6. SALVAR EDIÇÃO
  async function handleSaveEdit() {
    if (!routeId) return;

    if (!editName.trim()) {
      Alert.alert("Atenção", "Informe o nome da rota.");
      return;
    }

    if (!editDate.trim()) {
      Alert.alert("Atenção", "Informe a data da rota.");
      return;
    }

    if (!isBrazilianDate(editDate)) {
      Alert.alert("Data inválida", "Use o formato DD/MM/AAAA.");
      return;
    }

    const normalizedStops = normalizeStops(editStopsInput);

    if (normalizedStops.length === 0) {
      Alert.alert("Atenção", "Informe pelo menos uma parada da rota.");
      return;
    }

    try {
      setSavingEdit(true);

      const updated = await routeService.update(routeId, {
        name: editName.trim(),
        scheduledDate: editDate.trim(),
        description: editDescription.trim() || undefined,
        driverId: editDriverId || undefined,
        vehicleId: editVehicleId || undefined,
        stops: normalizedStops,
      });

      setRota(updated);
      setEditMode(false);

      Alert.alert("Sucesso", "Rota atualizada com sucesso.");
    } catch (error) {
      console.error("Erro ao editar rota:", error);
      Alert.alert("Erro", "Não foi possível atualizar a rota.");
    } finally {
      setSavingEdit(false);
    }
  }

  const stats = useMemo(
    () => ({
      totalCollections: rota?.stats?.totalCollections ?? 0,
      pendingCollections: rota?.stats?.pendingCollections ?? 0,
      inProgressCollections: rota?.stats?.inProgressCollections ?? 0,
      completedCollections: rota?.stats?.completedCollections ?? 0,
      cancelledCollections: rota?.stats?.cancelledCollections ?? 0,
    }),
    [rota]
  );

  const currentCollections = useMemo(
    () => (Array.isArray(rota?.collections) ? rota?.collections : []),
    [rota]
  );

  const activeCollections = useMemo(
    () => (Array.isArray(rota?.activeCollections) ? rota?.activeCollections : []),
    [rota]
  );

  const availableDrivers = useMemo(
    () => drivers.filter((item) => item.status !== "INACTIVE"),
    [drivers]
  );

  const availableVehicles = useMemo(
    () => vehicles.filter((item) => item.status !== "INACTIVE"),
    [vehicles]
  );

  const previewStops = useMemo(() => normalizeStops(editStopsInput), [editStopsInput]);

  const statusOptions: { label: string; value: RouteStatus; color: string }[] = [
    { label: "Agendada", value: "SCHEDULED", color: "#F59E0B" },
    { label: "Em andamento", value: "IN_PROGRESS", color: "#10B981" },
    { label: "Concluída", value: "COMPLETED", color: "#6B7280" },
    { label: "Cancelada", value: "CANCELLED", color: "#DC2626" },
  ];

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#FFFFFF",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color="#028C56" />
        <Text style={{ marginTop: 12, color: "#6B7280" }}>
          Carregando detalhes da rota...
        </Text>
      </View>
    );
  }

  if (!rota) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#FFFFFF",
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 24,
        }}
      >
        <Ionicons name="alert-circle-outline" size={54} color="#9CA3AF" />
        <Text
          style={{
            marginTop: 12,
            color: "#374151",
            fontSize: 16,
            fontWeight: "700",
          }}
        >
          Rota não encontrada
        </Text>
        <TouchableOpacity
          onPress={() => router.replace("/(cooperativa)/rotas")}
          style={{
            marginTop: 18,
            backgroundColor: "#028C56",
            paddingHorizontal: 18,
            paddingVertical: 12,
            borderRadius: 14,
          }}
        >
          <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>
            Voltar para rotas
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F3F4F6" }}>
      <LinearGradient
        colors={["#10F35D", "#028C56"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          paddingTop: 52,
          paddingBottom: 24,
          paddingHorizontal: 20,
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
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
              fontSize: 18,
              fontWeight: "800",
            }}
          >
            DETALHE DA ROTA
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            {/* 7. BOTÃO EDITAR */}
            <TouchableOpacity onPress={startEdit}>
              <Ionicons name="create-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity onPress={onRefresh}>
              <Ionicons name="refresh-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 24,
            fontWeight: "800",
            marginTop: 16,
          }}
        >
          {rota.name}
        </Text>

        <Text
          style={{
            color: "#FFFFFF",
            opacity: 0.92,
            marginTop: 6,
            fontSize: 14,
          }}
        >
          {rota.description?.trim() || "Rota operacional da cooperativa"}
        </Text>

        <View
          style={{
            marginTop: 14,
            alignSelf: "flex-start",
            backgroundColor: getRouteStatusColor(rota.status),
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
          }}
        >
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 11,
              fontWeight: "800",
              letterSpacing: 0.3,
            }}
          >
            {getRouteStatusLabel(rota.status)}
          </Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 18,
            padding: 16,
            borderWidth: 1,
            borderColor: "#E5E7EB",
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "800",
              color: "#111827",
              marginBottom: 14,
            }}
          >
            Resumo operacional
          </Text>

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "space-between",
              rowGap: 12,
            }}
          >
            <MetricCard
              label="Total"
              value={String(stats.totalCollections)}
              color="#111827"
            />
            <MetricCard
              label="Pendentes"
              value={String(stats.pendingCollections)}
              color="#F59E0B"
            />
            <MetricCard
              label="Em andamento"
              value={String(stats.inProgressCollections)}
              color="#10B981"
            />
            <MetricCard
              label="Concluídas"
              value={String(stats.completedCollections)}
              color="#2563EB"
            />
            <MetricCard
              label="Canceladas"
              value={String(stats.cancelledCollections)}
              color="#DC2626"
            />
            <MetricCard
              label="Paradas"
              value={String(rota.stops?.length || 0)}
              color="#7C3AED"
            />
          </View>
        </View>

        {/* 8. BLOCO DE EDIÇÃO (SUBSTITUI O BLOCO DE DADOS) */}
        {editMode ? (
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 18,
              padding: 16,
              borderWidth: 1,
              borderColor: "#E5E7EB",
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "800",
                color: "#111827",
                marginBottom: 14,
              }}
            >
              Editar rota
            </Text>

            <FieldLabel label="Nome da rota" />
            <TextInput
              value={editName}
              onChangeText={setEditName}
              placeholder="Nome da rota"
              placeholderTextColor="#9CA3AF"
              style={inputStyle}
            />

            <FieldLabel label="Data programada" />
            <TextInput
              value={editDate}
              onChangeText={setEditDate}
              placeholder="DD/MM/AAAA"
              placeholderTextColor="#9CA3AF"
              keyboardType="numbers-and-punctuation"
              style={inputStyle}
            />

            <FieldLabel label="Descrição" />
            <TextInput
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder="Descrição da rota"
              placeholderTextColor="#9CA3AF"
              multiline
              style={textareaStyle}
            />

            <FieldLabel label="Paradas da rota" />
            <TextInput
              value={editStopsInput}
              onChangeText={setEditStopsInput}
              placeholder="Separe por vírgula"
              placeholderTextColor="#9CA3AF"
              multiline
              style={textareaStyle}
            />

            <View
              style={{
                marginTop: 12,
                backgroundColor: "#F9FAFB",
                borderRadius: 14,
                padding: 12,
                borderWidth: 1,
                borderColor: "#E5E7EB",
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: "#374151",
                  marginBottom: 10,
                }}
              >
                Prévia das paradas ({previewStops.length})
              </Text>

              {previewStops.length > 0 ? (
                previewStops.map((stop, index) => (
                  <View
                    key={`${stop}-${index}`}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: "#DCFCE7",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 10,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "800",
                          color: "#166534",
                        }}
                      >
                        {index + 1}
                      </Text>
                    </View>
                    <Text style={{ color: "#374151", flex: 1 }}>{stop}</Text>
                  </View>
                ))
              ) : (
                <Text style={{ color: "#6B7280" }}>
                  Nenhuma parada informada.
                </Text>
              )}
            </View>

            <FieldLabel label="Motorista" />
            {availableDrivers.length === 0 ? (
              <EmptyInline text="Nenhum motorista disponível." />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 16 }}
                contentContainerStyle={{ paddingRight: 8 }}
              >
                {availableDrivers.map((item) => {
                  const selected = editDriverId === item.id;

                  return (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => setEditDriverId(item.id)}
                      style={chipStyle(selected)}
                    >
                      <Text style={chipTextStyle(selected)}>
                        {item.name}
                        {item.cnhCategory ? ` • ${item.cnhCategory}` : ""}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <FieldLabel label="Veículo" />
            {availableVehicles.length === 0 ? (
              <EmptyInline text="Nenhum veículo disponível." />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 18 }}
                contentContainerStyle={{ paddingRight: 8 }}
              >
                {availableVehicles.map((item) => {
                  const selected = editVehicleId === item.id;

                  return (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => setEditVehicleId(item.id)}
                      style={chipStyle(selected)}
                    >
                      <Text style={chipTextStyle(selected)}>
                        {item.model} • {item.plate}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={cancelEdit}
                style={{
                  flex: 1,
                  backgroundColor: "#F3F4F6",
                  borderRadius: 14,
                  paddingVertical: 13,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                }}
              >
                <Text
                  style={{
                    color: "#374151",
                    fontWeight: "700",
                  }}
                >
                  Cancelar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSaveEdit}
                disabled={savingEdit}
                style={{
                  flex: 1,
                  backgroundColor: "#028C56",
                  borderRadius: 14,
                  paddingVertical: 13,
                  alignItems: "center",
                  opacity: savingEdit ? 0.7 : 1,
                }}
              >
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontWeight: "700",
                  }}
                >
                  {savingEdit ? "Salvando..." : "Salvar alterações"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 18,
              padding: 16,
              borderWidth: 1,
              borderColor: "#E5E7EB",
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "800",
                color: "#111827",
                marginBottom: 14,
              }}
            >
              Dados da rota
            </Text>

            <InfoRow label="Data programada" value={formatDate(rota.scheduledDate)} />
            <InfoRow label="Motorista" value={rota.driver?.name || "Não informado"} />
            <InfoRow
              label="Veículo"
              value={
                rota.vehicle?.model
                  ? `${rota.vehicle.model}${
                      rota.vehicle.plate ? ` - ${rota.vehicle.plate}` : ""
                    }`
                  : "Não informado"
              }
            />
            <InfoRow
              label="Coletas ativas"
              value={String(activeCollections.length)}
            />

            <Text
              style={{
                marginTop: 14,
                marginBottom: 8,
                fontSize: 14,
                fontWeight: "700",
                color: "#111827",
              }}
            >
              Paradas planejadas
            </Text>

            {rota.stops.length > 0 ? (
              rota.stops.map((stop, index) => (
                <View
                  key={`${stop}-${index}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: "#DCFCE7",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 10,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "800",
                        color: "#166534",
                      }}
                    >
                      {index + 1}
                    </Text>
                  </View>
                  <Text style={{ color: "#374151", flex: 1 }}>{stop}</Text>
                </View>
              ))
            ) : (
              <Text style={{ color: "#6B7280" }}>Nenhuma parada definida.</Text>
            )}
          </View>
        )}

        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 18,
            padding: 16,
            borderWidth: 1,
            borderColor: "#E5E7EB",
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "800",
              color: "#111827",
              marginBottom: 14,
            }}
          >
            Ações rápidas
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {statusOptions.map((option) => {
              const isCurrent = rota.status === option.value;

              return (
                <TouchableOpacity
                  key={option.value}
                  disabled={savingStatus}
                  onPress={() => updateStatus(option.value)}
                  style={{
                    backgroundColor: isCurrent ? option.color : "#F3F4F6",
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: isCurrent ? option.color : "#E5E7EB",
                  }}
                >
                  <Text
                    style={{
                      color: isCurrent ? "#FFFFFF" : "#374151",
                      fontWeight: "700",
                      fontSize: 12,
                    }}
                  >
                    {savingStatus && isCurrent ? "Salvando..." : option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <SectionTitle
          title={`Coletas na rota (${currentCollections.length})`}
          subtitle="Itens que já estão vinculados a esta operação."
        />

        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 18,
            padding: 16,
            borderWidth: 1,
            borderColor: "#E5E7EB",
            marginBottom: 18,
          }}
        >
          {currentCollections.length > 0 ? (
            currentCollections.map((item) => {
              const isMutating = mutatingCollectionId === item.id;

              return (
                <View
                  key={item.id}
                  style={{
                    backgroundColor: "#F9FAFB",
                    borderRadius: 16,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: "#E5E7EB",
                    marginBottom: 12,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: "800",
                          color: "#111827",
                        }}
                      >
                        {getCollectionOriginName(item)}
                      </Text>

                      <Text
                        style={{
                          color: "#6B7280",
                          marginTop: 4,
                          fontSize: 13,
                        }}
                      >
                        {getCollectionAddress(item)}
                      </Text>

                      <Text
                        style={{
                          color: "#6B7280",
                          marginTop: 6,
                          fontSize: 13,
                        }}
                      >
                        Peso: {formatWeight(item.totalWeightKg)}
                      </Text>

                      <Text
                        style={{
                          color: "#6B7280",
                          marginTop: 2,
                          fontSize: 13,
                        }}
                      >
                        Catador: {item.collector?.name || "Não informado"}
                      </Text>

                      <Text
                        style={{
                          color: "#6B7280",
                          marginTop: 2,
                          fontSize: 13,
                        }}
                      >
                        Data:{" "}
                        {formatDate(
                          item.schedule?.scheduledDate ||
                            item.schedule?.preferredDate ||
                            item.collectedAt
                        )}
                      </Text>
                    </View>

                    <View
                      style={{
                        backgroundColor: getCollectionStatusColor(item.status),
                        paddingHorizontal: 8,
                        paddingVertical: 5,
                        borderRadius: 999,
                      }}
                    >
                      <Text
                        style={{
                          color: "#FFFFFF",
                          fontSize: 10,
                          fontWeight: "800",
                        }}
                      >
                        {getCollectionStatusLabel(item.status)}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    disabled={isMutating}
                    onPress={() => removeCollection(item.id)}
                    style={{
                      marginTop: 12,
                      alignSelf: "flex-start",
                      backgroundColor: "#FEE2E2",
                      paddingHorizontal: 12,
                      paddingVertical: 9,
                      borderRadius: 12,
                    }}
                  >
                    <Text
                      style={{
                        color: "#B91C1C",
                        fontWeight: "700",
                        fontSize: 12,
                      }}
                    >
                      {isMutating ? "Removendo..." : "Remover da rota"}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })
          ) : (
            <EmptyBlock
              icon="cube-outline"
              title="Nenhuma coleta vinculada"
              subtitle="Adicione coletas disponíveis para montar a operação da rota."
            />
          )}
        </View>

        <SectionTitle
          title={`Coletas disponíveis (${availableCollections.length})`}
          subtitle="Coletas prontas para entrar nesta rota."
        />

        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 18,
            padding: 16,
            borderWidth: 1,
            borderColor: "#E5E7EB",
          }}
        >
          {availableCollections.length > 0 ? (
            availableCollections.map((item) => {
              const isMutating = mutatingCollectionId === item.id;

              return (
                <View
                  key={item.id}
                  style={{
                    backgroundColor: "#F9FAFB",
                    borderRadius: 16,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: "#E5E7EB",
                    marginBottom: 12,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "800",
                      color: "#111827",
                    }}
                  >
                    {getCollectionOriginName(item)}
                  </Text>

                  <Text
                    style={{
                      color: "#6B7280",
                      marginTop: 4,
                      fontSize: 13,
                    }}
                  >
                    {getCollectionAddress(item)}
                  </Text>

                  <Text
                    style={{
                      color: "#6B7280",
                      marginTop: 6,
                      fontSize: 13,
                    }}
                  >
                    Peso: {formatWeight(item.totalWeightKg)}
                  </Text>

                  <Text
                    style={{
                      color: "#6B7280",
                      marginTop: 2,
                      fontSize: 13,
                    }}
                  >
                    Catador: {item.collector?.name || "Não informado"}
                  </Text>

                  <Text
                    style={{
                      color: "#6B7280",
                      marginTop: 2,
                      fontSize: 13,
                    }}
                  >
                    Data:{" "}
                    {formatDate(
                      item.schedule?.scheduledDate ||
                        item.schedule?.preferredDate ||
                        item.collectedAt
                    )}
                  </Text>

                  <TouchableOpacity
                    disabled={isMutating}
                    onPress={() => addCollection(item.id)}
                    style={{
                      marginTop: 12,
                      alignSelf: "flex-start",
                      backgroundColor: "#DCFCE7",
                      paddingHorizontal: 12,
                      paddingVertical: 9,
                      borderRadius: 12,
                    }}
                  >
                    <Text
                      style={{
                        color: "#166534",
                        fontWeight: "700",
                        fontSize: 12,
                      }}
                    >
                      {isMutating ? "Adicionando..." : "Adicionar à rota"}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })
          ) : (
            <EmptyBlock
              icon="checkmark-done-outline"
              title="Nenhuma coleta disponível"
              subtitle="Todas as coletas operacionais já estão vinculadas ou não há itens elegíveis no momento."
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View
      style={{
        width: "31%",
        minWidth: 96,
        backgroundColor: "#F9FAFB",
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: "#E5E7EB",
      }}
    >
      <Text
        style={{
          fontSize: 12,
          color: "#6B7280",
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          marginTop: 6,
          fontSize: 20,
          fontWeight: "800",
          color,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text
        style={{
          fontSize: 12,
          color: "#6B7280",
          marginBottom: 2,
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: "#111827",
          fontWeight: "700",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text
        style={{
          fontSize: 18,
          fontWeight: "800",
          color: "#111827",
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          marginTop: 4,
          fontSize: 13,
          color: "#6B7280",
        }}
      >
        {subtitle}
      </Text>
    </View>
  );
}

function EmptyBlock({
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
        paddingHorizontal: 12,
      }}
    >
      <Ionicons name={icon} size={40} color="#9CA3AF" />
      <Text
        style={{
          marginTop: 10,
          fontSize: 15,
          fontWeight: "700",
          color: "#374151",
          textAlign: "center",
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          marginTop: 6,
          fontSize: 13,
          color: "#6B7280",
          textAlign: "center",
          lineHeight: 19,
        }}
      >
        {subtitle}
      </Text>
    </View>
  );
}

function FieldLabel({ label }: { label: string }) {
  return (
    <Text
      style={{
        fontSize: 14,
        color: "#028C56",
        marginBottom: 8,
        fontWeight: "700",
      }}
    >
      {label}
    </Text>
  );
}

function EmptyInline({ text }: { text: string }) {
  return (
    <View
      style={{
        backgroundColor: "#F9FAFB",
        borderWidth: 1,
        borderColor: "#E5E7EB",
        borderRadius: 12,
        padding: 12,
        marginBottom: 14,
      }}
    >
      <Text style={{ color: "#6B7280" }}>{text}</Text>
    </View>
  );
}

const inputStyle = {
  borderWidth: 1,
  borderColor: "#D1D5DB",
  borderRadius: 12,
  padding: 14,
  fontSize: 16,
  color: "#111827",
  backgroundColor: "#FFFFFF",
  marginBottom: 16,
} as const;

const textareaStyle = {
  borderWidth: 1,
  borderColor: "#D1D5DB",
  borderRadius: 12,
  padding: 14,
  fontSize: 16,
  color: "#111827",
  backgroundColor: "#FFFFFF",
  minHeight: 100,
  textAlignVertical: "top" as const,
  marginBottom: 16,
} as const;

function chipStyle(selected: boolean) {
  return {
    backgroundColor: selected ? "#028C56" : "#F3F4F6",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    marginRight: 10,
    borderWidth: 1,
    borderColor: selected ? "#028C56" : "#E5E7EB",
  } as const;
}

function chipTextStyle(selected: boolean) {
  return {
    color: selected ? "#FFFFFF" : "#374151",
    fontWeight: "700" as const,
    fontSize: 13,
  };
}