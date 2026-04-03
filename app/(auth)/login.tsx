import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/contexts/AuthContext";

type ProfileType =
  | "pf"
  | "comercial"
  | "grande"
  | "cooperativa"
  | "catador"
  | "motorista";

const allowedProfiles: ProfileType[] = [
  "pf",
  "comercial",
  "grande",
  "cooperativa",
  "catador",
  "motorista",
];

function normalizeProfile(profile?: string): ProfileType | undefined {
  if (!profile) return undefined;
  return allowedProfiles.includes(profile as ProfileType)
    ? (profile as ProfileType)
    : undefined;
}

export default function LoginScreen() {
  const params = useLocalSearchParams<{ profile?: string }>();
  const profile = normalizeProfile(params.profile);

  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
      case "motorista":
        return "Motorista";
      default:
        return "Acesso";
    }
  }, [profile]);

  async function handleLogin() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password.trim()) {
      Alert.alert("Atenção", "Preencha e-mail e senha.");
      return;
    }

    setLoading(true);

    try {
      const result = await signIn(normalizedEmail, password, profile, rememberMe);

      if (result.success) {
        if (!result.requiresActivation) {
          Alert.alert("Sucesso", "Login realizado com sucesso!");
        }
        return;
      }

      Alert.alert("Erro", result.error || "Não foi possível realizar o login.");
    } catch (error) {
      console.error("Erro no login:", error);
      Alert.alert("Erro", "Ocorreu um erro inesperado ao fazer login.");
    } finally {
      setLoading(false);
    }
  }

  function handleGoToForgotPassword() {
    router.push({
      pathname: "/(auth)/forgot",
      params: profile ? { profile } : {},
    });
  }

  function handleGoToRegister() {
    router.push({
      pathname: "/(auth)/register",
      params: profile ? { profile } : {},
    });
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <TouchableOpacity
        onPress={() => router.push("/(public)/access-type")}
        style={{
          position: "absolute",
          top: 60,
          left: 20,
          zIndex: 10,
          backgroundColor: "rgba(2, 140, 86, 0.1)",
          borderRadius: 30,
          padding: 10,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <Ionicons name="arrow-back" size={28} color="#028C56" />
        <Text style={{ color: "#028C56", marginLeft: 5, fontWeight: "600" }}>
          Voltar
        </Text>
      </TouchableOpacity>

      <View
        style={{
          width: "100%",
          maxWidth: 420,
          paddingHorizontal: 24,
          alignItems: "center",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 30,
          }}
        >
          <Image
            source={require("../../assets/images/logo.png")}
            resizeMode="contain"
            style={{ width: 70, height: 70, marginRight: 10 }}
          />
          <Text style={{ fontSize: 30, fontWeight: "700", color: "#111827" }}>
            KATUÁ
          </Text>
        </View>

        <View style={{ alignItems: "center", marginBottom: 30 }}>
          <Text style={{ fontSize: 28, fontWeight: "800", color: "#111827" }}>
            Login
          </Text>
          <Text
            style={{
              color: "#028C56",
              fontSize: 14,
              marginTop: 6,
              fontWeight: "600",
            }}
          >
            {profileLabel}
          </Text>
        </View>

        <View style={{ width: "100%", marginBottom: 24 }}>
          <View
            style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}
          >
            <Ionicons name="mail-outline" size={20} color="#028C56" />
            <Text style={{ color: "#028C56", marginLeft: 8, fontWeight: "500" }}>
              E-mail
            </Text>
          </View>

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="seu@email.com"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!loading}
            style={{
              borderBottomWidth: 1,
              borderBottomColor: "#D1D5DB",
              paddingVertical: 10,
              fontSize: 16,
              color: "#111827",
            }}
          />
        </View>

        <View style={{ width: "100%", marginBottom: 16 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="lock-closed-outline" size={20} color="#028C56" />
              <Text style={{ color: "#028C56", marginLeft: 8, fontWeight: "500" }}>
                Senha
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              disabled={loading}
            >
              <Ionicons
                name={showPassword ? "eye-outline" : "eye-off-outline"}
                size={20}
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
              borderBottomWidth: 1,
              borderBottomColor: "#D1D5DB",
              paddingVertical: 10,
              fontSize: 16,
              color: "#111827",
            }}
          />
        </View>

        <View
          style={{
            width: "100%",
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 30,
            alignItems: "center",
          }}
        >
          <TouchableOpacity
            onPress={() => setRememberMe(!rememberMe)}
            style={{ flexDirection: "row", alignItems: "center" }}
            disabled={loading}
          >
            <View
              style={{
                width: 18,
                height: 18,
                borderWidth: 1,
                borderColor: "#028C56",
                borderRadius: 4,
                marginRight: 8,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: rememberMe ? "#028C56" : "transparent",
              }}
            >
              {rememberMe && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
            </View>
            <Text style={{ fontSize: 12, color: "#4B5563" }}>Lembrar de mim</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleGoToForgotPassword} disabled={loading}>
            <Text style={{ fontSize: 12, color: "#028C56", fontWeight: "500" }}>
              Esqueceu a senha?
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleLogin}
          disabled={loading}
          style={{ width: "100%", marginBottom: 18 }}
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
                  ENTRANDO...
                </Text>
              </View>
            ) : (
              <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "800" }}>
                LOGIN
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ flexDirection: "row", justifyContent: "center" }}>
          <Text style={{ color: "#4B5563" }}>Não tem uma conta? </Text>
          <TouchableOpacity onPress={handleGoToRegister} disabled={loading}>
            <Text
              style={{
                color: "#028C56",
                fontWeight: "700",
                textDecorationLine: "underline",
              }}
            >
              Cadastre-se
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}