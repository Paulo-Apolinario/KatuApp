import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
  collectionService,
  type Collection,
  type CollectionMaterial,
  type WasteUnit,
} from "@/src/services/collectionService";
import { useNotification } from "@/src/contexts/NotificationContext";

type CollectionStatus = Collection["status"];

type MapFilter = "ACTIVE" | "PENDING" | "IN_PROGRESS" | "FINISHED";

type Coordinates = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type MapPoint = {
  id: string;
  title: string;
  address: string;
  latitude: number;
  longitude: number;
  status: CollectionStatus;
  routeName?: string | null;
  driverName?: string | null;
  vehicleLabel?: string | null;
  phone?: string | null;
  materials: CollectionMaterial[];
  estimatedWeightKg: number;
  collection: Collection;
  distanceKm: number | null;
};

const INITIAL_REGION: Coordinates = {
  latitude: -3.7319,
  longitude: -38.5267,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const ACTIVE_STATUSES: CollectionStatus[] = [
  "PENDING",
  "IN_PROGRESS",
];

const FINISHED_STATUSES: CollectionStatus[] = [
  "COLLECTED",
  "RECEIVED",
  "SORTING",
  "COMPLETED",
];

function safeNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function hasValidCoordinates(
  latitude?: number | null,
  longitude?: number | null
) {
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  );
}

function normalizeUnit(value: unknown): WasteUnit {
  const normalized = String(value || "KG").toUpperCase();

  if (
    normalized === "KG" ||
    normalized === "TON" ||
    normalized === "LITER" ||
    normalized === "UNIT" ||
    normalized === "CUBIC_METER"
  ) {
    return normalized;
  }

  return "KG";
}

function quantityToKg(quantity: number, unit: WasteUnit) {
  if (unit === "TON") return quantity * 1000;
  if (unit === "KG") return quantity;
  return 0;
}

function normalizeMaterials(value: unknown): CollectionMaterial[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): CollectionMaterial | null => {
      if (typeof item === "string") {
        const name = item.trim();
        if (!name) return null;

        return {
          type: name,
          name,
          quantity: 0,
          quantityKg: 0,
          unit: "KG",
        };
      }

      if (!item || typeof item !== "object") return null;

      const material = item as Record<string, unknown>;
      const name = String(
        material.name ??
          material.type ??
          material.nameSnapshot ??
          material.materialNameSnapshot ??
          "Material"
      ).trim();

      const unit = normalizeUnit(material.unit);
      const quantity =
        material.quantity !== undefined
          ? safeNumber(material.quantity)
          : material.estimatedQuantity !== undefined
            ? safeNumber(material.estimatedQuantity)
            : safeNumber(material.quantityKg);

      const quantityKg =
        material.quantityKg !== undefined
          ? safeNumber(material.quantityKg)
          : quantityToKg(quantity, unit);

      return {
        wasteTypeId:
          typeof material.wasteTypeId === "string"
            ? material.wasteTypeId
            : null,
        type: name,
        name,
        category:
          typeof material.category === "string"
            ? material.category
            : null,
        subcategory:
          typeof material.subcategory === "string"
            ? material.subcategory
            : null,
        quantity,
        quantityKg,
        unit,
        notes:
          typeof material.notes === "string"
            ? material.notes
            : null,
      };
    })
    .filter((item): item is CollectionMaterial => item !== null);
}

function getCollectionGenerator(collection?: Collection | null) {
  if (!collection) return null;
  return collection.generator ?? collection.schedule?.generator ?? null;
}


function getCollectionContactPhone(
  collection: Collection,
  generator: NonNullable<ReturnType<typeof getCollectionGenerator>>
) {
  const generatorRecord =
    generator as unknown as Record<string, unknown>;

  const requestedByRecord =
    collection.schedule?.requestedBy
      ? (collection.schedule.requestedBy as unknown as Record<
          string,
          unknown
        >)
      : null;

  const generatorPhone =
    typeof generatorRecord.phone === "string"
      ? generatorRecord.phone.trim()
      : "";

  const requestedByPhone =
    typeof requestedByRecord?.phone === "string"
      ? requestedByRecord.phone.trim()
      : "";

  return generatorPhone || requestedByPhone || null;
}

function getCollectionMaterials(collection: Collection) {
  const collected = normalizeMaterials(collection.materials);
  if (collected.length > 0) return collected;

  const requested = normalizeMaterials(
    collection.schedule?.requestedMaterials
  );

  if (requested.length > 0) return requested;

  return normalizeMaterials(collection.collectionMaterials);
}

function getEstimatedWeightKg(collection: Collection) {
  const totalWeight = safeNumber(collection.totalWeightKg);

  if (totalWeight > 0) {
    return totalWeight;
  }

  return getCollectionMaterials(collection).reduce(
    (sum, material) =>
      sum +
      (safeNumber(material.quantityKg) ||
        quantityToKg(
          safeNumber(material.quantity),
          material.unit || "KG"
        )),
    0
  );
}

function getStatusColor(status: CollectionStatus) {
  switch (status) {
    case "PENDING":
      return "#2563EB";
    case "IN_PROGRESS":
      return "#F59E0B";
    case "COLLECTED":
      return "#0EA5E9";
    case "RECEIVED":
      return "#3B82F6";
    case "SORTING":
      return "#8B5CF6";
    case "COMPLETED":
      return "#16A34A";
    case "CANCELLED":
      return "#DC2626";
    default:
      return "#64748B";
  }
}

function getStatusIcon(
  status: CollectionStatus
): keyof typeof Ionicons.glyphMap {
  switch (status) {
    case "PENDING":
      return "time-outline";
    case "IN_PROGRESS":
      return "navigate-outline";
    case "COLLECTED":
      return "bag-check-outline";
    case "RECEIVED":
      return "download-outline";
    case "SORTING":
      return "git-compare-outline";
    case "COMPLETED":
      return "checkmark-done-outline";
    case "CANCELLED":
      return "close-circle-outline";
    default:
      return "ellipse-outline";
  }
}

function translateStatus(status: CollectionStatus) {
  switch (status) {
    case "PENDING":
      return "Pendente";
    case "IN_PROGRESS":
      return "Em andamento";
    case "COLLECTED":
      return "Coletada";
    case "RECEIVED":
      return "Recebida";
    case "SORTING":
      return "Em triagem";
    case "COMPLETED":
      return "Concluída";
    case "CANCELLED":
      return "Cancelada";
    default:
      return status;
  }
}

function formatUnit(unit?: WasteUnit | null) {
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

function formatMaterials(materials: CollectionMaterial[]) {
  if (materials.length === 0) return "Não informado";

  return materials
    .map((item) => {
      const quantity =
        safeNumber(item.quantity) ||
        safeNumber(item.quantityKg);

      return `${item.name || item.type || "Material"}${
        quantity > 0
          ? ` • ${quantity.toFixed(1)} ${formatUnit(item.unit)}`
          : ""
      }`;
    })
    .join("\n");
}

function calculateDistanceKm(
  origin: Coordinates,
  destination: {
    latitude: number;
    longitude: number;
  }
) {
  const earthRadiusKm = 6371;
  const toRadians = (value: number) =>
    (value * Math.PI) / 180;

  const latitudeDifference = toRadians(
    destination.latitude - origin.latitude
  );
  const longitudeDifference = toRadians(
    destination.longitude - origin.longitude
  );

  const originLatitude = toRadians(origin.latitude);
  const destinationLatitude = toRadians(
    destination.latitude
  );

  const a =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.sin(longitudeDifference / 2) ** 2 *
      Math.cos(originLatitude) *
      Math.cos(destinationLatitude);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

function normalizePhone(phone?: string | null) {
  if (!phone) return null;

  const digits = phone.replace(/\D/g, "");

  if (!digits) return null;

  return digits.startsWith("55") ? digits : `55${digits}`;
}

export default function CatadorMapScreen() {
  const { isOffline } = useConnectivity();
  const { notifyError } = useNotification();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [region, setRegion] = useState(INITIAL_REGION);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<MapFilter>("ACTIVE");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  const loadLocation = useCallback(async () => {
    try {
      const { status } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        notifyError(
          "Localização necessária",
          "Permita o acesso à localização para exibir sua posição e calcular as rotas."
        );
        return;
      }

      const position =
        await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

      setRegion({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      });
    } catch (error) {
      console.error(
        "Erro ao carregar localização do catador:",
        error
      );
      notifyError(
        "Erro",
        "Não foi possível obter sua localização atual."
      );
    }
  }, [notifyError]);

  const loadCollections = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) {
          setLoading(true);
        }

        const data = await collectionService.list();
        const nextCollections = Array.isArray(data) ? data : [];

        setCollections(nextCollections);
        setLastSyncAt(new Date().toISOString());

        setSelectedId((currentId) =>
          currentId &&
          nextCollections.some((item) => item.id === currentId)
            ? currentId
            : null
        );
      } catch (error) {
        console.error(
          "Erro ao carregar mapa do catador:",
          error
        );
        notifyError(
          "Erro",
          "Não foi possível carregar o mapa do catador."
        );
        setCollections([]);
      } finally {
        if (showLoader) {
          setLoading(false);
        }

        setRefreshing(false);
      }
    },
    [notifyError]
  );

  const refreshAll = useCallback(async () => {
    try {
      setRefreshing(true);

      await Promise.all([
        loadLocation(),
        loadCollections(false),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [loadCollections, loadLocation]);

  useFocusEffect(
    useCallback(() => {
      void loadCollections(true);
    }, [loadCollections])
  );

  useEffect(() => {
    void loadLocation();
  }, [loadLocation]);

  const allPoints = useMemo(() => {
    return collections
      .map((collection): MapPoint | null => {
        const generator =
          getCollectionGenerator(collection);

        if (
          !generator ||
          !hasValidCoordinates(
            generator.latitude,
            generator.longitude
          )
        ) {
          return null;
        }

        const latitude = Number(generator.latitude);
        const longitude = Number(generator.longitude);

        return {
          id: collection.id,
          title:
            generator.companyName ||
            generator.businessName ||
            generator.name ||
            "Coleta operacional",
          address:
            generator.address ||
            "Endereço não informado",
          latitude,
          longitude,
          status: collection.status,
          routeName: collection.route?.name || null,
          driverName: collection.driver?.name || null,
          vehicleLabel: collection.vehicle
            ? `${collection.vehicle.model || "Veículo"}${
                collection.vehicle.plate
                  ? ` • ${collection.vehicle.plate}`
                  : ""
              }`
            : null,
          phone: getCollectionContactPhone(
            collection,
            generator
          ),
          materials: getCollectionMaterials(collection),
          estimatedWeightKg:
            getEstimatedWeightKg(collection),
          collection,
          distanceKm: calculateDistanceKm(region, {
            latitude,
            longitude,
          }),
        };
      })
      .filter((item): item is MapPoint => item !== null);
  }, [collections, region]);

  const filteredPoints = useMemo(() => {
    if (filter === "ACTIVE") {
      return allPoints.filter((point) =>
        ACTIVE_STATUSES.includes(point.status)
      );
    }

    if (filter === "PENDING") {
      return allPoints.filter(
        (point) => point.status === "PENDING"
      );
    }

    if (filter === "IN_PROGRESS") {
      return allPoints.filter(
        (point) => point.status === "IN_PROGRESS"
      );
    }

    return allPoints.filter((point) =>
      FINISHED_STATUSES.includes(point.status)
    );
  }, [allPoints, filter]);

  const orderedPoints = useMemo(() => {
    return [...filteredPoints].sort((a, b) => {
      if (a.status === "IN_PROGRESS" && b.status !== "IN_PROGRESS") {
        return -1;
      }

      if (b.status === "IN_PROGRESS" && a.status !== "IN_PROGRESS") {
        return 1;
      }

      return (
        (a.distanceKm ?? Number.MAX_SAFE_INTEGER) -
        (b.distanceKm ?? Number.MAX_SAFE_INTEGER)
      );
    });
  }, [filteredPoints]);

  const selected = useMemo(() => {
    return (
      allPoints.find((point) => point.id === selectedId) ||
      orderedPoints[0] ||
      null
    );
  }, [allPoints, orderedPoints, selectedId]);

  const selectedLine = useMemo(() => {
    if (!selected) return [];

    return [
      {
        latitude: region.latitude,
        longitude: region.longitude,
      },
      {
        latitude: selected.latitude,
        longitude: selected.longitude,
      },
    ];
  }, [region, selected]);

  const routeCoordinates = useMemo(() => {
    if (selectedLine.length > 0) {
      return selectedLine;
    }

    if (orderedPoints.length === 0) {
      return [];
    }

    return [
      {
        latitude: region.latitude,
        longitude: region.longitude,
      },
      ...orderedPoints.map((point) => ({
        latitude: point.latitude,
        longitude: point.longitude,
      })),
    ];
  }, [orderedPoints, region, selectedLine]);

  const routeMetrics = useMemo(() => {
    const totalWeightKg = orderedPoints.reduce(
      (sum, point) => sum + point.estimatedWeightKg,
      0
    );

    let totalDistanceKm = 0;
    let currentLatitude = region.latitude;
    let currentLongitude = region.longitude;

    orderedPoints.forEach((point) => {
      totalDistanceKm += calculateDistanceKm(
        {
          latitude: currentLatitude,
          longitude: currentLongitude,
          latitudeDelta: region.latitudeDelta,
          longitudeDelta: region.longitudeDelta,
        },
        {
          latitude: point.latitude,
          longitude: point.longitude,
        }
      );

      currentLatitude = point.latitude;
      currentLongitude = point.longitude;
    });

    const estimatedMinutes =
      totalDistanceKm > 0
        ? Math.max(1, Math.round((totalDistanceKm / 30) * 60))
        : 0;

    return {
      totalCollections: orderedPoints.length,
      totalWeightKg,
      totalDistanceKm,
      estimatedMinutes,
    };
  }, [orderedPoints, region]);

  const statusCounts = useMemo(() => {
    return {
      pending: allPoints.filter(
        (point) => point.status === "PENDING"
      ).length,
      inProgress: allPoints.filter(
        (point) => point.status === "IN_PROGRESS"
      ).length,
      finished: allPoints.filter((point) =>
        FINISHED_STATUSES.includes(point.status)
      ).length,
    };
  }, [allPoints]);

  const openExternalRoute = useCallback(async () => {
    if (!selected) return;

    try {
      const destination = `${selected.latitude},${selected.longitude}`;
      const googleMapsWebUrl =
        `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
      const appleMapsUrl =
        `http://maps.apple.com/?daddr=${destination}&dirflg=d`;

      const urlToOpen =
        Platform.OS === "ios"
          ? appleMapsUrl
          : googleMapsWebUrl;

      const supported =
        await Linking.canOpenURL(urlToOpen);

      if (!supported) {
        notifyError(
          "Erro",
          "Não foi possível abrir o aplicativo de mapas."
        );
        return;
      }

      await Linking.openURL(urlToOpen);
    } catch (error) {
      console.error(
        "Erro ao abrir rota externa:",
        error
      );
      notifyError(
        "Erro",
        "Não foi possível abrir a rota externa."
      );
    }
  }, [notifyError, selected]);

  const openPhone = useCallback(async () => {
    const phone = normalizePhone(selected?.phone);

    if (!phone) {
      notifyError(
        "Telefone indisponível",
        "Não há telefone cadastrado para este gerador."
      );
      return;
    }

    const url = `tel:${phone}`;

    try {
      const supported = await Linking.canOpenURL(url);

      if (!supported) {
        notifyError(
          "Erro",
          "Não foi possível abrir o telefone."
        );
        return;
      }

      await Linking.openURL(url);
    } catch (error) {
      console.error("Erro ao abrir telefone:", error);
      notifyError(
        "Erro",
        "Não foi possível iniciar a ligação."
      );
    }
  }, [notifyError, selected]);

  const openWhatsApp = useCallback(async () => {
    const phone = normalizePhone(selected?.phone);

    if (!phone) {
      notifyError(
        "WhatsApp indisponível",
        "Não há telefone cadastrado para este gerador."
      );
      return;
    }

    const message = encodeURIComponent(
      `Olá! Sou o catador responsável pela coleta do KATUÁ para ${selected?.title || "seu estabelecimento"}.`
    );

    const url = `https://wa.me/${phone}?text=${message}`;

    try {
      const supported = await Linking.canOpenURL(url);

      if (!supported) {
        notifyError(
          "Erro",
          "Não foi possível abrir o WhatsApp."
        );
        return;
      }

      await Linking.openURL(url);
    } catch (error) {
      console.error("Erro ao abrir WhatsApp:", error);
      notifyError(
        "Erro",
        "Não foi possível abrir o WhatsApp."
      );
    }
  }, [notifyError, selected]);

  const openCollection = useCallback(() => {
    if (!selected) return;

    router.push({
      pathname: "/(catador)/collect",
      params: {
        collectionId: selected.id,
      },
    });
  }, [selected]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#F3F4F6",
      }}
    >
      <LinearGradient
        colors={["#16A34A", "#22C55E"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          paddingTop: 48,
          paddingBottom: 20,
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
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              flex: 1,
            }}
          >
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.back()}
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor:
                  "rgba(255,255,255,0.16)",
                marginRight: 12,
              }}
            >
              <Ionicons
                name="arrow-back"
                size={22}
                color="#FFFFFF"
              />
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: "900",
                  color: "#FFFFFF",
                }}
              >
                MAPA OPERACIONAL
              </Text>

              <Text
                style={{
                  fontSize: 13,
                  color: "#E8FFF1",
                  marginTop: 4,
                  lineHeight: 18,
                }}
              >
                Localização, coletas e deslocamento do catador
              </Text>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => void refreshAll()}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor:
                "rgba(255,255,255,0.18)",
              alignItems: "center",
              justifyContent: "center",
              marginLeft: 12,
            }}
          >
            {refreshing ? (
              <ActivityIndicator
                size="small"
                color="#FFFFFF"
              />
            ) : (
              <Ionicons
                name="refresh-outline"
                size={22}
                color="#FFFFFF"
              />
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 14,
          }}
        >
          <OfflineBanner visible={isOffline} />
        </View>

        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 12,
          }}
        >
          <LastSyncBadge value={lastSyncAt} />
        </View>

        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 14,
          }}
        >
          <FilterBar
            filter={filter}
            onChange={setFilter}
            pending={statusCounts.pending}
            inProgress={statusCounts.inProgress}
            finished={statusCounts.finished}
          />
        </View>

        <View
          style={{
            marginTop: 14,
            marginHorizontal: 16,
            borderRadius: 22,
            overflow: "hidden",
            backgroundColor: "#FFFFFF",
            borderWidth: 1,
            borderColor: "#E5E7EB",
          }}
        >
          {loading ? (
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                minHeight: 360,
              }}
            >
              <ActivityIndicator
                size="large"
                color="#028C56"
              />

              <Text
                style={{
                  marginTop: 10,
                  color: "#64748B",
                }}
              >
                Carregando mapa...
              </Text>
            </View>
          ) : filteredPoints.length === 0 ? (
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                minHeight: 360,
                paddingHorizontal: 24,
              }}
            >
              <Ionicons
                name="map-outline"
                size={48}
                color="#94A3B8"
              />

              <Text
                style={{
                  marginTop: 12,
                  fontSize: 17,
                  fontWeight: "800",
                  color: "#0F172A",
                  textAlign: "center",
                }}
              >
                Nenhuma coleta encontrada
              </Text>

              <Text
                style={{
                  marginTop: 6,
                  fontSize: 13,
                  color: "#64748B",
                  textAlign: "center",
                  lineHeight: 19,
                }}
              >
                Não há coletas com coordenadas válidas para o filtro selecionado.
              </Text>
            </View>
          ) : (
            <OperationalMap
              baseLatitude={region.latitude}
              baseLongitude={region.longitude}
              points={filteredPoints.map((point) => ({
                id: point.id,
                latitude: point.latitude,
                longitude: point.longitude,
                title: point.title,
                description: `${translateStatus(point.status)} • ${point.address}`,
                color: getStatusColor(point.status),
              }))}
              routeCoordinates={routeCoordinates}
              selectedPointId={selected?.id ?? null}
              onSelectPoint={(pointId: string) => {
                if (pointId === "__base__") {
                  setSelectedId(null);
                  return;
                }

                setSelectedId(pointId);
              }}
            />
          )}
        </View>

        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 14,
          }}
        >
          <RouteSummaryCard
            totalCollections={routeMetrics.totalCollections}
            totalWeightKg={routeMetrics.totalWeightKg}
            totalDistanceKm={routeMetrics.totalDistanceKm}
            estimatedMinutes={routeMetrics.estimatedMinutes}
          />
        </View>

        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 14,
          }}
        >
          <SelectedCollectionCard
            selected={selected}
            onOpenRoute={openExternalRoute}
            onOpenCollection={openCollection}
            onCall={openPhone}
            onWhatsApp={openWhatsApp}
          />
        </View>

        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 14,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "900",
              color: "#111827",
              marginBottom: 10,
            }}
          >
            Ordem sugerida
          </Text>

          <Text
            style={{
              fontSize: 13,
              color: "#6B7280",
              lineHeight: 19,
              marginBottom: 10,
            }}
          >
            Coletas ordenadas pela situação operacional e pela distância aproximada.
          </Text>

          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 20,
              padding: 16,
              borderWidth: 1,
              borderColor: "#E5E7EB",
            }}
          >
            {orderedPoints.length > 0 ? (
              orderedPoints.map((point, index) => (
                <RouteOrderItem
                  key={point.id}
                  index={index + 1}
                  point={point}
                  isLast={index === orderedPoints.length - 1}
                  selected={selected?.id === point.id}
                  onPress={() => setSelectedId(point.id)}
                />
              ))
            ) : (
              <View
                style={{
                  alignItems: "center",
                  paddingVertical: 24,
                }}
              >
                <Ionicons
                  name="trail-sign-outline"
                  size={38}
                  color="#9CA3AF"
                />

                <Text
                  style={{
                    marginTop: 10,
                    color: "#6B7280",
                    textAlign: "center",
                  }}
                >
                  Nenhuma coleta disponível para ordenar.
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function FilterBar({
  filter,
  onChange,
  pending,
  inProgress,
  finished,
}: {
  filter: MapFilter;
  onChange: (filter: MapFilter) => void;
  pending: number;
  inProgress: number;
  finished: number;
}) {
  const options: {
    value: MapFilter;
    label: string;
    count: number;
  }[] = [
    {
      value: "ACTIVE",
      label: "Ativas",
      count: pending + inProgress,
    },
    {
      value: "PENDING",
      label: "Pendentes",
      count: pending,
    },
    {
      value: "IN_PROGRESS",
      label: "Em andamento",
      count: inProgress,
    },
    {
      value: "FINISHED",
      label: "Finalizadas",
      count: finished,
    },
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingRight: 8,
      }}
    >
      {options.map((option) => {
        const selected = filter === option.value;

        return (
          <TouchableOpacity
            key={option.value}
            activeOpacity={0.85}
            onPress={() => onChange(option.value)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 999,
              marginRight: 8,
              backgroundColor: selected
                ? "#15803D"
                : "#FFFFFF",
              borderWidth: 1,
              borderColor: selected
                ? "#15803D"
                : "#E5E7EB",
            }}
          >
            <Text
              style={{
                color: selected
                  ? "#FFFFFF"
                  : "#475569",
                fontWeight: "800",
                fontSize: 13,
              }}
            >
              {option.label}
            </Text>

            <View
              style={{
                minWidth: 24,
                height: 24,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                marginLeft: 7,
                backgroundColor: selected
                  ? "rgba(255,255,255,0.2)"
                  : "#F1F5F9",
              }}
            >
              <Text
                style={{
                  color: selected
                    ? "#FFFFFF"
                    : "#475569",
                  fontWeight: "900",
                  fontSize: 12,
                }}
              >
                {option.count}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function RouteSummaryCard({
  totalCollections,
  totalWeightKg,
  totalDistanceKm,
  estimatedMinutes,
}: {
  totalCollections: number;
  totalWeightKg: number;
  totalDistanceKm: number;
  estimatedMinutes: number;
}) {
  return (
    <View
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: "#E5E7EB",
      }}
    >
      <Text
        style={{
          fontSize: 17,
          fontWeight: "900",
          color: "#111827",
        }}
      >
        Resumo da rota
      </Text>

      <Text
        style={{
          fontSize: 13,
          color: "#6B7280",
          marginTop: 4,
          lineHeight: 19,
        }}
      >
        Estimativas calculadas a partir das coletas exibidas no mapa.
      </Text>

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          marginTop: 14,
        }}
      >
        <SummaryMetric
          icon="location-outline"
          label="Coletas"
          value={String(totalCollections)}
        />

        <SummaryMetric
          icon="scale-outline"
          label="Peso previsto"
          value={`${totalWeightKg.toFixed(1)} kg`}
        />

        <SummaryMetric
          icon="navigate-outline"
          label="Distância"
          value={`${totalDistanceKm.toFixed(1)} km`}
        />

        <SummaryMetric
          icon="time-outline"
          label="Tempo estimado"
          value={`${estimatedMinutes} min`}
        />
      </View>
    </View>
  );
}

function SummaryMetric({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View
      style={{
        width: "48.5%",
        backgroundColor: "#F8FAFC",
        borderRadius: 15,
        padding: 13,
        marginBottom: 10,
      }}
    >
      <Ionicons
        name={icon}
        size={19}
        color="#15803D"
      />

      <Text
        style={{
          fontSize: 12,
          color: "#64748B",
          marginTop: 8,
        }}
      >
        {label}
      </Text>

      <Text
        style={{
          fontSize: 16,
          fontWeight: "900",
          color: "#111827",
          marginTop: 3,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function SelectedCollectionCard({
  selected,
  onOpenRoute,
  onOpenCollection,
  onCall,
  onWhatsApp,
}: {
  selected: MapPoint | null;
  onOpenRoute: () => void;
  onOpenCollection: () => void;
  onCall: () => void;
  onWhatsApp: () => void;
}) {
  if (!selected) {
    return (
      <View
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 20,
          padding: 20,
          borderWidth: 1,
          borderColor: "#E5E7EB",
          alignItems: "center",
        }}
      >
        <Ionicons
          name="location-outline"
          size={42}
          color="#94A3B8"
        />

        <Text
          style={{
            fontSize: 16,
            fontWeight: "800",
            color: "#0F172A",
            marginTop: 10,
          }}
        >
          Selecione uma coleta
        </Text>

        <Text
          style={{
            fontSize: 13,
            color: "#64748B",
            textAlign: "center",
            marginTop: 6,
            lineHeight: 19,
          }}
        >
          Toque em um marcador ou em um item da ordem sugerida para visualizar os detalhes.
        </Text>
      </View>
    );
  }

  const statusColor = getStatusColor(selected.status);

  return (
    <View
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: "#E5E7EB",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
        }}
      >
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 23,
            backgroundColor: `${statusColor}18`,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Ionicons
            name={getStatusIcon(selected.status)}
            size={23}
            color={statusColor}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "900",
              color: "#0F172A",
            }}
          >
            {selected.title}
          </Text>

          <Text
            style={{
              fontSize: 13,
              fontWeight: "800",
              color: statusColor,
              marginTop: 4,
            }}
          >
            {translateStatus(selected.status)}
          </Text>
        </View>
      </View>

      <DetailRow
        label="Endereço"
        value={selected.address}
      />

      <DetailRow
        label="Materiais"
        value={formatMaterials(selected.materials)}
      />

      <DetailRow
        label="Peso previsto"
        value={`${selected.estimatedWeightKg.toFixed(1)} kg`}
      />

      <DetailRow
        label="Distância aproximada"
        value={
          selected.distanceKm !== null
            ? `${selected.distanceKm.toFixed(1)} km`
            : "-"
        }
      />

      <DetailRow
        label="Rota"
        value={selected.routeName || "-"}
      />

      <DetailRow
        label="Motorista"
        value={selected.driverName || "-"}
      />

      <DetailRow
        label="Veículo"
        value={selected.vehicleLabel || "-"}
        isLast
      />

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          marginTop: 16,
        }}
      >
        <ActionButton
          icon="navigate-outline"
          label="Traçar rota"
          onPress={onOpenRoute}
          primary
        />

        <ActionButton
          icon="play-circle-outline"
          label={
            selected.status === "PENDING"
              ? "Iniciar coleta"
              : "Abrir coleta"
          }
          onPress={onOpenCollection}
        />

        <ActionButton
          icon="call-outline"
          label="Ligar"
          onPress={onCall}
        />

        <ActionButton
          icon="logo-whatsapp"
          label="WhatsApp"
          onPress={onWhatsApp}
        />
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
      style={{
        marginTop: 13,
        paddingBottom: isLast ? 0 : 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: "#E5E7EB",
      }}
    >
      <Text
        style={{
          fontSize: 12,
          color: "#64748B",
        }}
      >
        {label}
      </Text>

      <Text
        style={{
          fontSize: 14,
          color: "#111827",
          fontWeight: "600",
          marginTop: 4,
          lineHeight: 20,
        }}
      >
        {value || "-"}
      </Text>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  primary = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={{
        width: "48.5%",
        minHeight: 48,
        borderRadius: 13,
        paddingHorizontal: 10,
        paddingVertical: 11,
        marginBottom: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: primary
          ? "#15803D"
          : "#ECFDF5",
        borderWidth: primary ? 0 : 1,
        borderColor: "#86EFAC",
      }}
    >
      <Ionicons
        name={icon}
        size={18}
        color={primary ? "#FFFFFF" : "#15803D"}
      />

      <Text
        style={{
          color: primary ? "#FFFFFF" : "#15803D",
          fontWeight: "900",
          fontSize: 13,
          marginLeft: 7,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function RouteOrderItem({
  index,
  point,
  isLast,
  selected,
  onPress,
}: {
  index: number;
  point: MapPoint;
  isLast: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  const color = getStatusColor(point.status);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={{
        flexDirection: "row",
        paddingBottom: isLast ? 0 : 14,
        marginBottom: isLast ? 0 : 14,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: "#E5E7EB",
        backgroundColor: selected
          ? "#F0FDF4"
          : "transparent",
        borderRadius: selected ? 14 : 0,
        padding: selected ? 10 : 0,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: `${color}18`,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 11,
        }}
      >
        <Text
          style={{
            color,
            fontWeight: "900",
          }}
        >
          {index}
        </Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: "#111827",
            fontWeight: "800",
            fontSize: 15,
          }}
        >
          {point.title}
        </Text>

        <Text
          style={{
            color,
            fontWeight: "700",
            fontSize: 12,
            marginTop: 3,
          }}
        >
          {translateStatus(point.status)}
        </Text>

        <Text
          style={{
            color: "#64748B",
            fontSize: 12,
            marginTop: 4,
          }}
        >
          {point.distanceKm !== null
            ? `${point.distanceKm.toFixed(1)} km`
            : "Distância indisponível"}
          {" • "}
          {point.estimatedWeightKg.toFixed(1)} kg
        </Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={20}
        color="#94A3B8"
      />
    </TouchableOpacity>
  );
}
