import { useCallback, useRef, useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import { api } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { useDurableDraft } from "../../hooks/useDurableDraft";
import {
  FieldPage,
  FieldButton,
  FieldInput,
  LoadState,
  useFieldData,
  ui,
} from "../../components/cooperative/FieldUI";
const uuid = () => Crypto.randomUUID();
const n = (v: unknown) => Number(String(v || "0").replace(",", "."));
const kg = (v: unknown) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(n(v)) +
  " kg";
const labels: Record<string, string> = {
  WAITING: "Aguardando triagem",
  SORTING: "Em triagem",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
  RECEIVE: "Recebimento",
  SORT: "Pesagem da triagem",
  CLOSE: "Triagem concluída",
  ADJUST: "Ajuste de pesagem",
  CANCEL: "Cancelamento",
};
const read = (path: string) => api.get<any>(path, true);
function Weight({
  label,
  value,
  set,
}: {
  label: string;
  value: string;
  set: (v: string) => void;
}) {
  return (
    <FieldInput
      label={label}
      value={value}
      onChangeText={set}
      keyboardType="decimal-pad"
    />
  );
}
function Receive({
  context,
  owner,
  saved,
}: {
  context: any;
  owner: string;
  saved: (id: string) => void;
}) {
  const [form, setForm] = useState({
    operationId: uuid(),
    grossKg: "",
    tareKg: "0",
    originLabel: "",
    externalTag: "",
    collectionId: "",
    generatorIds: [] as string[],
    storageLocation: "",
    notes: "",
  });
  const draft = useDurableDraft(
    "mixed-bag-receive",
    "Recebimento de bag misturada",
    form,
    (v) => setForm((f) => ({ ...f, ...v })),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const guard = useRef(false);
  const set = (key: string, value: any) =>
    setForm((f) => ({ ...f, [key]: value }));
  async function submit() {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await api.post<any>(
        "/mixed-bags",
        {
          ...form,
          grossKg: n(form.grossKg),
          tareKg: n(form.tareKg),
          collectionId: form.collectionId || undefined,
          externalTag: form.externalTag || undefined,
        },
        true,
        owner,
      );
      await draft.clear();
      saved(result.bag.id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  return (
    <View style={ui.card}>
      <Text style={ui.heading}>Receber bag misturada</Text>
      <Text style={ui.muted}>
        Registre material ainda não recebido. Uma coleta já pesada não deve ser
        recebida novamente.
      </Text>
      <Weight
        label="Peso bruto, incluindo a bag (kg)"
        value={form.grossKg}
        set={(v) => set("grossKg", v)}
      />
      <Weight
        label="Tara — bag vazia (kg)"
        value={form.tareKg}
        set={(v) => set("tareKg", v)}
      />
      <Text style={ui.heading}>
        Peso líquido: {kg(Math.max(0, n(form.grossKg) - n(form.tareKg)))}
      </Text>
      <FieldInput
        label="Origem / descrição da retirada"
        value={form.originLabel}
        onChangeText={(v) => set("originLabel", v)}
        maxLength={200}
      />
      <FieldInput
        label="Identificação na bag (opcional)"
        value={form.externalTag}
        onChangeText={(v) => set("externalTag", v)}
        maxLength={60}
      />
      <FieldInput
        label="Local de armazenamento (opcional)"
        value={form.storageLocation}
        onChangeText={(v) => set("storageLocation", v)}
        maxLength={100}
      />
      <Text style={ui.body}>Coleta ou recebimento existente (opcional)</Text>
      <FieldButton
        secondary={!!form.collectionId}
        label="Novo recebimento"
        disabled={busy}
        onPress={() => set("collectionId", "")}
      />
      {context.collections.map((c: any) => (
        <FieldButton
          key={c.id}
          secondary={form.collectionId !== c.id}
          disabled={busy}
          label={`${form.collectionId === c.id ? "Selecionado: " : ""}${c.intakeKind === "MIXED_BAG" ? "Bags" : "Coleta sem peso"} · ${c.generator?.name || c.route?.name || c.id.slice(-8)}`}
          onPress={() => set("collectionId", c.id)}
        />
      ))}
      <Text style={ui.body}>Geradores de origem (opcional)</Text>
      <Text style={ui.muted}>
        Várias origens são preservadas sem inventar uma divisão do peso.
      </Text>
      <OriginChoices
        people={context.generators}
        selected={form.generatorIds}
        set={(v) => set("generatorIds", v)}
        disabled={busy}
      />
      <FieldInput
        label="Observações (opcional)"
        value={form.notes}
        onChangeText={(v) => set("notes", v)}
        maxLength={1500}
        multiline
      />
      {!!draft.error && <Text accessibilityRole="alert">{draft.error}</Text>}
      {!!error && (
        <>
          <Text accessibilityRole="alert">{error}</Text>
          <FieldButton
            secondary
            label="Conferir este protocolo"
            onPress={() => saved(form.operationId)}
          />
        </>
      )}
      <Text style={ui.muted}>
        É necessária conexão para confirmar. O rascunho fica neste aparelho,
        vinculado à sua conta.
      </Text>
      <FieldButton
        label="Confirmar recebimento da bag"
        busy={busy}
        disabled={
          !draft.ready ||
          draft.saving ||
          !!draft.error ||
          n(form.grossKg) <= n(form.tareKg) ||
          form.originLabel.trim().length < 2
        }
        onPress={() => void submit()}
      />
    </View>
  );
}
function OriginChoices({
  people,
  selected,
  set,
  disabled,
}: {
  people: any[];
  selected: string[];
  set: (v: string[]) => void;
  disabled: boolean;
}) {
  const [search, setSearch] = useState("");
  const filtered = people
    .filter(
      (p) =>
        selected.includes(p.id) ||
        (search.length >= 2 &&
          `${p.name} ${p.companyName || ""}`
            .toLowerCase()
            .includes(search.toLowerCase())),
    )
    .slice(0, 30);
  return (
    <>
      <FieldInput
        label="Buscar gerador pelo nome"
        value={search}
        onChangeText={setSearch}
      />
      {filtered.map((p) => (
        <FieldButton
          key={p.id}
          disabled={disabled}
          secondary={!selected.includes(p.id)}
          label={`${selected.includes(p.id) ? "✓ " : ""}${p.companyName || p.name}`}
          onPress={() =>
            set(
              selected.includes(p.id)
                ? selected.filter((id) => id !== p.id)
                : [...selected, p.id],
            )
          }
        />
      ))}
      <Text style={ui.small}>Digite pelo menos duas letras para buscar.</Text>
    </>
  );
}
function Sorting({
  bag,
  context,
  owner,
  saved,
}: {
  bag: any;
  context: any;
  owner: string;
  saved: () => void;
}) {
  const empty = () => ({
    operationId: uuid(),
    expectedVersion: bag.version,
    itemId: "",
    itemName: "",
    quantityKg: "",
    lotId: "",
    expectedLotVersion: undefined as number | undefined,
    rejectedKg: "",
    participantIds: [] as string[],
    notes: "",
  });
  const [form, setForm] = useState(empty),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const guard = useRef(false);
  const draft = useDurableDraft(
    "mixed-bag-sort:" + bag.id,
    "Triagem · " + bag.code,
    form,
    (v) => setForm((f) => ({ ...f, ...v })),
  );
  const set = (key: string, value: any) =>
    setForm((f) => ({ ...f, [key]: value }));
  const catalog = useFieldData(
    useCallback(
      () => read("/mixed-bags/catalog?search=" + encodeURIComponent(query)),
      [query],
    ),
  );
  const lots = useFieldData(
    useCallback(
      () =>
        form.itemId
          ? read("/mixed-bags/lots?itemId=" + encodeURIComponent(form.itemId))
          : Promise.resolve({ lots: [] }),
      [form.itemId],
    ),
  );
  const recorded = bag.events.some(
    (e: any) => e.operationId === form.operationId,
  );
  async function submit() {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await api.post<any>(
        `/mixed-bags/${bag.id}/sort`,
        {
          operationId: form.operationId,
          expectedVersion: form.expectedVersion,
          outputs: form.itemId
            ? [
                {
                  itemId: form.itemId,
                  quantityKg: n(form.quantityKg),
                  lotId: form.lotId || undefined,
                  expectedLotVersion: form.expectedLotVersion,
                },
              ]
            : [],
          rejectedKg: n(form.rejectedKg),
          participantIds: form.participantIds,
          notes: form.notes,
        },
        true,
        owner,
      );
      setForm({ ...empty(), expectedVersion: result.bag.version });
      saved();
      lots.refresh();
    } catch (e: any) {
      setError(e.message);
      saved();
      lots.refresh();
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  return (
    <View style={ui.card}>
      <Text style={ui.heading}>Registrar material separado</Text>
      <Text style={ui.muted}>
        Uma pesagem por material. O restante pode ser triado depois. Confirme
        somente os pesos lidos na balança.
      </Text>
      <FieldInput
        label="Buscar material no catálogo"
        value={search}
        onChangeText={setSearch}
      />
      <FieldButton
        secondary
        label="Buscar material"
        onPress={() => setQuery(search)}
      />
      <LoadState resource={catalog} />
      <Text style={ui.body}>Material: {form.itemName || "Apenas rejeito"}</Text>
      <FieldButton
        secondary={!form.itemId}
        label="Registrar apenas rejeito"
        disabled={busy}
        onPress={() =>
          setForm((f) => ({
            ...f,
            itemId: "",
            itemName: "",
            lotId: "",
            expectedLotVersion: undefined,
          }))
        }
      />
      {catalog.data?.items.map((m: any) => (
        <FieldButton
          key={m.id}
          secondary={form.itemId !== m.id}
          label={m.name}
          disabled={busy}
          onPress={() =>
            setForm((f) => ({
              ...f,
              itemId: m.id,
              itemName: m.name,
              lotId: "",
              expectedLotVersion: undefined,
            }))
          }
        />
      ))}
      {catalog.data?.limited && (
        <Text style={ui.small}>
          Use a busca para encontrar outros materiais.
        </Text>
      )}
      {!!form.itemId && (
        <>
          <Weight
            label="Peso separado (kg)"
            value={form.quantityKg}
            set={(v) => set("quantityKg", v)}
          />
          <LoadState resource={lots} />
          <FieldButton
            secondary={!!form.lotId}
            label="Criar novo lote deste material"
            disabled={busy}
            onPress={() =>
              setForm((f) => ({
                ...f,
                lotId: "",
                expectedLotVersion: undefined,
              }))
            }
          />
          {lots.data?.lots.map((l: any) => (
            <FieldButton
              key={l.id}
              secondary={form.lotId !== l.id}
              disabled={busy}
              label={`Complementar ${l.lotCode || l.code} · ${kg(l.availableQuantity)}`}
              onPress={() =>
                setForm((f) => ({
                  ...f,
                  lotId: l.id,
                  expectedLotVersion: l.version,
                }))
              }
            />
          ))}
        </>
      )}
      <Weight
        label="Rejeitos identificados (kg, opcional)"
        value={form.rejectedKg}
        set={(v) => set("rejectedKg", v)}
      />
      <Text style={ui.body}>Equipe participante</Text>
      {context.people.map((p: any) => {
        const selected =
          p.id === context.collectorId || form.participantIds.includes(p.id);
        return (
          <FieldButton
            key={p.id}
            secondary={!selected}
            disabled={busy || p.id === context.collectorId}
            label={`${selected ? "✓ " : ""}${p.name}`}
            onPress={() =>
              set(
                "participantIds",
                selected
                  ? form.participantIds.filter((id) => id !== p.id)
                  : [...form.participantIds, p.id],
              )
            }
          />
        );
      })}
      <Text style={ui.muted}>
        Lançamento por {context.actorName}. Participação não divide os quilos
        entre as pessoas.
      </Text>
      <FieldInput
        label="Observações / descrição dos rejeitos"
        value={form.notes}
        onChangeText={(v) => set("notes", v)}
        multiline
        maxLength={1500}
      />
      {recorded ? (
        <>
          <Text style={ui.badge}>
            Esta pesagem já está registrada no histórico.
          </Text>
          <FieldButton
            secondary
            label="Iniciar próxima pesagem"
            onPress={() => setForm(empty())}
          />
        </>
      ) : (
        bag.version !== form.expectedVersion && (
          <>
            <Text accessibilityRole="alert">
              O saldo mudou. Confira o histórico e os pesos antes de prosseguir.
            </Text>
            <FieldButton
              secondary
              label="Revisar com o saldo atual"
              onPress={() => set("expectedVersion", bag.version)}
            />
          </>
        )
      )}
      {!!draft.error && <Text accessibilityRole="alert">{draft.error}</Text>}
      {!!error && <Text accessibilityRole="alert">{error}</Text>}
      <FieldButton
        label="Confirmar pesagem da triagem"
        busy={busy}
        disabled={
          recorded ||
          !draft.ready ||
          draft.saving ||
          !!draft.error ||
          bag.version !== form.expectedVersion ||
          (!context.collectorId && !form.participantIds.length) ||
          (!form.itemId && n(form.rejectedKg) <= 0) ||
          (!!form.itemId && n(form.quantityKg) <= 0) ||
          (n(form.rejectedKg) > 0 && form.notes.trim().length < 3)
        }
        onPress={() => void submit()}
      />
    </View>
  );
}
function Detail({
  bag,
  context,
  owner,
  refresh,
}: {
  bag: any;
  context: any;
  owner: string;
  refresh: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const guard = useRef(false),
    closeId = useRef(uuid());
  const open = ["WAITING", "SORTING"].includes(bag.status);
  async function close() {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setError("");
    try {
      await api.post(
        `/mixed-bags/${bag.id}/close`,
        { operationId: closeId.current, expectedVersion: bag.version },
        true,
        owner,
      );
      refresh();
    } catch (e: any) {
      setError(e.message);
      refresh();
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <View style={ui.card}>
        <Text style={ui.heading}>{bag.code}</Text>
        <Text style={ui.badge}>{labels[bag.status]}</Text>
        <Text style={ui.body}>{bag.originLabel}</Text>
        <Text style={ui.muted}>
          {bag.externalTag ? "Bag: " + bag.externalTag : ""}{" "}
          {bag.storageLocation || ""}
        </Text>
        {[
          ["Bruto", bag.grossKg],
          ["Tara", bag.tareKg],
          ["Líquido recebido", bag.netKg],
          ["Separado em lotes", bag.sortedKg],
          ["Rejeitos", bag.rejectedKg],
          ["Ainda por triar", bag.remainingKg],
        ].map(([label, value]) => (
          <Text key={label} style={ui.body}>
            {label}: {kg(value)}
          </Text>
        ))}
        <Text style={ui.muted}>
          O peso recebido e os lotes separados são etapas do mesmo material. Não
          devem ser somados.
        </Text>
      </View>
      {open && (
        <Sorting
          key={bag.id}
          bag={bag}
          context={context}
          owner={owner}
          saved={refresh}
        />
      )}
      {open && n(bag.remainingKg) === 0 && (
        <FieldButton
          label="Concluir triagem da bag"
          busy={busy}
          onPress={() => void close()}
        />
      )}
      {!!error && <Text accessibilityRole="alert">{error}</Text>}
      {context.manager && open && (
        <Text style={ui.muted}>
          Ajustes de bruto/tara e cancelamento justificado estão disponíveis no
          painel web da cooperativa, em Triagem e bags.
        </Text>
      )}
      <View style={ui.card}>
        <Text style={ui.heading}>Histórico da bag</Text>
        {bag.events.map((e: any) => (
          <View key={e.id} style={{ gap: 5, paddingVertical: 10 }}>
            <Text style={ui.badge}>
              {labels[e.kind] || e.kind} · {e.actorName}
            </Text>
            <Text style={ui.small}>
              {new Date(e.createdAt).toLocaleString("pt-BR", {
                timeZone: "America/Fortaleza",
              })}
            </Text>
            {e.outputs.map((o: any) => (
              <Text key={o.id} style={ui.body}>
                {o.materialName} · {kg(o.quantityKg)} · {o.lotCode}
              </Text>
            ))}
            {n(e.rejectedKg) > 0 && (
              <Text style={ui.body}>Rejeitos: {kg(e.rejectedKg)}</Text>
            )}
            {e.participantSnapshot?.length > 0 && (
              <Text style={ui.muted}>
                Equipe:{" "}
                {e.participantSnapshot.map((p: any) => p.name).join(", ")}
              </Text>
            )}
            {!!e.notes && <Text style={ui.muted}>{e.notes}</Text>}
          </View>
        ))}
      </View>
    </>
  );
}
export default function MixedBags() {
  const { user, signOut } = useAuth();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  const collector = user?.role === "COLLECTOR",
    base = collector
      ? "/(catador)/triagem-lotes"
      : "/(cooperativa)/triagem-bags",
    home = collector ? "/(catador)/homecat" : "/(cooperativa)/home";
  const [receive, setReceive] = useState(false),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("ALL"),
    [page, setPage] = useState(1);
  const context = useFieldData(
    useCallback(() => read("/mixed-bags/context"), [user?.id]),
  );
  const resource = useFieldData(
    useCallback(
      () =>
        read(
          id
            ? "/mixed-bags/" + encodeURIComponent(id)
            : `/mixed-bags?status=${status}&search=${encodeURIComponent(query)}&page=${page}`,
        ),
      [id, status, query, page, user?.id],
    ),
  );
  const go = (bagId: string) => {
    setReceive(false);
    router.push({ pathname: base as any, params: { id: bagId } });
  };
  if (!user)
    return (
      <FieldPage title="Triagem e lotes" homeHref={home}>
        <Text style={ui.body}>
          Entre na sua conta para registrar a operação.
        </Text>
      </FieldPage>
    );
  return (
    <FieldPage
      title="Triagem e lotes"
      subtitle="Receba bags misturadas e registre os materiais separados na balança."
      homeHref={home}
    >
      <View style={ui.card}>
        <Text style={ui.badge}>
          Responsável: {context.data?.actorName || user.displayName}
        </Text>
        <Text style={ui.small}>
          Use a conta de quem está fazendo o lançamento.
        </Text>
        <FieldButton
          secondary
          label={collector ? "Trocar catador" : "Sair da conta"}
          onPress={() => void signOut()}
        />
      </View>
      <LoadState resource={context} />
      <LoadState resource={resource} />
      {context.data &&
        (id ? (
          <>
            {resource.data?.bag && (
              <Detail
                bag={resource.data.bag}
                context={context.data}
                owner={user.id}
                refresh={resource.refresh}
              />
            )}
            <FieldButton
              secondary
              label="Lista de bags"
              onPress={() => router.replace(base as any)}
            />
          </>
        ) : (
          <>
            <FieldButton
              label={
                receive ? "Voltar à lista de bags" : "Receber bag misturada"
              }
              onPress={() => setReceive((v) => !v)}
            />
            {receive ? (
              <Receive
                key={user.id}
                context={context.data}
                owner={user.id}
                saved={go}
              />
            ) : (
              <>
                <FieldInput
                  label="Buscar bag por código ou origem"
                  value={search}
                  onChangeText={setSearch}
                />
                <FieldButton
                  secondary
                  label="Buscar bags"
                  onPress={() => {
                    setPage(1);
                    setQuery(search);
                  }}
                />
                <View style={ui.row}>
                  {Object.entries({
                    ALL: "Todas",
                    WAITING: "Aguardando",
                    SORTING: "Em triagem",
                    COMPLETED: "Concluídas",
                  }).map(([value, label]) => (
                    <FieldButton
                      key={value}
                      label={label}
                      secondary={status !== value}
                      onPress={() => {
                        setStatus(value);
                        setPage(1);
                      }}
                    />
                  ))}
                </View>
                <FieldButton
                  secondary
                  label="Atualizar bags"
                  onPress={resource.refresh}
                />
                {resource.data?.summary && (
                  <View style={ui.card}>
                    <Text style={ui.body}>
                      Recebido: {kg(resource.data.summary.receivedKg)}
                    </Text>
                    <Text style={ui.body}>
                      Separado: {kg(resource.data.summary.sortedKg)}
                    </Text>
                    <Text style={ui.body}>
                      Rejeitos: {kg(resource.data.summary.rejectedKg)}
                    </Text>
                    <Text style={ui.heading}>
                      Por triar: {kg(resource.data.summary.pendingKg)}
                    </Text>
                  </View>
                )}
                {resource.data?.items.map((b: any) => (
                  <View key={b.id} style={ui.card}>
                    <Text style={ui.heading}>{b.code}</Text>
                    <Text style={ui.badge}>{labels[b.status]}</Text>
                    <Text style={ui.body}>{b.originLabel}</Text>
                    <Text style={ui.muted}>
                      Líquido {kg(b.netKg)} · por triar {kg(b.remainingKg)}
                    </Text>
                    <FieldButton label="Abrir bag" onPress={() => go(b.id)} />
                  </View>
                ))}
                {resource.data?.items.length === 0 && (
                  <Text style={ui.body}>Nenhuma bag nesta seleção.</Text>
                )}
                {resource.data?.pagination && (
                  <View style={ui.row}>
                    <FieldButton
                      secondary
                      label="Anterior"
                      disabled={page === 1}
                      onPress={() => setPage((v) => v - 1)}
                    />
                    <Text style={ui.muted}>
                      {page} / {resource.data.pagination.totalPages}
                    </Text>
                    <FieldButton
                      secondary
                      label="Próxima"
                      disabled={page >= resource.data.pagination.totalPages}
                      onPress={() => setPage((v) => v + 1)}
                    />
                  </View>
                )}
              </>
            )}
          </>
        ))}
    </FieldPage>
  );
}
