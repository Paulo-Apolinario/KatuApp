import { api } from "./api";
export type PevPoint = {
  id: string;
  binId: string;
  name?: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  city?: string;
  neighborhood?: string;
  cooperativeId: string;
  cooperative: { name: string };
  canCollect: boolean;
  needsPickup: boolean;
  acceptedMaterials: string[];
  restrictions?: string;
  status: string;
};
export type PevRequest = {
  cooperativeId: string;
  id: string;
  binId: string;
  binName: string;
  address: string;
  condition: string;
  notes: string;
  photos?: string[];
  status: string;
  version: number;
  response?: string;
  requesterName: string;
  requesterRole: string;
  createdAt: string;
  collectionId?: string;
  collection?: {
    id: string;
    status: string;
    collectorId?: string;
    collector?: { name: string };
  };
  updates?: {
    id: string;
    kind: string;
    notes: string;
    actorName: string;
    photos: string[];
    createdAt: string;
  }[];
  updatesTotal?: number;
  updatesPage?: number;
};
export const pevStatus = (r: PevRequest) =>
  ({
    RESOLVED: "Atendimento encerrado",
    DISMISSED: "Pedido encerrado com justificativa",
  })[r.status] ||
  (r.collection
    ? {
        PENDING: "Retirada programada",
        IN_PROGRESS: "Coleta em andamento",
        COLLECTED: "Retirado · aguardando recebimento",
        RECEIVED: "Recebido pela cooperativa",
        SORTING: "Em triagem",
        COMPLETED: "Coleta concluída",
        CANCELLED: "Retirada cancelada · aguarda análise",
      }[r.collection.status]
    : "Aguardando análise");
export const pevCondition = {
  FULL: "PEV cheio",
  OVERFLOW: "Material transbordando",
  DAMAGED: "Estrutura danificada",
  CONTAMINATED: "Material inadequado",
  OTHER: "Outra situação",
};
export const pevRequestService = {
  points: (search = "", page = 1) =>
    api.get<{ bins: PevPoint[]; total: number; page: number }>(
      `/pev-points?search=${encodeURIComponent(search)}&page=${page}`,
      true,
    ),
  list: (page = 1) =>
    api.get<{ requests: PevRequest[]; total: number; page: number }>(
      `/pev-requests?page=${page}`,
      true,
    ),
  detail: async (id: string, page = 1) =>
    (
      await api.get<{ request: PevRequest }>(
        `/pev-requests/${encodeURIComponent(id)}?page=${page}`,
        true,
      )
    ).request,
  create: async (p: {
    id: string;
    binId: string;
    condition: string;
    notes: string;
    photos: string[];
  }) =>
    (await api.post<{ request: PevRequest }>("/pev-requests", p, true)).request,
  update: async (
    id: string,
    p: {
      operationId: string;
      expectedVersion: number;
      kind: string;
      notes: string;
      photos: string[];
    },
  ) =>
    (
      await api.post<{ request: PevRequest }>(
        `/pev-requests/${encodeURIComponent(id)}/updates`,
        p,
        true,
      )
    ).request,
  collect: (id: string) =>
    api.post<{ collection: { id: string } }>(
      `/pev-requests/${encodeURIComponent(id)}/collect`,
      {},
      true,
    ),
};
