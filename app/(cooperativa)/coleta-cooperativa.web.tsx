import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import * as Crypto from "expo-crypto";
import { useAuth } from "@/src/contexts/AuthContext";
import { api, ApiHttpError } from "@/src/services/api";
import { fieldService, FieldItem, fieldAddress, fieldDate, fieldLabels } from "@/src/services/cooperativeFieldService";
import { FieldPage, FieldInput, FieldButton, Pager, ui } from "@/src/components/cooperative/FieldUI";

type Intake = { id: string; status: string; generatorId?: string; intakeKind: string; createdAt: string; intakeOrigin?: { name?: string; performedBy?: string } };
export default function CooperativePickup() {
  const { user } = useAuth();
  return user?.id ? <PickupForm key={user.id} owner={user.id} /> : null;
}
function PickupForm({ owner }: { owner: string }) {
  const [mode, setMode] = useState<"GENERATOR" | "OTHER">("GENERATOR");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [directory, setDirectory] = useState<Awaited<ReturnType<typeof fieldService.list>> | null>(null);
  const [selected, setSelected] = useState<FieldItem | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [searchError, setSearchError] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [confirmed, setConfirmed] = useState<Intake | null>(null);
  const [recent, setRecent] = useState<Intake[]>([]);
  const [historyError, setHistoryError] = useState("");
  const guard = useRef(false);
  const pending = useRef<{ operationId: string; [key: string]: unknown } | null>(null);
  useEffect(() => {
    let alive = true;
    if (mode !== "GENERATOR") return;
    setLoading(true);
    const timer = setTimeout(() => {
      fieldService.list("generators", q, page).then(data => {
        if (alive) { setDirectory(data); setSearchError(""); }
      }).catch(e => { if (alive) { setSearchError(e.message); setDirectory(null); } })
        .finally(() => { if (alive) setLoading(false); });
    }, 250);
    return () => { alive = false; clearTimeout(timer); };
  }, [mode, q, page]);
  async function history() {
    try {
      const data = await api.get<{ items: Intake[] }>("/material-intakes", true);
      setRecent(data.items); setHistoryError("");
    } catch (e: any) { setHistoryError(e.message); }
  }
  useEffect(() => { void history(); }, []);
  async function save() {
    if (guard.current) return;
    if (!pending.current && ((mode === "GENERATOR" && !selected) || address.trim().length < 5)) {
      setError("Selecione o gerador, quando cadastrado, e informe o endereço da retirada."); return;
    }
    guard.current = true; setBusy(true); setError("");
    pending.current ||= {
      operationId: Crypto.randomUUID(), kind: "PICKUP", performedByCooperative: true,
      ...(mode === "GENERATOR" && selected ? { generatorId: selected.id } : {}),
      origin: { name: mode === "GENERATOR" ? selected?.name || "" : name.trim(), address: address.trim(), description: description.trim() },
      notes: notes.trim(),
    };
    try {
      const result = await api.post<{ collection: Intake }>("/material-intakes", pending.current, true, owner);
      if (!result.collection?.id) throw Error("Não foi possível confirmar o registro.");
      setConfirmed(result.collection); pending.current = null; setUncertain(false);
      await history();
    } catch (e: any) {
      if (e instanceof ApiHttpError && e.status >= 400 && e.status < 500) {
        pending.current = null; setUncertain(false); setError(e.message);
      } else {
        setUncertain(true);
        setError("A confirmação não chegou. Verifique a conexão e reenvie o mesmo registro pelo botão abaixo; ele não será duplicado.");
      }
    } finally { guard.current = false; setBusy(false); }
  }
  const editable = !busy && !uncertain;
  return <FieldPage title="Coleta efetuada pela cooperativa" subtitle="Registre uma retirada já realizada pela cooperativa, com ou sem gerador cadastrado.">
    <View style={ui.card}>
      <Text style={ui.muted}>A coleta ficará aguardando recebimento na sede. Pesagem e triagem continuam no painel. Este registro não atribui produção individual a um catador.</Text>
      {confirmed ? <>
        <Text accessibilityRole="alert" style={ui.heading}>Coleta registrada pela cooperativa</Text>
        <Text>Protocolo: {confirmed.id}</Text>
        <Text>Situação: aguardando recebimento na cooperativa.</Text>
        <FieldButton label="Registrar outra coleta" onPress={() => { setConfirmed(null); setSelected(null); setAddress(""); setName(""); setDescription(""); setNotes(""); }} />
      </> : <>
        <Text style={ui.heading}>De onde veio o material?</Text>
        <View style={ui.row}>
          <FieldButton label="Gerador cadastrado" secondary={mode !== "GENERATOR"} disabled={!editable} onPress={() => { setMode("GENERATOR"); setSelected(null); setAddress(""); setName(""); }} />
          <FieldButton label="Pessoa ou local sem cadastro" secondary={mode !== "OTHER"} disabled={!editable} onPress={() => { setMode("OTHER"); setSelected(null); setAddress(""); setName(""); }} />
        </View>
        {mode === "GENERATOR" ? <>
          <FieldInput label="Buscar gerador por nome ou local" value={q} editable={editable} onChangeText={v => { setQ(v); setPage(1); }} />
          {selected && <Text style={ui.heading}>Selecionado: {selected.name}</Text>}
          {loading && <Text>Buscando geradores...</Text>}
          {!!searchError && <Text accessibilityRole="alert">{searchError}</Text>}
          {!loading && !searchError && directory?.items.length === 0 && <Text>Nenhum gerador encontrado.</Text>}
          {!loading && !searchError && directory?.items.map(g => <FieldButton key={g.id} secondary={selected?.id !== g.id} label={[g.name, g.companyName, g.neighborhood].filter(Boolean).join(" · ")} disabled={!editable} onPress={() => { setSelected(g); const a = fieldAddress(g); setAddress(a === "Endereço não informado" ? "" : a); }} />)}
          {editable && !loading && !searchError && <Pager pagination={directory?.pagination} onPage={setPage} />}
        </> : <FieldInput label="Pessoa ou local (opcional)" value={name} maxLength={150} editable={editable} onChangeText={setName} />}
        <FieldInput label="Endereço onde a coleta foi efetuada *" value={address} maxLength={500} editable={editable} onChangeText={setAddress} />
        <FieldInput label="Descrição dos materiais (opcional)" value={description} maxLength={1500} editable={editable} onChangeText={setDescription} multiline />
        <FieldInput label="Observações (opcional)" value={notes} maxLength={3000} editable={editable} onChangeText={setNotes} multiline />
        {!!error && <Text accessibilityRole="alert">{error}</Text>}
        <FieldButton label={uncertain ? "Reenviar o mesmo registro" : "Registrar coleta efetuada"} busy={busy} disabled={!uncertain && ((mode === "GENERATOR" && !selected) || address.trim().length < 5)} onPress={() => void save()} />
      </>}
    </View>
    <View style={ui.card}>
      <Text style={ui.heading}>Últimas entradas e coletas da cooperativa</Text>
      <FieldButton label="Atualizar registros" secondary onPress={() => void history()} />
      {!!historyError && <Text accessibilityRole="alert">{historyError}</Text>}
      {recent.map(c => <View key={c.id} style={ui.card}>
        <Text style={ui.heading}>{c.intakeOrigin?.name || "Origem não identificada"}</Text>
        <Text>{c.intakeOrigin?.performedBy === "COOPERATIVE" ? "Coleta efetuada pela cooperativa" : c.intakeKind === "DIRECT" ? "Entrega direta na cooperativa" : "Coleta em endereço avulso"}</Text>
        <Text>{fieldLabels[c.status] || c.status} · {fieldDate(c.createdAt)}</Text>
        <Text style={ui.muted}>Protocolo: {c.id}</Text>
      </View>)}
      {!historyError && recent.length === 0 && <Text>Nenhum registro recente.</Text>}
    </View>
  </FieldPage>;
}
