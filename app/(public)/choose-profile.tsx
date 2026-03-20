import { router } from "expo-router";
import { useState, useEffect } from "react";
import {
  Image,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import GradientButton from "@/src/components/GradientButton";

export default function ChooseProfile() {
  const [currentCity, setCurrentCity] = useState<string>(
    "Carregando localização..."
  );
  const [locationError, setLocationError] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    getUserLocation();
  }, []);

  async function getUserLocation() {
    setIsLoading(true);

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
      setIsLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <TouchableOpacity
        onPress={() => router.replace("/(public)/access-type")}
        style={{
          position: "absolute",
          top: 50,
          left: 20,
          zIndex: 10,
          backgroundColor: "rgba(2, 140, 86, 0.1)",
          borderRadius: 30,
          padding: 8,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <Ionicons name="arrow-back" size={24} color="#028C56" />
        <Text
          style={{
            color: "#028C56",
            marginLeft: 4,
            fontWeight: "600",
            fontSize: 14,
          }}
        >
          Voltar
        </Text>
      </TouchableOpacity>

      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 24,
        }}
      >
        <View style={{ width: "100%", maxWidth: 400 }}>
          <View style={{ alignItems: "center", marginBottom: 32 }}>
            <Image
              source={require("../../assets/images/logo.png")}
              resizeMode="contain"
              style={{
                width: 70,
                height: 70,
                marginBottom: 12,
              }}
            />

            <Text
              style={{
                fontSize: 28,
                fontWeight: "800",
                color: "#111827",
                textAlign: "center",
                marginBottom: 8,
              }}
            >
              Qual gerador você é?
            </Text>

            <TouchableOpacity
              onPress={locationError ? getUserLocation : undefined}
              disabled={isLoading || !locationError}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: locationError ? "#FEE2E2" : "#F0FDF4",
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 20,
                marginTop: 4,
              }}
            >
              <Ionicons
                name={locationError ? "alert-circle-outline" : "location-sharp"}
                size={16}
                color={locationError ? "#DC2626" : "#028C56"}
              />
              <Text
                style={{
                  color: locationError ? "#DC2626" : "#028C56",
                  fontSize: 13,
                  fontWeight: "500",
                  marginLeft: 4,
                }}
              >
                {isLoading ? "Carregando..." : currentCity}
              </Text>

              {locationError && !isLoading && (
                <Ionicons
                  name="refresh-outline"
                  size={14}
                  color="#DC2626"
                  style={{ marginLeft: 4 }}
                />
              )}
            </TouchableOpacity>
          </View>

          <View style={{ width: "100%" }}>
            <GradientButton
              title="Pessoa Física"
              icon="person"
              onPress={() => router.replace("/(auth)/login?profile=pf")}
            />

            <GradientButton
              title="Pequeno Gerador Comercial"
              icon="storefront"
              onPress={() => router.replace("/(auth)/login?profile=comercial")}
            />

            <GradientButton
              title="Grande Gerador"
              icon="business"
              onPress={() => router.replace("/(auth)/login?profile=grande")}
            />
          </View>

          <TouchableOpacity
            onPress={() => router.replace("/(public)/activate-access")}
            style={{
              marginTop: 12,
              alignItems: "center",
              paddingVertical: 10,
            }}
          >
            <Text
              style={{
                color: "#028C56",
                fontSize: 14,
                fontWeight: "700",
                textDecorationLine: "underline",
              }}
            >
              Já fui cadastrado pela cooperativa
            </Text>
            <Text
              style={{
                color: "#6B7280",
                fontSize: 12,
                marginTop: 4,
                textAlign: "center",
              }}
            >
              Clique aqui para liberar seu acesso
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}