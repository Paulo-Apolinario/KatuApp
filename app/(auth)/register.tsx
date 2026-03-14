import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/src/services/firebaseConfig";

type ProfileType = "pf" | "comercial" | "grande" | "cooperativa" | "catador";

function getRouteByProfile(profile: ProfileType) {
  switch (profile) {
    case "pf":
      return "/(pf-tabs)/home";
    case "comercial":
    case "grande":
      return "/(gerador)/dashboard";
    case "cooperativa":
      return "/(cooperativa)/home";
    case "catador":
      return "/(catador)/homecat";
    default:
      return "/(public)/access-type";
  }
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
  const [cnpj, setCnpj] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [cooperativeName, setCooperativeName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [rg, setRg] = useState("");
  const [birthDate, setBirthDate] = useState("");

  const validateFields = () => {
    if (
      !name.trim() ||
      !email.trim() ||
      !password.trim() ||
      !confirmPassword.trim() ||
      !phone.trim()
    ) {
      setErrorMessage("Preencha todos os campos obrigatórios");
      return false;
    }

    if (password !== confirmPassword) {
      setErrorMessage("As senhas não coincidem");
      return false;
    }

    if (password.length < 6) {
      setErrorMessage("A senha deve ter pelo menos 6 caracteres");
      return false;
    }

    switch (profile) {
      case "pf":
        if (!cpf.trim()) {
          setErrorMessage("CPF é obrigatório");
          return false;
        }
        break;

      case "comercial":
      case "grande":
        if (!cnpj.trim() || !companyName.trim()) {
          setErrorMessage("CNPJ e Nome da Empresa são obrigatórios");
          return false;
        }
        break;

      case "cooperativa":
        if (!cooperativeName.trim() || !registrationNumber.trim()) {
          setErrorMessage("Nome da Cooperativa e CNPJ são obrigatórios");
          return false;
        }
        break;

      case "catador":
        if (!rg.trim() || !birthDate.trim()) {
          setErrorMessage("RG e Data de Nascimento são obrigatórios");
          return false;
        }
        break;
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

  async function handleRegister() {
    setErrorMessage("");

    if (!validateFields()) return;

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      const user = userCredential.user;

      await updateProfile(user, {
        displayName: name.trim(),
      });

      const baseUserData: any = {
        uid: user.uid,
        email: user.email,
        displayName: name.trim(),
        userType: profile,
        phone: phone.trim(),
        rememberMe,
        createdAt: serverTimestamp(),
      };

      switch (profile) {
        case "pf":
          baseUserData.cpf = cpf.replace(/[^\d]/g, "");
          baseUserData.documentType = "CPF";
          baseUserData.totalKg = 0;
          baseUserData.greenStreak = 0;
          break;

        case "comercial":
        case "grande":
          baseUserData.cnpj = cnpj.replace(/[^\d]/g, "");
          baseUserData.companyName = companyName.trim();
          baseUserData.documentType = "CNPJ";
          baseUserData.companySize =
            profile === "comercial" ? "pequeno" : "grande";
          break;

        case "cooperativa":
          baseUserData.cooperativeName = cooperativeName.trim();
          baseUserData.registrationNumber = registrationNumber.replace(
            /[^\d]/g,
            ""
          );
          baseUserData.documentType = "CNPJ";
          break;

        case "catador":
          baseUserData.rg = rg.replace(/[^\d]/g, "");
          baseUserData.birthDate = birthDate.trim();
          baseUserData.status = "disponivel";
          baseUserData.kgMes = 0;
          baseUserData.coletasHoje = 0;
          baseUserData.totalKg = 0;
          break;
      }

      await setDoc(doc(db, "users", user.uid), baseUserData);

      if (profile === "catador") {
        const catadorData = {
          uid: user.uid,
          nome: name.trim(),
          telefone: phone.trim(),
          email: email.trim(),
          status: "disponivel",
          kgMes: 0,
          coletasHoje: 0,
          totalKg: 0,
          rg: rg.replace(/[^\d]/g, ""),
          birthDate: birthDate.trim(),
          createdAt: serverTimestamp(),
        };

        await setDoc(doc(db, "catadores", user.uid), catadorData);
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
      console.error("ERRO COMPLETO:", error);
      console.error("CODE:", error?.code);
      console.error("MESSAGE:", error?.message);

      let message = "Erro ao cadastrar";

      if (error.code === "auth/email-already-in-use") {
        message = "Este e-mail já está em uso";
      } else if (error.code === "auth/invalid-email") {
        message = "E-mail inválido";
      } else if (error.code === "auth/weak-password") {
        message = "Senha muito fraca";
      } else if (error.code === "auth/network-request-failed") {
        message = "Falha de rede ao comunicar com o Firebase";
      } else if (error.code === "permission-denied") {
        message = "Sem permissão para gravar no Firestore";
      } else if (error.message) {
        message = error.message;
      }

      setErrorMessage(message);
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
              KATU
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
                borderColor: "#EF4444",
                borderRadius: 8,
                padding: 10,
                marginBottom: 16,
              }}
            >
              <Text style={{ color: "#991B1B", fontSize: 13 }}>
                {errorMessage}
              </Text>
            </View>
          ) : null}

          <View style={{ marginBottom: 16 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}
            >
              <Ionicons name="person-outline" size={18} color="#028C56" />
              <Text
                style={{
                  color: "#028C56",
                  marginLeft: 6,
                  fontWeight: "500",
                  fontSize: 14,
                }}
              >
                Nome Completo *
              </Text>
            </View>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Digite seu nome completo"
              placeholderTextColor="#9CA3AF"
              style={{
                borderBottomWidth: 1,
                borderBottomColor: "#D1D5DB",
                paddingVertical: 8,
                fontSize: 15,
                color: "#111827",
              }}
            />
          </View>

          <View style={{ marginBottom: 16 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}
            >
              <Ionicons name="mail-outline" size={18} color="#028C56" />
              <Text
                style={{
                  color: "#028C56",
                  marginLeft: 6,
                  fontWeight: "500",
                  fontSize: 14,
                }}
              >
                Email *
              </Text>
            </View>
            <TextInput
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="seu@email.com"
              placeholderTextColor="#9CA3AF"
              style={{
                borderBottomWidth: 1,
                borderBottomColor: "#D1D5DB",
                paddingVertical: 8,
                fontSize: 15,
                color: "#111827",
              }}
            />
          </View>

          <View style={{ marginBottom: 16 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}
            >
              <Ionicons name="call-outline" size={18} color="#028C56" />
              <Text
                style={{
                  color: "#028C56",
                  marginLeft: 6,
                  fontWeight: "500",
                  fontSize: 14,
                }}
              >
                Telefone *
              </Text>
            </View>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="(88) 90000-0000"
              placeholderTextColor="#9CA3AF"
              style={{
                borderBottomWidth: 1,
                borderBottomColor: "#D1D5DB",
                paddingVertical: 8,
                fontSize: 15,
                color: "#111827",
              }}
            />
          </View>

          {profile === "pf" && (
            <View style={{ marginBottom: 16 }}>
              <View
                style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}
              >
                <Ionicons name="card-outline" size={18} color="#028C56" />
                <Text
                  style={{
                    color: "#028C56",
                    marginLeft: 6,
                    fontWeight: "500",
                    fontSize: 14,
                  }}
                >
                  CPF *
                </Text>
              </View>
              <TextInput
                value={cpf}
                onChangeText={setCpf}
                keyboardType="numeric"
                placeholder="000.000.000-00"
                placeholderTextColor="#9CA3AF"
                maxLength={14}
                style={{
                  borderBottomWidth: 1,
                  borderBottomColor: "#D1D5DB",
                  paddingVertical: 8,
                  fontSize: 15,
                  color: "#111827",
                }}
              />
            </View>
          )}

          {(profile === "comercial" || profile === "grande") && (
            <>
              <View style={{ marginBottom: 16 }}>
                <View
                  style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}
                >
                  <Ionicons name="business-outline" size={18} color="#028C56" />
                  <Text
                    style={{
                      color: "#028C56",
                      marginLeft: 6,
                      fontWeight: "500",
                      fontSize: 14,
                    }}
                  >
                    Nome da Empresa *
                  </Text>
                </View>
                <TextInput
                  value={companyName}
                  onChangeText={setCompanyName}
                  placeholder="Razão Social"
                  placeholderTextColor="#9CA3AF"
                  style={{
                    borderBottomWidth: 1,
                    borderBottomColor: "#D1D5DB",
                    paddingVertical: 8,
                    fontSize: 15,
                    color: "#111827",
                  }}
                />
              </View>

              <View style={{ marginBottom: 16 }}>
                <View
                  style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={18}
                    color="#028C56"
                  />
                  <Text
                    style={{
                      color: "#028C56",
                      marginLeft: 6,
                      fontWeight: "500",
                      fontSize: 14,
                    }}
                  >
                    CNPJ *
                  </Text>
                </View>
                <TextInput
                  value={cnpj}
                  onChangeText={setCnpj}
                  keyboardType="numeric"
                  placeholder="00.000.000/0001-00"
                  placeholderTextColor="#9CA3AF"
                  maxLength={18}
                  style={{
                    borderBottomWidth: 1,
                    borderBottomColor: "#D1D5DB",
                    paddingVertical: 8,
                    fontSize: 15,
                    color: "#111827",
                  }}
                />
              </View>
            </>
          )}

          {profile === "cooperativa" && (
            <>
              <View style={{ marginBottom: 16 }}>
                <View
                  style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}
                >
                  <Ionicons name="people-outline" size={18} color="#028C56" />
                  <Text
                    style={{
                      color: "#028C56",
                      marginLeft: 6,
                      fontWeight: "500",
                      fontSize: 14,
                    }}
                  >
                    Nome da Cooperativa *
                  </Text>
                </View>
                <TextInput
                  value={cooperativeName}
                  onChangeText={setCooperativeName}
                  placeholder="Cooperativa de Reciclagem"
                  placeholderTextColor="#9CA3AF"
                  style={{
                    borderBottomWidth: 1,
                    borderBottomColor: "#D1D5DB",
                    paddingVertical: 8,
                    fontSize: 15,
                    color: "#111827",
                  }}
                />
              </View>

              <View style={{ marginBottom: 16 }}>
                <View
                  style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={18}
                    color="#028C56"
                  />
                  <Text
                    style={{
                      color: "#028C56",
                      marginLeft: 6,
                      fontWeight: "500",
                      fontSize: 14,
                    }}
                  >
                    CNPJ / Registro *
                  </Text>
                </View>
                <TextInput
                  value={registrationNumber}
                  onChangeText={setRegistrationNumber}
                  keyboardType="numeric"
                  placeholder="00.000.000/0001-00"
                  placeholderTextColor="#9CA3AF"
                  maxLength={18}
                  style={{
                    borderBottomWidth: 1,
                    borderBottomColor: "#D1D5DB",
                    paddingVertical: 8,
                    fontSize: 15,
                    color: "#111827",
                  }}
                />
              </View>
            </>
          )}

          {profile === "catador" && (
            <>
              <View style={{ marginBottom: 16 }}>
                <View
                  style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}
                >
                  <Ionicons name="card-outline" size={18} color="#028C56" />
                  <Text
                    style={{
                      color: "#028C56",
                      marginLeft: 6,
                      fontWeight: "500",
                      fontSize: 14,
                    }}
                  >
                    RG *
                  </Text>
                </View>
                <TextInput
                  value={rg}
                  onChangeText={setRg}
                  keyboardType="numeric"
                  placeholder="00.000.000-0"
                  placeholderTextColor="#9CA3AF"
                  style={{
                    borderBottomWidth: 1,
                    borderBottomColor: "#D1D5DB",
                    paddingVertical: 8,
                    fontSize: 15,
                    color: "#111827",
                  }}
                />
              </View>

              <View style={{ marginBottom: 16 }}>
                <View
                  style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}
                >
                  <Ionicons name="calendar-outline" size={18} color="#028C56" />
                  <Text
                    style={{
                      color: "#028C56",
                      marginLeft: 6,
                      fontWeight: "500",
                      fontSize: 14,
                    }}
                  >
                    Data de Nascimento *
                  </Text>
                </View>
                <TextInput
                  value={birthDate}
                  onChangeText={setBirthDate}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor="#9CA3AF"
                  maxLength={10}
                  style={{
                    borderBottomWidth: 1,
                    borderBottomColor: "#D1D5DB",
                    paddingVertical: 8,
                    fontSize: 15,
                    color: "#111827",
                  }}
                />
              </View>
            </>
          )}

          <View style={{ marginBottom: 16 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="lock-closed-outline" size={18} color="#028C56" />
                <Text
                  style={{
                    color: "#028C56",
                    marginLeft: 6,
                    fontWeight: "500",
                    fontSize: 14,
                  }}
                >
                  Senha *
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
                  size={18}
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
              style={{
                borderBottomWidth: 1,
                borderBottomColor: "#D1D5DB",
                paddingVertical: 8,
                fontSize: 15,
                color: "#111827",
              }}
            />
          </View>

          <View style={{ marginBottom: 16 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="lock-closed-outline" size={18} color="#028C56" />
                <Text
                  style={{
                    color: "#028C56",
                    marginLeft: 6,
                    fontWeight: "500",
                    fontSize: 14,
                  }}
                >
                  Confirmar Senha *
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Ionicons
                  name={showConfirmPassword ? "eye-outline" : "eye-off-outline"}
                  size={18}
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
              style={{
                borderBottomWidth: 1,
                borderBottomColor: "#D1D5DB",
                paddingVertical: 8,
                fontSize: 15,
                color: "#111827",
              }}
            />
          </View>

          <View
            style={{ flexDirection: "row", alignItems: "center", marginBottom: 24 }}
          >
            <TouchableOpacity
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
                  <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                )}
              </View>
              <Text style={{ fontSize: 13, color: "#4B5563" }}>Lembre-me</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleRegister}
            disabled={loading}
            style={{ width: "100%", marginBottom: 16 }}
          >
            <LinearGradient
              colors={["#10F35D", "#028C56"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                height: 48,
                borderRadius: 8,
                alignItems: "center",
                justifyContent: "center",
                opacity: loading ? 0.7 : 1,
              }}
            >
              <Text
                style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "800" }}
              >
                {loading ? "CADASTRANDO..." : "CADASTRAR"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={{ flexDirection: "row", justifyContent: "center" }}>
            <Text style={{ color: "#4B5563", fontSize: 13 }}>
              Já tem uma conta?{" "}
            </Text>
            <TouchableOpacity
              onPress={() => router.push(`/(auth)/login?profile=${profile}`)}
            >
              <Text
                style={{
                  color: "#028C56",
                  fontSize: 13,
                  fontWeight: "700",
                  textDecorationLine: "underline",
                }}
              >
                Faça login
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}