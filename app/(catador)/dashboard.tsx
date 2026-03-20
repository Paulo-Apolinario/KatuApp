import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  collectionService,
  type Collection,
} from "@/src/services/collectionService";

function formatDate(date?: string | null) {
  if (!date) return "-";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("pt-BR");
}

export default function CollectorDashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [collections, setCollections] = useState<Collection[]>([]);

  useEffect(() => {
    const loadCollections = async () => {
      try {
        setLoading(true);
        const response = await collectionService.list();
        setCollections(response);
      } catch (error) {
        console.error("Erro ao carregar dashboard do catador:", error);
        setCollections([]);
      } finally {
        setLoading(false);
      }
    };

    loadCollections();
  }, []);

  const completedCollections = useMemo(() => {
    return collections.filter((item) => item.status === "COMPLETED");
  }, [collections]);

  const totalKg = useMemo(() => {
    return completedCollections.reduce(
      (acc, item) => acc + Number(item.totalWeightKg || 0),
      0
    );
  }, [completedCollections]);

  const lastCollection = useMemo(() => {
    const ordered = [...completedCollections].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    return ordered[0] || null;
  }, [completedCollections]);

  const topMaterials = useMemo(() => {
    const counter: Record<string, number> = {};

    completedCollections.forEach((item) => {
      (item.materials || []).forEach((material) => {
        counter[material] = (counter[material] || 0) + 1;
      });
    });

    return Object.entries(counter)
      .map(([material, count]) => ({ material, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [completedCollections]);

  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <LinearGradient
        colors={["#10F35D", "#028C56"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          paddingTop: 24,
          paddingBottom: 24,
          paddingHorizontal: 20,
        }}
      >
        <Text style={{ fontSize: 24, fontWeight: "800", color: "#FFFFFF" }}>
          Resumo do Catador
        </Text>
        <Text style={{ color: "#E8FFF1", marginTop: 6 }}>
          Visão consolidada da operação
        </Text>
      </LinearGradient>

      <ScrollView style={{ flex: 1, padding: 20 }}>
        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <ActivityIndicator size="large" color="#028C56" />
            <Text style={{ marginTop: 10, color: "#6B7280" }}>
              Carregando resumo...
            </Text>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: "row", marginBottom: 20 }}>
              <View
                style={{
                  flex: 1,
                  backgroundColor: "#F0FDF4",
                  padding: 18,
                  borderRadius: 16,
                  marginRight: 8,
                }}
              >
                <Text style={{ color: "#4B5563", marginBottom: 6 }}>
                  Total coletado
                </Text>
                <Text style={{ fontSize: 28, fontWeight: "800", color: "#028C56" }}>
                  {totalKg} kg
                </Text>
              </View>

              <View
                style={{
                  flex: 1,
                  backgroundColor: "#EFF6FF",
                  padding: 18,
                  borderRadius: 16,
                  marginLeft: 8,
                }}
              >
                <Text style={{ color: "#4B5563", marginBottom: 6 }}>
                  Coletas concluídas
                </Text>
                <Text style={{ fontSize: 28, fontWeight: "800", color: "#2563EB" }}>
                  {completedCollections.length}
                </Text>
              </View>
            </View>

            <View
              style={{
                backgroundColor: "#F9FAFB",
                borderRadius: 16,
                padding: 18,
                marginBottom: 20,
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: "#111827",
                  marginBottom: 10,
                }}
              >
                Última coleta concluída
              </Text>

              {lastCollection ? (
                <>
                  <Text style={{ color: "#4B5563", marginBottom: 4 }}>
                    Data: {formatDate(lastCollection.createdAt)}
                  </Text>
                  <Text style={{ color: "#4B5563", marginBottom: 4 }}>
                    Peso: {lastCollection.totalWeightKg} kg
                  </Text>
                  <Text style={{ color: "#4B5563" }}>
                    Materiais: {(lastCollection.materials || []).join(", ") || "-"}
                  </Text>
                </>
              ) : (
                <Text style={{ color: "#6B7280" }}>
                  Ainda não há coletas concluídas.
                </Text>
              )}
            </View>

            <View
              style={{
                backgroundColor: "#F9FAFB",
                borderRadius: 16,
                padding: 18,
                marginBottom: 30,
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: "#111827",
                  marginBottom: 12,
                }}
              >
                Materiais mais recorrentes
              </Text>

              {topMaterials.length > 0 ? (
                topMaterials.map((item) => (
                  <View
                    key={item.material}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      paddingVertical: 8,
                      borderBottomWidth: 1,
                      borderBottomColor: "#E5E7EB",
                    }}
                  >
                    <Text style={{ color: "#374151" }}>{item.material}</Text>
                    <Text style={{ fontWeight: "700", color: "#028C56" }}>
                      {item.count}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={{ color: "#6B7280" }}>
                  Ainda não há dados suficientes para exibir materiais.
                </Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}