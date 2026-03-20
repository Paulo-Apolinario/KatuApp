import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Image,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";

import { useAuth } from "@/src/contexts/AuthContext";

import { driverService } from "@/src/services/driverService";
import { vehicleService } from "@/src/services/vehicleService";
import { routeService } from "@/src/services/routeService";
import { collectionService } from "@/src/services/collectionService";
import { scheduleService } from "@/src/services/scheduleService";

type HomeStats = {
  coletasHoje: number;
  totalKg: number;
  alertas: number;
  motoristas: number;
  veiculos: number;
  rotasAtivas: number;
};

function parseDate(value?: string | null) {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isToday(date: Date) {
  const now = new Date();

  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

function getSettledValue<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

export default function CooperativaHomeScreen() {
  const { user, signOut } = useAuth();

  const [currentCity, setCurrentCity] = useState<string>("Carregando localização...");
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);

  const [stats, setStats] = useState<HomeStats>({
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

  const loadHomeStats = useCallback(async () => {
    try {
      setLoadingStats(true);

      const results = await Promise.allSettled([
        driverService.list(),
        vehicleService.list(),
        routeService.list(),
        collectionService.list(),
        scheduleService.list(),
      ]);

      const drivers = getSettledValue(results[0], []);
      const vehicles = getSettledValue(results[1], []);
      const routes = getSettledValue(results[2], []);
      const collections = getSettledValue(results[3], []);
      const schedules = getSettledValue(results[4], []);

      const totalKg = collections.reduce((acc, item: any) => {
        const value = Number(item.totalWeightKg ?? 0);
        return acc + (Number.isFinite(value) ? value : 0);
      }, 0);

      const coletasHoje = schedules.filter((item: any) => {
        const date =
          parseDate(item.scheduledDate) ||
          parseDate(item.preferredDate) ||
          parseDate(item.createdAt);

        return date ? isToday(date) : false;
      }).length;

      const alertas = schedules.filter(
        (item: any) => item.status === "REQUESTED" || item.status === "SCHEDULED"
      ).length;

      const rotasAtivas = routes.filter(
        (item: any) => item.status === "SCHEDULED" || item.status === "IN_PROGRESS"
      ).length;

      setStats({
        coletasHoje,
        totalKg,
        alertas,
        motoristas: drivers.length,
        veiculos: vehicles.length,
        rotasAtivas,
      });
    } catch (error) {
      console.error("Erro ao carregar resumo da cooperativa:", error);
      Alert.alert("Erro", "Não foi possível carregar os dados da cooperativa.");
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHomeStats();
    }, [loadHomeStats])
  );

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

  async function handleSignOut() {
    Alert.alert("Sair", "Deseja encerrar a sessão da cooperativa?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: async () => {
          await signOut();
        },
      },
    ]);
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
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
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

          <TouchableOpacity activeOpacity={0.8} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <Text
          style={{
            fontSize: 26,
            fontWeight: "700",
            color: "#FFFFFF",
            marginTop: 20,
            textAlign: "center",
          }}
        >
          {user?.displayName || "Cooperativa"}
        </Text>

        <Text
          style={{
            fontSize: 14,
            color: "#FFFFFF",
            opacity: 0.9,
            marginTop: 6,
            textAlign: "center",
          }}
        >
          Painel da cooperativa
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

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
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
            <View style={{ alignItems: "center", paddingVertical: 20 }}>
              <ActivityIndicator size="small" color="#028C56" />
              <Text style={{ marginTop: 10, color: "#6B7280" }}>
                Carregando resumo...
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