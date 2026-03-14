import { router } from "expo-router";
import { useState } from "react";
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
import {
  collection,
  getDocs,
  limit,
  query,
  updateDoc,
  where,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  signOut,
} from "firebase/auth";

import { auth, db } from "@/src/services/firebaseConfig";

export default function ActivateAccessScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  function validateFields() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password.trim() || !confirmPassword.trim()) {
      Alert.alert("Atenção", "Preencha todos os campos.");
      return false;
    }

    if (password.length < 6) {
      Alert.alert("Atenção", "A senha deve ter pelo menos 6 caracteres.");
      return false;
    }

    if (password !== confirmPassword) {
      Alert.alert("Atenção", "As senhas não coincidem.");
      return false;
    }

    return true;
  }

  async function handleActivateAccess() {
    if (!validateFields()) return;

    try {
      setLoading(true);

      const normalizedEmail = email.trim().toLowerCase();

      const methods = await fetchSignInMethodsForEmail(auth, normalizedEmail);

      if (methods.length > 0) {
        Alert.alert(
          "Acesso já liberado",
          "Este e-mail já possui acesso. Faça login normalmente.",
          [
            {
              text: "Ir para login",
              onPress: () => router.replace("/(public)/choose-profile"),
            },
          ]
        );
        return;
      }

      const geradorQuery = query(
        collection(db, "geradores"),
        where("email", "==", normalizedEmail),
        limit(1)
      );

      const geradorSnap = await getDocs(geradorQuery);

      if (geradorSnap.empty) {
        Alert.alert(
          "Acesso não liberado",
          "Não encontramos cadastro com este e-mail. Verifique com a cooperativa."
        );
        return;
      }

      const geradorDocSnap = geradorSnap.docs[0];
      const geradorData: any = geradorDocSnap.data();

      const usersQuery = query(
        collection(db, "users"),
        where("email", "==", normalizedEmail),
        limit(1)
      );

      const usersSnap = await getDocs(usersQuery);

      if (usersSnap.empty) {
        Alert.alert(
          "Acesso não liberado",
          "Existe o gerador, mas o vínculo de acesso ainda não foi criado corretamente pela cooperativa."
        );
        return;
      }

      const userDocSnap = usersSnap.docs[0];
      const userData: any = userDocSnap.data();

      const authResult = await createUserWithEmailAndPassword(
        auth,
        normalizedEmail,
        password
      );

      const firebaseUser = authResult.user;

      const finalUserType =
        userData.userType || (geradorData.tipo === "grande" ? "grande" : "comercial");

      await updateDoc(doc(db, "users", userDocSnap.id), {
        uid: firebaseUser.uid,
        email: normalizedEmail,
        displayName:
          userData.displayName ||
          geradorData.nome ||
          geradorData.companyName ||
          "Gerador",
        userType: finalUserType,
        geradorId: geradorDocSnap.id,
        cooperativaId: geradorData.cooperativaId || userData.cooperativaId || "",
        phone: geradorData.telefone || userData.phone || "",
        address: geradorData.endereco || userData.address || "",
        companyName: geradorData.nome || userData.companyName || "",
        accessReleased: true,
        accessStatus: "liberado",
        activatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "geradores", geradorDocSnap.id), {
        uid: firebaseUser.uid,
        userId: firebaseUser.uid,
        hasAccess: true,
        accessReleased: true,
        accessStatus: "liberado",
        updatedAt: serverTimestamp(),
      });

      await signOut(auth);

      Alert.alert(
        "Acesso liberado",
        "Seu acesso foi liberado com sucesso. Agora faça login com seu e-mail e senha.",
        [
          {
            text: "Ir para login",
            onPress: () => router.replace("/(public)/choose-profile"),
          },
        ]
      );
    } catch (error: any) {
      console.error("Erro ao liberar acesso:", error);

      let message = "Não foi possível liberar seu acesso.";

      if (error?.code === "auth/email-already-in-use") {
        message = "Este e-mail já possui acesso liberado.";
      } else if (error?.code === "auth/invalid-email") {
        message = "E-mail inválido.";
      } else if (error?.code === "auth/weak-password") {
        message = "Senha muito fraca.";
      } else if (error?.code === "auth/network-request-failed") {
        message = "Falha de rede. Verifique sua conexão.";
      }

      Alert.alert("Acesso não liberado", message);
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
              KATU
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
              Liberar acesso do gerador
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
              Informe o e-mail cadastrado pela cooperativa e defina sua senha.
            </Text>
          </View>

          <View style={{ marginBottom: 18 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
              <Ionicons name="mail-outline" size={18} color="#028C56" />
              <Text style={{ color: "#028C56", marginLeft: 6, fontWeight: "500", fontSize: 14 }}>
                E-mail cadastrado *
              </Text>
            </View>

            <TextInput
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="empresa@email.com"
              placeholderTextColor="#9CA3AF"
              style={{
                borderBottomWidth: 1,
                borderBottomColor: "#D1D5DB",
                paddingVertical: 10,
                fontSize: 15,
                color: "#111827",
              }}
            />
          </View>

          <View style={{ marginBottom: 18 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 6,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="lock-closed-outline" size={18} color="#028C56" />
                <Text style={{ color: "#028C56", marginLeft: 6, fontWeight: "500", fontSize: 14 }}>
                  Nova senha *
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
                paddingVertical: 10,
                fontSize: 15,
                color: "#111827",
              }}
            />
          </View>

          <View style={{ marginBottom: 28 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 6,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="lock-closed-outline" size={18} color="#028C56" />
                <Text style={{ color: "#028C56", marginLeft: 6, fontWeight: "500", fontSize: 14 }}>
                  Confirmar senha *
                </Text>
              </View>

              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
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
                paddingVertical: 10,
                fontSize: 15,
                color: "#111827",
              }}
            />
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleActivateAccess}
            disabled={loading}
            style={{ width: "100%", marginBottom: 18 }}
          >
            <LinearGradient
              colors={["#10F35D", "#028C56"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                height: 52,
                borderRadius: 10,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? (
                <>
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
                </>
              ) : (
                <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "800" }}>
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