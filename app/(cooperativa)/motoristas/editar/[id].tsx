import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
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
import { deleteDoc, doc, getDoc, updateDoc } from "firebase/firestore";

import { db } from "@/src/services/firebaseConfig";
import { useAuth } from "@/src/contexts/AuthContext";

type DriverStatus = "disponivel" | "em_rota" | "indisponivel";

export default function EditarMotoristaScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const routeId = Array.isArray(params.id) ? params.id[0] : params.id;

  const { user } = useAuth();

  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<DriverStatus>("disponivel");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function formatCpf(value: string) {
    return value
      .replace(/\D/g, "")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
      .slice(0, 14);
  }

  function formatPhone(value: string) {
    return value
      .replace(/\D/g, "")
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2")
      .slice(0, 15);
  }

  const loadMotorista = useCallback(async () => {
    if (!routeId || !user?.uid) {
      setLoading(false);
      return;
    }

    try {
      const docRef = doc(db, "motoristas", routeId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        Alert.alert("Erro", "Motorista não encontrado.");
        router.replace("/(cooperativa)/motoristas");
        return;
      }

      const data: any = docSnap.data();

      if (data.cooperativaId !== user.uid) {
        Alert.alert("Erro", "Você não tem permissão para este motorista.");
        router.replace("/(cooperativa)/motoristas");
        return;
      }

      setNome(data.nome || "");
      setCpf(formatCpf(data.cpf || ""));
      setTelefone(formatPhone(data.telefone || ""));
      setEmail(data.email || "");
      setStatus((data.status as DriverStatus) || "disponivel");
    } catch (error) {
      console.error("Erro ao carregar motorista:", error);
      Alert.alert("Erro", "Não foi possível carregar o motorista.");
    } finally {
      setLoading(false);
    }
  }, [routeId, user?.uid]);

  useEffect(() => {
    loadMotorista();
  }, [loadMotorista]);

  async function handleSalvar() {
    if (!routeId || !user?.uid) return;

    if (!nome.trim() || !cpf.trim() || !telefone.trim() || !email.trim()) {
      Alert.alert("Atenção", "Preencha todos os campos.");
      return;
    }

    try {
      setSaving(true);

      await updateDoc(doc(db, "motoristas", routeId), {
        nome: nome.trim(),
        cpf: cpf.replace(/\D/g, ""),
        telefone: telefone.trim(),
        email: email.trim().toLowerCase(),
        status,
      });

      Alert.alert("Sucesso", "Motorista atualizado com sucesso!", [
        {
          text: "OK",
          onPress: () => router.replace("/(cooperativa)/motoristas"),
        },
      ]);
    } catch (error) {
      console.error("Erro ao atualizar motorista:", error);
      Alert.alert("Erro", "Não foi possível atualizar o motorista.");
    } finally {
      setSaving(false);
    }
  }

  function handleExcluir() {
    if (!routeId) return;

    Alert.alert("Excluir motorista", "Deseja realmente excluir este motorista?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            setDeleting(true);
            await deleteDoc(doc(db, "motoristas", routeId));
            Alert.alert("Sucesso", "Motorista excluído com sucesso!", [
              {
                text: "OK",
                onPress: () => router.replace("/(cooperativa)/motoristas"),
              },
            ]);
          } catch (error) {
            console.error("Erro ao excluir motorista:", error);
            Alert.alert("Erro", "Não foi possível excluir o motorista.");
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#FFFFFF", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#028C56" />
        <Text style={{ marginTop: 10, color: "#6B7280" }}>Carregando motorista...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#FFFFFF" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <LinearGradient
        colors={["#10F35D", "#028C56"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => router.replace("/(cooperativa)/motoristas")}
            style={{ marginRight: 15 }}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={{ fontSize: 20, fontWeight: "700", color: "#FFFFFF" }}>
            EDITAR MOTORISTA
          </Text>
        </View>
      </LinearGradient>

      <ScrollView style={{ flex: 1, padding: 20 }} showsVerticalScrollIndicator={false}>
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 5 }}>Nome *</Text>
          <TextInput
            value={nome}
            onChangeText={setNome}
            placeholder="Nome completo"
            placeholderTextColor="#9CA3AF"
            style={{
              borderWidth: 1,
              borderColor: "#D1D5DB",
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
              color: "#111827",
            }}
          />
        </View>

        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 5 }}>CPF *</Text>
          <TextInput
            value={cpf}
            onChangeText={(text) => setCpf(formatCpf(text))}
            keyboardType="numeric"
            maxLength={14}
            placeholder="000.000.000-00"
            placeholderTextColor="#9CA3AF"
            style={{
              borderWidth: 1,
              borderColor: "#D1D5DB",
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
              color: "#111827",
            }}
          />
        </View>

        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 5 }}>Telefone *</Text>
          <TextInput
            value={telefone}
            onChangeText={(text) => setTelefone(formatPhone(text))}
            keyboardType="phone-pad"
            placeholder="(88) 90000-0000"
            placeholderTextColor="#9CA3AF"
            style={{
              borderWidth: 1,
              borderColor: "#D1D5DB",
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
              color: "#111827",
            }}
          />
        </View>

        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 5 }}>Email *</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="email@exemplo.com"
            placeholderTextColor="#9CA3AF"
            style={{
              borderWidth: 1,
              borderColor: "#D1D5DB",
              borderRadius: 8,
              padding: 12,
              fontSize: 16,
              color: "#111827",
            }}
          />
        </View>

        <View style={{ marginBottom: 30 }}>
          <Text style={{ fontSize: 14, color: "#028C56", marginBottom: 10 }}>Status</Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {[
              { label: "Disponível", value: "disponivel" },
              { label: "Em rota", value: "em_rota" },
              { label: "Indisponível", value: "indisponivel" },
            ].map((item) => {
              const selected = status === item.value;

              return (
                <TouchableOpacity
                  key={item.value}
                  onPress={() => setStatus(item.value as DriverStatus)}
                  style={{
                    backgroundColor: selected ? "#028C56" : "#F3F4F6",
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 20,
                    marginRight: 10,
                    marginBottom: 10,
                  }}
                >
                  <Text
                    style={{
                      color: selected ? "#FFFFFF" : "#4B5563",
                      fontWeight: "600",
                    }}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity onPress={handleSalvar} disabled={saving || deleting} activeOpacity={0.9}>
          <LinearGradient
            colors={["#10F35D", "#028C56"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              height: 52,
              borderRadius: 8,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              opacity: saving ? 0.7 : 1,
              marginBottom: 15,
            }}
          >
            {saving ? (
              <>
                <ActivityIndicator color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "800", marginLeft: 10 }}>
                  SALVANDO...
                </Text>
              </>
            ) : (
              <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "800" }}>
                SALVAR ALTERAÇÕES
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleExcluir}
          disabled={saving || deleting}
          style={{
            height: 52,
            borderRadius: 8,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#FEF2F2",
            borderWidth: 1,
            borderColor: "#DC2626",
            marginBottom: 30,
          }}
        >
          {deleting ? (
            <ActivityIndicator color="#DC2626" />
          ) : (
            <Text style={{ color: "#DC2626", fontSize: 16, fontWeight: "800" }}>
              EXCLUIR MOTORISTA
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}