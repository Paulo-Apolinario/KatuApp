import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { registerDraftStore } from "@/src/stores/registerDraftStore";

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

const DEFAULT_REGION: Region = {
  latitude: -3.7319,
  longitude: -38.5267,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

export default function SelectLocationWebScreen() {
  const params = useLocalSearchParams<{
    from?: string;
    latitude?: string;
    longitude?: string;
  }>();

  const draft = registerDraftStore.get("cooperativa");

  const initialRegion = useMemo<Region>(() => {
    const fromParamsLat = params.latitude ? Number(params.latitude) : NaN;
    const fromParamsLng = params.longitude ? Number(params.longitude) : NaN;

    if (!Number.isNaN(fromParamsLat) && !Number.isNaN(fromParamsLng)) {
      return {
        latitude: fromParamsLat,
        longitude: fromParamsLng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
    }

    const fromDraftLat = draft.latitude ? Number(draft.latitude) : NaN;
    const fromDraftLng = draft.longitude ? Number(draft.longitude) : NaN;

    if (!Number.isNaN(fromDraftLat) && !Number.isNaN(fromDraftLng)) {
      return {
        latitude: fromDraftLat,
        longitude: fromDraftLng,
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

  function handleConfirm() {
    registerDraftStore.set({
      profile: "cooperativa",
      latitude: String(selectedPoint.latitude),
      longitude: String(selectedPoint.longitude),
    });

    router.replace({
      pathname: "/(auth)/register",
      params: {
        profile: "cooperativa",
        selectedLatitude: String(selectedPoint.latitude),
        selectedLongitude: String(selectedPoint.longitude),
      },
    });
  }

  const src = `https://www.google.com/maps?q=${selectedPoint.latitude},${selectedPoint.longitude}&z=15&output=embed`;

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
              Visualização do ponto no navegador
            </Text>
          </View>
        </View>
      </LinearGradient>

      <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
        <iframe
          src={src}
          style={{ width: "100%", height: "100%", border: "none" } as any}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
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