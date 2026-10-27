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
type Summary = {
  month?: string;
  collections: number;
  totalMassKg: number;
  confirmedMassKg: number;
  provisionalMassKg: number;
  co2Kg: number | null;
  waterLiters: number | null;
  energyKwh: number | null;
  treesEquivalent: number | null;
  coveragePercent: number;
  coveredMassKg: number;
  metricCoverage: Record<string, number>;
  requests: number;
  pendingRequests?: number;
  extraOrders: number;
  pendingExtraOrders?: number;
};
type Impact = Summary & {
  year: number;
  scope: string;
  monthly: Summary[];
  description: string;
  methodology?: { label?: string; source?: string; version?: string };
};
const num = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const label = (m: string) =>
  new Date(m + "-15T12:00:00-03:00").toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "America/Fortaleza",
  });
export default function GeneratorImpact({
  collector = false,
}: {
  collector?: boolean;
}) {
  const { user } = useAuth();
  const [month, setMonth] = useState(
      new Date(Date.now() - 10800000).toISOString().slice(0, 7),
    ),
    [showHistory, setShowHistory] = useState(!collector),
    [data, setData] = useState<Impact | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [request, setRequest] = useState({
      year: new Date(Date.now() - 10800000).toISOString().slice(0, 4),
    });
  const year = month.slice(0, 4);
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
        .get<{ data: Impact }>(
          "/environmental-impact?year=" + request.year,
          true,
        )
        .then((r) => {
          if (active) setData(r.data);
        })
        .catch((e) => {
          if (active)
            setError(
              e.message ||
                "Conecte-se à internet para consultar o histórico mensal.",
            );
        })
        .finally(() => {
          if (active) setBusy(false);
        });
      return () => {
        active = false;
      };
    }, [request, user?.id]),
  );
  function move(delta: number) {
    const d = new Date(month + "-15T12:00:00Z");
    d.setUTCMonth(d.getUTCMonth() + delta);
    if (d.getUTCFullYear() >= 2000 && d.getUTCFullYear() <= 2100) {
      const value = d.toISOString().slice(0, 7);
      setMonth(value);
      if (value.slice(0, 4) !== year) setRequest({ year: value.slice(0, 4) });
    }
  }
  const selected = data?.monthly.find((m) => m.month === month);
  return (
    <View style={s.card}>
      <View style={s.heading}>
        <Ionicons name="leaf-outline" size={25} color="#047857" />
        <Text style={s.title}>
          {collector ? "Resumo ambiental mensal" : "Impacto ambiental mensal"}
        </Text>
      </View>
      <Text style={s.text}>
        {collector
          ? "Coletas em que você participou, incluindo equipes. Sua produção individual continua separada."
          : "Todas as suas coletas realizadas, acompanhadas mês a mês."}
      </Text>
      <View style={s.navigation}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Mês anterior"
          style={s.arrow}
          onPress={() => move(-1)}
        >
          <Ionicons name="chevron-back" size={22} color="#047857" />
        </TouchableOpacity>
        <Text style={s.month}>{label(month)}</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Próximo mês"
          style={s.arrow}
          onPress={() => move(1)}
        >
          <Ionicons name="chevron-forward" size={22} color="#047857" />
        </TouchableOpacity>
      </View>
      {busy && <ActivityIndicator color="#047857" />}
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: "#B91C1C" }}>
          {error}
        </Text>
      )}
      {selected && (
        <>
          <Text style={s.mass}>
            {num(selected.totalMassKg)} kg coletados no mês
          </Text>
          <Text style={s.text}>
            {selected.collections} coletas realizadas ·{" "}
            {num(selected.confirmedMassKg)} kg consolidados ·{" "}
            {num(selected.provisionalMassKg)} kg aguardando conferência
          </Text>
          <View style={s.grid}>
            {(
              [
                ["CO₂ estimado", "co2Kg", "kg CO2e", "leaf-outline"],
                ["Água estimada", "waterLiters", "L", "water-outline"],
                ["Energia estimada", "energyKwh", "kWh", "flash-outline"],
                ["Árvores equivalentes", "treesEquivalent", "", "leaf-outline"],
              ] as const
            ).map(([name, key, unit, icon]) => (
              <View style={s.metric} key={key}>
                <Ionicons name={icon} size={22} color="#047857" />
                <Text style={s.text}>{name}</Text>
                <Text style={s.value}>
                  {selected[key] == null
                    ? "Não configurado"
                    : `${num(selected[key])} ${unit}`.trim()}
                </Text>
                <Text style={s.small}>
                  Massa com fator: {num(selected.metricCoverage[key] || 0)} kg
                </Text>
              </View>
            ))}
          </View>
          <Text style={s.text}>
            Solicitações registradas: {selected.requests} · pendentes de
            atendimento: {selected.pendingRequests || 0}
          </Text>
          <Text style={s.text}>
            O.C.s registradas: {selected.extraOrders} · em análise:{" "}
            {selected.pendingExtraOrders || 0}
          </Text>
          <Text style={s.small}>
            Solicitações e O.C.s são mostradas separadamente. Previsões de peso
            e pedidos ainda não coletados não entram no impacto.
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={
              showHistory ? "Ocultar histórico mensal" : "Ver histórico mensal"
            }
            onPress={() => setShowHistory((v) => !v)}
          >
            <Text style={s.subtitle}>
              {showHistory ? "▾" : "▸"} Histórico mensal · {year}
            </Text>
          </TouchableOpacity>
          {showHistory &&
            data?.monthly.map((m) => (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Consultar ${label(m.month!)}`}
                onPress={() => setMonth(m.month!)}
                key={m.month}
                style={[
                  s.history,
                  m.month === month && { backgroundColor: "#E7F4ED" },
                ]}
              >
                <Text style={s.historyMonth}>
                  {label(m.month!).split(" de ")[0]}
                </Text>
                <Text>
                  {m.collections} coletas · {num(m.totalMassKg)} kg
                </Text>
              </TouchableOpacity>
            ))}
          <Text style={s.value}>
            Acumulado de {year}: {num(data!.totalMassKg)} kg
          </Text>
          <Text style={s.small}>
            {data?.methodology?.label ||
              "Fatores ambientais ainda não configurados pela cooperativa."}
            {data?.methodology?.source
              ? ` · Fonte: ${data.methodology.source} · versão ${data.methodology.version}`
              : ""}
          </Text>
          <Text style={s.small}>
            {data?.description} Valores estimados não comprovam reciclagem nem
            crédito ambiental.
          </Text>
        </>
      )}
      <TouchableOpacity
        accessibilityRole="button"
        style={s.button}
        disabled={busy}
        onPress={() => setRequest({ year })}
      >
        <Text style={s.buttonText}>Atualizar impacto mensal</Text>
      </TouchableOpacity>
    </View>
  );
}
const s = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#DCE8E2",
    borderRadius: 18,
    padding: 18,
    gap: 12,
    marginBottom: 18,
  },
  heading: { flexDirection: "row", gap: 10, alignItems: "center" },
  title: { fontSize: 20, fontWeight: "700", color: "#123C35", flexShrink: 1 },
  text: { color: "#52685F", lineHeight: 21 },
  small: { fontSize: 12, color: "#52685F", lineHeight: 18 },
  navigation: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 6,
  },
  arrow: {
    padding: 10,
    borderWidth: 1,
    borderColor: "#DCE8E2",
    borderRadius: 12,
  },
  month: {
    fontWeight: "700",
    fontSize: 17,
    color: "#123C35",
    textTransform: "capitalize",
    flexShrink: 1,
    textAlign: "center",
  },
  mass: { fontSize: 24, color: "#047857", fontWeight: "800" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: {
    flexGrow: 1,
    flexBasis: "45%",
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#F2F8F5",
    gap: 6,
  },
  value: { fontSize: 17, fontWeight: "700", color: "#123C35" },
  subtitle: { fontSize: 17, fontWeight: "700", color: "#123C35", marginTop: 8 },
  history: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    padding: 12,
    borderRadius: 8,
    borderBottomWidth: 1,
    borderColor: "#E9EFEB",
    flexWrap: "wrap",
  },
  historyMonth: { color: "#123C35", textTransform: "capitalize" },
  button: { backgroundColor: "#047857", padding: 14, borderRadius: 10 },
  buttonText: { color: "#fff", textAlign: "center", fontWeight: "700" },
});
