import { useAuth } from "@/src/contexts/AuthContext";
import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../services/api";
type Impact = {
  collections: number;
  requests: number;
  pendingRequests: number;
  totalMassKg: number;
  co2Kg: number;
  waterLiters: number;
  energyKwh: number;
  treesEquivalent: number;
  description: string;
  reference: { label: string; version: string };
};
const num = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
export default function GeneratorImpact({
  collector = false,
}: {
  collector?: boolean;
}) {
  const { user } = useAuth(),
    [data, setData] = useState<Impact | null>(null),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [request, setRequest] = useState({ path: "/environmental-impact" });
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setBusy(true);
      setData(null);
      setError("");
      if (!user?.id) {
        setBusy(false);
        return;
      }
      api
        .get<{ data: Impact }>(request.path, true)
        .then((r) => {
          if (active) setData(r.data);
        })
        .catch((e) => {
          if (active)
            setError(
              e.message ||
                "Conecte-se à internet para consultar o impacto das coletas.",
            );
        })
        .finally(() => {
          if (active) setBusy(false);
        });
      return () => {
        active = false;
      };
    }, [user?.id, request]),
  );
  return (
    <View style={s.card}>
      <View style={s.heading}>
        <Ionicons name="leaf-outline" size={24} color="#047857" />
        <Text style={s.title}>Resumo ambiental</Text>
      </View>
      <Text style={s.text}>
        {collector
          ? "Resultado acumulado das coletas em que você participou."
          : "Resultado acumulado das suas solicitações e coletas concluídas."}
      </Text>
      {busy && <ActivityIndicator color="#047857" />}
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: "#B91C1C" }}>
          {error}
        </Text>
      )}
      {data && (
        <>
          <View style={s.grid}>
            <View style={s.stat}>
              <Text style={s.text}>Coletas solicitadas</Text>
              <Text style={s.value}>{data.requests}</Text>
              <Text style={s.small}>
                {data.pendingRequests} aguardando atendimento / análise
              </Text>
            </View>
            <View style={s.stat}>
              <Text style={s.text}>Coletas concluídas em campo</Text>
              <Text style={s.value}>{data.collections}</Text>
              <Text style={s.small}>{num(data.totalMassKg)} kg coletados</Text>
            </View>
          </View>
          <View style={s.grid}>
            {(
              [
                ["CO₂ estimado", "co2Kg", "kg CO2e", "leaf-outline"],
                ["Água estimada", "waterLiters", "L", "water-outline"],
                ["Energia estimada", "energyKwh", "kWh", "flash-outline"],
                ["Árvores equivalentes", "treesEquivalent", "", "leaf-outline"],
              ] as const
            ).map(([label, key, unit, icon]) => (
              <View style={s.metric} key={key}>
                <Ionicons name={icon} size={22} color="#047857" />
                <Text style={s.text}>{label}</Text>
                <Text style={s.value}>
                  {`${num(data[key])} ${unit}`.trim()}
                </Text>
              </View>
            ))}
          </View>
          <Text style={s.small}>
            Base automática de referência do sistema, calculada sobre o peso
            coletado. Solicitações ainda pendentes não geram impacto realizado.
          </Text>
          <Text style={s.small}>
            Indicadores aproximados; não representam comprovação de reciclagem
            ou crédito ambiental.
            {collector
              ? " Em equipe, este resumo mostra sua participação na coleta; sua produção individual permanece vinculada à parcela conferida."
              : ""}
          </Text>
        </>
      )}
      <TouchableOpacity
        accessibilityRole="button"
        style={s.button}
        disabled={busy}
        onPress={() => setRequest({ path: "/environmental-impact" })}
      >
        <Text style={s.buttonText}>Atualizar impacto</Text>
      </TouchableOpacity>
    </View>
  );
}
const s = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    padding: 18,
    gap: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DCE8E2",
    marginBottom: 18,
  },
  heading: { flexDirection: "row", gap: 10, alignItems: "center" },
  title: { fontSize: 20, fontWeight: "700", color: "#123C35" },
  text: { color: "#52685F", lineHeight: 20 },
  small: { fontSize: 12, color: "#52685F", lineHeight: 18 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: {
    flexGrow: 1,
    flexBasis: "45%",
    padding: 14,
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DCE8E2",
  },
  metric: {
    flexGrow: 1,
    flexBasis: "45%",
    padding: 14,
    gap: 8,
    borderRadius: 12,
    backgroundColor: "#F1F8F4",
  },
  value: { fontSize: 20, fontWeight: "800", color: "#123C35" },
  button: { backgroundColor: "#047857", padding: 14, borderRadius: 10 },
  buttonText: { color: "#fff", fontWeight: "700", textAlign: "center" },
});
