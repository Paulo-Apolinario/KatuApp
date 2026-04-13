import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  routeService,
  type RouteItem,
  translateRouteStatus,
} from "@/src/services/routeService";
import { useAuth } from "@/src/contexts/AuthContext";
import { translateCollectionStatus } from "@/src/services/collectionService";
import { translateVehicleStatus } from "@/src/services/vehicleService";
import { MotoristaGreenHeader } from "@/src/components/MotoristaGreenHeader";

function openExternalNavigation(params: {
  latitude: number;
  longitude: number;
  originLatitude?: number | null;
  originLongitude?: number | null;
}) {
  const destination = `${params.latitude},${params.longitude}`;
  const origin =
    params.originLatitude != null && params.originLongitude != null
      ? `&origin=${params.originLatitude},${params.originLongitude}`
      : "";

  const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}${origin}&travelmode=driving`;
  return Linking.openURL(url);
}

function DetailLine({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  return (
    <Text style={{ color: "#6B7280", marginTop: 6 }}>
      {label}: {value || "Não informado"}
    </Text>
  );
}

function StatusBadge({ label }: { label: string }) {
  const isInProgress = label === "IN_PROGRESS";
  const isCompleted = label === "COMPLETED";
  const isCancelled = label === "CANCELLED";

  const backgroundColor = isInProgress
    ? "#FEF3C7"
    : isCompleted
    ? "#DCFCE7"
    : isCancelled
    ? "#FEE2E2"
    : "#ECFDF5";

  const textColor = isInProgress
    ? "#B45309"
    : isCompleted
    ? "#166534"
    : isCancelled
    ? "#B91C1C"
    : "#047857";

  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        marginTop: 10,
      }}
    >
      <Text style={{ color: textColor, fontSize: 12, fontWeight: "700" }}>
        {translateRouteStatus(label)}
      </Text>
    </View>
  );
}

export default function MotoristaRotasScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ highlightRouteId?: string }>();
  const driverId = user?.driver?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailsById, setDetailsById] = useState<Record<string, RouteItem>>({});
  const [error, setError] = useState<string | null>(null);

  const loadRoutes = useCallback(
    async (showRefresh = false) => {
      if (!driverId) {
        setError("Motorista não vinculado ao usuário autenticado.");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        setError(null);

        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const data = await routeService.listByDriver(driverId);
        setRoutes(data);

        if (params.highlightRouteId) {
          setExpandedId(String(params.highlightRouteId));
        }
      } catch (err: any) {
        setError(err?.message || "Não foi possível carregar as rotas.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [driverId, params.highlightRouteId]
  );

  useFocusEffect(
    useCallback(() => {
      void loadRoutes();
    }, [loadRoutes])
  );

  const handleToggleRoute = useCallback(
    async (routeId: string) => {
      if (expandedId === routeId) {
        setExpandedId(null);
        return;
      }

      setExpandedId(routeId);

      if (!detailsById[routeId]) {
        try {
          const detail = await routeService.getById(routeId);
          setDetailsById((prev) => ({ ...prev, [routeId]: detail }));
        } catch (err: any) {
          setError(err?.message || "Não foi possível carregar os detalhes da rota.");
        }
      }
    },
    [detailsById, expandedId]
  );

  const routeItems = useMemo(
    () =>
      routes.map((item) => ({
        ...item,
        detail: detailsById[item.id] ?? item,
      })),
    [detailsById, routes]
  );

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F8FAFC",
        }}
      >
        <ActivityIndicator size="large" color="#028C56" />
        <Text style={{ marginTop: 12, color: "#4B5563", fontWeight: "600" }}>
          Carregando rotas...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
      <MotoristaGreenHeader
        title="Rotas"
        subtitle="Rotas atribuídas ao motorista"
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={{
          padding: 18,
          paddingBottom: 30,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadRoutes(true)}
            colors={["#028C56"]}
            tintColor="#028C56"
          />
        }
      >
        {!!error && (
          <View
            style={{
              backgroundColor: "#FEF2F2",
              borderWidth: 1,
              borderColor: "#FECACA",
              borderRadius: 16,
              padding: 14,
              marginBottom: 16,
            }}
          >
            <Text style={{ color: "#B91C1C", fontWeight: "700" }}>{error}</Text>
          </View>
        )}

        {routeItems.length === 0 ? (
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 18,
              padding: 16,
            }}
          >
            <Text style={{ color: "#111827", fontSize: 16, fontWeight: "800" }}>
              Nenhuma rota disponível
            </Text>
            <Text style={{ color: "#6B7280", marginTop: 10, lineHeight: 22 }}>
              Ainda não existem rotas atribuídas a este motorista.
            </Text>
          </View>
        ) : (
          routeItems.map((routeEntry) => {
            const { detail, ...item } = routeEntry;
            const isExpanded = expandedId === item.id;

            const firstPoint =
              detail.collections?.find(
                (collection) =>
                  collection.generator?.latitude != null &&
                  collection.generator?.longitude != null
              )?.generator || null;

            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.95}
                onPress={() => void handleToggleRoute(item.id)}
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 18,
                  padding: 16,
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
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={{ color: "#111827", fontSize: 17, fontWeight: "800" }}>
                      {item.name}
                    </Text>

                    {!!item.description && (
                      <Text style={{ color: "#6B7280", marginTop: 8 }}>
                        {item.description}
                      </Text>
                    )}

                    <DetailLine
                      label="Data"
                      value={
                        item.scheduledDate
                          ? new Date(item.scheduledDate).toLocaleString("pt-BR")
                          : "Não definida"
                      }
                    />
                    <DetailLine label="Paradas" value={item.stops?.length || 0} />
                    <DetailLine
                      label="Coletas"
                      value={item.stats?.totalCollections ?? detail.collections?.length ?? 0}
                    />
                    {!!item.vehicle?.plate && (
                      <DetailLine label="Veículo" value={item.vehicle.plate} />
                    )}

                    <StatusBadge label={item.status} />
                  </View>

                  <Ionicons
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={22}
                    color="#6B7280"
                  />
                </View>

                {isExpanded && (
                  <View
                    style={{
                      marginTop: 14,
                      paddingTop: 14,
                      borderTopWidth: 1,
                      borderTopColor: "#E5E7EB",
                    }}
                  >
                    <Text
                      style={{
                        color: "#111827",
                        fontSize: 15,
                        fontWeight: "800",
                        marginBottom: 10,
                      }}
                    >
                      Informações da rota
                    </Text>

                    <DetailLine
                      label="Situação do veículo"
                      value={translateVehicleStatus(detail.vehicle?.status)}
                    />
                    <DetailLine
                      label="Motorista"
                      value={detail.driver?.name || user?.displayName}
                    />
                    <DetailLine
                      label="Cooperativa"
                      value={detail.cooperative?.name}
                    />

                    <Text
                      style={{
                        color: "#111827",
                        fontSize: 14,
                        fontWeight: "800",
                        marginTop: 14,
                        marginBottom: 8,
                      }}
                    >
                      Pontos / paradas
                    </Text>

                    {(detail.stops || []).length > 0 ? (
                      detail.stops.map((stop, index) => (
                        <Text
                          key={`${detail.id}-stop-${index}`}
                          style={{ color: "#6B7280", lineHeight: 22 }}
                        >
                          {index + 1}. {stop}
                        </Text>
                      ))
                    ) : (
                      <Text style={{ color: "#6B7280" }}>
                        Nenhuma parada cadastrada.
                      </Text>
                    )}

                    <Text
                      style={{
                        color: "#111827",
                        fontSize: 14,
                        fontWeight: "800",
                        marginTop: 14,
                        marginBottom: 8,
                      }}
                    >
                      Coletas / agendamentos
                    </Text>

                    {(detail.collections || []).length > 0 ? (
                      detail.collections!.map((collection) => (
                        <View
                          key={collection.id}
                          style={{
                            borderWidth: 1,
                            borderColor: "#E5E7EB",
                            borderRadius: 14,
                            padding: 12,
                            marginBottom: 10,
                            backgroundColor: "#F9FAFB",
                          }}
                        >
                          <Text
                            style={{
                              color: "#111827",
                              fontWeight: "800",
                              marginBottom: 4,
                            }}
                          >
                            {collection.generator?.companyName ||
                              collection.generator?.name ||
                              "Ponto de coleta"}
                          </Text>
                          <Text style={{ color: "#6B7280", lineHeight: 20 }}>
                            Status: {translateCollectionStatus(collection.status)}
                          </Text>
                          <Text style={{ color: "#6B7280", lineHeight: 20 }}>
                            Endereço: {collection.generator?.address || "Não informado"}
                          </Text>
                          <Text style={{ color: "#6B7280", lineHeight: 20 }}>
                            Data:{" "}
                            {collection.schedule?.scheduledDate ||
                            collection.schedule?.preferredDate
                              ? new Date(
                                  collection.schedule?.scheduledDate ||
                                    collection.schedule?.preferredDate ||
                                    ""
                                ).toLocaleString("pt-BR")
                              : "Não definida"}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <Text style={{ color: "#6B7280" }}>
                        Nenhuma coleta carregada nesta rota.
                      </Text>
                    )}

                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: 10,
                        marginTop: 12,
                      }}
                    >
                      <TouchableOpacity
                        onPress={() =>
                          router.push({
                            pathname: "/(motorista)/mapa",
                            params: { routeId: item.id },
                          })
                        }
                        style={{
                          backgroundColor: "#ECFDF5",
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          borderRadius: 12,
                        }}
                      >
                        <Text style={{ color: "#047857", fontWeight: "800" }}>
                          VER NO MAPA
                        </Text>
                      </TouchableOpacity>

                      {firstPoint?.latitude != null &&
                        firstPoint?.longitude != null && (
                          <TouchableOpacity
                            onPress={() =>
                              openExternalNavigation({
                                latitude: Number(firstPoint.latitude),
                                longitude: Number(firstPoint.longitude),
                              })
                            }
                            style={{
                              backgroundColor: "#028C56",
                              paddingHorizontal: 14,
                              paddingVertical: 10,
                              borderRadius: 12,
                            }}
                          >
                            <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>
                              TRAÇAR ROTA
                            </Text>
                          </TouchableOpacity>
                        )}
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}