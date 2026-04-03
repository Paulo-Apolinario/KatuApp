import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/src/contexts/AuthContext";
import {
  routeService,
  type RouteItem,
  translateRouteStatus,
} from "@/src/services/routeService";
import {
  vehicleService,
  type Vehicle,
  translateVehicleStatus,
} from "@/src/services/vehicleService";
import {
  collectionService,
  type Collection,
  translateCollectionStatus,
} from "@/src/services/collectionService";
import {
  driverService,
  type DriverProfile,
} from "@/src/services/driverService";
import { MotoristaGreenHeader } from "@/src/components/MotoristaGreenHeader";

type MarkerPoint = {
  id: string;
  title: string;
  description?: string;
  latitude: number;
  longitude: number;
  type: "cooperative" | "collection" | "driver";
};

type Coordinates = {
  latitude: number;
  longitude: number;
};

function InfoCard({
  title,
  children,
  rightAction,
}: {
  title: string;
  children: React.ReactNode;
  rightAction?: React.ReactNode;
}) {
  return (
    <View
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: "#F1F5F9",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <Text style={{ color: "#111827", fontSize: 16, fontWeight: "800" }}>
          {title}
        </Text>
        {rightAction}
      </View>

      <View>{children}</View>
    </View>
  );
}

function SummaryLine({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <Text style={{ color: "#4B5563", lineHeight: 22 }}>
      {label}: {value}
    </Text>
  );
}

function getInitialRegion(points: MarkerPoint[]) {
  const first = points[0] || {
    latitude: -3.7319,
    longitude: -38.5267,
  };

  return {
    latitude: first.latitude,
    longitude: first.longitude,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };
}

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

function isValidCoordinate(latitude?: any, longitude?: any) {
  return (
    latitude != null &&
    longitude != null &&
    !isNaN(Number(latitude)) &&
    !isNaN(Number(longitude))
  );
}

export default function MotoristaMapaScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ routeId?: string; collectionId?: string }>();
  const driverId = user?.driver?.id ?? null;

  const mapRef = useRef<MapView | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteItem | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(
    null
  );
  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadMapData = useCallback(
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

        const [activeRoutes, currentVehicle, driverCollections, myProfile] =
          await Promise.all([
            routeService.listActiveByDriver(driverId),
            vehicleService.getCurrentByDriver(driverId),
            collectionService.listByDriver(driverId),
            driverService.getMyProfile(),
          ]);

        setRoutes(activeRoutes);
        setVehicle(currentVehicle);
        setCollections(driverCollections);
        setProfile(myProfile);

        const highlightedRouteId = params.routeId ? String(params.routeId) : null;
        const highlightedCollectionId = params.collectionId
          ? String(params.collectionId)
          : null;

        let nextRoute: RouteItem | null = null;
        let nextCollection: Collection | null = null;

        if (highlightedRouteId) {
          try {
            nextRoute = await routeService.getById(highlightedRouteId);
            nextCollection =
              nextRoute.collections?.find((item) => item.id === highlightedCollectionId) ??
              nextRoute.collections?.[0] ??
              null;
          } catch {
            nextRoute =
              activeRoutes.find((item) => item.id === highlightedRouteId) ?? null;
          }
        } else if (activeRoutes.length > 0) {
          try {
            nextRoute = await routeService.getById(activeRoutes[0].id);
            nextCollection = nextRoute.collections?.[0] ?? null;
          } catch {
            nextRoute = activeRoutes[0];
          }
        }

        setSelectedRoute(nextRoute);
        setSelectedCollection(nextCollection);

        const permission = await Location.requestForegroundPermissionsAsync();

        if (permission.status === "granted") {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });

          setCurrentLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        }
      } catch (err: any) {
        setError(err?.message || "Não foi possível carregar os dados do mapa.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [driverId, params.collectionId, params.routeId]
  );

  useFocusEffect(
    useCallback(() => {
      void loadMapData();
    }, [loadMapData])
  );

  const cooperativeMarker = useMemo<MarkerPoint | null>(() => {
    if (
      !isValidCoordinate(
        profile?.cooperative?.latitude,
        profile?.cooperative?.longitude
      )
    ) {
      return null;
    }

    return {
      id: profile!.cooperative.id,
      title: profile!.cooperative.name,
      description: profile!.cooperative.address || "Cooperativa",
      latitude: Number(profile!.cooperative.latitude),
      longitude: Number(profile!.cooperative.longitude),
      type: "cooperative",
    };
  }, [profile]);

  const collectionMarkers = useMemo<MarkerPoint[]>(() => {
    return collections
      .filter((item) =>
        isValidCoordinate(item.generator?.latitude, item.generator?.longitude)
      )
      .map((item) => ({
        id: item.id,
        title:
          item.generator?.companyName || item.generator?.name || "Ponto de coleta",
        description: item.generator?.address || "Endereço não informado",
        latitude: Number(item.generator?.latitude),
        longitude: Number(item.generator?.longitude),
        type: "collection" as const,
      }));
  }, [collections]);

  const driverMarker = useMemo<MarkerPoint | null>(() => {
    if (!currentLocation) return null;

    return {
      id: "driver-current-location",
      title: "Minha localização",
      description: "Posição atual do motorista",
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      type: "driver",
    };
  }, [currentLocation]);

  const allMarkers = useMemo(() => {
    const items: MarkerPoint[] = [];

    if (driverMarker) items.push(driverMarker);
    if (cooperativeMarker) items.push(cooperativeMarker);
    items.push(...collectionMarkers);

    return items;
  }, [driverMarker, cooperativeMarker, collectionMarkers]);

  const selectedRouteCoordinates = useMemo<Coordinates[]>(() => {
    const coordinates: Coordinates[] = [];

    if (currentLocation) {
      coordinates.push({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
      });
    }

    if (cooperativeMarker) {
      coordinates.push({
        latitude: cooperativeMarker.latitude,
        longitude: cooperativeMarker.longitude,
      });
    }

    if (selectedRoute?.collections?.length) {
      selectedRoute.collections.forEach((item) => {
        if (
          isValidCoordinate(item.generator?.latitude, item.generator?.longitude)
        ) {
          coordinates.push({
            latitude: Number(item.generator?.latitude),
            longitude: Number(item.generator?.longitude),
          });
        }
      });
    }

    return coordinates;
  }, [currentLocation, cooperativeMarker, selectedRoute]);

  const polylineCoordinates = useMemo(() => {
    if (selectedRouteCoordinates.length >= 2) {
      return selectedRouteCoordinates;
    }

    const fallback = allMarkers.map((item) => ({
      latitude: item.latitude,
      longitude: item.longitude,
    }));

    return fallback.length >= 2 ? fallback : [];
  }, [allMarkers, selectedRouteCoordinates]);

  const focusMapOnCoordinates = useCallback((coords: Coordinates[]) => {
    if (!mapRef.current || coords.length === 0) return;

    if (coords.length === 1) {
      mapRef.current.animateToRegion(
        {
          latitude: coords[0].latitude,
          longitude: coords[0].longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        500
      );
      return;
    }

    mapRef.current.fitToCoordinates(coords, {
      edgePadding: {
        top: 80,
        right: 60,
        bottom: 80,
        left: 60,
      },
      animated: true,
    });
  }, []);

  const handleFocusSelectedRoute = useCallback(() => {
    if (selectedRouteCoordinates.length > 0) {
      focusMapOnCoordinates(selectedRouteCoordinates);
    }
  }, [focusMapOnCoordinates, selectedRouteCoordinates]);

  const handleFocusAll = useCallback(() => {
    const coords = allMarkers.map((item) => ({
      latitude: item.latitude,
      longitude: item.longitude,
    }));
    focusMapOnCoordinates(coords);
  }, [allMarkers, focusMapOnCoordinates]);

  const handleSelectCollection = useCallback(
    async (collection: Collection | null) => {
      setSelectedCollection(collection);

      if (collection?.routeId) {
        try {
          const detail = await routeService.getById(collection.routeId);
          setSelectedRoute(detail);
        } catch {}
      }

      if (
        collection?.generator &&
        isValidCoordinate(collection.generator.latitude, collection.generator.longitude)
      ) {
        focusMapOnCoordinates([
          {
            latitude: Number(collection.generator.latitude),
            longitude: Number(collection.generator.longitude),
          },
        ]);
      }
    },
    [focusMapOnCoordinates]
  );

  const handleSelectRoute = useCallback(
    async (route: RouteItem) => {
      try {
        const detail = await routeService.getById(route.id);
        setSelectedRoute(detail);
        setSelectedCollection(detail.collections?.[0] ?? null);

        const coords: Coordinates[] = [];

        if (currentLocation) {
          coords.push(currentLocation);
        }

        if (cooperativeMarker) {
          coords.push({
            latitude: cooperativeMarker.latitude,
            longitude: cooperativeMarker.longitude,
          });
        }

        detail.collections?.forEach((item) => {
          if (
            isValidCoordinate(item.generator?.latitude, item.generator?.longitude)
          ) {
            coords.push({
              latitude: Number(item.generator?.latitude),
              longitude: Number(item.generator?.longitude),
            });
          }
        });

        focusMapOnCoordinates(coords);
      } catch {
        setSelectedRoute(route);
      }
    },
    [cooperativeMarker, currentLocation, focusMapOnCoordinates]
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
          Carregando dados do mapa...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
      <MotoristaGreenHeader
        title="Mapa"
        subtitle="Visão geográfica das rotas e pontos operacionais"
        onBack={() => router.back()}
        rightAction={
          <TouchableOpacity
            onPress={() => void loadMapData(true)}
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
            <Ionicons name="refresh" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={{
          padding: 18,
          paddingBottom: 30,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadMapData(true)}
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

        <View
          style={{
            height: 340,
            borderRadius: 22,
            overflow: "hidden",
            marginBottom: 14,
            borderWidth: 1,
            borderColor: "#E5E7EB",
            backgroundColor: "#FFFFFF",
          }}
        >
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={{ flex: 1 }}
            initialRegion={getInitialRegion(allMarkers)}
            showsUserLocation
            showsMyLocationButton
            toolbarEnabled={false}
          >
            {driverMarker && (
              <Marker
                coordinate={{
                  latitude: driverMarker.latitude,
                  longitude: driverMarker.longitude,
                }}
                title={driverMarker.title}
                description={driverMarker.description}
                pinColor="blue"
              />
            )}

            {cooperativeMarker && (
              <Marker
                coordinate={{
                  latitude: cooperativeMarker.latitude,
                  longitude: cooperativeMarker.longitude,
                }}
                title={cooperativeMarker.title}
                description={cooperativeMarker.description}
                pinColor="green"
              />
            )}

            {collectionMarkers.map((item) => (
              <Marker
                key={item.id}
                coordinate={{
                  latitude: item.latitude,
                  longitude: item.longitude,
                }}
                title={item.title}
                description={item.description}
                onPress={() => {
                  const collection = collections.find((c) => c.id === item.id) || null;
                  void handleSelectCollection(collection);
                }}
              />
            ))}

            {polylineCoordinates.length >= 2 && (
              <Polyline
                coordinates={polylineCoordinates}
                strokeWidth={4}
                lineCap="round"
                lineJoin="round"
              />
            )}
          </MapView>
        </View>

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <TouchableOpacity
            onPress={handleFocusAll}
            style={{
              backgroundColor: "#ECFDF5",
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: "#047857", fontWeight: "800" }}>
              VER TODOS OS PONTOS
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleFocusSelectedRoute}
            style={{
              backgroundColor: "#D1FAE5",
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: "#065F46", fontWeight: "800" }}>
              FOCAR ROTA
            </Text>
          </TouchableOpacity>
        </View>

        <InfoCard title="Resumo geográfico">
          <SummaryLine label="Rotas ativas" value={routes.length} />
          <SummaryLine label="Coletas carregadas" value={collections.length} />
          <SummaryLine label="Pontos com coordenadas" value={collectionMarkers.length} />
          <SummaryLine
            label="Veículo atual"
            value={
              vehicle
                ? `${vehicle.plate} • ${translateVehicleStatus(vehicle.status)}`
                : "Não vinculado"
            }
          />
          <SummaryLine
            label="Posição atual"
            value={
              currentLocation
                ? `${currentLocation.latitude.toFixed(5)}, ${currentLocation.longitude.toFixed(5)}`
                : "Não disponível"
            }
          />
        </InfoCard>

        <InfoCard title="Rotas carregadas">
          {routes.length === 0 ? (
            <Text style={{ color: "#6B7280", lineHeight: 22 }}>
              Nenhuma rota ativa encontrada.
            </Text>
          ) : (
            routes.map((route) => {
              const isSelected = selectedRoute?.id === route.id;

              return (
                <TouchableOpacity
                  key={route.id}
                  onPress={() => void handleSelectRoute(route)}
                  style={{
                    borderWidth: 1,
                    borderColor: isSelected ? "#86EFAC" : "#E5E7EB",
                    borderRadius: 14,
                    padding: 12,
                    marginBottom: 10,
                    backgroundColor: isSelected ? "#F0FDF4" : "#FFFFFF",
                  }}
                >
                  <Text style={{ color: "#111827", fontWeight: "800" }}>
                    {route.name}
                  </Text>

                  <Text style={{ color: "#6B7280", marginTop: 4 }}>
                    Status: {translateRouteStatus(route.status)}
                  </Text>

                  <Text style={{ color: "#6B7280", marginTop: 4 }}>
                    Paradas: {route.stops?.length || 0}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </InfoCard>

        {selectedRoute && (
          <InfoCard
            title="Rota selecionada"
            rightAction={
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/(motorista)/rotas",
                    params: { highlightRouteId: selectedRoute.id },
                  })
                }
              >
                <Text style={{ color: "#028C56", fontWeight: "800", fontSize: 12 }}>
                  VER TELA
                </Text>
              </TouchableOpacity>
            }
          >
            <Text style={{ color: "#111827", fontWeight: "800", fontSize: 15 }}>
              {selectedRoute.name}
            </Text>

            <Text style={{ color: "#6B7280", lineHeight: 22, marginTop: 8 }}>
              Status: {translateRouteStatus(selectedRoute.status)}
            </Text>

            <Text style={{ color: "#6B7280", lineHeight: 22 }}>
              Data:{" "}
              {selectedRoute.scheduledDate
                ? new Date(selectedRoute.scheduledDate).toLocaleString("pt-BR")
                : "Não definida"}
            </Text>

            <Text style={{ color: "#6B7280", lineHeight: 22 }}>
              Veículo:{" "}
              {selectedRoute.vehicle?.plate
                ? `${selectedRoute.vehicle.plate} • ${selectedRoute.vehicle.model || ""}`
                : "Não vinculado"}
            </Text>

            <Text style={{ color: "#6B7280", lineHeight: 22 }}>
              Coletas: {selectedRoute.collections?.length || 0}
            </Text>

            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 10,
                marginTop: 12,
              }}
            >
              <TouchableOpacity
                onPress={handleFocusSelectedRoute}
                style={{
                  backgroundColor: "#ECFDF5",
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 12,
                }}
              >
                <Text style={{ color: "#047857", fontWeight: "800" }}>
                  FOCAR NO MAPA
                </Text>
              </TouchableOpacity>

              {!!selectedCollection?.generator?.latitude &&
                !!selectedCollection?.generator?.longitude && (
                  <TouchableOpacity
                    onPress={() =>
                      openExternalNavigation({
                        latitude: Number(selectedCollection.generator?.latitude),
                        longitude: Number(selectedCollection.generator?.longitude),
                        originLatitude: currentLocation?.latitude,
                        originLongitude: currentLocation?.longitude,
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
          </InfoCard>
        )}

        {selectedCollection && (
          <InfoCard title="Coleta selecionada">
            <Text style={{ color: "#111827", fontWeight: "800", fontSize: 15 }}>
              {selectedCollection.generator?.companyName ||
                selectedCollection.generator?.name ||
                "Ponto de coleta"}
            </Text>

            <Text style={{ color: "#6B7280", lineHeight: 22, marginTop: 8 }}>
              Status: {translateCollectionStatus(selectedCollection.status)}
            </Text>

            <Text style={{ color: "#6B7280", lineHeight: 22 }}>
              Endereço: {selectedCollection.generator?.address || "Não informado"}
            </Text>

            <Text style={{ color: "#6B7280", lineHeight: 22 }}>
              Rota: {selectedCollection.route?.name || selectedRoute?.name || "Não vinculada"}
            </Text>

            {selectedCollection.generator?.latitude != null &&
              selectedCollection.generator?.longitude != null && (
                <TouchableOpacity
                  onPress={() =>
                    openExternalNavigation({
                      latitude: Number(selectedCollection.generator?.latitude),
                      longitude: Number(selectedCollection.generator?.longitude),
                      originLatitude: currentLocation?.latitude,
                      originLongitude: currentLocation?.longitude,
                    })
                  }
                  style={{
                    marginTop: 12,
                    alignSelf: "flex-start",
                    backgroundColor: "#028C56",
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 12,
                  }}
                >
                  <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>
                    ABRIR NAVEGAÇÃO
                  </Text>
                </TouchableOpacity>
              )}
          </InfoCard>
        )}
      </ScrollView>
    </View>
  );
}