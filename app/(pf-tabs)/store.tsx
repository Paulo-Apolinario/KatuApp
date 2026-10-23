import { Workspace, Card, Notice, Action } from "@/src/components/ui/Workspace";
import { router } from "expo-router";
export default function Feature() {
  return (
    <Workspace title="Benefícios">
      <Card>
        <Notice text="A loja ainda não está disponível. Suas coletas e solicitações continuam acessíveis no início." />
        <Action
          label="Voltar ao início"
          onPress={() => router.replace("/(pf-tabs)/home")}
        />
      </Card>
    </Workspace>
  );
}
