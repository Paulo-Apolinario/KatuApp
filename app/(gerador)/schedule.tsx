import { router } from "expo-router";
import { useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  addDoc,
  collection,
  serverTimestamp,
  doc,
  getDoc,
} from "firebase/firestore";

import { db } from "@/src/services/firebaseConfig";
import { useAuth } from "@/src/contexts/AuthContext";

type MaterialType =
  | "ALUMÍNIO"
  | "PLÁSTICO"
  | "PAPEL"
  | "VIDRO"
  | "METAL"
  | "OUTRO";

function parseDateTime(date: string, time: string): Date | null {
  try {
    const [day, month, year] = date.split("/");
    const [hour, minute] = time.split(":");

    if (!day || !month || !year || !hour || !minute) return null;

    const parsed = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute)
    );

    if (isNaN(parsed.getTime())) return null;

    return parsed;
  } catch {
    return null;
  }
}

export default function ScheduleScreen() {
  const { user } = useAuth();

  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedMaterials, setSelectedMaterials] = useState<MaterialType[]>([]);
  const [loading, setLoading] = useState(false);

  const materials: MaterialType[] = [
    "ALUMÍNIO",
    "PLÁSTICO",
    "PAPEL",
    "VIDRO",
    "METAL",
    "OUTRO",
  ];

  const toggleMaterial = (material: MaterialType) => {
    if (selectedMaterials.includes(material)) {
      setSelectedMaterials((prev) => prev.filter((m) => m !== material));
    } else {
      setSelectedMaterials((prev) => [...prev, material]);
    }
  };

  const resetForm = () => {
    setSelectedDate("");
    setSelectedTime("");
    setSelectedMaterials([]);
  };

  const handleSchedule = async () => {
    if (!user?.uid) {
      Alert.alert("Erro", "Usuário não autenticado.");
      return;
    }

    if (!selectedDate || !selectedTime || selectedMaterials.length === 0) {
      Alert.alert(
        "Atenção",
        "Preencha todos os campos e selecione pelo menos um material."
      );
      return;
    }

    const dataAgendada = parseDateTime(selectedDate, selectedTime);

    if (!dataAgendada) {
      Alert.alert(
        "Data inválida",
        "Informe uma data e horário válidos. Ex: 12/03/2026 e 13:00"
      );
      return;
    }

    try {
      setLoading(true);

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        throw new Error("Usuário não encontrado no Firestore.");
      }

      const userData: any = userSnap.data();
      const geradorId = userData.geradorId || "";
      const cooperativaId = userData.cooperativaId || "";

      if (!geradorId) {
        throw new Error("Usuário sem geradorId vinculado.");
      }

      const geradorRef = doc(db, "geradores", geradorId);
      const geradorSnap = await getDoc(geradorRef);

      if (!geradorSnap.exists()) {
        throw new Error("Gerador não encontrado.");
      }

      const geradorData: any = geradorSnap.data();

      await addDoc(collection(db, "agendamentos"), {
        userId: user.uid,
        cooperativaId: cooperativaId || geradorData.cooperativaId || "",
        geradorId,
        geradorNome:
          geradorData.nome || geradorData.companyName || user.displayName || "",
        geradorEmail: geradorData.email || user.email || "",
        geradorEndereco:
          geradorData.endereco || geradorData.address || user.address || "",
        geradorTelefone: geradorData.telefone || user.phone || "",
        tipoGerador: geradorData.tipo || user.userType || "pf",
        materiais: selectedMaterials,
        dataColeta: selectedDate.trim(),
        horarioColeta: selectedTime.trim(),
        dataAgendada,
        status: "agendado",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      Alert.alert("Sucesso!", "Coleta agendada com sucesso!", [
        {
          text: "OK",
          onPress: () => {
            resetForm();
            router.replace("../(gerador)/history");
          },
        },
      ]);
    } catch (error: any) {
      console.error("Erro ao agendar coleta:", error);
      Alert.alert(
        "Erro",
        error?.message || "Não foi possível registrar o agendamento."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <LinearGradient
        colors={["#10F35D", "#028C56"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          paddingTop: 50,
          paddingBottom: 20,
          paddingHorizontal: 20,
          borderBottomLeftRadius: 30,
          borderBottomRightRadius: 30,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: "700", color: "#FFFFFF" }}>
            AGENDE SUA COLETA
          </Text>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1, padding: 20 }}
      >
        <View
          style={{
            backgroundColor: "#F9FAFB",
            borderRadius: 16,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "600",
              color: "#111827",
              marginBottom: 15,
            }}
          >
            📅 Data da Coleta
          </Text>

          <TextInput
            value={selectedDate}
            onChangeText={setSelectedDate}
            placeholder="Ex: 12/03/2026"
            placeholderTextColor="#9CA3AF"
            style={{
              borderWidth: 1,
              borderColor: "#D1D5DB",
              borderRadius: 12,
              padding: 15,
              fontSize: 16,
              color: "#111827",
              backgroundColor: "#FFFFFF",
            }}
          />
        </View>

        <View
          style={{
            backgroundColor: "#F9FAFB",
            borderRadius: 16,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "600",
              color: "#111827",
              marginBottom: 15,
            }}
          >
            ⏰ Horário da Coleta
          </Text>

          <TextInput
            value={selectedTime}
            onChangeText={setSelectedTime}
            placeholder="Ex: 13:00"
            placeholderTextColor="#9CA3AF"
            style={{
              borderWidth: 1,
              borderColor: "#D1D5DB",
              borderRadius: 12,
              padding: 15,
              fontSize: 16,
              color: "#111827",
              backgroundColor: "#FFFFFF",
            }}
          />
        </View>

        <View
          style={{
            backgroundColor: "#F9FAFB",
            borderRadius: 16,
            padding: 20,
            marginBottom: 30,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "600",
              color: "#111827",
              marginBottom: 15,
            }}
          >
            ♻️ Tipos de Resíduos
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {materials.map((material) => {
              const selected = selectedMaterials.includes(material);

              return (
                <TouchableOpacity
                  key={material}
                  onPress={() => toggleMaterial(material)}
                  style={{
                    backgroundColor: selected ? "#028C56" : "#FFFFFF",
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    borderRadius: 25,
                    marginRight: 10,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: selected ? "#028C56" : "#D1D5DB",
                  }}
                >
                  <Text
                    style={{
                      color: selected ? "#FFFFFF" : "#4B5563",
                      fontWeight: "600",
                      fontSize: 14,
                    }}
                  >
                    {material}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleSchedule}
          disabled={loading}
          style={{ marginBottom: 30 }}
        >
          <LinearGradient
            colors={["#10F35D", "#028C56"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              height: 56,
              borderRadius: 12,
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
                    fontSize: 18,
                    fontWeight: "800",
                    marginLeft: 8,
                  }}
                >
                  SALVANDO...
                </Text>
              </>
            ) : (
              <>
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontSize: 18,
                    fontWeight: "800",
                    marginRight: 8,
                  }}
                >
                  AGENDAR
                </Text>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}