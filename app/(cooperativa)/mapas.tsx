import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import MapView, {
  Marker,
  Polyline,
  PROVIDER_DEFAULT,
  Region,
} from "react-native-maps";
import * as Location from "expo-location";
import * as Linking from "expo-linking";

import {
  scheduleService,
  type Schedule,
} from "@/src/services/scheduleService";
import {
  collectionService,
  type Collection,
} from "@/src/services/collectionService";

type PointStatus = "REQUESTED" | "SCHEDULED" | "IN_PROGRESS";

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
      sourceType: "SCHEDULE",
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
      sourceType: "COLLECTION",
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
  const mapRef = useRef<MapView | null>(null);

  const [loadingLocation, setLoadingLocation] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [region, setRegion] = useState<Region>(INITIAL_REGION);
  const [selectedStatus, setSelectedStatus] = useState<"ALL" | PointStatus>("ALL");
  const [selectedPoint, setSelectedPoint] = useState<MapOperationalPoint | null>(null);
  const [points, setPoints] = useState<MapOperationalPoint[]>([]);

  const fitPoints = useCallback(
    (items: { latitude: number; longitude: number }[]) => {
      if (!mapRef.current || items.length === 0) return;

      const coordinates = [
        { latitude: region.latitude, longitude: region.longitude },
        ...items,
      ];

      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: {
          top: 90,
          right: 90,
          bottom: 240,
          left: 90,
        },
        animated: true,
      });
    },
    [region.latitude, region.longitude]
  );

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

      if (!scheduleService || typeof scheduleService.list !== "function") {
        throw new Error("Serviço de agendamentos não carregado.");
      }

      if (!collectionService || typeof collectionService.list !== "function") {
        throw new Error("Serviço de coletas não carregado.");
      }

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
      setSelectedPoint(null);
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

  const filteredPoints = useMemo(() => {
    if (selectedStatus === "ALL") return points;
    return points.filter((item) => item.status === selectedStatus);
  }, [selectedStatus, points]);

  const orderedPoints = useMemo(() => {
    return optimizeRouteByNearestNeighbor(
      {
        latitude: region.latitude,
        longitude: region.longitude,
      },
      filteredPoints
    );
  }, [filteredPoints, region.latitude, region.longitude]);

  useEffect(() => {
    if (orderedPoints.length > 0) {
      const timer = setTimeout(() => {
        fitPoints(
          orderedPoints.map((item) => ({
            latitude: item.latitude,
            longitude: item.longitude,
          }))
        );
      }, 250);

      return () => clearTimeout(timer);
    }
  }, [orderedPoints, fitPoints]);

  const selectedRouteCoordinates = useMemo(() => {
    if (!selectedPoint) return [];

    return [
      { latitude: region.latitude, longitude: region.longitude },
      { latitude: selectedPoint.latitude, longitude: selectedPoint.longitude },
    ];
  }, [region.latitude, region.longitude, selectedPoint]);

  const summary = useMemo(() => {
    return {
      requested: points.filter((item) => item.status === "REQUESTED").length,
      scheduled: points.filter((item) => item.status === "SCHEDULED").length,
      inProgress: points.filter((item) => item.status === "IN_PROGRESS").length,
      total: points.length,
    };
  }, [points]);

  const selectPoint = useCallback((point: MapOperationalPoint) => {
    setSelectedPoint(point);

    if (mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: point.latitude,
          longitude: point.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        500
      );
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

      <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 6 }}
        >
          <StatusCard
            title="Solicitados"
            value={summary.requested}
            color="#F59E0B"
            active={selectedStatus === "REQUESTED"}
            onPress={() => {
              setSelectedStatus("REQUESTED");
              setSelectedPoint(null);
            }}
          />
          <StatusCard
            title="Agendados"
            value={summary.scheduled}
            color="#2563EB"
            active={selectedStatus === "SCHEDULED"}
            onPress={() => {
              setSelectedStatus("SCHEDULED");
              setSelectedPoint(null);
            }}
          />
          <StatusCard
            title="Em andamento"
            value={summary.inProgress}
            color="#8B5CF6"
            active={selectedStatus === "IN_PROGRESS"}
            onPress={() => {
              setSelectedStatus("IN_PROGRESS");
              setSelectedPoint(null);
            }}
          />
          <StatusCard
            title="Todos"
            value={summary.total}
            color="#028C56"
            active={selectedStatus === "ALL"}
            onPress={() => {
              setSelectedStatus("ALL");
              setSelectedPoint(null);
            }}
          />
        </ScrollView>
      </View>

      <View
        style={{
          flex: 1,
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
              minHeight: 320,
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
              minHeight: 320,
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
          <MapView
            ref={(ref) => {
              mapRef.current = ref;
            }}
            provider={PROVIDER_DEFAULT}
            style={{ flex: 1, minHeight: 380 }}
            initialRegion={region}
            showsUserLocation
            showsMyLocationButton
          >
            {selectedPoint && (
              <Polyline
                coordinates={selectedRouteCoordinates}
                strokeWidth={5}
                strokeColor="#028C56"
              />
            )}

            <Marker
              coordinate={{
                latitude: region.latitude,
                longitude: region.longitude,
              }}
              title="Base operacional"
              description="Cooperativa / localização atual"
              pinColor="#028C56"
            />

            {orderedPoints.map((point) => (
              <Marker
                key={point.id}
                coordinate={{
                  latitude: point.latitude,
                  longitude: point.longitude,
                }}
                title={point.title}
                description={point.address}
                pinColor={getMarkerColor(point.status)}
                onPress={() => selectPoint(point)}
              />
            ))}
          </MapView>
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
                  width: 250,
                  marginRight: 12,
                  backgroundColor: active ? "#ECFDF5" : "#FFFFFF",
                  borderColor: active ? "#028C56" : "#E5E7EB",
                  borderWidth: 1,
                  borderRadius: 18,
                  padding: 14,
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
                      fontSize: 15,
                      fontWeight: "800",
                      paddingRight: 8,
                    }}
                    numberOfLines={2}
                  >
                    {point.order ? `${point.order}. ` : ""}
                    {point.title}
                  </Text>

                  <View
                    style={{
                      backgroundColor: getMarkerColor(point.status),
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                    }}
                  >
                    <Text
                      style={{
                        color: "#FFFFFF",
                        fontSize: 10,
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
                    fontSize: 12,
                    marginTop: 8,
                  }}
                  numberOfLines={2}
                >
                  {point.address}
                </Text>

                {!!point.routeName && (
                  <Text style={{ color: "#334155", fontSize: 12, marginTop: 8 }}>
                    Rota: {point.routeName}
                  </Text>
                )}

                {!!point.driverName && (
                  <Text style={{ color: "#334155", fontSize: 12, marginTop: 4 }}>
                    Motorista: {point.driverName}
                  </Text>
                )}

                {!!point.vehicleLabel && (
                  <Text style={{ color: "#334155", fontSize: 12, marginTop: 4 }}>
                    Veículo: {point.vehicleLabel}
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
            </View>
          )}
        </View>
      </View>
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
        width: 148,
        backgroundColor: active ? color : "#FFFFFF",
        borderRadius: 18,
        padding: 14,
        marginRight: 10,
        borderWidth: 1,
        borderColor: active ? color : "#E5E7EB",
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: "700",
          color: active ? "#FFFFFF" : "#64748B",
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          fontSize: 24,
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