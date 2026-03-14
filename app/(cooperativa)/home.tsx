import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Image,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { collection, getDocs, query, where } from "firebase/firestore";

import { db } from "@/src/services/firebaseConfig";
import { useAuth } from "@/src/contexts/AuthContext";

export default function CooperativaHomeScreen() {
  const { user } = useAuth();

  const [currentCity, setCurrentCity] = useState<string>("Carregando localização...");
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);

  const [stats, setStats] = useState({
    coletasHoje: 0,
    totalKg: 0,
    alertas: 0,
    motoristas: 0,
    veiculos: 0,
    rotasAtivas: 0,
  });

  useEffect(() => {
    getUserLocation();
  }, []);

  const loadSummary = useCallback(async () => {
    if (!user?.uid) {
      setLoadingStats(false);
      return;
    }

    try {
      setLoadingStats(true);

      const motoristasQuery = query(
        collection(db, "motoristas"),
        where("cooperativaId", "==", user.uid)
      );

      const veiculosQuery = query(
        collection(db, "veiculos"),
        where("cooperativaId", "==", user.uid)
      );

      const rotasQuery = query(
        collection(db, "rotas"),
        where("cooperativaId", "==", user.uid)
      );

      const [motoristasSnap, veiculosSnap, rotasSnap] = await Promise.all([
        getDocs(motoristasQuery),
        getDocs(veiculosQuery),
        getDocs(rotasQuery),
      ]);

      const rotasDocs = rotasSnap.docs.map((docSnap) => docSnap.data());
      const rotasAtivas = rotasDocs.filter(
        (rota: any) =>
          rota?.status === "agendada" || rota?.status === "em_andamento"
      ).length;

      setStats({
        coletasHoje: 0,
        totalKg: 0,
        alertas: 0,
        motoristas: motoristasSnap.size,
        veiculos: veiculosSnap.size,
        rotasAtivas,
      });
    } catch (error) {
      console.error("Erro ao carregar resumo da cooperativa:", error);
    } finally {
      setLoadingStats(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  async function getUserLocation() {
    try {
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        setCurrentCity("Localização desativada");
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setCurrentCity("Permissão negada");
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const addresses = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (addresses.length > 0) {
        const address = addresses[0];
        const city =
          address.city ||
          address.subregion ||
          address.region ||
          "Localização desconhecida";

        setCurrentCity(city);
      } else {
        setCurrentCity("Localização não encontrada");
      }
    } catch (error) {
      console.error("Erro ao obter localização:", error);
      setCurrentCity("Erro ao carregar");
    } finally {
      setLoadingLocation(false);
    }
  }

  const menuItems = useMemo(
    () => [
      {
        title: "PEQUENO GERADOR",
        icon: "storefront-outline",
        color: "#028C56",
        bgColor: "#F0FDF4",
        route: "/(cooperativa)/geradores/pequeno",
      },
      {
        title: "GRANDE GERADOR",
        icon: "business-outline",
        color: "#2563EB",
        bgColor: "#EFF6FF",
        route: "/(cooperativa)/geradores/grande",
      },
      {
        title: "MOTORISTAS",
        icon: "people-outline",
        color: "#10B981",
        bgColor: "#F0FDF4",
        route: "/(cooperativa)/motoristas",
      },
      {
        title: "VEÍCULOS",
        icon: "car-outline",
        color: "#F59E0B",
        bgColor: "#FEFCE8",
        route: "/(cooperativa)/veiculos",
      },
      {
        title: "ROTAS",
        icon: "map-outline",
        color: "#8B5CF6",
        bgColor: "#F3E8FF",
        route: "/(cooperativa)/rotas",
      },
      {
        title: "DASHBOARD",
        icon: "speedometer-outline",
        color: "#8B5CF6",
        bgColor: "#F3E8FF",
        route: "/(cooperativa)/dashboard",
      },
      {
        title: "PAINEL DA FROTA",
        icon: "car-sport-outline",
        color: "#CA8A04",
        bgColor: "#FEFCE8",
        route: "/(cooperativa)/fleet",
      },
      {
        title: "PONTOS DE ALERTA",
        icon: "alert-circle-outline",
        color: "#DC2626",
        bgColor: "#FEF2F2",
        route: "/(cooperativa)/alerts",
      },
      {
        title: "CATADORES",
        icon: "people-outline",
        color: "#EC4899",
        bgColor: "#FCE7F3",
        route: "/(cooperativa)/catadores",
      },
    ],
    []
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <LinearGradient
        colors={["#10F35D", "#028C56"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          paddingTop: 50,
          paddingBottom: 30,
          paddingHorizontal: 20,
          borderBottomLeftRadius: 30,
          borderBottomRightRadius: 30,
        }}
      >
        <View
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Image
              source={require("../../assets/images/logo.png")}
              resizeMode="contain"
              style={{ width: 40, height: 40, marginRight: 10 }}
            />
            <Text style={{ fontSize: 24, fontWeight: "800", color: "#FFFFFF" }}>
              KATUÁ
            </Text>
          </View>

          <TouchableOpacity activeOpacity={0.8}>
            <Ionicons name="business-outline" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <Text
          style={{
            fontSize: 28,
            fontWeight: "700",
            color: "#FFFFFF",
            marginTop: 20,
            textAlign: "center",
          }}
        >
          Katuá
        </Text>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 8,
          }}
        >
          <Ionicons name="location-sharp" size={18} color="#FFFFFF" />
          <Text
            style={{
              fontSize: 16,
              color: "#FFFFFF",
              marginLeft: 5,
              opacity: 0.9,
              fontWeight: "500",
            }}
          >
            {loadingLocation ? "Carregando..." : currentCity}
          </Text>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1, paddingHorizontal: 20, paddingTop: 25 }}
      >
        <Text
          style={{
            fontSize: 22,
            fontWeight: "700",
            color: "#111827",
            marginBottom: 20,
          }}
        >
          Gestão da Cooperativa
        </Text>

        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => router.push(item.route as any)}
              style={{
                width: "48%",
                backgroundColor: item.bgColor,
                borderRadius: 20,
                padding: 16,
                marginBottom: 15,
                alignItems: "center",
                borderWidth: 1,
                borderColor: item.color + "20",
              }}
            >
              <View
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  backgroundColor: item.color + "20",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 10,
                }}
              >
                <Ionicons name={item.icon as any} size={26} color={item.color} />
              </View>

              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: item.color,
                  textAlign: "center",
                }}
              >
                {item.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View
          style={{
            backgroundColor: "#F9FAFB",
            borderRadius: 16,
            padding: 20,
            marginTop: 10,
            marginBottom: 30,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "600",
              color: "#028C56",
              marginBottom: 10,
            }}
          >
            Resumo do dia
          </Text>

          {loadingStats ? (
            <View style={{ paddingVertical: 20, alignItems: "center" }}>
              <ActivityIndicator color="#028C56" />
              <Text style={{ marginTop: 10, color: "#6B7280" }}>
                Carregando dados...
              </Text>
            </View>
          ) : (
            <>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View>
                  <Text style={{ fontSize: 12, color: "#6B7280" }}>Coletas hoje</Text>
                  <Text style={{ fontSize: 20, fontWeight: "700", color: "#111827" }}>
                    {stats.coletasHoje}
                  </Text>
                </View>

                <View>
                  <Text style={{ fontSize: 12, color: "#6B7280" }}>Kg coletados</Text>
                  <Text style={{ fontSize: 20, fontWeight: "700", color: "#111827" }}>
                    {stats.totalKg} kg
                  </Text>
                </View>

                <View>
                  <Text style={{ fontSize: 12, color: "#6B7280" }}>Alertas</Text>
                  <Text style={{ fontSize: 20, fontWeight: "700", color: "#DC2626" }}>
                    {stats.alertas}
                  </Text>
                </View>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginTop: 15,
                  paddingTop: 15,
                  borderTopWidth: 1,
                  borderTopColor: "#E5E7EB",
                }}
              >
                <View>
                  <Text style={{ fontSize: 12, color: "#6B7280" }}>Motoristas</Text>
                  <Text style={{ fontSize: 16, fontWeight: "600", color: "#10B981" }}>
                    {stats.motoristas}
                  </Text>
                </View>

                <View>
                  <Text style={{ fontSize: 12, color: "#6B7280" }}>Veículos</Text>
                  <Text style={{ fontSize: 16, fontWeight: "600", color: "#F59E0B" }}>
                    {stats.veiculos}
                  </Text>
                </View>

                <View>
                  <Text style={{ fontSize: 12, color: "#6B7280" }}>Rotas ativas</Text>
                  <Text style={{ fontSize: 16, fontWeight: "600", color: "#8B5CF6" }}>
                    {stats.rotasAtivas}
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}