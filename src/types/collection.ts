/*
 * ============================================================
 * STATUS E UNIDADES
 * ============================================================
 */

export type CollectionStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COLLECTED"
  | "RECEIVED"
  | "SORTING"
  | "COMPLETED"
  | "CANCELLED";

export type WasteUnit =
  | "KG"
  | "TON"
  | "LITER"
  | "UNIT"
  | "CUBIC_METER";

/*
 * ============================================================
 * MATERIAL PROPOSTO
 * ============================================================
 */

export interface ProposedCollectionMaterial {
  name: string;
  category?: string | null;
  subcategory?: string | null;
  unit: WasteUnit;
}

/*
 * ============================================================
 * MATERIAL DA COLETA
 * ============================================================
 */

export interface CollectionMaterial {
  wasteTypeId?: string | null;
  proposedMaterial?: ProposedCollectionMaterial;
  type: string;
  name?: string | null;
  category?: string | null;
  subcategory?: string | null;
  quantity?: number;
  quantityKg: number;
  unit?: WasteUnit;
  notes?: string | null;
}

/*
 * ============================================================
 * DESTINAÇÃO
 * ============================================================
 */

export interface CollectionWasteDestinationSummary {
  id: string;
  collectionWasteEntryId?: string | null;
  stockItemId?: string | null;
  stockLotId?: string | null;
  type?: string | null;
  quantity?: number;
  unit?: WasteUnit;
  destinationName?: string | null;
  destinationDate?: string | null;
  status?: string | null;
  cancelledAt?: string | null;
  cancelledReason?: string | null;
  createdByUserId?: string | null;
  createdByNameSnapshot?: string | null;
  cancelledByUserId?: string | null;
  cancelledByNameSnapshot?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/*
 * ============================================================
 * ENTRADA OPERACIONAL
 * ============================================================
 */

export interface CollectionWasteEntrySummary {
  id: string;
  cooperativeId?: string;
  collectionId?: string;
  collectionMaterialId?: string;
  wasteTypeId?: string | null;
  generatorId?: string | null;
  routeId?: string | null;
  vehicleId?: string | null;
  driverId?: string | null;
  collectorId?: string | null;
  materialNameSnapshot?: string | null;
  categorySnapshot?: string | null;
  subcategorySnapshot?: string | null;
  unit?: WasteUnit;
  collectedQuantity?: number;
  destinedQuantity?: number;
  remainingQuantity?: number;
  status?: string | null;
  origin?: string | null;
  notes?: string | null;
  collectedAt?: string | null;
  createdByUserId?: string | null;
  createdByNameSnapshot?: string | null;
  destinations?: CollectionWasteDestinationSummary[];
  createdAt?: string;
  updatedAt?: string;
}

/*
 * ============================================================
 * CATÁLOGO
 * ============================================================
 */

export interface WasteCatalogItem {
  id: string;
  cooperativeId?: string;
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
  createdAt?: string;
  updatedAt?: string;
}

/*
 * ============================================================
 * MATERIAL NORMALIZADO
 * ============================================================
 */

export interface CollectionCatalogSuggestionSummary {
  id: string;
  name: string;
  category?: string | null;
  subcategory?: string | null;
  unit?: WasteUnit;
  status?: string | null;
  origin?: string | null;
}

export interface CollectionMaterialRecord {
  id: string;
  collectionId?: string;
  wasteTypeId?: string | null;
  catalogSuggestionId?: string | null;
  nameSnapshot?: string | null;
  categorySnapshot?: string | null;
  subcategorySnapshot?: string | null;
  unit?: WasteUnit;
  quantity?: number;
  wasteType?: WasteCatalogItem | null;
  catalogSuggestion?: CollectionCatalogSuggestionSummary | null;
  wasteEntry?: CollectionWasteEntrySummary | null;
  createdAt?: string;
  updatedAt?: string;
}

/*
 * ============================================================
 * ENTIDADES RELACIONADAS
 * ============================================================
 */

export interface CollectionGeneratorSummary {
  id: string;
  name?: string | null;
  businessName?: string | null;
  companyName?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface CollectionCollectorSummary {
  id: string;
  name?: string | null;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
}

export interface CollectionDriverSummary {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  cnh?: string | null;
  cnhCategory?: string | null;
  status?: string | null;
}

export interface CollectionVehicleSummary {
  id: string;
  plate?: string | null;
  model?: string | null;
  brand?: string | null;
  year?: number | null;
  capacityKg?: number | null;
  status?: string | null;
}

export interface CollectionRouteSummary {
  id: string;
  name?: string | null;
  description?: string | null;
  scheduledDate?: string | null;
  stops?: string[];
  status?: string | null;
  driverId?: string | null;
}

export interface CollectionScheduleRequestedMaterialSummary {
  id: string;
  wasteTypeId?: string | null;
  catalogSuggestionId?: string | null;
  nameSnapshot: string;
  categorySnapshot?: string | null;
  subcategorySnapshot?: string | null;
  estimatedQuantity?: number | null;
  unit: WasteUnit;
}

export interface CollectionScheduleSummary {
  id: string;
  scheduledDate?: string | null;
  preferredDate?: string | null;
  status?: string | null;
  notes?: string | null;
  requestedMaterials?: CollectionScheduleRequestedMaterialSummary[];
  requestedBy?: {
    id: string;
    displayName?: string | null;
    email?: string | null;
    role?: string | null;
  } | null;
  generator?: CollectionGeneratorSummary | null;
}

/*
 * ============================================================
 * COLETA
 * ============================================================
 */

export interface Collection {
  id: string;
  cooperativeId: string;
  generatorId?: string | null;
  collectorId?: string | null;
  scheduleId?: string | null;
  driverId?: string | null;
  vehicleId?: string | null;
  routeId?: string | null;
  startedAt?: string | null;
  collectedAt?: string | null;
  receivedAt?: string | null;
  sortingStartedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  startedByUserId?: string | null;
  fieldCompletedByUserId?: string | null;
  receivedByUserId?: string | null;
  sortingStartedByUserId?: string | null;
  completedByUserId?: string | null;
  cancelledByUserId?: string | null;
  cancellationReason?: string | null;
  totalWeightKg: number;
  materials: CollectionMaterial[];
  collectionMaterials?: CollectionMaterialRecord[];
  collectionWasteEntries?: CollectionWasteEntrySummary[];
  notes?: string | null;
  status: CollectionStatus;
  createdAt?: string;
  updatedAt?: string;
  generator?: CollectionGeneratorSummary | null;
  collector?: CollectionCollectorSummary | null;
  driver?: CollectionDriverSummary | null;
  vehicle?: CollectionVehicleSummary | null;
  route?: CollectionRouteSummary | null;
  schedule?: CollectionScheduleSummary | null;
}

/*
 * ============================================================
 * PAYLOADS
 * ============================================================
 */

export interface CreateCollectionPayload {
  scheduleId: string;
  collectorId: string;
  driverId?: string;
  vehicleId?: string;
  routeId?: string;
  notes?: string;
}

export interface StartCollectionPayload {
  startedAt?: string;
  notes?: string;
}

export interface CompleteFieldCollectionMaterialPayload {
  wasteTypeId?: string;
  proposedMaterial?: ProposedCollectionMaterial;
  quantity: number;
  unit: WasteUnit;
  notes?: string;
}

export interface CompleteFieldCollectionPayload {
  collectedAt?: string;
  materials: CompleteFieldCollectionMaterialPayload[];
  totalWeightKg?: number;
  notes?: string;
}

export interface ReceiveCollectionPayload {
  receivedAt?: string;
  notes?: string;
}

export interface StartSortingPayload {
  sortingStartedAt?: string;
  notes?: string;
}

export interface CompleteCollectionPayload {
  completedAt?: string;
  notes?: string;
}

export interface CancelCollectionPayload {
  cancelledAt?: string;
  cancellationReason: string;
}

export interface UpdateCollectionStatusPayload {
  status: CollectionStatus;
  collectedAt?: string;
  totalWeightKg?: number;
  materials?: CollectionMaterial[];
  notes?: string;
  cancellationReason?: string;
}
