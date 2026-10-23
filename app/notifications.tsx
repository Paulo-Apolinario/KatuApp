import { unitLabel } from "@/src/utils/materials";
import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  AppState,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/src/contexts/AuthContext";
import {
  cachedInbox,
  loadInbox,
  readAllNotices,
  readNotice,
  type InboxNotice,
} from "@/src/services/inboxService";
import { api } from "@/src/services/api";
const stamp = (date: string) =>
  new Date(date).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" });
export default function NotificationsScreen() {
  const { user, loading } = useAuth();
  useFocusEffect(
    useCallback(() => {
      if (!loading && !user) router.replace("/(public)/access-type");
    }, [loading, user]),
  );
  return user?.id ? <InboxContent key={user.id} userId={user.id} /> : null;
}
function InboxContent({ userId }: { userId: string }) {
  const [items, setItems] = useState<InboxNotice[]>([]),
    [unread, setUnread] = useState(0),
    [cursor, setCursor] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [detail, setDetail] = useState<{ id: string; status: string } | null>(null);
  const refresh = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const data = await loadInbox(userId);
      setItems(data.notifications);
      setUnread(data.unreadCount);
      setCursor(data.nextCursor);
    } catch {
      const cached = await cachedInbox(userId);
      if (cached) {
        setItems(cached.notifications);
        setUnread(cached.unreadCount);
        setCursor(null);
      }
      setError(
        "Sem atualização no momento. Os avisos salvos estão disponíveis; tente novamente quando estiver conectado.",
      );
    } finally {
      setBusy(false);
    }
  }, [userId]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
      const updateWhenActive = () => {
        if (
          AppState.currentState !== "background" &&
          AppState.currentState !== "inactive"
        )
          void refresh();
      };
      const timer = setInterval(updateWhenActive, 30000);
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") updateWhenActive();
      });
      return () => {
        clearInterval(timer);
        subscription.remove();
      };
    }, [refresh]),
  );
  async function more() {
    if (!cursor || busy) return;
    setBusy(true);
    try {
      const data = await loadInbox(userId, cursor);
      setItems((old) => [
        ...old,
        ...data.notifications.filter((n) => !old.some((o) => o.id === n.id)),
      ]);
      setCursor(data.nextCursor);
    } catch {
      setError("Não foi possível carregar mais avisos.");
    } finally {
      setBusy(false);
    }
  }
  async function open(item: InboxNotice) {
    try {
      await readNotice(item.id);
      setItems((old) =>
        old.map((n) =>
          n.id === item.id
            ? { ...n, readAt: n.readAt || new Date().toISOString() }
            : n,
        ),
      );
      if (!item.readAt) setUnread((n) => Math.max(0, n - 1));
      if (item.collectionId) {
        const data = await api.get<{
          collection: { id: string; status: string };
        }>(`/collections/${encodeURIComponent(item.collectionId)}`, true);
        setDetail(data.collection);
      }
    } catch {
      setError(
        "Não foi possível atualizar a leitura ou abrir a coleta. O aviso permanece disponível para consulta.",
      );
    }
  }

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={{ flex: 1, backgroundColor: "#F3F6F4" }}
    >
      <View style={{ padding: 16, backgroundColor: "white" }}>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
          style={{ paddingVertical: 10 }}
        >
          <Text style={{ color: "#176944", fontWeight: "700" }}>Voltar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          disabled={busy}
          onPress={refresh}
          style={{ paddingVertical: 10 }}
        >
          <Text style={{ color: "#176944", fontWeight: "700" }}>
            Atualizar avisos
          </Text>
        </TouchableOpacity>
        <Text
          accessibilityRole="header"
          style={{ fontSize: 24, fontWeight: "700", color: "#173D2D" }}
        >
          Notificações
        </Text>
        <Text style={{ color: "#526458", marginTop: 4 }}>
          {unread} não lidas · atualizações das suas coletas
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          disabled={busy || !unread}
          onPress={async () => {
            try {
              await readAllNotices();
              await refresh();
            } catch {
              setError("Não foi possível marcar os avisos como lidos.");
            }
          }}
          style={{ paddingVertical: 12 }}
        >
          <Text style={{ color: "#176944", fontWeight: "700" }}>
            Marcar todas como lidas
          </Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={busy} onRefresh={refresh} />
        }
        contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
      >
        {!!error && (
          <Text
            accessibilityLiveRegion="polite"
            style={{ color: "#8A4B11", marginBottom: 12 }}
          >
            {error}
          </Text>
        )}
        {detail && (
          <View
            style={{
              padding: 16,
              backgroundColor: "#E8F5ED",
              borderRadius: 12,
              marginBottom: 12,
            }}
          >
            <Text style={{ fontWeight: "700" }}>Coleta {detail.id}</Text>
            <Text>
              Etapa atual:{" "}
              {(
                {
                  RECEIVED: "Recebida",
                  SORTING: "Em triagem",
                  COMPLETED: "Concluída",
                  COLLECTED: "Finalizada em campo",
                  CANCELLED: "Cancelada",
                  PENDING: "Pendente",
                  IN_PROGRESS: "Em andamento",
                } as Record<string, string>
              )[detail.status] || detail.status}
            </Text>
            <TouchableOpacity
              onPress={() => setDetail(null)}
              accessibilityRole="button"
              style={{ paddingVertical: 10 }}
            >
              <Text>Fechar detalhes</Text>
            </TouchableOpacity>
          </View>
        )}
        {!busy && !items.length && (
          <Text style={{ color: "#526458" }}>
            Nenhuma atualização por enquanto. As mudanças nas suas coletas
            aparecerão aqui.
          </Text>
        )}
        {items.map((item) => (
          <TouchableOpacity
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={`${item.readAt ? "Lida" : "Não lida"}: ${item.title}`}
            onPress={() => open(item)}
            style={{
              backgroundColor: "white",
              borderRadius: 14,
              padding: 16,
              marginBottom: 12,
              borderLeftWidth: 4,
              borderLeftColor: item.readAt ? "#DCE5DF" : "#176944",
            }}
          >
            <Text style={{ fontWeight: "700", fontSize: 16, color: "#173D2D" }}>
              {item.title}
            </Text>
            <Text style={{ fontSize: 12, color: "#65756A", marginTop: 6 }}>
              {stamp(item.createdAt)} · {item.readAt ? "Lida" : "Não lida"}
            </Text>
            {item.data?.items?.length ? (
              <View>
                <Text
                  style={{ lineHeight: 22, color: "#384E40", marginTop: 10 }}
                >
                  Conferência da cooperativa:{" "}
                  {item.data.actorName || "Responsável registrado"}
                </Text>
                {item.data.items.map((m, index) => (
                  <Text
                    key={index}
                    style={{ lineHeight: 22, marginTop: 8, color: "#173D2D" }}
                  >
                    {m.name}: informado {m.reportedQuantity} · conferido{" "}
                    {m.confirmedQuantity} {unitLabel(m.unit)}
                    {m.previousQuantity !== m.reportedQuantity
                      ? ` · anterior ${m.previousQuantity} ${unitLabel(m.unit)}`
                      : ""}
                  </Text>
                ))}
                <Text
                  style={{ lineHeight: 22, marginTop: 8, color: "#384E40" }}
                >
                  Justificativa: {item.data.reason}
                </Text>
              </View>
            ) : (
              <Text style={{ lineHeight: 22, color: "#384E40", marginTop: 10 }}>
                {item.message}
              </Text>
            )}
            {item.collectionId && (
              <Text
                style={{ marginTop: 10, fontWeight: "700", color: "#176944" }}
              >
                Consultar etapa da coleta
              </Text>
            )}
          </TouchableOpacity>
        ))}
        {busy && <ActivityIndicator color="#176944" />}
        {cursor && (
          <TouchableOpacity
            accessibilityRole="button"
            disabled={busy}
            onPress={more}
            style={{ padding: 16 }}
          >
            <Text
              style={{
                color: "#176944",
                textAlign: "center",
                fontWeight: "700",
              }}
            >
              Carregar mais avisos
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
