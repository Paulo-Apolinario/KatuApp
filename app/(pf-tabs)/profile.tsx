import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import * as Crypto from "expo-crypto";
import { useAuth } from "@/src/contexts/AuthContext";
import authService from "@/src/services/authService";
import { residentialService, SavedAddress } from "@/src/services/residentialService";
import { useResidentialData } from "@/src/hooks/useResidentialData";
import { ResidentialPage, ResidentialLoad } from "@/src/components/residential/ResidentialPage";
import { Card, Field, Action, Notice } from "@/src/components/ui/Workspace";
export default function ResidentialProfile() {
  const { user, refreshUser, signOut } = useAuth();
  const state = useResidentialData("overview", residentialService.overview);
  const initialized = useRef("");
  const [name, setName] = useState(user?.displayName || ""), [phone, setPhone] = useState(user?.phone || ""), [address, setAddress] = useState(user?.personProfile?.address || "");
  const [saved, setSaved] = useState<SavedAddress[]>([]), [label, setLabel] = useState(""), [newAddress, setNewAddress] = useState("");
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  useEffect(() => { if (state.data && initialized.current !== user?.id) { initialized.current = user?.id || ""; setSaved(state.data.profile?.savedAddresses || []); } }, [state.data, user?.id]);
  async function save() {
    if (busy) return; setBusy(true); setError(""); setMessage("");
    try { await residentialService.profile({ displayName: name, phone, address, savedAddresses: saved }); await refreshUser(); await state.load(); setMessage("Dados e endereços atualizados."); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  function addAddress() {
    if (!label.trim() || newAddress.trim().length < 5 || saved.length >= 10) { setError("Informe um nome e endereço completo. Você pode salvar até dez endereços."); return; }
    setSaved(old => [...old, { id: Crypto.randomUUID(), label: label.trim(), address: newAddress.trim(), latitude: null, longitude: null }]); setLabel(""); setNewAddress(""); setError(""); setMessage("Endereço adicionado à edição. Toque em Salvar meus dados para confirmar.");
  }
  async function recover() { setBusy(true); setError(""); try { const result = await authService.forgotPassword(user?.email || ""); if (!result.success) throw Error(result.error); setMessage("Se o cadastro permitir, as instruções serão enviadas ao seu e-mail."); } catch (e: any) { setError(e.message); } finally { setBusy(false); } }
  return <ResidentialPage title="Meu perfil" subtitle="Mantenha seus dados e locais de retirada atualizados.">
    <ResidentialLoad {...state} retry={() => void state.load()} />
    {!!error && <Notice error text={error} />}{!!message && <Notice text={message} />}
    <Card><Field label="Nome completo" value={name} onChangeText={setName} maxLength={150} /><Field label="Telefone com DDD" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} /><Field label="Endereço principal e referência" value={address} onChangeText={setAddress} maxLength={500} multiline /><Field label="CPF" value={user?.personProfile?.cpf || "Não informado"} editable={false} /><Field label="E-mail de acesso" value={user?.email || ""} editable={false} /><Notice text="CPF e e-mail identificam a conta. A alteração desses dados exige verificação de titularidade." /></Card>
    <Card><Text style={{ fontSize: 18, fontWeight: "700" }}>Endereços salvos · {saved.length}/10</Text><Notice text="Salvos na sua conta para reutilizar nas próximas solicitações. Alterações só são confirmadas ao salvar os dados." />
      {saved.map(a => <View key={a.id} style={{ borderBottomWidth: 1, borderBottomColor: "#E2E8F0", paddingBottom: 12, gap: 6 }}><Text style={{ fontWeight: "700" }}>{a.label}</Text><Text>{a.address}</Text><Action secondary label={`Usar ${a.label} como endereço principal`} disabled={busy} onPress={() => setAddress(a.address)} /><Action secondary label={`Remover endereço ${a.label}`} disabled={busy} onPress={() => setSaved(old => old.filter(x => x.id !== a.id))} /></View>)}
      <Field label="Nome do local" value={label} onChangeText={setLabel} placeholder="Casa, condomínio…" maxLength={50} /><Field label="Novo endereço e referência" value={newAddress} onChangeText={setNewAddress} maxLength={500} multiline /><Action secondary label="Adicionar endereço à edição" disabled={busy || !state.data} onPress={addAddress} />
    </Card>
    <Action label="Salvar meus dados" busy={busy} disabled={!state.data || state.cached} onPress={() => void save()} />
    <Card><Text style={{ fontWeight: "700" }}>Acesso à conta</Text><Action secondary label="Receber instruções para alterar a senha" disabled={busy} onPress={() => void recover()} /><Action secondary label="Sair da conta" disabled={busy} onPress={() => void signOut()} /></Card>
  </ResidentialPage>;
}
