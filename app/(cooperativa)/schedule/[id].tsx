import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { api } from "@/src/services/api";
import {
  scheduleService,
  type Schedule,
  type ScheduleStatus,
} from "@/src/services/scheduleService";
import { collectionService } from "@/src/services/collectionService";
import { driverService, type Driver } from "@/src/services/driverService";
import { vehicleService, type Vehicle } from "@/src/services/vehicleService";
import { routeService, type RouteItem } from "@/src/services/routeService";

type CollectorOption = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

type CollectorListResponse =
  | CollectorOption[]
  | {
      collectors?: CollectorOption[];
    };

function formatDate(value?: string | null) {
  if (!value) return "Sem data";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem data";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusLabel(status?: string) {
  switch (status) {
    case "REQUESTED":
      return "SOLICITADO";
    case "SCHEDULED":
      return "AGENDADO";
    case "IN_PROGRESS":
      return "EM ANDAMENTO";
    case "COMPLETED":
      return "CONCLUÍDO";
    case "CANCELLED":
      return "CANCELADO";
    default:
      return "SEM STATUS";
  }
}

function getStatusColor(status?: string) {
  switch (status) {
    case "REQUESTED":
      return "#F59E0B";
    case "SCHEDULED":
      return "#2563EB";
    case "IN_PROGRESS":
      return "#8B5CF6";
    case "COMPLETED":
      return "#028C56";
    case "CANCELLED":
      return "#DC2626";
    default:
      return "#6B7280";
  }
}

function extractRequestedMaterials(notes?: string | null) {
  if (!notes) return [];

  const match = notes.match(/Materiais solicitados:\s*([^|]+)/i);
  if (!match) return [];

  return match[1]
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractExtraNotes(notes?: string | null) {
  if (!notes) return "-";

  const parts = notes
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);

  if (parts.length <= 1) return notes;

  return parts.slice(1).join(" | ") || "-";
}

function getScheduleOrigin(item: Schedule) {
  if (item.generatorId) return "GERADOR";
  if (item.requestedByUserId) return "PESSOA FÍSICA";
  return "SOLICITAÇÃO";
}

function getScheduleName(item: Schedule) {
  if (item.generator?.companyName) return item.generator.companyName;
  if (item.generator?.name) return item.generator.name;
  if (item.requestedBy?.displayName) return item.requestedBy.displayName;
  if (item.requestedBy?.email) return item.requestedBy.email;
  return "Solicitação sem identificação";
}

async function fetchCollectors(): Promise<CollectorOption[]> {
  const response = await api.get<CollectorListResponse>("/collectors", true);
  return Array.isArray(response) ? response : response.collectors ?? [];
}

export default function CooperativeScheduleDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const scheduleId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [delegating, setDelegating] = useState(false);

  const [schedule, setSchedule] = useState<Schedule | null>(null);

  const [collectors, setCollectors] = useState<CollectorOption[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<RouteItem[]>([]);

  const [selectedCollectorId, setSelectedCollectorId] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [selectedRouteId, setSelectedRouteId] = useState("");

  const loadSchedule = useCallback(
    async (showLoader = true) => {
      if (!scheduleId) {
        setSchedule(null);
        setLoading(false);
        return;
      }

      try {
        if (showLoader) setLoading(true);

        const [schedules, collectorList, driverList, vehicleList, routeList] =
          await Promise.all([
            scheduleService.list(),
            fetchCollectors(),
            driverService.list(),
            vehicleService.list(),
            routeService.list(),
          ]);

        const found = schedules.find((item) => item.id === scheduleId) || null;

        setSchedule(found);
        setCollectors(collectorList);
        setDrivers(driverList);
        setVehicles(vehicleList);
        setRoutes(routeList);

        if (collectorList.length > 0) {
          setSelectedCollectorId((current) => current || collectorList[0].id);
        }

        if (driverList.length > 0) {
          setSelectedDriverId((current) => current || driverList[0].id);
        }

        if (vehicleList.length > 0) {
          setSelectedVehicleId((current) => current || vehicleList[0].id);
        }

        if (routeList.length > 0) {
          setSelectedRouteId((current) => current || routeList[0].id);
        }
      } catch (error: any) {
        Alert.alert(
          "Erro",
          error?.message || "Não foi possível carregar os detalhes do agendamento."
        );
        setSchedule(null);
        setCollectors([]);
        setDrivers([]);
        setVehicles([]);
        setRoutes([]);
      } finally {
        if (showLoader) setLoading(false);
        setRefreshing(false);
      }
    },
    [scheduleId]
  );

  useFocusEffect(
    useCallback(() => {
      loadSchedule(true);
    }, [loadSchedule])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSchedule(false);
  }, [loadSchedule]);

  const materials = useMemo(() => {
    return extractRequestedMaterials(schedule?.notes);
  }, [schedule?.notes]);

  const availableRoutes = useMemo(() => {
    if (!selectedDriverId && !selectedVehicleId) return routes;

    return routes.filter((route) => {
      const driverMatches =
        !selectedDriverId || !route.driverId || route.driverId === selectedDriverId;

      const vehicleMatches =
        !selectedVehicleId || !route.vehicleId || route.vehicleId === selectedVehicleId;

      return driverMatches && vehicleMatches;
    });
  }, [routes, selectedDriverId, selectedVehicleId]);

  async function handleUpdateStatus(status: ScheduleStatus) {
    if (!schedule?.id) return;

    try {
      setUpdating(true);
      const updated = await scheduleService.updateStatus(schedule.id, { status });
      setSchedule(updated);

      Alert.alert("Sucesso", "Status do agendamento atualizado.");
    } catch (error: any) {
      Alert.alert(
        "Erro",
        error?.message || "Não foi possível atualizar o status."
      );
    } finally {
      setUpdating(false);
    }
  }

  async function handleDelegate() {
    if (!schedule?.id) return;

    if (!selectedCollectorId) {
      Alert.alert("Atenção", "Selecione um catador para delegar a coleta.");
      return;
    }

    if (!selectedDriverId) {
      Alert.alert("Atenção", "Selecione um motorista.");
      return;
    }

    if (!selectedVehicleId) {
      Alert.alert("Atenção", "Selecione um veículo.");
      return;
    }

    if (!selectedRouteId) {
      Alert.alert("Atenção", "Selecione uma rota.");
      return;
    }

    try {
      setDelegating(true);

      await collectionService.create({
        scheduleId: schedule.id,
        collectorId: selectedCollectorId,
        driverId: selectedDriverId,
        vehicleId: selectedVehicleId,
        routeId: selectedRouteId,
      });

      const refreshed = await scheduleService.list();
      const found = refreshed.find((item) => item.id === schedule.id) || null;
      setSchedule(found);

      Alert.alert("Sucesso", "Coleta delegada com logística completa.");
    } catch (error: any) {
      Alert.alert(
        "Erro",
        error?.message || "Não foi possível delegar a coleta."
      );
    } finally {
      setDelegating(false);
    }
  }

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#FFFFFF",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color="#028C56" />
        <Text style={{ marginTop: 12, color: "#6B7280" }}>
          Carregando agendamento...
        </Text>
      </View>
    );
  }

  if (!schedule) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#FFFFFF",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 24,
        }}
      >
        <Ionicons name="alert-circle-outline" size={48} color="#9CA3AF" />
        <Text
          style={{
            fontSize: 18,
            fontWeight: "700",
            color: "#111827",
            marginTop: 12,
            textAlign: "center",
          }}
        >
          Agendamento não encontrado
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            marginTop: 16,
            backgroundColor: "#028C56",
            paddingHorizontal: 18,
            paddingVertical: 12,
            borderRadius: 12,
          }}
        >
          <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Voltar</Text>
        </TouchableOpacity>
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
        colors={["#10F35D", "#028C56"]}
        style={{
          paddingTop: 50,
          paddingBottom: 24,
          paddingHorizontal: 20,
          borderBottomLeftRadius: 30,
          borderBottomRightRadius: 30,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 14 }}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={{ fontSize: 20, fontWeight: "700", color: "#FFFFFF" }}>
            DETALHE DO AGENDAMENTO
          </Text>
        </View>

        <View style={{ marginTop: 18 }}>
          <Text style={{ color: "#FFFFFF", fontSize: 14, opacity: 0.9 }}>
            Origem
          </Text>
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 26,
              fontWeight: "800",
              marginTop: 4,
            }}
          >
            {getScheduleOrigin(schedule)}
          </Text>
        </View>

        <View
          style={{
            marginTop: 16,
            alignSelf: "flex-start",
            backgroundColor: getStatusColor(schedule.status),
            borderRadius: 999,
            paddingHorizontal: 14,
            paddingVertical: 8,
          }}
        >
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 12 }}>
            {getStatusLabel(schedule.status)}
          </Text>
        </View>
      </LinearGradient>

      <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
        <SectionCard>
          <Text style={sectionTitle}>Dados principais</Text>

          <InfoRow label="Solicitante" value={getScheduleName(schedule)} />
          <InfoRow
            label="Endereço"
            value={schedule.generator?.address || "Não informado"}
          />
          <InfoRow
            label="Data preferida"
            value={formatDate(schedule.preferredDate)}
          />
          <InfoRow
            label="Data agendada"
            value={formatDate(schedule.scheduledDate)}
          />
          <InfoRow
            label="Criado em"
            value={formatDate(schedule.createdAt)}
            isLast
          />
        </SectionCard>

        <SectionCard>
          <Text style={sectionTitle}>Materiais solicitados</Text>

          {materials.length > 0 ? (
            materials.map((material, index) => (
              <View
                key={`${material}-${index}`}
                style={{
                  backgroundColor: "#ECFDF5",
                  borderRadius: 999,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  marginBottom: 8,
                  alignSelf: "flex-start",
                }}
              >
                <Text style={{ color: "#028C56", fontWeight: "700" }}>
                  {material}
                </Text>
              </View>
            ))
          ) : (
            <Text style={{ color: "#6B7280" }}>Nenhum material informado.</Text>
          )}
        </SectionCard>

        <SectionCard>
          <Text style={sectionTitle}>Observações adicionais</Text>
          <Text style={{ color: "#374151", lineHeight: 22 }}>
            {extractExtraNotes(schedule.notes)}
          </Text>
        </SectionCard>

        {(schedule.status === "REQUESTED" || schedule.status === "SCHEDULED") && (
          <>
            <SectionCard>
              <Text style={sectionTitle}>Delegação para catador</Text>

              {collectors.length > 0 ? (
                collectors.map((collector) => {
                  const selected = selectedCollectorId === collector.id;

                  return (
                    <TouchableOpacity
                      key={collector.id}
                      activeOpacity={0.85}
                      onPress={() => setSelectedCollectorId(collector.id)}
                      style={{
                        backgroundColor: selected ? "#F0FDF4" : "#FFFFFF",
                        borderRadius: 14,
                        padding: 14,
                        borderWidth: 1,
                        borderColor: selected ? "#028C56" : "#D1D5DB",
                        marginBottom: 10,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: "700",
                          color: "#111827",
                        }}
                      >
                        {collector.name || "Catador"}
                      </Text>

                      <Text style={{ fontSize: 13, color: "#4B5563", marginTop: 4 }}>
                        E-mail: {collector.email || "-"}
                      </Text>

                      <Text style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>
                        Telefone: {collector.phone || "-"}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Text style={{ color: "#6B7280" }}>
                  Nenhum catador disponível para esta cooperativa.
                </Text>
              )}
            </SectionCard>

            <SectionCard>
              <Text style={sectionTitle}>Motorista da operação</Text>

              {drivers.length > 0 ? (
                drivers.map((driver) => {
                  const selected = selectedDriverId === driver.id;

                  return (
                    <TouchableOpacity
                      key={driver.id}
                      activeOpacity={0.85}
                      onPress={() => setSelectedDriverId(driver.id)}
                      style={{
                        backgroundColor: selected ? "#EFF6FF" : "#FFFFFF",
                        borderRadius: 14,
                        padding: 14,
                        borderWidth: 1,
                        borderColor: selected ? "#2563EB" : "#D1D5DB",
                        marginBottom: 10,
                      }}
                    >
                      <Text style={{ fontSize: 15, fontWeight: "700", color: "#111827" }}>
                        {driver.name}
                      </Text>
                      <Text style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>
                        CNH: {driver.cnh || "-"}
                        {driver.cnhCategory ? ` • Categoria ${driver.cnhCategory}` : ""}
                      </Text>
                      <Text style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>
                        Telefone: {driver.phone || "-"}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Text style={{ color: "#6B7280" }}>
                  Nenhum motorista disponível para esta cooperativa.
                </Text>
              )}
            </SectionCard>

            <SectionCard>
              <Text style={sectionTitle}>Veículo da operação</Text>

              {vehicles.length > 0 ? (
                vehicles.map((vehicle) => {
                  const selected = selectedVehicleId === vehicle.id;

                  return (
                    <TouchableOpacity
                      key={vehicle.id}
                      activeOpacity={0.85}
                      onPress={() => setSelectedVehicleId(vehicle.id)}
                      style={{
                        backgroundColor: selected ? "#FFF7ED" : "#FFFFFF",
                        borderRadius: 14,
                        padding: 14,
                        borderWidth: 1,
                        borderColor: selected ? "#EA580C" : "#D1D5DB",
                        marginBottom: 10,
                      }}
                    >
                      <Text style={{ fontSize: 15, fontWeight: "700", color: "#111827" }}>
                        {vehicle.model} - {vehicle.plate}
                      </Text>
                      <Text style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>
                        Marca: {vehicle.brand || "-"}
                      </Text>
                      <Text style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>
                        Capacidade: {vehicle.capacityKg ?? 0} kg
                      </Text>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Text style={{ color: "#6B7280" }}>
                  Nenhum veículo disponível para esta cooperativa.
                </Text>
              )}
            </SectionCard>

            <SectionCard>
              <Text style={sectionTitle}>Rota da operação</Text>

              {availableRoutes.length > 0 ? (
                availableRoutes.map((route) => {
                  const selected = selectedRouteId === route.id;

                  return (
                    <TouchableOpacity
                      key={route.id}
                      activeOpacity={0.85}
                      onPress={() => setSelectedRouteId(route.id)}
                      style={{
                        backgroundColor: selected ? "#F5F3FF" : "#FFFFFF",
                        borderRadius: 14,
                        padding: 14,
                        borderWidth: 1,
                        borderColor: selected ? "#7C3AED" : "#D1D5DB",
                        marginBottom: 10,
                      }}
                    >
                      <Text style={{ fontSize: 15, fontWeight: "700", color: "#111827" }}>
                        {route.name}
                      </Text>
                      <Text style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>
                        Data: {formatDate(route.scheduledDate)}
                      </Text>
                      <Text style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>
                        Pontos: {route.stops?.length || 0}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Text style={{ color: "#6B7280" }}>
                  Nenhuma rota compatível disponível.
                </Text>
              )}

              {collectors.length > 0 &&
                drivers.length > 0 &&
                vehicles.length > 0 &&
                availableRoutes.length > 0 && (
                  <ActionButton
                    label="Delegar operação completa"
                    color="#028C56"
                    onPress={handleDelegate}
                    loading={delegating}
                  />
                )}
            </SectionCard>
          </>
        )}

        <SectionCard>
          <Text style={sectionTitle}>Ações operacionais</Text>

          {schedule.status === "REQUESTED" && (
            <ActionButton
              label="Marcar como agendado"
              color="#2563EB"
              onPress={() => handleUpdateStatus("SCHEDULED")}
              loading={updating}
            />
          )}

          {schedule.status !== "COMPLETED" &&
            schedule.status !== "CANCELLED" && (
              <ActionButton
                label="Cancelar agendamento"
                color="#DC2626"
                onPress={() => handleUpdateStatus("CANCELLED")}
                loading={updating}
              />
            )}
        </SectionCard>
      </View>
    </ScrollView>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        marginBottom: 14,
      }}
    >
      {children}
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

function ActionButton({
  label,
  color,
  onPress,
  loading = false,
}: {
  label: string;
  color: string;
  onPress: () => void;
  loading?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={loading}
      style={{
        backgroundColor: color,
        minHeight: 52,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 10,
        opacity: loading ? 0.7 : 1,
      }}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 15 }}>
          {label.toUpperCase()}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const sectionTitle = {
  fontSize: 18,
  fontWeight: "700" as const,
  color: "#111827",
  marginBottom: 14,
} as const;