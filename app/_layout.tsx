import { Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Text, View } from "react-native";
import { AuthProvider } from "../src/contexts/AuthContext";
import { runMigrations } from "../src/database/migrations";
import { subscribeToConnectivity } from "../src/offline/connectivity";
import { syncManager } from "../src/offline/syncManager";

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    async function bootstrap() {
      try {
        if (Platform.OS !== "web") {
          await runMigrations();
        }

        setReady(true);
      } catch (err: any) {
        console.error("Erro ao inicializar banco local:", err);
        setError(err?.message || "Não foi possível inicializar o banco local.");
      }
    }

    bootstrap();
  }, []);

  useEffect(() => {
    if (!ready) return;

    const unsubscribe = subscribeToConnectivity(async (status) => {
      if (status.isOffline) {
        wasOfflineRef.current = true;
        return;
      }

      if (wasOfflineRef.current && !status.isOffline) {
        try {
          const result = await syncManager.runSyncNow();
          console.log("[SYNC] Resultado:", result);
        } catch (err) {
          console.error("[SYNC] Erro ao sincronizar automaticamente:", err);
        } finally {
          wasOfflineRef.current = false;
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [ready]);

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F8FAFC",
          padding: 24,
        }}
      >
        <Text
          style={{
            fontSize: 18,
            fontWeight: "700",
            color: "#B91C1C",
            textAlign: "center",
            marginBottom: 10,
          }}
        >
          Erro ao iniciar o aplicativo
        </Text>

        <Text
          style={{
            fontSize: 14,
            color: "#475569",
            textAlign: "center",
            lineHeight: 22,
          }}
        >
          {error}
        </Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F8FAFC",
        }}
      >
        <ActivityIndicator size="large" color="#028C56" />
        <Text
          style={{
            marginTop: 12,
            color: "#475569",
            fontSize: 14,
            fontWeight: "600",
          }}
        >
          Inicializando banco local...
        </Text>
      </View>
    );
  }

  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  );
}