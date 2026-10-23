import {
  CollectionEntryStatus,
  WasteDestinationType,
  WasteUnit,
} from "@prisma/client";

/*
 * ============================================================
 * USUÁRIO AUTENTICADO
 * ============================================================
 */

export type CollectionEntryAuthenticatedUser = {
  sub: string;
  role: string;

  id?: string;
  userId?: string;
};

/*
 * ============================================================
 * CONTEXTO DE ACESSO
 * ============================================================
 */

/**
 * Contexto identificado a partir do JWT.
 *
 * O módulo de entradas será administrado principalmente pela
 * cooperativa, mas alguns perfis poderão consultar entradas
 * relacionadas às próprias operações.
 */
export type CollectionEntryAccessContext = {
  userId: string;
  role: string;

  cooperativeId: string;

  collectorId?: string | null;
  driverId?: string | null;
  generatorId?: string | null;
};

/*
 * ============================================================
 * FILTROS
 * ============================================================
 */

export type CollectionEntryListFilters = {
  status?: CollectionEntryStatus;

  wasteTypeId?: string;
  collectionId?: string;
  collectionMaterialId?: string;

  generatorId?: string;
  collectorId?: string;
  driverId?: string;
  vehicleId?: string;
  routeId?: string;

  unit?: WasteUnit;

  search?: string;

  dateFrom?: string;
  dateTo?: string;

  onlyWithBalance?: boolean;

  page: number;
  limit: number;
};

/*
 * ============================================================
 * PAGINAÇÃO
 * ============================================================
 */

export type CollectionEntryPagination = {
  page: number;
  limit: number;

  total: number;
  totalPages: number;

  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

/*
 * ============================================================
 * RESUMOS DE QUANTIDADE
 * ============================================================
 */

export type CollectionEntryUnitSummary = {
  unit: WasteUnit;

  collectedQuantity: number;
  destinedQuantity: number;
  remainingQuantity: number;

  entriesCount: number;
};

export type CollectionEntryStatusSummary = {
  status: CollectionEntryStatus;
  entriesCount: number;
};

/**
 * Totais agrupados por unidade.
 *
 * Não devemos somar diretamente KG, litros, unidades e metros cúbicos.
 */
export type CollectionEntryTotalsByUnit = Partial<
  Record<
    WasteUnit,
    {
      collectedQuantity: number;
      destinedQuantity: number;
      remainingQuantity: number;
      entriesCount: number;
    }
  >
>;

/*
 * ============================================================
 * DESTINAÇÕES
 * ============================================================
 */

export type CollectionEntryDestinationSummary = {
  id: string;

  type: WasteDestinationType;

  quantity: number;
  unit: WasteUnit;

  stockLotId?: string | null;

  destinationName?: string | null;
  destinationDocument?: string | null;

  notes?: string | null;

  createdAt: Date;

  createdByUserId?: string | null;
  createdByNameSnapshot?: string | null;
};

/*
 * ============================================================
 * ITEM DE LISTAGEM
 * ============================================================
 */

export type CollectionEntryListItem = {
  id: string;

  cooperativeId: string;

  collectionId: string;
  collectionMaterialId: string;

  wasteTypeId: string | null;

  generatorId: string | null;
  collectorId: string | null;
  driverId: string | null;
  vehicleId: string | null;
  routeId: string | null;

  materialNameSnapshot: string;

  categorySnapshot: string | null;
  subcategorySnapshot: string | null;

  unit: WasteUnit;

  collectedQuantity: number;
  destinedQuantity: number;
  remainingQuantity: number;

  status: CollectionEntryStatus;

  origin: string | null;
  notes: string | null;

  collectedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
};

/*
 * ============================================================
 * RESPOSTAS DO SERVICE
 * ============================================================
 */

export type CollectionEntryListResult = {
  success: true;

  entries: unknown[];

  pagination: CollectionEntryPagination;

  totalsByUnit: CollectionEntryTotalsByUnit;
};

export type CollectionEntrySummaryResult = {
  success: true;

  totalEntries: number;
  pendingEntries: number;
  partiallyDestinedEntries: number;
  fullyDestinedEntries: number;

  totalsByUnit: CollectionEntryTotalsByUnit;

  entriesByStatus: CollectionEntryStatusSummary[];
};

export type CollectionEntryFindResult = {
  success: true;

  entry: unknown;
};

/*
 * ============================================================
 * BALANÇO OPERACIONAL
 * ============================================================
 */

export type CollectionEntryBalance = {
  collectedQuantity: number;
  destinedQuantity: number;
  remainingQuantity: number;

  status: CollectionEntryStatus;
};

/**
 * Dados utilizados para recalcular o saldo de uma entrada.
 */
export type CollectionEntryBalanceInput = {
  collectedQuantity: number;

  currentDestinedQuantity: number;

  destinationQuantity: number;

  destinationType: WasteDestinationType;
};

/*
 * ============================================================
 * ERROS DE DOMÍNIO
 * ============================================================
 */

export class CollectionEntryDomainError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    message: string,
    options?: {
      statusCode?: number;
      code?: string;
      details?: unknown;
    }
  ) {
    super(message);

    this.name = "CollectionEntryDomainError";

    this.statusCode =
      options?.statusCode ?? 400;

    this.code =
      options?.code ??
      "COLLECTION_ENTRY_ERROR";

    this.details =
      options?.details;
  }
}

export function isCollectionEntryDomainError(
  error: unknown
): error is CollectionEntryDomainError {
  return (
    error instanceof
    CollectionEntryDomainError
  );
}