import { useEffect, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";

import { auth, db } from "@/src/services/firebaseConfig";

export default function EditProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    loadUserData();
  }, []);

  async function loadUserData() {
    try {
      const user = auth.currentUser;

      if (!user) {
        Alert.alert("Sessão expirada", "Faça login novamente.");
        router.replace("/(auth)/login");
        return;
      }

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data();

        setDisplayName(data.displayName || "");
        setCpf(data.cpf || "");
        setPhone(data.phone || "");
        setAddress(data.address || "");
      }
    } catch (error) {
      console.error("Erro ao carregar dados do usuário:", error);
      Alert.alert("Erro", "Não foi possível carregar suas informações.");
    } finally {
      setLoading(false);
    }
  }

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

  async function handleSave() {
    const user = auth.currentUser;

    if (!user) {
      Alert.alert("Sessão expirada", "Faça login novamente.");
      router.replace("/(auth)/login");
      return;
    }

    if (!displayName.trim()) {
      Alert.alert("Campo obrigatório", "Informe seu nome.");
      return;
    }

    try {
      setSaving(true);

      const userRef = doc(db, "users", user.uid);

      await updateDoc(userRef, {
        displayName: displayName.trim(),
        cpf: cpf.trim(),
        phone: phone.trim(),
        address: address.trim(),
      });

      await updateProfile(user, {
        displayName: displayName.trim(),
      });

      Alert.alert("Sucesso", "Suas informações foram atualizadas com sucesso.");
      router.back();
    } catch (error) {
      console.error("Erro ao salvar dados:", error);
      Alert.alert("Erro", "Não foi possível salvar suas informações.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#028C56" />
        <Text className="mt-4 text-slate-600">Carregando informações...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <LinearGradient
        colors={["#10F35D", "#028C56"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          paddingTop: 60,
          paddingBottom: 24,
          paddingHorizontal: 20,
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
        }}
      >
        <View className="flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-11 h-11 bg-white/20 rounded-full items-center justify-center"
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>

          <Text className="text-white text-xl font-bold">
            Editar informações
          </Text>

          <View className="w-11 h-11" />
        </View>

        <Text className="text-white/90 mt-3 text-sm">
          Atualize seus dados pessoais e mantenha seu perfil completo.
        </Text>
      </LinearGradient>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: 22,
            padding: 18,
            shadowColor: "#000",
            shadowOpacity: 0.06,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 3,
            marginTop: 6,
          }}
        >
          <View className="mb-4">
            <Text className="text-slate-700 font-semibold mb-2">
              Nome completo
            </Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Digite seu nome"
              placeholderTextColor="#94A3B8"
              className="border border-slate-200 rounded-2xl px-4 py-4 text-slate-800 bg-slate-50"
            />
          </View>

          <View className="mb-4">
            <Text className="text-slate-700 font-semibold mb-2">CPF</Text>
            <TextInput
              value={cpf}
              onChangeText={(text) => setCpf(formatCpf(text))}
              placeholder="000.000.000-00"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              className="border border-slate-200 rounded-2xl px-4 py-4 text-slate-800 bg-slate-50"
            />
          </View>

          <View className="mb-4">
            <Text className="text-slate-700 font-semibold mb-2">Telefone</Text>
            <TextInput
              value={phone}
              onChangeText={(text) => setPhone(formatPhone(text))}
              placeholder="(00) 00000-0000"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              className="border border-slate-200 rounded-2xl px-4 py-4 text-slate-800 bg-slate-50"
            />
          </View>

          <View className="mb-2">
            <Text className="text-slate-700 font-semibold mb-2">Endereço</Text>
            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder="Rua, número, bairro, cidade..."
              placeholderTextColor="#94A3B8"
              multiline
              textAlignVertical="top"
              style={{ minHeight: 110 }}
              className="border border-slate-200 rounded-2xl px-4 py-4 text-slate-800 bg-slate-50"
            />
          </View>
        </View>

        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
          className="mt-6 rounded-full overflow-hidden"
        >
          <LinearGradient
            colors={["#10F35D", "#028C56"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              minHeight: 58,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 999,
              flexDirection: "row",
            }}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color="#fff" />
                <Text className="text-white font-bold text-base ml-2">
                  Salvar alterações
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}