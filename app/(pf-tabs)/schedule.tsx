import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { scheduleService } from "@/src/services/scheduleService";

type MaterialType =
  | "ALUMÍNIO"
  | "PLÁSTICO"
  | "PAPEL"
  | "VIDRO"
  | "METAL"
  | "OUTRO";

type CooperativeLike = {
  id: string;
  name?: string | null;
  registrationNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

type CooperativeListResponse =
  | CooperativeLike[]
  | {
      cooperatives?: CooperativeLike[];
    };

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

function getCooperativeName(item: CooperativeLike) {
  return item.name || "Cooperativa";
}

export default function PFScheduleScreen() {
  const params = useLocalSearchParams<{ cooperativeId?: string | string[] }>();
  const routeCooperativeId = Array.isArray(params.cooperativeId)
    ? params.cooperativeId[0]
    : params.cooperativeId;

  const [loadingCooperatives, setLoadingCooperatives] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [cooperatives, setCooperatives] = useState<CooperativeLike[]>([]);
  const [selectedCooperativeId, setSelectedCooperativeId] = useState(
    routeCooperativeId || ""
  );

  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedMaterials, setSelectedMaterials] = useState<MaterialType[]>([]);
  const [notes, setNotes] = useState("");

  const materials: MaterialType[] = [
    "ALUMÍNIO",
    "PLÁSTICO",
    "PAPEL",
    "VIDRO",
    "METAL",
    "OUTRO",
  ];

  const loadCooperatives = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoadingCooperatives(true);

      // Mantido no formato original, mudando o mínimo possível:
      // usa o endpoint já existente para carregar cooperativas.
      const response = await fetchCooperatives();

      setCooperatives(response);

      if (response.length > 0) {
        setSelectedCooperativeId((current) => {
          if (current && response.some((item) => item.id === current)) {
            return current;
          }

          return response[0].id;
        });
      } else {
        setSelectedCooperativeId("");
      }
    } catch (error: any) {
      console.error("Erro ao carregar cooperativas:", error);
      Alert.alert(
        "Erro",
        error?.message || "Não foi possível carregar as cooperativas."
      );
      setCooperatives([]);
      setSelectedCooperativeId("");
    } finally {
      if (showLoader) setLoadingCooperatives(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCooperatives(true);
    }, [loadCooperatives])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCooperatives(false);
  }, [loadCooperatives]);

  const selectedCooperative = useMemo(() => {
    return cooperatives.find((item) => item.id === selectedCooperativeId) || null;
  }, [cooperatives, selectedCooperativeId]);

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
    setNotes("");
  };

  const handleSchedule = async () => {
    if (!selectedCooperativeId) {
      Alert.alert("Atenção", "Selecione uma cooperativa.");
      return;
    }

    if (!selectedDate || !selectedTime || selectedMaterials.length === 0) {
      Alert.alert(
        "Atenção",
        "Preencha data, horário e selecione ao menos um material."
      );
      return;
    }

    const preferredDate = parseDateTimeToIso(selectedDate, selectedTime);

    if (!preferredDate) {
      Alert.alert(
        "Data inválida",
        "Informe uma data e horário válidos. Ex.: 25/03/2026 e 14:30"
      );
      return;
    }

    try {
      setSaving(true);

      await scheduleService.create({
        cooperativeId: selectedCooperativeId,
        preferredDate,
        requestedMaterials: selectedMaterials,
        notes: notes.trim() || undefined,
      });

      Alert.alert(
        "Sucesso!",
        "Sua solicitação de coleta foi enviada com sucesso.",
        [
          {
            text: "OK",
            onPress: () => {
              resetForm();
              router.replace("/(pf-tabs)/history");
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
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#F3F4F6" }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 28 }}
    >
      <LinearGradient
        colors={["#16a34a", "#22c55e"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          paddingTop: 28,
          paddingBottom: 26,
          paddingHorizontal: 20,
          borderBottomLeftRadius: 30,
          borderBottomRightRadius: 30,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginRight: 15 }}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={{ fontSize: 22, fontWeight: "700", color: "#FFFFFF" }}>
            AGENDAR COLETA
          </Text>
        </View>

        <Text
          style={{
            fontSize: 14,
            color: "#E8FFF1",
            marginTop: 10,
            lineHeight: 22,
          }}
        >
          Escolha uma cooperativa, informe os materiais e envie sua solicitação.
        </Text>
      </LinearGradient>

      <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
        <SectionCard>
          <Text style={sectionTitle}>🏢 Cooperativa</Text>

          {loadingCooperatives ? (
            <View style={{ alignItems: "center", paddingVertical: 20 }}>
              <ActivityIndicator color="#028C56" />
              <Text style={{ marginTop: 10, color: "#6B7280" }}>
                Carregando cooperativas...
              </Text>
            </View>
          ) : cooperatives.length > 0 ? (
            cooperatives.map((item) => {
              const selected = item.id === selectedCooperativeId;

              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.85}
                  onPress={() => setSelectedCooperativeId(item.id)}
                  style={{
                    backgroundColor: selected ? "#F0FDF4" : "#FFFFFF",
                    borderRadius: 14,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: selected ? "#028C56" : "#D1D5DB",
                    marginBottom: 10,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "700",
                      color: "#111827",
                    }}
                  >
                    {getCooperativeName(item)}
                  </Text>

                  <Text style={{ fontSize: 13, color: "#4B5563", marginTop: 4 }}>
                    Endereço: {item.address || "-"}
                  </Text>

                  <Text style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>
                    Telefone: {item.phone || "-"}
                  </Text>
                </TouchableOpacity>
              );
            })
          ) : (
            <EmptyState
              icon="business-outline"
              title="Nenhuma cooperativa encontrada"
              subtitle="Não há cooperativas ativas disponíveis no momento."
            />
          )}
        </SectionCard>

        {selectedCooperative && (
          <SectionCard>
            <Text style={sectionTitle}>📍 Cooperativa selecionada</Text>

            <InfoRow label="Nome" value={getCooperativeName(selectedCooperative)} />
            <InfoRow label="Endereço" value={selectedCooperative.address || "-"} />
            <InfoRow
              label="Telefone"
              value={selectedCooperative.phone || "-"}
              isLast
            />
          </SectionCard>
        )}

        <SectionCard>
          <Text style={sectionTitle}>📅 Data da coleta</Text>

          <TextInput
            value={selectedDate}
            onChangeText={setSelectedDate}
            placeholder="Ex: 25/03/2026"
            placeholderTextColor="#9CA3AF"
            style={inputStyle}
          />
        </SectionCard>

        <SectionCard>
          <Text style={sectionTitle}>⏰ Horário da coleta</Text>

          <TextInput
            value={selectedTime}
            onChangeText={setSelectedTime}
            placeholder="Ex: 14:30"
            placeholderTextColor="#9CA3AF"
            style={inputStyle}
          />
        </SectionCard>

        <SectionCard>
          <Text style={sectionTitle}>♻️ Tipos de resíduos</Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {materials.map((material) => {
              const selected = selectedMaterials.includes(material);

              return (
                <TouchableOpacity
                  key={material}
                  onPress={() => toggleMaterial(material)}
                  style={{
                    backgroundColor: selected ? "#028C56" : "#FFFFFF",
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 22,
                    marginRight: 8,
                    marginBottom: 8,
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
        </SectionCard>

        <SectionCard>
          <Text style={sectionTitle}>📝 Observações</Text>

          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Ex: materiais já separados, retirar após 14h"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            style={[inputStyle, { minHeight: 100 }]}
          />
        </SectionCard>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleSchedule}
          disabled={saving || !selectedCooperativeId}
          style={{ marginHorizontal: 16, marginTop: 6, marginBottom: 24 }}
        >
          <LinearGradient
            colors={
              saving || !selectedCooperativeId
                ? ["#9CA3AF", "#6B7280"]
                : ["#10F35D", "#028C56"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              height: 56,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
            }}
          >
            {saving ? (
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
                  ENVIAR SOLICITAÇÃO
                </Text>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

async function fetchCooperatives(): Promise<CooperativeLike[]> {
  const { api } = await import("@/src/services/api");

  const response = await api.get<CooperativeListResponse>("/cooperatives", true);

  return Array.isArray(response) ? response : response?.cooperatives ?? [];
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        marginHorizontal: 16,
        marginBottom: 14,
      }}
    >
      {children}
    </View>
  );
}

function InfoRow({
  label,
  value,
  isLast = false,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View
      style={{
        paddingBottom: isLast ? 0 : 12,
        marginBottom: isLast ? 0 : 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: "#E5E7EB",
      }}
    >
      <Text style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 15, color: "#111827", fontWeight: "600" }}>
        {value || "-"}
      </Text>
    </View>
  );
}

function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 20 }}>
      <Ionicons name={icon} size={40} color="#9CA3AF" />
      <Text
        style={{
          fontSize: 16,
          fontWeight: "700",
          color: "#374151",
          marginTop: 10,
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: "#6B7280",
          textAlign: "center",
          marginTop: 6,
          lineHeight: 20,
        }}
      >
        {subtitle}
      </Text>
    </View>
  );
}

const sectionTitle = {
  fontSize: 16,
  fontWeight: "700" as const,
  color: "#111827",
  marginBottom: 12,
};

const inputStyle = {
  borderWidth: 1,
  borderColor: "#D1D5DB",
  borderRadius: 12,
  padding: 14,
  fontSize: 16,
  color: "#111827",
  backgroundColor: "#FFFFFF",
} as const;