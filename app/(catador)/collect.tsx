import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useAuth } from "@/src/contexts/AuthContext";
import { collectionService } from "@/src/services/collectionService";
import { scheduleService, type Schedule } from "@/src/services/scheduleService";

type MaterialType =
  | "ALUMÍNIO"
  | "PLÁSTICO"
  | "PAPEL"
  | "VIDRO"
  | "METAL"
  | "OUTRO";

type UserLike = {
  id?: string;
  uid?: string;
  role?: string;
  totalKg?: number;
  displayName?: string;
  email?: string;
  collector?: {
    totalKg?: number;
  } | null;
};

function getUserTotalKg(user: UserLike | null | undefined) {
  if (typeof user?.collector?.totalKg === "number") {
    return user.collector.totalKg;
  }

  if (typeof user?.totalKg === "number") {
    return user.totalKg;
  }

  return 0;
}

function getUserRole(user: UserLike | null | undefined) {
  return String(user?.role || "").toUpperCase();
}

function formatDateTime(date?: string | null) {
  if (!date) return "-";

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "-";

  return parsed.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function isToday(date?: string | null) {
  if (!date) return false;

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return false;

  const now = new Date();

  return (
    parsed.getDate() === now.getDate() &&
    parsed.getMonth() === now.getMonth() &&
    parsed.getFullYear() === now.getFullYear()
  );
}

function getScheduleStatusLabel(status: Schedule["status"]) {
  switch (status) {
    case "SCHEDULED":
      return "AGENDADO";
    case "IN_PROGRESS":
      return "EM ANDAMENTO";
    case "REQUESTED":
      return "SOLICITADO";
    case "COMPLETED":
      return "CONCLUÍDO";
    case "CANCELLED":
      return "CANCELADO";
    default:
      return status;
  }
}

function getScheduleStatusColor(status: Schedule["status"]) {
  switch (status) {
    case "SCHEDULED":
      return "#2563EB";
    case "IN_PROGRESS":
      return "#F59E0B";
    case "COMPLETED":
      return "#10B981";
    case "CANCELLED":
      return "#DC2626";
    case "REQUESTED":
    default:
      return "#6B7280";
  }
}

function extractMaterials(notes?: string | null) {
  if (!notes) return null;

  const match = notes.match(/materiais solicitados:\s*(.*)/i);
  return match ? match[1] : null;
}

export default function CollectScreen() {
  const { user, refreshUser } = useAuth();
  const currentUser = user as UserLike | null;

  const [selectedMaterials, setSelectedMaterials] = useState<MaterialType[]>([]);
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState("");

  const materials: MaterialType[] = [
    "ALUMÍNIO",
    "PLÁSTICO",
    "PAPEL",
    "VIDRO",
    "METAL",
    "OUTRO",
  ];

  const totalAtual = getUserTotalKg(currentUser);

  const availableSchedules = useMemo(() => {
    return schedules.filter(
      (item) => item.status === "SCHEDULED" || item.status === "IN_PROGRESS"
    );
  }, [schedules]);

  const selectedSchedule = useMemo(() => {
    return availableSchedules.find((item) => item.id === selectedScheduleId) || null;
  }, [availableSchedules, selectedScheduleId]);

  const totalPendentes = useMemo(() => {
    return availableSchedules.filter((item) => item.status === "SCHEDULED").length;
  }, [availableSchedules]);

  const totalEmAndamento = useMemo(() => {
    return availableSchedules.filter((item) => item.status === "IN_PROGRESS").length;
  }, [availableSchedules]);

  const totalHoje = useMemo(() => {
    return availableSchedules.filter((item) =>
      isToday(item.scheduledDate || item.preferredDate)
    ).length;
  }, [availableSchedules]);

  const loadSchedules = async () => {
    try {
      setLoadingSchedules(true);

      const response = await scheduleService.list();
      const safeData = Array.isArray(response) ? response : [];

      const operational = safeData.filter(
        (item) => item.status === "SCHEDULED" || item.status === "IN_PROGRESS"
      );

      setSchedules(operational);

      if (operational.length > 0) {
        setSelectedScheduleId((current) =>
          current && operational.some((item) => item.id === current)
            ? current
            : operational[0].id
        );
      } else {
        setSelectedScheduleId("");
      }
    } catch (error) {
      console.error("Erro ao carregar agendamentos:", error);
      Alert.alert("Erro", "Não foi possível carregar as coletas delegadas.");
    } finally {
      setLoadingSchedules(false);
    }
  };

  useEffect(() => {
    loadSchedules();
  }, []);

  const toggleMaterial = (material: MaterialType) => {
    if (selectedMaterials.includes(material)) {
      setSelectedMaterials((prev) => prev.filter((m) => m !== material));
    } else {
      setSelectedMaterials((prev) => [...prev, material]);
    }
  };

  const handleRegisterCollect = async () => {
    if (getUserRole(currentUser) !== "COLLECTOR") {
      Alert.alert("Erro", "Esta tela é exclusiva para catadores.");
      return;
    }

    if (!selectedScheduleId) {
      Alert.alert("Atenção", "Selecione uma coleta delegada.");
      return;
    }

    if (!weight || selectedMaterials.length === 0) {
      Alert.alert(
        "Atenção",
        "Informe o peso e selecione pelo menos um material."
      );
      return;
    }

    const kg = Number(String(weight).replace(",", "."));

    if (Number.isNaN(kg) || kg <= 0) {
      Alert.alert("Atenção", "Informe um peso válido.");
      return;
    }

    try {
      setSaving(true);

      await collectionService.create({
        scheduleId: selectedScheduleId,
        totalWeightKg: kg,
        materials: selectedMaterials,
        notes: notes.trim() || undefined,
      });

      await refreshUser?.();
      await loadSchedules();

      Alert.alert("Sucesso!", `Coleta de ${kg} kg registrada com sucesso!`, [
        {
          text: "OK",
          onPress: () => {
            setWeight("");
            setSelectedMaterials([]);
            setNotes("");
            router.replace("/(catador)/data");
          },
        },
      ]);
    } catch (error: any) {
      console.error("Erro ao registrar coleta:", error);
      Alert.alert(
        "Erro",
        error?.message || "Não foi possível registrar a coleta."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleReportProblem = () => {
    Alert.alert(
      "Relatar Problema",
      "O fluxo de problemas operacionais será integrado em uma próxima etapa."
    );
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
            justifyContent: "space-between",
          }}
        >
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Image
              source={require("../../assets/images/logo.png")}
              resizeMode="contain"
              style={{ width: 36, height: 36, marginRight: 8 }}
            />
            <Text style={{ fontSize: 22, fontWeight: "800", color: "#FFFFFF" }}>
              KATUÁ
            </Text>
          </View>

          <View style={{ width: 24 }} />
        </View>

        <Text
          style={{
            fontSize: 24,
            fontWeight: "700",
            color: "#FFFFFF",
            marginTop: 15,
          }}
        >
          Coletar
        </Text>

        <Text
          style={{
            fontSize: 14,
            color: "#FFFFFF",
            opacity: 0.9,
            marginTop: 5,
          }}
        >
          Coletas operacionais delegadas pela cooperativa
        </Text>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1, padding: 20 }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "#F0FDF4",
              borderRadius: 16,
              padding: 16,
              marginRight: 8,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 12, color: "#4B5563", marginBottom: 6 }}>
              TOTAL COLETADO
            </Text>
            <Text style={{ fontSize: 24, fontWeight: "800", color: "#028C56" }}>
              {totalAtual} kg
            </Text>
          </View>

          <View
            style={{
              flex: 1,
              backgroundColor: "#EFF6FF",
              borderRadius: 16,
              padding: 16,
              marginLeft: 8,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 12, color: "#4B5563", marginBottom: 6 }}>
              COLETAS HOJE
            </Text>
            <Text style={{ fontSize: 24, fontWeight: "800", color: "#2563EB" }}>
              {totalHoje}
            </Text>
          </View>
        </View>

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 24,
          }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "#F9FAFB",
              borderRadius: 14,
              padding: 14,
              marginRight: 8,
              borderWidth: 1,
              borderColor: "#E5E7EB",
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 12, color: "#6B7280" }}>PENDENTES</Text>
            <Text
              style={{
                fontSize: 22,
                fontWeight: "800",
                color: "#111827",
                marginTop: 4,
              }}
            >
              {totalPendentes}
            </Text>
          </View>

          <View
            style={{
              flex: 1,
              backgroundColor: "#F9FAFB",
              borderRadius: 14,
              padding: 14,
              marginLeft: 8,
              borderWidth: 1,
              borderColor: "#E5E7EB",
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 12, color: "#6B7280" }}>EM ANDAMENTO</Text>
            <Text
              style={{
                fontSize: 22,
                fontWeight: "800",
                color: "#111827",
                marginTop: 4,
              }}
            >
              {totalEmAndamento}
            </Text>
          </View>
        </View>

        <View style={{ marginBottom: 24 }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: "#111827",
              marginBottom: 12,
            }}
          >
            Coletas delegadas
          </Text>

          {loadingSchedules ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: "#D1D5DB",
                borderRadius: 12,
                padding: 20,
                backgroundColor: "#F9FAFB",
                alignItems: "center",
              }}
            >
              <ActivityIndicator color="#028C56" />
              <Text style={{ marginTop: 8, color: "#6B7280" }}>
                Carregando coletas...
              </Text>
            </View>
          ) : availableSchedules.length > 0 ? (
            availableSchedules.map((item) => {
              const selected = item.id === selectedScheduleId;
              const generatorName =
                item.generator?.companyName ||
                item.generator?.name ||
                "Gerador";
              const address = item.generator?.address || "-";
              const dateTime = item.scheduledDate || item.preferredDate;
              const isTodayBadge = isToday(dateTime);
              const materialsFromNotes = extractMaterials(item.notes);

              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => setSelectedScheduleId(item.id)}
                  style={{
                    backgroundColor: selected ? "#F0FDF4" : "#F9FAFB",
                    borderRadius: 14,
                    padding: 14,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: selected ? "#028C56" : "#E5E7EB",
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 8,
                    }}
                  >
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 16,
                        fontWeight: "700",
                        color: "#111827",
                        marginRight: 10,
                      }}
                    >
                      {generatorName}
                    </Text>

                    <View style={{ alignItems: "flex-end" }}>
                      <View
                        style={{
                          backgroundColor: getScheduleStatusColor(item.status),
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 12,
                          marginBottom: isTodayBadge ? 6 : 0,
                        }}
                      >
                        <Text
                          style={{
                            color: "#FFFFFF",
                            fontSize: 10,
                            fontWeight: "700",
                          }}
                        >
                          {getScheduleStatusLabel(item.status)}
                        </Text>
                      </View>

                      {isTodayBadge && (
                        <View
                          style={{
                            backgroundColor: "#FEF3C7",
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 12,
                          }}
                        >
                          <Text
                            style={{
                              color: "#92400E",
                              fontSize: 10,
                              fontWeight: "700",
                            }}
                          >
                            HOJE
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={{ marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, color: "#6B7280" }}>Endereço</Text>
                    <Text style={{ fontSize: 14, color: "#111827", fontWeight: "500" }}>
                      {address}
                    </Text>
                  </View>

                  <View style={{ marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, color: "#6B7280" }}>Data e hora</Text>
                    <Text style={{ fontSize: 14, color: "#111827", fontWeight: "500" }}>
                      {formatDateTime(dateTime)}
                    </Text>
                  </View>

                  <View style={{ marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, color: "#6B7280" }}>
                      Materiais previstos
                    </Text>
                    <Text style={{ fontSize: 14, color: "#111827", fontWeight: "500" }}>
                      {materialsFromNotes || item.notes || "Não informado"}
                    </Text>
                  </View>

                  {!!item.notes && (
                    <View style={{ marginTop: 4 }}>
                      <Text style={{ fontSize: 12, color: "#6B7280" }}>Observações</Text>
                      <Text style={{ fontSize: 14, color: "#111827", fontWeight: "500" }}>
                        {item.notes}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          ) : (
            <View
              style={{
                borderWidth: 1,
                borderColor: "#D1D5DB",
                borderRadius: 12,
                padding: 20,
                backgroundColor: "#F9FAFB",
                alignItems: "center",
              }}
            >
              <Ionicons name="clipboard-outline" size={42} color="#9CA3AF" />
              <Text
                style={{
                  color: "#6B7280",
                  marginTop: 10,
                  textAlign: "center",
                }}
              >
                Nenhuma coleta operacional disponível no momento.
              </Text>
            </View>
          )}
        </View>

        {selectedSchedule && (
          <>
            <View
              style={{
                backgroundColor: "#F9FAFB",
                borderRadius: 16,
                padding: 16,
                marginBottom: 20,
                borderWidth: 1,
                borderColor: "#E5E7EB",
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: "#111827",
                  marginBottom: 12,
                }}
              >
                Coleta selecionada
              </Text>

              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 12, color: "#6B7280" }}>Gerador</Text>
                <Text style={{ fontSize: 14, color: "#111827", fontWeight: "500" }}>
                  {selectedSchedule.generator?.companyName ||
                    selectedSchedule.generator?.name ||
                    "-"}
                </Text>
              </View>

              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 12, color: "#6B7280" }}>Endereço</Text>
                <Text style={{ fontSize: 14, color: "#111827", fontWeight: "500" }}>
                  {selectedSchedule.generator?.address || "-"}
                </Text>
              </View>

              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 12, color: "#6B7280" }}>Data e hora</Text>
                <Text style={{ fontSize: 14, color: "#111827", fontWeight: "500" }}>
                  {formatDateTime(
                    selectedSchedule.scheduledDate || selectedSchedule.preferredDate
                  )}
                </Text>
              </View>

              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 12, color: "#6B7280" }}>Status</Text>
                <Text style={{ fontSize: 14, color: "#111827", fontWeight: "500" }}>
                  {getScheduleStatusLabel(selectedSchedule.status)}
                </Text>
              </View>

              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 12, color: "#6B7280" }}>
                  Materiais previstos
                </Text>
                <Text style={{ fontSize: 14, color: "#111827", fontWeight: "500" }}>
                  {extractMaterials(selectedSchedule.notes) ||
                    selectedSchedule.notes ||
                    "Não informado"}
                </Text>
              </View>

              <View>
                <Text style={{ fontSize: 12, color: "#6B7280" }}>Observações</Text>
                <Text style={{ fontSize: 14, color: "#111827", fontWeight: "500" }}>
                  {selectedSchedule.notes || "-"}
                </Text>
              </View>
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: "#111827",
                  marginBottom: 8,
                }}
              >
                Peso da coleta (kg)
              </Text>
              <TextInput
                value={weight}
                onChangeText={setWeight}
                placeholder="0.00"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                style={{
                  borderWidth: 1,
                  borderColor: "#D1D5DB",
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 16,
                  color: "#111827",
                  backgroundColor: "#F9FAFB",
                }}
              />
            </View>

            <View style={{ marginBottom: 25 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: "#111827",
                  marginBottom: 12,
                }}
              >
                Tipos de materiais coletados
              </Text>

              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {materials.map((material) => {
                  const selected = selectedMaterials.includes(material);

                  return (
                    <TouchableOpacity
                      key={material}
                      onPress={() => toggleMaterial(material)}
                      style={{
                        backgroundColor: selected ? "#028C56" : "#F3F4F6",
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 20,
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
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: "#111827",
                  marginBottom: 8,
                }}
              >
                Observações da execução
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Ex.: material estava separado, acesso pelos fundos, coleta concluída sem intercorrências"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                style={{
                  borderWidth: 1,
                  borderColor: "#D1D5DB",
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 16,
                  color: "#111827",
                  backgroundColor: "#F9FAFB",
                  minHeight: 110,
                }}
              />
            </View>

            <View style={{ marginBottom: 24 }}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={handleRegisterCollect}
                disabled={saving || !selectedScheduleId}
                style={{ marginBottom: 12 }}
              >
                <LinearGradient
                  colors={["#10F35D", "#028C56"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    height: 52,
                    borderRadius: 8,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: saving || !selectedScheduleId ? 0.7 : 1,
                  }}
                >
                  {saving ? (
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
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
                    </View>
                  ) : (
                    <Text
                      style={{
                        color: "#FFFFFF",
                        fontSize: 18,
                        fontWeight: "800",
                      }}
                    >
                      REGISTRAR COLETA
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleReportProblem}
                style={{
                  height: 52,
                  borderRadius: 8,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#FEF2F2",
                  borderWidth: 1,
                  borderColor: "#DC2626",
                }}
              >
                <Text
                  style={{ color: "#DC2626", fontSize: 16, fontWeight: "600" }}
                >
                  RELATAR PROBLEMA
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}