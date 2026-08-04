import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
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
import { useNotification } from "@/src/contexts/NotificationContext";

export default function ActivateAccessScreen() {
  const { activateGeneratorAccess } = useAuth();
  const params = useLocalSearchParams<{ email?: string }>();
  const { notifyError, notifySuccess, notifyWarning} = useNotification();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof params.email === "string" && params.email.trim()) {
      setEmail(params.email.trim().toLowerCase());
    }
  }, [params.email]);

  function validateFields() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password.trim() || !confirmPassword.trim()) {
      notifyWarning("Atenção", "Preencha todos os campos.");
      return false;
    }

    if (password.length < 6) {
      notifyWarning("Atenção", "A senha deve ter pelo menos 6 caracteres.");
      return false;
    }

    if (password !== confirmPassword) {
      notifyWarning("Atenção", "As senhas não coincidem.");
      return false;
    }

    return true;
  }

  async function handleActivateAccess() {
    if (!validateFields()) return;

    const normalizedEmail = email.trim().toLowerCase();

    try {
      setLoading(true);

      const result = await activateGeneratorAccess(normalizedEmail, password);

      if (!result.success) {
        notifyError("Erro", result.error || "Não foi possível liberar o acesso.");
        return;
      }

      notifySuccess("Acesso liberado", "Seu acesso foi liberado com sucesso.");
    } catch {
      notifyError("Erro", "Não foi possível liberar o acesso.");
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
              Liberar acesso
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
              Use o e-mail cadastrado pela cooperativa para ativar seu acesso e
              definir sua senha.
            </Text>
          </View>

          <View style={{ marginBottom: 18 }}>
            <Text
              style={{
                color: "#028C56",
                marginBottom: 6,
                fontWeight: "700",
                fontSize: 14,
              }}
            >
              E-mail cadastrado *
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="empresa@email.com"
              placeholderTextColor="#9CA3AF"
              editable={!loading}
              style={{
                borderWidth: 1,
                borderColor: "#D1D5DB",
                borderRadius: 14,
                paddingHorizontal: 16,
                paddingVertical: 14,
                fontSize: 16,
                color: "#111827",
              }}
            />
          </View>

          <View style={{ marginBottom: 18 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <Text
                style={{ color: "#028C56", fontWeight: "700", fontSize: 14 }}
              >
                Nova senha *
              </Text>
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
                  size={22}
                  color="#028C56"
                />
              </TouchableOpacity>
            </View>

            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholder="••••••••"
              placeholderTextColor="#9CA3AF"
              editable={!loading}
              style={{
                borderWidth: 1,
                borderColor: "#D1D5DB",
                borderRadius: 14,
                paddingHorizontal: 16,
                paddingVertical: 14,
                fontSize: 16,
                color: "#111827",
              }}
            />
          </View>

          <View style={{ marginBottom: 28 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <Text
                style={{ color: "#028C56", fontWeight: "700", fontSize: 14 }}
              >
                Confirmar senha *
              </Text>
              <TouchableOpacity
                onPress={() =>
                  setShowConfirmPassword(!showConfirmPassword)
                }
              >
                <Ionicons
                  name={
                    showConfirmPassword ? "eye-outline" : "eye-off-outline"
                  }
                  size={22}
                  color="#028C56"
                />
              </TouchableOpacity>
            </View>

            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              placeholder="••••••••"
              placeholderTextColor="#9CA3AF"
              editable={!loading}
              style={{
                borderWidth: 1,
                borderColor: "#D1D5DB",
                borderRadius: 14,
                paddingHorizontal: 16,
                paddingVertical: 14,
                fontSize: 16,
                color: "#111827",
              }}
            />
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleActivateAccess}
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
                    LIBERANDO...
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
                  LIBERAR ACESSO
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}