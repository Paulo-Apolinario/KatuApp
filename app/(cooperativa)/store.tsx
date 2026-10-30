import { Linking } from "react-native";
import { Workspace, Card, Notice, Action } from "@/src/components/ui/Workspace";
export default function StockAccess() {
  return (
    <Workspace title="Estoque e destinações">
      <Card>
        <Notice text="O estoque é controlado pelas entradas, destinações e lotes no painel da cooperativa. Abra o painel e entre com sua conta para consultar os saldos e registrar movimentações." />
        <Action
          label="Abrir gestão de resíduos no painel"
          onPress={() =>
            void Linking.openURL("https://painel.katua.com.br/collected-waste")
          }
        />
      </Card>
    </Workspace>
  );
}
