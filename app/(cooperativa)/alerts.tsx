import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Image,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { scheduleService } from "@/src/services/scheduleService";
import { generatorService } from "@/src/services/generatorService";

type AlertPoint = {
  id: string;
  name: string;
  address: string;
  status: "Atrasado" | "Agendado" | "Solicitação";
  days: number;
};

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getDiffDays(date: Date) {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export default function AlertsScreen() {
  const [loading, setLoading] = useState(true);
  const [alertPoints, setAlertPoints] = useState<AlertPoint[]>([]);

  const currentDriver = "Operação da cooperativa";
  const currentPlate = "Backend ativo";

  const totalLixo = useMemo(() => {
    return alertPoints.length;
  }, [alertPoints]);

  const loadAlerts = useCallback(async () => {
    try {
      setLoading(true);

      const [schedules, generators] = await Promise.all([
        scheduleService.list(),
        generatorService.list(),
      ]);

      const scheduleAlerts: AlertPoint[] = schedules
        .filter(
          (item) => item.status === "REQUESTED" || item.status === "SCHEDULED"
        )
        .map((item) => {
          const date =
            parseDate(item.scheduledDate) ||
            parseDate(item.preferredDate) ||
            parseDate(item.createdAt);

          const days = date ? getDiffDays(date) : 0;

          return {
            id: `schedule-${item.id}`,
            name:
              item.generator?.companyName ||
              item.generator?.name ||
              "Gerador sem identificação",
            address: item.generator?.address || "Endereço não informado",
            status:
              item.status === "SCHEDULED"
                ? "Agendado"
                : days > 0
                ? "Atrasado"
                : "Solicitação",
            days: days > 0 ? days : 1,
          };
        });

      const generatorAlerts: AlertPoint[] = generators
         .filter(
         (item) =>
      item.accessStatus === "ACTIVE" ||
      item.accessStatus === "PENDING_ACTIVATION" ||
      item.accessStatus === "INACTIVE"
      )
       .map((item) => ({
         id: `generator-${item.id}`,
         name: item.companyName || item.name || "Gerador sem nome",
         address: item.address || "Endereço não informado",
         status: "Solicitação",
         days: 1,
      }));

      setAlertPoints([...scheduleAlerts, ...generatorAlerts]);
    } catch (error: any) {
      console.error("Erro ao carregar alertas:", error);
      Alert.alert(
        "Erro",
        error.message || "Não foi possível carregar os alertas."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAlerts();
    }, [loadAlerts])
  );

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
          <TouchableOpacity onPress={() => router.replace("/(cooperativa)/home")}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Image
              source={require("../../assets/images/logo.png")}
              resizeMode="contain"
              style={{ width: 36, height: 36, marginRight: 8 }}
            />
            <Text style={{ fontSize: 22, fontWeight: "800", color: "#FFFFFF" }}>
              KATU
            </Text>
          </View>

          <TouchableOpacity onPress={loadAlerts}>
            <Ionicons name="refresh-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <Text style={{ fontSize: 24, fontWeight: "700", color: "#FFFFFF", marginTop: 15 }}>
          ALERTAS OPERACIONAIS
        </Text>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, padding: 20 }}>
        <View
          style={{
            backgroundColor: "#F9FAFB",
            borderRadius: 16,
            padding: 20,
            marginBottom: 25,
            borderWidth: 1,
            borderColor: "#E5E7EB",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 15 }}>
            <Ionicons name="person-circle-outline" size={40} color="#028C56" />
            <View style={{ marginLeft: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#111827" }}>
                {currentDriver}
              </Text>
              <Text style={{ fontSize: 14, color: "#6B7280" }}>
                STATUS: {currentPlate}
              </Text>
            </View>
          </View>

          <View
            style={{
              backgroundColor: "#F0FDF4",
              borderRadius: 12,
              padding: 15,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 14, color: "#4B5563", marginBottom: 5 }}>
              TOTAL DE ALERTAS
            </Text>
            <Text style={{ fontSize: 36, fontWeight: "800", color: "#028C56" }}>
              {totalLixo}
            </Text>
          </View>
        </View>

        <Text
          style={{
            fontSize: 18,
            fontWeight: "700",
            color: "#111827",
            marginBottom: 15,
          }}
        >
          Pontos de Alerta
        </Text>

        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <ActivityIndicator size="large" color="#028C56" />
            <Text style={{ marginTop: 12, color: "#6B7280" }}>
              Carregando alertas...
            </Text>
          </View>
        ) : alertPoints.length === 0 ? (
          <View
            style={{
              backgroundColor: "#F9FAFB",
              borderRadius: 16,
              padding: 24,
              alignItems: "center",
              marginBottom: 30,
            }}
          >
            <Ionicons name="checkmark-circle-outline" size={42} color="#10B981" />
            <Text
              style={{
                fontSize: 16,
                color: "#6B7280",
                marginTop: 10,
                textAlign: "center",
              }}
            >
              Nenhum alerta operacional encontrado.
            </Text>
          </View>
        ) : (
          alertPoints.map((point) => (
            <View
              key={point.id}
              style={{
                backgroundColor: "#FEF2F2",
                borderRadius: 12,
                padding: 16,
                marginBottom: 10,
                borderWidth: 1,
                borderColor: "#FECACA",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                    <Ionicons name="alert-circle" size={18} color="#DC2626" />
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "700",
                        color: "#DC2626",
                        marginLeft: 6,
                      }}
                    >
                      {point.name}
                    </Text>
                  </View>

                  <Text style={{ fontSize: 14, color: "#6B7280", marginLeft: 24 }}>
                    {point.address}
                  </Text>

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginLeft: 24,
                      marginTop: 4,
                    }}
                  >
                    <View
                      style={{
                        backgroundColor: "#DC2626",
                        borderRadius: 12,
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                      }}
                    >
                      <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "600" }}>
                        {point.status} • {point.days} {point.days === 1 ? "dia" : "dias"}
                      </Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => router.push("/(cooperativa)/schedule")}
                  style={{
                    backgroundColor: "#FFFFFF",
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: "#DC2626",
                    marginLeft: 12,
                  }}
                >
                  <Text style={{ color: "#DC2626", fontSize: 12, fontWeight: "600" }}>
                    ABRIR
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}