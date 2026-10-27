import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useInbox } from "@/src/contexts/InboxContext";
import { unitLabel } from "@/src/utils/materials";
import { useCallback, useEffect, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  useWindowDimensions,
  StyleSheet,
  Modal,
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
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const [items, setItems] = useState<InboxNotice[]>([]),
    [unread, setUnread] = useState(0),
    [cursor, setCursor] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [detailVisible, setDetailVisible] = useState(false),
    [detail, setDetail] = useState<{ id: string; status: string } | null>(null);
  const refresh = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const data = await loadInbox(userId);
      setLoaded(true);
      setItems(data.notifications);
      setUnread(data.unreadCount);
      setCursor(data.nextCursor);
    } catch {
      const cached = await cachedInbox(userId);
      if (cached) {
        setLoaded(true);
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
  const [opening, setOpening] = useState<string | null>(null);
  async function open(item: InboxNotice) {
    if (opening) return;
    setOpening(item.id);
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
      if (
        item.data?.pevRequestId &&
        ["PF", "COLLECTOR", "COOPERATIVE"].includes(user?.role || "")
      ) {
        router.push({
          pathname:
            user?.role === "PF"
              ? "/(pf-tabs)/pevs-publicos"
              : user?.role === "COLLECTOR"
                ? "/(catador)/pev-atendimento"
                : "/(cooperativa)/pev-pedidos",
          params: { requestId: item.data.pevRequestId },
        });
      } else if (
        item.data?.routeId &&
        (user?.role === "COLLECTOR" || user?.role === "DRIVER")
      ) {
        router.push({
          pathname:
            user.role === "DRIVER"
              ? "/(motorista)/rotas"
              : "/(catador)/roteiro",
          params: { highlightRouteId: item.data.routeId },
        });
      } else if (item.collectionId) {
        const data = await api.get<{
          collection: { id: string; status: string };
        }>(`/collections/${encodeURIComponent(item.collectionId)}`, true);
        setDetail(data.collection);
        setDetailVisible(true);
      }
    } catch {
      setError(
        "Não foi possível atualizar a leitura ou abrir a coleta. O aviso permanece disponível para consulta.",
      );
    } finally {
      setOpening(null);
    }
  }

  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<"ALL" | "UNREAD">("ALL");
  const visible =
    filter === "UNREAD" ? items.filter((item) => !item.readAt) : items;
  const { updateUnread } = useInbox();
  useEffect(() => {
    if (loaded) updateUnread(unread);
  }, [unread, updateUnread, loaded]);
  const [marking, setMarking] = useState(false);
  async function markAll() {
    if (marking || busy || !unread) return;
    setMarking(true);
    try {
      await readAllNotices();
      await refresh();
    } catch {
      setError(
        "Não foi possível marcar os avisos como lidos. Tente novamente quando estiver conectado.",
      );
    } finally {
      setMarking(false);
    }
  }
  return (
    <SafeAreaView edges={["bottom"]} style={styles.screen}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={busy}
            onRefresh={refresh}
            tintColor="#17694F"
          />
        }
        contentContainerStyle={styles.scroll}
      >
        <LinearGradient
          colors={["#123C35", "#17694F"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.shell}>
            <View style={styles.headerRow}>
              <IconButton
                label="Voltar"
                icon="arrow-back"
                onPress={() =>
                  router.canGoBack() ? router.back() : router.replace("/")
                }
              />
              <View style={{ flex: 1, paddingHorizontal: 12 }}>
                <Text
                  style={[
                    styles.eyebrow,
                    width < 360 && { fontSize: 9, letterSpacing: 1 },
                  ]}
                >
                  CENTRAL DE ATUALIZAÇÕES
                </Text>
                <Text
                  accessibilityRole="header"
                  style={[styles.title, width < 360 && { fontSize: 24 }]}
                >
                  Notificações
                </Text>
              </View>
              <IconButton
                label="Atualizar avisos"
                icon="refresh-outline"
                onPress={refresh}
                disabled={busy}
              />
            </View>
            <Text style={styles.subtitle}>
              Acompanhe o recebimento, a conferência e as etapas das suas
              coletas.
            </Text>
            <View style={styles.heroStatus}>
              <View style={styles.statusDot} />
              <Text style={styles.heroStatusText}>
                {(busy || !loaded) && !error && !items.length
                  ? "Buscando atualizações..."
                  : error && !items.length
                    ? "Atualização indisponível no momento"
                    : unread
                      ? `${unread} ${unread === 1 ? "atualização não lida" : "atualizações não lidas"}`
                      : "Você está em dia com suas atualizações"}
              </Text>
            </View>
          </View>
        </LinearGradient>
        <View style={[styles.shell, styles.body]}>
          <View style={styles.tools}>
            <View style={styles.filters}>
              <FilterChip
                label="Todas"
                selected={filter === "ALL"}
                onPress={() => setFilter("ALL")}
              />
              <FilterChip
                label="Não lidas"
                selected={filter === "UNREAD"}
                onPress={() => setFilter("UNREAD")}
              />
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              disabled={marking || busy || !unread}
              accessibilityLabel="Marcar todas como lidas"
              onPress={markAll}
              style={[styles.markAll, { opacity: unread ? 1 : 0.45 }]}
            >
              <Ionicons
                name="checkmark-done-outline"
                size={17}
                color="#17694F"
              />
              <Text style={styles.markAllText}>Marcar todas como lidas</Text>
            </TouchableOpacity>
          </View>
          {!!error && (
            <View accessibilityLiveRegion="polite" style={styles.error}>
              <Ionicons
                name="cloud-offline-outline"
                size={20}
                color="#9A641C"
              />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          {(busy || !loaded) && !items.length && !error ? (
            <View style={styles.empty}>
              <ActivityIndicator color="#17694F" size="large" />
              <Text style={styles.emptySubtitle}>
                Carregando suas atualizações...
              </Text>
            </View>
          ) : (
            !visible.length && (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <Ionicons
                    name={
                      error && !items.length
                        ? "cloud-offline-outline"
                        : filter === "UNREAD"
                          ? "checkmark-done-outline"
                          : "notifications-outline"
                    }
                    size={36}
                    color="#17694F"
                  />
                </View>
                <Text accessibilityRole="header" style={styles.emptyTitle}>
                  {error && !items.length
                    ? "Não foi possível atualizar a central"
                    : filter === "UNREAD"
                      ? "Nenhum aviso não lido nesta página"
                      : "Tudo tranquilo por aqui"}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {error && !items.length
                    ? "Seus avisos serão atualizados quando a conexão estiver disponível. Tente novamente pelo botão de atualizar."
                    : filter === "UNREAD"
                      ? cursor
                        ? "Há mais avisos no histórico. Carregue a próxima página para continuar a consulta."
                        : "Você já consultou as atualizações disponíveis. Confira o histórico na opção Todas."
                      : "Quando a cooperativa atualizar uma coleta, o aviso aparecerá aqui com os detalhes do registro."}
                </Text>
                {filter === "UNREAD" && (
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => setFilter("ALL")}
                    style={styles.emptyAction}
                  >
                    <Text style={styles.emptyActionText}>
                      Ver todas as notificações
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )
          )}
          {visible.map((item) => (
            <NoticeCard
              key={item.id}
              item={item}
              onPress={() => open(item)}
              disabled={opening !== null}
            />
          ))}
          {busy && items.length > 0 && (
            <ActivityIndicator style={{ margin: 16 }} color="#17694F" />
          )}
          {cursor && (
            <TouchableOpacity
              accessibilityRole="button"
              disabled={busy}
              accessibilityLabel="Carregar mais avisos"
              onPress={more}
              style={styles.loadMore}
            >
              <Text style={styles.emptyActionText}>Carregar mais avisos</Text>
              <Ionicons name="chevron-down" size={18} color="#17694F" />
            </TouchableOpacity>
          )}
          {!!items.length && (
            <Text style={styles.footer}>
              Atualizações da operação · horários de Fortaleza
            </Text>
          )}
        </View>
      </ScrollView>
      <Modal
        visible={detailVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailVisible(false)}
      >
        <ScrollView
          style={{ flex: 1, backgroundColor: "rgba(12,34,24,0.5)" }}
          contentContainerStyle={styles.backdrop}
        >
          <View accessibilityViewIsModal style={styles.detail}>
            <View style={styles.detailTop}>
              <View style={styles.cardIcon}>
                <Ionicons name="cube-outline" size={24} color="#17694F" />
              </View>
              <Text accessibilityRole="header" style={styles.detailTitle}>
                Detalhes da coleta
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Fechar detalhes"
                onPress={() => setDetailVisible(false)}
                style={styles.close}
              >
                <Ionicons name="close" size={24} color="#526458" />
              </TouchableOpacity>
            </View>
            <Text style={styles.detailLabel}>REFERÊNCIA DA COLETA</Text>
            <Text selectable style={styles.reference}>
              {detail?.id}
            </Text>
            <View style={styles.detailStatus}>
              <Ionicons
                name="checkmark-circle-outline"
                size={20}
                color="#17694F"
              />
              <Text style={styles.detailStatusText}>
                Etapa atual: {stageLabel(detail?.status)}
              </Text>
            </View>
            <Text style={styles.emptySubtitle}>
              Esta é a etapa registrada no sistema no momento da consulta.
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setDetailVisible(false)}
              style={styles.done}
            >
              <Text style={styles.doneText}>Concluído</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Modal>
    </SafeAreaView>
  );
}
function stageLabel(status?: string) {
  return (
    (
      {
        RECEIVED: "Recebida",
        SORTING: "Em triagem",
        COMPLETED: "Concluída",
        COLLECTED: "Finalizada em campo",
        CANCELLED: "Cancelada",
        PENDING: "Pendente",
        IN_PROGRESS: "Em andamento",
      } as Record<string, string>
    )[status || ""] ||
    status ||
    "Não informada"
  );
}
function IconButton({
  label,
  icon,
  onPress,
  disabled = false,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={[styles.iconButton, { opacity: disabled ? 0.5 : 1 }]}
    >
      <Ionicons name={icon} size={22} color="#FFFFFF" />
    </TouchableOpacity>
  );
}
function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.filter, selected && styles.filterSelected]}
    >
      <Text style={[styles.filterText, selected && styles.filterTextSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
function NoticeCard({
  item,
  onPress,
  disabled,
}: {
  item: InboxNotice;
  onPress: () => void;
  disabled: boolean;
}) {
  const weighing = item.kind === "QUANTITY_REVIEW";
  const routing = item.kind === "ROUTE_UPDATED";
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${item.readAt ? "Lida" : "Não lida"}: ${item.title}`}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[styles.card, !item.readAt && styles.unreadCard]}
    >
      <View style={styles.cardTop}>
        <View
          style={[styles.cardIcon, weighing && { backgroundColor: "#FFF5E5" }]}
        >
          <Ionicons
            name={
              weighing
                ? "scale-outline"
                : routing
                  ? "navigate-outline"
                  : "layers-outline"
            }
            size={22}
            color={weighing ? "#9A641C" : "#17694F"}
          />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.cardMeta}>
            <Text style={styles.category}>
              {weighing
                ? "CONFERÊNCIA DE QUANTIDADE"
                : routing
                  ? "PROGRAMAÇÃO DA ROTA"
                  : "ETAPA DA COLETA"}
            </Text>
            {!item.readAt && (
              <View style={styles.newBadge}>
                <View style={styles.newDot} />
                <Text style={styles.newText}>Não lida</Text>
              </View>
            )}
          </View>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.time}>{stamp(item.createdAt)}</Text>
        </View>
      </View>
      {item.data?.items?.length ? (
        <View style={styles.cardContent}>
          {item.data.items.map((material, index) => (
            <View key={index} style={styles.material}>
              <Text style={styles.materialName}>{material.name}</Text>
              <View style={styles.quantities}>
                <View style={styles.quantityBox}>
                  <Text style={styles.quantityLabel}>Informado em campo</Text>
                  <Text style={styles.originalAmount}>
                    {amount(material.reportedQuantity)}{" "}
                    <Text style={styles.unit}>{unitLabel(material.unit)}</Text>
                  </Text>
                </View>
                <Ionicons name="arrow-forward" size={18} color="#8BA096" />
                <View style={[styles.quantityBox, styles.confirmedBox]}>
                  <Text style={styles.quantityLabel}>Conferido</Text>
                  <Text style={styles.confirmedAmount}>
                    {amount(material.confirmedQuantity)}{" "}
                    <Text style={styles.unit}>{unitLabel(material.unit)}</Text>
                  </Text>
                </View>
              </View>
              {material.previousQuantity !== material.reportedQuantity && (
                <Text style={styles.time}>
                  Conferência anterior: {amount(material.previousQuantity)}{" "}
                  {unitLabel(material.unit)}
                </Text>
              )}
            </View>
          ))}
          <View style={styles.reason}>
            <Text style={styles.reasonTitle}>Justificativa da cooperativa</Text>
            <Text style={styles.message}>{item.data.reason}</Text>
            {!!item.data.actorName && (
              <Text style={styles.actor}>
                Registrado por {item.data.actorName}
              </Text>
            )}
          </View>
        </View>
      ) : (
        <Text style={styles.message}>{item.message}</Text>
      )}
      {(item.collectionId || item.data?.routeId || item.data?.pevRequestId) && (
        <View style={styles.cardFooter}>
          <Text style={styles.link}>
            {item.data?.pevRequestId
              ? "Consultar pedido do PEV"
              : item.data?.routeId
                ? "Consultar rota e sequência"
                : "Consultar etapa da coleta"}
          </Text>
          <Ionicons name="arrow-forward" size={18} color="#17694F" />
        </View>
      )}
    </TouchableOpacity>
  );
}
const amount = (value: number) =>
  Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F2F6F4" },
  scroll: { flexGrow: 1, paddingBottom: 32 },
  shell: { width: "100%", maxWidth: 920, alignSelf: "center" },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerRow: { flexDirection: "row", alignItems: "center" },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.4,
    color: "#C4E6D7",
  },
  title: { fontSize: 28, fontWeight: "700", color: "#FFFFFF", marginTop: 5 },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: "#D8EEE3",
    marginTop: 18,
    maxWidth: 580,
  },
  heroStatus: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    gap: 8,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#B6E6BA",
  },
  heroStatusText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
  body: { paddingHorizontal: 20, paddingTop: 22 },
  tools: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },
  filters: {
    flexDirection: "row",
    padding: 4,
    backgroundColor: "#E4ECE7",
    borderRadius: 14,
    gap: 4,
  },
  filter: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 11,
    minHeight: 40,
    justifyContent: "center",
  },
  filterSelected: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#133E2D",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  filterText: { fontSize: 13, color: "#65796C", fontWeight: "600" },
  filterTextSelected: { color: "#17694F" },
  markAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
  },
  markAllText: { fontSize: 12, fontWeight: "600", color: "#17694F" },
  error: {
    padding: 14,
    backgroundColor: "#FFF5E5",
    borderRadius: 14,
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  errorText: { fontSize: 13, color: "#805819", lineHeight: 20, flex: 1 },
  empty: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 24,
    paddingVertical: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E0E9E3",
    alignItems: "center",
    marginTop: 8,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 26,
    backgroundColor: "#EAF5EE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 21,
    fontWeight: "700",
    color: "#203D30",
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: "#6B7D72",
    textAlign: "center",
    maxWidth: 440,
    marginTop: 12,
  },
  emptyAction: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#EAF5EE",
    borderRadius: 12,
    marginTop: 20,
  },
  emptyActionText: { color: "#17694F", fontSize: 13, fontWeight: "700" },
  card: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E0E9E3",
    marginBottom: 14,
  },
  unreadCard: { borderColor: "#B7D7C5" },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  cardIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "#EAF5EE",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  category: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
    color: "#668574",
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#203D30",
    lineHeight: 24,
    marginTop: 5,
  },
  time: { fontSize: 11, color: "#7D8C82", lineHeight: 17, marginTop: 6 },
  newBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  newDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#23815A" },
  newText: { fontSize: 10, fontWeight: "600", color: "#23815A" },
  message: { fontSize: 14, lineHeight: 22, color: "#5E7065", marginTop: 14 },
  cardContent: { marginTop: 12 },
  material: { marginTop: 8 },
  materialName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#294B38",
    marginBottom: 10,
  },
  quantities: { flexDirection: "row", alignItems: "center", gap: 10 },
  quantityBox: {
    flex: 1,
    minWidth: 0,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#F4F6F5",
  },
  confirmedBox: { backgroundColor: "#EAF5EE" },
  quantityLabel: { fontSize: 10, color: "#6B7D72", lineHeight: 15 },
  originalAmount: {
    fontSize: 22,
    color: "#52665A",
    fontWeight: "600",
    marginTop: 6,
  },
  confirmedAmount: {
    fontSize: 22,
    color: "#17694F",
    fontWeight: "700",
    marginTop: 6,
  },
  unit: { fontSize: 12, fontWeight: "500" },
  reason: { marginTop: 16 },
  reasonTitle: { fontSize: 11, fontWeight: "700", color: "#5E7065" },
  actor: { fontSize: 11, color: "#7D8C82", marginTop: 8 },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#EDF2EE",
    marginTop: 18,
    paddingTop: 14,
  },
  link: { fontSize: 12, fontWeight: "700", color: "#17694F", flex: 1 },
  loadMore: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D9E6DE",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  footer: {
    fontSize: 11,
    color: "#87988D",
    textAlign: "center",
    marginTop: 14,
  },
  backdrop: {
    flexGrow: 1,
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  detail: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 540,
  },
  detailTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
  },
  detailTitle: { fontSize: 19, fontWeight: "700", color: "#203D30", flex: 1 },
  close: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  detailLabel: {
    fontSize: 10,
    color: "#7D8C82",
    fontWeight: "700",
    letterSpacing: 1,
  },
  reference: { fontSize: 13, color: "#385A45", marginTop: 8 },
  detailStatus: {
    backgroundColor: "#EAF5EE",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 20,
  },
  detailStatusText: {
    color: "#17694F",
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  done: {
    backgroundColor: "#17694F",
    borderRadius: 13,
    padding: 15,
    marginTop: 22,
  },
  doneText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
});
