import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/src/contexts/AuthContext";
import {
  routeService,
  type RouteItem,
  translateRouteStatus,
} from "@/src/services/routeService";
import {
  type Vehicle,
  translateVehicleStatus,
} from "@/src/services/vehicleService";
import {
  collectionService,
  type Collection,
  translateCollectionStatus,
} from "@/src/services/collectionService";
import {
  driverService,
  type DriverProfile,
} from "@/src/services/driverService";

type QuickCardProps = {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

function QuickCard({ title, subtitle, icon, onPress }: QuickCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={{
        width: "48%",
        marginBottom: 14,
        borderRadius: 18,
        backgroundColor: "#FFFFFF",
        padding: 16,
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 3,
      }}
    >
      <LinearGradient
        colors={["#10F35D", "#028C56"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 14,
        }}
      >
        <Ionicons name={icon} size={24} color="#FFFFFF" />
      </LinearGradient>

      <Text
        style={{
          color: "#111827",
          fontSize: 16,
          fontWeight: "800",
          marginBottom: 6,
        }}
      >
        {title}
      </Text>

      <Text
        style={{
          color: "#6B7280",
          fontSize: 12,
          lineHeight: 18,
        }}
      >
        {subtitle}
      </Text>
    </TouchableOpacity>
  );
}

function StatItem({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={{ alignItems: "center", width: "30%" }}>
      <Text style={{ fontSize: 24, fontWeight: "800", color: "#028C56" }}>
        {value}
      </Text>
      <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
        {label}
      </Text>
    </View>
  );
}

export default function MotoristaHomeScreen() {
  const { user, signOut } = useAuth();
  const driverId = user?.driver?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [nextRoute, setNextRoute] = useState<RouteItem | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(() => {
    const activeRoutes = routes.filter(
      (item) => item.status === "SCHEDULED" || item.status === "IN_PROGRESS"
    );

    const activeCollections = collections.filter(
      (item) => item.status === "PENDING" || item.status === "IN_PROGRESS"
    );

    return {
      routes: activeRoutes.length,
      collections: activeCollections.length,
      vehicle: vehicle ? 1 : 0,
    };
  }, [routes, collections, vehicle]);

  const upcomingCollection = useMemo(() => {
    if (!nextRoute) return null;

    const routeCollections =
      collections.filter((item) => item.routeId === nextRoute.id) ||
      nextRoute.collections ||
      [];

    return routeCollections[0] ?? null;
  }, [nextRoute, collections]);

  const loadDashboard = useCallback(
    async (showRefresh = false) => {
      if (!driverId) {
        setError("Motorista não vinculado ao usuário autenticado.");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        setError(null);

        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const [driverProfile, driverRoutes, upcomingRoute, driverCollections] =
          await Promise.all([
            driverService.getMeWithVehicle(driverId),
            routeService.listByDriver(driverId),
            routeService.getNextRouteByDriver(driverId),
            collectionService.listByDriver(driverId),
          ]);

        setProfile(driverProfile);
        setRoutes(driverRoutes);
        setNextRoute(upcomingRoute);
        setVehicle(driverProfile.currentVehicle ?? null);
        setCollections(driverCollections);
      } catch (err: any) {
        setError(
          err?.message || "Não foi possível carregar o painel do motorista."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [driverId]
  );

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();
    }, [loadDashboard])
  );

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#F8FAFC",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color="#028C56" />
        <Text style={{ marginTop: 12, color: "#4B5563", fontWeight: "600" }}>
          Carregando painel do motorista...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
      <LinearGradient
        colors={["#028C56", "#10F35D"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingTop: 58,
          paddingHorizontal: 20,
          paddingBottom: 28,
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text
              style={{
                color: "#D1FAE5",
                fontSize: 13,
                fontWeight: "600",
                marginBottom: 4,
              }}
            >
              Painel do motorista
            </Text>

            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 26,
                fontWeight: "800",
              }}
            >
              Olá, {user?.displayName?.split(" ")[0] || "Motorista"}
            </Text>

            <Text
              style={{
                color: "#ECFDF5",
                fontSize: 13,
                marginTop: 8,
                lineHeight: 19,
              }}
            >
              {profile?.cooperative?.name
                ? `Operação vinculada à ${profile.cooperative.name}.`
                : "Acompanhe suas rotas, coletas, veículo e registros operacionais."}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => router.push("/(motorista)/profile")}
            style={{
              width: 50,
              height: 50,
              borderRadius: 25,
              backgroundColor: "rgba(255,255,255,0.18)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="person-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 18,
          paddingBottom: 30,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadDashboard(true)}
            colors={["#028C56"]}
            tintColor="#028C56"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {!!error && (
          <View
            style={{
              backgroundColor: "#FEF2F2",
              borderWidth: 1,
              borderColor: "#FECACA",
              borderRadius: 16,
              padding: 14,
              marginBottom: 16,
            }}
          >
            <Text style={{ color: "#B91C1C", fontWeight: "700" }}>{error}</Text>
          </View>
        )}

        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 18,
            padding: 16,
            marginBottom: 18,
            shadowColor: "#000",
            shadowOpacity: 0.06,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 3 },
            elevation: 2,
          }}
        >
          <Text
            style={{
              color: "#111827",
              fontSize: 16,
              fontWeight: "800",
              marginBottom: 12,
            }}
          >
            Resumo do dia
          </Text>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <StatItem value={summary.routes} label="Rotas" />
            <StatItem value={summary.collections} label="Coletas" />
            <StatItem value={summary.vehicle} label="Veículo" />
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() =>
            nextRoute
              ? router.push({
                  pathname: "/(motorista)/rotas",
                  params: { highlightRouteId: nextRoute.id },
                })
              : undefined
          }
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 18,
            padding: 16,
            marginBottom: 18,
          }}
        >
          <Text
            style={{
              color: "#111827",
              fontSize: 16,
              fontWeight: "800",
              marginBottom: 10,
            }}
          >
            Próxima rota
          </Text>

          {nextRoute ? (
            <>
              <Text
                style={{
                  color: "#028C56",
                  fontSize: 17,
                  fontWeight: "800",
                }}
              >
                {nextRoute.name}
              </Text>

              <Text style={{ color: "#6B7280", marginTop: 8 }}>
                Status: {translateRouteStatus(nextRoute.status)}
              </Text>

              <Text style={{ color: "#6B7280", marginTop: 6 }}>
                Data:{" "}
                {nextRoute.scheduledDate
                  ? new Date(nextRoute.scheduledDate).toLocaleString("pt-BR")
                  : "Não definida"}
              </Text>

              <Text style={{ color: "#6B7280", marginTop: 6 }}>
                Paradas: {nextRoute.stops?.length || 0}
              </Text>

              <Text style={{ color: "#6B7280", marginTop: 6 }}>
                Veículo:{" "}
                {vehicle
                  ? `${vehicle.plate} • ${vehicle.model}`
                  : "Não vinculado"}
              </Text>

              {upcomingCollection && (
                <Text style={{ color: "#6B7280", marginTop: 6 }}>
                  Próxima coleta:{" "}
                  {upcomingCollection.generator?.companyName ||
                    upcomingCollection.generator?.name ||
                    "Coleta vinculada"}{" "}
                  • {translateCollectionStatus(upcomingCollection.status)}
                </Text>
              )}

              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/(motorista)/rotas",
                    params: { highlightRouteId: nextRoute.id },
                  })
                }
                style={{
                  marginTop: 14,
                  alignSelf: "flex-start",
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor: "#ECFDF5",
                }}
              >
                <Text style={{ color: "#047857", fontWeight: "800" }}>
                  VER DETALHES DA ROTA
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={{ color: "#6B7280", lineHeight: 22 }}>
              Nenhuma rota ativa encontrada para este motorista no momento.
            </Text>
          )}
        </TouchableOpacity>

        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 18,
            padding: 16,
            marginBottom: 18,
          }}
        >
          <Text
            style={{
              color: "#111827",
              fontSize: 16,
              fontWeight: "800",
              marginBottom: 10,
            }}
          >
            Veículo atual
          </Text>

          {vehicle ? (
            <>
              <Text style={{ color: "#111827", fontSize: 16, fontWeight: "800" }}>
                {vehicle.plate}
              </Text>
              <Text style={{ color: "#6B7280", marginTop: 6 }}>
                Modelo: {vehicle.brand ? `${vehicle.brand} • ` : ""}
                {vehicle.model}
              </Text>
              <Text style={{ color: "#6B7280", marginTop: 6 }}>
                Situação: {translateVehicleStatus(vehicle.status)}
              </Text>
            </>
          ) : (
            <Text style={{ color: "#6B7280", lineHeight: 22 }}>
              Nenhum veículo vinculado ao motorista no momento.
            </Text>
          )}
        </View>
        <Text
          style={{
            color: "#111827",
            fontSize: 18,
            fontWeight: "800",
            marginBottom: 14,
          }}
        >
          Acessos rápidos
        </Text>

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
          <QuickCard
            title="Mapa"
            subtitle="Visualize cooperativa, rota e pontos de coleta"
            icon="map-outline"
            onPress={() => router.push("/(motorista)/mapa")}
          />

          <QuickCard
            title="Rotas"
            subtitle="Consulte rotas atribuídas, detalhes e navegação"
            icon="navigate-outline"
            onPress={() => router.push("/(motorista)/rotas")}
          />

          <QuickCard
            title="Calendário"
            subtitle="Veja sua agenda de coletas por dia"
            icon="calendar-outline"
            onPress={() => router.push("/(motorista)/calendario")}
          />

          <QuickCard
            title="Veículos"
            subtitle="Confira veículo, placa e situação atual"
            icon="car-outline"
            onPress={() => router.push("/(motorista)/veiculos")}
          />

          <QuickCard
            title="Relatórios"
            subtitle="Registre ocorrências operacionais"
            icon="document-text-outline"
            onPress={() => router.push("/(motorista)/relatorios")}
          />

          <QuickCard
            title="Perfil"
            subtitle="Consulte seus dados, cooperativa e veículo vinculado"
            icon="person-circle-outline"
            onPress={() => router.push("/(motorista)/profile")}
          />
        </View>

        <TouchableOpacity
          onPress={signOut}
          style={{
            marginTop: 10,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: "#FCA5A5",
            backgroundColor: "#FEF2F2",
            paddingVertical: 15,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              color: "#DC2626",
              fontWeight: "800",
              fontSize: 15,
            }}
          >
            SAIR
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}