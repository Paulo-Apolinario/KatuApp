import { useEffect, useRef, useState } from "react";
import { Text } from "react-native";
import { Action, Field, Notice } from "../../components/ui/Workspace";
import OperationalMap from "../../components/maps/OperationalMap";
import * as Location from "../../services/deviceLocation";
import { api } from "../../services/api";
import type { ExtraOrderPayload } from "../../types/extraOrder";

export type AddressDraft = {
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
};
export const emptyAddressDraft: AddressDraft = {
  cep: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
};
type Point = { latitude: number; longitude: number; accuracyMeters?: number };
type ViaCep = {
  erro?: boolean;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
};

export default function ExtraOrderAddress({
  value,
  draft,
  onDraft,
  onChange,
  disabled = false,
  onPending,
}: {
  value: ExtraOrderPayload;
  draft: AddressDraft;
  onDraft: (draft: AddressDraft) => void;
  onChange: (value: ExtraOrderPayload) => void;
  disabled?: boolean;
  onPending: (pending: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [point, setPoint] = useState<Point | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    onPending(open || loading);
  }, [open, loading, onPending]);
  useEffect(() => {
    setOpen(false);
    setPoint(null);
    revision.current++;
  }, [value.generatorId]);
  // Do not apply a CEP/GPS response after the user changes origin/address or closes the picker.
  const revision = useRef(0);
  const latest = useRef({ value, draft });
  latest.current = { value, draft };
  const lastValue = useRef(value);
  if (lastValue.current !== value) {
    if (
      lastValue.current.pickupAddress !== value.pickupAddress ||
      lastValue.current.generatorId !== value.generatorId
    )
      revision.current++;
    lastValue.current = value;
  }
  function address(text: string) {
    revision.current++;
    setError("");
    onChange({
      ...value,
      pickupAddress: text,
      latitude: undefined,
      longitude: undefined,
      accuracyMeters: undefined,
    });
  }
  function updateDraft(next: AddressDraft) {
    onDraft(next);
    address(
      [
        next.street.trim(),
        next.number.trim(),
        next.complement.trim(),
        next.neighborhood.trim(),
        [next.city.trim(), next.state.trim()].filter(Boolean).join("/"),
        next.cep.length === 8
          ? `CEP ${next.cep.slice(0, 5)}-${next.cep.slice(5)}`
          : "",
      ]
        .filter(Boolean)
        .join(", "),
    );
  }
  async function lookup() {
    if (draft.cep.length !== 8) {
      setError("Informe um CEP com 8 dígitos.");
      return;
    }
    const request = ++revision.current;
    setLoading(true);
    setError("");
    try {
      const result = await api.getExternalJson<ViaCep>(
        `https://viacep.com.br/ws/${draft.cep}/json/`,
      );
      if (request !== revision.current) return;
      if (result.erro || !result.localidade || !result.uf)
        throw Error(
          "CEP não encontrado. Confira os dígitos ou preencha o endereço manualmente.",
        );
      updateDraft({
        ...latest.current.draft,
        street: result.logradouro || "",
        neighborhood: result.bairro || "",
        city: result.localidade,
        state: result.uf,
      });
    } catch (e) {
      if (request === revision.current)
        setError(
          e instanceof Error
            ? e.message
            : "Não foi possível buscar o CEP. Preencha o endereço manualmente.",
        );
    } finally {
      setLoading(false);
    }
  }
  function startMap() {
    revision.current++;
    setError("");
    setPoint(
      value.latitude != null && value.longitude != null
        ? {
            latitude: value.latitude,
            longitude: value.longitude,
            accuracyMeters: value.accuracyMeters,
          }
        : null,
    );
    setOpen(true);
  }
  async function gps() {
    const request = ++revision.current;
    setLoading(true);
    setError("");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted)
        throw Error(
          "Localização não autorizada. Escolha no mapa ou informe o endereço manualmente.",
        );
      const result = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      if (request !== revision.current) return;
      setPoint({
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
        accuracyMeters: result.coords.accuracy ?? undefined,
      });
      setOpen(true);
    } catch (e) {
      if (request === revision.current)
        setError(
          e instanceof Error
            ? e.message
            : "Não foi possível obter a localização.",
        );
    } finally {
      setLoading(false);
    }
  }
  function cancel() {
    revision.current++;
    setOpen(false);
    setPoint(null);
    setError("");
  }
  function confirm() {
    if (!point) {
      setError("Toque no mapa para selecionar o local da retirada.");
      return;
    }
    if (value.pickupAddress.trim().length < 5) {
      setError("Informe o endereço da retirada antes de confirmar o ponto.");
      return;
    }
    onChange({ ...value, ...point, pickupAddress: value.pickupAddress.trim() });
    setOpen(false);
    setPoint(null);
    setError("");
  }
  return (
    <>
      <Notice text="Informe o endereço pelo CEP ou manualmente. Se escolher um ponto no mapa, confira o endereço e confirme a seleção." />
      <Field
        label="CEP da retirada (opcional)"
        value={draft.cep}
        keyboardType="number-pad"
        maxLength={9}
        editable={!disabled && !loading}
        onChangeText={(v) => {
          revision.current++;
          onDraft({ ...draft, cep: v.replace(/\D/g, "").slice(0, 8) });
        }}
      />
      <Action
        label="Buscar endereço pelo CEP"
        secondary
        onPress={() => void lookup()}
        disabled={disabled || loading}
        busy={loading}
      />
      {(
        [
          ["street", "Rua / logradouro"],
          ["number", "Número ou S/N"],
          ["complement", "Complemento / referência"],
          ["neighborhood", "Bairro"],
          ["city", "Município"],
          ["state", "UF"],
        ] as const
      ).map(([key, label]) => (
        <Field
          key={key}
          label={label}
          value={draft[key]}
          editable={!disabled && !loading}
          maxLength={key === "state" ? 2 : 150}
          onChangeText={(v) =>
            updateDraft({
              ...draft,
              [key]: key === "state" ? v.toUpperCase() : v,
            })
          }
        />
      ))}
      <Field
        label="Endereço da retirada"
        value={value.pickupAddress}
        onChangeText={address}
        maxLength={500}
        editable={!disabled && !loading}
        multiline
      />
      <Action
        label="Usar localização atual do aparelho"
        secondary
        onPress={() => void gps()}
        disabled={disabled || loading}
      />
      {!open && (
        <Action
          label="Selecionar ponto no mapa"
          secondary
          onPress={startMap}
          disabled={disabled || loading}
        />
      )}
      {open && (
        <>
          <OperationalMap
            key={point ? "positioned" : "empty"}
            baseLabel={null}
            baseLatitude={point?.latitude ?? -3.7319}
            baseLongitude={point?.longitude ?? -38.5267}
            selectedPointId="origin"
            points={
              point
                ? [
                    {
                      id: "origin",
                      latitude: point.latitude,
                      longitude: point.longitude,
                      title: "Local da retirada — aguardando confirmação",
                    },
                  ]
                : []
            }
            onPick={
              disabled || loading
                ? undefined
                : (latitude, longitude) => {
                    setPoint({ latitude, longitude });
                    setError("");
                  }
            }
          />
          <Text>
            {point
              ? `Ponto selecionado: ${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}. Ainda não confirmado.`
              : "Toque no mapa para selecionar o local."}
          </Text>
          <Notice
            text={`Endereço a confirmar: ${value.pickupAddress || "Preencha o endereço acima."}`}
          />
          <Action
            label="Confirmar endereço e ponto"
            onPress={confirm}
            disabled={disabled || loading || !point}
          />
          <Action
            label="Cancelar seleção"
            secondary
            onPress={cancel}
            disabled={disabled}
          />
        </>
      )}
      <Notice
        text={
          value.latitude != null && value.longitude != null
            ? `Local salvo na O.C.: ${value.latitude.toFixed(5)}, ${value.longitude.toFixed(5)}.`
            : "Endereço informado sem ponto no mapa. As coordenadas são opcionais e não serão estimadas pelo CEP."
        }
      />
      {!!error && <Notice error text={error} />}
    </>
  );
}
