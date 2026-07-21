import type {
  Collection,
  CollectionStatus,
  WasteUnit,
} from "./collection";

/*
 * ============================================================
 * STATUS
 * ============================================================
 */

export type ScheduleStatus =
  | "REQUESTED"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

/*
 * ============================================================
 * MATERIAL PROPOSTO
 * ============================================================
 */

export interface ProposedScheduleMaterial {
  name: string;
  category?: string | null;
  subcategory?: string | null;
  unit: WasteUnit;
}

/*
 * ============================================================
 * MATERIAL ENVIADO PARA A API
 * ============================================================
 */

export interface RequestedScheduleMaterialInput {
  wasteTypeId?: string;
  proposedMaterial?: ProposedScheduleMaterial;
  estimatedQuantity?: number;
  unit: WasteUnit;
}

/*
 * ============================================================
 * MATERIAL RETORNADO PELA API
 * ============================================================
 */

export interface ScheduleWasteTypeSummary {
  id: string;
  cooperativeId?: string | null;
  name: string;
  category?: string | null;
  subcategory?: string | null;
  defaultUnit?: WasteUnit;
  unit?: WasteUnit;
  internalCode?: string | null;
  ncm?: string | null;
  wasteClass?: string | null;
  description?: string | null;
  isActive?: boolean;
  status?: string | null;
}

export interface ScheduleCatalogSuggestionSummary {
  id: string;
  cooperativeId?: string | null;
  origin?: string | null;
  status?: string | null;
  name: string;
  category?: string | null;
  subcategory?: string | null;
  unit: WasteUnit;
  approvedWasteTypeId?: string | null;
  reviewedByUserId?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ScheduleRequestedMaterialRecord {
  id: string;
  scheduleId?: string;
  wasteTypeId?: string | null;
  catalogSuggestionId?: string | null;
  nameSnapshot: string;
  categorySnapshot?: string | null;
  subcategorySnapshot?: string | null;
  estimatedQuantity?: number | null;
  unit: WasteUnit;
  wasteType?: ScheduleWasteTypeSummary | null;
  catalogSuggestion?: ScheduleCatalogSuggestionSummary | null;
  createdAt?: string;
  updatedAt?: string;
}

/*
 * ============================================================
 * ENTIDADES RELACIONADAS
 * ============================================================
 */

export interface ScheduleGeneratorSummary {
  id: string;
  name?: string | null;
  businessName?: string | null;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  cooperativeId?: string | null;
}

export interface ScheduleCooperativeSummary {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface ScheduleRequestedBySummary {
  id: string;
  displayName?: string | null;
  email?: string | null;
  role?: string | null;
}

/*
 * ============================================================
 * AGENDAMENTO
 * ============================================================
 */

export interface Schedule {
  id: string;
  cooperativeId: string;
  generatorId?: string | null;
  requestedByUserId?: string | null;
  preferredDate?: string | null;
  scheduledDate?: string | null;
  status: ScheduleStatus;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  generator?: ScheduleGeneratorSummary | null;
  cooperative?: ScheduleCooperativeSummary | null;
  requestedBy?: ScheduleRequestedBySummary | null;
  requestedMaterials?: ScheduleRequestedMaterialRecord[];
  collections?: Collection[];
}

/*
 * ============================================================
 * PAYLOADS
 * ============================================================
 */

export interface CreateSchedulePayload {
  cooperativeId?: string;
  generatorId?: string;
  preferredDate?: string;
  scheduledDate?: string;
  requestedMaterials: RequestedScheduleMaterialInput[];
  notes?: string;
}

export interface UpdateScheduleStatusPayload {
  status: "SCHEDULED" | "CANCELLED";
}

/*
 * ============================================================
 * MODELO LOCAL DA TELA
 * ============================================================
 */

export interface ScheduleMaterialDraft {
  localId: string;
  wasteTypeId?: string;
  proposedMaterial?: ProposedScheduleMaterial;
  name: string;
  category?: string | null;
  subcategory?: string | null;
  estimatedQuantity?: number;
  unit: WasteUnit;
  source: "CATALOG" | "PROPOSED";
}

/*
 * ============================================================
 * ALIASES DE COMPATIBILIDADE
 * ============================================================
 */

export type RequestedScheduleMaterial =
  RequestedScheduleMaterialInput;

export type ScheduleCollectionStatus =
  CollectionStatus;
