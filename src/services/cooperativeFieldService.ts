import { api } from './api';
export type FieldKind = 'collectors' | 'drivers' | 'generators' | 'pevs';
export type FieldItem = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string;
  accessStatus?: string;
  type?: string;
  documentNumber?: string | null;
  companyName?: string | null;
  address?: string | null;
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location?: string | null;
  binId?: string;
  needsPickup?: boolean;
  acceptedMaterials?: string[];
  restrictions?: string | null;
  responsibleName?: string | null;
  responsibleContact?: string | null;
};
export type FieldWork = {
  id: string;
  status: string;
  createdAt: string;
  collectedAt?: string;
  startedAt?: string;
  receivedAt?: string;
  completedAt?: string;
  cancellationReason?: string;
  notes?: string;
  routePoint?: {
    name?: string;
  };
  schedule?: {
    scheduledDate?: string;
    preferredDate?: string;
  };
  generator?: {
    id: string;
    name: string;
  };
  bin?: {
    id: string;
    name: string;
  };
  route?: {
    id: string;
    name: string;
    scheduledDate?: string;
    status: string;
  };
  collector?: {
    name: string;
  };
  driver?: {
    name: string;
  };
  vehicle?: {
    plate: string;
  };
  participants: {
    collectorId: string;
    nameSnapshot: string;
  }[];
  collectionMaterials: {
    id: string;
    nameSnapshot: string;
    quantity: number;
    unit: string;
  }[];
  incidents: {
    id: string;
    status: string;
    description: string;
    resolution?: string;
  }[];
};
export type FieldPage = {
  page: number;
  total: number;
  totalPages: number;
};
export type FieldDetail = {
  item: FieldItem;
  collections: FieldWork[];
  requests: {
    id: string;
    status: string;
    scheduledDate?: string;
    preferredDate?: string;
    createdAt: string;
    notes?: string;
  }[];
  summary: {
    pending: number;
    active: number;
    incidents: number;
  };
  pagination: FieldPage;
};
export const fieldService = {
  list: (kind: FieldKind, q = '', page = 1) => api.get<{
    items: FieldItem[];
    pagination: FieldPage;
  }>(`/cooperative-field/${kind}?${new URLSearchParams({
    q,
    page: String(page)
  })}`, true),
  detail: (kind: FieldKind, id: string, filter = 'all', page = 1) => api.get<FieldDetail>(`/cooperative-field/${kind}/${encodeURIComponent(id)}?${new URLSearchParams({
    filter,
    page: String(page)
  })}`, true)
};
export const fieldLabels: Record<string, string> = {
  PENDING: 'Aguardando saída',
  REQUESTED: 'Solicitada',
  SCHEDULED: 'Agendada',
  IN_PROGRESS: 'Em campo',
  COLLECTED: 'Coletada',
  RECEIVED: 'Recebida',
  SORTING: 'Em triagem',
  COMPLETED: 'Concluída',
  CANCELLED: 'Cancelada',
  AVAILABLE: 'Disponível',
  ON_ROUTE: 'Em rota',
  INACTIVE: 'Inativo',
  ACTIVE: 'Ativo',
  PENDING_ACTIVATION: 'Aguardando ativação',
  BLOCKED: 'Bloqueado',
  FULL: 'Cheio',
  MAINTENANCE: 'Em manutenção',
  OPEN: 'Aberta',
  RESOLVED: 'Resolvida'
};
export function fieldDate(v?: string | null) {
  return v && Number.isFinite(new Date(v).getTime()) ? new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Fortaleza',
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(v)) : 'Sem data definida';
}
export const fieldAddress = (v: FieldItem) => v.address || [v.street, v.number, v.neighborhood, v.city, v.state].filter(Boolean).join(', ') || v.location || 'Endereço não informado';
export const fieldTitle = (v: FieldItem) => v.name || v.binId || 'Cadastro sem nome';
export const fieldQuantity = (n: unknown, u: string) => `${Number(n || 0).toLocaleString('pt-BR', {
  maximumFractionDigits: 3
})} ${{
  KG: 'kg',
  TON: 't',
  LITER: 'L',
  UNIT: 'un.',
  CUBIC_METER: 'm³'
}[u] || u}`;
export function fieldDocument(value: string) {
  const v = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return v.length <= 11 ? v.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d{1,2})$/, ' .$1-$2').replace(' .', '.') : v.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, '$1.$2.$3/$4-$5');
}
