import { useEffect, useState } from "react";
import {
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Platform,
  Linking,
} from "react-native";
import { useURL } from "expo-linking";
import { router } from "expo-router";
import { useAuth } from "@/src/contexts/AuthContext";
import { useNotification } from "@/src/contexts/NotificationContext";

export default function QuickLoginScreen() {
  const url = useURL();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [used, setUsed] = useState(false);
  const { signInWithLink } = useAuth();
  const { notifyError, notifySuccess } = useNotification();
  useEffect(() => {
    if (!url) return;
    const hash = url.split("#")[1] || "";
    const incoming = new URLSearchParams(hash).get("token") || "";
    if (incoming && !used) setToken(incoming);
    if (Platform.OS === "web" && incoming)
      window.history.replaceState(null, "", window.location.pathname);
  }, [url, used]);
  async function confirm() {
    if (!token || loading || used) return;
    setLoading(true);
    const result = await signInWithLink(token);
    setLoading(false);
    setUsed(true);
    setToken("");
    if (result.success) notifySuccess("Login realizado com sucesso!");
    else notifyError(result.error || "Solicite um novo link de acesso.");
  }
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <Text
        style={{
          fontSize: 28,
          fontWeight: "700",
          color: "#111827",
          marginBottom: 16,
        }}
      >
        Acesso rápido KATUÁ
      </Text>
      <Text style={{ color: "#4B5563", marginBottom: 24 }}>
        {token && !used
          ? "Confirme para entrar com o link recebido. Ele só pode ser utilizado uma vez."
          : "Solicite um novo link na tela de login."}
      </Text>
      <TouchableOpacity
        accessibilityRole="button"
        disabled={!token || used || loading}
        onPress={confirm}
        style={{
          padding: 16,
          borderRadius: 8,
          backgroundColor: "#047857",
          opacity: !token || used || loading ? 0.5 : 1,
        }}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>
            Confirmar acesso
          </Text>
        )}
      </TouchableOpacity>
      {Platform.OS === "web" && !!token && !used && (
        <TouchableOpacity
          onPress={() =>
            Linking.openURL(
              `katua://quick-login#token=${encodeURIComponent(token)}`,
            )
          }
          style={{ marginTop: 24 }}
        >
          <Text style={{ color: "#047857" }}>
            Abrir no aplicativo instalado
          </Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        onPress={() => router.replace("/(public)/access-type")}
        style={{ marginTop: 24 }}
      >
        <Text style={{ color: "#047857" }}>Voltar para entrar</Text>
      </TouchableOpacity>
    </View>
  );
}
