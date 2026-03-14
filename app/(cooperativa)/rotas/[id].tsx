import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { deleteDoc, doc, getDoc, updateDoc } from "firebase/firestore";

import { db } from "@/src/services/firebaseConfig";
import { useAuth } from "@/src/contexts/AuthContext";

type RouteStatus = "agendada" | "em_andamento" | "concluida";

export default function RotaDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [rota, setRota] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadRota();
  }, [id]);

  async function loadRota() {
    if (!id || !user?.uid) {
      setLoading(false);
      return;
    }

    try {
      const docRef = doc(db, "rotas", id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        Alert.alert("Erro", "Rota não encontrada.");
        router.replace("/(cooperativa)/rotas");
        return;
      }

      const data: any = docSnap.data();

      if (data.cooperativaId !== user.uid) {
        Alert.alert("Erro", "Você não tem permissão para esta rota.");
        router.replace("/(cooperativa)/rotas");
        return;
      }

      setRota({
        id: docSnap.id,
        ...data,
      });
    } catch (error) {
      console.error("Erro ao carregar rota:", error);
      Alert.alert("Erro", "Não foi possível carregar a rota.");
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(newStatus: RouteStatus) {
    if (!id) return;

    try {
      setSavingStatus(true);

      await updateDoc(doc(db, "rotas", id), {
        status: newStatus,
      });

      setRota((prev: any) => ({
        ...prev,
        status: newStatus,
      }));
    } catch (error) {
      console.error("Erro ao atualizar status da rota:", error);
      Alert.alert("Erro", "Não foi possível atualizar o status.");
    } finally {
      setSavingStatus(false);
    }
  }

  function handleExcluir() {
    if (!id) return;

    Alert.alert("Excluir rota", "Deseja realmente excluir esta rota?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            setDeleting(true);
            await deleteDoc(doc(db, "rotas", id));
            Alert.alert("Sucesso", "Rota excluída com sucesso!", [
              {
                text: "OK",
                onPress: () => router.replace("/(cooperativa)/rotas"),
              },
            ]);
          } catch (error) {
            console.error("Erro ao excluir rota:", error);
            Alert.alert("Erro", "Não foi possível excluir a rota.");
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  }

  const getStatusColor = (status: RouteStatus) => {
    switch (status) {
      case "agendada":
        return "#F59E0B";
      case "em_andamento":
        return "#10B981";
      case "concluida":
        return "#6B7280";
      default:
        return "#6B7280";
    }
  };

  const getStatusLabel = (status: RouteStatus) => {
    switch (status) {
      case "agendada":
        return "AGENDADA";
      case "em_andamento":
        return "EM ANDAMENTO";
      case "concluida":
        return "CONCLUÍDA";
      default:
        return "SEM STATUS";
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#028C56" />
        <Text style={{ marginTop: 10, color: "#6B7280" }}>Carregando rota...</Text>
      </View>
    );
  }

  if (!rota) return null;

  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <LinearGradient
        colors={["#10F35D", "#028C56"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => router.replace("/(cooperativa)/rotas")}
            style={{ marginRight: 15 }}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={{ fontSize: 20, fontWeight: "700", color: "#FFFFFF" }}>
            DETALHES DA ROTA
          </Text>
        </View>
      </LinearGradient>

      <ScrollView style={{ flex: 1, padding: 20 }} showsVerticalScrollIndicator={false}>
        <View
          style={{
            backgroundColor: "#F9FAFB",
            borderRadius: 16,
            padding: 18,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: "#E5E7EB",
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: "800", color: "#111827", marginBottom: 10 }}>
            {rota.nome}
          </Text>

          <View
            style={{
              alignSelf: "flex-start",
              backgroundColor: getStatusColor(rota.status),
              borderRadius: 20,
              paddingHorizontal: 12,
              paddingVertical: 5,
              marginBottom: 12,
            }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 12 }}>
              {getStatusLabel(rota.status)}
            </Text>
          </View>

          <Text style={{ fontSize: 14, color: "#4B5563", marginBottom: 6 }}>
            Data: {rota.data || "Não informada"}
          </Text>
          <Text style={{ fontSize: 14, color: "#4B5563", marginBottom: 6 }}>
            Motorista ID: {rota.motoristaId || "Não informado"}
          </Text>
          <Text style={{ fontSize: 14, color: "#4B5563" }}>
            Veículo ID: {rota.veiculoId || "Não informado"}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 16,
            padding: 18,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: "#E5E7EB",
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 12 }}>
            Pontos da rota
          </Text>

          {Array.isArray(rota.pontos) && rota.pontos.length > 0 ? (
            rota.pontos.map((ponto: string, index: number) => (
              <View
                key={`${ponto}-${index}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <Ionicons name="location-outline" size={18} color="#028C56" />
                <Text style={{ marginLeft: 8, color: "#374151", fontSize: 15 }}>
                  {ponto}
                </Text>
              </View>
            ))
          ) : (
            <Text style={{ color: "#6B7280" }}>Nenhum ponto cadastrado.</Text>
          )}
        </View>

        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 16,
            padding: 18,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: "#E5E7EB",
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 12 }}>
            Alterar status
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {[
              { label: "Agendada", value: "agendada" },
              { label: "Em andamento", value: "em_andamento" },
              { label: "Concluída", value: "concluida" },
            ].map((item) => {
              const selected = rota.status === item.value;

              return (
                <TouchableOpacity
                  key={item.value}
                  disabled={savingStatus}
                  onPress={() => updateStatus(item.value as RouteStatus)}
                  style={{
                    backgroundColor: selected ? "#028C56" : "#F3F4F6",
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 20,
                    marginRight: 10,
                    marginBottom: 10,
                    opacity: savingStatus ? 0.7 : 1,
                  }}
                >
                  <Text
                    style={{
                      color: selected ? "#FFFFFF" : "#4B5563",
                      fontWeight: "600",
                    }}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity
          onPress={handleExcluir}
          disabled={deleting || savingStatus}
          style={{
            height: 52,
            borderRadius: 8,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#FEF2F2",
            borderWidth: 1,
            borderColor: "#DC2626",
            marginBottom: 30,
          }}
        >
          {deleting ? (
            <ActivityIndicator color="#DC2626" />
          ) : (
            <Text style={{ color: "#DC2626", fontSize: 16, fontWeight: "800" }}>
              EXCLUIR ROTA
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}