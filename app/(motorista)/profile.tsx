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
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/src/contexts/AuthContext";
import {
  driverService,
  type DriverProfile,
  translateDriverStatus,
} from "@/src/services/driverService";
import { translateVehicleStatus } from "@/src/services/vehicleService";

function InfoItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text
        style={{
          color: "#028C56",
          fontSize: 12,
          fontWeight: "700",
          marginBottom: 4,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: "#111827",
          fontSize: 15,
          fontWeight: "600",
        }}
      >
        {value || "Não informado"}
      </Text>
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <Text
      style={{
        color: "#111827",
        fontSize: 16,
        fontWeight: "800",
        marginBottom: 14,
      }}
    >
      {title}
    </Text>
  );
}

export default function MotoristaProfileScreen() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async (showRefresh = false) => {
    try {
      setError(null);

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await driverService.getMeWithVehicle(user?.driver?.id);
      setProfile(response);
    } catch (err: any) {
      setError(err?.message || "Não foi possível carregar o perfil.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.driver?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile])
  );

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#F8FAFC",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color="#028C56" />
        <Text style={{ marginTop: 12, color: "#4B5563", fontWeight: "600" }}>
          Carregando perfil...
        </Text>
      </View>
    );
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

          <View>
            <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "800" }}>
              Perfil
            </Text>
            <Text style={{ color: "#E8FFF1", fontSize: 13, marginTop: 2 }}>
              Informações do motorista
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ padding: 18, paddingBottom: 30 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadProfile(true)}
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

        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 18,
            padding: 18,
            marginBottom: 14,
          }}
        >
          <SectionTitle title="Dados do motorista" />

          <InfoItem label="Nome" value={profile?.name} />
          <InfoItem label="E-mail" value={profile?.email} />
          <InfoItem label="Telefone" value={profile?.phone} />
          <InfoItem label="CPF" value={profile?.cpf} />
          <InfoItem label="CNH" value={profile?.cnh} />
          <InfoItem label="Categoria CNH" value={profile?.cnhCategory} />
          <InfoItem
            label="Status"
            value={translateDriverStatus(profile?.status)}
          />
          <InfoItem label="Observações" value={profile?.notes} />
        </View>

        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 18,
            padding: 18,
            marginBottom: 14,
          }}
        >
          <SectionTitle title="Cooperativa vinculada" />

          <InfoItem
            label="Nome da cooperativa"
            value={profile?.cooperative?.name}
          />
          <InfoItem label="E-mail" value={profile?.cooperative?.email} />
          <InfoItem label="Telefone" value={profile?.cooperative?.phone} />
          <InfoItem label="Endereço" value={profile?.cooperative?.address} />
        </View>

        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 18,
            padding: 18,
            marginBottom: 14,
          }}
        >
          <SectionTitle title="Veículo vinculado" />

          <InfoItem label="Placa" value={profile?.currentVehicle?.plate} />
          <InfoItem label="Modelo" value={profile?.currentVehicle?.model} />
          <InfoItem label="Marca" value={profile?.currentVehicle?.brand} />
          <InfoItem
            label="Ano"
            value={
              profile?.currentVehicle?.year != null
                ? String(profile.currentVehicle.year)
                : null
            }
          />
          <InfoItem
            label="Capacidade (Kg)"
            value={
              profile?.currentVehicle?.capacityKg != null
                ? String(profile.currentVehicle.capacityKg)
                : null
            }
          />
          <InfoItem
            label="Status do veículo"
            value={translateVehicleStatus(profile?.currentVehicle?.status)}
          />
        </View>
      </ScrollView>
    </View>
  );
}