import { router, useLocalSearchParams } from "expo-router";
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
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/src/contexts/AuthContext";

type ProfileType = "pf" | "comercial" | "grande" | "cooperativa" | "catador";

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{
    email?: string;
    token?: string;
    profile?: string;
  }>();

  const profile = params.profile as ProfileType | undefined;
  const { resetPassword } = useAuth();

  const [email] = useState(params.email || "");
  const [token] = useState(params.token || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const profileLabel = useMemo(() => {
    switch (profile) {
      case "pf":
        return "Pessoa Física";
      case "comercial":
        return "Pequeno Gerador Comercial";
      case "grande":
        return "Grande Gerador";
      case "cooperativa":
        return "Cooperativa";
      case "catador":
        return "Catador";
      default:
        return "Acesso";
    }
  }, [profile]);

  async function handleReset() {
    if (!email || !token) {
      Alert.alert("Erro", "Dados de redefinição inválidos.");
      return;
    }

    if (!newPassword || !confirmPassword) {
      Alert.alert("Erro", "Preencha todos os campos.");
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert("Erro", "A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Erro", "As senhas não coincidem.");
      return;
    }

    try {
      setLoading(true);

      const result = await resetPassword({
        email,
        token,
        newPassword,
        confirmPassword,
      });

      if (!result.success) {
        Alert.alert("Erro", result.error || "Não foi possível redefinir a senha.");
        return;
      }

      Alert.alert(
        "Sucesso",
        result.message || "Senha redefinida com sucesso.",
        [
          {
            text: "Ir para login",
            onPress: () => {
              const query = profile ? `?profile=${profile}` : "";
              router.replace(`/(auth)/login${query}` as any);
            },
          },
        ]
      );
    } catch (error: any) {
      console.error("Erro ao redefinir senha:", error);
      Alert.alert(
        "Erro",
        error?.message || "Não foi possível redefinir a senha."
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
      <TouchableOpacity
        onPress={() => router.back()}
        style={{
          position: "absolute",
          top: 50,
          left: 20,
          zIndex: 10,
          backgroundColor: "rgba(2, 140, 86, 0.1)",
          borderRadius: 30,
          padding: 8,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <Ionicons name="arrow-back" size={24} color="#028C56" />
        <Text
          style={{
            color: "#028C56",
            marginLeft: 4,
            fontWeight: "600",
            fontSize: 14,
          }}
        >
          Voltar
        </Text>
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingHorizontal: 24,
          paddingTop: 90,
          paddingBottom: 30,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ width: "100%", maxWidth: 420, alignSelf: "center" }}>
          <View style={{ alignItems: "center", marginBottom: 30 }}>
            <Image
              source={require("../../assets/images/logo.png")}
              resizeMode="contain"
              style={{ width: 72, height: 72, marginBottom: 10 }}
            />

            <Text
              style={{
                fontSize: 28,
                fontWeight: "800",
                color: "#111827",
                textAlign: "center",
              }}
            >
              KATUÁ
            </Text>

            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: "#028C56",
                marginTop: 8,
                textAlign: "center",
              }}
            >
              Redefinir senha
            </Text>

            <Text
              style={{
                fontSize: 13,
                color: "#6B7280",
                marginTop: 8,
                textAlign: "center",
                lineHeight: 20,
              }}
            >
              Informe sua nova senha para concluir a recuperação de acesso.
            </Text>

            <View
              style={{
                backgroundColor: "#F0FDF4",
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 20,
                marginTop: 12,
              }}
            >
              <Text
                style={{
                  color: "#028C56",
                  fontSize: 13,
                  fontWeight: "700",
                }}
              >
                {profileLabel}
              </Text>
            </View>
          </View>

          <View style={{ marginBottom: 14 }}>
            <Text
              style={{
                color: "#028C56",
                marginBottom: 6,
                fontWeight: "700",
                fontSize: 14,
              }}
            >
              E-mail
            </Text>

            <TextInput
              value={email}
              editable={false}
              style={{
                borderWidth: 1,
                borderColor: "#D1D5DB",
                borderRadius: 14,
                paddingHorizontal: 16,
                paddingVertical: 14,
                fontSize: 16,
                color: "#6B7280",
                backgroundColor: "#F9FAFB",
              }}
            />
          </View>

          <View style={{ marginBottom: 14 }}>
            <Text
              style={{
                color: "#028C56",
                marginBottom: 6,
                fontWeight: "700",
                fontSize: 14,
              }}
            >
              Token
            </Text>

            <TextInput
              value={token}
              editable={false}
              style={{
                borderWidth: 1,
                borderColor: "#D1D5DB",
                borderRadius: 14,
                paddingHorizontal: 16,
                paddingVertical: 14,
                fontSize: 16,
                color: "#6B7280",
                backgroundColor: "#F9FAFB",
              }}
            />
          </View>

          <View style={{ marginBottom: 14 }}>
            <Text
              style={{
                color: "#028C56",
                marginBottom: 6,
                fontWeight: "700",
                fontSize: 14,
              }}
            >
              Nova senha *
            </Text>

            <View
              style={{
                borderWidth: 1,
                borderColor: "#D1D5DB",
                borderRadius: 14,
                paddingHorizontal: 16,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPassword}
                placeholder="Digite a nova senha"
                placeholderTextColor="#9CA3AF"
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  fontSize: 16,
                  color: "#111827",
                }}
              />
              <TouchableOpacity
                onPress={() => setShowNewPassword((prev) => !prev)}
              >
                <Ionicons
                  name={showNewPassword ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  color="#028C56"
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ marginBottom: 24 }}>
            <Text
              style={{
                color: "#028C56",
                marginBottom: 6,
                fontWeight: "700",
                fontSize: 14,
              }}
            >
              Confirmar nova senha *
            </Text>

            <View
              style={{
                borderWidth: 1,
                borderColor: "#D1D5DB",
                borderRadius: 14,
                paddingHorizontal: 16,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                placeholder="Confirme a nova senha"
                placeholderTextColor="#9CA3AF"
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  fontSize: 16,
                  color: "#111827",
                }}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword((prev) => !prev)}
              >
                <Ionicons
                  name={showConfirmPassword ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  color="#028C56"
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleReset}
            disabled={loading}
          >
            <LinearGradient
              colors={["#10F35D", "#028C56"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                height: 60,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? (
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <ActivityIndicator color="#FFFFFF" />
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 16,
                      fontWeight: "800",
                      marginLeft: 8,
                    }}
                  >
                    PROCESSANDO...
                  </Text>
                </View>
              ) : (
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontSize: 18,
                    fontWeight: "800",
                  }}
                >
                  REDEFINIR SENHA
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}