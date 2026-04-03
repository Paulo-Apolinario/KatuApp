import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  default as driverService,
  DriverReport,
  DriverReportType,
} from "@/src/services/driverService";

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

function getTypeColors(type: DriverReportType) {
  switch (type) {
    case "DELAY":
      return {
        bg: "#FEF3C7",
        text: "#B45309",
      };
    case "MECHANICAL_ISSUE":
      return {
        bg: "#FEE2E2",
        text: "#B91C1C",
      };
    case "COLLECTION_NOT_COMPLETED":
      return {
        bg: "#FCE7F3",
        text: "#BE185D",
      };
    case "GENERAL_NOTE":
    default:
      return {
        bg: "#DCFCE7",
        text: "#166534",
      };
  }
}

function ReportCard({ item }: { item: DriverReport }) {
  const colors = getTypeColors(item.type);

  return (
    <View
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        padding: 16,
        marginBottom: 14,
      }}
    >
      <View
        style={{
          alignSelf: "flex-start",
          backgroundColor: colors.bg,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
          marginBottom: 12,
        }}
      >
        <Text style={{ color: colors.text, fontWeight: "800", fontSize: 12 }}>
          {formatReportType(item.type)}
        </Text>
      </View>

      <Text
        style={{
          color: "#111827",
          fontSize: 15,
          fontWeight: "700",
          lineHeight: 22,
        }}
      >
        {item.description}
      </Text>

      {!!item.route?.name && (
        <Text style={{ color: "#6B7280", marginTop: 10 }}>
          Rota: {item.route.name}
        </Text>
      )}

      {!!item.vehicle?.plate && (
        <Text style={{ color: "#6B7280", marginTop: 6 }}>
          Veículo: {item.vehicle.plate}
          {item.vehicle?.model ? ` • ${item.vehicle.model}` : ""}
        </Text>
      )}

      {!!item.collection?.id && (
        <Text style={{ color: "#6B7280", marginTop: 6 }}>
          Coleta: {item.collection.id}
        </Text>
      )}

      <Text style={{ color: "#9CA3AF", marginTop: 10, fontSize: 12 }}>
        {item.createdAt
          ? new Date(item.createdAt).toLocaleString("pt-BR")
          : "Sem data"}
      </Text>
    </View>
  );
}

export default function MotoristaHistoricoRelatoriosScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reports, setReports] = useState<DriverReport[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadReports = useCallback(async (showRefresh = false) => {
    try {
      setError(null);

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const data = await driverService.listMyReports();
      setReports(data);
    } catch (err: any) {
      setError(err?.message || "Não foi possível carregar o histórico.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadReports();
    }, [loadReports])
  );

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
              Histórico de relatórios
            </Text>
            <Text style={{ color: "#6B7280", fontSize: 13, marginTop: 2 }}>
              Ocorrências registradas pelo motorista
            </Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator size="large" color="#028C56" />
          <Text style={{ marginTop: 12, color: "#4B5563", fontWeight: "600" }}>
            Carregando histórico...
          </Text>
        </View>
      ) : (
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
          {!!error && (
            <View
              style={{
                backgroundColor: "#FEF2F2",
                borderWidth: 1,
                borderColor: "#FECACA",
                borderRadius: 16,
                padding: 14,
                marginBottom: 16,
              }}
            >
              <Text style={{ color: "#B91C1C", fontWeight: "700" }}>{error}</Text>
            </View>
          )}

          {reports.length === 0 ? (
            <View
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 18,
                padding: 18,
              }}
            >
              <Text style={{ color: "#111827", fontSize: 16, fontWeight: "800" }}>
                Nenhum relatório encontrado
              </Text>
              <Text style={{ color: "#6B7280", marginTop: 8, lineHeight: 22 }}>
                Ainda não existem ocorrências registradas por este motorista.
              </Text>
            </View>
          ) : (
            reports.map((item) => <ReportCard key={item.id} item={item} />)
          )}
        </ScrollView>
      )}
    </View>
  );
}