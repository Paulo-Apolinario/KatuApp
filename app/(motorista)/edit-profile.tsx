import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/src/contexts/AuthContext";
import { driverService } from "@/src/services/driverService";
import { useNotification } from "@/src/contexts/NotificationContext";

export default function MotoristaEditProfileScreen() {
  const { user, refreshUser } = useAuth();
  const { notifyError, notifySuccess, notifyWarning } = useNotification();

  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [cnh, setCnh] = useState(user?.driver?.cnh || "");
  const [cnhCategory, setCnhCategory] = useState(
    user?.driver?.cnhCategory || ""
  );
  const [notes, setNotes] = useState(user?.driver?.notes || "");
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!displayName.trim()) {
      notifyWarning("Informe o nome do motorista.");
      return;
    }

    try {
      setLoading(true);

      await driverService.updateMyProfile({
        displayName,
        phone,
        cnh,
        cnhCategory,
        notes,
      });

      await refreshUser();

      notifySuccess("Perfil atualizado com sucesso.");
      router.back();
    } catch (err: any) {
      notifyError(err?.message || "Não foi possível atualizar o perfil.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
      <View
        style={{
          paddingTop: 58,
          paddingHorizontal: 18,
          paddingBottom: 16,
          backgroundColor: "#FFFFFF",
          borderBottomWidth: 1,
          borderBottomColor: "#E5E7EB",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: "#ECFDF5",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
            }}
          >
            <Ionicons name="arrow-back" size={22} color="#028C56" />
          </TouchableOpacity>

          <View>
            <Text style={{ color: "#111827", fontSize: 22, fontWeight: "800" }}>
              Editar perfil
            </Text>
            <Text style={{ color: "#6B7280", fontSize: 13, marginTop: 2 }}>
              Atualização de dados do motorista
            </Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 30 }}>
        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 18,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <Text style={{ color: "#028C56", fontWeight: "700", marginBottom: 6 }}>
            Nome
          </Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            style={{
              borderWidth: 1,
              borderColor: "#D1D5DB",
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 12,
              color: "#111827",
              marginBottom: 14,
            }}
          />

          <Text style={{ color: "#028C56", fontWeight: "700", marginBottom: 6 }}>
            Telefone
          </Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            style={{
              borderWidth: 1,
              borderColor: "#D1D5DB",
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 12,
              color: "#111827",
              marginBottom: 14,
            }}
          />

          <Text style={{ color: "#028C56", fontWeight: "700", marginBottom: 6 }}>
            CNH
          </Text>
          <TextInput
            value={cnh}
            onChangeText={setCnh}
            style={{
              borderWidth: 1,
              borderColor: "#D1D5DB",
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 12,
              color: "#111827",
              marginBottom: 14,
            }}
          />

          <Text style={{ color: "#028C56", fontWeight: "700", marginBottom: 6 }}>
            Categoria CNH
          </Text>
          <TextInput
            value={cnhCategory}
            onChangeText={setCnhCategory}
            autoCapitalize="characters"
            style={{
              borderWidth: 1,
              borderColor: "#D1D5DB",
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 12,
              color: "#111827",
              marginBottom: 14,
            }}
          />

          <Text style={{ color: "#028C56", fontWeight: "700", marginBottom: 6 }}>
            Observações
          </Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            style={{
              borderWidth: 1,
              borderColor: "#D1D5DB",
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 12,
              color: "#111827",
              minHeight: 100,
              textAlignVertical: "top",
            }}
          />
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleSave}
          disabled={loading}
        >
          <LinearGradient
            colors={["#10F35D", "#028C56"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              height: 56,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              opacity: loading ? 0.7 : 1,
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
                SALVAR ALTERAÇÕES
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}