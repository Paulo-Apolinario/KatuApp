import type { ExtraContext, ExtraOrderPayload } from "../../types/extraOrder";
import type { AddressDraft } from "./ExtraOrderAddress";
export const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
export function selectGenerator(
  payload: ExtraOrderPayload,
  generator: ExtraContext["generators"][number],
) {
  const draft: AddressDraft = {
    cep: (generator.zipCode || "").replace(/\D/g, ""),
    street: generator.street || "",
    number: generator.number || "",
    complement: "",
    neighborhood: generator.neighborhood || "",
    city: generator.city || "",
    state: generator.state || "",
  };
  return {
    draft,
    payload: {
      ...payload,
      originType: "GENERATOR" as const,
      generatorId: generator.id,
      originName: generator.companyName || generator.name,
      contactPhone: generator.phone || "",
      pickupAddress: generator.street
        ? [
            generator.street,
            generator.number,
            generator.neighborhood,
            generator.city,
            generator.state,
            generator.zipCode,
          ]
            .filter(Boolean)
            .join(", ")
        : generator.address || "",
      latitude: generator.latitude ?? undefined,
      longitude: generator.longitude ?? undefined,
      accuracyMeters: undefined,
      sourceScheduleId: undefined,
    },
  };
}
export function clearOrigin(
  payload: ExtraOrderPayload,
  originType: "PF" | "GENERATOR",
): ExtraOrderPayload {
  return {
    ...payload,
    originType,
    generatorId: undefined,
    sourceScheduleId: undefined,
    originName: "",
    contactPhone: "",
    pickupAddress: "",
    latitude: undefined,
    longitude: undefined,
    accuracyMeters: undefined,
  };
}
export function originError(p: ExtraOrderPayload) {
  if (p.originName.trim().length < 2)
    return "Informe o nome da pessoa ou escolha um gerador.";
  if (
    (p.generatorId || p.pickupAddress.trim()) &&
    p.pickupAddress.trim().length < 5
  )
    return p.generatorId
      ? "Informe o endereço da retirada."
      : "Informe um endereço com pelo menos cinco caracteres ou deixe o campo em branco.";
  return "";
}
