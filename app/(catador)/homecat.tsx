import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Image,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons, MaterialIcons, FontAwesome6 } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";

import { useAuth } from "@/src/contexts/AuthContext";
import {
  collectionService,
  type Collection,
} from "@/src/services/collectionService";

type ActionButtonProps = {
  title: string;
  icon: React.ReactNode;
  onPress?: () => void;
};

type AuthUser = {
  id?: string;
  uid?: string;
  displayName?: string;
  name?: string;
  email?: string;
  role?: string;
};

function ActionButton({ title, icon, onPress }: ActionButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={{
        marginBottom: 18,
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <LinearGradient
        colors={["#12F35E", "#028C56"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          minHeight: 76,
          borderRadius: 14,
          paddingHorizontal: 28,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 26,
            fontWeight: "800",
            letterSpacing: 0.5,
          }}
        >
          {title}
        </Text>

        <View>{icon}</View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

export default function CatadorHomeScreen() {
  const { user } = useAuth();
  const currentUser = user as AuthUser | null;

  const [currentCity, setCurrentCity] = useState<string>("Carregando localização...");
  const [locationError, setLocationError] = useState<boolean>(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState<boolean>(true);
  const [loadingUser, setLoadingUser] = useState(true);
  const [collections, setCollections] = useState<Collection[]>([]);

  useEffect(() => {
    getUserLocation();
  }, []);

  useEffect(() => {
    const loadCollectorData = async () => {
      try {
        setLoadingUser(true);
        const response = await collectionService.list();
        setCollections(response);
      } catch (error) {
        console.error("Erro ao carregar dados do catador:", error);
        setCollections([]);
      } finally {
        setLoadingUser(false);
      }
    };

    loadCollectorData();
  }, []);

  async function getUserLocation() {
    setIsLoadingLocation(true);

    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setCurrentCity("Localização desativada");
        setLocationError(true);
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setCurrentCity("Permissão negada");
        setLocationError(true);

        Alert.alert(
          "Permissão necessária",
          "Precisamos da sua localização para mostrar a cidade atual. Deseja abrir as configurações?",
          [
            { text: "Agora não", style: "cancel" },
            {
              text: "Abrir Configurações",
              onPress: () => {
                if (Platform.OS === "ios") {
                  Linking.openURL("app-settings:");
                } else {
                  Linking.openSettings();
                }
              },
            },
          ]
        );
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const addresses = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      if (addresses.length > 0) {
        const address = addresses[0];
        const city =
          address.city ||
          address.subregion ||
          address.region ||
          address.country ||
          "Localização desconhecida";
        setCurrentCity(city);
        setLocationError(false);
      } else {
        setCurrentCity("Localização não encontrada");
        setLocationError(true);
      }
    } catch (error) {
      console.error("Erro ao obter localização:", error);
      setCurrentCity("Erro ao carregar");
      setLocationError(true);
    } finally {
      setIsLoadingLocation(false);
    }
  }

  const completedCollections = useMemo(() => {
    return collections.filter((item) => item.status === "COMPLETED");
  }, [collections]);

  const totalKg = useMemo(() => {
    return completedCollections.reduce(
      (acc, item) => acc + Number(item.totalWeightKg || 0),
      0
    );
  }, [completedCollections]);

  const kgMes = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    return completedCollections.reduce((acc, item) => {
      if (!item.createdAt) return acc;

      const createdAt = new Date(item.createdAt);
      if (
        createdAt.getMonth() === month &&
        createdAt.getFullYear() === year
      ) {
        return acc + Number(item.totalWeightKg || 0);
      }

      return acc;
    }, 0);
  }, [completedCollections]);

  const coletasHoje = useMemo(() => {
    const today = new Date().toLocaleDateString("pt-BR");

    return completedCollections.filter((item) => {
      if (!item.createdAt) return false;
      return new Date(item.createdAt).toLocaleDateString("pt-BR") === today;
    }).length;
  }, [completedCollections]);

  const collectorName =
    currentUser?.displayName || currentUser?.name || "Catador";

  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 18,
        }}
      >
        <View style={{ width: "100%", maxWidth: 430 }}>
          <View style={{ alignItems: "center", marginBottom: 28 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 20,
              }}
            >
              <Image
                source={require("../../assets/images/logo.png")}
                resizeMode="contain"
                style={{
                  width: 74,
                  height: 74,
                  marginRight: 12,
                }}
              />

              <Text
                style={{
                  fontSize: 30,
                  color: "#111827",
                  fontWeight: "400",
                }}
              >
                KATUÁ<Text style={{ fontWeight: "800", color: "#028C56" }}></Text>
              </Text>
            </View>

            <TouchableOpacity
              onPress={locationError ? getUserLocation : undefined}
              disabled={isLoadingLocation || !locationError}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: locationError ? "#FEE2E2" : "#F0FDF4",
                paddingVertical: 8,
                paddingHorizontal: 16,
                borderRadius: 30,
              }}
            >
              <Ionicons
                name={locationError ? "alert-circle-outline" : "location-sharp"}
                size={24}
                color={locationError ? "#DC2626" : "#028C56"}
                style={{ marginRight: 6 }}
              />
              <Text
                style={{
                  color: locationError ? "#DC2626" : "#028C56",
                  fontSize: 16,
                  fontWeight: "600",
                  textAlign: "center",
                }}
              >
                {isLoadingLocation ? "Carregando..." : currentCity}
              </Text>
              {locationError && !isLoadingLocation && (
                <Ionicons
                  name="refresh-outline"
                  size={18}
                  color="#DC2626"
                  style={{ marginLeft: 6 }}
                />
              )}
            </TouchableOpacity>
          </View>

          <View
            style={{
              backgroundColor: "#F9FAFB",
              borderRadius: 18,
              padding: 18,
              marginBottom: 26,
              borderWidth: 1,
              borderColor: "#E5E7EB",
            }}
          >
            {loadingUser ? (
              <View style={{ alignItems: "center", paddingVertical: 12 }}>
                <ActivityIndicator color="#028C56" />
                <Text style={{ marginTop: 8, color: "#6B7280" }}>
                  Carregando dados...
                </Text>
              </View>
            ) : (
              <>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: "700",
                    color: "#111827",
                    textAlign: "center",
                    marginBottom: 12,
                  }}
                >
                  {collectorName}
                </Text>

                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <View style={{ alignItems: "center", flex: 1 }}>
                    <Text style={{ fontSize: 12, color: "#6B7280" }}>TOTAL</Text>
                    <Text style={{ fontSize: 20, fontWeight: "800", color: "#028C56" }}>
                      {totalKg} kg
                    </Text>
                  </View>

                  <View style={{ alignItems: "center", flex: 1 }}>
                    <Text style={{ fontSize: 12, color: "#6B7280" }}>NO MÊS</Text>
                    <Text style={{ fontSize: 20, fontWeight: "800", color: "#028C56" }}>
                      {kgMes} kg
                    </Text>
                  </View>

                  <View style={{ alignItems: "center", flex: 1 }}>
                    <Text style={{ fontSize: 12, color: "#6B7280" }}>HOJE</Text>
                    <Text style={{ fontSize: 20, fontWeight: "800", color: "#028C56" }}>
                      {coletasHoje}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>

          <ActionButton
            title="COLETAR"
            icon={<Ionicons name="reload-circle-outline" size={42} color="#FFFFFF" />}
            onPress={() => router.push("/(catador)/collect")}
          />

          <ActionButton
            title="DADOS"
            icon={<MaterialIcons name="storage" size={38} color="#FFFFFF" />}
            onPress={() => router.push("/(catador)/data")}
          />

          <ActionButton
            title="COMPROVANTES"
            icon={<FontAwesome6 name="receipt" size={34} color="#FFFFFF" />}
            onPress={() => router.push("/(catador)/receipts")}
          />
        </View>
      </View>
    </View>
  );
}