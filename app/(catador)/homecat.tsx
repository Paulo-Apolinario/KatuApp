import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import {
  collectionService,
  type Collection,
  type CollectionMaterial,
} from "@/src/services/collectionService";

function formatDateTime(dateString?: string | null) {
  if (!dateString) return "-";

  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return "-";

  return parsed.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMaterials(materials?: CollectionMaterial[]) {
  if (!Array.isArray(materials) || materials.length === 0) return "-";

  return materials
    .map((item) => `${item.type}: ${Number(item.quantityKg || 0).toFixed(1)} kg`)
    .join(" • ");
}

export default function HomeCatScreen() {
  const [loading, setLoading] = useState(true);
  const [collections, setCollections] = useState<Collection[]>([]);

  const loadCollections = useCallback(async () => {
    try {
      setLoading(true);
      const data = await collectionService.list();
      setCollections(data);
    } catch (error) {
      console.error("Erro ao carregar painel do catador:", error);
      Alert.alert("Erro", "Não foi possível carregar o painel do catador.");
      setCollections([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCollections();
    }, [loadCollections])
  );

  const metrics = useMemo(() => {
    const completedCollections = collections.filter(
      (item) => item.status === "COMPLETED"
    );

    const inProgressCollections = collections.filter(
      (item) => item.status === "IN_PROGRESS"
    );

    const totalCollectedKg = completedCollections.reduce(
      (acc, item) => acc + Number(item.totalWeightKg || 0),
      0
    );

    return {
      totalCollectedKg,
      completedCollections,
      inProgressCollections,
      recentCollections: completedCollections.slice(0, 5),
    };
  }, [collections]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#F3F4F6",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color="#028C56" />
        <Text style={{ marginTop: 12, color: "#6B7280" }}>
          Carregando painel...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#F3F4F6" }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 28 }}
    >
      <LinearGradient
        colors={["#16a34a", "#22c55e"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          paddingTop: 30,
          paddingBottom: 28,
          paddingHorizontal: 20,
          borderBottomLeftRadius: 30,
          borderBottomRightRadius: 30,
        }}
      >
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 26,
            fontWeight: "800",
          }}
        >
          Painel do catador
        </Text>

        <Text
          style={{
            color: "#E8FFF1",
            fontSize: 15,
            marginTop: 8,
            lineHeight: 22,
          }}
        >
          Acompanhe suas coletas executadas, volume coletado e ações rápidas.
        </Text>

        <View style={{ flexDirection: "row", marginTop: 18 }}>
          <ActionButton
            icon="trash-outline"
            label="Executar coleta"
            onPress={() => router.push("/(catador)/collect")}
            style={{ flex: 1, marginRight: 10 }}
          />
          <ActionButton
            icon="bar-chart-outline"
            label="Ver dados"
            onPress={() => router.push("/(catador)/data")}
            style={{ flex: 1 }}
          />
        </View>
      </LinearGradient>

      <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <MetricCard
            title="Total coletado"
            value={`${metrics.totalCollectedKg.toFixed(1)} kg`}
            icon="scale-outline"
          />
          <MetricCard
            title="Concluídas"
            value={String(metrics.completedCollections.length)}
            icon="checkmark-circle-outline"
          />
        </View>

        <View style={{ marginTop: 12 }}>
          <MetricCardFull
            title="Em andamento"
            value={String(metrics.inProgressCollections.length)}
            icon="time-outline"
          />
        </View>

        <SectionHeader
          title="Coletas recentes"
          actionLabel="Ver dados"
          onPress={() => router.push("/(catador)/data")}
        />

        <View style={sectionCard}>
          {metrics.recentCollections.length > 0 ? (
            metrics.recentCollections.map((item) => (
              <View key={item.id} style={listItemCard}>
                <Text style={itemTitle}>Status: {item.status}</Text>
                <Text style={itemText}>
                  Peso: {Number(item.totalWeightKg || 0).toFixed(1)} kg
                </Text>
                <Text style={itemSubtext}>
                  Data: {formatDateTime(item.collectedAt || item.createdAt)}
                </Text>
                <Text style={itemSubtext}>
                  Materiais: {formatMaterials(item.materials)}
                </Text>
              </View>
            ))
          ) : (
            <EmptyState
              icon="clipboard-outline"
              title="Nenhuma coleta recente"
              subtitle="As coletas registradas aparecerão aqui conforme forem executadas."
            />
          )}
        </View>

        <SectionHeader title="Ações rápidas" />

        <View style={sectionCard}>
          <QuickAction
            icon="trash-outline"
            title="Executar coleta"
            subtitle="Abrir a fila operacional delegada"
            onPress={() => router.push("/(catador)/collect")}
          />
          <QuickAction
            icon="bar-chart-outline"
            title="Ver dados"
            subtitle="Acompanhar total coletado e histórico"
            onPress={() => router.push("/(catador)/data")}
          />
          <QuickAction
            icon="document-text-outline"
            title="Comprovantes"
            subtitle="Gerar e consultar comprovantes"
            onPress={() => router.push("/(catador)/receipts")}
          />
          <QuickAction
            icon="grid-outline"
            title="Resumo do catador"
            subtitle="Visualizar painel consolidado"
            onPress={() => router.push("/(catador)/dashboard")}
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

function MetricCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View
      style={{
        width: "48.5%",
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: "#E5E7EB",
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: "#ECFDF5",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
        }}
      >
        <Ionicons name={icon} size={22} color="#028C56" />
      </View>

      <Text style={{ color: "#6B7280", fontSize: 13 }}>{title}</Text>
      <Text style={{ color: "#111827", fontSize: 20, fontWeight: "800", marginTop: 4 }}>
        {value}
      </Text>
    </View>
  );
}

function MetricCardFull({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: "#E5E7EB",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: "#FEF3C7",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Ionicons name={icon} size={22} color="#D97706" />
        </View>

        <View>
          <Text style={{ color: "#6B7280", fontSize: 13 }}>{title}</Text>
          <Text style={{ color: "#111827", fontSize: 24, fontWeight: "800", marginTop: 2 }}>
            {value}
          </Text>
        </View>
      </View>
    </View>
  );
}

function SectionHeader({
  title,
  actionLabel,
  onPress,
}: {
  title: string;
  actionLabel?: string;
  onPress?: () => void;
}) {
  return (
    <View
      style={{
        marginTop: 20,
        marginBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: "800", color: "#111827" }}>
        {title}
      </Text>

      {actionLabel && onPress ? (
        <TouchableOpacity onPress={onPress}>
          <Text style={{ color: "#028C56", fontWeight: "700" }}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
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
        paddingBottom: isLast ? 0 : 16,
        marginBottom: isLast ? 0 : 16,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: "#E5E7EB",
      }}
    >
      <View
        style={{
          width: 46,
          height: 46,
          borderRadius: 23,
          backgroundColor: "#F3F4F6",
          alignItems: "center",
          justifyContent: "center",
          marginRight: 14,
        }}
      >
        <Ionicons name={icon} size={22} color="#028C56" />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: "#111827" }}>
          {title}
        </Text>
        <Text style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>
          {subtitle}
        </Text>
      </View>
    </TouchableOpacity>
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
    <View style={{ alignItems: "center", paddingVertical: 28 }}>
      <Ionicons name={icon} size={42} color="#9CA3AF" />
      <Text
        style={{
          marginTop: 12,
          fontSize: 16,
          fontWeight: "700",
          color: "#111827",
          textAlign: "center",
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          marginTop: 6,
          fontSize: 14,
          color: "#6B7280",
          textAlign: "center",
          lineHeight: 22,
        }}
      >
        {subtitle}
      </Text>
    </View>
  );
}

const sectionCard = {
  backgroundColor: "#FFFFFF",
  borderRadius: 18,
  padding: 16,
  borderWidth: 1,
  borderColor: "#E5E7EB",
} as const;

const listItemCard = {
  borderWidth: 1,
  borderColor: "#E5E7EB",
  borderRadius: 16,
  padding: 14,
  marginBottom: 12,
  backgroundColor: "#F9FAFB",
} as const;

const itemTitle = {
  fontSize: 15,
  fontWeight: "800" as const,
  color: "#111827",
} as const;

const itemText = {
  fontSize: 14,
  color: "#374151",
  marginTop: 4,
} as const;

const itemSubtext = {
  fontSize: 12,
  color: "#6B7280",
  marginTop: 4,
} as const;