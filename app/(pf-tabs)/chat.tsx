import { Workspace, Card, Notice, Action } from "@/src/components/ui/Workspace";
import { router } from "expo-router";
export default function Feature() {
  return (
    <Workspace title="Comunicação">
      <Card>
        <Notice text="O chat ainda não está disponível. Para questões operacionais, utilize os contatos da cooperativa cadastrada." />
        <Action
          label="Voltar ao início"
          onPress={() => router.replace("/(pf-tabs)/home")}
        />
      </Card>
    </Workspace>
  );
}
