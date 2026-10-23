import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Text } from "react-native";
import {
  collectionService,
  type Collection,
} from "@/src/services/collectionService";
import {
  Workspace,
  Card,
  Notice,
  Action,
  Field,
} from "@/src/components/ui/Workspace";
import { groupMaterials, materialQuantity } from "@/src/utils/materials";
const stages = {
  PENDING: "Delegadas",
  IN_PROGRESS: "Em execução",
  COLLECTED: "Aguardando recebimento",
  RECEIVED: "Recebidas",
  SORTING: "Em triagem",
  COMPLETED: "Encerradas",
  CANCELLED: "Canceladas",
} as const;
export default function Percentual() {
  const [items, setItems] = useState<Collection[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [month, setMonth] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await collectionService.list());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const filtered = useMemo(
    () =>
      items.filter(
        (item) =>
          !month ||
          (item.collectedAt || item.createdAt || "").slice(0, 7) === month,
      ),
    [items, month],
  );
  const units = groupMaterials(
    filtered
      .filter((item) =>
        ["COLLECTED", "RECEIVED", "SORTING", "COMPLETED"].includes(item.status),
      )
      .flatMap((item) => item.materials),
  );
  return (
    <Workspace
      title="Indicadores de coletas"
      subtitle="Execução em campo, recebimento e encerramento são etapas diferentes."
    >
      <Field
        label="Mês (AAAA-MM, opcional)"
        value={month}
        onChangeText={setMonth}
        placeholder="2026-10"
        maxLength={7}
      />
      {!!month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) && (
        <Notice error text="Informe um mês válido, por exemplo 2026-10." />
      )}
      {!!error && (
        <Notice
          error
          text={`${error} Os últimos dados carregados foram preservados.`}
        />
      )}
      <Action
        secondary
        label="Atualizar indicadores"
        busy={loading}
        onPress={() => void load()}
      />
      <Card>
        <Text style={{ fontWeight: "700" }}>Etapas operacionais</Text>
        {Object.entries(stages).map(([key, label]) => (
          <Text key={key} style={{ paddingVertical: 6 }}>
            {label}: {filtered.filter((item) => item.status === key).length}
          </Text>
        ))}
      </Card>
      <Card>
        <Text style={{ fontWeight: "700" }}>
          Materiais registrados em campo
        </Text>
        {units.length ? (
          units.map((item) => (
            <Text key={`${item.type}:${item.unit}`}>
              {item.type}: {materialQuantity(item)}
            </Text>
          ))
        ) : (
          <Notice text="Nenhum material registrado no período." />
        )}
        <Notice text="Essas quantidades são de coleta, não saldo disponível de estoque. Litros e unidades não são convertidos em quilogramas." />
      </Card>
    </Workspace>
  );
}
