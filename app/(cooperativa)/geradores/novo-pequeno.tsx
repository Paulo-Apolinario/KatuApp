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


export default function NovoPequenoGeradorScreen() {
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

    if (!companyName || !normalizedAddress || !normalizedPhone || !normalizedEmail) {
      Alert.alert("Atenção", "Preencha nome, endereço, telefone e email.");
      return;
    }

    try {
      setSaving(true);

      const response = await generatorService.createGenerator({
        name: responsibleName || companyName,
        companyName,
        email: normalizedEmail,
        phone: normalizedPhone,
        address: normalizedAddress,
        type: "SMALL",
      });

      Alert.alert(
        "Gerador salvo com sucesso",
        response.temporaryPassword
          ? `O pequeno gerador foi cadastrado.\n\nSenha provisória: ${response.temporaryPassword}\n\nAgora ele precisa acessar a opção de ativação de acesso com o e-mail informado.`
          : "O pequeno gerador foi cadastrado com sucesso.",
        [
          {
            text: "OK",
            onPress: () => router.replace("/(cooperativa)/geradores/pequeno"),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert(
        "Erro",
        error.message || "Não foi possível cadastrar o pequeno gerador."
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
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginRight: 15 }}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={{ fontSize: 20, fontWeight: "700", color: "#FFFFFF" }}>
            NOVO PEQUENO GERADOR
          </Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={{ flex: 1, padding: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ marginBottom: 18 }}>
          <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 6 }}>
            Nome do estabelecimento *
          </Text>
          <TextInput
            value={nome}
            onChangeText={setNome}
            placeholder="Ex: Mercadinho Nova Opção"
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
            Contato responsável
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

        <Text style={{ color: "#6B7280", fontSize: 12, marginBottom: 20 }}>
          O backend define automaticamente o status inicial e o fluxo de ativação de acesso.
        </Text>

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
                SALVAR PEQUENO GERADOR
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}