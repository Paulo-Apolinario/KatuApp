import { router } from "expo-router";
import { useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

import { db } from "@/src/services/firebaseConfig";
import { useAuth } from "@/src/contexts/AuthContext";

type CatadorStatus = "disponivel" | "em_coleta" | "inativo";

export default function NovoCatadorScreen() {
  const { user } = useAuth();

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [endereco, setEndereco] = useState("");
  const [status, setStatus] = useState<CatadorStatus>("disponivel");
  const [loading, setLoading] = useState(false);

  const handleSalvar = async () => {
    if (!user?.uid) {
      Alert.alert("Erro", "Cooperativa não autenticada.");
      return;
    }

    if (!nome.trim() || !telefone.trim() || !email.trim()) {
      Alert.alert("Atenção", "Preencha nome, telefone e email.");
      return;
    }

    try {
      setLoading(true);

      await addDoc(collection(db, "catadores"), {
        uid: null,
        cooperativaId: user.uid,
        nome: nome.trim(),
        telefone: telefone.trim(),
        email: email.trim().toLowerCase(),
        cpf: cpf.trim(),
        endereco: endereco.trim(),
        status,
        kgMes: 0,
        coletasHoje: 0,
        totalKg: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      Alert.alert("Sucesso", "Catador cadastrado com sucesso!", [
        {
          text: "OK",
          onPress: () => router.replace("/(cooperativa)/catadores"),
        },
      ]);
    } catch (error) {
      console.error("Erro ao cadastrar catador:", error);
      Alert.alert("Erro", "Não foi possível cadastrar o catador.");
    } finally {
      setLoading(false);
    }
  };

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
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={{ fontSize: 20, fontWeight: "700", color: "#FFFFFF" }}>
            NOVO CATADOR
          </Text>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, padding: 20 }}>
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 5 }}>
            Nome Completo *
          </Text>
          <TextInput
            value={nome}
            onChangeText={setNome}
            placeholder="Digite o nome completo"
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
            Telefone *
          </Text>
          <TextInput
            value={telefone}
            onChangeText={setTelefone}
            placeholder="(88) 99999-9999"
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
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
            Email *
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="catador@email.com"
            placeholderTextColor="#9CA3AF"
            keyboardType="email-address"
            autoCapitalize="none"
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
            CPF
          </Text>
          <TextInput
            value={cpf}
            onChangeText={setCpf}
            placeholder="000.000.000-00"
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

        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 5 }}>
            Endereço
          </Text>
          <TextInput
            value={endereco}
            onChangeText={setEndereco}
            placeholder="Rua, bairro, número..."
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
          <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 10 }}>
            Status Inicial
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {[
              { label: "Disponível", value: "disponivel" },
              { label: "Em coleta", value: "em_coleta" },
              { label: "Inativo", value: "inativo" },
            ].map((item) => {
              const selected = status === item.value;

              return (
                <TouchableOpacity
                  key={item.value}
                  onPress={() => setStatus(item.value as CatadorStatus)}
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

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleSalvar}
          disabled={loading}
          style={{ marginBottom: 30 }}
        >
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
                    marginLeft: 8,
                  }}
                >
                  SALVANDO...
                </Text>
              </>
            ) : (
              <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "800" }}>
                SALVAR CATADOR
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}