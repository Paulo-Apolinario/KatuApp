import { Stack } from "expo-router";

export default function MotoristaLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="home" />
      <Stack.Screen name="mapa" />
      <Stack.Screen name="rotas" />
      <Stack.Screen name="calendario" />
      <Stack.Screen name="veiculos" />
      <Stack.Screen name="relatorios" />
      <Stack.Screen name="historico-relatorios" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="edit-profile" />
    </Stack>
  );
}