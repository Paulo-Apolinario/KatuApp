import { useCallback, useEffect, useRef, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Text, View, Pressable } from "react-native";
import { api } from "@/src/services/api";
import { scheduleService } from "@/src/services/scheduleService";
import { wasteCatalogService } from "@/src/services/wasteCatalogService";
import * as Location from "@/src/services/deviceLocation";
import { useAuth } from "@/src/contexts/AuthContext";
import { useNotification } from "@/src/contexts/NotificationContext";
import {
  Workspace,
  Card,
  Field,
  Action,
  Notice,
} from "@/src/components/ui/Workspace";
import OperationalMap from "@/src/components/maps/OperationalMap";
import { parseFortalezaDateTime } from "@/src/utils/dateTime";
import { unitLabel } from "@/src/utils/materials";
import type { WasteCatalogItem, WasteUnit } from "@/src/types/collection";
import type { RequestedScheduleMaterialInput } from "@/src/types/schedule";
type Cooperative = {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
};
export default function Schedule() {
  const params = useLocalSearchParams<{ cooperativeId?: string }>(),
    { user } = useAuth(),
    { notifySuccess } = useNotification();
  const [cooperatives, setCooperatives] = useState<Cooperative[]>([]),
    [coopId, setCoopId] = useState(params.cooperativeId || ""),
    [catalog, setCatalog] = useState<WasteCatalogItem[]>([]),
    [selection, setSelection] = useState<Record<string, string>>({});
  const [date, setDate] = useState(""),
    [time, setTime] = useState(""),
    [notes, setNotes] = useState(""),
    [address, setAddress] = useState((user as any)?.person?.address || ""),
    [position, setPosition] = useState<{
      latitude: number;
      longitude: number;
    } | null>(null);
  const [proposed, setProposed] = useState(""),
    [proposalUnit, setProposalUnit] = useState<WasteUnit>("KG"),
    [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [gpsBusy, setGpsBusy] = useState(false);
  const guard = useRef(false);
  const [visible, setVisible] = useState(40);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await api.get<{ cooperatives: Cooperative[] } | Cooperative[]>(
        "/cooperatives",
        true,
      );
      const rows = Array.isArray(r) ? r : r.cooperatives;
      setCooperatives(rows || []);
    } catch (e: any) {
      setError(e.message || "Não foi possível carregar as cooperativas.");
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  useEffect(() => {
    let alive = true;
    setCatalog([]);
    setSelection({});
    if (coopId) {
      setLoading(true);
      void wasteCatalogService
        .list(coopId)
        .then((rows) => {
          if (alive) setCatalog(rows);
        })
        .catch((e) => {
          if (alive) setError(e.message);
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }
    return () => {
      alive = false;
    };
  }, [coopId]);
  async function locate() {
    setGpsBusy(true);
    setError("");
    try {
      const p = await Location.requestForegroundPermissionsAsync();
      if (!p.granted)
        throw Error("Autorize a localização ou selecione o endereço no mapa.");
      const result = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setPosition({
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGpsBusy(false);
    }
  }
  async function save() {
    if (guard.current) return;
    setError("");
    const preferredDate = parseFortalezaDateTime(date, time);
    if (
      !coopId ||
      address.trim().length < 5 ||
      !preferredDate ||
      new Date(preferredDate).getTime() <= Date.now()
    ) {
      setError(
        "Selecione a cooperativa, informe o endereço e uma data e horário futuros válidos (horário de Fortaleza).",
      );
      return;
    }
    const materials: RequestedScheduleMaterialInput[] = [];
    for (const item of catalog.filter((i) => Object.hasOwn(selection, i.id))) {
      const raw = selection[item.id];
      const quantity = raw.trim() ? Number(raw.replace(",", ".")) : undefined;
      if (
        quantity !== undefined &&
        (!Number.isFinite(quantity) || quantity <= 0)
      ) {
        setError(
          "Informe quantidades positivas ou deixe a estimativa em branco.",
        );
        return;
      }
      materials.push({
        wasteTypeId: item.id,
        unit: item.unit || item.defaultUnit || "KG",
        estimatedQuantity: quantity,
      });
    }
    if (proposed.trim())
      materials.push({
        proposedMaterial: { name: proposed.trim(), unit: proposalUnit },
        unit: proposalUnit,
      });
    if (!materials.length) {
      setError(
        "Selecione um material ou descreva um material ainda não catalogado.",
      );
      return;
    }
    guard.current = true;
    setSaving(true);
    try {
      await scheduleService.create({
        cooperativeId: coopId,
        preferredDate,
        requestedMaterials: materials,
        pickupAddress: address.trim(),
        pickupLatitude: position?.latitude,
        pickupLongitude: position?.longitude,
        notes: notes.trim() || undefined,
      });
      notifySuccess(
        "Solicitação registrada. A cooperativa confirmará disponibilidade e atendimento.",
      );
      router.replace("/(pf-tabs)/history");
    } catch (e: any) {
      setError(
        `${e.message || "Não foi possível registrar."} Se a conexão caiu, confira suas solicitações antes de repetir.`,
      );
    } finally {
      guard.current = false;
      setSaving(false);
    }
  }
  return (
    <Workspace
      title="Solicitar coleta"
      subtitle="Escolha a cooperativa e os materiais. O atendimento será confirmado pela equipe."
    >
      <Card>
        <Text style={{ fontWeight: "700" }}>1. Cooperativa responsável</Text>
        {loading && <Notice text="Carregando…" />}
        {cooperatives.map((c) => (
          <Pressable
            key={c.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: coopId === c.id }}
            onPress={() => setCoopId(c.id)}
            style={{
              padding: 12,
              borderWidth: 1,
              borderColor: coopId === c.id ? "#028C56" : "#E2E8F0",
              borderRadius: 10,
              marginTop: 6,
            }}
          >
            <Text>{c.name}</Text>
            <Text style={{ color: "#64748B" }}>
              {[c.city, c.state, c.address].filter(Boolean).join(" · ")}
            </Text>
          </Pressable>
        ))}
        {!cooperatives.length && !loading && (
          <Action
            secondary
            label="Tentar carregar cooperativas"
            onPress={() => void load()}
          />
        )}
      </Card>
      <Card>
        <Text style={{ fontWeight: "700" }}>2. Endereço e localização</Text>
        <Field
          label="Endereço completo e referência"
          value={address}
          onChangeText={setAddress}
          maxLength={500}
        />
        <Action
          secondary
          busy={gpsBusy}
          label="Usar posição atual do aparelho"
          onPress={() => void locate()}
        />
        <Notice text="A posição confirma o ponto de retirada; confira se corresponde ao endereço informado." />
        <OperationalMap
          baseLabel={null}
          baseLatitude={position?.latitude ?? -3.7319}
          baseLongitude={position?.longitude ?? -38.5267}
          points={
            position
              ? [{ id: "pickup", ...position, title: "Ponto de retirada" }]
              : []
          }
          onPick={(latitude, longitude) => setPosition({ latitude, longitude })}
        />
        <Notice
          text={
            position
              ? `Local confirmado: ${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}`
              : "Localização ainda não confirmada. O endereço será enviado mesmo sem coordenadas."
          }
        />
      </Card>
      <Card>
        <Text style={{ fontWeight: "700" }}>3. Materiais previstos</Text>
        <Field
          label="Buscar material"
          value={search}
          onChangeText={setSearch}
        />
        {catalog
          .filter((i) =>
            i.name
              .toLocaleLowerCase("pt-BR")
              .includes(search.toLocaleLowerCase("pt-BR")),
          )
          .slice(0, visible)
          .map((item) => (
            <View key={item.id}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{
                  checked: Object.hasOwn(selection, item.id),
                }}
                onPress={() =>
                  setSelection((old) => {
                    const next = { ...old };
                    if (Object.hasOwn(next, item.id)) delete next[item.id];
                    else next[item.id] = "";
                    return next;
                  })
                }
                style={{
                  padding: 12,
                  backgroundColor: Object.hasOwn(selection, item.id)
                    ? "#DCFCE7"
                    : "#F8FAFC",
                  borderRadius: 8,
                }}
              >
                <Text>
                  {Object.hasOwn(selection, item.id) ? "✓ " : ""}
                  {item.name} · {unitLabel(item.unit || item.defaultUnit)}
                </Text>
              </Pressable>
              {Object.hasOwn(selection, item.id) && (
                <Field
                  label={`Estimativa de ${item.name} (opcional)`}
                  keyboardType="decimal-pad"
                  value={selection[item.id]}
                  onChangeText={(value) =>
                    setSelection((old) => ({ ...old, [item.id]: value }))
                  }
                />
              )}
            </View>
          ))}
        {catalog.length > visible && (
          <Action
            secondary
            label="Mostrar mais materiais"
            onPress={() => setVisible((v) => v + 40)}
          />
        )}
        <Field
          label="Material não encontrado (opcional)"
          value={proposed}
          onChangeText={setProposed}
          maxLength={150}
        />
        {!!proposed && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(["KG", "TON", "LITER", "UNIT", "CUBIC_METER"] as WasteUnit[]).map(
              (unit) => (
                <Action
                  key={unit}
                  secondary={proposalUnit !== unit}
                  label={unitLabel(unit)}
                  onPress={() => setProposalUnit(unit)}
                />
              ),
            )}
          </View>
        )}
      </Card>
      <Card>
        <Text style={{ fontWeight: "700" }}>4. Data preferencial</Text>
        <Field
          label="Data (DD/MM/AAAA)"
          value={date}
          onChangeText={setDate}
          maxLength={10}
          placeholder="25/10/2026"
        />
        <Field
          label="Horário de Fortaleza (HH:MM)"
          value={time}
          onChangeText={setTime}
          maxLength={5}
          placeholder="14:30"
        />
        <Field
          label="Observações (opcional)"
          value={notes}
          onChangeText={setNotes}
          multiline
          maxLength={2000}
        />
        {!!error && <Notice error text={error} />}
        <Action
          label="Enviar solicitação"
          onPress={() => void save()}
          busy={saving}
          disabled={loading || !coopId}
        />
      </Card>
    </Workspace>
  );
}
