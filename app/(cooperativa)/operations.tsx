import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Pressable, Text } from "react-native";
import {
  collectionService,
  type Collection,
} from "@/src/services/collectionService";
import {
  Workspace,
  Card,
  Action,
  Field,
  Notice,
} from "@/src/components/ui/Workspace";
import { materialQuantity } from "@/src/utils/materials";
import { collectionOrigin } from "@/src/utils/collectionOrigin";
import { useConnectivity } from "@/src/hooks/useConnectivity";
const steps = {
  COLLECTED: {
    title: "Confirmar recebimento",
    help: "Confirme a chegada física e confira os materiais. Divergências devem ser descritas nas observações antes de continuar.",
  },
  RECEIVED: {
    title: "Iniciar triagem",
    help: "Confirme o início da conferência e separação dos materiais recebidos.",
  },
  SORTING: {
    title: "Concluir operação",
    help: "Confira todas as destinações no painel. Saldos pendentes ou reservas temporárias impedem o encerramento. Após concluir, as destinações ficam preservadas para consulta.",
  },
} as const;
export default function Operations() {
  const { isOffline } = useConnectivity();
  const [items, setItems] = useState<Collection[]>([]),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [target, setTarget] = useState<Collection | null>(null),
    [notes, setNotes] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [resolution, setResolution] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState(40);
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
  function updated(c: Collection) {
    setItems((old) => old.map((item) => (item.id === c.id ? c : item)));
    setTarget(null);
    setNotes("");
    setConfirmed(false);
  }
  async function transition() {
    if (!target || !confirmed || busy || isOffline) return;
    setBusy(true);
    setError("");
    try {
      const payload = {
        notes: [target.notes, notes.trim()].filter(Boolean).join("\n"),
      };
      const fn =
        target.status === "COLLECTED"
          ? collectionService.receive
          : target.status === "RECEIVED"
            ? collectionService.startSorting
            : collectionService.complete;
      updated(await fn(target.id, payload));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function resolve(c: Collection, id: string) {
    if (busy || isOffline) return;
    if ((resolution[id] || "").trim().length < 5) {
      setError("Descreva o tratamento com pelo menos cinco caracteres.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      updated(
        await collectionService.resolveIncident(c.id, id, resolution[id]),
      );
      setResolution((old) => ({ ...old, [id]: "" }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const filtered = items.filter(
    (c) =>
      (steps[c.status as keyof typeof steps] ||
        c.incidents?.some((i) => i.status === "OPEN")) &&
      `${c.id} ${collectionOrigin(c)?.name} ${c.incidents?.map((i) => i.description).join(" ")}`
        .toLocaleLowerCase("pt-BR")
        .includes(search.toLocaleLowerCase("pt-BR")),
  );
  return (
    <Workspace
      title="Recebimento e ocorrências"
      subtitle="Central da cooperativa: confira os materiais e registre cada etapa com responsabilidade."
    >
      {isOffline && (
        <Notice text="Sem conexão: dados locais para consulta. As confirmações operacionais exigem conexão com a API." />
      )}
      <Action
        secondary
        label="Atualizar operações"
        busy={loading}
        onPress={() => void load()}
      />
      <Field
        label="Buscar origem, protocolo ou ocorrência"
        value={search}
        onChangeText={setSearch}
      />
      {!!error && <Notice error text={error} />}{" "}
      {target ? (
        <Card>
          <Text style={{ fontWeight: "700", fontSize: 18 }}>
            {steps[target.status as keyof typeof steps]?.title}
          </Text>
          <Text>{collectionOrigin(target)?.name || target.id}</Text>
          <Notice
            text={steps[target.status as keyof typeof steps]?.help || ""}
          />
          {target.materials.map((m, i) => (
            <Text key={i}>
              {m.type}: {materialQuantity(m)}
            </Text>
          ))}
          <Field
            label="Observações da conferência"
            multiline
            value={notes}
            onChangeText={setNotes}
            maxLength={Math.max(0, 1900 - (target.notes?.length || 0))}
          />
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: confirmed }}
            onPress={() => setConfirmed((v) => !v)}
            style={{
              padding: 16,
              backgroundColor: confirmed ? "#DCFCE7" : "#F1F5F9",
              borderRadius: 10,
            }}
          >
            <Text>
              {confirmed ? "✓ " : ""}Conferi os dados e confirmo esta etapa
              operacional.
            </Text>
          </Pressable>
          <Action
            label="Registrar confirmação"
            disabled={!confirmed || isOffline}
            busy={busy}
            onPress={() => void transition()}
          />
          <Action
            secondary
            label="Voltar sem alterar"
            disabled={busy}
            onPress={() => setTarget(null)}
          />
        </Card>
      ) : (
        filtered.slice(0, visible).map((c) => (
          <Card key={c.id}>
            <Text style={{ fontWeight: "700", fontSize: 17 }}>
              {collectionOrigin(c)?.name || `Coleta ${c.id.slice(-8)}`}
            </Text>
            <Text>{collectionOrigin(c)?.address}</Text>
            <Notice text={`Protocolo: ${c.id}`} />
            {c.materials.map((m, i) => (
              <Text key={i}>
                {m.type}: {materialQuantity(m)}
              </Text>
            ))}
            {steps[c.status as keyof typeof steps] && (
              <Action
                label={steps[c.status as keyof typeof steps].title}
                disabled={busy || isOffline}
                onPress={() => {
                  setTarget(c);
                  setConfirmed(false);
                  setNotes("");
                }}
              />
            )}
            {c.incidents?.map((incident) => (
              <Card key={incident.id}>
                <Text style={{ fontWeight: "700" }}>
                  {incident.status === "OPEN"
                    ? "Ocorrência aguardando análise"
                    : "Ocorrência tratada"}
                </Text>
                <Text>{incident.description}</Text>
                <Notice
                  text={`${incident.reportedByName || "Responsável registrado"} · ${new Date(incident.createdAt).toLocaleString("pt-BR")}`}
                />
                {incident.status === "OPEN" ? (
                  <>
                    <Field
                      label="Tratamento realizado pela cooperativa"
                      value={resolution[incident.id] || ""}
                      onChangeText={(value) =>
                        setResolution((old) => ({
                          ...old,
                          [incident.id]: value,
                        }))
                      }
                      multiline
                      maxLength={2000}
                    />
                    <Action
                      secondary
                      label="Concluir tratamento da ocorrência"
                      disabled={busy || isOffline}
                      onPress={() => void resolve(c, incident.id)}
                    />
                  </>
                ) : (
                  <Notice
                    text={incident.resolution || "Tratamento registrado"}
                  />
                )}
              </Card>
            ))}
          </Card>
        ))
      )}
      {!target && filtered.length > visible && (
        <Action
          secondary
          label="Mostrar mais operações"
          onPress={() => setVisible((v) => v + 40)}
        />
      )}{" "}
      {!loading && !filtered.length && !target && (
        <Notice text="Nenhuma operação pendente para os filtros informados." />
      )}
    </Workspace>
  );
}
