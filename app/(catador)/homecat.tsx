import { router } from "expo-router";
import { useState, useEffect } from "react";
import { Image, Text, View, TouchableOpacity, Alert, Linking, Platform } from "react-native";
import { Ionicons, MaterialIcons, FontAwesome6 } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";

type ActionButtonProps = {
  title: string;
  icon: React.ReactNode;
  onPress?: () => void;
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
  const [currentCity, setCurrentCity] = useState<string>("Carregando localização...");
  const [locationError, setLocationError] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    getUserLocation();
  }, []);

  async function getUserLocation() {
    setIsLoading(true);
    try {
      // Verificar se os serviços de localização estão habilitados
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setCurrentCity("Localização desativada");
        setLocationError(true);
        setIsLoading(false);
        return;
      }

      // Solicitar permissão
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== "granted") {
        setCurrentCity("Permissão negada");
        setLocationError(true);
        setIsLoading(false);
        
        // Alert explicativo sobre permissão
        Alert.alert(
          "Permissão necessária",
          "Precisamos da sua localização para mostrar a cidade atual. Deseja abrir as configurações?",
          [
            { text: "Agora não", style: "cancel" },
            { 
              text: "Abrir Configurações", 
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              }
            }
          ]
        );
        return;
      }

      // Obter posição atual
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // Geocodificação reversa
      const addresses = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      if (addresses.length > 0) {
        const address = addresses[0];
        const city = address.city || address.subregion || address.region || address.country || "Localização desconhecida";
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
    <View
      style={{
        flex: 1,
        backgroundColor: "#FFFFFF", // ALTERADO PARA BRANCO
      }}
    >
      {/* BOTÃO DE VOLTAR - MESMO ESTILO DOS OUTROS CÓDIGOS */}
      <TouchableOpacity
        onPress={() => router.back()}
        style={{
          position: "absolute",
          top: 60,
          left: 20,
          zIndex: 10,
          backgroundColor: "rgba(2, 140, 86, 0.1)",
          borderRadius: 30,
          padding: 10,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <Ionicons name="arrow-back" size={28} color="#028C56" />
        <Text style={{ color: "#028C56", marginLeft: 5, fontWeight: "600" }}>
          Voltar
        </Text>
      </TouchableOpacity>

      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 18,
        }}
      >
        <View style={{ width: "100%", maxWidth: 430 }}>
          {/* TOPO COM LOGO E LOCALIZAÇÃO */}
          <View style={{ alignItems: "center", marginBottom: 46 }}>
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
                  color: "#111827", // ALTERADO PARA ESCURO
                  fontWeight: "400",
                }}
              >
                Coletar<Text style={{ fontWeight: "800", color: "#028C56" }}>AI</Text>
              </Text>
            </View>

            {/* LOCALIZAÇÃO ATUAL */}
            <TouchableOpacity 
              onPress={locationError ? getUserLocation : undefined}
              disabled={isLoading || !locationError}
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
                {isLoading ? "Carregando..." : currentCity}
              </Text>
              {locationError && !isLoading && (
                <Ionicons 
                  name="refresh-outline" 
                  size={18} 
                  color="#DC2626" 
                  style={{ marginLeft: 6 }}
                />
              )}
            </TouchableOpacity>
          </View>

          {/* BOTÕES DE AÇÃO */}
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