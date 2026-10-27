import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { api } from "../../services/api";
type Impact = {
  start: string;
  end: string;
  collections: number;
  co2Kg: number | null;
  totalMassKg: number;
  coveredMassKg: number;
  coveragePercent: number;
  description: string;
  methodology?: { label?: string; source?: string; version?: string };
};
const num = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
export default function GeneratorImpact() {
  const day = new Date(Date.now() - 10800000).toISOString().slice(0, 10);
  const [start, setStart] = useState(day.slice(0, 4) + "-01-01"),
    [end, setEnd] = useState(day),
    [data, setData] = useState<Impact | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [range, setRange] = useState({ start, end });
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setBusy(true);
      setError("");
      setData(null);
      api
        .get<{ data: Impact }>(
          "/environmental-impact?" + new URLSearchParams(range).toString(),
          true,
        )
        .then((r) => {
          if (active) setData(r.data);
        })
        .catch((e) => {
          if (active)
            setError(
              e.message ||
                "Não foi possível consultar o impacto. Conecte-se à internet e tente novamente.",
            );
        })
        .finally(() => {
          if (active) setBusy(false);
        });
      return () => {
        active = false;
      };
    }, [range]),
  );
  return (
    <View
      style={{
        backgroundColor: "#fff",
        padding: 20,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "#DCE8E2",
        marginBottom: 18,
        gap: 10,
      }}
    >
      <Text style={{ fontSize: 20, fontWeight: "700", color: "#123C35" }}>
        Impacto ambiental estimado
      </Text>
      <Text style={{ color: "#52685F", lineHeight: 21 }}>
        Coletas concluídas no período. Fatores e metodologia informados pela sua
        cooperativa.
      </Text>
      <Text>De (AAAA-MM-DD)</Text>
      <TextInput
        accessibilityLabel="Início do período ambiental"
        value={start}
        onChangeText={setStart}
        maxLength={10}
        style={{
          borderWidth: 1,
          borderColor: "#CBD5CF",
          padding: 12,
          borderRadius: 10,
        }}
      />
      <Text>Até (AAAA-MM-DD)</Text>
      <TextInput
        accessibilityLabel="Fim do período ambiental"
        value={end}
        onChangeText={setEnd}
        maxLength={10}
        style={{
          borderWidth: 1,
          borderColor: "#CBD5CF",
          padding: 12,
          borderRadius: 10,
        }}
      />
      {busy && <ActivityIndicator color="#047857" />}
      {error ? (
        <Text accessibilityRole="alert" style={{ color: "#B91C1C" }}>
          {error}
        </Text>
      ) : null}
      {data && (
        <>
          <Text style={{ color: "#047857", fontWeight: "800", fontSize: 28 }}>
            {data.co2Kg == null
              ? "Sem fator aplicável"
              : `${num(data.co2Kg)} kg CO2e`}
          </Text>
          <Text>
            {data.collections} coletas concluídas · {num(data.totalMassKg)} kg
            consolidados
          </Text>
          <Text>
            Com fator: {num(data.coveredMassKg)} kg · cobertura{" "}
            {num(data.coveragePercent)}%
          </Text>
          <Text style={{ fontWeight: "600" }}>
            {data.methodology?.label || "Metodologia ainda não configurada"}
          </Text>
          <Text>
            Fonte: {data.methodology?.source || "não cadastrada"} · versão{" "}
            {data.methodology?.version || "não cadastrada"}
          </Text>
          <Text style={{ color: "#52685F", lineHeight: 20 }}>
            {data.description} Massa coletada não comprova reciclagem; rejeitos
            e outras destinações podem estar incluídos.
          </Text>
        </>
      )}
      <TouchableOpacity
        accessibilityRole="button"
        onPress={() => {
          setRange({ start, end });
        }}
        disabled={busy}
        style={{ backgroundColor: "#047857", padding: 13, borderRadius: 10 }}
      >
        <Text style={{ color: "#fff", textAlign: "center", fontWeight: "700" }}>
          Atualizar impacto
        </Text>
      </TouchableOpacity>
    </View>
  );
}
