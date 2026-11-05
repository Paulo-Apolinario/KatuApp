import LegacyForm from "./ExtraOrderFormLegacy";
import {
  clearOrigin,
  normalizeText,
  originError,
  selectGenerator,
} from "./collectorOrderHelpers";
import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Platform, Text, View } from "react-native";
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
function CollectorExtraOrderForm({
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
      reason: "EXTRA_REQUEST",
    },
  );
  const [addressPending, setAddressPending] = useState(false);
  const original = (initialOrder as any)?.draftForm;
  const [addressDraft, setAddressDraft] = useState<AddressDraft>(
    original?.addressDraft || emptyAddressDraft,
  );
  const dt =
    p.occurredAt || p.preferredDate
      ? new Date((p.occurredAt || p.preferredDate)!)
      : new Date();
  const [date, setDate] = useState(
      original?.date ??
        (p.mode === "REQUESTED" && !p.preferredDate
          ? ""
          : dt.toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza" })),
    ),
    [time, setTime] = useState(
      original?.time ??
        (p.mode === "REQUESTED" && !p.preferredDate
          ? ""
          : dt.toLocaleTimeString("pt-BR", {
              timeZone: "America/Fortaleza",
              hour: "2-digit",
              minute: "2-digit",
            })),
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
  const [step, setStep] = useState(0);
  const [details, setDetails] = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);
  const [editAddress, setEditAddress] = useState(false);
  const [customMaterial, setCustomMaterial] = useState(false);
  const moveStep = (next: number) => {
    setError("");
    setStep(next);
  };
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
    }, 0);
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
      (p.custody === "OTHER" && p.custodyNotes.trim().length < 5)
    ) {
      setError(
        "Confira o nome e o endereço. Se o material estiver em outro local, informe o responsável.",
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
      )
    ) {
      setError(
        "Escolha pelo menos um material. Se informar uma quantidade, use um valor maior que zero.",
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
      (date || time) &&
      (!date ||
        !time ||
        !snapshot.preferredDate ||
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
        owner || undefined,
      );
      onSaved(order);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
      guard.current = false;
    }
  }
  async function closeForm() {
    if (busy || guard.current) return;
    if (owner && (!initialOrder || initialOrder.status === "DRAFT")) {
      try {
        await extraOrderService.draft(
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
        );
      } catch {
        setError(
          "Não foi possível guardar o rascunho. Tente voltar novamente.",
        );
        return;
      }
    }
    onClose();
  }
  function next() {
    if (step === 1) {
      const issue = originError(p);
      if (issue) return setError(issue);
      if (addressPending)
        return setError(
          "Confirme ou cancele a seleção no mapa e aguarde a busca de endereço.",
        );
    }
    if (
      step === 2 &&
      (!lines.length ||
        materials.some(
          (m) =>
            m.quantity !== undefined &&
            (!Number.isFinite(m.quantity) || m.quantity <= 0),
        ))
    )
      return setError(
        "Escolha um material. A quantidade pode ficar em branco; se informar, use um valor maior que zero.",
      );
    moveStep(step + 1);
  }
  const selectedGenerator = context?.generators.find(
    (g) => g.id === p.generatorId,
  );
  const foundGenerators = (context?.generators || []).filter((g) =>
    normalizeText(
      [g.companyName, g.name, g.address, g.neighborhood]
        .filter(Boolean)
        .join(" "),
    ).includes(normalizeText(search)),
  );
  return (
    <Workspace
      key={step}
      onBack={() => void closeForm()}
      title={
        initialOrder?.status === "NEEDS_INFO"
          ? "Completar coleta extra"
          : "Coleta extra"
      }
      subtitle={`Etapa ${step + 1} de 4 · ${["O que deseja fazer?", "Onde?", "Quais materiais?", "Conferir e enviar"][step]}`}
    >
      {!!draftError && (
        <Notice error text={`Rascunho não salvo: ${draftError}`} />
      )}
      <View style={{ flexDirection: "row", gap: 6 }}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 5,
              borderRadius: 4,
              backgroundColor: i <= step ? "#047857" : "#DCE7E0",
            }}
          />
        ))}
      </View>
      {step === 0 && (
        <Card>
          <Text
            accessibilityRole="header"
            style={{ fontSize: 20, fontWeight: "700" }}
          >
            O que você quer fazer?
          </Text>
          {(["COLLECTED", "REQUESTED"] as const).map((mode) => (
            <Action
              key={mode}
              label={
                mode === "COLLECTED"
                  ? "Registrar uma coleta realizada"
                  : "Pedir uma coleta"
              }
              secondary={p.mode !== mode}
              onPress={() => {
                if (mode === p.mode) return;
                const now = new Date();
                setP((old) => ({
                  ...old,
                  mode,
                  custody: mode === "REQUESTED" ? "ORIGIN" : "COLLECTOR",
                  custodyNotes: "",
                  occurredAt: undefined,
                  preferredDate: undefined,
                }));
                setDate(
                  mode === "REQUESTED"
                    ? ""
                    : now.toLocaleDateString("pt-BR", {
                        timeZone: "America/Fortaleza",
                      }),
                );
                setTime(
                  mode === "REQUESTED"
                    ? ""
                    : now.toLocaleTimeString("pt-BR", {
                        timeZone: "America/Fortaleza",
                        hour: "2-digit",
                        minute: "2-digit",
                      }),
                );
              }}
            />
          ))}
          <Notice
            text={
              p.mode === "COLLECTED"
                ? "Use quando o material já foi retirado."
                : "Use quando o material ainda precisa ser retirado."
            }
          />
        </Card>
      )}
      {step === 1 && (
        <Card>
          <Text
            accessibilityRole="header"
            style={{ fontSize: 20, fontWeight: "700" }}
          >
            Onde é a retirada?
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(["GENERATOR", "PF"] as const).map((type) => (
              <Action
                key={type}
                label={
                  type === "GENERATOR"
                    ? "Gerador cadastrado"
                    : "Pessoa ou local sem cadastro"
                }
                secondary={p.originType !== type}
                onPress={() => {
                  if (type !== p.originType) {
                    setAddressPending(false);
                    setP((old) => clearOrigin(old, type));
                    setAddressDraft(emptyAddressDraft);
                    setEditAddress(false);
                    setSearch("");
                  }
                }}
              />
            ))}
          </View>
          {p.originType === "GENERATOR" && (
            <>
              <Field
                label="Buscar gerador por nome ou bairro"
                value={search}
                onChangeText={setSearch}
              />
              {!selectedGenerator && (
                <>
                  {foundGenerators.slice(0, 12).map((g) => (
                    <Action
                      key={g.id}
                      secondary
                      label={[g.companyName || g.name, g.neighborhood]
                        .filter(Boolean)
                        .join(" · ")}
                      onPress={() => {
                        const chosen = selectGenerator(p, g);
                        setP(chosen.payload);
                        setAddressDraft(chosen.draft);
                        setEditAddress(!chosen.payload.pickupAddress);
                      }}
                    />
                  ))}
                  {!foundGenerators.length && (
                    <Notice text="Nenhum gerador encontrado. Confira a busca ou escolha pessoa ou local sem cadastro." />
                  )}
                  {foundGenerators.length > 12 && (
                    <Notice text="Digite mais do nome ou o bairro para encontrar o gerador." />
                  )}
                </>
              )}
              {selectedGenerator && (
                <>
                  <Text style={{ fontWeight: "700", fontSize: 18 }}>
                    {p.originName}
                  </Text>
                  <Text>{p.pickupAddress || "Endereço não cadastrado"}</Text>
                  <Text>
                    {p.contactPhone
                      ? `Telefone: ${p.contactPhone}`
                      : "Telefone não cadastrado"}
                  </Text>
                  <Action
                    secondary
                    label="Escolher outro gerador"
                    onPress={() => {
                      setAddressPending(false);
                      setP((old) => clearOrigin(old, "GENERATOR"));
                      setAddressDraft(emptyAddressDraft);
                      setEditAddress(false);
                    }}
                  />
                  <Action
                    secondary
                    label={
                      editAddress
                        ? "Fechar edição do local"
                        : "Alterar local desta coleta"
                    }
                    onPress={() => setEditAddress(!editAddress)}
                  />
                </>
              )}
            </>
          )}
          {(p.originType === "PF" || editAddress) && (
            <>
              <Field
                label="Nome da pessoa ou estabelecimento"
                value={p.originName}
                onChangeText={(v) => set("originName", v)}
                maxLength={180}
              />
              <Field
                label="Telefone (opcional)"
                value={p.contactPhone}
                onChangeText={(v) => set("contactPhone", v)}
                keyboardType="phone-pad"
                maxLength={40}
              />
              <ExtraOrderAddress
                value={p}
                draft={addressDraft}
                onDraft={setAddressDraft}
                onPending={setAddressPending}
                onChange={setP}
                disabled={busy}
              />
            </>
          )}
        </Card>
      )}
      {step === 2 && (
        <Card>
          <Text
            accessibilityRole="header"
            style={{ fontSize: 20, fontWeight: "700" }}
          >
            Quais materiais?
          </Text>
          <Field
            label="Buscar material"
            value={materialSearch}
            onChangeText={setMaterialSearch}
          />
          {(context?.catalog || [])
            .filter(
              (m) =>
                normalizeText(m.name).includes(normalizeText(materialSearch)) &&
                !lines.some((l) => l.wasteTypeId === m.id),
            )
            .slice(0, 8)
            .map((m) => (
              <Action
                key={m.id}
                secondary
                label={`Adicionar ${m.name}`}
                disabled={lines.length >= 50}
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
          {lines.map((l) => (
            <View
              key={l.id}
              style={{
                padding: 12,
                backgroundColor: "#F0F7F3",
                borderRadius: 12,
              }}
            >
              <Text style={{ fontWeight: "700", fontSize: 17 }}>{l.name}</Text>
              <Field
                label={`Quantidade de ${l.name} (${unitLabel(l.unit)}) — opcional`}
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
          <Notice text="Não sabe a quantidade? Deixe em branco para conferência na cooperativa." />
          <Action
            secondary
            label={
              customMaterial
                ? "Fechar outro material"
                : "Não encontrei o material"
            }
            onPress={() => setCustomMaterial(!customMaterial)}
          />
          {customMaterial && (
            <>
              <Field
                label="Nome do outro material"
                value={customName}
                onChangeText={setCustomName}
                maxLength={150}
              />
              <Text>Unidade</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {(
                  ["KG", "TON", "LITER", "UNIT", "CUBIC_METER"] as ExtraUnit[]
                ).map((unit) => (
                  <Action
                    key={unit}
                    secondary={customUnit !== unit}
                    label={unitLabel(unit)}
                    onPress={() => setCustomUnit(unit)}
                  />
                ))}
              </View>
              <Action
                secondary
                label="Adicionar outro material"
                disabled={customName.trim().length < 2 || lines.length >= 50}
                onPress={() => {
                  if (
                    lines.some(
                      (l) =>
                        !l.wasteTypeId &&
                        normalizeText(l.name) === normalizeText(customName) &&
                        l.unit === customUnit,
                    )
                  )
                    return setError("Esse material já foi adicionado.");
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
                  setCustomMaterial(false);
                }}
              />
            </>
          )}
        </Card>
      )}
      {step === 3 && (
        <>
          <Card>
            <Text
              accessibilityRole="header"
              style={{ fontSize: 20, fontWeight: "700" }}
            >
              Confira antes de enviar
            </Text>
            <Text>
              {p.mode === "COLLECTED" ? "Coleta realizada" : "Pedido de coleta"}
            </Text>
            <Text style={{ fontWeight: "700" }}>{p.originName}</Text>
            <Text>{p.pickupAddress}</Text>
            {!!p.contactPhone && <Text>Telefone: {p.contactPhone}</Text>}
            {lines.map((l) => (
              <Text key={l.id}>
                • {l.name}:{" "}
                {l.quantity
                  ? `${l.quantity} ${unitLabel(l.unit)}`
                  : "quantidade a conferir"}
              </Text>
            ))}
            <Text>
              {p.mode === "COLLECTED"
                ? `Realizada em ${date}, às ${time}`
                : date
                  ? `Data desejada: ${date}${time ? `, às ${time}` : ""}`
                  : "Sem data preferencial"}
            </Text>
            {p.mode === "COLLECTED" && (
              <>
                <Text style={{ fontWeight: "700" }}>Onde está o material?</Text>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  {(
                    ["COLLECTOR", "COOPERATIVE", "ORIGIN", "OTHER"] as const
                  ).map((c) => (
                    <View key={c} style={{ width: "48%" }}>
                      <Action
                        secondary={p.custody !== c}
                        label={custodyLabel(c)}
                        onPress={() => set("custody", c)}
                      />
                    </View>
                  ))}
                </View>
                {p.custody === "OTHER" && (
                  <Field
                    label="Local e responsável pelo material"
                    value={p.custodyNotes}
                    onChangeText={(v) => set("custodyNotes", v)}
                    maxLength={1000}
                  />
                )}
                {p.custody === "COOPERATIVE" && (
                  <Notice text="A cooperativa ainda precisará confirmar o recebimento." />
                )}
              </>
            )}
            <Action
              secondary
              label={
                details ? "Fechar mais detalhes" : "Mais detalhes (opcional)"
              }
              onPress={() => setDetails(!details)}
            />
            {details && (
              <>
                <Field
                  label={
                    p.mode === "COLLECTED"
                      ? "Data da coleta (DD/MM/AAAA)"
                      : "Data desejada (opcional)"
                  }
                  value={date}
                  onChangeText={(v) => {
                    setDate(v);
                    if (p.mode === "REQUESTED") {
                      if (v && !time) setTime("08:00");
                      if (!v) setTime("");
                    }
                  }}
                  maxLength={10}
                />
                <Field
                  label="Horário (HH:MM)"
                  value={time}
                  onChangeText={setTime}
                  maxLength={5}
                />
                <Text style={{ fontWeight: "700" }}>Motivo (opcional)</Text>
                <Action
                  secondary
                  label="Não informar motivo"
                  onPress={() =>
                    setP((old) => ({
                      ...old,
                      reason: "EXTRA_REQUEST",
                      reasonNotes: "",
                    }))
                  }
                />
                {(
                  [
                    "EXTRA_REQUEST",
                    "OUTSIDE_SCHEDULE",
                    "WEEKEND",
                    "OTHER",
                    ...(contextRouteId || context?.routes.length
                      ? ["UNPLANNED_STOP" as const]
                      : []),
                  ] as const
                ).map((reason) => (
                  <Action
                    key={reason}
                    secondary={p.reason !== reason}
                    label={reasonLabel(reason)}
                    onPress={() => set("reason", reason)}
                  />
                ))}
                <Field
                  label="Observações (opcional)"
                  value={p.reasonNotes}
                  onChangeText={(v) => set("reasonNotes", v)}
                  maxLength={2000}
                  multiline
                />
                <Action
                  secondary
                  label="Sem vínculo com rota"
                  onPress={() =>
                    setP((old) => ({
                      ...old,
                      contextRouteId: undefined,
                      reason:
                        old.reason === "UNPLANNED_STOP"
                          ? "EXTRA_REQUEST"
                          : old.reason,
                    }))
                  }
                />
                {(context?.routes || []).map((r) => (
                  <Action
                    key={r.id}
                    secondary={p.contextRouteId !== r.id}
                    label={r.name}
                    onPress={() => set("contextRouteId", r.id)}
                  />
                ))}
                {!!p.generatorId && (
                  <>
                    <Text>Solicitação anterior (opcional)</Text>
                    <Action
                      secondary
                      label="Sem solicitação anterior"
                      onPress={() => set("sourceScheduleId", undefined)}
                    />
                    {(context?.schedules || [])
                      .filter((s) => s.generatorId === p.generatorId)
                      .map((s) => (
                        <Action
                          key={s.id}
                          secondary={p.sourceScheduleId !== s.id}
                          label={`Solicitação ${s.id.slice(-8)}`}
                          onPress={() => set("sourceScheduleId", s.id)}
                        />
                      ))}
                  </>
                )}
              </>
            )}
          </Card>
          <Action
            secondary
            label={
              showPhotos ? "Fechar opções de foto" : "Adicionar foto (opcional)"
            }
            onPress={() => setShowPhotos(!showPhotos)}
          />
          {(showPhotos || p.photos.length > 0) && (
            <Card>
              <Text style={{ fontWeight: "700" }}>Foto (opcional)</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Action
                  secondary
                  label="Anexar foto"
                  disabled={p.photos.length >= 3 || busy}
                  onPress={() => void photo(false)}
                />
                <Action
                  secondary
                  label="Tirar foto"
                  disabled={p.photos.length >= 3 || busy}
                  onPress={() => void photo(true)}
                />
              </View>
              {p.photos.map((uri, i) => (
                <View key={uri.slice(-30) + i}>
                  <Image
                    source={{ uri }}
                    accessibilityLabel={`Foto ${i + 1}`}
                    style={{ height: 140, width: "100%" }}
                    resizeMode="contain"
                  />
                  <Action
                    secondary
                    label={`Remover foto ${i + 1}`}
                    onPress={() =>
                      set(
                        "photos",
                        p.photos.filter((_, index) => index !== i),
                      )
                    }
                  />
                </View>
              ))}
            </Card>
          )}
        </>
      )}
      {!!error && <Notice error text={error} />}
      {step > 0 && (
        <Action
          secondary
          label="Etapa anterior"
          disabled={busy}
          onPress={() => moveStep(step - 1)}
        />
      )}
      {step < 3 ? (
        <Action label="Continuar" disabled={busy} onPress={next} />
      ) : (
        <Action
          label={
            p.mode === "COLLECTED"
              ? "Enviar registro de coleta"
              : "Enviar pedido de coleta"
          }
          busy={busy}
          onPress={() => void save()}
        />
      )}
    </Workspace>
  );
}
export default function ExtraOrderFormWeb(
  props: Parameters<typeof LegacyForm>[0],
) {
  const { user } = useAuth();
  return user?.role === "COLLECTOR" ? (
    <CollectorExtraOrderForm {...props} />
  ) : (
    <LegacyForm {...props} />
  );
}
