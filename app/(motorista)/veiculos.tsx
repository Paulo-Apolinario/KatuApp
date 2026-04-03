import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
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
import { vehicleService, Vehicle } from "@/src/services/vehicleService";

function StatusBadge({ status }: { status: string }) {
  const isMaintenance = status === "MAINTENANCE";
  const isInactive = status === "INACTIVE";

  const backgroundColor = isMaintenance
    ? "#FEF3C7"
    : isInactive
    ? "#FEE2E2"
    : "#DCFCE7";

  const color = isMaintenance ? "#B45309" : isInactive ? "#B91C1C" : "#166534";

  const labelMap: Record<string, string> = {
    ACTIVE: "ATIVO",
    MAINTENANCE: "MANUTENÇÃO",
    INACTIVE: "INATIVO",
  };

  return (
    <View
      style={{
        alignSelf: "flex-start",
        marginTop: 12,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor,
      }}
    >
      <Text style={{ color, fontWeight: "800", fontSize: 12 }}>
        {labelMap[status] || status}
      </Text>
    </View>
  );
}

export default function MotoristaVeiculosScreen() {
  const { user } = useAuth();
  const driverId = user?.driver?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadVehicle = useCallback(
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

        const currentVehicle = await vehicleService.getCurrentByDriver(driverId);
        setVehicle(currentVehicle);
      } catch (err: any) {
        setError(err?.message || "Não foi possível carregar o veículo.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [driverId]
  );

  useFocusEffect(
    useCallback(() => {
      void loadVehicle();
    }, [loadVehicle])
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
      <LinearGradient
        colors={["#10F35D", "#028C56"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          paddingTop: 48,
          paddingBottom: 18,
          paddingHorizontal: 20,
          borderBottomLeftRadius: 26,
          borderBottomRightRadius: 26,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: "rgba(255,255,255,0.18)",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
            }}
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <View>
            <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "800" }}>
              Veículos
            </Text>
            <Text style={{ color: "#E8FFF1", fontSize: 13, marginTop: 2 }}>
              Veículo vinculado ao motorista
            </Text>
          </View>
        </View>
      </LinearGradient>

      {loading ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator size="large" color="#028C56" />
          <Text style={{ marginTop: 12, color: "#4B5563", fontWeight: "600" }}>
            Carregando veículo...
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 18, paddingBottom: 30 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadVehicle(true)}
              colors={["#028C56"]}
              tintColor="#028C56"
            />
          }
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

          {!vehicle ? (
            <View
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 18,
                padding: 16,
                marginBottom: 14,
              }}
            >
              <Text style={{ color: "#111827", fontSize: 18, fontWeight: "800" }}>
                Nenhum veículo vinculado
              </Text>
              <Text style={{ color: "#6B7280", marginTop: 10, lineHeight: 22 }}>
                Este motorista ainda não possui veículo associado.
              </Text>
            </View>
          ) : (
            <View
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 18,
                padding: 16,
                marginBottom: 14,
              }}
            >
              <Text style={{ color: "#111827", fontSize: 18, fontWeight: "800" }}>
                {vehicle.model}
              </Text>

              <Text style={{ color: "#6B7280", marginTop: 10 }}>
                Placa: {vehicle.plate}
              </Text>

              <Text style={{ color: "#6B7280", marginTop: 6 }}>
                Marca: {vehicle.brand || "Não informada"}
              </Text>

              <Text style={{ color: "#6B7280", marginTop: 6 }}>
                Ano: {vehicle.year ?? "Não informado"}
              </Text>

              <Text style={{ color: "#6B7280", marginTop: 6 }}>
                Capacidade:{" "}
                {vehicle.capacityKg != null
                  ? `${vehicle.capacityKg} kg`
                  : "Não informada"}
              </Text>

              <StatusBadge status={vehicle.status} />
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}