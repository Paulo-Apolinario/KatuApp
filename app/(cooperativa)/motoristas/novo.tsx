import { router } from "expo-router";
import { useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { driverService } from "@/src/services/driverService";
import { useNotification } from "@/src/contexts/NotificationContext";

export default function NovoMotoristaScreen() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cnh, setCnh] = useState("");
  const [cnhCategoria, setCnhCategoria] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [loading, setLoading] = useState(false);
  const { notifyError, notifySuccess } = useNotification();

  function formatCpf(value: string) {
    return value
      .replace(/\D/g, "")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
      .slice(0, 14);
  }

  function formatPhone(value: string) {
    return value
      .replace(/\D/g, "")
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2")
      .slice(0, 15);
  }

  async function handleSalvar() {
    if (!nome.trim() || !email.trim()) {
      notifyError("Atenção", "Preencha nome e email do motorista.");
      return;
    }

    try {
      setLoading(true);

      await driverService.create({
        name: nome,
        email,
        cpf,
        phone: telefone,
        cnh,
        cnhCategory: cnhCategoria,
        notes: observacoes,
      });

      notifySuccess("Sucesso", "Motorista cadastrado com sucesso!");
      router.replace("/(cooperativa)/motoristas");
    } catch (error: any) {
      console.error("Erro ao cadastrar motorista:", error);
      notifyError(
        "Erro",
        error?.message || "Não foi possível cadastrar o motorista."
      );
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
            onPress={() => router.replace("/(cooperativa)/motoristas")}
            style={{ marginRight: 15 }}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={{ fontSize: 20, fontWeight: "700", color: "#FFFFFF" }}>
            NOVO MOTORISTA
          </Text>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1, padding: 20 }}
      >
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
            Email *
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="motorista@email.com"
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
            onChangeText={(text) => setCpf(formatCpf(text))}
            placeholder="000.000.000-00"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
            maxLength={14}
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
            Telefone
          </Text>
          <TextInput
            value={telefone}
            onChangeText={(text) => setTelefone(formatPhone(text))}
            placeholder="(88) 90000-0000"
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
            CNH
          </Text>
          <TextInput
            value={cnh}
            onChangeText={setCnh}
            placeholder="Número da CNH"
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
            Categoria da CNH
          </Text>
          <TextInput
            value={cnhCategoria}
            onChangeText={setCnhCategoria}
            placeholder="Ex: A, B, C, D, E"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="characters"
            maxLength={2}
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
          <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 5 }}>
            Observações
          </Text>
          <TextInput
            value={observacoes}
            onChangeText={setObservacoes}
            placeholder="Informações adicionais sobre o motorista"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            style={{
              borderWidth: 1,
              borderColor: "#D1D5DB",
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
              color: "#111827",
              minHeight: 100,
            }}
          />
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
              opacity: loading ? 0.7 : 1,
              flexDirection: "row",
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
                SALVAR MOTORISTA
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}