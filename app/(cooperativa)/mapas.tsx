import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import * as Linking from "expo-linking";

import OperationalMap from "@/src/components/maps/OperationalMap";
import { OfflineBanner } from "@/src/components/OfflineBanner";
import { LastSyncBadge } from "@/src/components/LastSyncBadge";
import { useConnectivity } from "@/src/hooks/useConnectivity";
import {
  scheduleService,
  type Schedule,
} from "@/src/services/scheduleService";
import {
  collectionService,
  type Collection,
} from "@/src/services/collectionService";

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type PointStatus = "REQUESTED" | "SCHEDULED" | "IN_PROGRESS";
type ViewMode = "ALL" | "ROUTE_ONLY";

type MapOperationalPoint = {
  id: string;
  scheduleId: string;
  collectionId?: string;
  sourceType: "SCHEDULE" | "COLLECTION";
  title: string;
  address: string;
  latitude: number;
  longitude: number;
  status: PointStatus;
  dateLabel?: string | null;
  routeName?: string | null;
  routeId?: string | null;
  driverName?: string | null;
  vehicleLabel?: string | null;
  collectorName?: string | null;
  order?: number;
};

const INITIAL_REGION: Region = {
  latitude: -3.7319,
  longitude: -38.5267,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

function formatDate(value?: string | null) {
  if (!value) return "Sem data definida";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem data definida";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusLabel(status: PointStatus) {
  switch (status) {
    case "REQUESTED":
      return "Solicitado";
    case "SCHEDULED":
      return "Agendado";
    case "IN_PROGRESS":
      return "Em andamento";
    default:
      return "Sem status";
  }
}

function getMarkerColor(status: PointStatus) {
  switch (status) {
    case "REQUESTED":
      return "#F59E0B";
    case "SCHEDULED":
      return "#2563EB";
    case "IN_PROGRESS":
      return "#8B5CF6";
    default:
      return "#6B7280";
  }
}

function calculateDistance(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
) {
  const dx = a.latitude - b.latitude;
  const dy = a.longitude - b.longitude;
  return Math.sqrt(dx * dx + dy * dy);
}

function optimizeRouteByNearestNeighbor(
  base: { latitude: number; longitude: number },
  points: MapOperationalPoint[]
): MapOperationalPoint[] {
  const remaining = [...points];
  const ordered: MapOperationalPoint[] = [];
  let current = { ...base };

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = calculateDistance(current, remaining[0]);

    for (let i = 1; i < remaining.length; i++) {
      const distance = calculateDistance(current, remaining[i]);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
    }

    const [nearest] = remaining.splice(nearestIndex, 1);
    ordered.push(nearest);
    current = {
      latitude: nearest.latitude,
      longitude: nearest.longitude,
    };
  }

  return ordered.map((point, index) => ({
    ...point,
    order: index + 1,
  }));
}

function hasValidCoordinates(
  latitude?: number | null,
  longitude?: number | null
) {
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    !Number.isNaN(latitude) &&
    !Number.isNaN(longitude)
  );
}

function normalizeSchedulePoints(schedules: Schedule[]): MapOperationalPoint[] {
  return schedules
    .filter((item) =>
      ["REQUESTED", "SCHEDULED", "IN_PROGRESS"].includes(item.status)
    )
    .filter((item) =>
      hasValidCoordinates(item.generator?.latitude, item.generator?.longitude)
    )
    .map((item) => ({
      id: `schedule-${item.id}`,
      scheduleId: item.id,
      sourceType: "SCHEDULE" as const,
      title:
        item.generator?.companyName ||
        item.generator?.businessName ||
        item.generator?.name ||
        item.requestedBy?.displayName ||
        "Solicitação operacional",
      address: item.generator?.address || "Endereço não informado",
      latitude: item.generator?.latitude as number,
      longitude: item.generator?.longitude as number,
      status: item.status as PointStatus,
      dateLabel: item.scheduledDate || item.preferredDate || item.createdAt,
      routeName: null,
      routeId: null,
      driverName: null,
      vehicleLabel: null,
      collectorName: null,
    }));
}

function normalizeCollectionPoints(
  collections: Collection[]
): MapOperationalPoint[] {
  return collections
    .filter(
      (item) => item.status === "PENDING" || item.status === "IN_PROGRESS"
    )
    .filter((item) =>
      hasValidCoordinates(item.generator?.latitude, item.generator?.longitude)
    )
    .map((item) => ({
      id: `collection-${item.id}`,
      scheduleId: item.scheduleId || item.schedule?.id || "",
      collectionId: item.id,
      sourceType: "COLLECTION" as const,
      title:
        item.generator?.companyName ||
        item.generator?.businessName ||
        item.generator?.name ||
        item.schedule?.requestedBy?.displayName ||
        "Coleta delegada",
      address: item.generator?.address || "Endereço não informado",
      latitude: item.generator?.latitude as number,
      longitude: item.generator?.longitude as number,
      status: item.status === "IN_PROGRESS" ? "IN_PROGRESS" : "SCHEDULED",
      dateLabel:
        item.schedule?.scheduledDate ||
        item.schedule?.preferredDate ||
        item.createdAt,
      routeName: item.route?.name || null,
      routeId: item.route?.id || null,
      driverName: item.driver?.name || null,
      vehicleLabel: item.vehicle
        ? `${item.vehicle.model || "Veículo"}${
            item.vehicle.plate ? ` • ${item.vehicle.plate}` : ""
          }`
        : null,
      collectorName:
        item.collector?.name || item.collector?.displayName || null,
    }));
}

export default function CooperativeMapScreen() {
  const { isOffline } = useConnectivity();

  const [loadingLocation, setLoadingLocation] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [region, setRegion] = useState<Region>(INITIAL_REGION);
  const [selectedStatus, setSelectedStatus] = useState<"ALL" | PointStatus>(
    "ALL"
  );
  const [selectedPoint, setSelectedPoint] =
    useState<MapOperationalPoint | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("ALL");
  const [points, setPoints] = useState<MapOperationalPoint[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  const loadLocation = useCallback(async () => {
    try {
      setLoadingLocation(true);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setRegion({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      });
    } catch (error) {
      console.error("Erro ao carregar localização:", error);
    } finally {
      setLoadingLocation(false);
    }
  }, []);

  const loadOperationalData = useCallback(async () => {
    try {
      setLoadingData(true);

      const [schedulesResponse, collectionsResponse] = await Promise.all([
        scheduleService.list(),
        collectionService.list(),
      ]);

      const schedules = Array.isArray(schedulesResponse) ? schedulesResponse : [];
      const collections = Array.isArray(collectionsResponse)
        ? collectionsResponse
        : [];

      const mergedPoints = [
        ...normalizeSchedulePoints(schedules),
        ...normalizeCollectionPoints(collections),
      ];

      setPoints(mergedPoints);
      setSelectedPoint((currentSelected) => {
        if (!currentSelected) return null;

        const stillExists =
          mergedPoints.find((item) => item.id === currentSelected.id) || null;

        return stillExists;
      });
      setLastSyncAt(new Date().toISOString());
    } catch (error) {
      console.error("Erro ao carregar mapa operacional:", error);
      Alert.alert(
        "Erro",
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os dados operacionais do mapa."
      );
      setPoints([]);
      setSelectedPoint(null);
    } finally {
      setLoadingData(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadLocation(), loadOperationalData()]);
  }, [loadLocation, loadOperationalData]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const filteredByStatus = useMemo(() => {
    if (selectedStatus === "ALL") return points;
    return points.filter((item) => item.status === selectedStatus);
  }, [selectedStatus, points]);

  const routeFocusedPoints = useMemo(() => {
    if (viewMode !== "ROUTE_ONLY" || !selectedRouteId) {
      return filteredByStatus;
    }

    return filteredByStatus.filter((item) => item.routeId === selectedRouteId);
  }, [filteredByStatus, selectedRouteId, viewMode]);

  const orderedPoints = useMemo(() => {
    return optimizeRouteByNearestNeighbor(
      {
        latitude: region.latitude,
        longitude: region.longitude,
      },
      routeFocusedPoints
    );
  }, [routeFocusedPoints, region.latitude, region.longitude]);

  const allRouteOptions = useMemo(() => {
    const grouped = new Map<
      string,
      { routeId: string; routeName: string; total: number; inProgress: number }
    >();

    points
      .filter((item) => item.routeId && item.routeName)
      .forEach((item) => {
        const key = item.routeId as string;
        const existing = grouped.get(key);

        if (existing) {
          existing.total += 1;
          if (item.status === "IN_PROGRESS") existing.inProgress += 1;
          return;
        }

        grouped.set(key, {
          routeId: key,
          routeName: item.routeName as string,
          total: 1,
          inProgress: item.status === "IN_PROGRESS" ? 1 : 0,
        });
      });

    return Array.from(grouped.values()).sort((a, b) =>
      a.routeName.localeCompare(b.routeName)
    );
  }, [points]);

  useEffect(() => {
    if (selectedRouteId) {
      const stillExists = allRouteOptions.some(
        (item) => item.routeId === selectedRouteId
      );

      if (!stillExists) {
        setSelectedRouteId(null);
        setViewMode("ALL");
      }
    }
  }, [selectedRouteId, allRouteOptions]);

  const selectedRouteCoordinates = useMemo(() => {
    if (viewMode === "ROUTE_ONLY" && orderedPoints.length > 0) {
      return [
        { latitude: region.latitude, longitude: region.longitude },
        ...orderedPoints.map((item) => ({
          latitude: item.latitude,
          longitude: item.longitude,
        })),
      ];
    }

    if (!selectedPoint) return [];

    return [
      { latitude: region.latitude, longitude: region.longitude },
      { latitude: selectedPoint.latitude, longitude: selectedPoint.longitude },
    ];
  }, [region.latitude, region.longitude, selectedPoint, orderedPoints, viewMode]);

  const summary = useMemo(() => {
    const base = {
      requested: points.filter((item) => item.status === "REQUESTED").length,
      scheduled: points.filter((item) => item.status === "SCHEDULED").length,
      inProgress: points.filter((item) => item.status === "IN_PROGRESS").length,
      total: points.length,
    };

    return { base };
  }, [points]);

  const selectedRouteMeta = useMemo(() => {
    if (!selectedRouteId) return null;
    return (
      allRouteOptions.find((item) => item.routeId === selectedRouteId) || null
    );
  }, [selectedRouteId, allRouteOptions]);

  const selectPoint = useCallback((point: MapOperationalPoint) => {
    setSelectedPoint(point);

    if (point.routeId) {
      setSelectedRouteId(point.routeId);
    }
  }, []);

  const openExternalRoute = useCallback(async (point: MapOperationalPoint) => {
    try {
      const destination = `${point.latitude},${point.longitude}`;
      const googleMapsWebUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
      const appleMapsUrl = `http://maps.apple.com/?daddr=${destination}&dirflg=d`;

      const urlToOpen = Platform.OS === "ios" ? appleMapsUrl : googleMapsWebUrl;
      const supported = await Linking.canOpenURL(urlToOpen);

      if (!supported) {
        Alert.alert("Erro", "Não foi possível abrir o aplicativo de mapas.");
        return;
      }

      await Linking.openURL(urlToOpen);
    } catch (error) {
      console.error("Erro ao abrir rota externa:", error);
      Alert.alert("Erro", "Não foi possível abrir a rota externa.");
    }
  }, []);

  const isLoading = loadingLocation || loadingData;

  return (
    <View style={{ flex: 1, backgroundColor: "#F3F4F6" }}>
      <LinearGradient
        colors={["#10F35D", "#028C56"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          paddingTop: 48,
          paddingBottom: 18,
          paddingHorizontal: 20,
          borderBottomLeftRadius: 26,
          borderBottomRightRadius: 26,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ marginRight: 14 }}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 22, fontWeight: "900", color: "#FFFFFF" }}>
                MAPA OPERACIONAL
              </Text>
              <Text style={{ fontSize: 13, color: "#E8FFF1", marginTop: 4 }}>
                Solicitações, coletas delegadas e execução em campo
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={refreshAll}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: "rgba(255,255,255,0.18)",
              alignItems: "center",
              justifyContent: "center",
              marginLeft: 12,
            }}
          >
            <Ionicons name="refresh-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: 16, paddingTop: 14, gap: 12 }}>
          <OfflineBanner visible={isOffline} />
          <LastSyncBadge value={lastSyncAt} />
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 6 }}
          >
            <StatusCard
              title="Solicitados"
              value={summary.base.requested}
              color="#F59E0B"
              active={selectedStatus === "REQUESTED"}
              onPress={() => {
                setSelectedStatus("REQUESTED");
                setSelectedPoint(null);
              }}
            />
            <StatusCard
              title="Agendados"
              value={summary.base.scheduled}
              color="#2563EB"
              active={selectedStatus === "SCHEDULED"}
              onPress={() => {
                setSelectedStatus("SCHEDULED");
                setSelectedPoint(null);
              }}
            />
            <StatusCard
              title="Em andamento"
              value={summary.base.inProgress}
              color="#8B5CF6"
              active={selectedStatus === "IN_PROGRESS"}
              onPress={() => {
                setSelectedStatus("IN_PROGRESS");
                setSelectedPoint(null);
              }}
            />
            <StatusCard
              title="Todos"
              value={summary.base.total}
              color="#028C56"
              active={selectedStatus === "ALL"}
              onPress={() => {
                setSelectedStatus("ALL");
                setSelectedPoint(null);
              }}
            />
          </ScrollView>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <ModeChip
              label="Visão geral"
              active={viewMode === "ALL"}
              onPress={() => setViewMode("ALL")}
            />
            <ModeChip
              label="Somente rota"
              active={viewMode === "ROUTE_ONLY"}
              onPress={() => setViewMode("ROUTE_ONLY")}
            />
            {allRouteOptions.map((route) => (
              <ModeChip
                key={route.routeId}
                label={`${route.routeName} (${route.total})`}
                active={selectedRouteId === route.routeId}
                onPress={() => {
                  setSelectedRouteId(route.routeId);
                  setViewMode("ROUTE_ONLY");
                  setSelectedPoint(null);
                }}
              />
            ))}
          </ScrollView>
        </View>

        {selectedRouteMeta && viewMode === "ROUTE_ONLY" && (
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <View
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 16,
                padding: 14,
                borderWidth: 1,
                borderColor: "#E5E7EB",
              }}
            >
              <Text
                style={{
                  color: "#111827",
                  fontWeight: "800",
                  fontSize: 15,
                }}
              >
                {selectedRouteMeta.routeName}
              </Text>
              <Text style={{ color: "#6B7280", marginTop: 4, fontSize: 13 }}>
                Pontos nesta rota: {selectedRouteMeta.total} • Em andamento:{" "}
                {selectedRouteMeta.inProgress}
              </Text>
            </View>
          </View>
        )}

        <View
          style={{
            height: 340,
            marginTop: 14,
            marginHorizontal: 16,
            borderRadius: 22,
            overflow: "hidden",
            backgroundColor: "#FFFFFF",
          }}
        >
          {isLoading ? (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
              }}
            >
              <ActivityIndicator size="large" color="#028C56" />
              <Text style={{ marginTop: 10, color: "#64748B" }}>
                Carregando mapa operacional...
              </Text>
            </View>
          ) : orderedPoints.length === 0 ? (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                paddingHorizontal: 24,
              }}
            >
              <Ionicons name="map-outline" size={46} color="#94A3B8" />
              <Text
                style={{
                  marginTop: 12,
                  fontSize: 17,
                  fontWeight: "800",
                  color: "#0F172A",
                  textAlign: "center",
                }}
              >
                Nenhum ponto operacional disponível
              </Text>
            </View>
          ) : (
            <OperationalMap
              baseLatitude={region.latitude}
              baseLongitude={region.longitude}
              points={orderedPoints.map((point) => ({
                id: point.id,
                latitude: point.latitude,
                longitude: point.longitude,
                title:
                  point.order && viewMode === "ROUTE_ONLY"
                    ? `${point.order}. ${point.title}`
                    : point.title,
                description: point.address,
                color:
                  selectedPoint?.id === point.id
                    ? "#111827"
                    : getMarkerColor(point.status),
              }))}
              routeCoordinates={selectedRouteCoordinates}
              selectedPointId={selectedPoint?.id ?? null}
              onSelectPoint={(pointId: string) => {
                if (pointId === "__base__") {
                  setSelectedPoint(null);
                  return;
                }

                const foundPoint = orderedPoints.find((item) => item.id === pointId);
                if (foundPoint) {
                  selectPoint(foundPoint);
                }
              }}
            />
          )}
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {orderedPoints.map((point) => {
              const active = selectedPoint?.id === point.id;

              return (
                <TouchableOpacity
                  key={point.id}
                  activeOpacity={0.88}
                  onPress={() => selectPoint(point)}
                  style={{
                    width: 210,
                    marginRight: 10,
                    backgroundColor: active ? "#ECFDF5" : "#FFFFFF",
                    borderColor: active ? "#028C56" : "#E5E7EB",
                    borderWidth: 1,
                    borderRadius: 16,
                    padding: 12,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <Text
                      style={{
                        flex: 1,
                        color: "#111827",
                        fontSize: 14,
                        fontWeight: "800",
                        paddingRight: 6,
                      }}
                      numberOfLines={2}
                    >
                      {point.order && viewMode === "ROUTE_ONLY"
                        ? `${point.order}. `
                        : ""}
                      {point.title}
                    </Text>

                    <View
                      style={{
                        backgroundColor: getMarkerColor(point.status),
                        borderRadius: 999,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                      }}
                    >
                      <Text
                        style={{
                          color: "#FFFFFF",
                          fontSize: 9,
                          fontWeight: "900",
                        }}
                      >
                        {getStatusLabel(point.status)}
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={{
                      color: "#6B7280",
                      fontSize: 11,
                      marginTop: 8,
                    }}
                    numberOfLines={2}
                  >
                    {point.address}
                  </Text>

                  {!!point.routeName && (
                    <Text
                      style={{ color: "#334155", fontSize: 11, marginTop: 7 }}
                      numberOfLines={1}
                    >
                      Rota: {point.routeName}
                    </Text>
                  )}

                  {!!point.driverName && (
                    <Text
                      style={{ color: "#334155", fontSize: 11, marginTop: 4 }}
                      numberOfLines={1}
                    >
                      Motorista: {point.driverName}
                    </Text>
                  )}

                  {!!point.vehicleLabel && (
                    <Text
                      style={{ color: "#334155", fontSize: 11, marginTop: 4 }}
                      numberOfLines={1}
                    >
                      Veículo: {point.vehicleLabel}
                    </Text>
                  )}

                  {!!point.collectorName && (
                    <Text
                      style={{ color: "#334155", fontSize: 11, marginTop: 4 }}
                      numberOfLines={1}
                    >
                      Catador: {point.collectorName}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 18 }}>
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 20,
              padding: 16,
              borderWidth: 1,
              borderColor: "#E5E7EB",
            }}
          >
            {selectedPoint ? (
              <>
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
                        fontSize: 17,
                        fontWeight: "900",
                        color: "#0F172A",
                      }}
                    >
                      {selectedPoint.title}
                    </Text>

                    <Text
                      style={{
                        fontSize: 13,
                        color: "#64748B",
                        marginTop: 8,
                      }}
                    >
                      Endereço: {selectedPoint.address}
                    </Text>

                    <Text
                      style={{
                        fontSize: 13,
                        color: "#475569",
                        marginTop: 6,
                      }}
                    >
                      Data operacional: {formatDate(selectedPoint.dateLabel)}
                    </Text>

                    {!!selectedPoint.routeName && (
                      <Text style={{ fontSize: 13, color: "#475569", marginTop: 6 }}>
                        Rota: {selectedPoint.routeName}
                      </Text>
                    )}

                    {!!selectedPoint.driverName && (
                      <Text style={{ fontSize: 13, color: "#475569", marginTop: 6 }}>
                        Motorista: {selectedPoint.driverName}
                      </Text>
                    )}

                    {!!selectedPoint.vehicleLabel && (
                      <Text style={{ fontSize: 13, color: "#475569", marginTop: 6 }}>
                        Veículo: {selectedPoint.vehicleLabel}
                      </Text>
                    )}

                    {!!selectedPoint.collectorName && (
                      <Text style={{ fontSize: 13, color: "#475569", marginTop: 6 }}>
                        Catador: {selectedPoint.collectorName}
                      </Text>
                    )}
                  </View>

                  <View
                    style={{
                      backgroundColor: getMarkerColor(selectedPoint.status),
                      borderRadius: 999,
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                    }}
                  >
                    <Text
                      style={{
                        color: "#FFFFFF",
                        fontSize: 11,
                        fontWeight: "900",
                      }}
                    >
                      {getStatusLabel(selectedPoint.status)}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: "row", marginTop: 16, gap: 10 }}>
                  <TouchableOpacity
                    onPress={() =>
                      router.push({
                        pathname: "/(cooperativa)/schedule/[id]",
                        params: { id: selectedPoint.scheduleId },
                      })
                    }
                    style={{
                      flex: 1,
                      backgroundColor: "#028C56",
                      borderRadius: 12,
                      paddingVertical: 12,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: "#FFFFFF",
                        fontWeight: "900",
                        fontSize: 13,
                      }}
                    >
                      VER AGENDAMENTO
                    </Text>
                  </TouchableOpacity>

                  {!!selectedPoint.routeId && typeof selectedPoint.routeId === "string" ? (
                    <TouchableOpacity
                      onPress={() =>
                        router.push({
                          pathname: "/(cooperativa)/rotas/[id]",
                          params: { id: selectedPoint.routeId as string },
                        })
                      }
                      style={{
                        flex: 1,
                        backgroundColor: "#EEF4FF",
                        borderColor: "#C7D8FF",
                        borderWidth: 1,
                        borderRadius: 12,
                        paddingVertical: 12,
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: "#2E63E6",
                          fontWeight: "900",
                          fontSize: 13,
                        }}
                      >
                        VER ROTA
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={() => openExternalRoute(selectedPoint)}
                      style={{
                        flex: 1,
                        backgroundColor: "#EEF4FF",
                        borderColor: "#C7D8FF",
                        borderWidth: 1,
                        borderRadius: 12,
                        paddingVertical: 12,
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: "#2E63E6",
                          fontWeight: "900",
                          fontSize: 13,
                        }}
                      >
                        TRAÇAR ROTA
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            ) : (
              <View style={{ alignItems: "center", paddingVertical: 8 }}>
                <Ionicons name="map-outline" size={40} color="#94A3B8" />
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "800",
                    color: "#0F172A",
                    marginTop: 10,
                  }}
                >
                  Selecione um ponto operacional
                </Text>
                <Text
                  style={{
                    marginTop: 6,
                    fontSize: 13,
                    color: "#6B7280",
                    textAlign: "center",
                  }}
                >
                  Toque em um ponto no mapa ou em um card abaixo para ver detalhes.
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function StatusCard({
  title,
  value,
  color,
  active,
  onPress,
}: {
  title: string;
  value: number;
  color: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        width: 132,
        backgroundColor: active ? color : "#FFFFFF",
        borderRadius: 16,
        padding: 12,
        marginRight: 10,
        borderWidth: 1,
        borderColor: active ? color : "#E5E7EB",
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: "700",
          color: active ? "#FFFFFF" : "#64748B",
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          fontSize: 22,
          fontWeight: "900",
          marginTop: 6,
          color: active ? "#FFFFFF" : "#0F172A",
        }}
      >
        {value}
      </Text>
    </TouchableOpacity>
  );
}

function ModeChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: active ? "#028C56" : "#FFFFFF",
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: active ? "#028C56" : "#E5E7EB",
        marginRight: 10,
      }}
    >
      <Text
        style={{
          color: active ? "#FFFFFF" : "#374151",
          fontWeight: "700",
          fontSize: 12,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}