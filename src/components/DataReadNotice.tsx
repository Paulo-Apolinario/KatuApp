import { View, Text } from "react-native";
import { useReadState } from "../services/readState";
import { Action, Notice } from "./ui/Workspace";
export function DataReadNotice({ resource, onRetry }: { resource: string; onRetry: () => void }) {
  const state = useReadState(resource);
  if (!state.cached && !state.error) return null;
  return <View style={{ padding: 12, backgroundColor: "#FFF7ED", borderRadius: 12, marginVertical: 8 }}>
    <Notice error={!state.cached} text={state.cached ? "Dados salvos no aparelho. Não foi possível confirmar uma atualização com o servidor." : state.error} />
    {state.cached && <Text>As informações podem estar desatualizadas. As operações pendentes continuam na central de sincronização.</Text>}
    <Action secondary label="Tentar atualizar" onPress={onRetry} />
  </View>;
}
