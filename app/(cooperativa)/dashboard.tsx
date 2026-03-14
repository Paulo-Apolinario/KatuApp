import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Image,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { collection, getDocs } from "firebase/firestore";

import { db } from "@/src/services/firebaseConfig";
import { useAuth } from "@/src/contexts/AuthContext";

export default function CooperativaDashboard() {
  const { user } = useAuth();

  const [currentCity, setCurrentCity] = useState<string>("Carregando localização...");
  const [locationError, setLocationError] = useState<boolean>(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState<boolean>(true);
  const [loadingData, setLoadingData] = useState<boolean>(true);

  const [stats, setStats] = useState({
    catadores: 0,
    geradores: 0,
    totalKg: 0,
    alertas: 0,
    percentualReciclado: 0,
  });

  useEffect(() => {
    getUserLocation();
  }, []);

  const loadDashboard = useCallback(async () => {
    if (!user?.uid) {
      setLoadingData(false);
      return;
    }

    try {
      setLoadingData(true);

      const [catadoresSnap, geradoresSnap] = await Promise.all([
        getDocs(collection(db, "catadores")),
        getDocs(collection(db, "users")),
      ]);

      const geradores = geradoresSnap.docs.filter((docSnap) => {
        const data: any = docSnap.data();
        return data?.userType === "comercial" || data?.userType === "grande";
      }).length;

      setStats({
        catadores: catadoresSnap.size,
        geradores,
        totalKg: 0,
        alertas: 0,
        percentualReciclado: 0,
      });
    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
    } finally {
      setLoadingData(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

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

  const coletasHoje: string[] = [];
  const alertas: { name: string; desc: string }[] = [];

  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <LinearGradient
        colors={["#10F35D", "#028C56"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          paddingTop: 50,
          paddingBottom: 20,
          paddingHorizontal: 20,
          borderBottomLeftRadius: 30,
          borderBottomRightRadius: 30,
        }}
      >
        <View
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
        >
          <TouchableOpacity onPress={() => router.replace("/(cooperativa)/home")}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Image
              source={require("../../assets/images/logo.png")}
              resizeMode="contain"
              style={{ width: 36, height: 36, marginRight: 8 }}
            />
            <Text style={{ fontSize: 22, fontWeight: "800", color: "#FFFFFF" }}>
              KATU
            </Text>
          </View>

          <Text style={{ fontSize: 16, color: "#FFFFFF" }}>Cooperativa</Text>
        </View>

        <TouchableOpacity
          onPress={locationError ? getUserLocation : undefined}
          disabled={isLoadingLocation || !locationError}
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "rgba(255,255,255,0.2)",
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderRadius: 20,
            marginTop: 12,
            alignSelf: "flex-start",
          }}
        >
          <Ionicons
            name={locationError ? "alert-circle-outline" : "location-sharp"}
            size={16}
            color="#FFFFFF"
          />
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 14,
              fontWeight: "500",
              marginLeft: 4,
            }}
          >
            {isLoadingLocation ? "Carregando..." : currentCity}
          </Text>
        </TouchableOpacity>

        <Text style={{ fontSize: 20, fontWeight: "700", color: "#FFFFFF", marginTop: 15 }}>
          Painel de Controle
        </Text>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, padding: 20 }}>
        {loadingData ? (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <ActivityIndicator size="large" color="#028C56" />
            <Text style={{ marginTop: 12, color: "#6B7280" }}>
              Carregando dashboard...
            </Text>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
              <View
                style={{
                  width: "48%",
                  backgroundColor: "#F0FDF4",
                  borderRadius: 16,
                  padding: 20,
                  marginBottom: 15,
                }}
              >
                <Ionicons name="people-outline" size={30} color="#028C56" />
                <Text
                  style={{
                    fontSize: 24,
                    fontWeight: "800",
                    color: "#028C56",
                    marginTop: 10,
                  }}
                >
                  {stats.catadores}
                </Text>
                <Text style={{ fontSize: 14, color: "#4B5563" }}>Catadores</Text>
              </View>

              <View
                style={{
                  width: "48%",
                  backgroundColor: "#EFF6FF",
                  borderRadius: 16,
                  padding: 20,
                  marginBottom: 15,
                }}
              >
                <Ionicons name="business-outline" size={30} color="#2563EB" />
                <Text
                  style={{
                    fontSize: 24,
                    fontWeight: "800",
                    color: "#2563EB",
                    marginTop: 10,
                  }}
                >
                  {stats.geradores}
                </Text>
                <Text style={{ fontSize: 14, color: "#4B5563" }}>Geradores</Text>
              </View>

              <View
                style={{
                  width: "48%",
                  backgroundColor: "#FEFCE8",
                  borderRadius: 16,
                  padding: 20,
                  marginBottom: 15,
                }}
              >
                <Ionicons name="trash-outline" size={30} color="#CA8A04" />
                <Text
                  style={{
                    fontSize: 24,
                    fontWeight: "800",
                    color: "#CA8A04",
                    marginTop: 10,
                  }}
                >
                  {stats.totalKg}
                </Text>
                <Text style={{ fontSize: 14, color: "#4B5563" }}>Kg Coletados</Text>
              </View>

              <View
                style={{
                  width: "48%",
                  backgroundColor: "#FEF2F2",
                  borderRadius: 16,
                  padding: 20,
                  marginBottom: 15,
                }}
              >
                <Ionicons name="alert-circle-outline" size={30} color="#DC2626" />
                <Text
                  style={{
                    fontSize: 24,
                    fontWeight: "800",
                    color: "#DC2626",
                    marginTop: 10,
                  }}
                >
                  {stats.alertas}
                </Text>
                <Text style={{ fontSize: 14, color: "#4B5563" }}>Alertas</Text>
              </View>
            </View>

            <View
              style={{
                backgroundColor: "#F9FAFB",
                borderRadius: 16,
                padding: 20,
                marginBottom: 25,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 15,
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: "700", color: "#111827" }}>
                  Reciclados esse mês
                </Text>
                <View
                  style={{
                    backgroundColor: "#028C56",
                    borderRadius: 20,
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                  }}
                >
                  <Text style={{ color: "#FFFFFF", fontWeight: "600" }}>
                    {stats.percentualReciclado}%
                  </Text>
                </View>
              </View>

              <View style={{ height: 12, backgroundColor: "#E5E7EB", borderRadius: 6 }}>
                <View
                  style={{
                    width: `${stats.percentualReciclado}%`,
                    height: 12,
                    backgroundColor: "#028C56",
                    borderRadius: 6,
                  }}
                />
              </View>

              <Text style={{ fontSize: 14, color: "#6B7280", marginTop: 8 }}>
                de resíduos reciclados
              </Text>
            </View>

            <View style={{ marginBottom: 25 }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 15 }}>
                Coletas de Hoje
              </Text>

              {coletasHoje.length === 0 ? (
                <View
                  style={{
                    backgroundColor: "#F9FAFB",
                    borderRadius: 12,
                    padding: 18,
                  }}
                >
                  <Text style={{ color: "#6B7280" }}>Nenhuma coleta registrada hoje.</Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {coletasHoje.map((time, index) => (
                    <View
                      key={index}
                      style={{
                        backgroundColor: index % 2 === 0 ? "#028C56" : "#F0FDF4",
                        borderRadius: 12,
                        padding: 12,
                        marginRight: 10,
                        alignItems: "center",
                        minWidth: 70,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "600",
                          color: index % 2 === 0 ? "#FFFFFF" : "#028C56",
                        }}
                      >
                        {time}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>

            <View style={{ marginBottom: 30 }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 15 }}>
                Pontos de Alerta
              </Text>

              {alertas.length === 0 ? (
                <View
                  style={{
                    backgroundColor: "#F9FAFB",
                    borderRadius: 12,
                    padding: 18,
                  }}
                >
                  <Text style={{ color: "#6B7280" }}>Nenhum alerta registrado.</Text>
                </View>
              ) : (
                alertas.map((item, index) => (
                  <View
                    key={index}
                    style={{
                      backgroundColor: "#FEF2F2",
                      borderRadius: 12,
                      padding: 15,
                      marginBottom: 10,
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <View>
                      <Text style={{ fontSize: 16, fontWeight: "600", color: "#DC2626" }}>
                        {item.name}
                      </Text>
                      <Text style={{ fontSize: 14, color: "#6B7280", marginTop: 2 }}>
                        {item.desc}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => router.push("/(cooperativa)/alerts")}
                      style={{
                        backgroundColor: "#FFFFFF",
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: "#DC2626",
                      }}
                    >
                      <Text style={{ color: "#DC2626", fontWeight: "600", fontSize: 12 }}>
                        ABRIR
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>

            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 30 }}>
              <TouchableOpacity
                onPress={() => router.push("/(cooperativa)/fleet")}
                style={{
                  flex: 1,
                  backgroundColor: "#F0FDF4",
                  borderRadius: 12,
                  padding: 15,
                  marginRight: 10,
                  alignItems: "center",
                }}
              >
                <Ionicons name="car-outline" size={28} color="#028C56" />
                <Text style={{ fontSize: 14, color: "#028C56", fontWeight: "600", marginTop: 5 }}>
                  Frota
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push("/(cooperativa)/alerts")}
                style={{
                  flex: 1,
                  backgroundColor: "#FEF2F2",
                  borderRadius: 12,
                  padding: 15,
                  marginRight: 10,
                  alignItems: "center",
                }}
              >
                <Ionicons name="alert-circle-outline" size={28} color="#DC2626" />
                <Text style={{ fontSize: 14, color: "#DC2626", fontWeight: "600", marginTop: 5 }}>
                  Alertas
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push("/(cooperativa)/ranking")}
                style={{
                  flex: 1,
                  backgroundColor: "#FEFCE8",
                  borderRadius: 12,
                  padding: 15,
                  alignItems: "center",
                }}
              >
                <Ionicons name="trophy-outline" size={28} color="#CA8A04" />
                <Text style={{ fontSize: 14, color: "#CA8A04", fontWeight: "600", marginTop: 5 }}>
                  Ranking
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}