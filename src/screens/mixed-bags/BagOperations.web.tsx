import { useCallback, useRef, useState } from "react";
import { Text, View, Switch } from "react-native";
import * as Crypto from "expo-crypto";
import { api } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import {
  FieldButton,
  FieldInput,
  LoadState,
  useFieldData,
  ui,
} from "../../components/cooperative/FieldUI";
const today = () => new Date(Date.now() - 10800000).toISOString().slice(0, 10);
const kg = (v: any) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(
    Number(v || 0),
  ) + " kg";
const date = (v: string) =>
  new Date(v).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" });
function useOperation() {
  const { user } = useAuth(),
    guard = useRef(false),
    identity = useRef<any>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function send(
    path: string,
    body: any,
    done: () => void,
    refreshOnError = true,
  ) {
    if (guard.current || !user) return;
    guard.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    const key = JSON.stringify({ path, ...body });
    if (identity.current?.key !== key)
      identity.current = { key, id: Crypto.randomUUID() };
    try {
      await api.post(
        path,
        { ...body, operationId: identity.current.id },
        true,
        user.id,
      );
      setMessage("Operação registrada. Consulte o histórico atualizado.");
      done();
    } catch (e: any) {
      setError(e.message);
      if (refreshOnError) done();
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  return { busy, error, message, send };
}
function Feedback({ op }: { op: any }) {
  return (
    <>
      {!!op.error && (
        <Text accessibilityRole="alert" style={{ color: "#b42318" }}>
          {op.error}
        </Text>
      )}
      {!!op.message && (
        <Text accessibilityRole="alert" style={ui.badge}>
          {op.message}
        </Text>
      )}
    </>
  );
}
export function ReverseWeighing({
  bag,
  manager,
  onSaved,
}: {
  bag: any;
  manager: boolean;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false),
    [eventId, setEventId] = useState(""),
    [notes, setNotes] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  const op = useOperation(),
    eligible = bag.events.filter(
      (e: any) => e.kind === "SORT" && !e.reversedAt,
    );
  if (!manager || !eligible.length || bag.status === "CANCELLED") return null;
  return (
    <View style={ui.card}>
      <FieldButton
        secondary
        label={
          open ? "Ocultar correção de pesagem" : "Corrigir pesagem confirmada"
        }
        onPress={() => setOpen((v) => !v)}
      />
      {open && (
        <>
          <Text style={ui.body}>
            O estorno integral devolve a pesagem e seus rejeitos ao saldo da
            bag. Depois registre a pesagem correta. O original fica no
            histórico. Uma bag concluída será reaberta.
          </Text>
          <Text style={ui.muted}>
            Lotes com histórico de saída, reserva ou processamento são
            bloqueados. Complementações podem precisar ser estornadas primeiro.
            Dias fechados precisam ser reabertos em Fechamento e alertas.
          </Text>
          {eligible.map((e: any) => (
            <FieldButton
              secondary={eventId !== e.id}
              key={e.id}
              disabled={op.busy}
              label={`${date(e.createdAt)} · ${e.outputs.map((o: any) => `${o.materialName}: ${kg(o.quantityKg)}`).join(", ") || "Somente rejeitos"} · rejeitos ${kg(e.rejectedKg)}`}
              onPress={() => {
                setEventId(e.id);
                setConfirmed(false);
              }}
            />
          ))}
          <FieldInput
            label="Justificativa do estorno"
            value={notes}
            onChangeText={setNotes}
            editable={!op.busy}
            multiline
            maxLength={1500}
          />
          <View style={ui.row}>
            <Switch
              accessibilityLabel="Conferi e confirmo o estorno integral"
              value={confirmed}
              onValueChange={setConfirmed}
              disabled={op.busy}
            />
            <Text style={ui.body}>Conferi e confirmo o estorno integral.</Text>
          </View>
          <Feedback op={op} />
          {!!op.error && (
            <FieldButton
              secondary
              label="Atualizar bag antes de tentar novamente"
              onPress={onSaved}
            />
          )}
          <FieldButton
            label="Confirmar estorno da pesagem"
            busy={op.busy}
            disabled={!confirmed || !eventId || notes.trim().length < 5}
            onPress={() =>
              void op.send(
                `/mixed-bags/${bag.id}/reverse`,
                { eventId, expectedVersion: bag.version, notes },
                onSaved,
                false,
              )
            }
          />
        </>
      )}
    </View>
  );
}
export default function BagOperations({
  openBag,
}: {
  openBag: (id: string) => void;
}) {
  const [day, setDay] = useState(today()),
    [notes, setNotes] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [hours, setHours] = useState(48),
    [page, setPage] = useState(1);
  const op = useOperation();
  const daily = useFieldData(
    useCallback(
      () =>
        api.get<any>("/mixed-bags/day?day=" + encodeURIComponent(day), true),
      [day],
    ),
  );
  const alerts = useFieldData(
    useCallback(
      () =>
        api.get<any>(`/mixed-bags/alerts?hours=${hours}&page=${page}`, true),
      [hours, page],
    ),
  );
  const d = daily.data,
    shown = d?.status === "CLOSED" ? d.snapshot : d?.preview;
  return (
    <>
      <View style={ui.card}>
        <Text style={ui.heading}>Alertas de bags paradas</Text>
        <Text style={ui.muted}>
          Bags com saldo pendente e sem novos registros pelo intervalo
          escolhido. É uma referência operacional, não um prazo de atraso. A
          lista muda na próxima atualização após novo registro ou conclusão.
        </Text>
        <View style={ui.row}>
          {[24, 48, 72, 168, 720].map((h) => (
            <FieldButton
              key={h}
              label={`${h} horas`}
              secondary={h !== hours}
              onPress={() => {
                setHours(h);
                setPage(1);
              }}
            />
          ))}
        </View>
        <FieldButton
          secondary
          label="Atualizar alertas"
          onPress={alerts.refresh}
        />
        <LoadState resource={alerts} />
        {alerts.data && (
          <>
            <Text style={ui.heading}>
              {alerts.data.total} bag(s) · {kg(alerts.data.pendingKg)} por triar
            </Text>
            {alerts.data.items.map((b: any) => (
              <View key={b.id} style={{ gap: 6, paddingVertical: 10 }}>
                <Text style={ui.body}>
                  {b.code} · {b.originLabel}
                </Text>
                <Text style={ui.badge}>
                  {kg(b.pendingKg)} · sem registro há {b.idleHours} horas
                </Text>
                <Text style={ui.small}>
                  Último registro: {date(b.lastActivity)}
                </Text>
                <FieldButton
                  secondary
                  label={`Abrir ${b.code}`}
                  onPress={() => openBag(b.id)}
                />
              </View>
            ))}
            {!alerts.data.items.length && (
              <Text style={ui.body}>Nenhuma bag parada nesta seleção.</Text>
            )}
            <View style={ui.row}>
              <FieldButton
                secondary
                label="Alertas anteriores"
                disabled={page <= 1}
                onPress={() => setPage((v) => v - 1)}
              />
              <Text>
                {page}/{alerts.data.totalPages}
              </Text>
              <FieldButton
                secondary
                label="Próximos alertas"
                disabled={page >= alerts.data.totalPages}
                onPress={() => setPage((v) => v + 1)}
              />
            </View>
          </>
        )}
      </View>
      <View style={ui.card}>
        <Text style={ui.heading}>Fechamento diário da produção</Text>
        <Text style={ui.muted}>
          Pesagens válidas lançadas no dia, no horário de Fortaleza. Não fecha o
          estoque nem impede destinações. Novas pesagens e estornos de um dia
          fechado exigem reabertura pelo gestor.
        </Text>
        <FieldInput
          label="Dia da produção (AAAA-MM-DD)"
          value={day}
          editable={!op.busy}
          onChangeText={(v) => {
            setDay(v);
            setConfirmed(false);
          }}
        />
        <FieldButton
          secondary
          label="Atualizar resumo do dia"
          disabled={op.busy}
          onPress={daily.refresh}
        />
        <LoadState resource={daily} />
        {d && shown && (
          <>
            <Text style={ui.heading}>
              {d.status === "CLOSED"
                ? "Produção fechada"
                : "Produção em aberto"}{" "}
              · versão {d.version}
            </Text>
            <Text style={ui.body}>
              {kg(shown.sortedKg)} separados · {kg(shown.rejectedKg)} de
              rejeitos · {shown.operations} pesagens · {shown.bags} bags
            </Text>
            {shown.materials.map((m: any) => (
              <Text key={m.itemId} style={ui.body}>
                {m.name}: {kg(m.quantityKg)}
              </Text>
            ))}
            <Text style={ui.muted}>
              Participação coletiva: não some os pesos das pessoas como produção
              individual.
            </Text>
            {shown.participants.map((p: any) => (
              <Text key={p.id} style={ui.small}>
                {p.name} · {p.operations} pesagens · {kg(p.collectiveKg)}
              </Text>
            ))}
            {d.manager ? (
              <>
                <FieldInput
                  label={
                    d.status === "CLOSED"
                      ? "Justificativa da reabertura"
                      : "Observação da conferência (opcional)"
                  }
                  value={notes}
                  onChangeText={setNotes}
                  editable={!op.busy}
                  multiline
                  maxLength={1500}
                />
                <View style={ui.row}>
                  <Switch
                    accessibilityLabel="Confirmo a conferência do dia"
                    disabled={op.busy}
                    value={confirmed}
                    onValueChange={setConfirmed}
                  />
                  <Text style={ui.body}>
                    {d.status === "CLOSED"
                      ? "Confirmo a reabertura justificada."
                      : "Conferi os totais e confirmo o fechamento."}
                  </Text>
                </View>
                <Feedback op={op} />
                <FieldButton
                  label={
                    d.status === "CLOSED"
                      ? "Reabrir produção do dia"
                      : "Fechar produção do dia"
                  }
                  busy={op.busy}
                  disabled={
                    daily.loading ||
                    !confirmed ||
                    (d.status === "CLOSED" && notes.trim().length < 5) ||
                    d.day !== day
                  }
                  onPress={() =>
                    void op.send(
                      `/mixed-bags/day/${d.day}/${d.status === "CLOSED" ? "reopen" : "close"}`,
                      {
                        expectedVersion: d.version,
                        notes,
                        ...(d.status === "OPEN"
                          ? { expectedFingerprint: d.preview.fingerprint }
                          : {}),
                      },
                      () => {
                        daily.refresh();
                        setConfirmed(false);
                      },
                    )
                  }
                />
              </>
            ) : (
              <Text style={ui.muted}>
                Somente o gestor pode fechar ou reabrir a produção.
              </Text>
            )}
            <Text style={ui.heading}>Histórico de conferências</Text>
            {d.actions.map((a: any) => (
              <View key={a.id} style={{ gap: 6, paddingVertical: 10 }}>
                <Text style={ui.badge}>
                  {a.kind === "CLOSE" ? "Fechamento" : "Reabertura"} · versão{" "}
                  {a.snapshot.version}
                </Text>
                <Text style={ui.small}>
                  {date(a.createdAt)} · {a.actorName}
                </Text>
                <Text style={ui.body}>{a.notes}</Text>
                <Text style={ui.muted}>
                  Resumo preservado: {kg(a.snapshot.production.sortedKg)}{" "}
                  separados · {kg(a.snapshot.production.rejectedKg)} de rejeitos
                  · {a.snapshot.production.operations} pesagens
                </Text>
              </View>
            ))}
            {!d.actions.length && (
              <Text style={ui.muted}>Nenhuma conferência para este dia.</Text>
            )}
          </>
        )}
      </View>
    </>
  );
}
