import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Text } from "react-native";
import { scheduleService } from "@/src/services/scheduleService";
import { useHistoryPages } from "@/src/hooks/useHistoryPages";
import { HistoryStatus } from "@/src/components/HistoryStatus";
import { ResidentialPage } from "@/src/components/residential/ResidentialPage";
import { RequestCard } from "@/src/components/residential/RequestCard";
import { Field, Card } from "@/src/components/ui/Workspace";
export default function ResidentialHistory() {
  const history = useHistoryPages(scheduleService.history);
  const load = useRef(history.load); load.current = history.load;
  useFocusEffect(useCallback(() => { void load.current(); }, []));
  const [search, setSearch] = useState("");
  const visible = history.items.filter(r => `${r.id} ${r.cooperative?.name || ""} ${r.requestedMaterials?.map(m => m.nameSnapshot).join(" ")}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));
  return <ResidentialPage title="Minhas coletas" subtitle="Consulte pedidos, datas confirmadas e a evolução de cada atendimento.">
    <Field label="Buscar nos registros carregados" value={search} onChangeText={setSearch} placeholder="Protocolo, cooperativa ou material" />
    <HistoryStatus count={history.items.length} total={history.meta.total} error={history.error} busy={history.busy} hasMore={history.meta.hasMore} updatedAt={history.updatedAt} onRefresh={() => void history.load()} onMore={() => void history.load(true)} />
    {visible.map(r => <RequestCard key={r.id} request={{ id: r.id, status: r.status, cooperative: { id: r.cooperative?.id || "", name: r.cooperative?.name || "Cooperativa responsável" }, collections: r.collections?.map(c => ({ status: c.status })), preferredDate: r.preferredDate || null, scheduledDate: r.scheduledDate || null }} />)}
    {!history.loading && !history.error && !visible.length && <Card><Text>{history.items.length ? "Nenhum resultado nos registros carregados. Você pode carregar mais páginas." : "Você ainda não tem solicitações. Sua primeira coleta pode começar pela aba Solicitar."}</Text></Card>}
  </ResidentialPage>;
}
