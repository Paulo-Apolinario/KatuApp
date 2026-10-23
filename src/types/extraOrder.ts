export type ExtraMaterial = {
  wasteTypeId?: string;
  nameSnapshot?: string;
  proposedMaterial?: { name: string; unit: ExtraUnit };
  unit: ExtraUnit;
  quantity?: number;
};
export type ExtraUnit = "KG" | "TON" | "LITER" | "UNIT" | "CUBIC_METER";
export type ExtraOrderPayload = {
  recordedAt?: string;
  mode: "REQUESTED" | "COLLECTED";
  reason:
    | "UNPLANNED_STOP"
    | "EXTRA_REQUEST"
    | "OUTSIDE_SCHEDULE"
    | "WEEKEND"
    | "OTHER";
  reasonNotes: string;
  originType: "PF" | "GENERATOR";
  originName: string;
  contactPhone?: string;
  pickupAddress: string;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  generatorId?: string;
  sourceScheduleId?: string;
  contextRouteId?: string;
  occurredAt?: string;
  preferredDate?: string;
  custody: "ORIGIN" | "COLLECTOR" | "COOPERATIVE" | "OTHER";
  custodyNotes: string;
  materials: ExtraMaterial[];
  photos: string[];
};
export type ExtraOrder = {
  id: string;
  cooperativeId: string;
  collectorId?: string;
  reporterName?: string;
  status: string;
  revision: number;
  payload: ExtraOrderPayload;
  createdAt: string;
  updatedAt?: string;
  receivedAt?: string;
  custody: string;
  custodyNotes: string;
  routeNameSnapshot?: string;
  collectionId?: string;
  collection?: { id: string; status: string };
  events?: {
    id: string;
    kind: string;
    actorName: string;
    notes: string;
    data?: unknown;
    createdAt: string;
  }[];
  syncStatus?: string;
  syncError?: string;
};
export type ExtraContext = {
  cooperative: { id: string; name: string };
  collectorId?: string;
  generators: {
    id: string;
    name: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  }[];
  routes: { id: string; name: string; status: string }[];
  schedules: {
    id: string;
    generatorId?: string;
    pickupAddress?: string;
    generator?: { name: string };
    requestedBy?: { displayName: string };
  }[];
  catalog: {
    id: string;
    name: string;
    unit: ExtraUnit;
    defaultUnit: ExtraUnit;
  }[];
  drivers: { id: string; name: string }[];
  vehicles: { id: string; plate: string; driverId?: string }[];
};
export const orderStatusLabel = (status: string) =>
  ({
    DRAFT: "Rascunho neste aparelho",
    LOCAL_PENDING: "Aguardando envio à cooperativa",
    PENDING_REVIEW: "Aguardando análise",
    NEEDS_INFO: "Complementação solicitada",
    ACCEPTED: "Aceita · acompanhar coleta",
    REJECTED: "Recusada com justificativa",
  })[status] || status;
export const custodyLabel = (value: string) =>
  ({
    ORIGIN: "Na origem",
    COLLECTOR: "Com o catador / em transporte",
    COOPERATIVE: "Na cooperativa",
    OTHER: "Outro local informado",
  })[value] || value;
export const reasonLabel = (value: string) =>
  ({
    UNPLANNED_STOP: "Ponto fora do planejamento da rota",
    EXTRA_REQUEST: "Solicitação extra",
    OUTSIDE_SCHEDULE: "Fora da programação",
    WEEKEND: "Fim de semana",
    OTHER: "Outro motivo",
  })[value] || value;

export const extraEventLabel = (kind: string) =>
  ({
    SUBMITTED: "Ordem registrada",
    RESUBMITTED: "Complementação enviada",
    ACCEPT: "Ordem aceita",
    NEEDS_INFO: "Complementação solicitada",
    REJECT: "Ordem recusada",
    RECEIVED: "Recebimento confirmado",
    RECEIVED_BY_COLLECTION: "Recebimento pela coleta vinculada",
  })[kind] || kind;
