import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { collectionService } from "@/src/services/collectionService";
import type { Collection, CollectionMaterial } from "@/src/types/collection";

function formatDate(value?: string | null) {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";

  return parsed.toLocaleDateString("pt-BR");
}

function normalizeMaterials(materials: unknown): CollectionMaterial[] {
  if (!Array.isArray(materials)) return [];

  return materials
    .map((item) => {
      if (typeof item === "string") {
        return { type: item, quantityKg: 0 };
      }

      if (
        item &&
        typeof item === "object" &&
        "type" in item
      ) {
        return {
          type: String((item as { type?: unknown }).type ?? "Não informado"),
          quantityKg: Number(
            (item as { quantityKg?: unknown }).quantityKg ?? 0
          ),
        };
      }

      return null;
    })
    .filter(Boolean) as CollectionMaterial[];
}

function getCollectionTotalKg(collection: Collection) {
  const materialsKg = (collection.materials ?? []).reduce(
    (sum, item) => sum + Number(item.quantityKg ?? 0),
    0
  );

  if (materialsKg > 0) return materialsKg;
  return Number(collection.totalWeightKg ?? 0);
}

export default function DataScreen() {
  const [loading, setLoading] = useState(true);
  const [collections, setCollections] = useState<Collection[]>([]);

  const loadCollections = async () => {
    try {
      setLoading(true);

      const response = await collectionService.list();

      const normalized = Array.isArray(response)
        ? response.map((item) => ({
            ...item,
            materials: normalizeMaterials(item.materials),
            totalWeightKg: Number(item.totalWeightKg ?? 0),
          }))
        : [];

      setCollections(normalized);
    } catch (error) {
      console.error("Erro ao carregar coletas:", error);
      setCollections([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCollections();
  }, []);

  const completedCollections = useMemo(() => {
    return collections.filter((item) => item.status === "COMPLETED");
  }, [collections]);

  const totalKg = useMemo(
    () =>
      completedCollections.reduce(
        (acc, item) => acc + getCollectionTotalKg(item),
        0
      ),
    [completedCollections]
  );

  const totalColetas = completedCollections.length;

  const materialPercentuais = useMemo(() => {
    const quantidadePorMaterial: Record<string, number> = {};

    completedCollections.forEach((coleta) => {
      (coleta.materials ?? []).forEach((material) => {
        const materialType = material.type?.trim() || "Não informado";
        const quantity = Number(material.quantityKg ?? 0);

        quantidadePorMaterial[materialType] =
          (quantidadePorMaterial[materialType] || 0) + quantity;
      });
    });

    const totalMateriaisKg = Object.values(quantidadePorMaterial).reduce(
      (acc, val) => acc + val,
      0
    );

    if (totalMateriaisKg === 0) return [];

    return Object.entries(quantidadePorMaterial)
      .map(([material, quantidadeKg], index) => ({
        material,
        quantityKg: quantidadeKg,
        percent: Math.round((quantidadeKg / totalMateriaisKg) * 100),
        color: [
          "#06B6D4",
          "#EF4444",
          "#8B5CF6",
          "#3B82F6",
          "#10B981",
          "#F59E0B",
        ][index % 6],
      }))
      .sort((a, b) => b.quantityKg - a.quantityKg);
  }, [completedCollections]);

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
            DADOS
          </Text>
        </View>

        <View
          style={{ flexDirection: "row", alignItems: "center", marginTop: 15 }}
        >
          <Image
            source={require("../../assets/images/logo.png")}
            resizeMode="contain"
            style={{ width: 30, height: 30, marginRight: 8 }}
          />
          <Text
            style={{
              fontSize: 18,
              fontWeight: "600",
              color: "#FFFFFF",
              opacity: 0.9,
            }}
          >
            KATUÁ
          </Text>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1, padding: 20 }}
      >
        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <ActivityIndicator size="large" color="#028C56" />
            <Text style={{ marginTop: 10, color: "#6B7280" }}>
              Carregando dados...
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
                  padding: 20,
                  marginRight: 10,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 14, color: "#4B5563", marginBottom: 8 }}>
                  TOTAL COLETADO
                </Text>
                <Text style={{ fontSize: 28, fontWeight: "800", color: "#028C56" }}>
                  {totalKg.toFixed(1)} kg
                </Text>
              </View>

              <View
                style={{
                  flex: 1,
                  backgroundColor: "#EFF6FF",
                  borderRadius: 16,
                  padding: 20,
                  marginLeft: 10,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 14, color: "#4B5563", marginBottom: 8 }}>
                  TOTAL DE COLETAS
                </Text>
                <Text style={{ fontSize: 28, fontWeight: "800", color: "#2563EB" }}>
                  {totalColetas}
                </Text>
              </View>
            </View>

            <View
              style={{
                backgroundColor: "#F9FAFB",
                borderRadius: 16,
                padding: 20,
                marginBottom: 20,
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: "#111827",
                  marginBottom: 15,
                }}
              >
                Histórico de Coletas
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  backgroundColor: "#E5E7EB",
                  borderRadius: 8,
                  padding: 10,
                  marginBottom: 10,
                }}
              >
                <Text style={{ flex: 1, fontWeight: "600", color: "#374151" }}>
                  DATA
                </Text>
                <Text style={{ flex: 1, fontWeight: "600", color: "#374151" }}>
                  STATUS
                </Text>
                <Text style={{ flex: 1, fontWeight: "600", color: "#374151" }}>
                  KG
                </Text>
              </View>

              {completedCollections.length > 0 ? (
                completedCollections.map((item) => (
                  <View
                    key={item.id}
                    style={{
                      flexDirection: "row",
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: "#E5E7EB",
                    }}
                  >
                    <Text style={{ flex: 1, color: "#4B5563" }}>
                      {formatDate(item.collectedAt || item.createdAt)}
                    </Text>
                    <Text style={{ flex: 1, color: "#4B5563" }}>
                      {item.status}
                    </Text>
                    <Text
                      style={{ flex: 1, color: "#028C56", fontWeight: "600" }}
                    >
                      {getCollectionTotalKg(item).toFixed(1)} kg
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={{ color: "#6B7280", paddingVertical: 12 }}>
                  Nenhuma coleta concluída ainda.
                </Text>
              )}
            </View>

            <View
              style={{
                backgroundColor: "#F9FAFB",
                borderRadius: 16,
                padding: 20,
                marginBottom: 30,
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: "#111827",
                  marginBottom: 15,
                }}
              >
                Percentual por Material
              </Text>

              {materialPercentuais.length > 0 ? (
                materialPercentuais.map((item, index) => (
                  <View key={`${item.material}-${index}`} style={{ marginBottom: 12 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        marginBottom: 4,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "500",
                          color: "#4B5563",
                        }}
                      >
                        {item.material}
                      </Text>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "600",
                          color: "#111827",
                        }}
                      >
                        {item.percent}% ({item.quantityKg.toFixed(1)} kg)
                      </Text>
                    </View>
                    <View
                      style={{
                        height: 8,
                        backgroundColor: "#E5E7EB",
                        borderRadius: 4,
                      }}
                    >
                      <View
                        style={{
                          width: `${item.percent}%`,
                          height: 8,
                          backgroundColor: item.color,
                          borderRadius: 4,
                        }}
                      />
                    </View>
                  </View>
                ))
              ) : (
                <Text style={{ color: "#6B7280" }}>
                  Ainda não há materiais suficientes para gerar o percentual.
                </Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}