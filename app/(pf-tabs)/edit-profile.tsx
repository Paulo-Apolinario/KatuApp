import { useMemo, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useAuth } from "@/src/contexts/AuthContext";

type AuthUserLike = {
  id?: string;
  name?: string;
  displayName?: string;
  email?: string;
  cpf?: string;
  phone?: string;
  address?: string;
};

export default function EditProfileScreen() {
  const { user } = useAuth();
  const currentUser = user as AuthUserLike | null;

  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState(
    currentUser?.displayName || currentUser?.name || ""
  );
  const [cpf, setCpf] = useState(currentUser?.cpf || "");
  const [phone, setPhone] = useState(currentUser?.phone || "");
  const [address, setAddress] = useState(currentUser?.address || "");

  const email = useMemo(() => currentUser?.email || "", [currentUser?.email]);

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

  async function handleSave() {
    if (!displayName.trim()) {
      Alert.alert("Campo obrigatório", "Informe seu nome.");
      return;
    }

    try {
      setSaving(true);

      Alert.alert(
        "Próxima etapa",
        "A tela já está pronta no frontend. A atualização real do perfil será conectada ao endpoint definitivo na próxima etapa."
      );

      router.back();
    } catch (error) {
      console.error("Erro ao salvar dados:", error);
      Alert.alert("Erro", "Não foi possível salvar suas informações.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <LinearGradient
        colors={["#10F35D", "#028C56"]}
        style={{
          paddingTop: 60,
          paddingBottom: 24,
          paddingHorizontal: 20,
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: "rgba(255,255,255,0.2)",
              alignItems: "center",
              justifyContent: "center",
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "700" }}>
            Editar informações
          </Text>

          <View style={{ width: 44, height: 44 }} />
        </View>

        <Text
          style={{
            color: "#FFFFFFE6",
            marginTop: 12,
            fontSize: 14,
            lineHeight: 20,
          }}
        >
          Atualize seus dados pessoais e mantenha seu perfil completo.
        </Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 22,
            padding: 18,
            shadowColor: "#000",
            shadowOpacity: 0.06,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 3,
            marginTop: 6,
          }}
        >
          <Field label="Nome completo">
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Digite seu nome"
              placeholderTextColor="#94A3B8"
              style={inputStyle}
            />
          </Field>

          <Field label="CPF">
            <TextInput
              value={cpf}
              onChangeText={(text) => setCpf(formatCpf(text))}
              placeholder="000.000.000-00"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              style={inputStyle}
            />
          </Field>

          <Field label="Telefone">
            <TextInput
              value={phone}
              onChangeText={(text) => setPhone(formatPhone(text))}
              placeholder="(00) 00000-0000"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              style={inputStyle}
            />
          </Field>

          <Field label="Email">
            <TextInput
              value={email}
              editable={false}
              placeholderTextColor="#94A3B8"
              style={[inputStyle, { backgroundColor: "#F3F4F6", color: "#6B7280" }]}
            />
          </Field>

          <Field label="Endereço">
            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder="Rua, número, bairro, cidade..."
              placeholderTextColor="#94A3B8"
              multiline
              textAlignVertical="top"
              style={[inputStyle, { minHeight: 110 }]}
            />
          </Field>
        </View>

        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
          style={{ marginTop: 24, borderRadius: 999, overflow: "hidden" }}
        >
          <LinearGradient
            colors={["#10F35D", "#028C56"]}
            style={{
              minHeight: 58,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 999,
              flexDirection: "row",
            }}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color="#FFFFFF" />
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontWeight: "700",
                    fontSize: 16,
                    marginLeft: 8,
                  }}
                >
                  Salvar alterações
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text
        style={{
          color: "#334155",
          fontWeight: "600",
          marginBottom: 8,
          fontSize: 14,
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

const inputStyle = {
  borderWidth: 1,
  borderColor: "#E2E8F0",
  borderRadius: 16,
  paddingHorizontal: 16,
  paddingVertical: 14,
  fontSize: 16,
  color: "#0F172A",
  backgroundColor: "#F8FAFC",
} as const;