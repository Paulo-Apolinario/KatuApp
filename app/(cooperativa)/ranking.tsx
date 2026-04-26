import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNotification } from "@/src/contexts/NotificationContext";

import { generatorService } from "@/src/services/generatorService";
import { collectorService } from "@/src/services/collectorService";

type RankingItem = {
  id: string;
  name: string;
  value: number;
  type: "gerador" | "catador";
};

export default function CooperativaRankingScreen() {
  const [loading, setLoading] = useState(true);
  const [rankingGeradores, setRankingGeradores] = useState<RankingItem[]>([]);
  const [rankingCatadores, setRankingCatadores] = useState<RankingItem[]>([]);
  const { notifyError } = useNotification();

  const loadRanking = useCallback(async () => {
    try {
      setLoading(true);

      const [generators, collectors] = await Promise.all([
        generatorService.list(),
        collectorService.list(),
      ]);

      const geradoresOrdenados: RankingItem[] = generators
        .map((item) => ({
          id: item.id,
          name: item.companyName || item.name || "Gerador sem nome",
          value: Number((item as any).totalKg ?? 0),
          type: "gerador" as const,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

      const catadoresOrdenados: RankingItem[] = collectors
        .map((item) => ({
          id: item.id,
          name: item.name || "Catador sem nome",
          value: Number((item as any).totalKg ?? 0),
          type: "catador" as const,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

      setRankingGeradores(geradoresOrdenados);
      setRankingCatadores(catadoresOrdenados);
    } catch (error: any) {
      console.error("Erro ao carregar ranking:", error);
      notifyError("Não foi possível carregar o ranking.");
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useFocusEffect(
    useCallback(() => {
      loadRanking();
    }, [loadRanking])
  );

  const topGerador = useMemo(() => rankingGeradores[0] ?? null, [rankingGeradores]);
  const topCatador = useMemo(() => rankingCatadores[0] ?? null, [rankingCatadores]);

  function renderRankingList(items: RankingItem[], emptyText: string, color: string) {
    if (items.length === 0) {
      return (
        <View
          style={{
            backgroundColor: "#F9FAFB",
            borderRadius: 12,
            padding: 18,
          }}
        >
          <Text style={{ color: "#6B7280" }}>{emptyText}</Text>
        </View>
      );
    }

    return items.map((item, index) => (
      <View
        key={item.id}
        style={{
          backgroundColor: "#F9FAFB",
          borderRadius: 14,
          padding: 16,
          marginBottom: 10,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          borderLeftWidth: 4,
          borderLeftColor: color,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: color,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
            }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "800" }}>{index + 1}</Text>
          </View>

          <Text
            style={{
              fontSize: 15,
              fontWeight: "700",
              color: "#111827",
              flex: 1,
            }}
          >
            {item.name}
          </Text>
        </View>

        <Text
          style={{
            fontSize: 15,
            fontWeight: "800",
            color,
            marginLeft: 12,
          }}
        >
          {item.value} kg
        </Text>
      </View>
    ));
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
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={{ fontSize: 20, fontWeight: "700", color: "#FFFFFF" }}>
            RANKING
          </Text>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, padding: 20 }}>
        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: 50 }}>
            <ActivityIndicator size="large" color="#028C56" />
            <Text style={{ marginTop: 12, color: "#6B7280" }}>
              Carregando ranking...
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
                  backgroundColor: "#EFF6FF",
                  borderRadius: 16,
                  padding: 16,
                  marginRight: 10,
                }}
              >
                <Text style={{ fontSize: 13, color: "#4B5563" }}>Top Gerador</Text>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "800",
                    color: "#2563EB",
                    marginTop: 6,
                  }}
                >
                  {topGerador?.name || "Sem dados"}
                </Text>
                <Text style={{ fontSize: 13, color: "#2563EB", marginTop: 6 }}>
                  {topGerador ? `${topGerador.value} kg` : "0 kg"}
                </Text>
              </View>

              <View
                style={{
                  flex: 1,
                  backgroundColor: "#FCE7F3",
                  borderRadius: 16,
                  padding: 16,
                  marginLeft: 10,
                }}
              >
                <Text style={{ fontSize: 13, color: "#4B5563" }}>Top Catador</Text>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "800",
                    color: "#DB2777",
                    marginTop: 6,
                  }}
                >
                  {topCatador?.name || "Sem dados"}
                </Text>
                <Text style={{ fontSize: 13, color: "#DB2777", marginTop: 6 }}>
                  {topCatador ? `${topCatador.value} kg` : "0 kg"}
                </Text>
              </View>
            </View>

            <View style={{ marginBottom: 25 }}>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: "#111827",
                  marginBottom: 15,
                }}
              >
                Ranking de Geradores
              </Text>

              {renderRankingList(
                rankingGeradores,
                "Nenhum gerador com volume registrado ainda.",
                "#2563EB"
              )}
            </View>

            <View style={{ marginBottom: 30 }}>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: "#111827",
                  marginBottom: 15,
                }}
              >
                Ranking de Catadores
              </Text>

              {renderRankingList(
                rankingCatadores,
                "Nenhum catador com volume registrado ainda.",
                "#DB2777"
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}