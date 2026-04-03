import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useAuth } from "@/src/contexts/AuthContext";
import {
  type Generator,
  type GeneratorType,
  type GeneratorAccessStatus,
} from "@/src/services/generatorService";

type AuthUserLike = {
  id?: string;
  uid?: string;
  role?: string;
  name?: string;
  displayName?: string;
  email?: string;
  phone?: string;
  address?: string;
  generator?: Generator | null;
};

function getGeneratorTypeLabel(
  role?: string,
  generatorType?: GeneratorType | null
) {
  if (generatorType === "SMALL" || role === "GENERATOR_SMALL") {
    return "Gerador de Pequeno Porte";
  }

  if (generatorType === "LARGE" || role === "GENERATOR_LARGE") {
    return "Gerador de Grande Porte";
  }

  return "Gerador";
}

function getAccessStatusLabel(status?: GeneratorAccessStatus | null) {
  switch (status) {
    case "ACTIVE":
      return "Ativo";
    case "PENDING_ACTIVATION":
      return "Pendente de ativação";
    case "INACTIVE":
      return "Inativo";
    case "BLOCKED":
      return "Bloqueado";
    default:
      return "Não informado";
  }
}

export default function EditGeneratorProfileScreen() {
  const { user } = useAuth();
  const currentUser: AuthUserLike | null = user
    ? (user as unknown as AuthUserLike)
    : null;

  const generator = currentUser?.generator ?? null;

  const [responsibleName, setResponsibleName] = useState(
    generator?.name || currentUser?.displayName || currentUser?.name || ""
  );

  const [companyName, setCompanyName] = useState(
    generator?.companyName || ""
  );

  const [phone, setPhone] = useState(
    generator?.phone || currentUser?.phone || ""
  );

  const [address, setAddress] = useState(
    generator?.address || currentUser?.address || ""
  );

  const email = useMemo(() => {
    return generator?.email || currentUser?.email || "";
  }, [generator?.email, currentUser?.email]);

  const typeLabel = useMemo(() => {
    return getGeneratorTypeLabel(currentUser?.role, generator?.type);
  }, [currentUser?.role, generator?.type]);

  const accessStatusLabel = useMemo(() => {
    return getAccessStatusLabel(generator?.accessStatus);
  }, [generator?.accessStatus]);

  const canSave = useMemo(() => {
    return (
      responsibleName.trim().length > 0 &&
      companyName.trim().length > 0 &&
      phone.trim().length > 0 &&
      address.trim().length > 0
    );
  }, [responsibleName, companyName, phone, address]);

  const handleSave = () => {
    if (!canSave) {
      Alert.alert(
        "Atenção",
        "Preencha nome do responsável, empresa, telefone e endereço."
      );
      return;
    }

    Alert.alert(
      "Atualização ainda não integrada",
      "A tela foi criada e está pronta no frontend, mas o generatorService ainda não possui endpoint/método de atualização. A persistência no backend será a próxima etapa."
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#FFFFFF" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <LinearGradient
        colors={["#10F35D", "#028C56"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          paddingTop: 50,
          paddingBottom: 20,
          paddingHorizontal: 20,
          borderBottomLeftRadius: 30,
          borderBottomRightRadius: 30,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginRight: 15 }}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={{ fontSize: 22, fontWeight: "700", color: "#FFFFFF" }}>
            EDITAR PERFIL
          </Text>
        </View>

        <Text
          style={{
            fontSize: 14,
            color: "#FFFFFF",
            opacity: 0.9,
            marginTop: 10,
          }}
        >
          Revise e atualize as informações principais do gerador.
        </Text>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
      >
        <View
          style={{
            backgroundColor: "#F9FAFB",
            borderRadius: 18,
            padding: 18,
            marginBottom: 18,
            borderWidth: 1,
            borderColor: "#E5E7EB",
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: "#111827",
              marginBottom: 14,
            }}
          >
            Resumo da conta
          </Text>

          <InfoLine label="Tipo de conta" value={typeLabel} />
          <InfoLine label="Status de acesso" value={accessStatusLabel} />
          <InfoLine
            label="Acesso liberado"
            value={generator?.accessReleased ? "Sim" : "Não"}
            isLast
          />
        </View>

        <View
          style={{
            backgroundColor: "#F9FAFB",
            borderRadius: 18,
            padding: 18,
            marginBottom: 18,
            borderWidth: 1,
            borderColor: "#E5E7EB",
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: "#111827",
              marginBottom: 14,
            }}
          >
            Informações editáveis
          </Text>

          <Field label="Responsável" required>
            <TextInput
              value={responsibleName}
              onChangeText={setResponsibleName}
              placeholder="Nome do responsável"
              placeholderTextColor="#9CA3AF"
              style={inputStyle}
            />
          </Field>

          <Field label="Empresa" required>
            <TextInput
              value={companyName}
              onChangeText={setCompanyName}
              placeholder="Nome da empresa"
              placeholderTextColor="#9CA3AF"
              style={inputStyle}
            />
          </Field>

          <Field label="Telefone" required>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="Telefone"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              style={inputStyle}
            />
          </Field>

          <Field label="Endereço" required>
            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder="Endereço"
              placeholderTextColor="#9CA3AF"
              style={[inputStyle, { minHeight: 90, textAlignVertical: "top" }]}
              multiline
              numberOfLines={4}
            />
          </Field>

          <Field label="E-mail">
            <TextInput
              value={email}
              editable={false}
              selectTextOnFocus={false}
              placeholder="E-mail"
              placeholderTextColor="#9CA3AF"
              style={[
                inputStyle,
                {
                  backgroundColor: "#F3F4F6",
                  color: "#6B7280",
                },
              ]}
            />
          </Field>
        </View>

        <View
          style={{
            backgroundColor: "#FEFCE8",
            borderRadius: 16,
            padding: 16,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: "#FDE68A",
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: "700",
              color: "#92400E",
              marginBottom: 6,
            }}
          >
            Observação importante
          </Text>

          <Text
            style={{
              fontSize: 14,
              color: "#92400E",
              lineHeight: 20,
            }}
          >
            Esta tela já está pronta no frontend, mas o backend ainda não possui
            método de atualização no generatorService. O salvamento real será
            conectado na próxima etapa.
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleSave}
          style={{ marginBottom: 12 }}
        >
          <LinearGradient
            colors={canSave ? ["#10F35D", "#028C56"] : ["#9CA3AF", "#6B7280"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              height: 54,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
            }}
          >
            <Ionicons name="save-outline" size={20} color="#FFFFFF" />
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 17,
                fontWeight: "800",
                marginLeft: 8,
              }}
            >
              SALVAR ALTERAÇÕES
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            height: 52,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#FFFFFF",
            borderWidth: 1,
            borderColor: "#D1D5DB",
          }}
        >
          <Text
            style={{
              color: "#374151",
              fontSize: 16,
              fontWeight: "700",
            }}
          >
            VOLTAR
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  children,
  required = false,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text
        style={{
          fontSize: 14,
          fontWeight: "600",
          color: "#374151",
          marginBottom: 8,
        }}
      >
        {label} {required ? "*" : ""}
      </Text>
      {children}
    </View>
  );
}

function InfoLine({
  label,
  value,
  isLast = false,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View
      style={{
        paddingBottom: isLast ? 0 : 12,
        marginBottom: isLast ? 0 : 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: "#E5E7EB",
      }}
    >
      <Text style={{ fontSize: 12, color: "#6B7280", marginBottom: 3 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 15, color: "#111827", fontWeight: "600" }}>
        {value || "-"}
      </Text>
    </View>
  );
}

const inputStyle = {
  borderWidth: 1,
  borderColor: "#D1D5DB",
  borderRadius: 12,
  padding: 14,
  fontSize: 16,
  color: "#111827",
  backgroundColor: "#FFFFFF",
} as const;