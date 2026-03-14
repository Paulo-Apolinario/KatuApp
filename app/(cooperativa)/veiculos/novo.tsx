import { router } from "expo-router";
import { useState } from "react";
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
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

import { db } from "@/src/services/firebaseConfig";
import { useAuth } from "@/src/contexts/AuthContext";

type VehicleStatus = "ativo" | "manutencao" | "inativo";

export default function NovoVeiculoScreen() {
  const { user } = useAuth();

  const [modelo, setModelo] = useState("");
  const [placa, setPlaca] = useState("");
  const [capacidade, setCapacidade] = useState("");
  const [status, setStatus] = useState<VehicleStatus>("ativo");
  const [loading, setLoading] = useState(false);

  function formatPlate(value: string) {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
  }

  async function handleSalvar() {
    if (!user?.uid) {
      Alert.alert("Erro", "Cooperativa não identificada.");
      return;
    }

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
      setLoading(true);

      await addDoc(collection(db, "veiculos"), {
        modelo: modelo.trim(),
        placa: formatPlate(placa),
        capacidade: capacidadeNumber,
        status,
        cooperativaId: user.uid,
        totalColetado: 0,
        createdAt: serverTimestamp(),
      });

      Alert.alert("Sucesso", "Veículo cadastrado com sucesso!", [
        {
          text: "OK",
          onPress: () => router.replace("/(cooperativa)/veiculos"),
        },
      ]);
    } catch (error) {
      console.error("Erro ao cadastrar veículo:", error);
      Alert.alert("Erro", "Não foi possível cadastrar o veículo.");
    } finally {
      setLoading(false);
    }
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
        style={{
          paddingTop: 50,
          paddingBottom: 20,
          paddingHorizontal: 20,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => router.replace("/(cooperativa)/veiculos")}
            style={{ marginRight: 15 }}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={{ fontSize: 20, fontWeight: "700", color: "#FFFFFF" }}>
            NOVO VEÍCULO
          </Text>
        </View>
      </LinearGradient>

      <ScrollView style={{ flex: 1, padding: 20 }} showsVerticalScrollIndicator={false}>
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 5 }}>
            Modelo *
          </Text>
          <TextInput
            value={modelo}
            onChangeText={setModelo}
            placeholder="Ex: Fiat Fiorino"
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
          <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 5 }}>
            Placa *
          </Text>
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
          <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 5 }}>
            Capacidade (kg) *
          </Text>
          <TextInput
            value={capacidade}
            onChangeText={setCapacidade}
            placeholder="Ex: 1200"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
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
          <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 10 }}>
            Status
          </Text>

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

        <TouchableOpacity onPress={handleSalvar} disabled={loading} activeOpacity={0.9}>
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
              opacity: loading ? 0.7 : 1,
              marginBottom: 30,
            }}
          >
            {loading ? (
              <>
                <ActivityIndicator color="#FFFFFF" />
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontSize: 18,
                    fontWeight: "800",
                    marginLeft: 10,
                  }}
                >
                  SALVANDO...
                </Text>
              </>
            ) : (
              <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "800" }}>
                SALVAR VEÍCULO
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}