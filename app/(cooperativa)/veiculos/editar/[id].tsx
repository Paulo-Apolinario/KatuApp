import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { deleteDoc, doc, getDoc, updateDoc } from "firebase/firestore";

import { db } from "@/src/services/firebaseConfig";
import { useAuth } from "@/src/contexts/AuthContext";

type VehicleStatus = "ativo" | "manutencao" | "inativo";

export default function EditarVeiculoScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const routeId = Array.isArray(params.id) ? params.id[0] : params.id;

  const { user } = useAuth();

  const [modelo, setModelo] = useState("");
  const [placa, setPlaca] = useState("");
  const [capacidade, setCapacidade] = useState("");
  const [status, setStatus] = useState<VehicleStatus>("ativo");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function formatPlate(value: string) {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
  }

  const loadVeiculo = useCallback(async () => {
    if (!routeId || !user?.uid) {
      setLoading(false);
      return;
    }

    try {
      const docRef = doc(db, "veiculos", routeId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        Alert.alert("Erro", "Veículo não encontrado.");
        router.replace("/(cooperativa)/veiculos");
        return;
      }

      const data: any = docSnap.data();

      if (data.cooperativaId !== user.uid) {
        Alert.alert("Erro", "Você não tem permissão para este veículo.");
        router.replace("/(cooperativa)/veiculos");
        return;
      }

      setModelo(data.modelo || "");
      setPlaca(data.placa || "");
      setCapacidade(String(data.capacidade || ""));
      setStatus((data.status as VehicleStatus) || "ativo");
    } catch (error) {
      console.error("Erro ao carregar veículo:", error);
      Alert.alert("Erro", "Não foi possível carregar o veículo.");
    } finally {
      setLoading(false);
    }
  }, [routeId, user?.uid]);

  useEffect(() => {
    loadVeiculo();
  }, [loadVeiculo]);

  async function handleSalvar() {
    if (!routeId || !user?.uid) return;

    if (!modelo.trim() || !placa.trim() || !capacidade.trim()) {
      Alert.alert("Atenção", "Preencha todos os campos obrigatórios.");
      return;
    }

    const capacidadeNumber = Number(capacidade.replace(",", "."));

    if (Number.isNaN(capacidadeNumber) || capacidadeNumber <= 0) {
      Alert.alert("Atenção", "Informe uma capacidade válida.");
      return;
    }

    try {
      setSaving(true);

      await updateDoc(doc(db, "veiculos", routeId), {
        modelo: modelo.trim(),
        placa: formatPlate(placa),
        capacidade: capacidadeNumber,
        status,
      });

      Alert.alert("Sucesso", "Veículo atualizado com sucesso!", [
        {
          text: "OK",
          onPress: () => router.replace("/(cooperativa)/veiculos"),
        },
      ]);
    } catch (error) {
      console.error("Erro ao atualizar veículo:", error);
      Alert.alert("Erro", "Não foi possível atualizar o veículo.");
    } finally {
      setSaving(false);
    }
  }

  function handleExcluir() {
    if (!routeId) return;

    Alert.alert("Excluir veículo", "Deseja realmente excluir este veículo?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            setDeleting(true);
            await deleteDoc(doc(db, "veiculos", routeId));
            Alert.alert("Sucesso", "Veículo excluído com sucesso!", [
              {
                text: "OK",
                onPress: () => router.replace("/(cooperativa)/veiculos"),
              },
            ]);
          } catch (error) {
            console.error("Erro ao excluir veículo:", error);
            Alert.alert("Erro", "Não foi possível excluir o veículo.");
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#028C56" />
        <Text style={{ marginTop: 10, color: "#6B7280" }}>Carregando veículo...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#FFFFFF" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <LinearGradient
        colors={["#10F35D", "#028C56"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => router.replace("/(cooperativa)/veiculos")}
            style={{ marginRight: 15 }}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={{ fontSize: 20, fontWeight: "700", color: "#FFFFFF" }}>
            EDITAR VEÍCULO
          </Text>
        </View>
      </LinearGradient>

      <ScrollView style={{ flex: 1, padding: 20 }} showsVerticalScrollIndicator={false}>
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 5 }}>Modelo *</Text>
          <TextInput
            value={modelo}
            onChangeText={setModelo}
            placeholder="Modelo do veículo"
            placeholderTextColor="#9CA3AF"
            style={{
              borderWidth: 1,
              borderColor: "#D1D5DB",
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
              color: "#111827",
            }}
          />
        </View>

        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 5 }}>Placa *</Text>
          <TextInput
            value={placa}
            onChangeText={(text) => setPlaca(formatPlate(text))}
            placeholder="ABC1234"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="characters"
            maxLength={7}
            style={{
              borderWidth: 1,
              borderColor: "#D1D5DB",
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
              color: "#111827",
            }}
          />
        </View>

        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 5 }}>Capacidade (kg) *</Text>
          <TextInput
            value={capacidade}
            onChangeText={setCapacidade}
            keyboardType="numeric"
            placeholder="1000"
            placeholderTextColor="#9CA3AF"
            style={{
              borderWidth: 1,
              borderColor: "#D1D5DB",
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
              color: "#111827",
            }}
          />
        </View>

        <View style={{ marginBottom: 30 }}>
          <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 10 }}>Status</Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {[
              { label: "Ativo", value: "ativo" },
              { label: "Manutenção", value: "manutencao" },
              { label: "Inativo", value: "inativo" },
            ].map((item) => {
              const selected = status === item.value;

              return (
                <TouchableOpacity
                  key={item.value}
                  onPress={() => setStatus(item.value as VehicleStatus)}
                  style={{
                    backgroundColor: selected ? "#028C56" : "#F3F4F6",
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 20,
                    marginRight: 10,
                    marginBottom: 10,
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

        <TouchableOpacity onPress={handleSalvar} disabled={saving || deleting} activeOpacity={0.9}>
          <LinearGradient
            colors={["#10F35D", "#028C56"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              height: 52,
              borderRadius: 8,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              opacity: saving ? 0.7 : 1,
              marginBottom: 15,
            }}
          >
            {saving ? (
              <>
                <ActivityIndicator color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "800", marginLeft: 10 }}>
                  SALVANDO...
                </Text>
              </>
            ) : (
              <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "800" }}>
                SALVAR ALTERAÇÕES
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleExcluir}
          disabled={saving || deleting}
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
              EXCLUIR VEÍCULO
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}