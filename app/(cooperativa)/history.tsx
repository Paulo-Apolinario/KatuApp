import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  collection,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";

import { db } from "@/src/services/firebaseConfig";

type CooperativaHistoryItem = {
  id: string;
  geradorNome: string;
  peso: number;
  status: string;
  dateLabel: string;
};

function formatDate(value: any) {
  try {
    if (!value) return "Sem data";

    if (typeof value?.toDate === "function") {
      return value.toDate().toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    return new Date(value).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Sem data";
  }
}

export default function CooperativaHistoryScreen() {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<CooperativaHistoryItem[]>([]);
  const [totalKg, setTotalKg] = useState(0);

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);

      const q = query(collection(db, "coletas"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);

      const items: CooperativaHistoryItem[] = snapshot.docs.map((docSnap) => {
        const data: any = docSnap.data();

        return {
          id: docSnap.id,
          geradorNome:
            data.geradorNome ||
            data.userName ||
            data.nome ||
            "Gerador não identificado",
          peso: Number(data.peso ?? data.kg ?? 0),
          status: data.status || "concluído",
          dateLabel: formatDate(data.createdAt || data.dataColeta || null),
        };
      });

      const total = items.reduce((acc, item) => acc + item.peso, 0);

      setHistory(items);
      setTotalKg(total);
    } catch (error) {
      console.error("Erro ao carregar histórico da cooperativa:", error);
      Alert.alert("Erro", "Não foi possível carregar o histórico.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#FFFFFF",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color="#028C56" />
        <Text style={{ marginTop: 12, color: "#6B7280" }}>
          Carregando histórico...
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
          paddingBottom: 24,
          paddingHorizontal: 20,
          borderBottomLeftRadius: 30,
          borderBottomRightRadius: 30,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 18,
          }}
        >
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={26} color="#FFFFFF" />
          </TouchableOpacity>

          <Text
            style={{
              fontSize: 22,
              fontWeight: "800",
              color: "#FFFFFF",
              marginLeft: 14,
            }}
          >
            Histórico da Cooperativa
          </Text>
        </View>

        <View
          style={{
            backgroundColor: "rgba(255,255,255,0.16)",
            borderRadius: 16,
            padding: 16,
          }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 14, opacity: 0.9 }}>
            Volume total coletado
          </Text>
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 30,
              fontWeight: "800",
              marginTop: 6,
            }}
          >
            {totalKg} kg
          </Text>
          <Text style={{ color: "#FFFFFF", fontSize: 13, marginTop: 6, opacity: 0.9 }}>
            {history.length} registro(s)
          </Text>
        </View>
      </LinearGradient>

      {history.length === 0 ? (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 30,
          }}
        >
          <Ionicons name="document-text-outline" size={54} color="#9CA3AF" />
          <Text
            style={{
              marginTop: 12,
              fontSize: 18,
              fontWeight: "700",
              color: "#111827",
            }}
          >
            Nenhum registro encontrado
          </Text>
          <Text
            style={{
              marginTop: 8,
              fontSize: 14,
              color: "#6B7280",
              textAlign: "center",
            }}
          >
            As coletas registradas aparecerão aqui para acompanhamento da cooperativa.
          </Text>
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 30 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View
              style={{
                backgroundColor: "#F9FAFB",
                borderRadius: 16,
                padding: 16,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: "#F3F4F6",
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
                      fontWeight: "700",
                      color: "#111827",
                    }}
                  >
                    {item.geradorNome}
                  </Text>

                  <Text
                    style={{
                      fontSize: 14,
                      color: "#6B7280",
                      marginTop: 6,
                    }}
                  >
                    Data: {item.dateLabel}
                  </Text>

                  <Text
                    style={{
                      fontSize: 14,
                      color: "#6B7280",
                      marginTop: 4,
                    }}
                  >
                    Peso: {item.peso} kg
                  </Text>
                </View>

                <View
                  style={{
                    backgroundColor: "#DCFCE7",
                    borderRadius: 999,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                  }}
                >
                  <Text
                    style={{
                      color: "#166534",
                      fontSize: 12,
                      fontWeight: "700",
                      textTransform: "capitalize",
                    }}
                  >
                    {item.status}
                  </Text>
                </View>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}