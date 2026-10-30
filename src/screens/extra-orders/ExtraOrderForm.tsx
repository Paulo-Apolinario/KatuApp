import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Platform, Pressable, Text, View } from "react-native";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import {
  Workspace,
  Card,
  Field,
  Action,
  Notice,
} from "../../components/ui/Workspace";
import ExtraOrderAddress, {
  emptyAddressDraft,
  type AddressDraft,
} from "./ExtraOrderAddress";
import { useAuth } from "../../contexts/AuthContext";
import {
  extraOrderService,
  newExtraId,
} from "../../services/extraOrderService";
import { parseFortalezaDateTime } from "../../utils/dateTime";
import { unitLabel } from "../../utils/materials";
import {
  custodyLabel,
  reasonLabel,
  type ExtraContext,
  type ExtraOrder,
  type ExtraOrderPayload,
  type ExtraUnit,
} from "../../types/extraOrder";
type Line = {
  id: string;
  wasteTypeId?: string;
  name: string;
  unit: ExtraUnit;
  quantity: string;
};
const initial: ExtraOrderPayload = {
  mode: "COLLECTED",
  reason: "EXTRA_REQUEST",
  reasonNotes: "",
  originType: "PF",
  originName: "",
  pickupAddress: "",
  contactPhone: "",
  custody: "COLLECTOR",
  custodyNotes: "",
  materials: [],
  photos: [],
};
export default function ExtraOrderForm({
  context,
  initialOrder,
  onClose,
  onSaved,
  contextRouteId,
}: {
  context: ExtraContext | null;
  initialOrder?: ExtraOrder;
  contextRouteId?: string;
  onClose: () => void;
  onSaved: (order: ExtraOrder) => void;
}) {
  const { user } = useAuth(),
    id = useRef(initialOrder?.id || newExtraId()).current,
    guard = useRef(false),
    owner = user?.id;
  const [p, setP] = useState<ExtraOrderPayload>(
    initialOrder?.payload || {
      ...initial,
      recordedAt: new Date().toISOString(),
      contextRouteId,
      reason: contextRouteId ? "UNPLANNED_STOP" : "EXTRA_REQUEST",
    },
  );
  const [addressPending, setAddressPending] = useState(false);
  const original = (initialOrder as any)?.draftForm;
  const [addressDraft, setAddressDraft] = useState<AddressDraft>(
    original?.addressDraft || emptyAddressDraft,
  );
  const dt = p.occurredAt ? new Date(p.occurredAt) : new Date();
  const [date, setDate] = useState(
      original?.date ||
        dt.toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza" }),
    ),
    [time, setTime] = useState(
      original?.time ||
        dt.toLocaleTimeString("pt-BR", {
          timeZone: "America/Fortaleza",
          hour: "2-digit",
          minute: "2-digit",
        }),
    );
  const [lines, setLines] = useState<Line[]>(
      original?.lines ||
        p.materials.map((m, i) => ({
          id: String(i),
          wasteTypeId: m.wasteTypeId,
          name:
            m.proposedMaterial?.name ||
            context?.catalog.find((c) => c.id === m.wasteTypeId)?.name ||
            "Material do catálogo",
          unit: m.unit,
          quantity: m.quantity?.toString() || "",
        })),
    ),
    [search, setSearch] = useState(""),
    [materialSearch, setMaterialSearch] = useState(""),
    [customName, setCustomName] = useState(""),
    [customUnit, setCustomUnit] = useState<ExtraUnit>("KG"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [draftError, setDraftError] = useState("");
  const set = <K extends keyof ExtraOrderPayload>(
    key: K,
    value: ExtraOrderPayload[K],
  ) => setP((old) => ({ ...old, [key]: value }));
  const materials = useMemo(
    () =>
      lines.map((l) => ({
        ...(l.wasteTypeId
          ? { wasteTypeId: l.wasteTypeId }
          : { proposedMaterial: { name: l.name, unit: l.unit } }),
        unit: l.unit,
        quantity: l.quantity.trim()
          ? Number(l.quantity.replace(",", "."))
          : undefined,
      })),
    [lines],
  );
  const snapshot = useMemo(
    () => ({
      ...p,
      materials,
      occurredAt:
        p.mode === "COLLECTED"
          ? parseFortalezaDateTime(date, time) || undefined
          : undefined,
      preferredDate:
        p.mode === "REQUESTED" && date && time
          ? parseFortalezaDateTime(date, time) || undefined
          : undefined,
    }),
    [p, materials, date, time],
  );
  useEffect(() => {
    if (!owner || (initialOrder && initialOrder.status !== "DRAFT")) return;
    const timer = setTimeout(() => {
      void extraOrderService
        .draft(
          {
            id,
            cooperativeId: context?.cooperative.id || "",
            status: "DRAFT",
            revision: 1,
            payload: snapshot,
            custody: p.custody,
            custodyNotes: p.custodyNotes,
            createdAt: initialOrder?.createdAt || new Date().toISOString(),
            draftForm: { date, time, lines, addressDraft },
          } as ExtraOrder,
          owner,
        )
        .then(() => setDraftError(""))
        .catch((e) => setDraftError(e.message));
    }, 600);
    return () => clearTimeout(timer);
  }, [
    snapshot,
    addressDraft,
    id,
    owner,
    context,
    date,
    time,
    lines,
    p.custody,
    p.custodyNotes,
    initialOrder,
  ]);
  async function photo(camera: boolean) {
    if (p.photos.length >= 3) return;
    setError("");
    try {
      if (Platform.OS !== "web") {
        const permission = camera
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted)
          throw Error("Autorize a câmera ou a galeria para anexar uma foto.");
      }
      const r = await (
        camera
          ? ImagePicker.launchCameraAsync
          : ImagePicker.launchImageLibraryAsync
      )({ mediaTypes: ["images"], quality: 0.25, base64: true });
      if (!r.canceled) {
        const a = r.assets[0];
        let photo = await ImageManipulator.manipulateAsync(
          a.uri,
          [{ resize: { width: Math.min(a.width || 1024, 1024) } }],
          {
            compress: 0.35,
            format: ImageManipulator.SaveFormat.JPEG,
            base64: true,
          },
        );
        if (photo.base64 && photo.base64.length > 273068)
          photo = await ImageManipulator.manipulateAsync(
            a.uri,
            [{ resize: { width: 640 } }],
            {
              compress: 0.22,
              format: ImageManipulator.SaveFormat.JPEG,
              base64: true,
            },
          );
        if (!photo.base64) throw Error("Não foi possível preparar a foto.");
        if (photo.base64.length > 273068)
          throw Error(
            "A foto continua maior que 200 KB após compressão. Tente outra imagem.",
          );
        const prepared = `data:image/jpeg;base64,${photo.base64}`;
        setP((old) => ({
          ...old,
          photos: [...old.photos, prepared].slice(0, 3),
        }));
      }
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function save() {
    if (guard.current) return;
    setError("");
    if (addressPending) {
      setError(
        "Confirme o endereço e o ponto no mapa ou cancele a seleção antes de enviar. Aguarde também a consulta de CEP/localização, se estiver em andamento.",
      );
      return;
    }
    if (!context?.cooperative.id) {
      setError(
        "Entre online uma vez para carregar o vínculo com sua cooperativa antes do envio. O rascunho pode ser preservado.",
      );
      return;
    }
    if (
      p.originName.trim().length < 2 ||
      p.pickupAddress.trim().length < 5 ||
      p.reasonNotes.trim().length < 5 ||
      p.custodyNotes.trim().length < 5
    ) {
      setError(
        "Preencha origem, endereço, motivo e informação sobre a guarda do material.",
      );
      return;
    }
    if (p.reason === "UNPLANNED_STOP" && !p.contextRouteId) {
      setError("Selecione a rota em que ocorreu a parada extra.");
      return;
    }
    if (
      !lines.length ||
      lines.some(
        (l) =>
          l.quantity.trim() &&
          (!Number.isFinite(Number(l.quantity.replace(",", "."))) ||
            Number(l.quantity.replace(",", ".")) <= 0),
      ) ||
      (p.mode === "COLLECTED" && lines.some((l) => !l.quantity.trim()))
    ) {
      setError(
        "Adicione materiais e quantidades positivas. Para solicitação futura, a estimativa pode ficar em branco.",
      );
      return;
    }
    if (
      p.mode === "COLLECTED" &&
      (!snapshot.occurredAt ||
        new Date(snapshot.occurredAt).getTime() > Date.now() + 300000)
    ) {
      setError("Informe a data e o horário reais da coleta, sem data futura.");
      return;
    }
    if (
      p.mode === "REQUESTED" &&
      date &&
      time &&
      (!snapshot.preferredDate ||
        new Date(snapshot.preferredDate).getTime() <= Date.now())
    ) {
      setError("A data preferencial deve ser futura ou ficar em branco.");
      return;
    }
    guard.current = true;
    setBusy(true);
    try {
      const order = await extraOrderService.submit(
        id,
        context.cooperative.id,
        snapshot,
        initialOrder?.status === "NEEDS_INFO"
          ? initialOrder.revision
          : undefined,
      );
      onSaved(order);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
      guard.current = false;
    }
  }
  return (
    <Workspace
      title={
        initialOrder?.status === "NEEDS_INFO"
          ? "Complementar O.C."
          : "Nova ordem de coleta extra"
      }
      subtitle="Solicitação ou atendimento fora do planejamento. O recebimento e a análise são confirmados pela cooperativa."
    >
      <Action
        secondary
        label={
          initialOrder?.status === "NEEDS_INFO"
            ? "Voltar sem enviar complementação"
            : "Voltar à lista (preservar rascunho)"
        }
        disabled={busy}
        onPress={onClose}
      />
      {!!draftError && (
        <Notice
          error
          text={`Não foi possível salvar o rascunho: ${draftError}`}
        />
      )}
      <Card>
        <Text style={{ fontWeight: "600" }}>1. Situação e contexto</Text>
        <Notice
          text={`Cooperativa / OSC: ${context?.cooperative.name || "Vínculo ainda não carregado"}`}
        />
        {(["COLLECTED", "REQUESTED"] as const).map((mode) => (
          <Action
            key={mode}
            secondary={p.mode !== mode}
            disabled={busy}
            label={
              mode === "COLLECTED"
                ? "Já realizei a coleta"
                : "Solicitar atendimento ainda não realizado"
            }
            onPress={() => {
              set("mode", mode);
              set("custody", mode === "REQUESTED" ? "ORIGIN" : "COLLECTOR");
              setDate(
                mode === "REQUESTED"
                  ? ""
                  : dt.toLocaleDateString("pt-BR", {
                      timeZone: "America/Fortaleza",
                    }),
              );
              setTime(
                mode === "REQUESTED"
                  ? ""
                  : dt.toLocaleTimeString("pt-BR", {
                      timeZone: "America/Fortaleza",
                      hour: "2-digit",
                      minute: "2-digit",
                    }),
              );
            }}
          />
        ))}
        {(
          [
            "UNPLANNED_STOP",
            "EXTRA_REQUEST",
            "OUTSIDE_SCHEDULE",
            "WEEKEND",
            "OTHER",
          ] as const
        ).map((reason) => (
          <Action
            key={reason}
            secondary={p.reason !== reason}
            disabled={busy}
            label={reasonLabel(reason)}
            onPress={() => set("reason", reason)}
          />
        ))}
        <Field
          label="Motivo e circunstâncias"
          value={p.reasonNotes}
          onChangeText={(v) => set("reasonNotes", v)}
          multiline
          maxLength={2000}
          editable={!busy}
        />
        <Text style={{ fontWeight: "600" }}>
          Rota de contexto (opcional, exceto parada extra)
        </Text>
        <Action
          secondary
          label="Sem vínculo com rota"
          onPress={() => set("contextRouteId", undefined)}
          disabled={busy}
        />
        {context?.routes.map((r) => (
          <Action
            key={r.id}
            secondary={p.contextRouteId !== r.id}
            label={r.name}
            onPress={() => set("contextRouteId", r.id)}
            disabled={busy}
          />
        ))}
        <Notice text="A rota serve como referência do ocorrido. A O.C. não altera automaticamente os pontos planejados." />
      </Card>
      <Card>
        <Text style={{ fontWeight: "600" }}>2. Origem e local</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(["PF", "GENERATOR"] as const).map((t) => (
            <Action
              key={t}
              secondary={p.originType !== t}
              label={t === "PF" ? "Pessoa física" : "Gerador"}
              disabled={busy}
              onPress={() =>
                setP((old) => ({
                  ...old,
                  originType: t,
                  generatorId: undefined,
                  sourceScheduleId: undefined,
                }))
              }
            />
          ))}
        </View>
        {p.originType === "GENERATOR" && (
          <>
            <Field
              label="Buscar gerador cadastrado"
              value={search}
              onChangeText={setSearch}
            />
            <Action
              secondary
              label="Informar origem sem cadastro vinculado"
              onPress={() => set("generatorId", undefined)}
            />
            {context?.generators
              .filter((g) =>
                g.name
                  .toLocaleLowerCase("pt-BR")
                  .includes(search.toLocaleLowerCase("pt-BR")),
              )
              .slice(0, 12)
              .map((g) => (
                <Action
                  key={g.id}
                  secondary={p.generatorId !== g.id}
                  label={g.name}
                  onPress={() => {
                    setAddressDraft(emptyAddressDraft);
                    setP((old) => ({
                      ...old,
                      generatorId: g.id,
                      originName: g.name,
                      pickupAddress: g.address || "",
                      latitude: g.latitude ?? undefined,
                      longitude: g.longitude ?? undefined,
                      accuracyMeters: undefined,
                      sourceScheduleId: undefined,
                    }));
                  }}
                />
              ))}
          </>
        )}
        <Field
          label="Nome da pessoa ou estabelecimento"
          value={p.originName}
          onChangeText={(v) => set("originName", v)}
          maxLength={180}
          editable={!busy}
        />
        <Field
          label="Telefone de contato (opcional)"
          value={p.contactPhone}
          onChangeText={(v) => set("contactPhone", v)}
          keyboardType="phone-pad"
          maxLength={40}
          editable={!busy}
        />
        <ExtraOrderAddress
          value={p}
          draft={addressDraft}
          onDraft={setAddressDraft}
          onPending={setAddressPending}
          onChange={setP}
          disabled={busy}
        />
        {!!context?.schedules.length && (
          <>
            <Text style={{ fontWeight: "600" }}>
              Solicitação existente (opcional)
            </Text>
            <Action
              secondary
              label="Sem solicitação anterior"
              onPress={() => set("sourceScheduleId", undefined)}
            />
            {context.schedules
              .filter((s) => (s.generatorId || undefined) === p.generatorId)
              .slice(0, 15)
              .map((s) => (
                <Action
                  key={s.id}
                  secondary={p.sourceScheduleId !== s.id}
                  label={`${s.generator?.name || s.requestedBy?.displayName || "Solicitação"} · ${s.id.slice(-8)}`}
                  onPress={() => set("sourceScheduleId", s.id)}
                />
              ))}
          </>
        )}
      </Card>
      <Card>
        <Text style={{ fontWeight: "600" }}>
          3. Materiais{" "}
          {p.mode === "COLLECTED" ? "efetivamente coletados" : "previstos"}
        </Text>
        <Field
          label="Buscar material do catálogo"
          value={materialSearch}
          onChangeText={setMaterialSearch}
        />
        {context?.catalog
          .filter(
            (m) =>
              m.name
                .toLocaleLowerCase("pt-BR")
                .includes(materialSearch.toLocaleLowerCase("pt-BR")) &&
              !lines.some((l) => l.wasteTypeId === m.id),
          )
          .slice(0, 10)
          .map((m) => (
            <Action
              key={m.id}
              secondary
              label={`Adicionar ${m.name} (${unitLabel(m.unit)})`}
              onPress={() =>
                setLines((old) => [
                  ...old,
                  {
                    id: newExtraId(),
                    wasteTypeId: m.id,
                    name: m.name,
                    unit: m.unit,
                    quantity: "",
                  },
                ])
              }
            />
          ))}
        <Field
          label="Material não encontrado no catálogo"
          value={customName}
          onChangeText={setCustomName}
          maxLength={150}
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {(["KG", "TON", "LITER", "UNIT", "CUBIC_METER"] as ExtraUnit[]).map(
            (unit) => (
              <Action
                key={unit}
                secondary={customUnit !== unit}
                label={unitLabel(unit)}
                onPress={() => setCustomUnit(unit)}
              />
            ),
          )}
        </View>
        <Action
          secondary
          label="Adicionar material informado"
          disabled={customName.trim().length < 2 || lines.length >= 50}
          onPress={() => {
            setLines((old) => [
              ...old,
              {
                id: newExtraId(),
                name: customName.trim(),
                unit: customUnit,
                quantity: "",
              },
            ]);
            setCustomName("");
          }}
        />
        {lines.map((l) => (
          <View
            key={l.id}
            style={{
              padding: 12,
              backgroundColor: "#F3F7F4",
              borderRadius: 10,
            }}
          >
            <Field
              label={`Quantidade de ${l.name} (${unitLabel(l.unit)})`}
              value={l.quantity}
              onChangeText={(quantity) =>
                setLines((old) =>
                  old.map((x) => (x.id === l.id ? { ...x, quantity } : x)),
                )
              }
              keyboardType="decimal-pad"
            />
            <Action
              secondary
              label={`Remover ${l.name}`}
              onPress={() =>
                setLines((old) => old.filter((x) => x.id !== l.id))
              }
            />
          </View>
        ))}
        <Notice text="Estimativa pode ficar em branco somente para solicitação futura. Litros, unidades e m³ não são convertidos automaticamente em kg." />
      </Card>
      <Card>
        <Text style={{ fontWeight: "600" }}>4. Data, guarda e evidências</Text>
        <Field
          label={
            p.mode === "COLLECTED"
              ? "Data real da coleta (DD/MM/AAAA)"
              : "Data preferencial (opcional)"
          }
          value={date}
          onChangeText={setDate}
          maxLength={10}
        />
        <Field
          label="Horário de Fortaleza (HH:MM)"
          value={time}
          onChangeText={setTime}
          maxLength={5}
        />
        {(p.mode === "REQUESTED"
          ? (["ORIGIN"] as const)
          : (["ORIGIN", "COLLECTOR", "COOPERATIVE", "OTHER"] as const)
        ).map((c) => (
          <Action
            key={c}
            secondary={p.custody !== c}
            label={custodyLabel(c)}
            onPress={() => set("custody", c)}
          />
        ))}
        <Field
          label="Onde o material está e quem está responsável"
          value={p.custodyNotes}
          onChangeText={(v) => set("custodyNotes", v)}
          multiline
          maxLength={1000}
        />
        <Notice text="Informar que o material está na cooperativa não confirma recebimento. A cooperativa registrará essa conferência." />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Action
            secondary
            label="Anexar foto da galeria"
            disabled={p.photos.length >= 3}
            onPress={() => void photo(false)}
          />
          <Action
            secondary
            label="Tirar foto"
            disabled={p.photos.length >= 3}
            onPress={() => void photo(true)}
          />
        </View>
        <Notice text="Até três fotos comprimidas de 200 KB cada. Não fotografe documentos pessoais sem necessidade." />
        {p.photos.map((uri, i) => (
          <View key={i}>
            <Image
              source={{ uri }}
              accessibilityLabel={`Foto ${i + 1} da O.C.`}
              style={{ width: "100%", height: 180, borderRadius: 10 }}
              resizeMode="contain"
            />
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                set(
                  "photos",
                  p.photos.filter((_, index) => index !== i),
                )
              }
            >
              <Text style={{ padding: 12, color: "#B91C1C" }}>
                Remover foto {i + 1}
              </Text>
            </Pressable>
          </View>
        ))}
      </Card>
      {!!error && <Notice error text={error} />}
      <Action
        label="Enviar O.C. para a cooperativa"
        busy={busy}
        onPress={() => void save()}
      />
      <Notice text="Sem conexão, o envio ficará pendente neste aparelho. Preserve seus dados e confira o protocolo antes de repetir." />
    </Workspace>
  );
}
