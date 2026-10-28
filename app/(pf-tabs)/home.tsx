import { router } from "expo-router";
import { Text, View } from "react-native";
import { useAuth } from "@/src/contexts/AuthContext";
import { residentialService } from "@/src/services/residentialService";
import { useResidentialData } from "@/src/hooks/useResidentialData";
import { ResidentialPage, ResidentialLoad, Metric } from "@/src/components/residential/ResidentialPage";
import { RequestCard } from "@/src/components/residential/RequestCard";
import { Action, Card, Notice } from "@/src/components/ui/Workspace";
import { numberBR, residentialDate } from "@/src/utils/residential";
export default function ResidentialHome() {
  const { user } = useAuth();
  const state = useResidentialData("overview", residentialService.overview), data = state.data;
  return <ResidentialPage title={`Olá, ${user?.displayName?.split(" ")[0] || "bem-vindo"}`} subtitle="Sua residência participa de uma cidade mais limpa. Acompanhe cada passo da coleta.">
    <Action label="Solicitar coleta na minha residência" onPress={() => router.push("/(pf-tabs)/residential-request")} />
    <ResidentialLoad {...state} retry={() => void state.load()} />
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
      <Metric value={data ? String(data.counts.REQUESTED || 0) : "—"} label="Aguardando análise" />
      <Metric value={data ? String((data.counts.SCHEDULED || 0) + (data.counts.IN_PROGRESS || 0)) : "—"} label="Em atendimento" />
      <Metric value={data ? numberBR(data.receivedKg) + " kg" : "—"} label="Recebidos pela cooperativa" />
    </View>
    <Text style={{ fontWeight: "700", fontSize: 20, marginBottom: 12 }}>Seus atendimentos</Text>
    {data?.requests.map(request => <RequestCard key={request.id} request={request} />)}
    {data && !data.requests.length && <Card><Text>Você não tem solicitações em atendimento.</Text><Notice text="Separe os recicláveis secos e solicite a retirada quando precisar. A cooperativa confirmará a disponibilidade." /></Card>}
    {data?.lastReceived && <Card><Text style={{ fontWeight: "700", fontSize: 18 }}>Última coleta recebida</Text><Text>{residentialDate(data.lastReceived.receivedAt || data.lastReceived.collectedAt)} · {numberBR(Number(data.lastReceived.totalWeightKg))} kg</Text><Action secondary label="Ver detalhes da última coleta" onPress={() => router.push({ pathname: "/(pf-tabs)/request-details", params: { id: data.lastReceived!.scheduleId! } })} /></Card>}
    <Action secondary label="Ver todas as minhas coletas" onPress={() => router.push("/(pf-tabs)/residential-history")} />
    <Card><Text style={{ fontWeight: "700", fontSize: 18 }}>Cuide dos pontos de entrega</Text><Text>Encontre PEVs por bairro, confira os materiais aceitos e informe se o ponto precisa de atenção.</Text><Action secondary label="Encontrar PEVs e acompanhar pedidos" onPress={() => router.push("/(pf-tabs)/residential-pevs")} /></Card>
    <Card><Text style={{ fontWeight: "700", fontSize: 18 }}>Sua participação</Text><Text>Consulte suas quantidades registradas e a evolução dos últimos meses.</Text><Action secondary label="Ver minha participação" onPress={() => router.push("/(pf-tabs)/residential-participation")} /><Action secondary label="Planejar a separação dos materiais" onPress={() => router.push("/(pf-tabs)/residential-planner")} /></Card>
    <Notice text="A data preferencial é um pedido. Considere o atendimento programado somente após a confirmação da cooperativa." />
  </ResidentialPage>;
}
