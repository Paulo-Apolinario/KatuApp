import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  driverService,
  type DriverReport,
  type DriverReportType,
} from "@/src/services/driverService";
import { useNotification } from "@/src/contexts/NotificationContext";

const occurrenceOptions: {
  label: string;
  value: DriverReportType;
}[] = [
  { label: "Atraso", value: "DELAY" },
  { label: "Problema mecânico", value: "MECHANICAL_ISSUE" },
  { label: "Coleta não realizada", value: "COLLECTION_NOT_COMPLETED" },
  { label: "Observações gerais", value: "GENERAL_NOTE" },
];

function formatReportType(type: DriverReportType) {
  switch (type) {
    case "DELAY":
      return "Atraso";
    case "MECHANICAL_ISSUE":
      return "Problema mecânico";
    case "COLLECTION_NOT_COMPLETED":
      return "Coleta não realizada";
    case "GENERAL_NOTE":
      return "Observações gerais";
    default:
      return type;
  }
}

export default function MotoristaRelatoriosScreen() {
  const [selectedType, setSelectedType] = useState<DriverReportType>("DELAY");
  const [description, setDescription] = useState("");
  const { notifyError, notifySuccess, notifyWarning } = useNotification();

  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reports, setReports] = useState<DriverReport[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadReports = useCallback(async (showRefresh = false) => {
    try {
      setError(null);

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setListLoading(true);
      }

      const data = await driverService.listMyReports();
      setReports(data);
    } catch (err: any) {
      setError(err?.message || "Não foi possível carregar os relatórios.");
    } finally {
      setListLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadReports();
    }, [loadReports])
  );

  async function handleSubmit() {
    if (!description.trim()) {
      notifyWarning("Descreva a ocorrência.");
      return;
    }

    try {
      setLoading(true);

      await driverService.createMyReport({
        type: selectedType,
        description,
      });

      setDescription("");
      setSelectedType("DELAY");

      await loadReports();

      notifySuccess("Ocorrência registrada com sucesso.");
    } catch (err: any) {
      notifyError(err?.message || "Não foi possível registrar a ocorrência.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
      <LinearGradient
        colors={["#10F35D", "#028C56"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          paddingTop: 48,
          paddingBottom: 18,
          paddingHorizontal: 20,
          borderBottomLeftRadius: 26,
          borderBottomRightRadius: 26,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: "rgba(255,255,255,0.18)",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
            }}
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "800" }}>
              Relatórios
            </Text>
            <Text style={{ color: "#E8FFF1", fontSize: 13, marginTop: 2 }}>
              Registro de ocorrências operacionais
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => router.push("/(motorista)/historico-relatorios")}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: "rgba(255,255,255,0.18)",
            }}
          >
            <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 12 }}>
              HISTÓRICO
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ padding: 18, paddingBottom: 30 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadReports(true)}
            colors={["#028C56"]}
            tintColor="#028C56"
          />
        }
      >
        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 18,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <Text style={{ color: "#111827", fontSize: 16, fontWeight: "800" }}>
            Tipo de ocorrência
          </Text>

          <View style={{ marginTop: 14 }}>
            {occurrenceOptions.map((item) => {
              const selected = selectedType === item.value;

              return (
                <TouchableOpacity
                  key={item.value}
                  onPress={() => setSelectedType(item.value)}
                  style={{
                    paddingVertical: 14,
                    paddingHorizontal: 14,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: selected ? "#028C56" : "#D1D5DB",
                    backgroundColor: selected ? "#ECFDF5" : "#FFFFFF",
                    marginBottom: 10,
                  }}
                >
                  <Text
                    style={{
                      color: selected ? "#065F46" : "#374151",
                      fontWeight: "700",
                    }}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 18,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <Text style={{ color: "#111827", fontSize: 16, fontWeight: "800" }}>
            Descrição
          </Text>

          <TextInput
            multiline
            numberOfLines={6}
            value={description}
            onChangeText={setDescription}
            placeholder="Descreva a ocorrência..."
            placeholderTextColor="#9CA3AF"
            style={{
              marginTop: 12,
              borderWidth: 1,
              borderColor: "#D1D5DB",
              borderRadius: 16,
              padding: 14,
              minHeight: 140,
              textAlignVertical: "top",
              color: "#111827",
            }}
          />
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleSubmit}
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
                ENVIAR RELATÓRIO
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <View
          style={{
            marginTop: 18,
            backgroundColor: "#FFFFFF",
            borderRadius: 18,
            padding: 16,
          }}
        >
          <Text style={{ color: "#111827", fontSize: 16, fontWeight: "800" }}>
            Últimos relatórios
          </Text>

          {!!error && (
            <Text style={{ color: "#B91C1C", marginTop: 10, fontWeight: "700" }}>
              {error}
            </Text>
          )}

          {listLoading ? (
            <View style={{ paddingVertical: 18 }}>
              <ActivityIndicator color="#028C56" />
            </View>
          ) : reports.length === 0 ? (
            <Text style={{ color: "#6B7280", marginTop: 12 }}>
              Nenhuma ocorrência registrada ainda.
            </Text>
          ) : (
            reports.slice(0, 5).map((report) => (
              <View
                key={report.id}
                style={{
                  marginTop: 12,
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                  borderRadius: 14,
                  padding: 12,
                }}
              >
                <Text style={{ color: "#028C56", fontWeight: "800" }}>
                  {formatReportType(report.type)}
                </Text>
                <Text style={{ color: "#374151", marginTop: 6, lineHeight: 20 }}>
                  {report.description}
                </Text>
                <Text style={{ color: "#9CA3AF", marginTop: 8, fontSize: 12 }}>
                  {report.createdAt
                    ? new Date(report.createdAt).toLocaleString("pt-BR")
                    : "Sem data"}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}