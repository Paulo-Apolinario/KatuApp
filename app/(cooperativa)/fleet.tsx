import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { collection, getDocs, query, where } from "firebase/firestore";

import { db } from "@/src/services/firebaseConfig";
import { useAuth } from "@/src/contexts/AuthContext";

type VehicleStatus = "ativo" | "manutencao" | "inativo";

interface Vehicle {
  id: string;
  modelo: string;
  placa: string;
  status: VehicleStatus;
  capacidade?: number;
  totalColetado?: number;
  cooperativaId: string;
}

export default function FleetScreen() {
  const { user } = useAuth();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFleet = useCallback(async () => {
    if (!user?.uid) {
      setVehicles([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const q = query(
        collection(db, "veiculos"),
        where("cooperativaId", "==", user.uid)
      );

      const snapshot = await getDocs(q);

      const list: Vehicle[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as Omit<Vehicle, "id">;

        return {
          id: docSnap.id,
          modelo: data.modelo || "Sem modelo",
          placa: data.placa || "Sem placa",
          status: data.status || "inativo",
          capacidade: Number(data.capacidade || 0),
          totalColetado: Number((data as any).totalColetado || 0),
          cooperativaId: data.cooperativaId,
        };
      });

      setVehicles(list);
    } catch (error) {
      console.error("Erro ao carregar frota:", error);
      Alert.alert("Erro", "Não foi possível carregar a frota.");
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadFleet();
  }, [loadFleet]);

  const summary = useMemo(() => {
    const ativos = vehicles.filter((v) => v.status === "ativo").length;
    const manutencao = vehicles.filter((v) => v.status === "manutencao").length;
    const inativos = vehicles.filter((v) => v.status === "inativo").length;
    const totalColetado = vehicles.reduce(
      (acc, item) => acc + Number(item.totalColetado || 0),
      0
    );

    return {
      ativos,
      manutencao,
      inativos,
      totalColetado,
    };
  }, [vehicles]);

  const getStatusColor = (status: VehicleStatus) => {
    switch (status) {
      case "ativo":
        return "#028C56";
      case "manutencao":
        return "#DC2626";
      case "inativo":
        return "#CA8A04";
      default:
        return "#6B7280";
    }
  };

  const getStatusLabel = (status: VehicleStatus) => {
    switch (status) {
      case "ativo":
        return "ATIVO";
      case "manutencao":
        return "MANUTENÇÃO";
      case "inativo":
        return "INATIVO";
      default:
        return "SEM STATUS";
    }
  };

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
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => router.replace("/(cooperativa)/home")}
            style={{ marginRight: 15 }}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={{ fontSize: 20, fontWeight: "700", color: "#FFFFFF" }}>
            PAINEL DA FROTA
          </Text>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, padding: 20 }}>
        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: 50 }}>
            <ActivityIndicator size="large" color="#028C56" />
            <Text style={{ marginTop: 12, color: "#6B7280" }}>
              Carregando frota...
            </Text>
          </View>
        ) : (
          <>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 25,
              }}
            >
              <View
                style={{
                  flex: 1,
                  backgroundColor: "#F0FDF4",
                  borderRadius: 16,
                  padding: 16,
                  marginRight: 10,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 14, color: "#4B5563", marginBottom: 5 }}>
                  Ativos
                </Text>
                <Text style={{ fontSize: 24, fontWeight: "800", color: "#028C56" }}>
                  {summary.ativos}
                </Text>
              </View>

              <View
                style={{
                  flex: 1,
                  backgroundColor: "#FEF2F2",
                  borderRadius: 16,
                  padding: 16,
                  marginRight: 10,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 14, color: "#4B5563", marginBottom: 5 }}>
                  Manutenção
                </Text>
                <Text style={{ fontSize: 24, fontWeight: "800", color: "#DC2626" }}>
                  {summary.manutencao}
                </Text>
              </View>

              <View
                style={{
                  flex: 1,
                  backgroundColor: "#FEFCE8",
                  borderRadius: 16,
                  padding: 16,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 14, color: "#4B5563", marginBottom: 5 }}>
                  Inativos
                </Text>
                <Text style={{ fontSize: 24, fontWeight: "800", color: "#CA8A04" }}>
                  {summary.inativos}
                </Text>
              </View>
            </View>

            <View
              style={{
                backgroundColor: "#F0FDF4",
                borderRadius: 16,
                padding: 20,
                alignItems: "center",
                marginBottom: 25,
              }}
            >
              <Text style={{ fontSize: 14, color: "#4B5563", marginBottom: 5 }}>
                Total de Resíduos Coletados
              </Text>
              <Text style={{ fontSize: 36, fontWeight: "800", color: "#028C56" }}>
                {summary.totalColetado} kg
              </Text>
            </View>

            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: "#111827",
                marginBottom: 15,
              }}
            >
              Veículos da Frota
            </Text>

            {vehicles.length === 0 ? (
              <View
                style={{
                  backgroundColor: "#F9FAFB",
                  borderRadius: 16,
                  padding: 24,
                  alignItems: "center",
                  marginBottom: 20,
                }}
              >
                <Ionicons name="car-outline" size={42} color="#9CA3AF" />
                <Text
                  style={{
                    fontSize: 16,
                    color: "#6B7280",
                    marginTop: 10,
                    textAlign: "center",
                  }}
                >
                  Nenhum veículo cadastrado na frota.
                </Text>
              </View>
            ) : (
              vehicles.map((vehicle) => (
                <View
                  key={vehicle.id}
                  style={{
                    backgroundColor: "#F9FAFB",
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 15,
                    borderLeftWidth: 4,
                    borderLeftColor: getStatusColor(vehicle.status),
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginBottom: 10,
                    }}
                  >
                    <Text style={{ fontSize: 16, fontWeight: "700", color: "#111827" }}>
                      {vehicle.modelo}
                    </Text>

                    <View
                      style={{
                        backgroundColor: getStatusColor(vehicle.status),
                        paddingHorizontal: 12,
                        paddingVertical: 4,
                        borderRadius: 20,
                      }}
                    >
                      <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "600" }}>
                        {getStatusLabel(vehicle.status)}
                      </Text>
                    </View>
                  </View>

                  <Text style={{ fontSize: 14, color: "#6B7280", marginBottom: 10 }}>
                    Placa: {vehicle.placa}
                  </Text>

                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <View>
                      <Text style={{ fontSize: 12, color: "#6B7280" }}>Coletado</Text>
                      <Text
                        style={{
                          fontSize: 20,
                          fontWeight: "700",
                          color: "#028C56",
                        }}
                      >
                        {vehicle.totalColetado || 0} kg
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() =>
                        router.push(`/(cooperativa)/veiculos/editar/${vehicle.id}` as any)
                      }
                      style={{
                        backgroundColor: "#FFFFFF",
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: "#D1D5DB",
                      }}
                    >
                      <Text style={{ color: "#4B5563", fontWeight: "600" }}>
                        DETALHES
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}

            <TouchableOpacity
              onPress={() => router.push("../(cooperativa)/veiculos/novo")}
              style={{
                backgroundColor: "#F0FDF4",
                borderRadius: 12,
                padding: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                marginTop: 10,
                marginBottom: 30,
                borderWidth: 1,
                borderColor: "#028C56",
                borderStyle: "dashed",
              }}
            >
              <Ionicons name="add-circle-outline" size={24} color="#028C56" />
              <Text
                style={{
                  fontSize: 16,
                  color: "#028C56",
                  fontWeight: "600",
                  marginLeft: 8,
                }}
              >
                ADICIONAR VEÍCULO
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}