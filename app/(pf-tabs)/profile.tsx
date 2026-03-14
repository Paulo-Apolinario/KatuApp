import { router } from "expo-router";
import { useEffect, useState, useCallback } from "react";
import {
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

interface UserProfile {
  uid: string;
  displayName?: string;
  email?: string;
  cpf?: string;
  phone?: string;
  address?: string;
  createdAt?: any;
  totalKg?: number;
  greenStreak?: number;
  code?: string;
  userType?: string;
}

export default function ProfileScreen() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const carregarPerfil = useCallback(async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data() as UserProfile;

        setProfile({
          uid: user.uid,
          displayName: data.displayName || "",
          email: data.email || user.email || "",
          cpf: data.cpf || "",
          phone: data.phone || "",
          address: data.address || "",
          createdAt: data.createdAt || null,
          totalKg: data.totalKg || 0,
          greenStreak: data.greenStreak || 0,
          code: data.code || `KATU-${user.uid.slice(0, 8).toUpperCase()}`,
          userType: data.userType || "",
        });
      } else {
        setProfile({
          uid: user.uid,
          displayName: user.displayName || "Usuário",
          email: user.email || "",
          cpf: "",
          phone: "",
          address: "",
          createdAt: null,
          totalKg: 0,
          greenStreak: 0,
          code: `KATU-${user.uid.slice(0, 8).toUpperCase()}`,
          userType: "",
        });
      }
    } catch (error) {
      console.error("Erro ao carregar perfil:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, user?.email, user?.displayName]);

  useEffect(() => {
    carregarPerfil();
  }, [carregarPerfil]);

  const formatDate = (createdAt: any) => {
    if (!createdAt) return "Não informado";

    try {
      if (typeof createdAt?.toDate === "function") {
        return createdAt.toDate().toLocaleDateString("pt-BR");
      }

      return new Date(createdAt).toLocaleDateString("pt-BR");
    } catch {
      return "Não informado";
    }
  };

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
          Carregando perfil...
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
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text
            style={{
              fontSize: 20,
              fontWeight: "700",
              color: "#FFFFFF",
            }}
          >
            MEU PERFIL
          </Text>

          <TouchableOpacity>
            <Ionicons name="create-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={{ alignItems: "center", marginTop: 20 }}>
          <View
            style={{
              width: 100,
              height: 100,
              borderRadius: 50,
              backgroundColor: "#FFFFFF",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 15,
            }}
          >
            <Ionicons name="person" size={60} color="#028C56" />
          </View>

          <Text
            style={{
              fontSize: 20,
              fontWeight: "700",
              color: "#FFFFFF",
              textAlign: "center",
            }}
          >
            {profile?.displayName || "Usuário"}
          </Text>

          <Text
            style={{
              fontSize: 14,
              color: "#FFFFFF",
              opacity: 0.9,
              textAlign: "center",
              marginTop: 5,
            }}
          >
            {profile?.address?.trim() ? profile.address : "Endereço não informado"}
          </Text>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1, padding: 20 }}
      >
        <View style={{ marginBottom: 25 }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: "#111827",
              marginBottom: 15,
            }}
          >
            Meus dados
          </Text>

          <View
            style={{
              backgroundColor: "#F9FAFB",
              borderRadius: 12,
              padding: 15,
            }}
          >
            <View style={{ flexDirection: "row", marginBottom: 12 }}>
              <Text style={{ width: 120, fontSize: 14, color: "#6B7280" }}>
                CPF:
              </Text>
              <Text style={{ fontSize: 14, color: "#111827", fontWeight: "500", flex: 1 }}>
                {profile?.cpf?.trim() ? profile.cpf : "Não informado"}
              </Text>
            </View>

            <View style={{ flexDirection: "row", marginBottom: 12 }}>
              <Text style={{ width: 120, fontSize: 14, color: "#6B7280" }}>
                Contato:
              </Text>
              <Text style={{ fontSize: 14, color: "#111827", fontWeight: "500", flex: 1 }}>
                {profile?.phone?.trim() ? profile.phone : "Não informado"}
              </Text>
            </View>

            <View style={{ flexDirection: "row", marginBottom: 12 }}>
              <Text style={{ width: 120, fontSize: 14, color: "#6B7280" }}>
                Email:
              </Text>
              <Text style={{ fontSize: 14, color: "#111827", fontWeight: "500", flex: 1 }}>
                {profile?.email?.trim() ? profile.email : "Não informado"}
              </Text>
            </View>

            <View style={{ flexDirection: "row", marginBottom: 12 }}>
              <Text style={{ width: 120, fontSize: 14, color: "#6B7280" }}>
                Endereço:
              </Text>
              <Text style={{ fontSize: 14, color: "#111827", fontWeight: "500", flex: 1 }}>
                {profile?.address?.trim() ? profile.address : "Não informado"}
              </Text>
            </View>

            <View style={{ flexDirection: "row" }}>
              <Text style={{ width: 120, fontSize: 14, color: "#6B7280" }}>
                Cadastro:
              </Text>
              <Text style={{ fontSize: 14, color: "#111827", fontWeight: "500", flex: 1 }}>
                {formatDate(profile?.createdAt)}
              </Text>
            </View>
          </View>

          <TouchableOpacity style={{ marginTop: 10 }}>
            <Text
              style={{
                fontSize: 14,
                color: "#028C56",
                fontWeight: "600",
                textAlign: "right",
              }}
            >
              Editar informações
            </Text>
          </TouchableOpacity>
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
            Visão Geral
          </Text>

          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
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
              <Text style={{ fontSize: 28, fontWeight: "800", color: "#028C56" }}>
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
              <Text style={{ fontSize: 28, fontWeight: "800", color: "#CA8A04" }}>
                {profile?.greenStreak || 0}%
              </Text>
            </View>
          </View>
        </View>

        <View
          style={{
            backgroundColor: "#F9FAFB",
            borderRadius: 12,
            padding: 15,
            marginBottom: 30,
          }}
        >
          <Text style={{ fontSize: 14, color: "#6B7280", marginBottom: 5 }}>
            Código do usuário
          </Text>
          <Text style={{ fontSize: 20, fontWeight: "700", color: "#028C56" }}>
            {profile?.code || "Não informado"}
          </Text>
        </View>

        <TouchableOpacity
          style={{
            backgroundColor: "#F0FDF4",
            borderRadius: 12,
            padding: 15,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 30,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="document-text-outline" size={24} color="#028C56" />
            <Text
              style={{
                fontSize: 16,
                fontWeight: "600",
                color: "#028C56",
                marginLeft: 10,
              }}
            >
              Gerar comprovante
            </Text>
          </View>
          <Ionicons name="download-outline" size={24} color="#028C56" />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}