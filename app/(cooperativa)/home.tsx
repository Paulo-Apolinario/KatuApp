import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";

import { useAuth } from "@/src/contexts/AuthContext";
import {
  scheduleService,
  type Schedule,
} from "@/src/services/scheduleService";

type AuthUserLike = {
  id?: string;
  name?: string;
  displayName?: string;
  email?: string;
};

function formatDate(value?: string | null) {
  if (!value) return "Sem data";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem data";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function extractRequestedMaterials(notes?: string | null) {
  if (!notes) return [];

  const match = notes.match(/Materiais solicitados:\s*([^|]+)/i);
  if (!match) return [];

  return match[1]
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getScheduleOrigin(item: Schedule) {
  if (item.generatorId) return "GERADOR";
  if (item.requestedByUserId) return "PESSOA FÍSICA";
  return "SOLICITAÇÃO";
}

function getStatusLabel(status?: string) {
  switch (status) {
    case "REQUESTED":
      return "SOLICITADO";
    case "SCHEDULED":
      return "AGENDADO";
    case "IN_PROGRESS":
      return "EM ANDAMENTO";
    case "COMPLETED":
      return "CONCLUÍDO";
    case "CANCELLED":
      return "CANCELADO";
    default:
      return "SEM STATUS";
  }
}

function getStatusColor(status?: string) {
  switch (status) {
    case "REQUESTED":
      return "#F59E0B";
    case "SCHEDULED":
      return "#2563EB";
    case "IN_PROGRESS":
      return "#8B5CF6";
    case "COMPLETED":
      return "#10B981";
    case "CANCELLED":
      return "#DC2626";
    default:
      return "#6B7280";
  }
}

function getUserDisplayName(user: AuthUserLike | null) {
  return user?.displayName || user?.name || "Cooperativa";
}

type MenuCardProps = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  color: string;
  backgroundColor: string;
  borderColor: string;
};

function MenuCard({
  title,
  icon,
  onPress,
  color,
  backgroundColor,
  borderColor,
}: MenuCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={{
        width: "48%",
        backgroundColor,
        borderRadius: 30,
        borderWidth: 1,
        borderColor,
        paddingVertical: 14,
        paddingHorizontal: 12,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 14,
        minHeight: 140,
      }}
    >
      <View
        style={{
          width: 74,
          height: 74,
          borderRadius: 37,
          backgroundColor: "rgba(255,255,255,0.35)",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
        }}
      >
        <Ionicons name={icon} size={40} color={color} />
      </View>

      <Text
        style={{
          color,
          fontSize: 14,
          fontWeight: "800",
          textAlign: "center",
        }}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}

export default function CooperativeHomeScreen() {
  const { user } = useAuth();
  const currentUser = user as AuthUserLike | null;

  const [currentCity, setCurrentCity] = useState("Carregando localização...");
  const [locationError, setLocationError] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);

  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  const displayName = getUserDisplayName(currentUser);

  const getUserLocation = useCallback(async () => {
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
  }, []);

  const loadSchedules = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoadingSchedules(true);

      const data = await scheduleService.list();
      setSchedules(data);
    } catch (error: any) {
      console.error("Erro ao carregar agendamentos da home:", error);
      setSchedules([]);
    } finally {
      if (showLoader) setLoadingSchedules(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      getUserLocation();
      loadSchedules(true);
    }, [getUserLocation, loadSchedules])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([getUserLocation(), loadSchedules(false)]);
  }, [getUserLocation, loadSchedules]);

  const highlightedSchedules = useMemo(() => {
    return [...schedules]
      .filter(
        (item) =>
          item.status === "REQUESTED" ||
          item.status === "SCHEDULED" ||
          item.status === "IN_PROGRESS"
      )
      .sort((a, b) => {
        const aTime = new Date(
          a.scheduledDate || a.preferredDate || a.createdAt || 0
        ).getTime();
        const bTime = new Date(
          b.scheduledDate || b.preferredDate || b.createdAt || 0
        ).getTime();
        return bTime - aTime;
      })
      .slice(0, 4);
  }, [schedules]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#F3F4F6" }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 28 }}
    >
      <LinearGradient
        colors={["#10F35D", "#028C56"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          paddingTop: 34,
          paddingBottom: 26,
          paddingHorizontal: 20,
          borderBottomLeftRadius: 34,
          borderBottomRightRadius: 34,
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
              style={{ width: 44, height: 44, marginRight: 10 }}
            />
            <Text style={{ fontSize: 28, fontWeight: "900", color: "#FFFFFF" }}>
              KATUÁ
            </Text>
          </View>

          <TouchableOpacity onPress={() => router.replace("/(public)/access-type")}>
            <Ionicons name="log-out-outline" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={{ alignItems: "center", marginTop: 20 }}>
          <Text
            style={{
              fontSize: 32,
              fontWeight: "900",
              color: "#FFFFFF",
              textAlign: "center",
            }}
          >
            {displayName}
          </Text>

          <Text
            style={{
              fontSize: 16,
              fontWeight: "700",
              color: "#E8FFF1",
              marginTop: 6,
            }}
          >
            Painel da cooperativa
          </Text>

          <TouchableOpacity
            onPress={locationError ? getUserLocation : undefined}
            disabled={isLoadingLocation || !locationError}
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 14,
            }}
          >
            <Ionicons
              name={locationError ? "alert-circle-outline" : "location"}
              size={22}
              color="#FFFFFF"
            />
            <Text
              style={{
                fontSize: 18,
                fontWeight: "800",
                color: "#FFFFFF",
                marginLeft: 8,
              }}
            >
              {isLoadingLocation ? "Carregando..." : currentCity}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={{ paddingHorizontal: 20, paddingTop: 18 }}>
        <Text
          style={{
            fontSize: 20,
            fontWeight: "900",
            color: "#0F172A",
            marginBottom: 16,
          }}
        >
          Gestão da Cooperativa
        </Text>

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <MenuCard
            title="PEQUENO GERADOR"
            icon="storefront-outline"
             onPress={() =>
             router.push({
             pathname: "/(cooperativa)/geradores",
             params: { type: "SMALL" },
              })
               }
             color="#0B8F4D"
             backgroundColor="#E9F7F0"
              borderColor="#BFE6CF"
           />

          <MenuCard
           title="GRANDE GERADOR"
           icon="business-outline"
           onPress={() =>
           router.push({
           pathname: "/(cooperativa)/geradores",
           params: { type: "LARGE" },
           })
            }
           color="#2E63E6"
           backgroundColor="#EEF4FF"
           borderColor="#C7D8FF"
            />

          <MenuCard
            title="MOTORISTAS"
            icon="people-outline"
            onPress={() => router.push("/(cooperativa)/motoristas")}
            color="#11B27C"
            backgroundColor="#EAF8F3"
            borderColor="#BDE8D7"
          />

          <MenuCard
            title="VEÍCULOS"
            icon="car-outline"
            onPress={() => router.push("/(cooperativa)/veiculos")}
            color="#E59200"
            backgroundColor="#FFF8E8"
            borderColor="#F7E1A8"
          />

          <MenuCard
            title="ROTAS"
            icon="map-outline"
            onPress={() => router.push("/(cooperativa)/rotas")}
            color="#875CF6"
            backgroundColor="#F4ECFF"
            borderColor="#DEC8FF"
          />

          <MenuCard
            title="DASHBOARD"
            icon="speedometer-outline"
            onPress={() => router.push("/(cooperativa)/dashboard")}
            color="#875CF6"
            backgroundColor="#F4ECFF"
            borderColor="#DEC8FF"
          />

          <MenuCard
            title="PAINEL DA FROTA"
            icon="car-sport-outline"
            onPress={() => router.push("/(cooperativa)/fleet")}
            color="#C88700"
            backgroundColor="#FBF7E4"
            borderColor="#EAD9A1"
          />

          <MenuCard
            title="AGENDAMENTOS"
            icon="calendar-outline"
            onPress={() => router.push("/(cooperativa)/schedule")}
            color="#DC2626"
            backgroundColor="#FEF2F2"
            borderColor="#F6C7C7"
          />

          <MenuCard
            title="CATADORES"
            icon="people-circle-outline"
            onPress={() => router.push("/(cooperativa)/catadores")}
            color="#E5489B"
            backgroundColor="#FDECF5"
            borderColor="#F6C6DE"
          />
        </View>

        <Text
          style={{
            fontSize: 20,
            fontWeight: "900",
            color: "#0F172A",
            marginTop: 10,
            marginBottom: 14,
          }}
        >
          Agendamentos recentes
        </Text>

        {loadingSchedules ? (
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 18,
              padding: 24,
              borderWidth: 1,
              borderColor: "#E5E7EB",
              alignItems: "center",
            }}
          >
            <ActivityIndicator size="large" color="#028C56" />
            <Text style={{ marginTop: 12, color: "#6B7280" }}>
              Carregando agendamentos...
            </Text>
          </View>
        ) : highlightedSchedules.length === 0 ? (
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 18,
              padding: 24,
              borderWidth: 1,
              borderColor: "#E5E7EB",
              alignItems: "center",
            }}
          >
            <Ionicons name="calendar-outline" size={42} color="#9CA3AF" />
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: "#111827",
                marginTop: 10,
              }}
            >
              Nenhum agendamento ativo
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: "#6B7280",
                marginTop: 6,
                textAlign: "center",
              }}
            >
              Os agendamentos de geradores e PF aparecerão aqui.
            </Text>
          </View>
        ) : (
          highlightedSchedules.map((item) => {
            const materials = extractRequestedMaterials(item.notes);

            return (
              <View
                key={item.id}
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 18,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                  marginBottom: 12,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: "900",
                        color: "#0F172A",
                      }}
                    >
                      {item.generator?.companyName ||
                        item.generator?.name ||
                        "Solicitação sem gerador vinculado"}
                    </Text>

                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "800",
                        color: "#0B8F4D",
                        marginTop: 10,
                      }}
                    >
                      Origem: {getScheduleOrigin(item)}
                    </Text>

                    <Text style={{ fontSize: 14, color: "#6B7280", marginTop: 8 }}>
                      Endereço: {item.generator?.address || "Não informado"}
                    </Text>

                    <Text style={{ fontSize: 14, color: "#4B5563", marginTop: 6 }}>
                      Data:{" "}
                      {formatDate(
                        item.scheduledDate || item.preferredDate || item.createdAt
                      )}
                    </Text>

                    <Text style={{ fontSize: 14, color: "#4B5563", marginTop: 6 }}>
                      Materiais:{" "}
                      {materials.length > 0 ? materials.join(", ") : "Não informado"}
                    </Text>
                  </View>

                  <View style={{ alignItems: "flex-end" }}>
                    <View
                      style={{
                        backgroundColor: getStatusColor(item.status),
                        borderRadius: 999,
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                      }}
                    >
                      <Text
                        style={{
                          color: "#FFFFFF",
                          fontWeight: "900",
                          fontSize: 12,
                        }}
                      >
                        {getStatusLabel(item.status)}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() =>
                        router.push({
                          pathname: "/(cooperativa)/schedule/[id]",
                          params: { id: item.id },
                        })
                      }
                      style={{
                        marginTop: 16,
                        backgroundColor: "#FFFFFF",
                        borderColor: "#DC2626",
                        borderWidth: 1.5,
                        borderRadius: 12,
                        paddingHorizontal: 18,
                        paddingVertical: 10,
                      }}
                    >
                      <Text
                        style={{
                          color: "#DC2626",
                          fontWeight: "900",
                          fontSize: 14,
                        }}
                      >
                        ABRIR
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}