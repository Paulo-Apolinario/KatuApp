import { Text, View } from "react-native";

export default function RegisterScreen() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 24,
      }}
    >
      <Text
        style={{
          fontSize: 28,
          fontWeight: "800",
          color: "#0F172A",
          marginBottom: 12,
        }}
      >
        Cadastro
      </Text>

      <Text
        style={{
          fontSize: 16,
          color: "#475569",
          textAlign: "center",
        }}
      >
        Próxima etapa: montar a tela de cadastro no mesmo padrão do login.
      </Text>
    </View>
  );
}