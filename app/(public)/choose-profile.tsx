import { router } from "expo-router";
import { useState, useEffect } from "react";
import { Image, Text, View, TouchableOpacity, Alert, Linking, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import GradientButton from "@/src/components/GradientButton";

export default function ChooseProfile() {
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
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      {/* BOTÃO DE VOLTAR - ESTILO DA PRIMEIRA IMAGEM (apenas ícone) */}
      <TouchableOpacity
        onPress={() => router.push("/(public)/access-type")}
        style={{
          position: "absolute",
          top: 60,
          left: 20,
          zIndex: 10,
          backgroundColor: "#FFFFFF",
          borderRadius: 30,
          padding: 10,
          shadowColor: "#000",
          shadowOpacity: 0.1,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
          elevation: 3,
        }}
      >
        <Ionicons name="arrow-back" size={24} color="#111827" />
      </TouchableOpacity>

      {/* CONTEÚDO */}
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 24,
        }}
      >
        <View style={{ width: "100%", maxWidth: 400 }}>
          {/* LOGO E TÍTULO - ESTILO DA PRIMEIRA IMAGEM */}
          <View style={{ alignItems: "center", marginBottom: 40 }}>
            <View
              style={{
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <Image
                source={require("../../assets/images/logo.png")}
                resizeMode="contain"
                style={{
                  width: 72,
                  height: 72,
                  marginBottom: 16,
                }}
              />

              <Text
                style={{
                  fontSize: 28,
                  fontWeight: "800",
                  color: "#111827",
                  textAlign: "center",
                }}
              >
                Qual gerador você é?
              </Text>
            </View>

            {/* LOCALIZAÇÃO - ESTILO DA PRIMEIRA IMAGEM */}
            <TouchableOpacity 
              onPress={locationError ? getUserLocation : undefined}
              disabled={isLoading || !locationError}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                marginTop: 8,
              }}
            >
              <Ionicons 
                name="location-sharp" 
                size={20} 
                color="#9CA3AF" 
              />
              <Text
                style={{
                  color: locationError ? "#DC2626" : "#4B5563",
                  fontSize: 14,
                  fontWeight: "500",
                  marginLeft: 6,
                }}
              >
                {isLoading ? "Carregando..." : currentCity}
              </Text>
              {locationError && !isLoading && (
                <Ionicons 
                  name="refresh-outline" 
                  size={16} 
                  color="#DC2626" 
                  style={{ marginLeft: 6 }}
                />
              )}
            </TouchableOpacity>
          </View>

          {/* BOTÕES - ESTILO DA PRIMEIRA IMAGEM */}
          <View style={{ width: "100%" }}>
            <GradientButton
              title="Pessoa Física"
              icon="person"
              onPress={() => router.push("/(auth)/login?profile=pf")}
            />

            <GradientButton
              title="Pequeno Gerador Comercial"
              icon="storefront"
              onPress={() => router.push("/(auth)/login?profile=comercial")}
            />

            <GradientButton
              title="Grande Gerador"
              icon="business"
              onPress={() => router.push("/(auth)/login?profile=grande")}
            />
          </View>
        </View>
      </View>
    </View>
  );
}