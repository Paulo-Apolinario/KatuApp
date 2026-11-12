import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
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
import { useNotification } from "@/src/contexts/NotificationContext";
import { useAuth } from "@/src/contexts/AuthContext";

type ProfileType = "pf" | "comercial" | "grande" | "cooperativa" | "catador";

export default function ForgotScreen() {
  const params = useLocalSearchParams<{ profile?: string }>();
  const profile = params.profile as ProfileType | undefined;
  const { forgotPassword } = useAuth();
  const { notifyWarning, notifyError, notifySuccess } = useNotification();

  const [email, setEmail] = useState("");
  const [identifierType, setIdentifierType] = useState<"EMAIL" | "PHONE" | "CPF">("EMAIL");
  const [loading, setLoading] = useState(false);

  const profileLabel = useMemo(() => {
    switch (profile) {
      case "pf":
        return "Gerador residencial";
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

  async function handleForgotPassword() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      notifyWarning("Informe CPF, celular ou e-mail cadastrado.");
      return;
    }

    try {
      setLoading(true);

      const result = await forgotPassword(normalizedEmail, identifierType);

      if (!result.success) {
        notifyError(result.error || "Não foi possível iniciar a recuperação.");
        return;
      }

      notifySuccess({
        message:
          result.message ||
          "Se os dados identificarem uma conta, enviaremos as instruções ao e-mail de recuperação cadastrado, que pode ser o da cooperativa.",
        title: "Solicitação enviada",
      });
    } catch (error: any) {
      console.error("Erro ao solicitar recuperação:", error);
      notifyError(
        error?.message || "Não foi possível iniciar a recuperação de senha.",
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
        <Ionicons name="arrow-back" size={24} color="#047857" />
        <Text
          style={{
            color: "#047857",
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
                fontWeight: "700",
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
                color: "#047857",
                marginTop: 8,
                textAlign: "center",
              }}
            >
              Esqueci minha senha
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
              Informe CPF, celular ou e-mail de acesso. As instruções irão para o e-mail de recuperação cadastrado, que pode ser o da cooperativa.
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
                  color: "#047857",
                  fontSize: 13,
                  fontWeight: "700",
                }}
              >
                {profileLabel}
              </Text>
            </View>
          </View>

          <View style={{ marginBottom: 24 }}>
            <Text
              style={{
                color: "#047857",
                marginBottom: 6,
                fontWeight: "700",
                fontSize: 14,
              }}
            >
              {identifierType === "CPF" ? "CPF *" : identifierType === "PHONE" ? "Celular com DDD *" : "E-mail de acesso *"}
            </Text>

            <View style={{flexDirection:"row",flexWrap:"wrap",gap:8,marginBottom:12}}>{(["EMAIL","PHONE","CPF"] as const).map(type=><TouchableOpacity key={type} accessibilityRole="button" accessibilityState={{selected:identifierType===type}} onPress={()=>{setIdentifierType(type);setEmail("");}} disabled={loading} style={{padding:10,borderWidth:1,borderColor:identifierType===type?"#047857":"#cbd5e1",borderRadius:10}}><Text>{type==="EMAIL"?"E-mail":type==="PHONE"?"Celular":"CPF"}</Text></TouchableOpacity>)}</View>
            <TextInput
              value={email}
              onChangeText={setEmail}
              keyboardType={identifierType === "EMAIL" ? "email-address" : "number-pad"}
              autoCapitalize="none"
              placeholder={identifierType === "EMAIL" ? "seu@email.com" : identifierType === "CPF" ? "Seu CPF" : "Celular com DDD"}
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
            accessibilityRole="button"
            accessibilityLabel="Enviar recuperação"
            onPress={handleForgotPassword}
            disabled={loading}
          >
            <LinearGradient
              colors={["#123C35", "#17694F"]}
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
                      fontWeight: "700",
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
                    fontWeight: "700",
                  }}
                >
                  CONTINUAR
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
