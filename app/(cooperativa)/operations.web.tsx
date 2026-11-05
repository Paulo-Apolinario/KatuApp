import { Linking, Text, View } from "react-native";
import { router } from "expo-router";
import { useState } from "react";
import {
  FieldPage,
  FieldButton,
  ui,
} from "@/src/components/cooperative/FieldUI";
export default function ReceivingAccess() {
  const [error, setError] = useState("");
  return (
    <FieldPage
      title="Recebimento de materiais"
      subtitle="Continue o atendimento no painel da cooperativa."
    >
      <View style={ui.card}>
        <Text style={ui.heading}>
          Um atendimento, do recebimento à conclusão
        </Text>
        <Text style={ui.muted}>
          No painel, abra a coleta e siga o próximo passo indicado. O acesso usa
          sua conta do painel.
        </Text>
        {[
          "Confirmar a chegada do material",
          "Separar, pesar e conferir",
          "Dividir a produção da equipe, quando houver",
          "Encaminhar os materiais e concluir a coleta",
        ].map((label, i) => (
          <Text key={label} style={{ fontSize: 16, paddingVertical: 8 }}>
            {i + 1}. {label}
          </Text>
        ))}
        <FieldButton
          label="Abrir atendimentos no painel"
          onPress={() =>
            void Linking.openURL(
              "https://painel.katua.com.br/waste-list",
            ).catch(() =>
              setError("Não foi possível abrir o painel. Tente novamente."),
            )
          }
        />
        <Text style={ui.muted}>
          Materiais em estoque, triagem ou reserva continuam em acompanhamento
          depois de concluir a coleta.
        </Text>
      </View>
      <FieldButton
        label="Consultar ordens de coleta extras"
        secondary
        onPress={() => router.push("/(cooperativa)/extra-orders")}
      />
      {!!error && <Text accessibilityRole="alert">{error}</Text>}
    </FieldPage>
  );
}
