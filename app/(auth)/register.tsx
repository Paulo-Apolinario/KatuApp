import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { api } from "@/src/services/api";
import {
  registerDraftStore,
  type RegisterDraftProfile,
} from "@/src/stores/registerDraftStore";

type ProfileType = "pf" | "comercial" | "grande" | "cooperativa" | "catador";

type ViaCepResponse = {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

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
  const params = useLocalSearchParams<{
    profile?: string;
    selectedLatitude?: string;
    selectedLongitude?: string;
  }>();

  const profile = (params.profile as ProfileType) || "pf";
  const initialDraft = registerDraftStore.get(profile as RegisterDraftProfile);
  const bootstrappedRef = useRef(false);

  const [name, setName] = useState(initialDraft.name);
  const [email, setEmail] = useState(initialDraft.email);
  const [password, setPassword] = useState(initialDraft.password);
  const [confirmPassword, setConfirmPassword] = useState(initialDraft.confirmPassword);
  const [phone, setPhone] = useState(initialDraft.phone);
  const [rememberMe, setRememberMe] = useState(initialDraft.rememberMe);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [cpf, setCpf] = useState(initialDraft.cpf);
  const [cooperativeName, setCooperativeName] = useState(initialDraft.cooperativeName);
  const [registrationNumber, setRegistrationNumber] = useState(initialDraft.registrationNumber);

  const [zipCode, setZipCode] = useState(initialDraft.zipCode);
  const [street, setStreet] = useState(initialDraft.street);
  const [number, setNumber] = useState(initialDraft.number);
  const [neighborhood, setNeighborhood] = useState(initialDraft.neighborhood);
  const [city, setCity] = useState(initialDraft.city);
  const [stateName, setStateName] = useState(initialDraft.stateName);
  const [address, setAddress] = useState(initialDraft.address);

  const [latitude, setLatitude] = useState(initialDraft.latitude);
  const [longitude, setLongitude] = useState(initialDraft.longitude);

  const [loadingCep, setLoadingCep] = useState(false);

  const isSupportedPublicProfile = useMemo(() => {
    return profile === "pf" || profile === "cooperativa";
  }, [profile]);

  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    registerDraftStore.set({
      profile: profile as RegisterDraftProfile,
    });
  }, [profile]);

  useEffect(() => {
    if (profile !== "cooperativa") return;

    const nextLat =
      typeof params.selectedLatitude === "string" ? params.selectedLatitude : "";
    const nextLng =
      typeof params.selectedLongitude === "string" ? params.selectedLongitude : "";

    if (nextLat && nextLng) {
      setLatitude(nextLat);
      setLongitude(nextLng);
    }
  }, [params.selectedLatitude, params.selectedLongitude, profile]);

  useEffect(() => {
    registerDraftStore.set({
      profile: profile as RegisterDraftProfile,
      name,
      email,
      password,
      confirmPassword,
      phone,
      rememberMe,
      cpf,
      cooperativeName,
      registrationNumber,
      zipCode,
      street,
      number,
      neighborhood,
      city,
      stateName,
      address,
      latitude,
      longitude,
    });
  }, [
    profile,
    name,
    email,
    password,
    confirmPassword,
    phone,
    rememberMe,
    cpf,
    cooperativeName,
    registrationNumber,
    zipCode,
    street,
    number,
    neighborhood,
    city,
    stateName,
    address,
    latitude,
    longitude,
  ]);

  async function handleLookupCep(rawValue?: string) {
    const cep = sanitizeDigits(rawValue ?? zipCode);

    if (cep.length !== 8) return;

    try {
      setLoadingCep(true);
      setErrorMessage("");

      const data = await api.getExternalJson<ViaCepResponse>(
        `https://viacep.com.br/ws/${cep}/json/`
      );

      if (data?.erro) {
        Alert.alert("CEP não encontrado", "Não localizamos esse CEP.");
        return;
      }

      setZipCode(cep);
      setStreet(data.logradouro || "");
      setNeighborhood(data.bairro || "");
      setCity(data.localidade || "");
      setStateName(data.uf || "");

      const nextAddress = [
        data.logradouro || "",
        number.trim(),
        data.bairro || "",
        data.localidade || "",
        data.uf || "",
      ]
        .filter(Boolean)
        .join(", ");

      setAddress(nextAddress);
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
      Alert.alert(
        "Erro",
        "Não foi possível consultar o CEP agora. Você pode preencher manualmente."
      );
    } finally {
      setLoadingCep(false);
    }
  }

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

      const hasStructuredAddress =
        !!street.trim() ||
        !!number.trim() ||
        !!neighborhood.trim() ||
        !!city.trim() ||
        !!stateName.trim() ||
        !!zipCode.trim() ||
        !!address.trim();

      const hasManualCoordinates =
        latitude.trim().length > 0 && longitude.trim().length > 0;

      if (!hasStructuredAddress && !hasManualCoordinates) {
        setErrorMessage(
          "Informe ao menos um endereço ou marque a localização no mapa."
        );
        return false;
      }

      if (
        (latitude.trim() && Number.isNaN(Number(latitude))) ||
        (longitude.trim() && Number.isNaN(Number(longitude)))
      ) {
        setErrorMessage("Latitude e longitude devem ser números válidos.");
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

  function handleOpenLocationPicker() {
    registerDraftStore.set({
      profile: "cooperativa",
      name,
      email,
      password,
      confirmPassword,
      phone,
      rememberMe,
      cpf,
      cooperativeName,
      registrationNumber,
      zipCode,
      street,
      number,
      neighborhood,
      city,
      stateName,
      address,
      latitude,
      longitude,
    });

    router.push({
      pathname: "/(auth)/select-location",
      params: {
        from: "register",
        latitude: latitude || undefined,
        longitude: longitude || undefined,
      },
    });
  }

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
      } else {
        result = await authService.registerCooperative({
          displayName: name.trim(),
          email: normalizedEmail,
          password,
          phone: phone.trim(),
          rememberMe,
          cooperativeName: cooperativeName.trim(),
          registrationNumber: sanitizeDigits(registrationNumber),
          address: address.trim() || undefined,
          zipCode: sanitizeDigits(zipCode) || undefined,
          street: street.trim() || undefined,
          number: number.trim() || undefined,
          neighborhood: neighborhood.trim() || undefined,
          city: city.trim() || undefined,
          state: stateName.trim() || undefined,
          latitude: latitude.trim() ? Number(latitude) : undefined,
          longitude: longitude.trim() ? Number(longitude) : undefined,
        });
      }

      if (!result) {
        setErrorMessage("Não foi possível concluir o cadastro.");
        return;
      }

      if (result.success === false) {
        setErrorMessage(
          (result as any).error ||
            (result as any).message ||
            "Erro ao cadastrar."
        );
        return;
      }

      registerDraftStore.clear(profile as RegisterDraftProfile);

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
        <View style={{ width: "100%", maxWidth: 440, alignSelf: "center" }}>
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

                  <SectionTitle title="Endereço estruturado" />

                  <FormInput
                    label="CEP"
                    value={zipCode}
                    onChangeText={(value) => {
                      const sanitized = sanitizeDigits(value);
                      setZipCode(sanitized);

                      if (sanitized.length === 8) {
                        handleLookupCep(sanitized);
                      }
                    }}
                    onBlur={() => handleLookupCep(zipCode)}
                    placeholder="Digite o CEP, se existir"
                    icon="mail-open-outline"
                    keyboardType="numeric"
                    loading={loadingCep}
                  />

                  <FormInput
                    label="Rua / Logradouro"
                    value={street}
                    onChangeText={setStreet}
                    placeholder="Digite a rua ou logradouro"
                    icon="navigate-outline"
                  />

                  <FormInput
                    label="Número"
                    value={number}
                    onChangeText={(value) => {
                      setNumber(value);

                      const nextAddress = [
                        street.trim(),
                        value.trim(),
                        neighborhood.trim(),
                        city.trim(),
                        stateName.trim(),
                      ]
                        .filter(Boolean)
                        .join(", ");

                      if (nextAddress) {
                        setAddress(nextAddress);
                      }
                    }}
                    placeholder="Digite o número"
                    icon="home-outline"
                  />

                  <FormInput
                    label="Bairro"
                    value={neighborhood}
                    onChangeText={setNeighborhood}
                    placeholder="Digite o bairro"
                    icon="map-outline"
                  />

                  <FormInput
                    label="Cidade"
                    value={city}
                    onChangeText={setCity}
                    placeholder="Digite a cidade"
                    icon="business-outline"
                  />

                  <FormInput
                    label="Estado"
                    value={stateName}
                    onChangeText={setStateName}
                    placeholder="Digite o estado"
                    icon="flag-outline"
                  />

                  <FormInput
                    label="Endereço resumido"
                    value={address}
                    onChangeText={setAddress}
                    placeholder="Resumo do endereço"
                    icon="location-outline"
                  />

                  <SectionTitle title="Localização no mapa" />

                  <Text
                    style={{
                      fontSize: 13,
                      color: "#6B7280",
                      marginBottom: 10,
                      lineHeight: 20,
                    }}
                  >
                    Se o CEP não for encontrado ou o endereço não for preciso,
                    use o mapa para marcar o ponto exato da cooperativa.
                  </Text>

                  <TouchableOpacity
                    onPress={handleOpenLocationPicker}
                    activeOpacity={0.88}
                    style={{
                      backgroundColor: "#F0FDF4",
                      borderWidth: 1,
                      borderColor: "#BBF7D0",
                      borderRadius: 16,
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 14,
                    }}
                  >
                    <Ionicons name="map-outline" size={18} color="#028C56" />
                    <Text
                      style={{
                        marginLeft: 8,
                        color: "#028C56",
                        fontWeight: "800",
                        fontSize: 14,
                      }}
                    >
                      SELECIONAR NO MAPA
                    </Text>
                  </TouchableOpacity>

                  {(latitude || longitude) ? (
                    <View
                      style={{
                        backgroundColor: "#ECFDF5",
                        borderWidth: 1,
                        borderColor: "#A7F3D0",
                        borderRadius: 14,
                        padding: 12,
                        marginBottom: 14,
                      }}
                    >
                      <Text
                        style={{
                          color: "#065F46",
                          fontWeight: "800",
                          fontSize: 13,
                        }}
                      >
                        Localização selecionada
                      </Text>
                      <Text style={{ color: "#065F46", marginTop: 6, fontSize: 13 }}>
                        Latitude: {latitude || "-"}
                      </Text>
                      <Text style={{ color: "#065F46", marginTop: 4, fontSize: 13 }}>
                        Longitude: {longitude || "-"}
                      </Text>
                    </View>
                  ) : null}

                  
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

function SectionTitle({ title }: { title: string }) {
  return (
    <View style={{ marginTop: 8, marginBottom: 10 }}>
      <Text
        style={{
          fontSize: 15,
          fontWeight: "800",
          color: "#111827",
        }}
      >
        {title}
      </Text>
    </View>
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
  onBlur,
  loading = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  icon: keyof typeof Ionicons.glyphMap;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  onBlur?: () => void;
  loading?: boolean;
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
          onBlur={onBlur}
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
        {loading ? <ActivityIndicator size="small" color="#028C56" /> : null}
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