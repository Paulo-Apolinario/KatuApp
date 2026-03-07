import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  Image,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

type ProfileType = "pf" | "comercial" | "grande";

export default function LoginScreen() {
  const params = useLocalSearchParams<{ profile?: string }>();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const profileLabel = useMemo(() => {
    const profile = params.profile as ProfileType | undefined;

    switch (profile) {
      case "pf":
        return "Pessoa Física";
      case "comercial":
        return "Pequeno Gerador Comercial";
      case "grande":
        return "Grande Gerador";
      default:
        return "";
    }
  }, [params.profile]);

  function handleLogin() {
    router.replace("/(pf-tabs)/home");
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
      {/* BOTÃO DE VOLTAR - MESMO ESTILO DO CÓDIGO ANTERIOR */}
      <TouchableOpacity
        onPress={() => router.push("/(public)/choose-profile")}
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

      {/* CONTAINER CENTRALIZADO */}
      <View
        style={{
          width: "100%",
          maxWidth: 420,
          paddingHorizontal: 24,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* LOGO + NOME */}
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
            KATU
          </Text>
        </View>

        {/* TITULO */}
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

        {/* EMAIL */}
        <View style={{ width: "100%", marginBottom: 24 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <Ionicons name="mail-outline" size={20} color="#028C56" />
            <Text style={{ color: "#028C56", marginLeft: 8, fontWeight: "500" }}>
              Email
            </Text>
          </View>

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="seu@email.com"
            placeholderTextColor="#9CA3AF"
            style={{
              borderBottomWidth: 1,
              borderBottomColor: "#D1D5DB",
              paddingVertical: 10,
              fontSize: 16,
              color: "#111827",
              width: "100%",
            }}
          />
        </View>

        {/* PASSWORD */}
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

            <Pressable onPress={() => setShowPassword(!showPassword)}>
              <Ionicons
                name={showPassword ? "eye-outline" : "eye-off-outline"}
                size={20}
                color="#028C56"
              />
            </Pressable>
          </View>

          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            placeholder="••••••••"
            placeholderTextColor="#9CA3AF"
            style={{
              borderBottomWidth: 1,
              borderBottomColor: "#D1D5DB",
              paddingVertical: 10,
              fontSize: 16,
              color: "#111827",
              width: "100%",
            }}
          />
        </View>

        {/* LEMBRE-ME */}
        <View
          style={{
            width: "100%",
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 30,
          }}
        >
          <Pressable
            onPress={() => setRememberMe(!rememberMe)}
            style={{ flexDirection: "row", alignItems: "center" }}
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
              {rememberMe && (
                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
              )}
            </View>

            <Text style={{ fontSize: 12, color: "#4B5563" }}>Lembre-me</Text>
          </Pressable>

          <Pressable>
            <Text style={{ fontSize: 12, color: "#028C56", fontWeight: "500" }}>
              Esqueceu a senha?
            </Text>
          </Pressable>
        </View>

        {/* BOTÃO LOGIN */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleLogin}
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
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "800" }}>
              LOGIN
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* CADASTRO */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#4B5563" }}>Não tem uma conta? </Text>

          <Pressable onPress={() => router.push("/(auth)/register")}>
            <Text
              style={{
                color: "#028C56",
                fontWeight: "700",
                textDecorationLine: "underline",
              }}
            >
              Cadastre-se
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}