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
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";

import { auth, db } from "@/src/services/firebaseConfig";

export default function ActivateGeneratorScreen() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleActivate() {
    const emailFormatado = email.trim().toLowerCase();

    if (!emailFormatado || !senha || !confirmarSenha) {
      Alert.alert("Atenção", "Preencha email, senha e confirmação de senha.");
      return;
    }

    if (senha.length < 6) {
      Alert.alert("Atenção", "A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    if (senha !== confirmarSenha) {
      Alert.alert("Atenção", "As senhas não coincidem.");
      return;
    }

    try {
      setLoading(true);

      const q = query(
        collection(db, "geradores"),
        where("email", "==", emailFormatado)
      );

      const snap = await getDocs(q);

      if (snap.empty) {
        Alert.alert(
          "Não encontrado",
          "Nenhum gerador com esse email foi encontrado. Verifique o email cadastrado pela cooperativa."
        );
        return;
      }

      const geradorDoc = snap.docs[0];
      const geradorData: any = geradorDoc.data();

      if (geradorData.hasAccess === true || geradorData.userId) {
        Alert.alert(
          "Acesso já liberado",
          "Este gerador já possui acesso. Faça login normalmente."
        );
        return;
      }

      if (!geradorData.tipo || (geradorData.tipo !== "pequeno" && geradorData.tipo !== "grande")) {
        Alert.alert("Erro", "Tipo de gerador inválido para ativação.");
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        emailFormatado,
        senha
      );

      const firebaseUser = userCredential.user;

      const userType = geradorData.tipo === "pequeno" ? "comercial" : "grande";

      await setDoc(doc(db, "users", firebaseUser.uid), {
        uid: firebaseUser.uid,
        email: emailFormatado,
        displayName: geradorData.nome || "Gerador",
        userType,
        geradorId: geradorDoc.id,
        cooperativaId: geradorData.cooperativaId || null,
        rememberMe: false,
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "geradores", geradorDoc.id), {
        hasAccess: true,
        userId: firebaseUser.uid,
        accessStatus: "ativo",
        updatedAt: serverTimestamp(),
      });

      Alert.alert(
        "Sucesso",
        "Acesso liberado com sucesso! Agora você pode entrar no sistema.",
        [
          {
            text: "OK",
            onPress: () => {
              router.replace(`/(auth)/login?profile=${userType}`);
            },
          },
        ]
      );
    } catch (error: any) {
      console.error("Erro ao ativar acesso:", error);

      let mensagem = "Não foi possível liberar o acesso.";

      if (error?.code === "auth/email-already-in-use") {
        mensagem =
          "Este email já possui uma conta de acesso. Tente fazer login.";
      } else if (error?.code === "auth/invalid-email") {
        mensagem = "Email inválido.";
      } else if (error?.code === "auth/weak-password") {
        mensagem = "Senha muito fraca.";
      }

      Alert.alert("Erro", mensagem);
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
        onPress={() => router.replace("/(public)/access-type")}
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
          paddingTop: 100,
          paddingBottom: 30,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ width: "100%", maxWidth: 420, alignSelf: "center" }}>
          <View style={{ alignItems: "center", marginBottom: 28 }}>
            <Text
              style={{
                fontSize: 28,
                fontWeight: "800",
                color: "#111827",
                textAlign: "center",
              }}
            >
              Liberar acesso
            </Text>

            <Text
              style={{
                fontSize: 14,
                color: "#6B7280",
                textAlign: "center",
                marginTop: 8,
                lineHeight: 20,
              }}
            >
              Use o email cadastrado pela cooperativa para ativar seu acesso e definir sua senha.
            </Text>
          </View>

          <View style={{ marginBottom: 18 }}>
            <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 6 }}>
              Email cadastrado pela cooperativa *
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="empresa@email.com"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              keyboardType="email-address"
              style={{
                borderWidth: 1,
                borderColor: "#D1D5DB",
                borderRadius: 10,
                padding: 12,
                color: "#111827",
                fontSize: 16,
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
              <Text style={{ fontSize: 14, color: "#028C56" }}>
                Nova senha *
              </Text>

              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
                  size={18}
                  color="#028C56"
                />
              </TouchableOpacity>
            </View>

            <TextInput
              value={senha}
              onChangeText={setSenha}
              placeholder="••••••••"
              placeholderTextColor="#9CA3AF"
              secureTextEntry={!showPassword}
              style={{
                borderWidth: 1,
                borderColor: "#D1D5DB",
                borderRadius: 10,
                padding: 12,
                color: "#111827",
                fontSize: 16,
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
              <Text style={{ fontSize: 14, color: "#028C56" }}>
                Confirmar senha *
              </Text>

              <TouchableOpacity
                onPress={() => setShowConfirmarSenha(!showConfirmarSenha)}
              >
                <Ionicons
                  name={showConfirmarSenha ? "eye-outline" : "eye-off-outline"}
                  size={18}
                  color="#028C56"
                />
              </TouchableOpacity>
            </View>

            <TextInput
              value={confirmarSenha}
              onChangeText={setConfirmarSenha}
              placeholder="••••••••"
              placeholderTextColor="#9CA3AF"
              secureTextEntry={!showConfirmarSenha}
              style={{
                borderWidth: 1,
                borderColor: "#D1D5DB",
                borderRadius: 10,
                padding: 12,
                color: "#111827",
                fontSize: 16,
              }}
            />
          </View>

          <TouchableOpacity
            onPress={handleActivate}
            disabled={loading}
            activeOpacity={0.9}
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