import { ResidentialPage } from "../../components/residential/ResidentialPage";
import { residentialDate } from "../../utils/residential";
import { NotificationBell } from "../../components/NotificationBell";
import { useCallback, useEffect, useRef, useState } from "react";
import { Image, Linking, Platform, Text, View, StyleSheet } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Ionicons } from "@expo/vector-icons";
import {
  Workspace,
  Card,
  Field,
  Action,
  Notice,
} from "../../components/ui/Workspace";
import OperationalMap from "../../components/maps/OperationalMap";
import { useAuth } from "../../contexts/AuthContext";
import { useConnectivity } from "../../hooks/useConnectivity";
import { newExtraId } from "../../services/extraOrderService";
import {
  pevRequestService as service,
  pevStatus,
  pevCondition,
  type PevPoint,
  type PevRequest,
} from "../../services/pevRequestService";
type Draft = {
  id: string;
  point: PevPoint | null;
  condition: string;
  notes: string;
  photos: string[];
};
const fresh = (): Draft => ({
  id: newExtraId(),
  point: null,
  condition: "FULL",
  notes: "",
  photos: [],
});

export default function PevRequestsScreen() {
  const { user } = useAuth(),
    { isOffline } = useConnectivity(),
    isOnline = !isOffline,
    params = useLocalSearchParams<{ requestId?: string }>();
  const Shell = user?.role === "PF" ? ResidentialPage : Workspace;
  const date = (v: string) => user?.role === "PF" ? residentialDate(v) : new Date(v).toLocaleString("pt-BR");
  const coop = user?.role === "COOPERATIVE",
    collector = user?.role === "COLLECTOR";
  const [tab, setTab] = useState<"POINTS" | "REQUESTS">(
      coop || user?.role === "PF" ? "REQUESTS" : "POINTS",
    ),
    [points, setPoints] = useState<PevPoint[]>([]),
    [pointPage, setPointPage] = useState(1),
    [pointTotal, setPointTotal] = useState(0),
    [search, setSearch] = useState(""),
    [appliedSearch, setAppliedSearch] = useState("");
  const [requests, setRequests] = useState<PevRequest[]>([]),
    [requestPage, setRequestPage] = useState(1),
    [requestTotal, setRequestTotal] = useState(0),
    [detail, setDetail] = useState<PevRequest | null>(null),
    [draft, setDraft] = useState<Draft>(fresh),
    [form, setForm] = useState(false),
    [loadedDraft, setLoadedDraft] = useState(false);
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [notes, setNotes] = useState(""),
    [photos, setPhotos] = useState<string[]>([]),
    [ack, setAck] = useState(false);
  const guard = useRef(false),
    identity = useRef(user?.id),
    draftLoadedOwner = useRef<string | null>(null),
    saveKey = user?.id ? `@katu:pev-request-draft:v1:${user.id}` : null;
  identity.current = user?.id;
  const operation = useRef<{ id: string; fingerprint: string } | null>(null);
  useEffect(() => {
    setRequests([]);
    setPoints([]);
    setDetail(null);
    setNotes("");
    setPhotos([]);
    setAck(false);
    setForm(false);
    setNotice("");
    setError("");
    operation.current = null;
  }, [user?.id]);
  useEffect(() => {
    let alive = true;
    setLoadedDraft(false);
    if (!saveKey) return;
    const owner = user?.id;
    if (!owner) return;
    void AsyncStorage.getItem(saveKey).then((v) => {
      if (alive && identity.current === owner) {
        try {
          const p = v ? JSON.parse(v) : null;
          setDraft(p?.id && Array.isArray(p.photos) ? p : fresh());
        } catch {
          setDraft(fresh());
        }
        draftLoadedOwner.current = owner;
        setLoadedDraft(true);
      }
    });
    return () => {
      alive = false;
    };
  }, [saveKey, user?.id]);
  useEffect(() => {
    if (loadedDraft && saveKey && draftLoadedOwner.current === user?.id)
      void AsyncStorage.setItem(saveKey, JSON.stringify(draft)).catch(() =>
        setError("Não foi possível guardar o rascunho neste aparelho."),
      );
  }, [draft, loadedDraft, saveKey, user?.id]);
  const load = useCallback(async () => {
    const owner = user?.id;
    if (!owner) return;
    setLoading(true);
    try {
      const data = await service.list(requestPage);
      if (identity.current !== owner) return;
      setRequests(data.requests);
      setRequestTotal(data.total);
      if (!coop) {
        const p = await service.points(appliedSearch, pointPage);
        if (identity.current !== owner) return;
        setPoints(p.bins);
        setPointTotal(p.total);
      }
    } catch (e: any) {
      if (identity.current === owner) setError(e.message);
    } finally {
      if (identity.current === owner) setLoading(false);
    }
  }, [user?.id, requestPage, coop, pointPage, appliedSearch]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  const open = useCallback(
    async (id: string, page = 1) => {
      const owner = user?.id;
      try {
        const r = await service.detail(id, page);
        if (identity.current === owner) {
          setDetail(r);
          setForm(false);
          setTab("REQUESTS");
          setError("");
        }
      } catch (e: any) {
        if (identity.current === owner) setError(e.message);
      }
    },
    [user?.id],
  );
  useEffect(() => {
    if (params.requestId) void open(params.requestId);
  }, [params.requestId, open]);
  useEffect(() => {
    if (!detail?.id || !isOnline) return;
    const id = detail.id;
    const timer = setInterval(() => {
      void service
        .detail(id, detail.updatesPage || 1)
        .then((r) => {
          if (identity.current === user?.id)
            setDetail((old) => (old?.id === id ? r : old));
        })
        .catch(() => {});
    }, 30000);
    return () => clearInterval(timer);
  }, [detail?.id, detail?.updatesPage, isOnline, user?.id]);
  async function run(fn: () => Promise<void>, allowOffline = false) {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (!isOnline && !allowOffline)
        throw Error(
          "Conecte-se para enviar. O rascunho do novo pedido permanece neste aparelho.",
        );
      await fn();
    } catch (e: any) {
      setError(
        e.message ||
          "Não foi possível concluir. Atualize o protocolo antes de tentar novamente.",
      );
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  async function photo(camera: boolean, forDraft: boolean) {
    if ((forDraft ? draft.photos : photos).length >= 3) return;
    await run(async () => {
      const owner = user?.id;
      if (Platform.OS !== "web") {
        const p = await (camera
          ? ImagePicker.requestCameraPermissionsAsync()
          : ImagePicker.requestMediaLibraryPermissionsAsync());
        if (!p.granted)
          throw Error("Autorize a câmera ou a galeria para anexar a foto.");
      }
      const result = await (
        camera
          ? ImagePicker.launchCameraAsync
          : ImagePicker.launchImageLibraryAsync
      )({ mediaTypes: ["images"], quality: 0.4 });
      if (result.canceled) return;
      const asset = result.assets[0];
      let p = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: Math.min(asset.width || 1024, 1024) } }],
        {
          compress: 0.35,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        },
      );
      if (p.base64 && p.base64.length > 273068)
        p = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: 640 } }],
          {
            compress: 0.2,
            format: ImageManipulator.SaveFormat.JPEG,
            base64: true,
          },
        );
      if (!p.base64 || p.base64.length > 273068)
        throw Error("Use uma foto de até 200 KB após compressão.");
      if (owner !== identity.current) return;
      const uri = `data:image/jpeg;base64,${p.base64}`;
      if (forDraft)
        setDraft((d) => ({ ...d, photos: [...d.photos, uri].slice(0, 3) }));
      else setPhotos((old) => [...old, uri].slice(0, 3));
    }, true);
  }
  async function submit() {
    await run(async () => {
      if (!draft.point || !ack)
        throw Error(
          "Confira o PEV e confirme o envio para a cooperativa indicada.",
        );
      if (draft.notes.trim().length < 5)
        throw Error("Descreva a situação em pelo menos 5 caracteres.");
      const owner = user?.id,
        r = await service.create({
          id: draft.id,
          binId: draft.point.id,
          condition: draft.condition,
          notes: draft.notes.trim(),
          photos: draft.photos,
        });
      if (owner !== identity.current) return;
      setDraft(fresh());
      setAck(false);
      setForm(false);
      setDetail(r);
      setTab("REQUESTS");
      setNotice(
        "Pedido enviado à cooperativa responsável. Guarde o protocolo para acompanhar.",
      );
      void load();
    });
  }
  async function update(kind: string) {
    if (!detail) return;
    await run(async () => {
      if (notes.trim().length < 5)
        throw Error(
          "Informe uma descrição ou justificativa em pelo menos 5 caracteres.",
        );
      const snapshot = detail,
        payload = {
          expectedVersion: snapshot.version,
          kind,
          notes: notes.trim(),
          photos,
        };
      const fingerprint = JSON.stringify({ id: snapshot.id, ...payload });
      if (operation.current?.fingerprint !== fingerprint)
        operation.current = { id: newExtraId(), fingerprint };
      const owner = user?.id;
      await service.update(snapshot.id, {
        ...payload,
        operationId: operation.current.id,
      });
      if (owner !== identity.current) return;
      setNotes("");
      setPhotos([]);
      operation.current = null;
      setNotice("Atualização registrada no protocolo.");
      await open(snapshot.id);
      void load();
    });
  }
  function begin(point: PevPoint) {
    if (
      draft.point &&
      draft.point.id !== point.id &&
      (draft.notes || draft.photos.length)
    ) {
      setError(
        "Você tem um rascunho para outro PEV. Retome ou descarte esse rascunho antes de trocar o ponto.",
      );
      return;
    }
    setDraft((d) => ({ ...d, point }));
    setAck(false);
    setDetail(null);
    setForm(true);
    setError("");
  }
  function photoForm(forDraft: boolean) {
    const values = forDraft ? draft.photos : photos;
    return (
      <>
        <Text style={s.label}>Fotos da situação · até 3</Text>
        <Notice text="Evite fotografar pessoas, placas ou documentos. As imagens ficam vinculadas ao pedido e são acessíveis ao solicitante e à equipe responsável." />
        <View style={s.row}>
          <Action
            secondary
            label="Fotografar"
            disabled={busy || values.length >= 3}
            onPress={() => void photo(true, forDraft)}
          />
          <Action
            secondary
            label="Escolher foto"
            disabled={busy || values.length >= 3}
            onPress={() => void photo(false, forDraft)}
          />
        </View>
        {values.map((uri, i) => (
          <View key={i}>
            <Image source={{ uri }} style={s.photo} />
            <Action
              secondary
              label={`Remover foto ${i + 1}`}
              disabled={busy}
              onPress={() =>
                forDraft
                  ? setDraft((d) => ({
                      ...d,
                      photos: d.photos.filter((_, j) => j !== i),
                    }))
                  : setPhotos((old) => old.filter((_, j) => j !== i))
              }
            />
          </View>
        ))}
      </>
    );
  }
  const pageButtons = (
    page: number,
    total: number,
    set: (n: number) => void,
  ) => (
    <View style={s.row}>
      <Action
        secondary
        label="Anterior"
        disabled={page <= 1 || loading || busy}
        onPress={() => set(page - 1)}
      />
      <Text style={s.muted}>
        Página {page} de {Math.max(1, Math.ceil(total / 20))}
      </Text>
      <Action
        secondary
        label="Próxima"
        disabled={page * 20 >= total || loading || busy}
        onPress={() => set(page + 1)}
      />
    </View>
  );
  return (
    <Shell
      key={`${tab}:${form ? "new" : detail?.id || "list"}`}
      title="PEVs · cuidado compartilhado"
      subtitle="Sinalize um ponto cheio, acompanhe o atendimento e ajude a cooperativa a manter a cidade limpa."
    >
      <View style={s.row}>
        {!coop && (
          <Action
            label="Encontrar PEV"
            secondary={tab !== "POINTS"}
            disabled={busy}
            onPress={() => {
              setTab("POINTS");
              setDetail(null);
              setForm(false);
            }}
          />
        )}
        <Action
          label={coop ? "Solicitações recebidas" : "Acompanhar pedidos"}
          secondary={tab !== "REQUESTS"}
          disabled={busy}
          onPress={() => {
            setTab("REQUESTS");
            setForm(false);
            setDetail(null);
          }}
        />
        <Action
          label="Recarregar"
          secondary
          busy={loading}
          disabled={busy}
          onPress={() => void load()}
        />
        <NotificationBell tone="dark" />
      </View>
      {!isOnline && (
        <Notice text="Sem conexão. O novo pedido fica como rascunho neste aparelho; envie quando estiver online." />
      )}
      {!!error && <Notice error text={error} />}{" "}
      {!!notice && <Notice text={notice} />}
      {!form && !detail && draft.point && loadedDraft && (
        <Card>
          <Text style={s.heading}>
            Rascunho · {draft.point.name || draft.point.binId}
          </Text>
          <Action
            label="Retomar pedido"
            disabled={busy}
            onPress={() => {
              setForm(true);
              setAck(false);
            }}
          />
          <Action
            label="Descartar rascunho"
            secondary
            disabled={busy}
            onPress={() => {
              setDraft(fresh());
              setForm(false);
            }}
          />
        </Card>
      )}
      {form && draft.point ? (
        <Card>
          <Text style={s.eyebrow}>NOVO PEDIDO</Text>
          <Text style={s.heading}>{draft.point.name || draft.point.binId}</Text>
          <Text style={s.muted}>{draft.point.address}</Text>
          <Text style={s.label}>
            Cooperativa responsável: {draft.point.cooperative.name}
          </Text>
          <Notice text="O relato será analisado pela cooperativa. Não representa agendamento confirmado nem registro de peso coletado." />
          {Object.entries(pevCondition).map(([key, label]) => (
            <Action
              key={key}
              label={`${draft.condition === key ? "✓ " : ""}${label}`}
              secondary={draft.condition !== key}
              disabled={busy}
              onPress={() => setDraft((d) => ({ ...d, condition: key }))}
            />
          ))}
          <Field
            label="Descreva a situação"
            multiline
            maxLength={1500}
            value={draft.notes}
            editable={!busy}
            onChangeText={(notes) => setDraft((d) => ({ ...d, notes }))}
          />
          {photoForm(true)}
          <Action
            secondary
            label={`${ack ? "✓ " : ""}Confirmo o PEV e a cooperativa de destino`}
            disabled={busy}
            onPress={() => setAck(!ack)}
          />
          <Action
            label="Enviar solicitação"
            busy={busy}
            disabled={!ack}
            onPress={() => void submit()}
          />
          <Action
            secondary
            label="Voltar e manter rascunho"
            disabled={busy}
            onPress={() => setForm(false)}
          />
        </Card>
      ) : detail ? (
        <>
          <Card>
            <Text style={s.eyebrow}>PROTOCOLO · {detail.id}</Text>
            <Text style={s.heading}>{detail.binName}</Text>
            <Text style={s.muted}>{detail.address}</Text>
            <Text style={s.status}>{pevStatus(detail)}</Text>
            <Text style={s.label}>
              {pevCondition[detail.condition as keyof typeof pevCondition] ||
                detail.condition}
            </Text>
            <Text style={s.body}>{detail.notes}</Text>
            <Text style={s.muted}>
              {date(detail.createdAt)} · {detail.requesterName}
            </Text>
            {detail.photos?.map((uri, i) => (
              <Image key={i} source={{ uri }} style={s.photo} />
            ))}
            {detail.response && (
              <Notice text={`Cooperativa: ${detail.response}`} />
            )}
            {detail.collection && (
              <Notice
                text={`Coleta: ${detail.collection.id}${detail.collection.collector?.name ? ` · ${detail.collection.collector.name}` : ""}. ${pevStatus(detail)}`}
              />
            )}
            {collector &&
              detail.cooperativeId === user?.collector?.cooperativeId &&
              ["OPEN", "ASSIGNED"].includes(detail.status) && (
                <Action
                  label="Abrir coleta deste PEV"
                  busy={busy}
                  onPress={() =>
                    void run(async () => {
                      const result = await service.collect(detail.id);
                      router.push({
                        pathname: "/(catador)/collect",
                        params: { highlightCollectionId: result.collection.id },
                      });
                    })
                  }
                />
              )}
            <Action
              secondary
              label="Atualizar protocolo"
              disabled={busy}
              onPress={() => void open(detail.id)}
            />
          </Card>
          {["OPEN", "ASSIGNED"].includes(detail.status) && (
            <Card>
              <Text style={s.heading}>
                {coop ? "Tratar solicitação" : "Complementar relato"}
              </Text>
              <Notice
                text={
                  collector
                    ? "Antes ou depois da retirada, registre fotos e descreva o que foi encontrado. O peso e os materiais são informados na tela Coletar."
                    : "Registre informações para o acompanhamento do pedido."
                }
              />
              <Field
                label="Descrição / resposta"
                multiline
                maxLength={1500}
                value={notes}
                editable={!busy}
                onChangeText={setNotes}
              />
              {photoForm(false)}
              <Action
                label={
                  coop ? "Registrar resposta" : "Enviar informações e fotos"
                }
                busy={busy}
                onPress={() => void update(coop ? "REVIEW" : "EVIDENCE")}
              />
              {coop && (
                <>
                  <Action
                    secondary
                    label="Encerrar atendimento com justificativa"
                    disabled={busy}
                    onPress={() => void update("RESOLVE")}
                  />
                  <Action
                    secondary
                    label="Encerrar pedido sem retirada"
                    disabled={busy}
                    onPress={() => void update("DISMISS")}
                  />
                </>
              )}
            </Card>
          )}
          <Card>
            <Text style={s.heading}>Histórico do pedido</Text>
            {detail.updates?.length ? (
              detail.updates.map((u) => (
                <View key={u.id} style={s.history}>
                  <Text style={s.label}>
                    {u.actorName} · {date(u.createdAt)}
                  </Text>
                  <Text style={s.body}>{u.notes}</Text>
                  {u.photos.map((uri, i) => (
                    <Image key={i} source={{ uri }} style={s.photo} />
                  ))}
                </View>
              ))
            ) : (
              <Notice text="Nenhuma complementação registrada." />
            )}
            {(detail.updatesTotal || 0) > 5 && (
              <View style={s.row}>
                <Action
                  secondary
                  label="Mais recentes"
                  disabled={(detail.updatesPage || 1) <= 1 || busy}
                  onPress={() =>
                    void open(detail.id, (detail.updatesPage || 1) - 1)
                  }
                />
                <Action
                  secondary
                  label="Anteriores"
                  disabled={
                    (detail.updatesPage || 1) * 5 >=
                      (detail.updatesTotal || 0) || busy
                  }
                  onPress={() =>
                    void open(detail.id, (detail.updatesPage || 1) + 1)
                  }
                />
              </View>
            )}
          </Card>
          <Action
            secondary
            label="Voltar à lista"
            disabled={busy}
            onPress={() => setDetail(null)}
          />
        </>
      ) : tab === "POINTS" ? (
        <>
          <Card>
            <Field
              label="Buscar PEV por nome, código, bairro ou município"
              value={search}
              maxLength={100}
              onChangeText={setSearch}
            />
            <Action
              label="Buscar pontos"
              disabled={busy || loading}
              onPress={() => {
                setAppliedSearch(search.trim());
                setPointPage(1);
              }}
            />
            <Notice text={user?.role === "PF" ? "Encontre pontos públicos por nome, bairro ou município. Confira os materiais aceitos e as restrições antes de levar seus recicláveis. O mapa mostra a página atual." : "Pessoas físicas veem os pontos publicados. Catadores e cooperativas acessam somente PEVs da própria cooperativa, mesmo quando públicos. O mapa mostra a página atual."} />
            {points.some(
              (p) =>
                typeof p.latitude === "number" &&
                typeof p.longitude === "number",
            ) && (
              <OperationalMap
                baseLabel={null}
                baseLatitude={
                  points.find((p) => p.latitude != null)?.latitude || -3.7319
                }
                baseLongitude={
                  points.find((p) => p.longitude != null)?.longitude || -38.5267
                }
                points={points
                  .filter((p) => p.latitude != null && p.longitude != null)
                  .map((p) => ({
                    id: p.id,
                    title: p.name || p.binId,
                    description: `${p.address} · ${p.cooperative.name}`,
                    latitude: p.latitude!,
                    longitude: p.longitude!,
                    kind: "pev",
                  }))}
              />
            )}
          </Card>
          {!points.length && !loading && (
            <Card>
              <Notice text="Nenhum PEV disponível nesta busca. A cooperativa precisa habilitar a exibição pública e confirmar a localização do ponto." />
            </Card>
          )}
          {points.map((p) => (
            <Card key={p.id}>
              <View style={s.row}>
                <Ionicons name="trash-outline" size={27} color="#B45309" />
                <Text style={s.heading}>{p.name || p.binId}</Text>
              </View>
              <Text style={s.muted}>{p.address}</Text>
              <Text style={s.label}>{p.cooperative.name}</Text>
              {p.needsPickup && (
                <Text style={s.status}>Necessidade de retirada sinalizada</Text>
              )}
              <Text style={s.body}>
                {p.acceptedMaterials.join(" · ") ||
                  "Confirme os materiais aceitos com a cooperativa."}
              </Text>
              {!!p.restrictions && <Notice text={p.restrictions} />}
              {user?.role === "PF" && p.latitude != null && p.longitude != null && <Action secondary label="Abrir trajeto até este PEV" onPress={() => void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}`).catch(() => setError("Não foi possível abrir o mapa neste aparelho."))} />}
              <Action
                label="Solicitar coleta / informar situação"
                disabled={busy || !loadedDraft}
                onPress={() => begin(p)}
              />
            </Card>
          ))}
          {pageButtons(pointPage, pointTotal, setPointPage)}
        </>
      ) : (
        <>
          {!requests.length && !loading && (
            <Card>
              <Notice text="Nenhuma solicitação registrada. Selecione um PEV para informar a situação." />
            </Card>
          )}
          {requests.map((r) => (
            <Card key={r.id}>
              <Text style={s.eyebrow}>{date(r.createdAt)}</Text>
              <Text style={s.heading}>{r.binName}</Text>
              <Text style={s.muted}>{r.address}</Text>
              <Text style={s.status}>{pevStatus(r)}</Text>
              <Text style={s.body}>{r.notes}</Text>
              <Action
                label="Ver protocolo e fotos"
                secondary
                disabled={busy}
                onPress={() => {
                  setNotes("");
                  setPhotos([]);
                  void open(r.id);
                }}
              />
            </Card>
          ))}
          {pageButtons(requestPage, requestTotal, setRequestPage)}
        </>
      )}
    </Shell>
  );
}
const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  heading: {
    fontSize: 19,
    lineHeight: 26,
    fontWeight: "700",
    color: "#123D31",
    flexShrink: 1,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.7,
    color: "#657C70",
  },
  label: { fontSize: 14, fontWeight: "600", color: "#214B3D", lineHeight: 22 },
  body: { fontSize: 15, lineHeight: 23, color: "#334A40" },
  muted: { fontSize: 13, lineHeight: 21, color: "#657C70" },
  status: {
    fontSize: 13,
    fontWeight: "700",
    color: "#047857",
    backgroundColor: "#EAF5EF",
    padding: 10,
    borderRadius: 8,
  },
  photo: {
    width: "100%",
    height: 220,
    resizeMode: "contain",
    backgroundColor: "#F2F6F3",
    borderRadius: 12,
  },
  history: {
    borderTopWidth: 1,
    borderColor: "#DEE9E2",
    paddingTop: 14,
    gap: 8,
  },
});
