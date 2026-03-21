import { router } from "expo-router";
import { useMemo, useState } from "react";
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

import { scheduleService } from "@/src/services/scheduleService";
import { useAuth } from "@/src/contexts/AuthContext";

type MaterialType =
  | "ALUMÍNIO"
  | "PLÁSTICO"
  | "PAPEL"
  | "VIDRO"
  | "METAL"
  | "OUTRO";

function parseDateTimeToIso(date: string, time: string): string | null {
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

    if (Number.isNaN(parsed.getTime())) return null;

    return parsed.toISOString();
  } catch {
    return null;
  }
}

function buildNotes(materials: string[], extraNotes: string) {
  const materialsText =
    materials.length > 0
      ? `Materiais solicitados: ${materials.join(", ")}`
      : "";

  const trimmedExtraNotes = extraNotes.trim();

  if (materialsText && trimmedExtraNotes) {
    return `${materialsText}\nObservações: ${trimmedExtraNotes}`;
  }

  if (materialsText) return materialsText;
  if (trimmedExtraNotes) return trimmedExtraNotes;

  return undefined;
}

export default function ScheduleScreen() {
  const { user } = useAuth();

  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedMaterials, setSelectedMaterials] = useState<MaterialType[]>([]);
  const [extraNotes, setExtraNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const materials: MaterialType[] = useMemo(
    () => ["ALUMÍNIO", "PLÁSTICO", "PAPEL", "VIDRO", "METAL", "OUTRO"],
    []
  );

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
    setExtraNotes("");
  };

  const handleSchedule = async () => {
    if (!user?.id && !user?.id) {
      Alert.alert("Erro", "Usuário não autenticado.");
      return;
    }

    if (!selectedDate || !selectedTime || selectedMaterials.length === 0) {
      Alert.alert(
        "Atenção",
        "Preencha data, horário e selecione pelo menos um material."
      );
      return;
    }

    const scheduledDate = parseDateTimeToIso(selectedDate, selectedTime);

    if (!scheduledDate) {
      Alert.alert(
        "Data inválida",
        "Informe uma data e horário válidos. Ex.: 12/03/2026 e 13:00"
      );
      return;
    }

    const notes = buildNotes(selectedMaterials, extraNotes);

    try {
      setLoading(true);

      await scheduleService.create({
        scheduledDate,
        notes,
      });

      Alert.alert(
        "Sucesso!",
        "Solicitação de coleta registrada com sucesso. A cooperativa poderá organizar esse agendamento.",
        [
          {
            text: "OK",
            onPress: () => {
              resetForm();
              router.replace("/(gerador)/dashboard");
            },
          },
        ]
      );
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
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginRight: 15 }}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={{ fontSize: 20, fontWeight: "700", color: "#FFFFFF" }}>
            SOLICITAR COLETA
          </Text>
        </View>

        <Text
          style={{
            fontSize: 14,
            color: "#FFFFFF",
            opacity: 0.9,
            marginTop: 10,
          }}
        >
          Informe data, horário e materiais para que a cooperativa organize a coleta.
        </Text>
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
            📅 Data da coleta
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
            ⏰ Horário da coleta
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
            ♻️ Tipos de resíduos
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
            📝 Observações adicionais
          </Text>

          <TextInput
            value={extraNotes}
            onChangeText={setExtraNotes}
            placeholder="Ex: materiais estarão separados, acesso lateral, retirar até 17h"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            style={{
              borderWidth: 1,
              borderColor: "#D1D5DB",
              borderRadius: 12,
              padding: 15,
              fontSize: 16,
              color: "#111827",
              backgroundColor: "#FFFFFF",
              minHeight: 110,
            }}
          />
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
                  SOLICITAR COLETA
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