import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  Image,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import {
  vehicleService,
  type Vehicle,
} from "@/src/services/vehicleService";

export default function VeiculosScreen() {
  const [veiculos, setVeiculos] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  const carregarVeiculos = useCallback(async () => {
    try {
      setLoading(true);
      const data = await vehicleService.list();
      setVeiculos(data);
    } catch (error) {
      console.error("Erro ao carregar veículos:", error);
      Alert.alert("Erro", "Não foi possível carregar os veículos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregarVeiculos();
    }, [carregarVeiculos])
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "#10B981";
      case "MAINTENANCE":
        return "#F59E0B";
      case "INACTIVE":
        return "#6B7280";
      default:
        return "#6B7280";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "ATIVO";
      case "MAINTENANCE":
        return "MANUTENÇÃO";
      case "INACTIVE":
        return "INATIVO";
      default:
        return status.toUpperCase();
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
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <TouchableOpacity onPress={() => router.replace("/(cooperativa)/home")}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Image
              source={require("../../../assets/images/logo.png")}
              resizeMode="contain"
              style={{ width: 36, height: 36, marginRight: 8 }}
            />
            <Text style={{ fontSize: 22, fontWeight: "800", color: "#FFFFFF" }}>
              KATUÁ
            </Text>
          </View>

          <TouchableOpacity onPress={() => router.push("/(cooperativa)/veiculos/novo")}>
            <Ionicons name="add-circle-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <Text
          style={{
            fontSize: 24,
            fontWeight: "700",
            color: "#FFFFFF",
            marginTop: 15,
          }}
        >
          VEÍCULOS
        </Text>

        <Text
          style={{
            fontSize: 14,
            color: "#FFFFFF",
            opacity: 0.9,
            marginTop: 5,
          }}
        >
          {veiculos.length} veículos cadastrados
        </Text>
      </LinearGradient>

      <ScrollView style={{ flex: 1, padding: 20 }} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <ActivityIndicator size="large" color="#028C56" />
            <Text style={{ marginTop: 12, color: "#6B7280" }}>
              Carregando veículos...
            </Text>
          </View>
        ) : veiculos.length > 0 ? (
          veiculos.map((veiculo) => (
            <TouchableOpacity
              key={veiculo.id}
              onPress={() =>
                router.push(`/(cooperativa)/veiculos/${veiculo.id}` as any)
              }
              activeOpacity={0.85}
              style={{
                backgroundColor: "#F9FAFB",
                borderRadius: 16,
                padding: 16,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: "#E5E7EB",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "700",
                      color: "#111827",
                    }}
                  >
                    {veiculo.model} - {veiculo.plate}
                  </Text>

                  {!!veiculo.brand && (
                    <Text style={{ fontSize: 14, color: "#6B7280", marginTop: 4 }}>
                      Marca: {veiculo.brand}
                    </Text>
                  )}

                  {veiculo.year !== null && veiculo.year !== undefined && (
                    <Text style={{ fontSize: 14, color: "#6B7280", marginTop: 4 }}>
                      Ano: {veiculo.year}
                    </Text>
                  )}

                  {veiculo.capacityKg !== null && veiculo.capacityKg !== undefined && (
                    <Text style={{ fontSize: 14, color: "#6B7280", marginTop: 4 }}>
                      Capacidade: {veiculo.capacityKg} kg
                    </Text>
                  )}
                </View>

                <View
                  style={{
                    backgroundColor: getStatusColor(veiculo.status),
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 12,
                  }}
                >
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 10,
                      fontWeight: "600",
                    }}
                  >
                    {getStatusText(veiculo.status)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <Ionicons name="car-outline" size={48} color="#9CA3AF" />
            <Text
              style={{
                fontSize: 16,
                color: "#6B7280",
                marginTop: 10,
                textAlign: "center",
              }}
            >
              Nenhum veículo cadastrado{"\n"}Clique no + para adicionar
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}