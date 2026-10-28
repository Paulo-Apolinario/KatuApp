import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Text, Linking } from "react-native";
import { residentialService } from "@/src/services/residentialService";
import { useResidentialData } from "@/src/hooks/useResidentialData";
import { ResidentialPage, ResidentialLoad } from "@/src/components/residential/ResidentialPage";
import { Action, Card, Notice } from "@/src/components/ui/Workspace";
import { residentialDate, residentialProgress, numberBR } from "@/src/utils/residential";
import { unitLabel } from "@/src/utils/materials";
export default function RequestDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useResidentialData(`request:${id}`, () => residentialService.detail(id || "")), r = state.data;
  const [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function cancel() { if (!r || busy) return; setBusy(true); setError(""); try { await residentialService.cancel(r.id); setConfirm(false); await state.load(); } catch (e: any) { setError(e.message); } finally { setBusy(false); } }
  async function contact(url: string) { try { await Linking.openURL(url); } catch { setError("Não foi possível abrir o contato neste aparelho."); } }
  return <ResidentialPage title="Acompanhar solicitação" back subtitle={r ? `Protocolo #${r.id.slice(-8).toUpperCase()}` : "Carregando seu atendimento"}>
    <ResidentialLoad {...state} retry={() => void state.load()} />
    {!!error && <Notice error text={error} />}
    {r && <>
      <Card><Text style={{ fontWeight: "700", color: "#17694F", fontSize: 20 }}>{residentialProgress(r)}</Text><Text>{r.cooperative.name}</Text><Text>Retirada: {r.pickupAddress || "Consulte a cooperativa"}</Text><Text>Preferência: {residentialDate(r.preferredDate)}</Text><Text>Confirmação: {r.scheduledDate ? residentialDate(r.scheduledDate) : "A cooperativa ainda não confirmou uma data."}</Text></Card>
      <Card><Text style={{ fontWeight: "700", fontSize: 18 }}>Linha do tempo</Text><Text>✓ Solicitação enviada · {residentialDate(r.createdAt)}</Text>
        {!!r.scheduledDate && <Text>✓ Atendimento programado · {residentialDate(r.scheduledDate)}</Text>}
        {r.collections.map(c => <Card key={c.id}>
          {[["Coleta iniciada", c.startedAt], ["Coletada em campo", c.collectedAt], ["Recebida pela cooperativa", c.receivedAt], ["Triagem iniciada", c.sortingStartedAt], ["Destinação concluída", c.completedAt], ["Coleta cancelada", c.cancelledAt]].filter(([, time]) => time).map(([label, time]) => <Text key={label}>✓ {label} · {residentialDate(time)}</Text>)}
          {c.status === "PENDING" && !c.startedAt && !c.collectedAt && <Text>Equipe organizada · aguardando início da coleta.</Text>}
          {["COLLECTED", "RECEIVED", "SORTING", "COMPLETED"].includes(c.status) && <Text>{["RECEIVED", "SORTING", "COMPLETED"].includes(c.status) ? "Massa registrada na cooperativa" : "Massa informada em campo (aguarda recebimento)"}: {numberBR(Number(c.totalWeightKg || 0))} kg</Text>}
          {c.collectionMaterials.map((m, i) => <Text key={`${m.nameSnapshot}-${i}`}>{m.nameSnapshot}: {numberBR(Number(m.quantity))} {unitLabel(m.unit)}</Text>)}
        </Card>)}
        {r.status === "CANCELLED" && <Notice text="Solicitação cancelada. Nenhuma nova retirada será gerada a partir deste pedido." />}
      </Card>
      <Card><Text style={{ fontWeight: "700", fontSize: 18 }}>Materiais solicitados</Text>{r.requestedMaterials.map((m, i) => <Text key={m.id || i}>{m.nameSnapshot} · {m.estimatedQuantity == null ? "Quantidade a conferir" : `${numberBR(Number(m.estimatedQuantity))} ${unitLabel(m.unit)} estimados`}</Text>)}{!!r.notes && <Notice text={`Observações: ${r.notes}`} />}</Card>
      <Action secondary label="Repetir esta solicitação" onPress={() => router.push({ pathname: "/(pf-tabs)/residential-request", params: { repeatId: r.id } })} />
      <Notice text="Repetir preenche endereço e materiais. Você escolherá uma nova data e revisará o pedido antes de enviar." />
      {(r.cooperative.phone || r.cooperative.email) && <Card><Text style={{ fontWeight: "700" }}>Fale com a cooperativa</Text>{!!r.cooperative.phone && <Action secondary label={`Ligar: ${r.cooperative.phone}`} onPress={() => void contact(`tel:${r.cooperative.phone!.replace(/\D/g, "")}`)} />}{!!r.cooperative.email && <Action secondary label="Enviar e-mail à cooperativa" onPress={() => void contact(`mailto:${r.cooperative.email}`)} />}</Card>}
      {r.status === "REQUESTED" && !r.collections.length && !state.cached && <Card><Text style={{ fontWeight: "700" }}>Precisa cancelar?</Text><Notice text="O cancelamento pelo morador só é permitido enquanto o pedido aguarda análise, antes de ser programado ou delegado." />{!confirm ? <Action secondary label="Cancelar solicitação" onPress={() => setConfirm(true)} /> : <><Notice text="Confirma o cancelamento deste pedido?" /><Action label="Confirmar cancelamento" onPress={() => void cancel()} busy={busy} /><Action secondary label="Manter solicitação" disabled={busy} onPress={() => setConfirm(false)} /></>}</Card>}
    </>}
  </ResidentialPage>;
}
