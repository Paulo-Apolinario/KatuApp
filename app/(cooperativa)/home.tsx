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
  if (!value) return "Sem data agendada";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem data agendada";

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
  if (item.generatorId) return "Gerador";
  if (item.requestedByUserId) return "Pessoa física";
  return "Solicitação";
}

function getStatusLabel(status?: string) {
  switch (status) {
    case "REQUESTED":
      return "Solicitado";
    case "SCHEDULED":
      return "Agendado";
    case "IN_PROGRESS":
      return "Em andamento";
    case "COMPLETED":
      return "Concluído";
    case "CANCELLED":
      return "Cancelado";
    default:
      return "Sem status";
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
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  color: string;
  backgroundColor: string;
  borderColor: string;
};

function MenuCard({
  title,
  subtitle,
  icon,
  onPress,
  color,
  backgroundColor,
  borderColor,
}: MenuCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={{
        width: "48%",
        backgroundColor,
        borderRadius: 26,
        borderWidth: 1,
        borderColor,
        paddingVertical: 16,
        paddingHorizontal: 14,
        marginBottom: 14,
        minHeight: 150,
        justifyContent: "space-between",
      }}
    >
      <View
        style={{
          width: 62,
          height: 62,
          borderRadius: 31,
          backgroundColor: "rgba(255,255,255,0.45)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={30} color={color} />
      </View>

      <View>
        <Text
          style={{
            color,
            fontSize: 14,
            fontWeight: "900",
          }}
        >
          {title}
        </Text>

        <Text
          style={{
            color: "#475569",
            fontSize: 12,
            marginTop: 6,
            lineHeight: 17,
          }}
        >
          {subtitle}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function MetricCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View
      style={{
        width: "48.5%",
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: "#E5E7EB",
      }}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 21,
          backgroundColor: "#DCFCE7",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 10,
        }}
      >
        <Ionicons name={icon} size={20} color="#15803D" />
      </View>

      <Text style={{ fontSize: 13, color: "#6B7280" }}>{title}</Text>
      <Text
        style={{
          marginTop: 4,
          fontSize: 22,
          fontWeight: "800",
          color: "#111827",
        }}
      >
        {value}
      </Text>
    </View>
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
      setSchedules(Array.isArray(data) ? data : []);
    } catch (error) {
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
        const aTime = new Date(a.scheduledDate || a.createdAt || 0).getTime();
        const bTime = new Date(b.scheduledDate || b.createdAt || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 4);
  }, [schedules]);

  const homeMetrics = useMemo(() => {
    const requested = schedules.filter((item) => item.status === "REQUESTED").length;
    const scheduled = schedules.filter((item) => item.status === "SCHEDULED").length;
    const inProgress = schedules.filter((item) => item.status === "IN_PROGRESS").length;

    return {
      requested,
      scheduled,
      inProgress,
    };
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
          paddingBottom: 28,
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

        <View style={{ marginTop: 20 }}>
          <Text
            style={{
              fontSize: 30,
              fontWeight: "900",
              color: "#FFFFFF",
            }}
          >
            {displayName}
          </Text>

          <Text
            style={{
              fontSize: 15,
              fontWeight: "700",
              color: "#E8FFF1",
              marginTop: 6,
            }}
          >
            Central operacional da cooperativa
          </Text>

          <TouchableOpacity
            onPress={locationError ? getUserLocation : undefined}
            disabled={isLoadingLocation || !locationError}
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 14,
              alignSelf: "flex-start",
              backgroundColor: "rgba(255,255,255,0.16)",
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
          >
            <Ionicons
              name={locationError ? "alert-circle-outline" : "location"}
              size={18}
              color="#FFFFFF"
            />
            <Text
              style={{
                fontSize: 14,
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
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 18,
          }}
        >
          <MetricCard
            title="Solicitados"
            value={String(homeMetrics.requested)}
            icon="document-text-outline"
          />
          <MetricCard
            title="Agendados"
            value={String(homeMetrics.scheduled)}
            icon="calendar-outline"
          />
        </View>

        <View
          style={{
            marginBottom: 20,
          }}
        >
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 18,
              padding: 16,
              borderWidth: 1,
              borderColor: "#E5E7EB",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <View>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: "900",
                    color: "#0F172A",
                  }}
                >
                  Agendamentos recentes
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: "#64748B",
                    marginTop: 4,
                  }}
                >
                  Priorize a operação do dia e abra rapidamente os detalhes.
                </Text>
              </View>

              <TouchableOpacity onPress={() => router.push("/(cooperativa)/schedule")}>
                <Text
                  style={{
                    color: "#028C56",
                    fontWeight: "800",
                    fontSize: 10,
                  }}
                >
                </Text>
              </TouchableOpacity>
            </View>

            {loadingSchedules ? (
              <View
                style={{
                  alignItems: "center",
                  paddingVertical: 24,
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
                  alignItems: "center",
                  paddingVertical: 20,
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
                  Os agendamentos em aberto aparecerão aqui para acesso rápido.
                </Text>
              </View>
            ) : (
              highlightedSchedules.map((item) => {
                const materials = extractRequestedMaterials(item.notes);

                return (
                  <View
                    key={item.id}
                    style={{
                      backgroundColor: "#F8FAFC",
                      borderRadius: 16,
                      padding: 14,
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
                            fontSize: 16,
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
                            fontSize: 13,
                            fontWeight: "800",
                            color: "#0B8F4D",
                            marginTop: 8,
                          }}
                        >
                          Origem: {getScheduleOrigin(item)}
                        </Text>

                        <Text
                          style={{
                            fontSize: 13,
                            color: "#64748B",
                            marginTop: 8,
                          }}
                        >
                          Endereço: {item.generator?.address || "Não informado"}
                        </Text>

                        <Text
                          style={{
                            fontSize: 13,
                            color: "#475569",
                            marginTop: 6,
                          }}
                        >
                          Data agendada:{" "}
                          {formatDate(item.scheduledDate || item.createdAt)}
                        </Text>

                        <Text
                          style={{
                            fontSize: 13,
                            color: "#475569",
                            marginTop: 6,
                          }}
                        >
                          Materiais:{" "}
                          {materials.length > 0 ? materials.join(", ") : "Não informado"}
                        </Text>
                      </View>

                      <View style={{ alignItems: "flex-end" }}>
                        <View
                          style={{
                            backgroundColor: getStatusColor(item.status),
                            borderRadius: 999,
                            paddingHorizontal: 12,
                            paddingVertical: 7,
                          }}
                        >
                          <Text
                            style={{
                              color: "#FFFFFF",
                              fontWeight: "900",
                              fontSize: 11,
                            }}
                          >
                            {getStatusLabel(item.status)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View
                      style={{
                        flexDirection: "row",
                        marginTop: 14,
                        gap: 10,
                      }}
                    >
                      <TouchableOpacity
                        onPress={() =>
                          router.push({
                            pathname: "/(cooperativa)/schedule/[id]",
                            params: { id: item.id },
                          })
                        }
                        style={{
                          flex: 1,
                          backgroundColor: "#028C56",
                          borderRadius: 12,
                          paddingVertical: 11,
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            color: "#FFFFFF",
                            fontWeight: "900",
                            fontSize: 13,
                          }}
                        >
                          ABRIR
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => router.push("/(cooperativa)/mapas")}
                        style={{
                          flex: 1,
                          backgroundColor: "#EEF4FF",
                          borderColor: "#C7D8FF",
                          borderWidth: 1,
                          borderRadius: 12,
                          paddingVertical: 11,
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            color: "#2E63E6",
                            fontWeight: "900",
                            fontSize: 13,
                          }}
                        >
                          VER MAPA
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>

        <View
          style={{
            marginBottom: 14,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View>
            <Text
              style={{
                fontSize: 20,
                fontWeight: "900",
                color: "#0F172A",
              }}
            >
              Gestão da cooperativa
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: "#64748B",
                marginTop: 4,
              }}
            >
              Acesse os módulos principais da operação.
            </Text>
          </View>

          <View
            style={{
              backgroundColor: "#F3F4F6",
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
            }}
          >
            <Text
              style={{
                color: "#475569",
                fontWeight: "800",
                fontSize: 12,
              }}
            >
              Em rota: {homeMetrics.inProgress}
            </Text>
          </View>
        </View>

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <MenuCard
            title="PEQUENO GERADOR"
            subtitle="Cadastre, acompanhe e gerencie pequenos geradores."
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
            subtitle="Administre empresas e grandes pontos de coleta."
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
            subtitle="Organize equipe, vínculo e disponibilidade operacional."
            icon="people-outline"
            onPress={() => router.push("/(cooperativa)/motoristas")}
            color="#11B27C"
            backgroundColor="#EAF8F3"
            borderColor="#BDE8D7"
          />

          <MenuCard
            title="VEÍCULOS"
            subtitle="Controle a frota e acompanhe uso dos veículos."
            icon="car-outline"
            onPress={() => router.push("/(cooperativa)/veiculos")}
            color="#E59200"
            backgroundColor="#FFF8E8"
            borderColor="#F7E1A8"
          />

          <MenuCard
            title="ROTAS"
            subtitle="Crie e acompanhe trajetos operacionais da coleta."
            icon="git-network-outline"
            onPress={() => router.push("/(cooperativa)/rotas")}
            color="#875CF6"
            backgroundColor="#F4ECFF"
            borderColor="#DEC8FF"
          />

          <MenuCard
            title="MAPAS"
            subtitle="Visualize a localização das coletas e futuras rotas."
            icon="map-outline"
            onPress={() => router.push("/(cooperativa)/mapas")}
            color="#0F766E"
            backgroundColor="#ECFEFF"
            borderColor="#BDEFF3"
          />

          <MenuCard
            title="DASHBOARD"
            subtitle="Acompanhe indicadores, produtividade e visão geral."
            icon="speedometer-outline"
            onPress={() => router.push("/(cooperativa)/dashboard")}
            color="#7C3AED"
            backgroundColor="#F5F3FF"
            borderColor="#DDD6FE"
          />

          <MenuCard
            title="PAINEL DA FROTA"
            subtitle="Central de apoio para logística, veículos e operação."
            icon="car-sport-outline"
            onPress={() => router.push("/(cooperativa)/fleet")}
            color="#C88700"
            backgroundColor="#FBF7E4"
            borderColor="#EAD9A1"
          />

          <MenuCard
            title="AGENDAMENTOS"
            subtitle="Gerencie solicitações, datas e execução das coletas."
            icon="calendar-outline"
            onPress={() => router.push("/(cooperativa)/schedule")}
            color="#DC2626"
            backgroundColor="#FEF2F2"
            borderColor="#F6C7C7"
          />

          <MenuCard
            title="CATADORES"
            subtitle="Gerencie catadores, vínculos e operação em campo."
            icon="people-circle-outline"
            onPress={() => router.push("/(cooperativa)/catadores")}
            color="#E5489B"
            backgroundColor="#FDECF5"
            borderColor="#F6C6DE"
          />
        </View>
      </View>
    </ScrollView>
  );
}