import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Text, View, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { collectionService } from "@/src/services/collectionService";

type MaterialCard = {
  name: string;
  percent: number;
  color: string;
  value: number;
};

export default function PercentualScreen() {
  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<MaterialCard[]>([]);

  const loadPercentual = useCallback(async () => {
    try {
      setLoading(true);

      const collections = await collectionService.list();

      const statusGroups = [
        {
          name: "CONCLUÍDAS",
          color: "#10B981",
          items: collections.filter((item) => item.status === "COMPLETED"),
        },
        {
          name: "EM ANDAMENTO",
          color: "#3B82F6",
          items: collections.filter((item) => item.status === "IN_PROGRESS"),
        },
        {
          name: "PENDENTES",
          color: "#F59E0B",
          items: collections.filter((item) => item.status === "PENDING"),
        },
        {
          name: "CANCELADAS",
          color: "#EF4444",
          items: collections.filter((item) => item.status === "CANCELLED"),
        },
      ];

      const weighted = statusGroups.map((group) => ({
        name: group.name,
        color: group.color,
        value: group.items.reduce((acc, item) => {
          const kg = Number(item.totalWeightKg ?? 0);
          return acc + (Number.isFinite(kg) ? kg : 0);
        }, 0),
      }));

      const total = weighted.reduce((sum, item) => sum + item.value, 0);

      const finalData: MaterialCard[] = weighted
        .filter((item) => item.value > 0)
        .map((item) => ({
          ...item,
          percent: total > 0 ? Math.round((item.value / total) * 100) : 0,
        }));

      setMaterials(finalData);
    } catch (error: any) {
      Alert.alert("Erro", error.message || "Não foi possível carregar os percentuais.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPercentual();
    }, [loadPercentual])
  );

  const total = useMemo(() => {
    return materials.reduce((sum, item) => sum + item.value, 0);
  }, [materials]);

  const metaPercent = total > 0 ? Math.min((total / 1000) * 100, 100) : 0;

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
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: "700", color: "#FFFFFF" }}>
            PERCENTUAL DE COLETA
          </Text>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, padding: 20 }}>
        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: 50 }}>
            <ActivityIndicator size="large" color="#028C56" />
            <Text style={{ marginTop: 12, color: "#6B7280" }}>
              Carregando percentuais...
            </Text>
          </View>
        ) : (
          <>
            <View
              style={{
                backgroundColor: "#F0FDF4",
                borderRadius: 20,
                padding: 25,
                alignItems: "center",
                marginBottom: 25,
              }}
            >
              <Text style={{ fontSize: 16, color: "#4B5563", marginBottom: 10 }}>
                Total Coletado
              </Text>
              <Text style={{ fontSize: 48, fontWeight: "800", color: "#028C56" }}>
                {total} kg
              </Text>
              <View
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 20,
                  paddingHorizontal: 15,
                  paddingVertical: 5,
                  marginTop: 10,
                }}
              >
                <Text style={{ fontSize: 14, color: "#028C56", fontWeight: "600" }}>
                  {metaPercent.toFixed(1)}% da meta de 1000 kg
                </Text>
              </View>
            </View>

            <View
              style={{
                backgroundColor: "#F9FAFB",
                borderRadius: 20,
                padding: 20,
                marginBottom: 25,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 20 }}>
                Distribuição Operacional
              </Text>

              {materials.length === 0 ? (
                <Text style={{ color: "#6B7280" }}>
                  Ainda não há dados suficientes para exibir a distribuição.
                </Text>
              ) : (
                materials.map((item, index) => (
                  <View key={index} style={{ marginBottom: 15 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <View
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: 6,
                            backgroundColor: item.color,
                            marginRight: 8,
                          }}
                        />
                        <Text style={{ fontSize: 15, fontWeight: "500", color: "#374151" }}>
                          {item.name}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 15, fontWeight: "600", color: "#111827" }}>
                        {item.percent}% ({item.value}kg)
                      </Text>
                    </View>
                    <View style={{ height: 10, backgroundColor: "#E5E7EB", borderRadius: 5 }}>
                      <View
                        style={{
                          width: `${item.percent}%`,
                          height: 10,
                          backgroundColor: item.color,
                          borderRadius: 5,
                        }}
                      />
                    </View>
                  </View>
                ))
              )}
            </View>

            <View
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 16,
                padding: 20,
                borderWidth: 1,
                borderColor: "#E5E7EB",
                marginBottom: 30,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 15 }}>
                Legenda
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {materials.map((item, index) => (
                  <View
                    key={index}
                    style={{
                      width: "50%",
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: 10,
                    }}
                  >
                    <View
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 8,
                        backgroundColor: item.color,
                        marginRight: 8,
                      }}
                    />
                    <Text style={{ fontSize: 14, color: "#4B5563" }}>{item.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}