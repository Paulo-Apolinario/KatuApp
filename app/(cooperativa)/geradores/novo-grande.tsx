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
import { generatorService } from "@/src/services/generatorService";

export default function NovoGrandeGeradorScreen() {
  const [nome, setNome] = useState("");
  const [endereco, setEndereco] = useState("");
  const [contato, setContato] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSalvar() {
    const companyName = nome.trim();
    const responsibleName = contato.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = telefone.trim();
    const normalizedAddress = endereco.trim();

    if (!companyName || !normalizedAddress || !responsibleName || !normalizedPhone || !normalizedEmail) {
      Alert.alert("Atenção", "Preencha nome, endereço, contato, telefone e email.");
      return;
    }

    try {
      setSaving(true);

      const response = await generatorService.createGenerator({
        name: responsibleName,
        companyName,
        email: normalizedEmail,
        phone: normalizedPhone,
        address: normalizedAddress,
        type: "LARGE",
      });

      Alert.alert(
        "Gerador salvo com sucesso",
        response.temporaryPassword
          ? `O grande gerador foi cadastrado.\n\nSenha provisória: ${response.temporaryPassword}\n\nAgora ele pode ativar o acesso na tela de liberação.`
          : "O grande gerador foi cadastrado com sucesso.",
        [
          {
            text: "OK",
            onPress: () => router.replace("/(cooperativa)/geradores/grande"),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert(
        "Erro",
        error.message || "Não foi possível cadastrar o grande gerador."
      );
    } finally {
      setSaving(false);
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
        style={{ paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={{ fontSize: 20, fontWeight: "700", color: "#FFFFFF" }}>
            NOVO GRANDE GERADOR
          </Text>
        </View>
      </LinearGradient>

      <ScrollView style={{ flex: 1, padding: 20 }} showsVerticalScrollIndicator={false}>
        <View style={{ marginBottom: 18 }}>
          <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 6 }}>
            Nome da empresa *
          </Text>
          <TextInput
            value={nome}
            onChangeText={setNome}
            placeholder="Ex: Indústria de Plásticos JP"
            placeholderTextColor="#9CA3AF"
            style={{
              borderWidth: 1,
              borderColor: "#D1D5DB",
              borderRadius: 10,
              padding: 12,
              color: "#111827",
              fontSize: 16,
            }}
          />
        </View>

        <View style={{ marginBottom: 18 }}>
          <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 6 }}>
            Endereço *
          </Text>
          <TextInput
            value={endereco}
            onChangeText={setEndereco}
            placeholder="Rua, número, bairro..."
            placeholderTextColor="#9CA3AF"
            style={{
              borderWidth: 1,
              borderColor: "#D1D5DB",
              borderRadius: 10,
              padding: 12,
              color: "#111827",
              fontSize: 16,
            }}
          />
        </View>

        <View style={{ marginBottom: 18 }}>
          <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 6 }}>
            Contato responsável *
          </Text>
          <TextInput
            value={contato}
            onChangeText={setContato}
            placeholder="Nome do responsável"
            placeholderTextColor="#9CA3AF"
            style={{
              borderWidth: 1,
              borderColor: "#D1D5DB",
              borderRadius: 10,
              padding: 12,
              color: "#111827",
              fontSize: 16,
            }}
          />
        </View>

        <View style={{ marginBottom: 18 }}>
          <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 6 }}>
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
              borderRadius: 10,
              padding: 12,
              color: "#111827",
              fontSize: 16,
            }}
          />
        </View>

        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 6 }}>
            Email *
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="empresa@email.com"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            keyboardType="email-address"
            style={{
              borderWidth: 1,
              borderColor: "#D1D5DB",
              borderRadius: 10,
              padding: 12,
              color: "#111827",
              fontSize: 16,
            }}
          />
        </View>

        <View style={{ marginBottom: 28 }}>
          <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 10 }}>
            Status inicial
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {[
              { label: "ATIVO", value: "ativo" },
              { label: "PENDENTE", value: "pendente" },
              { label: "INATIVO", value: "inativo" },
            ].map((item) => {
              const selected = false;

              return (
                <TouchableOpacity
                  key={item.value}
                  disabled
                  style={{
                    backgroundColor: selected ? "#028C56" : "#F3F4F6",
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 20,
                    marginRight: 10,
                    marginBottom: 10,
                    opacity: 0.7,
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

          <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 8 }}>
            Nesta etapa, o backend controla o status operacional real do acesso e a ativação inicial.
          </Text>
        </View>

        <TouchableOpacity onPress={handleSalvar} disabled={saving} activeOpacity={0.9}>
          <LinearGradient
            colors={["#10F35D", "#028C56"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              height: 52,
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              opacity: saving ? 0.7 : 1,
              marginBottom: 30,
            }}
          >
            {saving ? (
              <>
                <ActivityIndicator color="#FFFFFF" />
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontSize: 16,
                    fontWeight: "800",
                    marginLeft: 8,
                  }}
                >
                  SALVANDO...
                </Text>
              </>
            ) : (
              <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "800" }}>
                SALVAR GRANDE GERADOR
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}