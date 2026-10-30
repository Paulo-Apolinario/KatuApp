import { useActiveReadRefresh } from "@/src/hooks/useActiveReadRefresh";
import { useCallback, useRef, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Image, Text, View } from "react-native";
import {
  Workspace,
  Card,
  Field,
  Action,
  Notice,
} from "../../components/ui/Workspace";
import {
  extraOrderService,
  newExtraId,
} from "../../services/extraOrderService";
import { useAuth } from "../../contexts/AuthContext";
import { useConnectivity } from "../../hooks/useConnectivity";
import { routeService } from "../../services/routeService";
import { parseFortalezaDateTime } from "../../utils/dateTime";
import { materialQuantity } from "../../utils/materials";
import {
  orderStatusLabel,
  extraEventLabel,
  reasonLabel,
  custodyLabel,
  type ExtraOrder,
  type ExtraContext,
} from "../../types/extraOrder";
import ExtraOrderForm from "./ExtraOrderForm";
export default function ExtraOrdersScreen() {
  const { user } = useAuth(),
    cooperative = user?.role === "COOPERATIVE",
    { isOffline } = useConnectivity(),
    params = useLocalSearchParams<{ routeId?: string; create?: string; orderId?: string }>();
  const [orders, setOrders] = useState<ExtraOrder[]>([]),
    [context, setContext] = useState<ExtraContext | null>(null),
    [selected, setSelected] = useState<ExtraOrder | null>(null),
    [editing, setEditing] = useState<ExtraOrder | null>(null),
    [form, setForm] = useState(params.create === "1"),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState(""),
    [offlineData, setOfflineData] = useState(false),
    [page, setPage] = useState(1),
    [hasMore, setHasMore] = useState(false);
  const [notes, setNotes] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [custody, setCustody] = useState("COLLECTOR"),
    [custodyNotes, setCustodyNotes] = useState(""),
    [receiveDate, setReceiveDate] = useState(
      new Date().toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza" }),
    ),
    [receiveTime, setReceiveTime] = useState(
      new Date().toLocaleTimeString("pt-BR", {
        timeZone: "America/Fortaleza",
        hour: "2-digit",
        minute: "2-digit",
      }),
    ),
    [driverId, setDriverId] = useState(""),
    [vehicleId, setVehicleId] = useState(""),
    [scheduleDate, setScheduleDate] = useState("");
  const guard = useRef(false),
    operations = useRef(new Map<string, string>());
  const load = useCallback(
    async (next = 1) => {
      setLoading(true);
      setError("");
      try {
        const r = await extraOrderService.list(next);
        setOrders((old) =>
          next === 1
            ? r.orders
            : [
                ...new Map(
                  [...old, ...r.orders].map((o) => [o.id, o]),
                ).values(),
              ],
        );
        setPage(next);
        setHasMore(r.hasMore);
        setOfflineData(r.offline);
        try {
          const c = await extraOrderService.context();
          if (c) setContext(c);
          else if (user?.collector?.cooperativeId) {
            let routes: ExtraContext["routes"] = [];
            try {
              routes = (await routeService.list()).map((r) => ({
                id: r.id,
                name: r.name,
                status: r.status,
              }));
            } catch {}
            setContext({
              cooperative: {
                id: user.collector.cooperativeId,
                name: "Cooperativa vinculada ao seu cadastro",
              },
              collectorId: user.collector.id,
              generators: [],
              routes,
              schedules: [],
              catalog: [],
              drivers: [],
              vehicles: [],
            });
          }
        } catch (e: any) {
          setError(
            `Ordens carregadas. Não foi possível atualizar os cadastros de apoio: ${e.message}`,
          );
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    },
    [user?.collector?.cooperativeId, user?.collector?.id],
  );
  useActiveReadRefresh(load, loading || busy || !!selected || form);
  const linkedOrder = useRef<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      void load();
      if (user?.role === "COLLECTOR" && params.orderId && linkedOrder.current !== params.orderId) {
        linkedOrder.current = params.orderId;
        void extraOrderService.get(params.orderId).then(setSelected).catch((e: Error) => setError(e.message));
      }
    }, [load, params.orderId, user?.role]),
  );
  async function open(o: ExtraOrder) {
    setError("");
    if (o.status === "DRAFT") {
      setEditing(o);
      setForm(true);
      return;
    }
    setBusy(true);
    try {
      setSelected(await extraOrderService.get(o.id));
      setConfirmed(false);
      setNotes("");
      setDriverId("");
      setVehicleId("");
      setCustody(o.custody);
      setCustodyNotes(o.custodyNotes);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function operation(body: unknown) {
    const key = JSON.stringify(body);
    if (!operations.current.has(key)) operations.current.set(key, newExtraId());
    return operations.current.get(key)!;
  }
  async function act(action: "ACCEPT" | "NEEDS_INFO" | "REJECT" | "RECEIVE") {
    if (!selected || guard.current) return;
    if (isOffline || offlineData) {
      setError(
        "Atualize online antes de registrar a análise ou o recebimento.",
      );
      return;
    }
    if (!confirmed || notes.trim().length < 5) {
      setError(
        "Confirme a conferência e descreva a decisão com pelo menos cinco caracteres.",
      );
      return;
    }
    if (action === "REJECT" && custodyNotes.trim().length < 5) {
      setError("Registre o encaminhamento e onde o material está.");
      return;
    }
    const receivedAt = parseFortalezaDateTime(receiveDate, receiveTime);
    if (action === "RECEIVE" && !receivedAt) {
      setError("Informe a data e o horário reais do recebimento.");
      return;
    }
    const scheduledDate = scheduleDate
      ? parseFortalezaDateTime(scheduleDate, "12:00")
      : undefined;
    if (scheduleDate && !scheduledDate) {
      setError("Informe uma data de programação válida.");
      return;
    }
    guard.current = true;
    setBusy(true);
    setError("");
    try {
      const base =
        action === "RECEIVE"
          ? { receivedAt, notes: notes.trim() }
          : {
              expectedRevision: selected.revision,
              decision: action,
              notes: notes.trim(),
              ...(action === "REJECT"
                ? { custody, custodyNotes: custodyNotes.trim() }
                : {}),
              ...(action === "ACCEPT"
                ? {
                    driverId: driverId || undefined,
                    vehicleId: vehicleId || undefined,
                    scheduledDate,
                  }
                : {}),
            };
      const body = {
        ...base,
        operationId: operation({ id: selected.id, ...base }),
      };
      const updated =
        action === "RECEIVE"
          ? await extraOrderService.receive(selected.id, body)
          : await extraOrderService.review(selected.id, body);
      setSelected(updated);
      setConfirmed(false);
      setNotes("");
      setMessage("Operação confirmada pela cooperativa.");
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  if (form)
    return (
      <ExtraOrderForm
        key={editing?.id || "new"}
        context={context}
        initialOrder={editing || undefined}
        contextRouteId={params.routeId}
        onClose={() => {
          setForm(false);
          setEditing(null);
          void load();
        }}
        onSaved={(o) => {
          setForm(false);
          setEditing(null);
          setSelected(o);
          setMessage(
            o.syncStatus && o.syncStatus !== "SYNCED"
              ? "O.C. salva no aparelho. Aguarde a confirmação de envio; ainda pode não estar visível à cooperativa."
              : "O.C. registrada na cooperativa para análise.",
          );
          void load();
        }}
      />
    );
  const filtered = orders.filter(
    (o) =>
      (!filter || o.status === filter) &&
      `${o.id} ${o.reporterName} ${o.payload.originName} ${o.payload.pickupAddress} ${o.routeNameSnapshot}`
        .toLocaleLowerCase("pt-BR")
        .includes(search.toLocaleLowerCase("pt-BR")),
  );
  return (
    <Workspace
      title="Ordens de coleta extras"
      subtitle={
        cooperative
          ? "Analise relatos e solicitações fora do planejamento, mantendo o recebimento físico separado da decisão administrativa."
          : "Registre solicitações e coletas extras, inclusive paradas fora dos pontos programados da rota."
      }
    >
      {(isOffline || offlineData) && (
        <Notice text="Consulta local. Ordens novas podem aguardar envio; a análise e o recebimento exigem conexão." />
      )}
      {!cooperative && (
        <Action
          label="Abrir nova O.C."
          onPress={() => {
            setSelected(null);
            setEditing(null);
            setForm(true);
          }}
        />
      )}
      <Action
        secondary
        busy={loading}
        disabled={busy}
        label="Atualizar ordens e sincronização"
        onPress={() =>
          void extraOrderService
            .sync(user?.role === "COOPERATIVE" ? undefined : { manual: true })
            .then(() => load())
            .then(async () => {
              if (selected) {
                const updated = await extraOrderService.get(selected.id);
                setSelected(updated);
                setMessage(
                  updated.status === "LOCAL_PENDING"
                    ? "A ordem continua aguardando envio. Confira a conexão e a pendência."
                    : "Protocolo atualizado na cooperativa.",
                );
              }
            })
            .catch((e) => setError(e.message))
        }
      />
      {!!message && <Notice text={message} />}{" "}
      {!!error && <Notice error text={error} />}{" "}
      {selected ? (
        <>
          <Action
            secondary
            label="Voltar à lista de ordens"
            onPress={() => setSelected(null)}
          />
          <Card>
            <Text style={{ fontSize: 19, fontWeight: "600" }}>
              {selected.payload.originName}
            </Text>
            <Notice text={`Protocolo: ${selected.id}`} />
            <Notice text={orderStatusLabel(selected.status)} />
            {!!selected.syncError && (
              <Notice error text={`Envio pendente: ${selected.syncError}`} />
            )}
            {selected.syncStatus === "ERROR" && (
              <Action
                secondary
                label="Corrigir envio não confirmado"
                onPress={() =>
                  void extraOrderService
                    .recoverFailed(selected.id)
                    .then((draft) => {
                      setEditing(draft);
                      setForm(true);
                    })
                    .catch((e) => setError(e.message))
                }
              />
            )}
            <Text>
              {selected.payload.mode === "COLLECTED"
                ? "Coleta já realizada"
                : "Atendimento solicitado"}{" "}
              · {reasonLabel(selected.payload.reason)}
            </Text>
            <Text>{selected.payload.pickupAddress}</Text>
            <Text>
              Contato: {selected.payload.contactPhone || "Não informado"}
            </Text>
            <Text>Motivo: {selected.payload.reasonNotes}</Text>
            <Text>
              Rota de contexto:{" "}
              {selected.routeNameSnapshot ||
                context?.routes.find(
                  (r) => r.id === selected.payload.contextRouteId,
                )?.name ||
                "Sem rota vinculada"}
            </Text>
            <Text>
              Realização:{" "}
              {selected.payload.occurredAt
                ? new Date(selected.payload.occurredAt).toLocaleString(
                    "pt-BR",
                    { timeZone: "America/Fortaleza" },
                  )
                : "Ainda não realizada"}
            </Text>
            <Text>
              Registro na cooperativa:{" "}
              {selected.status === "LOCAL_PENDING"
                ? "Aguardando envio"
                : new Date(selected.createdAt).toLocaleString("pt-BR")}
            </Text>
            <Text>
              Recebimento confirmado:{" "}
              {selected.receivedAt
                ? new Date(selected.receivedAt).toLocaleString("pt-BR")
                : "Ainda não confirmado"}
            </Text>
            <Text>
              Guarda: {custodyLabel(selected.custody)} · {selected.custodyNotes}
            </Text>
            {selected.payload.materials.map((m, i) => (
              <Text key={i}>
                {m.nameSnapshot ||
                  m.proposedMaterial?.name ||
                  context?.catalog.find((c) => c.id === m.wasteTypeId)?.name ||
                  "Material do catálogo"}
                :{" "}
                {m.quantity == null
                  ? "Estimativa não informada"
                  : materialQuantity(m as any)}
              </Text>
            ))}
            {selected.payload.photos?.map((uri, i) => (
              <Image
                key={i}
                source={{ uri }}
                accessibilityLabel={`Evidência ${i + 1}`}
                style={{ height: 180, width: "100%" }}
                resizeMode="contain"
              />
            ))}
            {selected.collection && (
              <>
                <Notice
                  text={`Coleta vinculada: ${selected.collection.id} · ${selected.collection.status}`}
                />
                <Action
                  secondary
                  label={
                    cooperative
                      ? "Abrir recebimento e triagem"
                      : "Abrir minhas coletas"
                  }
                  onPress={() =>
                    router.push(
                      cooperative
                        ? "/(cooperativa)/operations"
                        : "/(catador)/collect",
                    )
                  }
                />
              </>
            )}
            {!cooperative && selected.status === "NEEDS_INFO" && (
              <Action
                label="Complementar e reenviar O.C."
                onPress={() => {
                  setEditing(selected);
                  setForm(true);
                }}
              />
            )}
            {selected.events?.map((e) => (
              <View
                key={e.id}
                style={{
                  paddingVertical: 10,
                  borderTopWidth: 1,
                  borderTopColor: "#E2E8F0",
                }}
              >
                <Text style={{ fontWeight: "600" }}>
                  {extraEventLabel(e.kind)} · {e.actorName}
                </Text>
                <Text>{new Date(e.createdAt).toLocaleString("pt-BR")}</Text>
                <Text>{e.notes}</Text>
              </View>
            ))}
          </Card>
          {cooperative &&
            (["PENDING_REVIEW", "NEEDS_INFO"].includes(selected.status) ||
              (selected.payload.mode === "COLLECTED" &&
                !selected.receivedAt &&
                selected.status !== "REJECTED")) && (
              <Card>
                <Field
                  label="Observações da análise ou conferência"
                  value={notes}
                  onChangeText={setNotes}
                  maxLength={2000}
                  multiline
                />
                <Action
                  secondary
                  label={
                    confirmed
                      ? "Conferência confirmada"
                      : "Conferi o relato e os dados desta operação"
                  }
                  onPress={() => setConfirmed((v) => !v)}
                />
                {["PENDING_REVIEW", "NEEDS_INFO"].includes(selected.status) && (
                  <>
                    <Field
                      label="Programar para (DD/MM/AAAA, opcional)"
                      value={scheduleDate}
                      onChangeText={setScheduleDate}
                      maxLength={10}
                    />
                    <Text>
                      Motorista e veículo para a coleta vinculada (opcionais)
                    </Text>
                    <Action
                      secondary
                      label="Sem recursos definidos"
                      onPress={() => {
                        setDriverId("");
                        setVehicleId("");
                      }}
                    />
                    {context?.drivers.map((d) => (
                      <Action
                        key={d.id}
                        secondary={driverId !== d.id}
                        label={d.name}
                        onPress={() => setDriverId(d.id)}
                      />
                    ))}
                    {context?.vehicles.map((v) => (
                      <Action
                        key={v.id}
                        secondary={vehicleId !== v.id}
                        label={v.plate}
                        onPress={() => {
                          setVehicleId(v.id);
                          if (v.driverId) setDriverId(v.driverId);
                        }}
                      />
                    ))}
                    <Action
                      label="Aceitar O.C. e vincular coleta"
                      disabled={!confirmed || busy || isOffline || offlineData}
                      onPress={() => void act("ACCEPT")}
                    />
                    <Action
                      secondary
                      label="Solicitar complementação ao catador"
                      disabled={!confirmed || busy || isOffline || offlineData}
                      onPress={() => void act("NEEDS_INFO")}
                    />
                    <Text>Encaminhamento obrigatório para recusar</Text>
                    {(
                      ["ORIGIN", "COLLECTOR", "COOPERATIVE", "OTHER"] as const
                    ).map((c) => (
                      <Action
                        key={c}
                        secondary={custody !== c}
                        label={custodyLabel(c)}
                        onPress={() => setCustody(c)}
                      />
                    ))}
                    <Field
                      label="Onde está o material e qual encaminhamento foi dado"
                      value={custodyNotes}
                      onChangeText={setCustodyNotes}
                      maxLength={1000}
                    />
                    <Action
                      secondary
                      label="Recusar com justificativa e encaminhamento"
                      disabled={!confirmed || busy || isOffline || offlineData}
                      onPress={() => void act("REJECT")}
                    />
                  </>
                )}
                {selected.payload.mode === "COLLECTED" &&
                  !selected.receivedAt &&
                  selected.status !== "REJECTED" && (
                    <>
                      <Notice text="O recebimento pode ser registrado antes da análise. Não cria estoque nem aprova a O.C." />
                      <Field
                        label="Data real do recebimento (DD/MM/AAAA)"
                        value={receiveDate}
                        onChangeText={setReceiveDate}
                        maxLength={10}
                      />
                      <Field
                        label="Horário real do recebimento (HH:MM)"
                        value={receiveTime}
                        onChangeText={setReceiveTime}
                        maxLength={5}
                      />
                      <Action
                        label="Confirmar recebimento físico da O.C."
                        disabled={
                          !confirmed || busy || isOffline || offlineData
                        }
                        onPress={() => void act("RECEIVE")}
                      />
                    </>
                  )}
              </Card>
            )}
        </>
      ) : (
        <>
          <Field
            label="Buscar protocolo, origem, endereço ou catador"
            value={search}
            onChangeText={setSearch}
          />
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {[
              "",
              "LOCAL_PENDING",
              "PENDING_REVIEW",
              "NEEDS_INFO",
              "ACCEPTED",
              "REJECTED",
            ].map((s) => (
              <Action
                key={s}
                secondary={filter !== s}
                label={s ? orderStatusLabel(s) : "Todas"}
                onPress={() => setFilter(s)}
              />
            ))}
          </View>
          {filtered.map((o) => (
            <Card key={o.id}>
              <Text style={{ fontSize: 17, fontWeight: "600" }}>
                {o.payload.originName || "Rascunho sem nome"}
              </Text>
              <Notice text={orderStatusLabel(o.status)} />
              <Text>{o.payload.pickupAddress}</Text>
              <Text>
                {reasonLabel(o.payload.reason)} ·{" "}
                {o.routeNameSnapshot || "Sem rota de contexto"}
              </Text>
              <Text>{o.reporterName}</Text>
              <Notice text={`Protocolo: ${o.id}`} />
              {!!o.syncError && <Notice error text={o.syncError} />}
              <Action
                secondary
                label={
                  o.status === "DRAFT" ? "Continuar rascunho" : "Abrir ordem"
                }
                disabled={busy}
                onPress={() => void open(o)}
              />
            </Card>
          ))}
          {!loading && !filtered.length && (
            <Notice text="Nenhuma ordem encontrada nesta consulta." />
          )}
          {hasMore && (
            <Action
              secondary
              label="Carregar mais ordens"
              busy={loading}
              onPress={() => void load(page + 1)}
            />
          )}
        </>
      )}
    </Workspace>
  );
}
