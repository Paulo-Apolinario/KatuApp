import { Text, View } from "react-native";
import { residentialService } from "@/src/services/residentialService";
import { useResidentialData } from "@/src/hooks/useResidentialData";
import { ResidentialPage, ResidentialLoad, Metric } from "@/src/components/residential/ResidentialPage";
import { Card, Notice } from "@/src/components/ui/Workspace";
import { numberBR } from "@/src/utils/residential";
export default function ResidentialParticipation() {
  const state = useResidentialData("overview", residentialService.overview), data = state.data;
  const month = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const year = Number(month.find(p => p.type === "year")?.value), current = Number(month.find(p => p.type === "month")?.value);
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(Date.UTC(year, current - 6 + i, 1)); const key = d.toISOString().slice(0, 7); return { key, label: d.toLocaleDateString("pt-BR", { timeZone: "UTC", month: "short", year: "numeric" }), kg: data?.months.find(m => m.month === key)?.kg || 0 }; });
  const largest = Math.max(1, ...months.map(m => m.kg));
  return <ResidentialPage title="Minha participação" subtitle="Resultados pessoais baseados nas coletas recebidas pela cooperativa.">
    <ResidentialLoad {...state} retry={() => void state.load()} />
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 }}><Metric value={data ? numberBR(data.receivedKg) + " kg" : "—"} label="Massa recebida acumulada" /><Metric value={data ? String(data.receivedCollections) : "—"} label="Coletas recebidas" /></View>
    <Card><Text style={{ fontWeight: "700", fontSize: 18 }}>Últimos seis meses</Text>{data && months.map(m => <View key={m.key} accessible accessibilityLabel={`${m.label}: ${numberBR(m.kg)} kg`} style={{ gap: 6, paddingVertical: 7 }}><View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text>{m.label}</Text><Text>{numberBR(m.kg)} kg</Text></View><View style={{ height: 12, backgroundColor: "#E2EBE5", borderRadius: 6 }}><View style={{ height: 12, width: `${100 * m.kg / largest}%`, backgroundColor: "#15805E", borderRadius: 6 }} /></View></View>)}</Card>
    <Notice text="Solicitações e estimativas não somam peso recebido. Quantidades podem ser atualizadas após conferência. Litros e unidades não são convertidos automaticamente para kg." />
    <Card><Text style={{ fontWeight: "700" }}>Seu próximo passo</Text><Text>Mantenha os recicláveis secos, separe o vidro com cuidado e confira os materiais aceitos antes de solicitar outra coleta.</Text></Card>
  </ResidentialPage>;
}
