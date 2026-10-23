import { Workspace, Card, Notice, Action } from "@/src/components/ui/Workspace";
import { router } from "expo-router";
export default function Feature() {
  return (
    <Workspace title="Identificação NFC">
      <Card>
        <Notice text="A identificação NFC ainda não está disponível nesta versão. Utilize o protocolo da coleta." />
        <Action
          label="Voltar ao início"
          onPress={() => router.replace("/(pf-tabs)/home")}
        />
      </Card>
    </Workspace>
  );
}
