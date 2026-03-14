import { Stack } from "expo-router";
import { AuthProvider } from "../src/contexts/AuthContext";

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(public)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(pf-tabs)" />
        <Stack.Screen name="(catador)" />
        <Stack.Screen name="(gerador)" />
        <Stack.Screen name="(cooperativa)" />
      </Stack>
    </AuthProvider>
  );
}