import { Text, View } from "react-native";
import { Action, Notice } from "./ui/Workspace";
export function HistoryStatus({ count, total, error, busy, hasMore, updatedAt, onRefresh, onMore }: {
  count: number; total: number; error: string; busy: boolean; hasMore: boolean; updatedAt: string | null; onRefresh: () => void; onMore: () => void;
}) {
  return <View style={{ gap: 8, marginVertical: 12 }}>
    {!!error && <><Notice error text={error} /><Text>Não foi possível atualizar. Os registros carregados continuam disponíveis.</Text></>}
    <Text style={{ color: "#475569" }}>{count} de {total} registro(s) carregado(s){updatedAt ? ` · Atualizado às ${new Date(updatedAt).toLocaleTimeString("pt-BR")}` : ""}</Text>
    <Action secondary label={error ? "Tentar novamente" : "Atualizar histórico"} busy={busy} onPress={onRefresh} />
    {hasMore && <Action label="Carregar mais registros" busy={busy} onPress={onMore} />}
  </View>;
}
