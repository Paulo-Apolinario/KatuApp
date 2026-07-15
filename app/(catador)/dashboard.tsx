import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
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
import { collectionService } from "@/src/services/collectionService";
import type { Collection, CollectionMaterial } from "@/src/types/collection";

function formatDate(date?: string | null) {
  if (!date) return "-";

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "-";

  return parsed.toLocaleDateString("pt-BR");
}

function normalizeMaterials(materials: unknown): CollectionMaterial[] {
  if (!Array.isArray(materials)) return [];

  return materials
    .map((item) => {
      if (typeof item === "string") {
        return { type: item, quantityKg: 0 };
      }

      if (item && typeof item === "object" && "type" in item) {
        return {
          type: String((item as { type?: unknown }).type ?? "Não informado"),
          quantityKg: Number(
            (item as { quantityKg?: unknown }).quantityKg ?? 0
          ),
        };
      }

      return null;
    })
    .filter(Boolean) as CollectionMaterial[];
}

function getCollectionTotalKg(collection: Collection) {
  const materialsKg = (collection.materials ?? []).reduce(
    (sum, item) => sum + Number(item.quantityKg ?? 0),
    0
  );

  if (materialsKg > 0) return materialsKg;
  return Number(collection.totalWeightKg ?? 0);
}

function getMaterialsLabel(materials?: CollectionMaterial[]) {
  if (!materials || materials.length === 0) return "-";

  return materials
    .map(
      (item) => `${item.type} (${Number(item.quantityKg ?? 0).toFixed(1)} kg)`
    )
    .join(", ");
}

export default function CollectorDashboardScreen() {
  const { signOut } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);

  const loadCollections = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);

      const response = await collectionService.list();

      const normalized = Array.isArray(response)
        ? response.map((item) => ({
            ...item,
            materials: normalizeMaterials(item.materials),
            totalWeightKg: Number(item.totalWeightKg ?? 0),
          }))
        : [];

      setCollections(normalized);
    } catch (error) {
      console.error("Erro ao carregar dashboard do catador:", error);
      setCollections([]);
    } finally {
      if (showLoader) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCollections(true);
    }, [loadCollections])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCollections(false);
  }, [loadCollections]);

  const handleSignOut = useCallback(async () => {
    await signOut();
  }, [signOut]);

  const metrics = useMemo(() => {
    const completedCollections = collections.filter(
      (item) => item.status === "COMPLETED"
    );

    const inProgressCollections = collections.filter(
      (item) => item.status === "IN_PROGRESS"
    );

    const totalKg = completedCollections.reduce(
      (acc, item) => acc + getCollectionTotalKg(item),
      0
    );

    const lastCollection =
      [...completedCollections].sort((a, b) => {
        const aTime = a.collectedAt
          ? new Date(a.collectedAt).getTime()
          : a.createdAt
            ? new Date(a.createdAt).getTime()
            : 0;

        const bTime = b.collectedAt
          ? new Date(b.collectedAt).getTime()
          : b.createdAt
            ? new Date(b.createdAt).getTime()
            : 0;

        return bTime - aTime;
      })[0] || null;

    const topMaterialsMap: Record<string, number> = {};

    completedCollections.forEach((item) => {
      (item.materials ?? []).forEach((material) => {
        const materialType = material.type?.trim() || "Não informado";
        const quantity = Number(material.quantityKg ?? 0);

        topMaterialsMap[materialType] =
          (topMaterialsMap[materialType] || 0) + quantity;
      });
    });

    const topMaterials = Object.entries(topMaterialsMap)
      .map(([material, quantityKg]) => ({ material, quantityKg }))
      .sort((a, b) => b.quantityKg - a.quantityKg)
      .slice(0, 5);

    const recentCollections = [...collections]
      .sort((a, b) => {
        const aTime = a.collectedAt
          ? new Date(a.collectedAt).getTime()
          : a.createdAt
            ? new Date(a.createdAt).getTime()
            : 0;

        const bTime = b.collectedAt
          ? new Date(b.collectedAt).getTime()
          : b.createdAt
            ? new Date(b.createdAt).getTime()
            : 0;

        return bTime - aTime;
      })
      .slice(0, 4);

    return {
      totalKg,
      completedCollections,
      inProgressCollections,
      lastCollection,
      topMaterials,
      recentCollections,
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
        <Text style={{ marginTop: 10, color: "#6B7280" }}>
          Carregando dashboard...
        </Text>
      </View>
    );
  }

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
          <Text style={{ color: "#E8FFF1", fontSize: 14 }}>
            Dashboard do Catador
          </Text>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleSignOut}
            style={{
              backgroundColor: "rgba(255,255,255,0.18)",
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 8,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
            <Text
              style={{
                color: "#FFFFFF",
                fontWeight: "800",
                marginLeft: 6,
                fontSize: 13,
              }}
            >
              Sair
            </Text>
          </TouchableOpacity>
        </View>

        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 30,
            fontWeight: "800",
            marginTop: 6,
          }}
        >
          Resumo operacional
        </Text>

        <Text
          style={{
            color: "#E8FFF1",
            fontSize: 15,
            marginTop: 8,
            lineHeight: 22,
          }}
        >
          Veja o total coletado, o andamento das coletas e os materiais mais relevantes.
        </Text>
      </LinearGradient>

      <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <MetricCard
            title="Total coletado"
            value={`${metrics.totalKg.toFixed(1)} kg`}
            icon="leaf-outline"
          />
          <MetricCard
            title="Concluídas"
            value={String(metrics.completedCollections.length)}
            icon="checkmark-done-outline"
          />
        </View>

        <View
          style={{
            marginTop: 12,
            flexDirection: "row",
            justifyContent: "space-between",
          }}
        >
          <MetricCard
            title="Em andamento"
            value={String(metrics.inProgressCollections.length)}
            icon="trail-sign-outline"
          />
          <MetricCard
            title="Materiais"
            value={String(metrics.topMaterials.length)}
            icon="albums-outline"
          />
        </View>

        <SectionHeader title="Última coleta concluída" />

        <View style={sectionCard}>
          {metrics.lastCollection ? (
            <>
              <InfoRow
                label="Data"
                value={formatDate(
                  metrics.lastCollection.collectedAt ||
                    metrics.lastCollection.createdAt
                )}
              />
              <InfoRow
                label="Peso"
                value={`${getCollectionTotalKg(metrics.lastCollection).toFixed(
                  1
                )} kg`}
              />
              <InfoRow
                label="Materiais"
                value={getMaterialsLabel(metrics.lastCollection.materials)}
                isLast
              />
            </>
          ) : (
            <EmptyState
              icon="checkmark-circle-outline"
              title="Nenhuma coleta concluída"
              subtitle="Assim que a primeira coleta for finalizada, ela aparecerá aqui."
            />
          )}
        </View>

        <SectionHeader title="Materiais com maior volume" />

        <View style={sectionCard}>
          {metrics.topMaterials.length > 0 ? (
            metrics.topMaterials.map((item, index) => (
              <View
                key={item.material}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingBottom:
                    index === metrics.topMaterials.length - 1 ? 0 : 12,
                  marginBottom:
                    index === metrics.topMaterials.length - 1 ? 0 : 12,
                  borderBottomWidth:
                    index === metrics.topMaterials.length - 1 ? 0 : 1,
                  borderBottomColor: "#E5E7EB",
                }}
              >
                <Text style={{ color: "#374151", fontWeight: "600" }}>
                  {item.material}
                </Text>
                <Text style={{ color: "#028C56", fontWeight: "800" }}>
                  {item.quantityKg.toFixed(1)} kg
                </Text>
              </View>
            ))
          ) : (
            <EmptyState
              icon="cube-outline"
              title="Sem materiais registrados"
              subtitle="Os materiais aparecerão aqui conforme as coletas forem concluídas."
            />
          )}
        </View>

        <SectionHeader title="Coletas recentes" />

        <View style={sectionCard}>
          {metrics.recentCollections.length > 0 ? (
            metrics.recentCollections.map((item) => (
              <View key={item.id} style={listItemCard}>
                <Text style={itemTitle}>Status: {item.status}</Text>
                <Text style={itemText}>
                  Peso: {getCollectionTotalKg(item).toFixed(1)} kg
                </Text>
                <Text style={itemSubtext}>
                  Data: {formatDate(item.collectedAt || item.createdAt)}
                </Text>
                {(item.materials ?? []).length > 0 && (
                  <Text style={itemSubtext}>
                    Materiais: {getMaterialsLabel(item.materials)}
                  </Text>
                )}
              </View>
            ))
          ) : (
            <EmptyState
              icon="time-outline"
              title="Nenhuma coleta recente"
              subtitle="As coletas registradas aparecerão aqui."
            />
          )}
        </View>

        <SectionHeader title="Ações rápidas" />

        <View style={sectionCard}>
          <QuickAction
            icon="refresh-outline"
            title="Atualizar dados"
            subtitle="Recarregar informações do dashboard"
            onPress={onRefresh}
          />
          <QuickAction
            icon="log-out-outline"
            title="Sair"
            subtitle="Encerrar sessão neste dispositivo"
            onPress={handleSignOut}
            isLast
          />
        </View>
      </View>
    </ScrollView>
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
          backgroundColor: "#DCFCE7",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 10,
        }}
      >
        <Ionicons name={icon} size={20} color="#15803D" />
      </View>

      <Text style={{ fontSize: 13, color: "#6B7280" }}>{title}</Text>
      <Text
        style={{
          marginTop: 4,
          fontSize: 22,
          fontWeight: "800",
          color: "#111827",
        }}
      >
        {value}
      </Text>
    </View>
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

const sectionCard = {
  backgroundColor: "#FFFFFF",
  borderRadius: 18,
  padding: 16,
  borderWidth: 1,
  borderColor: "#E5E7EB",
} as const;

const listItemCard = {
  backgroundColor: "#F9FAFB",
  borderRadius: 14,
  padding: 14,
  marginBottom: 10,
  borderWidth: 1,
  borderColor: "#E5E7EB",
} as const;

const itemTitle = {
  fontSize: 15,
  fontWeight: "700" as const,
  color: "#111827",
} as const;

const itemText = {
  marginTop: 5,
  fontSize: 14,
  color: "#4B5563",
} as const;

const itemSubtext = {
  marginTop: 6,
  fontSize: 13,
  color: "#6B7280",
} as const;