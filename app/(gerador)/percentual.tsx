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

import {
  collectionService,
  type Collection,
} from "@/src/services/collectionService";

type MaterialStats = {
  name: string;
  count: number;
  percent: number;
  totalKg: number;
  color: string;
};

const materialColors = [
  "#06B6D4",
  "#EF4444",
  "#8B5CF6",
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EC4899",
  "#14B8A6",
];

export default function PercentualScreen() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadCollections = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);

      const response = await collectionService.list();
      setCollections(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error("Erro ao carregar percentual de coleta:", error);
      setCollections([]);
    } finally {
      if (showLoader) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCollections(true);
    }, [loadCollections])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCollections(false);
  }, [loadCollections]);

  const completedCollections = useMemo(() => {
    return collections.filter((item) => item.status === "COMPLETED");
  }, [collections]);

  const totalKg = useMemo(() => {
    return completedCollections.reduce(
      (sum, item) => sum + Number(item.totalWeightKg || 0),
      0
    );
  }, [completedCollections]);

  const totalCollections = completedCollections.length;

  const materials = useMemo<MaterialStats[]>(() => {
    const materialMap: Record<
      string,
      {
        count: number;
        totalKg: number;
      }
    > = {};

    completedCollections.forEach((collection) => {
      const weight = Number(collection.totalWeightKg || 0);
      const materialsInCollection = collection.materials || [];

      if (materialsInCollection.length === 0) return;

      const weightPerMaterial =
        materialsInCollection.length > 0
          ? weight / materialsInCollection.length
          : 0;

      materialsInCollection.forEach((material) => {
        const normalized = String(material).trim().toUpperCase();

        if (!materialMap[normalized]) {
          materialMap[normalized] = {
            count: 0,
            totalKg: 0,
          };
        }

        materialMap[normalized].count += 1;
        materialMap[normalized].totalKg += weightPerMaterial;
      });
    });

    const totalOccurrences = Object.values(materialMap).reduce(
      (sum, item) => sum + item.count,
      0
    );

    return Object.entries(materialMap)
      .map(([name, data], index) => ({
        name,
        count: data.count,
        totalKg: data.totalKg,
        percent:
          totalOccurrences > 0
            ? Math.round((data.count / totalOccurrences) * 100)
            : 0,
        color: materialColors[index % materialColors.length],
      }))
      .sort((a, b) => b.totalKg - a.totalKg);
  }, [completedCollections]);

  const metaBaseKg = 1000;
  const metaPercent = useMemo(() => {
    if (metaBaseKg <= 0) return 0;
    return (totalKg / metaBaseKg) * 100;
  }, [totalKg]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#FFFFFF",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color="#028C56" />
        <Text style={{ marginTop: 10, color: "#6B7280" }}>
          Carregando percentual...
        </Text>
      </View>
    );
  }

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
            onPress={() => router.back()}
            style={{ marginRight: 15 }}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: "700", color: "#FFFFFF" }}>
            IMPACTO DA COLETA
          </Text>
        </View>

        <Text
          style={{
            fontSize: 14,
            color: "#FFFFFF",
            opacity: 0.9,
            marginTop: 8,
          }}
        >
          Acompanhe os resultados reais das coletas registradas
        </Text>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1, padding: 20 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View
          style={{
            backgroundColor: "#F0FDF4",
            borderRadius: 20,
            padding: 25,
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <Text style={{ fontSize: 16, color: "#4B5563", marginBottom: 10 }}>
            Total reciclado
          </Text>

          <Text
            style={{
              fontSize: 42,
              fontWeight: "800",
              color: "#028C56",
              textAlign: "center",
            }}
          >
            {totalKg.toFixed(1)} kg
          </Text>

          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 20,
              paddingHorizontal: 15,
              paddingVertical: 6,
              marginTop: 10,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                color: "#028C56",
                fontWeight: "600",
              }}
            >
              {metaPercent.toFixed(1)}% da meta base de {metaBaseKg} kg
            </Text>
          </View>
        </View>

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
              backgroundColor: "#EFF6FF",
              borderRadius: 16,
              padding: 18,
              marginRight: 8,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 13, color: "#4B5563", marginBottom: 6 }}>
              COLETAS CONCLUÍDAS
            </Text>
            <Text style={{ fontSize: 28, fontWeight: "800", color: "#2563EB" }}>
              {totalCollections}
            </Text>
          </View>

          <View
            style={{
              flex: 1,
              backgroundColor: "#FEF3C7",
              borderRadius: 16,
              padding: 18,
              marginLeft: 8,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 13, color: "#4B5563", marginBottom: 6 }}>
              MATERIAIS
            </Text>
            <Text style={{ fontSize: 28, fontWeight: "800", color: "#B45309" }}>
              {materials.length}
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
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: "#111827",
              marginBottom: 20,
            }}
          >
            Distribuição por material
          </Text>

          {materials.length > 0 ? (
            materials.map((item) => (
              <View key={item.name} style={{ marginBottom: 15 }}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
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
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "500",
                        color: "#374151",
                      }}
                    >
                      {item.name}
                    </Text>
                  </View>

                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "600",
                      color: "#111827",
                    }}
                  >
                    {item.percent}% ({item.totalKg.toFixed(1)} kg)
                  </Text>
                </View>

                <View
                  style={{
                    height: 10,
                    backgroundColor: "#E5E7EB",
                    borderRadius: 5,
                  }}
                >
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
          ) : (
            <View style={{ alignItems: "center", paddingVertical: 20 }}>
              <Ionicons name="pie-chart-outline" size={42} color="#9CA3AF" />
              <Text
                style={{
                  color: "#6B7280",
                  marginTop: 10,
                  textAlign: "center",
                }}
              >
                Ainda não há coletas concluídas suficientes para gerar o impacto.
              </Text>
            </View>
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
          <Text
            style={{
              fontSize: 16,
              fontWeight: "600",
              color: "#111827",
              marginBottom: 15,
            }}
          >
            Legenda
          </Text>

          {materials.length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {materials.map((item) => (
                <View
                  key={item.name}
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
                  <Text style={{ fontSize: 14, color: "#4B5563" }}>
                    {item.name}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ fontSize: 14, color: "#6B7280" }}>
              A legenda será exibida quando houver materiais registrados nas coletas.
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}