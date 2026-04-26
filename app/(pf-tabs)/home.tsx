import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";

import { useAuth } from "@/src/contexts/AuthContext";
import { useNotification } from "@/src/contexts/NotificationContext";

type AuthUserLike = {
  id?: string;
  name?: string;
  displayName?: string;
  email?: string;
};

function getUserDisplayName(user: AuthUserLike | null) {
  return user?.displayName || user?.name || "Usuário";
}

export default function PFHomeScreen() {
  const { user } = useAuth();
  const currentUser = user as AuthUserLike | null;
  const { notifyWarning } = useNotification();

  const [refreshing, setRefreshing] = useState(false);
  const [currentCity, setCurrentCity] = useState("Carregando localização...");
  const [locationError, setLocationError] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);

  const displayName = getUserDisplayName(currentUser);

  const openAppSettings = useCallback(() => {
    if (Platform.OS === "ios") {
      Linking.openURL("app-settings:");
    } else {
      Linking.openSettings();
    }
  }, []);

  const getUserLocation = useCallback(async () => {
    setIsLoadingLocation(true);

    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();

      if (!servicesEnabled) {
        setCurrentCity("Localização desativada");
        setLocationError(true);
        notifyWarning("Ative a localização do aparelho para mostrar a cidade atual.");
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setCurrentCity("Permissão negada");
        setLocationError(true);

        notifyWarning("Precisamos da sua localização para mostrar a cidade atual.");
        openAppSettings();
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const addresses = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      if (addresses.length > 0) {
        const address = addresses[0];
        const city =
          address.city ||
          address.subregion ||
          address.region ||
          address.country ||
          "Localização desconhecida";

        setCurrentCity(city);
        setLocationError(false);
      } else {
        setCurrentCity("Localização não encontrada");
        setLocationError(true);
      }
    } catch (error) {
      console.error("Erro ao obter localização da PF:", error);
      setCurrentCity("Erro ao carregar");
      setLocationError(true);
    } finally {
      setIsLoadingLocation(false);
      setRefreshing(false);
    }
  }, [notifyWarning, openAppSettings]);

  useFocusEffect(
    useCallback(() => {
      getUserLocation();
    }, [getUserLocation])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await getUserLocation();
  }, [getUserLocation]);

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
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View>
            <Text style={{ color: "#E8FFF1", fontSize: 14 }}>
              Painel da Pessoa Física
            </Text>
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 30,
                fontWeight: "800",
                marginTop: 6,
              }}
            >
              Olá, {displayName}
            </Text>
          </View>

          <TouchableOpacity onPress={() => router.push("/(pf-tabs)/profile")}>
            <Ionicons name="person-circle-outline" size={42} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={locationError ? getUserLocation : undefined}
          disabled={isLoadingLocation || !locationError}
          style={{
            marginTop: 14,
            alignSelf: "flex-start",
            backgroundColor: locationError
              ? "rgba(220,38,38,0.18)"
              : "rgba(255,255,255,0.18)",
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 20,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Ionicons
            name={locationError ? "alert-circle-outline" : "location-sharp"}
            size={18}
            color={locationError ? "#FEE2E2" : "#FFFFFF"}
          />
          <Text
            style={{
              color: "#FFFFFF",
              marginLeft: 8,
              fontWeight: "600",
            }}
          >
            {isLoadingLocation ? "Carregando..." : currentCity}
          </Text>
        </TouchableOpacity>

        <Text
          style={{
            color: "#E8FFF1",
            fontSize: 15,
            marginTop: 12,
            lineHeight: 22,
          }}
        >
          Solicite sua coleta, acompanhe seu histórico e participe da rede de
          reciclagem do KATUÁ.
        </Text>

        <View style={{ flexDirection: "row", marginTop: 18 }}>
          <ActionButton
            icon="calendar-outline"
            label="Agendar coleta"
            onPress={() => router.push("/(pf-tabs)/schedule")}
            style={{ flex: 1, marginRight: 10 }}
          />
          <ActionButton
            icon="person-outline"
            label="Meu perfil"
            onPress={() => router.push("/(pf-tabs)/profile")}
            style={{ flex: 1 }}
          />
        </View>
      </LinearGradient>

      <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
        <SectionHeader title="Como funciona" />

        <View style={sectionCard}>
          <InfoCard
            icon="location-outline"
            title="1. Informe sua necessidade"
            subtitle="Use a localização e acesse o agendamento para solicitar uma coleta."
          />
          <InfoCard
            icon="business-outline"
            title="2. A cooperativa recebe a solicitação"
            subtitle="Sua solicitação entra no fluxo operacional do sistema."
          />
          <InfoCard
            icon="checkmark-done-outline"
            title="3. A coleta é organizada"
            subtitle="A cooperativa agenda e direciona a execução conforme a operação."
            isLast
          />
        </View>

        <SectionHeader title="Ações rápidas" />

        <View style={sectionCard}>
          <QuickAction
            icon="calendar-outline"
            title="Agendar coleta"
            subtitle="Solicitar um novo serviço"
            onPress={() => router.push("/(pf-tabs)/schedule")}
          />
          <QuickAction
            icon="time-outline"
            title="Ver histórico"
            subtitle="Consultar solicitações e movimentações"
            onPress={() => router.push("/(pf-tabs)/history")}
          />
          <QuickAction
            icon="trophy-outline"
            title="Ranking"
            subtitle="Acompanhar posições e evolução"
            onPress={() => router.push("/(pf-tabs)/ranking")}
          />
          <QuickAction
            icon="person-outline"
            title="Meu perfil"
            subtitle="Ver e editar informações da conta"
            onPress={() => router.push("/(pf-tabs)/profile")}
            isLast
          />
        </View>

        <SectionHeader title="Recursos adicionais" />

        <View style={sectionCard}>
          <QuickAction
            icon="calculator-outline"
            title="Calculadora"
            subtitle="Acessar recursos complementares"
            onPress={() => router.push("/(pf-tabs)/calculator")}
          />
          <QuickAction
            icon="scan-outline"
            title="NFC"
            subtitle="Explorar integração futura"
            onPress={() => router.push("/(pf-tabs)/nfc")}
          />
          <QuickAction
            icon="storefront-outline"
            title="Loja"
            subtitle="Ver benefícios e itens disponíveis"
            onPress={() => router.push("/(pf-tabs)/store")}
          />
          <QuickAction
            icon="chatbubble-outline"
            title="Chat"
            subtitle="Abrir comunicação da conta"
            onPress={() => router.push("/(pf-tabs)/chat")}
            isLast
          />
        </View>
      </View>
    </ScrollView>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  style?: object;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[
        {
          backgroundColor: "rgba(255,255,255,0.18)",
          borderRadius: 16,
          paddingVertical: 14,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Ionicons name={icon} size={18} color="#FFFFFF" />
      <Text
        style={{
          color: "#FFFFFF",
          fontWeight: "700",
          fontSize: 15,
          marginLeft: 8,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={{ marginTop: 18, marginBottom: 10 }}>
      <Text style={{ fontSize: 18, fontWeight: "800", color: "#111827" }}>
        {title}
      </Text>
    </View>
  );
}

function InfoCard({
  icon,
  title,
  subtitle,
  isLast = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  isLast?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        paddingBottom: isLast ? 0 : 14,
        marginBottom: isLast ? 0 : 14,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: "#E5E7EB",
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: "#DCFCE7",
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        }}
      >
        <Ionicons name={icon} size={20} color="#15803D" />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: "#111827" }}>
          {title}
        </Text>
        <Text
          style={{
            fontSize: 13,
            color: "#6B7280",
            marginTop: 4,
            lineHeight: 20,
          }}
        >
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

function QuickAction({
  icon,
  title,
  subtitle,
  onPress,
  isLast = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingBottom: isLast ? 0 : 14,
        marginBottom: isLast ? 0 : 14,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: "#E5E7EB",
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: "#DCFCE7",
          alignItems: "center",
          justifyContent: "center",
          marginRight: 12,
        }}
      >
        <Ionicons name={icon} size={20} color="#15803D" />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: "#111827" }}>
          {title}
        </Text>
        <Text style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>
          {subtitle}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
    </TouchableOpacity>
  );
}

const sectionCard = {
  backgroundColor: "#FFFFFF",
  borderRadius: 18,
  padding: 16,
  borderWidth: 1,
  borderColor: "#E5E7EB",
} as const;