import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import authService from "@/src/services/authService";

type ProfileType = "pf" | "comercial" | "grande" | "cooperativa" | "catador";

function getRouteByProfile(profile: ProfileType) {
  switch (profile) {
    case "pf":
      return "/(auth)/login?profile=pf";
    case "cooperativa":
      return "/(auth)/login?profile=cooperativa";
    case "comercial":
    case "grande":
    case "catador":
    default:
      return "/(public)/access-type";
  }
}

function sanitizeDigits(value: string) {
  return value.replace(/\D/g, "");
}

function isValidEmail(value: string) {
  return /\S+@\S+\.\S+/.test(value);
}

export default function RegisterScreen() {
  const params = useLocalSearchParams<{ profile?: string }>();
  const profile = (params.profile as ProfileType) || "pf";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [cpf, setCpf] = useState("");
  const [cooperativeName, setCooperativeName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [address, setAddress] = useState("");

  const isSupportedPublicProfile = useMemo(() => {
    return profile === "pf" || profile === "cooperativa";
  }, [profile]);

  const validateFields = () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (
      !name.trim() ||
      !normalizedEmail ||
      !password.trim() ||
      !confirmPassword.trim() ||
      !phone.trim()
    ) {
      setErrorMessage("Preencha todos os campos obrigatórios.");
      return false;
    }

    if (!isValidEmail(normalizedEmail)) {
      setErrorMessage("Informe um e-mail válido.");
      return false;
    }

    if (password !== confirmPassword) {
      setErrorMessage("As senhas não coincidem.");
      return false;
    }

    if (password.length < 6) {
      setErrorMessage("A senha deve ter pelo menos 6 caracteres.");
      return false;
    }

    if (profile === "pf" && !sanitizeDigits(cpf)) {
      setErrorMessage("CPF é obrigatório.");
      return false;
    }

    if (profile === "cooperativa") {
      if (!cooperativeName.trim() || !sanitizeDigits(registrationNumber)) {
        setErrorMessage("Nome da cooperativa e CNPJ são obrigatórios.");
        return false;
      }
    }

    return true;
  };

  const getProfileTitle = () => {
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
        return "";
    }
  };

  const getUnsupportedMessage = () => {
    switch (profile) {
      case "comercial":
      case "grande":
        return "O cadastro de geradores agora é feito pela cooperativa dentro do painel interno.";
      case "catador":
        return "O cadastro de catadores agora é feito pela cooperativa dentro do painel interno.";
      default:
        return "Este tipo de cadastro não está disponível nesta tela.";
    }
  };

  async function handleRegister() {
  setErrorMessage("");

  if (!isSupportedPublicProfile) {
    Alert.alert("Cadastro interno", getUnsupportedMessage(), [
      {
        text: "OK",
        onPress: () => router.replace("/(public)/access-type"),
      },
    ]);
    return;
  }

  if (!validateFields()) return;

  setLoading(true);

  try {
    const normalizedEmail = email.trim().toLowerCase();
    let result;

    if (profile === "pf") {
      result = await authService.registerPf({
        displayName: name.trim(),
        email: normalizedEmail,
        password,
        phone: phone.trim(),
        rememberMe,
        cpf: sanitizeDigits(cpf),
        address: address.trim() || undefined,
      });
    } else if (profile === "cooperativa") {
      result = await authService.registerCooperative({
        displayName: name.trim(),
        email: normalizedEmail,
        password,
        phone: phone.trim(),
        rememberMe,
        cooperativeName: cooperativeName.trim(),
        registrationNumber: sanitizeDigits(registrationNumber),
        address: address.trim() || undefined,
      });
    }

    if (!result) {
      setErrorMessage("Não foi possível concluir o cadastro.");
      return;
    }

    if (result.success === false) {
      setErrorMessage(result.error);
      return;
    }

    Alert.alert("Sucesso!", "Cadastro realizado com sucesso!", [
      {
        text: "OK",
        onPress: () => {
          router.replace(getRouteByProfile(profile));
        },
      },
    ]);
  } catch (error: any) {
    console.error("Erro no cadastro:", error);
    setErrorMessage(
      error?.message || "Não foi possível concluir o cadastro."
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
          paddingTop: 80,
          paddingBottom: 30,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ width: "100%", maxWidth: 400, alignSelf: "center" }}>
          <View style={{ alignItems: "center", marginBottom: 24 }}>
            <Image
              source={require("../../assets/images/logo.png")}
              resizeMode="contain"
              style={{ width: 70, height: 70, marginBottom: 8 }}
            />

            <Text
              style={{
                fontSize: 28,
                fontWeight: "800",
                color: "#111827",
                marginBottom: 2,
              }}
            >
              KATUÁ
            </Text>

            <View
              style={{
                backgroundColor: "#F0FDF4",
                paddingHorizontal: 16,
                paddingVertical: 6,
                borderRadius: 20,
                marginTop: 4,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: "#028C56",
                  textAlign: "center",
                }}
              >
                {getProfileTitle()}
              </Text>
            </View>
          </View>

          {errorMessage ? (
            <View
              style={{
                backgroundColor: "#FEF2F2",
                borderWidth: 1,
                borderColor: "#FECACA",
                borderRadius: 14,
                padding: 12,
                marginBottom: 16,
              }}
            >
              <Text
                style={{
                  color: "#B91C1C",
                  fontSize: 14,
                  fontWeight: "600",
                  textAlign: "center",
                }}
              >
                {errorMessage}
              </Text>
            </View>
          ) : null}

          {!isSupportedPublicProfile ? (
            <View
              style={{
                backgroundColor: "#FFF7ED",
                borderWidth: 1,
                borderColor: "#FED7AA",
                borderRadius: 16,
                padding: 18,
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: "#9A3412",
                  textAlign: "center",
                }}
              >
                Cadastro interno
              </Text>

              <Text
                style={{
                  marginTop: 10,
                  fontSize: 14,
                  color: "#7C2D12",
                  textAlign: "center",
                  lineHeight: 22,
                }}
              >
                {getUnsupportedMessage()}
              </Text>

              <TouchableOpacity
                onPress={() => router.replace("/(public)/access-type")}
                style={{
                  marginTop: 16,
                  backgroundColor: "#028C56",
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontSize: 15,
                    fontWeight: "700",
                  }}
                >
                  VOLTAR
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <FormInput
                label="Nome completo"
                value={name}
                onChangeText={setName}
                placeholder="Digite seu nome"
                icon="person-outline"
              />

              <FormInput
                label="E-mail"
                value={email}
                onChangeText={setEmail}
                placeholder="Digite seu e-mail"
                icon="mail-outline"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <PasswordInput
                label="Senha"
                value={password}
                onChangeText={setPassword}
                placeholder="Digite sua senha"
                secureTextEntry={!showPassword}
                onToggleVisibility={() => setShowPassword((prev) => !prev)}
                icon={showPassword ? "eye-off-outline" : "eye-outline"}
              />

              <PasswordInput
                label="Confirmar senha"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirme sua senha"
                secureTextEntry={!showConfirmPassword}
                onToggleVisibility={() =>
                  setShowConfirmPassword((prev) => !prev)
                }
                icon={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
              />

              <FormInput
                label="Telefone"
                value={phone}
                onChangeText={setPhone}
                placeholder="Digite seu telefone"
                icon="call-outline"
                keyboardType="phone-pad"
              />

              <FormInput
                label="Endereço"
                value={address}
                onChangeText={setAddress}
                placeholder="Digite seu endereço"
                icon="location-outline"
              />

              {profile === "pf" && (
                <FormInput
                  label="CPF"
                  value={cpf}
                  onChangeText={setCpf}
                  placeholder="Digite seu CPF"
                  icon="card-outline"
                  keyboardType="numeric"
                />
              )}

              {profile === "cooperativa" && (
                <>
                  <FormInput
                    label="Nome da cooperativa"
                    value={cooperativeName}
                    onChangeText={setCooperativeName}
                    placeholder="Digite o nome da cooperativa"
                    icon="business-outline"
                  />

                  <FormInput
                    label="CNPJ"
                    value={registrationNumber}
                    onChangeText={setRegistrationNumber}
                    placeholder="Digite o CNPJ"
                    icon="document-text-outline"
                    keyboardType="numeric"
                  />
                </>
              )}

              <TouchableOpacity
                onPress={() => setRememberMe((prev) => !prev)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: 8,
                  marginBottom: 18,
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    borderWidth: 2,
                    borderColor: rememberMe ? "#028C56" : "#D1D5DB",
                    backgroundColor: rememberMe ? "#028C56" : "#FFFFFF",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {rememberMe ? (
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  ) : null}
                </View>

                <Text
                  style={{
                    marginLeft: 10,
                    color: "#374151",
                    fontSize: 14,
                    fontWeight: "500",
                  }}
                >
                  Lembrar de mim
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={loading}
                onPress={handleRegister}
                activeOpacity={0.9}
                style={{ borderRadius: 18, overflow: "hidden" }}
              >
                <LinearGradient
                  colors={["#10F35D", "#028C56"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    paddingVertical: 16,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text
                      style={{
                        color: "#FFFFFF",
                        fontSize: 16,
                        fontWeight: "800",
                      }}
                    >
                      CADASTRAR
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FormInput({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  icon: keyof typeof Ionicons.glyphMap;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text
        style={{
          fontSize: 14,
          fontWeight: "600",
          color: "#374151",
          marginBottom: 8,
        }}
      >
        {label}
      </Text>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "#F9FAFB",
          borderRadius: 14,
          borderWidth: 1,
          borderColor: "#E5E7EB",
          paddingHorizontal: 14,
        }}
      >
        <Ionicons name={icon} size={18} color="#6B7280" />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          style={{
            flex: 1,
            paddingVertical: 14,
            paddingHorizontal: 10,
            color: "#111827",
          }}
        />
      </View>
    </View>
  );
}

function PasswordInput({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  onToggleVisibility,
  icon,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry: boolean;
  onToggleVisibility: () => void;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text
        style={{
          fontSize: 14,
          fontWeight: "600",
          color: "#374151",
          marginBottom: 8,
        }}
      >
        {label}
      </Text>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "#F9FAFB",
          borderRadius: 14,
          borderWidth: 1,
          borderColor: "#E5E7EB",
          paddingHorizontal: 14,
        }}
      >
        <Ionicons name="lock-closed-outline" size={18} color="#6B7280" />

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          secureTextEntry={secureTextEntry}
          style={{
            flex: 1,
            paddingVertical: 14,
            paddingHorizontal: 10,
            color: "#111827",
          }}
        />

        <TouchableOpacity onPress={onToggleVisibility}>
          <Ionicons name={icon} size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>
    </View>
  );
}