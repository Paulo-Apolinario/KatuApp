import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { AccessShell, AccessLink } from "@/src/components/auth/AccessShell";
import { Action, Field, Notice } from "@/src/components/ui/Workspace";
import { Ionicons } from "@expo/vector-icons";
import authService from "@/src/services/authService";
import { useAuth } from "@/src/contexts/AuthContext";
import { useNotification } from "@/src/contexts/NotificationContext";

type ProfileType =
  "pf" | "comercial" | "grande" | "cooperativa" | "catador" | "motorista";

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
  const { notifySuccess, notifyError, notifyWarning } = useNotification();

  const [quickAccess, setQuickAccess] = useState(false);
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
    if (loading) return;
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || (!quickAccess && !password.trim())) {
      notifyWarning(
        quickAccess ? "Informe seu e-mail." : "Preencha e-mail e senha.",
      );
      return;
    }

    setLoading(true);

    try {
      if (quickAccess) {
        const result = await authService.requestLoginLink(
          normalizedEmail,
          profile,
        );
        notifySuccess({
          message: result.message,
          title: "Solicitação enviada",
        });
        return;
      }
      const result = await signIn(
        normalizedEmail,
        password,
        profile,
        rememberMe,
      );

      if (result.success) {
        if (!result.requiresActivation) {
          notifySuccess("Login realizado com sucesso!");
        }
        return;
      }

      notifyError(result.error || "Não foi possível realizar o login.");
    } catch (error) {
      console.error("Erro no login:", error);
      notifyError("Ocorreu um erro inesperado ao fazer login.");
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
    <AccessShell
      eyebrow="ACESSE SUA CONTA"
      title="Bom ter você por aqui."
      subtitle={`Entre com seu cadastro de ${profileLabel.toLocaleLowerCase("pt-BR")} para continuar.`}
      onBack={() => router.replace("/(public)/access-type")}
    >
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Forma de acesso"
        style={{
          flexDirection: "row",
          padding: 4,
          backgroundColor: "#F0F4F2",
          borderRadius: 10,
          marginBottom: 20,
        }}
      >
        {[
          { label: "Com senha", value: false },
          { label: "Acesso por e-mail", value: true },
        ].map((item) => (
          <TouchableOpacity
            key={item.label}
            accessibilityRole="radio"
            accessibilityState={{ checked: quickAccess === item.value }}
            disabled={loading}
            onPress={() => setQuickAccess(item.value)}
            style={{
              flex: 1,
              minHeight: 44,
              borderRadius: 8,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor:
                quickAccess === item.value ? "white" : "transparent",
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: quickAccess === item.value ? "#047857" : "#64748B",
              }}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Field
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        placeholder="seu@email.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        editable={!loading}
      />
      {quickAccess ? (
        <Notice text="Receba um link de acesso no seu e-mail, válido por 15 minutos. Confira também a pasta de spam." />
      ) : (
        <>
          <Field
            label="Senha"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete="current-password"
            placeholder="Digite sua senha"
            editable={!loading}
            onSubmitEditing={() => void handleLogin()}
          />
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={
              showPassword ? "Ocultar senha" : "Mostrar senha"
            }
            onPress={() => setShowPassword((v) => !v)}
            disabled={loading}
            style={{
              flexDirection: "row",
              gap: 6,
              minHeight: 44,
              alignItems: "center",
              alignSelf: "flex-end",
            }}
          >
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={18}
              color="#64748B"
            />
            <Text style={{ fontSize: 12, color: "#64748B" }}>
              {showPassword ? "Ocultar senha" : "Mostrar senha"}
            </Text>
          </TouchableOpacity>
        </>
      )}
      {!quickAccess && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          <TouchableOpacity
            accessibilityRole="checkbox"
            accessibilityState={{ checked: rememberMe }}
            onPress={() => setRememberMe((v) => !v)}
            disabled={loading}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              minHeight: 44,
            }}
          >
            <Ionicons
              name={rememberMe ? "checkbox" : "square-outline"}
              size={22}
              color="#047857"
            />
            <Text style={{ fontSize: 12, color: "#475569" }}>
              Lembrar de mim
            </Text>
          </TouchableOpacity>
          <AccessLink
            label="Esqueceu a senha?"
            onPress={handleGoToForgotPassword}
          />
        </View>
      )}
      <Action
        label={quickAccess ? "Enviar link de acesso" : "Entrar na minha conta"}
        busy={loading}
        onPress={() => void handleLogin()}
      />
      <AccessLink label="Criar uma conta" onPress={handleGoToRegister} />
      <Notice text="Se a cooperativa já cadastrou você, utilize a opção de liberar acesso na tela inicial." />
    </AccessShell>
  );
}
