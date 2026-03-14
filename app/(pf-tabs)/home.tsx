import { router } from "expo-router";
import { useEffect, useState, useCallback } from "react";
import {
  Image,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/src/services/firebaseConfig";
import { useAuth } from "@/src/contexts/AuthContext";

interface UserHomeData {
  uid: string;
  displayName?: string;
  address?: string;
  totalKg?: number;
  greenStreak?: number;
}

interface HistoricoItem {
  nome: string;
  kg: number;
}

export default function PFHome() {
  const { user } = useAuth();

  const [profile, setProfile] = useState<UserHomeData | null>(null);
  const [loading, setLoading] = useState(true);

  const [historico] = useState<HistoricoItem[]>([
    { nome: "NILTON BRAZ", kg: 17 },
    { nome: "SALATYEL", kg: 15 },
    { nome: "JADE", kg: 14 },
    { nome: "GABRIEL", kg: 34 },
  ]);

  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul"];
  const valores = [40, 60, 45, 70, 55, 80, 65];

  const carregarHome = useCallback(async () => {
    if (!user?.uid) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data();

        setProfile({
          uid: user.uid,
          displayName: data.displayName || user.displayName || "Usuário",
          address: data.address || "Endereço não informado",
          totalKg: data.totalKg || 0,
          greenStreak: data.greenStreak || 0,
        });
      } else {
        setProfile({
          uid: user.uid,
          displayName: user.displayName || "Usuário",
          address: "Endereço não informado",
          totalKg: 0,
          greenStreak: 0,
        });
      }
    } catch (error) {
      console.error("Erro ao carregar dados da home:", error);
      setProfile({
        uid: user.uid,
        displayName: user.displayName || "Usuário",
        address: "Endereço não informado",
        totalKg: 0,
        greenStreak: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [user?.uid, user?.displayName]);

  useEffect(() => {
    carregarHome();
  }, [carregarHome]);

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
        <Text style={{ marginTop: 12, color: "#6B7280" }}>
          Carregando dados...
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
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Image
              source={require("../../assets/images/logo.png")}
              resizeMode="contain"
              style={{ width: 40, height: 40, marginRight: 10 }}
            />
            <Text style={{ fontSize: 24, fontWeight: "800", color: "#FFFFFF" }}>
              KATU
            </Text>
          </View>

          <TouchableOpacity onPress={() => router.push("/(pf-tabs)/profile")}>
            <Ionicons name="person-circle-outline" size={40} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <Text
          style={{
            fontSize: 22,
            fontWeight: "700",
            color: "#FFFFFF",
            marginTop: 15,
          }}
        >
          Olá, {profile?.displayName || "Usuário"}
        </Text>

        <Text
          style={{
            fontSize: 14,
            color: "#FFFFFF",
            opacity: 0.9,
          }}
        >
          {profile?.address || "Endereço não informado"}
        </Text>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1, paddingHorizontal: 20, paddingTop: 20 }}
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
              padding: 16,
              marginRight: 10,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 14, color: "#4B5563", marginBottom: 8 }}>
              Kg Coletados
            </Text>
            <Text
              style={{
                fontSize: 28,
                fontWeight: "800",
                color: "#028C56",
              }}
            >
              {profile?.totalKg || 0}kg
            </Text>
          </View>

          <View
            style={{
              flex: 1,
              backgroundColor: "#FEFCE8",
              borderRadius: 16,
              padding: 16,
              marginLeft: 10,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 14, color: "#4B5563", marginBottom: 8 }}>
              Sequência Verde
            </Text>
            <Text
              style={{
                fontSize: 28,
                fontWeight: "800",
                color: "#CA8A04",
              }}
            >
              {profile?.greenStreak || 0}%
            </Text>
          </View>
        </View>

        <View
          style={{
            backgroundColor: "#F9FAFB",
            borderRadius: 16,
            padding: 16,
            marginBottom: 25,
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
            Coletas Mensais
          </Text>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-around",
              alignItems: "flex-end",
              height: 120,
            }}
          >
            {meses.map((mes, index) => (
              <View key={index} style={{ alignItems: "center" }}>
                <View
                  style={{
                    width: 20,
                    height: valores[index],
                    backgroundColor: "#028C56",
                    borderRadius: 10,
                    marginBottom: 5,
                  }}
                />
                <Text style={{ fontSize: 12, color: "#6B7280" }}>{mes}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ marginBottom: 25 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 15,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#111827" }}>
              Histórico de Coletas
            </Text>
            <TouchableOpacity onPress={() => router.push("/(pf-tabs)/history")}>
              <Text
                style={{
                  fontSize: 14,
                  color: "#028C56",
                  fontWeight: "600",
                }}
              >
                VER MAIS
              </Text>
            </TouchableOpacity>
          </View>

          {historico.map((item, index) => (
            <View
              key={index}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingVertical: 12,
                borderBottomWidth: index < historico.length - 1 ? 1 : 0,
                borderBottomColor: "#F3F4F6",
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  color: "#111827",
                  fontWeight: "500",
                }}
              >
                {item.nome}
              </Text>
              <Text
                style={{
                  fontSize: 16,
                  color: "#028C56",
                  fontWeight: "700",
                }}
              >
                {item.kg}kg
              </Text>
            </View>
          ))}
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
            Conquistas
          </Text>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-around",
            }}
          >
            {[1, 2, 3].map((item) => (
              <View key={item} style={{ alignItems: "center" }}>
                <View
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 30,
                    backgroundColor: "#F0FDF4",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 5,
                  }}
                >
                  <Ionicons name="trophy" size={30} color="#028C56" />
                </View>
                <Text style={{ fontSize: 12, color: "#6B7280" }}>
                  Conquista {item}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}