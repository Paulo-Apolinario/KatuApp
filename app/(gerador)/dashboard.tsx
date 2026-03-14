import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  collection,
  getDocs,
  query,
  where,
  limit,
} from "firebase/firestore";

import { db } from "@/src/services/firebaseConfig";
import { useAuth } from "@/src/contexts/AuthContext";

type ColetaItem = {
  id: string;
  dateLabel: string;
  kg: number;
  status: string;
  rawDate?: any;
};

type ProximaColeta = {
  id: string;
  dateLabel: string;
  cooperativaNome: string;
};

export default function GeradorDashboard() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);

  const [businessName, setBusinessName] = useState("GERADOR");
  const [address, setAddress] = useState("Endereço não informado");
  const [totalKg, setTotalKg] = useState(0);
  const [sequenciaVerde, setSequenciaVerde] = useState(0);

  const [ultimasColetas, setUltimasColetas] = useState<ColetaItem[]>([]);
  const [proximaColeta, setProximaColeta] = useState<ProximaColeta | null>(null);

  const formatDate = (value: any) => {
    try {
      if (!value) return "Sem data";

      if (typeof value?.toDate === "function") {
        return value.toDate().toLocaleDateString("pt-BR");
      }

      return new Date(value).toLocaleDateString("pt-BR");
    } catch {
      return "Sem data";
    }
  };

  const formatDateTime = (value: any) => {
    try {
      if (!value) return "Sem data";

      const date =
        typeof value?.toDate === "function" ? value.toDate() : new Date(value);

      return date.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Sem data";
    }
  };

  const loadDashboard = useCallback(async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const userQuery = query(
        collection(db, "users"),
        where("uid", "==", user.uid),
        limit(1)
      );

      const userSnap = await getDocs(userQuery);

      let geradorId = "";

      if (!userSnap.empty) {
        const userData: any = userSnap.docs[0].data();
        geradorId = userData.geradorId || "";
      }

      if (geradorId) {
        const geradorQuery = query(
          collection(db, "geradores"),
          where("__name__", "==", geradorId),
          limit(1)
        );

        const geradorSnap = await getDocs(geradorQuery);

        if (!geradorSnap.empty) {
          const geradorData: any = geradorSnap.docs[0].data();

          setBusinessName(
            geradorData.nome ||
              geradorData.companyName ||
              user.displayName ||
              "GERADOR"
          );

          setAddress(
            geradorData.endereco ||
              geradorData.address ||
              "Endereço não informado"
          );

          setTotalKg(
            Number(geradorData.kgTotal ?? geradorData.kgColetado ?? 0)
          );

          setSequenciaVerde(
            Number(geradorData.sequenciaVerde ?? geradorData.greenStreak ?? 0)
          );
        } else {
          setBusinessName(user.displayName || "GERADOR");
          setAddress("Endereço não informado");
          setTotalKg(0);
          setSequenciaVerde(0);
        }
      } else {
        setBusinessName(user.displayName || "GERADOR");
        setAddress("Endereço não informado");
        setTotalKg(0);
        setSequenciaVerde(0);
      }

      if (geradorId) {
        const coletasQuery = query(
          collection(db, "coletas"),
          where("geradorId", "==", geradorId)
        );

        const coletasSnap = await getDocs(coletasQuery);

        const listaColetas: ColetaItem[] = coletasSnap.docs
          .map((docSnap) => {
            const data: any = docSnap.data();
            const rawDate = data.createdAt || data.dataColeta || null;

            return {
              id: docSnap.id,
              rawDate,
              dateLabel: formatDate(rawDate),
              kg: Number(data.peso ?? data.kg ?? 0),
              status: data.status || "Concluído",
            };
          })
          .sort((a, b) => {
            const timeA = a.rawDate?.toDate
              ? a.rawDate.toDate().getTime()
              : a.rawDate
              ? new Date(a.rawDate).getTime()
              : 0;

            const timeB = b.rawDate?.toDate
              ? b.rawDate.toDate().getTime()
              : b.rawDate
              ? new Date(b.rawDate).getTime()
              : 0;

            return timeB - timeA;
          })
          .slice(0, 3);

        setUltimasColetas(listaColetas);
      } else {
        setUltimasColetas([]);
      }

      if (geradorId) {
        const agendamentosQuery = query(
          collection(db, "agendamentos"),
          where("geradorId", "==", geradorId)
        );

        const agendamentosSnap = await getDocs(agendamentosQuery);

        const futuros = agendamentosSnap.docs
          .map((docSnap) => {
            const data: any = docSnap.data();
            const dataAgenda =
              data.dataAgendada ||
              data.data ||
              data.scheduledAt ||
              data.createdAt ||
              null;

            return {
              id: docSnap.id,
              rawDate: dataAgenda,
              dateLabel: formatDateTime(dataAgenda),
              cooperativaNome:
                data.cooperativaNome ||
                data.cooperativaLabel ||
                "Cooperativa responsável",
              status: data.status || "agendado",
            };
          })
          .filter(
            (item) =>
              item.status !== "concluido" &&
              item.status !== "cancelado"
          )
          .sort((a, b) => {
            const timeA = a.rawDate?.toDate
              ? a.rawDate.toDate().getTime()
              : a.rawDate
              ? new Date(a.rawDate).getTime()
              : Number.MAX_SAFE_INTEGER;

            const timeB = b.rawDate?.toDate
              ? b.rawDate.toDate().getTime()
              : b.rawDate
              ? new Date(b.rawDate).getTime()
              : Number.MAX_SAFE_INTEGER;

            return timeA - timeB;
          });

        if (futuros.length > 0) {
          setProximaColeta({
            id: futuros[0].id,
            dateLabel: futuros[0].dateLabel,
            cooperativaNome: futuros[0].cooperativaNome,
          });
        } else {
          setProximaColeta(null);
        }
      } else {
        setProximaColeta(null);
      }
    } catch (error) {
      console.error("Erro ao carregar dashboard do gerador:", error);
      Alert.alert("Erro", "Não foi possível carregar os dados do painel.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

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
        <Text style={{ marginTop: 10, color: "#6B7280" }}>
          Carregando painel...
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
          paddingBottom: 30,
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
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <Image
              source={require("../../assets/images/logo.png")}
              resizeMode="contain"
              style={{ width: 40, height: 40, marginRight: 10 }}
            />
            <Text style={{ fontSize: 24, fontWeight: "800", color: "#FFFFFF" }}>
              KATU
            </Text>
          </View>

          <TouchableOpacity onPress={() => router.push("/(gerador)/profile")}>
            <Ionicons name="business-outline" size={40} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <Text
          style={{
            fontSize: 20,
            fontWeight: "700",
            color: "#FFFFFF",
            marginTop: 15,
          }}
        >
          {businessName}
        </Text>

        <Text style={{ fontSize: 14, color: "#FFFFFF", opacity: 0.9 }}>
          {address}
        </Text>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1, padding: 20 }}
      >
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
              Kg Coletados
            </Text>
            <Text style={{ fontSize: 32, fontWeight: "800", color: "#028C56" }}>
              {totalKg}kg
            </Text>
          </View>

          <View
            style={{
              flex: 1,
              backgroundColor: "#FEFCE8",
              borderRadius: 16,
              padding: 20,
              marginLeft: 10,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 14, color: "#4B5563", marginBottom: 8 }}>
              Sequência Verde
            </Text>
            <Text style={{ fontSize: 32, fontWeight: "800", color: "#CA8A04" }}>
              {sequenciaVerde}
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
            Últimas Coletas
          </Text>

          {ultimasColetas.length > 0 ? (
            ultimasColetas.map((item) => (
              <View
                key={item.id}
                style={{
                  backgroundColor: "#F9FAFB",
                  borderRadius: 12,
                  padding: 15,
                  marginBottom: 10,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: "#111827",
                    }}
                  >
                    {item.dateLabel}
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      color: "#6B7280",
                      marginTop: 2,
                    }}
                  >
                    {item.kg} kg coletados
                  </Text>
                </View>

                <View
                  style={{
                    backgroundColor: "#028C56",
                    borderRadius: 20,
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                  }}
                >
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 12,
                      fontWeight: "600",
                    }}
                  >
                    {item.status}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View
              style={{
                backgroundColor: "#F9FAFB",
                borderRadius: 12,
                padding: 18,
              }}
            >
              <Text style={{ color: "#6B7280" }}>
                Nenhuma coleta registrada ainda.
              </Text>
            </View>
          )}

          <TouchableOpacity onPress={() => router.push("../(gerador)/history")}>
            <Text
              style={{
                fontSize: 14,
                color: "#028C56",
                fontWeight: "600",
                textAlign: "center",
                marginTop: 10,
              }}
            >
              VER HISTÓRICO COMPLETO
            </Text>
          </TouchableOpacity>
        </View>

        <View
          style={{
            backgroundColor: "#F0FDF4",
            borderRadius: 16,
            padding: 20,
            marginBottom: 30,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "700",
              color: "#111827",
              marginBottom: 10,
            }}
          >
            Próxima Coleta
          </Text>

          {proximaColeta ? (
            <>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <Ionicons name="calendar-outline" size={20} color="#028C56" />
                <Text
                  style={{
                    fontSize: 16,
                    color: "#028C56",
                    marginLeft: 10,
                    fontWeight: "600",
                  }}
                >
                  {proximaColeta.dateLabel}
                </Text>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="location-outline" size={20} color="#028C56" />
                <Text
                  style={{
                    fontSize: 16,
                    color: "#028C56",
                    marginLeft: 10,
                    fontWeight: "600",
                  }}
                >
                  {proximaColeta.cooperativaNome}
                </Text>
              </View>
            </>
          ) : (
            <Text style={{ color: "#6B7280" }}>
              Nenhuma coleta agendada no momento.
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}