import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import MapView, {
  Marker,
  PROVIDER_GOOGLE,
  Region,
  MapPressEvent,
} from "react-native-maps";
import * as Location from "expo-location";
import { generatorDraftStore } from "@/src/stores/generatorDraftStore";

const DEFAULT_REGION: Region = {
  latitude: -3.7319,
  longitude: -38.5267,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

export default function GeneratorSelectLocationScreen() {
  const params = useLocalSearchParams<{
    kind?: "SMALL" | "LARGE";
    latitude?: string;
    longitude?: string;
  }>();

  const kind = params.kind === "LARGE" ? "LARGE" : "SMALL";
  const draft = generatorDraftStore.get(kind);

  const initialRegion = useMemo<Region>(() => {
    const latFromParams = params.latitude ? Number(params.latitude) : NaN;
    const lngFromParams = params.longitude ? Number(params.longitude) : NaN;

    if (!Number.isNaN(latFromParams) && !Number.isNaN(lngFromParams)) {
      return {
        latitude: latFromParams,
        longitude: lngFromParams,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
    }

    const latFromDraft = draft.latitude ? Number(draft.latitude) : NaN;
    const lngFromDraft = draft.longitude ? Number(draft.longitude) : NaN;

    if (!Number.isNaN(latFromDraft) && !Number.isNaN(lngFromDraft)) {
      return {
        latitude: latFromDraft,
        longitude: lngFromDraft,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
    }

    return DEFAULT_REGION;
  }, [params.latitude, params.longitude, draft.latitude, draft.longitude]);

  const [selectedPoint, setSelectedPoint] = useState({
    latitude: initialRegion.latitude,
    longitude: initialRegion.longitude,
  });
  const [loadingLocation, setLoadingLocation] = useState(false);

  async function handleUseCurrentLocation() {
    try {
      setLoadingLocation(true);

      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Permissão negada",
          "Permita o acesso à localização para usar sua posição atual."
        );
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setSelectedPoint({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      });
    } catch (error) {
      console.error("Erro ao obter localização atual:", error);
      Alert.alert("Erro", "Não foi possível obter sua localização atual.");
    } finally {
      setLoadingLocation(false);
    }
  }

  function handleMapPress(event: MapPressEvent) {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setSelectedPoint({ latitude, longitude });
  }

  function handleConfirm() {
    generatorDraftStore.set({
      kind,
      latitude: String(selectedPoint.latitude),
      longitude: String(selectedPoint.longitude),
    });

    router.replace({
      pathname:
        kind === "LARGE"
          ? "/(cooperativa)/geradores/novo-grande"
          : "/(cooperativa)/geradores/novo-pequeno",
      params: {
        selectedLatitude: String(selectedPoint.latitude),
        selectedLongitude: String(selectedPoint.longitude),
      },
    });
  }

  if (Platform.OS === "web") {
    return (
      <View style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
        <LinearGradient
          colors={["#10F35D", "#028C56"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            paddingTop: 52,
            paddingBottom: 20,
            paddingHorizontal: 20,
            borderBottomLeftRadius: 24,
            borderBottomRightRadius: 24,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            <View>
              <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "900" }}>
                SELECIONAR LOCALIZAÇÃO
              </Text>
              <Text style={{ color: "#E8FFF1", marginTop: 4 }}>
                Fluxo completo disponível no Android/iPhone
              </Text>
            </View>
          </View>
        </LinearGradient>

        <View style={{ padding: 20 }}>
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 18,
              padding: 18,
              borderWidth: 1,
              borderColor: "#E5E7EB",
            }}
          >
            <Text
              style={{
                marginTop: 8,
                color: "#4B5563",
                lineHeight: 22,
              }}
            >
              No app Android/iPhone, toque no mapa para marcar o ponto exato do gerador.
            </Text>

            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                marginTop: 18,
                backgroundColor: "#028C56",
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 15 }}>
                VOLTAR
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
      <LinearGradient
        colors={["#10F35D", "#028C56"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          paddingTop: 52,
          paddingBottom: 20,
          paddingHorizontal: 20,
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "900" }}>
              SELECIONAR LOCALIZAÇÃO
            </Text>
            <Text style={{ color: "#E8FFF1", marginTop: 4 }}>
              Toque no mapa para marcar o ponto exato do gerador
            </Text>
          </View>
        </View>
      </LinearGradient>

      <View style={{ flex: 1 }}>
        <MapView
          provider={PROVIDER_GOOGLE}
          style={{ flex: 1 }}
          initialRegion={initialRegion}
          onPress={handleMapPress}
          showsUserLocation
          showsMyLocationButton
          toolbarEnabled={false}
        >
          <Marker
            coordinate={selectedPoint}
            title="Localização selecionada"
            description="Ponto que será salvo no cadastro"
            pinColor="#028C56"
          />
        </MapView>
      </View>

      <View
        style={{
          backgroundColor: "#FFFFFF",
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: 18,
          borderTopWidth: 1,
          borderColor: "#E5E7EB",
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: "700", color: "#111827" }}>
          Latitude
        </Text>
        <Text style={{ marginTop: 4, color: "#4B5563" }}>
          {selectedPoint.latitude.toFixed(6)}
        </Text>

        <Text
          style={{
            fontSize: 14,
            fontWeight: "700",
            color: "#111827",
            marginTop: 12,
          }}
        >
          Longitude
        </Text>
        <Text style={{ marginTop: 4, color: "#4B5563" }}>
          {selectedPoint.longitude.toFixed(6)}
        </Text>

        <TouchableOpacity
          onPress={handleUseCurrentLocation}
          disabled={loadingLocation}
          style={{
            marginTop: 16,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: "#028C56",
            paddingVertical: 14,
            alignItems: "center",
            backgroundColor: "#F0FDF4",
          }}
        >
          {loadingLocation ? (
            <ActivityIndicator color="#028C56" />
          ) : (
            <Text style={{ color: "#028C56", fontWeight: "800", fontSize: 15 }}>
              USAR MINHA LOCALIZAÇÃO
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleConfirm}
          style={{
            marginTop: 12,
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          <LinearGradient
            colors={["#10F35D", "#028C56"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              paddingVertical: 16,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "900", fontSize: 15 }}>
              CONFIRMAR LOCALIZAÇÃO
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}