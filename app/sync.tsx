import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Text } from "react-native";
import ProtectedRoute from "@/src/components/ProtectedRoute";
import { Workspace, Card, Action, Notice } from "@/src/components/ui/Workspace";
import { getPendingSyncItems } from "@/src/database/repositories/syncQueueRepository";
import { syncManager } from "@/src/offline/syncManager";
import { useConnectivity } from "@/src/hooks/useConnectivity";
const labels: Record<string, string> = { start: "Início da coleta", "complete-field": "Conclusão em campo", "report-incident": "Ocorrência", UPDATE_ROUTE_STATUS: "Atualização da rota", UPDATE_ROUTE_PROGRESS: "Andamento da rota", EXTRA_ORDER_WRITE: "Ordem de coleta extra", UPDATE_COLLECTION_STATUS: "Situação da coleta", COMPLETE_COLLECTION: "Conclusão da coleta" };
type Rows = Awaited<ReturnType<typeof getPendingSyncItems>>;
export default function SyncScreen() {
  const [rows, setRows] = useState<Rows>([]), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(false), [loadError, setLoadError] = useState("");
  const [visibleCount, setVisibleCount] = useState(50);
  const working = useRef(false);
  const { isOffline } = useConnectivity();
  const refresh = useCallback(async () => {
    try { setRows(await getPendingSyncItems()); setLoaded(true); setLoadError(""); }
    catch { setLoadError("Não foi possível ler as operações salvas. Tente atualizar a lista."); }
  }, []);
  useFocusEffect(useCallback(() => { void refresh(); const timer = setInterval(() => void refresh(), 3000); return () => clearInterval(timer); }, [refresh]));
  async function retry(entityId?: string) {
    if (working.current) return;
    working.current = true; setBusy(true);
    try { const result = await syncManager.runSyncNow({ entityId, manual: true }); setMessage(result.message); await refresh(); }
    finally { working.current = false; setBusy(false); }
  }
  return <ProtectedRoute allowedUserTypes={["COLLECTOR", "DRIVER"]}><Workspace title="Sincronização" subtitle="Os registros permanecem salvos neste aparelho até a confirmação do servidor.">
    {isOffline && <Notice text="Sem conexão. Você pode consultar as pendências; o envio será retomado quando a conexão voltar." />}
    {!!loadError && <Notice error text={loadError} />}
    {!!message && <Notice text={message} />}
    <Action secondary label="Atualizar lista" onPress={() => void refresh()} />
    {!!rows.length && <Action label="Tentar enviar pendências" busy={busy} disabled={isOffline} onPress={() => void retry()} />}
    {loaded && !loadError && !rows.length && <Card><Text>Nenhuma operação aguardando envio nesta conta.</Text></Card>}
    {!!rows.length && <Text>{rows.length} operação(ões) aguardando confirmação.</Text>}
    {rows.slice(0, visibleCount).map(row => row && <Card key={row.id}>
      <Text style={{ fontWeight: "700" }}>{labels[row.payload?.action] || labels[row.operationType] || "Operação de campo"}</Text>
      <Text>{row.entityType === "ROUTE" ? "Rota" : row.entityType === "COLLECTION" ? "Coleta" : "Ordem"} #{row.entityId.slice(-8).toUpperCase()}</Text>
      <Text>{row.status === "ERROR" ? "Falha no envio" : row.status === "SYNCING" ? "Envio iniciado; aguardando confirmação" : "Aguardando envio"} · {new Date(row.createdAt).toLocaleString("pt-BR")}</Text>
      {!!row.errorMessage && <Notice error text={row.errorMessage} />}
      <Text>Tentativas com falha: {row.retryCount}</Text>
      <Action secondary label="Tentar enviar esta operação" disabled={isOffline} busy={busy} onPress={() => void retry(row.entityId)} />
      <Text style={{ color: "#64748B", fontSize: 12 }}>Etapas anteriores desta mesma coleta ou rota serão enviadas primeiro. Se houver conflito, atualize os dados e confira a situação com a cooperativa.</Text>
    </Card>)}
    {rows.length > visibleCount && <Action secondary label="Mostrar mais pendências" onPress={() => setVisibleCount(n => n + 50)} />}
  </Workspace></ProtectedRoute>;
}
