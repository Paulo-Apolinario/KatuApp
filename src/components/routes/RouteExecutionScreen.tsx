import { initialRouteId, routeStartIssues } from "@/src/utils/routeReadiness";
import { useCallback, useRef, useState } from "react";
import {
  AppState,
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  routeService,
  RouteItem,
  translateRouteStatus,
} from "@/src/services/routeService";
import {
  collectionService,
  translateCollectionStatus,
} from "@/src/services/collectionService";
import {
  collectionOrigin,
  validCoordinates,
} from "@/src/utils/collectionOrigin";
import { useAuth } from "@/src/contexts/AuthContext";
import { useConnectivity } from "@/src/hooks/useConnectivity";
import { OfflineBanner } from "@/src/components/OfflineBanner";
import { NotificationBell } from "@/src/components/NotificationBell";
import type { Collection } from "@/src/types/collection";
const pending = (c: Collection) =>
  c.status === "PENDING" || c.status === "IN_PROGRESS";
export default function RouteExecutionScreen() {
  const { user } = useAuth(),
    { isOffline } = useConnectivity(),
    insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ highlightRouteId?: string }>();
  const [routes, setRoutes] = useState<RouteItem[]>([]),
    [detail, setDetail] = useState<RouteItem | null>(null),
    [loading, setLoading] = useState(true),
    [refreshing, setRefreshing] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [skip, setSkip] = useState<string[]>([]),
    [occurrence, setOccurrence] = useState<Collection | null>(null),
    [reason, setReason] = useState("");
  const selected = useRef<string | null>(params.highlightRouteId || null),
    working = useRef(false),
    mounted = useRef(false);
  const collectorId =
    user?.role === "COLLECTOR" ? user.collector?.id : undefined;
  const load = useCallback(async (show = false) => {
    if (working.current) return;
    working.current = true;
    if (show) setRefreshing(true);
    try {
      const rows = await routeService.list();
      if (!mounted.current) return;
      setRoutes(rows);
      const id = selected.current || initialRouteId(rows);
      if (id && rows.some((r) => r.id === id)) {
        const r = await routeService.getById(id);
        const mine = await collectionService.list();
        const known = new Map(mine.map((c) => [c.id, c]));
        // A fila offline pode conter conclusão mais recente que a última consulta da rota.
        r.collections = (r.collections || []).map((c) =>
          known.get(c.id)?.syncStatus === "PENDING" ? known.get(c.id)! : c,
        );
        if (mounted.current) {
          selected.current = id;
          setDetail(r);
        }
      } else if (mounted.current) {
        selected.current = null;
        setDetail(null);
      }
      if (mounted.current) setError("");
    } catch (e: any) {
      if (mounted.current)
        setError(e.message || "Não foi possível carregar a rota.");
    } finally {
      working.current = false;
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      mounted.current = true;
      if (params.highlightRouteId) selected.current = params.highlightRouteId;
      void load();
      const timer = setInterval(() => {
        if (AppState.currentState === "active") void load();
      }, 30000);
      return () => {
        mounted.current = false;
        clearInterval(timer);
      };
    }, [load, params.highlightRouteId]),
  );
  async function action(status: "IN_PROGRESS" | "COMPLETED") {
    if (!detail || busy) return;
    if (status === "IN_PROGRESS" && routeStartIssues(detail).length) {
      setError(
        "Aguardando preparação da rota pela cooperativa. Atualize os dados após a liberação.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const value = await routeService.fieldStatus(detail.id, status);
      setDetail(value);
      await load();
    } catch (e: any) {
      setError(
        e.message ||
          "Não foi possível atualizar a execução. É necessário estar conectado.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function navigate(c: Collection) {
    const p = collectionOrigin(c);
    if (!p || !validCoordinates(p.latitude, p.longitude))
      return setError(
        "Ponto sem coordenadas. Solicite a correção à cooperativa.",
      );
    try {
      await Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}&travelmode=driving`,
      );
    } catch {
      setError("Não foi possível abrir a navegação.");
    }
  }
  async function saveOccurrence() {
    if (!detail || !occurrence || busy) return;
    if (reason.trim().length < 5)
      return setError("Informe o motivo com ao menos 5 caracteres.");
    setBusy(true);
    try {
      await routeService.occurrence(detail.id, occurrence.id, reason.trim());
      setOccurrence(null);
      setReason("");
      await load();
    } catch (e: any) {
      setError(e.message || "Não foi possível registrar a ocorrência.");
    } finally {
      setBusy(false);
    }
  }
  const points = (detail?.collections || []).filter(
      (c) => c.cancellationReason !== "Substituída por revisão do roteiro fixo",
    ),
    active = points.filter(pending),
    ordered = [
      ...active.filter((c) => c.status === "IN_PROGRESS"),
      ...active.filter(
        (c) => c.status !== "IN_PROGRESS" && !skip.includes(c.id),
      ),
      ...active.filter(
        (c) => c.status !== "IN_PROGRESS" && skip.includes(c.id),
      ),
    ],
    next = ordered[0],
    completed = points.filter((c) => !pending(c)).length;
  const Button = ({
    label,
    onPress,
    disabled = false,
  }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
  }) => (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, disabled && { opacity: 0.45 }]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#14532d", "#047857"]}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </Pressable>
          <Text style={styles.heading}>Minhas rotas</Text>
          <NotificationBell />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Recarregar rotas"
            onPress={() => void load(true)}
          >
            <Ionicons name="refresh" color="white" size={24} />
          </Pressable>
        </View>
        <Text style={styles.subtitle}>
          Sua sequência de atendimento e próxima parada
        </Text>
      </LinearGradient>
      <OfflineBanner visible={isOffline} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 32 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
          />
        }
      >
        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
        {loading ? (
          <ActivityIndicator color="#047857" />
        ) : (
          <>
            {!routes.length && (
              <View style={styles.card}>
                <Ionicons name="map-outline" size={40} color="#047857" />
                <Text style={styles.title}>Nenhuma rota atribuída</Text>
                <Text style={styles.text}>
                  A cooperativa poderá vincular você às próximas execuções.
                </Text>
              </View>
            )}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
            >
              {routes.map((r) => (
                <Pressable
                  accessibilityRole="button"
                  key={r.id}
                  onPress={() => {
                    if (working.current) return;
                    selected.current = r.id;
                    setSkip([]);
                    setDetail(null);
                    void load(true);
                  }}
                  style={[
                    styles.chip,
                    detail?.id === r.id && { backgroundColor: "#d1fae5" },
                  ]}
                >
                  <Text style={styles.chipText}>{r.name}</Text>
                  <Text style={styles.text}>
                    {r.scheduledDate
                      ? new Date(r.scheduledDate).toLocaleDateString("pt-BR", {
                          timeZone: "America/Fortaleza",
                        })
                      : "Data a definir"}{" "}
                    · {translateRouteStatus(r.status)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            {detail && (
              <>
                <View style={styles.card}>
                  <Text style={styles.eyebrow}>
                    {detail.planId ? "EXECUÇÃO DE ROTA FIXA" : "ROTA AVULSA"}
                  </Text>
                  <Text style={styles.title}>{detail.name}</Text>
                  <Text style={styles.text}>
                    {detail.scheduledDate
                      ? new Date(detail.scheduledDate).toLocaleString("pt-BR", {
                          timeZone: "America/Fortaleza",
                        })
                      : "Programação pendente"}
                  </Text>
                  <Text style={styles.text}>
                    {detail.driver?.name || "Motorista a definir"} ·{" "}
                    {detail.vehicle?.plate || "Veículo a definir"}
                  </Text>
                  <Text style={styles.text}>
                    Saída:{" "}
                    {detail.startPoint?.name ||
                      detail.cooperative?.name ||
                      "Não definida"}{" "}
                    · Destino: {detail.endPoint?.name || "Não definido"}
                  </Text>
                  {detail.description ? (
                    <Text style={styles.text}>{detail.description}</Text>
                  ) : null}
                  <View style={styles.track}>
                    <View
                      style={[
                        styles.progress,
                        {
                          width: points.length
                            ? `${(completed / points.length) * 100}%`
                            : "0%",
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.chipText}>
                    {completed} de {points.length} pontos encerrados ·{" "}
                    {active.length} pendentes
                  </Text>
                  {(isOffline || detail.fromCache) && (
                    <Text style={styles.text}>
                      Sequência salva no aparelho. Atualizações da cooperativa e
                      ocorrências exigem conexão.
                    </Text>
                  )}
                  {detail.status === "SCHEDULED" &&
                    routeStartIssues(detail).length > 0 && (
                      <View
                        accessibilityRole="alert"
                        style={{
                          backgroundColor: "#FFF7ED",
                          borderRadius: 12,
                          padding: 14,
                          gap: 6,
                        }}
                      >
                        <Text style={[styles.title, { fontSize: 16 }]}>
                          Aguardando preparação pela cooperativa
                        </Text>
                        <Text style={styles.text}>
                          A definição da data, do motorista e do veículo é feita
                          pela cooperativa. Pendências desta execução:
                        </Text>
                        {routeStartIssues(detail).map((issue) => (
                          <Text key={issue} style={styles.text}>
                            • {issue}
                          </Text>
                        ))}
                        <Text style={styles.text}>
                          Após a cooperativa ajustar a execução, toque em
                          atualizar. Você poderá confirmar a saída quando os
                          dados estiverem completos.
                        </Text>
                      </View>
                    )}
                  {detail.status === "SCHEDULED" && (
                    <Button
                      label="Confirmar saída e iniciar rota"
                      disabled={
                        busy || isOffline || routeStartIssues(detail).length > 0
                      }
                      onPress={() => void action("IN_PROGRESS")}
                    />
                  )}
                  {detail.status === "IN_PROGRESS" && !active.length && (
                    <Button
                      label="Concluir execução"
                      disabled={busy || isOffline}
                      onPress={() => void action("COMPLETED")}
                    />
                  )}
                </View>
                {next && (
                  <View style={[styles.card, styles.next]}>
                    <Text style={styles.eyebrow}>
                      PRÓXIMA PARADA · PONTO{" "}
                      {points.findIndex((c) => c.id === next.id) + 1}
                    </Text>
                    <Text style={styles.title}>
                      {collectionOrigin(next)?.name || "Ponto de coleta"}
                    </Text>
                    <Text style={styles.text}>
                      {collectionOrigin(next)?.address ||
                        "Endereço não informado"}
                    </Text>
                    {next.routePoint?.notes ? (
                      <Text style={styles.text}>{next.routePoint.notes}</Text>
                    ) : null}
                    {next.routePoint?.materials ? (
                      <Text style={styles.text}>
                        Previsto: {next.routePoint.materials}
                      </Text>
                    ) : null}
                    <Button
                      label="Navegar até o ponto"
                      onPress={() => void navigate(next)}
                    />
                    {(collectorId === next.collectorId ||
                      next.participants?.some(
                        (p) => p.collectorId === collectorId,
                      )) && (
                      <Button
                        label="Atender este ponto"
                        disabled={detail.status !== "IN_PROGRESS"}
                        onPress={() =>
                          router.push({
                            pathname: "/(catador)/collect",
                            params: { highlightCollectionId: next.id },
                          })
                        }
                      />
                    )}
                    <Text style={styles.text}>
                      Responsável:{" "}
                      {next.collector?.name || "Consulte a cooperativa"}
                    </Text>
                  </View>
                )}
                <Text style={[styles.title, { marginVertical: 12 }]}>
                  Sequência de visitas
                </Text>
                {points.map((c, i) => (
                  <View
                    key={c.id}
                    style={[
                      styles.card,
                      next?.id === c.id && { borderColor: "#059669" },
                    ]}
                  >
                    <View style={styles.row}>
                      <View style={styles.number}>
                        <Text style={styles.chipText}>{i + 1}</Text>
                      </View>
                      <Text style={[styles.title, { flex: 1, fontSize: 17 }]}>
                        {collectionOrigin(c)?.name || "Ponto de coleta"}
                      </Text>
                    </View>
                    <Text style={styles.text}>
                      {collectionOrigin(c)?.address || "Endereço não informado"}
                    </Text>
                    <Text style={styles.chipText}>
                      {translateCollectionStatus(c.status)}
                    </Text>
                    {c.cancellationReason ? (
                      <Text style={styles.text}>{c.cancellationReason}</Text>
                    ) : null}
                    {pending(c) && (
                      <>
                        <Button
                          label="Ver percurso até este ponto"
                          onPress={() => void navigate(c)}
                        />
                        {detail.status === "IN_PROGRESS" &&
                          c.status === "PENDING" && (
                            <View style={styles.row}>
                              <Pressable
                                accessibilityRole="button"
                                onPress={() =>
                                  setSkip((s) => [
                                    ...s.filter((id) => id !== c.id),
                                    c.id,
                                  ])
                                }
                                style={styles.smallButton}
                              >
                                <Text style={styles.chipText}>
                                  Deixar para depois
                                </Text>
                              </Pressable>
                              <Pressable
                                accessibilityRole="button"
                                disabled={isOffline}
                                onPress={() => {
                                  setReason("");
                                  setOccurrence(c);
                                }}
                                style={styles.smallButton}
                              >
                                <Text style={styles.chipText}>
                                  Visita não realizada
                                </Text>
                              </Pressable>
                            </View>
                          )}
                      </>
                    )}
                  </View>
                ))}
                {skip.length > 0 && (
                  <Text style={styles.text}>
                    “Deixar para depois” altera apenas sua indicação de próxima
                    parada nesta tela. A sequência oficial permanece a salva
                    pela cooperativa.
                  </Text>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
      <Modal
        visible={!!occurrence}
        transparent
        animationType="fade"
        onRequestClose={() => !busy && setOccurrence(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.title}>Registrar visita não realizada</Text>
            <Text style={styles.text}>
              Informe local fechado, ausência de material ou impedimento. O
              atendimento será encerrado sem peso ou entrada em estoque.
            </Text>
            <TextInput
              accessibilityLabel="Motivo da visita não realizada"
              style={styles.input}
              multiline
              maxLength={1000}
              value={reason}
              onChangeText={setReason}
              placeholder="Descreva o motivo"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button
              label={busy ? "Salvando…" : "Confirmar ocorrência"}
              disabled={busy || reason.trim().length < 5}
              onPress={() => void saveOccurrence()}
            />
            <Button
              label="Voltar"
              disabled={busy}
              onPress={() => setOccurrence(null)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f1f5f3" },
  header: { padding: 20 },
  row: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },
  heading: { fontSize: 23, fontWeight: "800", color: "white", flex: 1 },
  subtitle: { color: "#d1fae5", marginTop: 10, fontSize: 14 },
  content: { padding: 16, width: "100%", maxWidth: 900, alignSelf: "center" },
  card: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#dce7e0",
    marginBottom: 12,
    gap: 9,
  },
  next: { backgroundColor: "#ecfdf5", borderColor: "#047857" },
  title: { fontSize: 21, fontWeight: "800", color: "#14532d" },
  text: { color: "#475569", fontSize: 14, lineHeight: 21 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    color: "#047857",
  },
  button: {
    backgroundColor: "#047857",
    borderRadius: 11,
    padding: 13,
    minHeight: 44,
    alignItems: "center",
    marginTop: 5,
  },
  buttonText: { color: "white", fontWeight: "700", fontSize: 14 },
  smallButton: { paddingVertical: 12, paddingHorizontal: 4 },
  chip: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#dce7e0",
    maxWidth: 280,
  },
  chipText: { color: "#14532d", fontWeight: "700", fontSize: 13 },
  number: { backgroundColor: "#d1fae5", padding: 10, borderRadius: 10 },
  track: {
    height: 7,
    backgroundColor: "#e2e8f0",
    borderRadius: 7,
    overflow: "hidden",
    marginTop: 10,
  },
  progress: { height: 7, backgroundColor: "#059669" },
  error: {
    backgroundColor: "#fff1f2",
    color: "#9f1239",
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.45)",
    justifyContent: "center",
    padding: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "#94a3b8",
    borderRadius: 10,
    padding: 12,
    minHeight: 90,
    color: "#1e293b",
  },
});
