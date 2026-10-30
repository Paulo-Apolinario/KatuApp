import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { collectionService } from "../../src/services/collectionService";
import type { Collection } from "../../src/types/collection";
const num = (n: number) =>
  Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
export default function TeamProduction() {
  const inset = useSafeAreaInsets(),
    [rows, setRows] = useState<Collection[]>([]),
    [busy, setBusy] = useState(true),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const cs = await collectionService.list();
      setRows(cs.filter((c) => c.participants?.length));
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "Não foi possível consultar.");
    } finally {
      setBusy(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  return (
    <View
      style={{ flex: 1, backgroundColor: "#F3F7F5", paddingTop: inset.top }}
    >
      <View style={{ padding: 20, backgroundColor: "#123C35", gap: 12 }}>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => router.back()}
        >
          <Text style={{ color: "#fff" }}>‹ Voltar</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 24, fontWeight: "800", color: "#fff" }}>
          Minha produção em equipe
        </Text>
        <Text style={{ color: "#D9EEE6" }}>
          Parcelas confirmadas após pesagem pela cooperativa.
        </Text>
      </View>
      <ScrollView
        refreshControl={<RefreshControl refreshing={busy} onRefresh={load} />}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: inset.bottom + 40,
          gap: 14,
        }}
      >
        {busy && <ActivityIndicator color="#047857" />}
        {!!error && (
          <Text accessibilityRole="alert" style={{ color: "#B91C1C" }}>
            {error}
          </Text>
        )}
        {!busy && !rows.length && (
          <Text>Nenhuma coleta em equipe disponível.</Text>
        )}
        {rows.map((c) => {
          const current =
            !!c.allocationVersion &&
            c.allocationQuantityVersion === c.quantityReviewVersion;
          const mine = c.participants?.find(
            (p) => p.collectorId === c.myCollectorId,
          );
          return (
            <View
              key={c.id}
              style={{
                backgroundColor: "#fff",
                padding: 20,
                borderRadius: 16,
                gap: 9,
                borderWidth: 1,
                borderColor: "#DCE8E2",
              }}
            >
              <Text
                style={{ fontSize: 19, color: "#123C35", fontWeight: "700" }}
              >
                {c.teamNameSnapshot || "Equipe"}
              </Text>
              <Text>
                {c.bin?.name ||
                  c.generator?.name ||
                  c.routePoint?.name ||
                  "Coleta"}{" "}
                ·{" "}
                {new Date(
                  c.collectedAt || c.createdAt || Date.now(),
                ).toLocaleDateString("pt-BR")}
              </Text>
              <Text
                style={{
                  color: current ? "#047857" : "#92400E",
                  fontWeight: "600",
                }}
              >
                {current
                  ? "Divisão confirmada"
                  : "Aguardando conferência e divisão"}
              </Text>
              <Text>Total da coleta: {num(c.totalWeightKg || 0)} kg</Text>
              <Text
                style={{ fontSize: 20, fontWeight: "800", color: "#047857" }}
              >
                Minha parcela:{" "}
                {current ? `${num(c.creditedWeightKg || 0)} kg` : "pendente"}
              </Text>
              {current &&
                mine?.allocations?.map((m) => (
                  <Text key={m.materialId}>
                    {m.name}: {num(m.quantity)} {m.unit}
                  </Text>
                ))}
              <Text style={{ color: "#52685F" }}>
                Participantes:{" "}
                {c.participants?.map((p) => p.nameSnapshot).join(" · ")}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
