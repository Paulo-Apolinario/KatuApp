import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Text, View, Pressable } from "react-native";
import { api } from "@/src/services/api";
import { residentialService, ResidentialSubmission, ResidentialRequest } from "@/src/services/residentialService";
import { useResidentialData } from "@/src/hooks/useResidentialData";
import { wasteCatalogService } from "@/src/services/wasteCatalogService";
import * as Location from "@/src/services/deviceLocation";
import { useAuth } from "@/src/contexts/AuthContext";
import { Card, Field, Action, Notice } from "@/src/components/ui/Workspace";
import { ResidentialPage } from "@/src/components/residential/ResidentialPage";
import OperationalMap from "@/src/components/maps/OperationalMap";
import { parseFortalezaDateTime } from "@/src/utils/dateTime";
import { maskDate, maskTime, residentialDate, separationTip, decimalValue } from "@/src/utils/residential";
import { unitLabel } from "@/src/utils/materials";
import type { WasteCatalogItem, WasteUnit } from "@/src/types/collection";
import type { RequestedScheduleMaterialInput } from "@/src/types/schedule";
type Cooperative = { id: string; name: string; city?: string; state?: string; address?: string };
export default function ResidentialSchedule() {
  const params = useLocalSearchParams<{ cooperativeId?: string; repeatId?: string }>(), { user } = useAuth();
  const overview = useResidentialData("overview", residentialService.overview, { live: false });
  const [repeatRevision, setRepeatRevision] = useState(0), [repeatMaterials, setRepeatMaterials] = useState<ResidentialRequest["requestedMaterials"]>([]);
  const [step, setStep] = useState(1), [coops, setCoops] = useState<Cooperative[]>([]), [coopId, setCoopId] = useState(params.cooperativeId || ""), [coopSearch, setCoopSearch] = useState("");
  const [catalog, setCatalog] = useState<WasteCatalogItem[]>([]), [selection, setSelection] = useState<Record<string, string>>({}), [search, setSearch] = useState(""), [category, setCategory] = useState(""), [visible, setVisible] = useState(30);
  const [address, setAddress] = useState(user?.personProfile?.address || ""), [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [date, setDate] = useState(""), [time, setTime] = useState(""), [notes, setNotes] = useState(""), [proposed, setProposed] = useState(""), [proposalUnit, setProposalUnit] = useState<WasteUnit>("KG");
  const [coopLoading, setCoopLoading] = useState(false), [catalogLoading, setCatalogLoading] = useState(false), [saving, setSaving] = useState(false), [gpsBusy, setGpsBusy] = useState(false), [error, setError] = useState("");
  const [pending, setPending] = useState<Awaited<ReturnType<typeof residentialService.pendingSubmission>>>(null), [draftReady, setDraftReady] = useState(false);
  const guard = useRef(false), prefill = useRef<ResidentialRequest["requestedMaterials"] | null>(null), identity = useRef(user?.id); identity.current = user?.id;
  const loadCoops = useCallback(async () => { setCoopLoading(true); try { const r = await api.get<{ cooperatives: Cooperative[] } | Cooperative[]>("/cooperatives", true); setCoops(Array.isArray(r) ? r : r.cooperatives || []); } catch (e: any) { setError(e.message); } finally { setCoopLoading(false); } }, []);
  useFocusEffect(useCallback(() => { void loadCoops(); }, [loadCoops]));
  useEffect(() => {
    let alive = true; setDraftReady(false);
    if (!user?.id) return;
    const id = user.id;
    void (async () => {
      try {
        const p = await residentialService.pendingSubmission(id);
        if (!alive) return; setPending(p);
        if (!p && params.repeatId) {
          const r = await residentialService.detail(params.repeatId);
          if (!alive) return;
          prefill.current = r.requestedMaterials;
          setRepeatRevision(v => v + 1);
          setCoopId(r.cooperative.id); setAddress(r.pickupAddress || ""); setPosition(r.pickupLatitude != null && r.pickupLongitude != null ? { latitude: r.pickupLatitude, longitude: r.pickupLongitude } : null);
          setProposed(""); setNotes(r.notes || ""); setDate(""); setTime(""); setStep(1);
        }
      } catch (e: any) { if (alive) setError(e.message); } finally { if (alive) setDraftReady(true); }
    })(); return () => { alive = false; };
  }, [user?.id, params.repeatId]);
  useEffect(() => {
    let alive = true; setCatalog([]); setSelection({}); setRepeatMaterials([]); setCategory(""); setVisible(30);
    if (!coopId) return;
    setCatalogLoading(true);
    void wasteCatalogService.list(coopId).then(rows => { if (alive) { setCatalog(rows); if (prefill.current) { setSelection(Object.fromEntries(prefill.current.filter(m => m.wasteTypeId && rows.some(i => i.id === m.wasteTypeId)).map(m => [m.wasteTypeId!, m.estimatedQuantity == null ? "" : String(m.estimatedQuantity)]))); setRepeatMaterials(prefill.current.filter(m => !m.wasteTypeId || !rows.some(i => i.id === m.wasteTypeId))); prefill.current = null; } } }).catch(e => { if (alive) setError(e.message); }).finally(() => { if (alive) setCatalogLoading(false); });
    return () => { alive = false; };
  }, [coopId, repeatRevision]);
  const filtered = useMemo(() => catalog.filter(i => (!category || i.category === category) && i.name.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"))), [catalog, category, search]);
  function materials(): RequestedScheduleMaterialInput[] {
    const rows = catalog.filter(i => Object.hasOwn(selection, i.id)).map(i => {
      const raw = selection[i.id], amount = raw.trim() ? decimalValue(raw) : undefined;
      if (amount === null || amount === 0) throw Error(`Informe uma estimativa positiva para ${i.name} ou deixe em branco se não souber.`);
      return { wasteTypeId: i.id, unit: i.unit || i.defaultUnit || "KG", estimatedQuantity: amount };
    }) as RequestedScheduleMaterialInput[];
    repeatMaterials.forEach(m => rows.push({ proposedMaterial: { name: m.nameSnapshot, unit: m.unit as WasteUnit, category: m.categorySnapshot || undefined, subcategory: m.subcategorySnapshot || undefined }, unit: m.unit as WasteUnit, estimatedQuantity: m.estimatedQuantity == null ? undefined : Number(m.estimatedQuantity) }));
    if (proposed.trim()) rows.push({ proposedMaterial: { name: proposed.trim(), unit: proposalUnit }, unit: proposalUnit });
    if (!rows.length) throw Error("Selecione ao menos um material ou descreva um material não encontrado."); return rows;
  }
  function validate(section: number) {
    if (section === 1 && !coops.some(c => c.id === coopId)) throw Error("Selecione uma cooperativa disponível.");
    if (section === 2 && address.trim().length < 5) throw Error("Informe endereço completo e uma referência para a retirada.");
    if (section === 3) materials();
    if (section === 4) { const d = parseFortalezaDateTime(date, time); if (!d || new Date(d).getTime() <= Date.now()) throw Error("Informe data e horário futuros válidos, no horário de Fortaleza."); }
  }
  function next() { try { validate(step); setError(""); setStep(s => s + 1); } catch (e: any) { setError(e.message); } }
  async function locate() { setGpsBusy(true); setError(""); try { const permission = await Location.requestForegroundPermissionsAsync(); if (!permission.granted) throw Error("Autorize a localização ou toque no mapa para indicar o local."); const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }); setPosition(p.coords); } catch (e: any) { setError(e.message); } finally { setGpsBusy(false); } }
  async function send(resume = false) {
    if (guard.current || !user?.id) return;
    guard.current = true; setSaving(true); setError(""); const owner = user.id;
    try {
      let payload: ResidentialSubmission | undefined;
      if (!resume) { [1, 2, 3, 4].forEach(validate); payload = { cooperativeId: coopId, pickupAddress: address.trim(), pickupLatitude: position?.latitude, pickupLongitude: position?.longitude, preferredDate: parseFortalezaDateTime(date, time)!, requestedMaterials: materials(), notes: notes.trim() || undefined }; }
      const request = await residentialService.submit(owner, payload);
      if (identity.current !== owner) return;
      setPending(null); setStep(1); setDate(""); setTime(""); setSelection({}); setRepeatMaterials([]); setProposed(""); setNotes("");
      router.replace({ pathname: "/(pf-tabs)/request-details", params: { id: request.id } });
    } catch (e: any) { if (identity.current === owner) { setError(e.message); setPending(await residentialService.pendingSubmission(owner)); } }
    finally { guard.current = false; setSaving(false); }
  }
  const activeCoop = coops.find(c => c.id === coopId);
  return <ResidentialPage title="Solicitar coleta" subtitle="Escolha o atendimento, revise o pedido e acompanhe a confirmação da cooperativa.">
    {!!error && <Notice error text={error} />}
    {!draftReady && <Notice text="Conferindo tentativas anteriores…" />}
    {pending ? <Card><Text style={{ fontWeight: "700", fontSize: 18 }}>Há um envio aguardando confirmação</Text><Text>Endereço: {pending.payload.pickupAddress}</Text><Text>Preferência: {residentialDate(pending.payload.preferredDate)}</Text><Notice text="Retomar verifica o mesmo pedido sem criar uma nova solicitação. Os dados da primeira tentativa foram preservados." /><Action label="Retomar envio com segurança" busy={saving} onPress={() => void send(true)} /><Action secondary label="Consultar minhas solicitações" onPress={() => router.push("/(pf-tabs)/residential-history")} /></Card> : <>
      <Text style={{ color: "#17694F", fontWeight: "700", marginVertical: 12 }}>Etapa {step} de 5 · {["Cooperativa", "Retirada", "Materiais", "Preferência", "Revisão"][step - 1]}</Text>
      {step === 1 && <Card><Field label="Buscar cooperativa por nome ou município" value={coopSearch} onChangeText={setCoopSearch} />{coopLoading && <Notice text="Carregando cooperativas…" />}{coops.filter(c => `${c.name} ${c.city || ""} ${c.state || ""}`.toLocaleLowerCase("pt-BR").includes(coopSearch.toLocaleLowerCase("pt-BR"))).map(c => <Pressable key={c.id} accessibilityRole="radio" aria-checked={c.id === coopId} accessibilityState={{ checked: c.id === coopId }} onPress={() => setCoopId(c.id)} style={{ padding: 14, marginBottom: 8, borderWidth: 1, borderColor: coopId === c.id ? "#047857" : "#CBD5E1", backgroundColor: coopId === c.id ? "#E5F4EC" : "white", borderRadius: 12 }}><Text style={{ fontWeight: "700" }}>{c.id === coopId ? "✓ " : ""}{c.name}</Text><Text>{[c.city, c.state, c.address].filter(Boolean).join(" · ")}</Text></Pressable>)}<Notice text="Confira se a cooperativa atende sua região. A solicitação depende de disponibilidade e confirmação." /><Action secondary label="Recarregar cooperativas" busy={coopLoading} onPress={() => void loadCoops()} /></Card>}
      {step === 2 && <Card>{!!overview.data?.profile?.savedAddresses?.length && <><Text style={{ fontWeight: "700" }}>Usar endereço salvo</Text>{overview.data.profile.savedAddresses.map(a => <Action key={a.id} secondary label={a.label} onPress={() => { setAddress(a.address); setPosition(a.latitude != null && a.longitude != null ? { latitude: a.latitude, longitude: a.longitude } : null); }} />)}</>}<Field label="Endereço completo e referência" value={address} onChangeText={v => { setAddress(v); setPosition(null); }} maxLength={500} multiline /><Action secondary label="Usar posição atual do aparelho" busy={gpsBusy} onPress={() => void locate()} /><OperationalMap baseLabel={null} baseLatitude={position?.latitude ?? -3.7319} baseLongitude={position?.longitude ?? -38.5267} points={position ? [{ id: "pickup", ...position, title: "Ponto de retirada" }] : []} onPick={(latitude, longitude) => setPosition({ latitude, longitude })} /><Notice text={position ? `Local marcado: ${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}. Confira se corresponde ao endereço.` : "Toque no mapa para indicar o local. Se não conseguir, o endereço completo também pode ser enviado sem coordenadas."} /></Card>}
      {step === 3 && <Card><Field label="Buscar material" value={search} onChangeText={v => { setSearch(v); setVisible(30); }} />{catalogLoading && <Notice text="Carregando materiais da cooperativa…" />}<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{["", ...new Set(catalog.map(i => i.category).filter((v): v is string => !!v))].map(c => <Action key={c} secondary={category !== c} label={c || "Todos"} onPress={() => { setCategory(c); setVisible(30); }} />)}</View><Notice text={`${Object.keys(selection).length} material(is) selecionado(s). Não sabe a quantidade? Deixe a estimativa em branco.`} />{filtered.slice(0, visible).map(i => <View key={i.id} style={{ marginBottom: 12 }}><Pressable accessibilityRole="checkbox" aria-checked={Object.hasOwn(selection, i.id)} accessibilityState={{ checked: Object.hasOwn(selection, i.id) }} onPress={() => setSelection(old => { const next = { ...old }; if (Object.hasOwn(next, i.id)) delete next[i.id]; else next[i.id] = ""; return next; })} style={{ padding: 14, borderRadius: 10, backgroundColor: Object.hasOwn(selection, i.id) ? "#DDF3E7" : "#F1F5F4" }}><Text>{Object.hasOwn(selection, i.id) ? "✓ " : ""}{i.name} · {unitLabel(i.unit || i.defaultUnit)}</Text></Pressable>{Object.hasOwn(selection, i.id) && <><Field label={`Estimativa de ${i.name} (opcional)`} value={selection[i.id]} onChangeText={v => setSelection(old => ({ ...old, [i.id]: v }))} keyboardType="decimal-pad" placeholder="Não sei a quantidade" maxLength={12} /><Notice text={separationTip(i.name)} /></>}</View>)}{!catalogLoading && !filtered.length && <Notice text="Nenhum material encontrado nesta busca. Você pode descrever o material abaixo." />}{filtered.length > visible && <Action secondary label="Mostrar mais materiais" onPress={() => setVisible(v => v + 30)} />}{repeatMaterials.map((m, i) => <Card key={`${m.nameSnapshot}-${i}`}><Text>{m.nameSnapshot} · {unitLabel(m.unit)} · material do pedido anterior</Text><Notice text="Não está no catálogo atual. Será encaminhado para análise da cooperativa." /><Action secondary label={`Remover ${m.nameSnapshot} do novo pedido`} onPress={() => setRepeatMaterials(old => old.filter((_, index) => index !== i))} /></Card>)}<Field label="Material não encontrado (opcional)" value={proposed} onChangeText={setProposed} maxLength={150} />{!!proposed && <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{(["KG", "LITER", "UNIT", "TON", "CUBIC_METER"] as WasteUnit[]).map(unit => <Action key={unit} secondary={proposalUnit !== unit} label={unitLabel(unit)} onPress={() => setProposalUnit(unit)} />)}</View>}</Card>}
      {step === 4 && <Card><Field label="Data preferencial (DD/MM/AAAA)" value={date} onChangeText={v => setDate(maskDate(v))} maxLength={10} keyboardType="number-pad" placeholder="28/10/2026" /><Field label="Horário preferencial (HH:MM)" value={time} onChangeText={v => setTime(maskTime(v))} maxLength={5} keyboardType="number-pad" placeholder="14:30" /><Notice text="Horário de Fortaleza. A cooperativa analisará a preferência e confirmará o atendimento." /><Field label="Observações para a retirada (opcional)" value={notes} onChangeText={setNotes} maxLength={2000} multiline /></Card>}
      {step === 5 && <Card><Text style={{ fontSize: 20, fontWeight: "700" }}>Revise antes de enviar</Text><Text>Cooperativa: {activeCoop?.name}</Text><Text>Retirada: {address}</Text><Text>Preferência: {date} às {time} · Fortaleza</Text>{catalog.filter(i => Object.hasOwn(selection, i.id)).map(i => <Text key={i.id}>{i.name} · {selection[i.id] || "Quantidade a conferir"} {selection[i.id] ? unitLabel(i.unit || i.defaultUnit) : ""}</Text>)}{repeatMaterials.map((m, i) => <Text key={i}>{m.nameSnapshot} · {m.estimatedQuantity || "Quantidade a conferir"} {unitLabel(m.unit)}</Text>)}{!!proposed && <Text>Material informado: {proposed} · {unitLabel(proposalUnit)}</Text>}{!!notes && <Notice text={notes} />}<Notice text="O envio registra uma solicitação. Aguarde a confirmação da cooperativa antes de considerar a retirada agendada." /><Action label="Confirmar e enviar solicitação" busy={saving} disabled={!draftReady} onPress={() => void send()} /></Card>}
      {step < 5 && <Action label="Continuar" disabled={!draftReady || coopLoading || catalogLoading} onPress={next} />}{step > 1 && <Action secondary label="Voltar à etapa anterior" disabled={saving} onPress={() => { setError(""); setStep(s => s - 1); }} />}
    </>}
  </ResidentialPage>;
}
