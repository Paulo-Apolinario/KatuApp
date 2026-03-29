import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, {
  Marker,
  Polyline,
  PROVIDER_DEFAULT,
  Region,
} from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import * as Linking from "expo-linking";

import {
  collectionService,
  type Collection,
} from "@/src/services/collectionService";

type MapPoint = {
  id: string;
  title: string;
  address: string;
  latitude: number;
  longitude: number;
  status: "PENDING" | "IN_PROGRESS";
  routeName?: string | null;
  driverName?: string | null;
  vehicleLabel?: string | null;
};

const INITIAL_REGION: Region = {
  latitude: -3.7319,
  longitude: -38.5267,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

function hasValidCoordinates(latitude?: number | null, longitude?: number | null) {
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    !Number.isNaN(latitude) &&
    !Number.isNaN(longitude)
  );
}

function getStatusColor(status: "PENDING" | "IN_PROGRESS") {
  return status === "IN_PROGRESS" ? "#8B5CF6" : "#2563EB";
}

export default function CatadorMapScreen() {
  const mapRef = useRef<MapView | null>(null);

  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState(INITIAL_REGION);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selected, setSelected] = useState<MapPoint | null>(null);

  const loadLocation = useCallback(async () => {
    try {
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
      console.error("Erro ao carregar localização do catador:", error);
    }
  }, []);

  const loadCollections = useCallback(async () => {
    try {
      setLoading(true);
      const data = await collectionService.list();
      setCollections(data);
    } catch (error) {
      console.error("Erro ao carregar mapa do catador:", error);
      Alert.alert("Erro", "Não foi possível carregar o mapa do catador.");
      setCollections([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCollections();
    }, [loadCollections])
  );

  useEffect(() => {
    loadLocation();
  }, [loadLocation]);

  const points = useMemo(() => {
    return collections
      .filter((item) => item.status === "PENDING" || item.status === "IN_PROGRESS")
      .filter((item) =>
        hasValidCoordinates(item.generator?.latitude, item.generator?.longitude)
      )
      .map((item) => ({
        id: item.id,
        title:
          item.generator?.companyName ||
          item.generator?.businessName ||
          item.generator?.name ||
          "Coleta operacional",
        address: item.generator?.address || "Endereço não informado",
        latitude: item.generator?.latitude as number,
        longitude: item.generator?.longitude as number,
        status: item.status as "PENDING" | "IN_PROGRESS",
        routeName: item.route?.name || null,
        driverName: item.driver?.name || null,
        vehicleLabel: item.vehicle
          ? `${item.vehicle.model || "Veículo"}${
              item.vehicle.plate ? ` • ${item.vehicle.plate}` : ""
            }`
          : null,
      }));
  }, [collections]);

  useEffect(() => {
    if (mapRef.current && points.length > 0) {
      mapRef.current.fitToCoordinates(
        [
          { latitude: region.latitude, longitude: region.longitude },
          ...points.map((point) => ({
            latitude: point.latitude,
            longitude: point.longitude,
          })),
        ],
        {
          edgePadding: { top: 90, right: 90, bottom: 240, left: 90 },
          animated: true,
        }
      );
    }
  }, [points, region]);

  const selectedLine = useMemo(() => {
    if (!selected) return [];
    return [
      { latitude: region.latitude, longitude: region.longitude },
      { latitude: selected.latitude, longitude: selected.longitude },
    ];
  }, [region, selected]);

  const openExternalRoute = useCallback(async () => {
    if (!selected) return;

    try {
      const destination = `${selected.latitude},${selected.longitude}`;
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
  }, [selected]);

  return (
    <View style={{ flex: 1, backgroundColor: "#F3F4F6" }}>
      <LinearGradient
        colors={["#16a34a", "#22c55e"]}
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
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 14 }}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: "900", color: "#FFFFFF" }}>
              MAPA DO CATADOR
            </Text>
            <Text style={{ fontSize: 13, color: "#E8FFF1", marginTop: 4 }}>
              Visualização da coleta, rota e deslocamento atual
            </Text>
          </View>
        </View>
      </LinearGradient>

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
        {loading ? (
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
              Carregando mapa...
            </Text>
          </View>
        ) : points.length === 0 ? (
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
              Nenhuma coleta ativa para exibir
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
            {selected && (
              <Polyline
                coordinates={selectedLine}
                strokeWidth={5}
                strokeColor="#028C56"
              />
            )}

            <Marker
              coordinate={{
                latitude: region.latitude,
                longitude: region.longitude,
              }}
              title="Minha posição"
              description="Catador / localização atual"
              pinColor="#028C56"
            />

            {points.map((point) => (
              <Marker
                key={point.id}
                coordinate={{
                  latitude: point.latitude,
                  longitude: point.longitude,
                }}
                title={point.title}
                description={point.address}
                pinColor={getStatusColor(point.status)}
                onPress={() => setSelected(point)}
              />
            ))}
          </MapView>
        )}
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
          {selected ? (
            <>
              <Text style={{ fontSize: 17, fontWeight: "900", color: "#0F172A" }}>
                {selected.title}
              </Text>
              <Text style={{ fontSize: 13, color: "#64748B", marginTop: 8 }}>
                Endereço: {selected.address}
              </Text>
              <Text style={{ fontSize: 13, color: "#475569", marginTop: 6 }}>
                Rota: {selected.routeName || "-"}
              </Text>
              <Text style={{ fontSize: 13, color: "#475569", marginTop: 6 }}>
                Motorista: {selected.driverName || "-"}
              </Text>
              <Text style={{ fontSize: 13, color: "#475569", marginTop: 6 }}>
                Veículo: {selected.vehicleLabel || "-"}
              </Text>

              <TouchableOpacity
                onPress={openExternalRoute}
                style={{
                  marginTop: 16,
                  backgroundColor: "#028C56",
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#FFFFFF", fontWeight: "900", fontSize: 13 }}>
                  ABRIR ROTA
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={{ color: "#64748B", textAlign: "center" }}>
              Selecione um ponto para ver a rota.
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}