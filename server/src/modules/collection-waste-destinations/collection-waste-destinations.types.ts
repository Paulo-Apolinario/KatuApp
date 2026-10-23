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

export type WasteDestinationAuthenticatedUser = {
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

export type WasteDestinationAccessContext = {
  userId: string;
  role: string;

  cooperativeId: string;

  collectorId?: string | null;
  driverId?: string | null;
  generatorId?: string | null;
};

/*
 * ============================================================
 * DADOS DE CRIAÇÃO
 * ============================================================
 */

/**
 * Dados enviados para registrar uma destinação.
 *
 * Regras:
 *
 * STOCK
 * - exige stockItemId;
 * - cria um WasteStockLot;
 * - vincula o lote à destinação.
 *
 * TRIAGE
 * - pode registrar local, responsável e observações;
 * - não cria lote.
 *
 * REJECT
 * - registra rejeito;
 * - não cria lote.
 *
 * DISPOSAL
 * - registra descarte;
 * - não cria lote.
 *
 * DIRECT_DESTINATION
 * - registra envio direto a um terceiro;
 * - não cria lote no estoque da cooperativa.
 *
 * RESERVATION
 * - reserva parte do saldo;
 * - não cria lote imediatamente.
 */
export type CreateWasteDestinationData = {
  collectionWasteEntryId: string;

  type: WasteDestinationType;

  quantity: number;
  unit: WasteUnit;

  stockItemId?: string;
  stockLotCode?: string;

  destinationName?: string;
  destinationDocument?: string;
  destinationAddress?: string;
  destinationContact?: string;

  transportDocument?: string;
  environmentalDocument?: string;

  notes?: string;

  destinationDate?: Date;

  metadata?: Record<string, unknown>;
};

/*
 * ============================================================
 * DADOS DE ATUALIZAÇÃO
 * ============================================================
 */

/**
 * A quantidade, a unidade, a entrada e o tipo da destinação não
 * serão alterados diretamente.
 *
 * Caso uma destinação tenha sido registrada incorretamente,
 * deverá ser cancelada e uma nova destinação deverá ser criada.
 */
export type UpdateWasteDestinationData = {
  destinationName?: string | null;
  destinationDocument?: string | null;
  destinationAddress?: string | null;
  destinationContact?: string | null;

  transportDocument?: string | null;
  environmentalDocument?: string | null;

  notes?: string | null;

  destinationDate?: Date | null;

  metadata?: Record<string, unknown> | null;
};

/*
 * ============================================================
 * DADOS DO LOTE DE ESTOQUE
 * ============================================================
 */

export type WasteDestinationStockLotData = {
  stockItemId: string;

  lotCode?: string;

  quantity: number;
  unit: WasteUnit;

  originCollectionId: string;
  originCollectionMaterialId: string;
  originCollectionWasteEntryId: string;

  receivedAt: Date;

  notes?: string | null;
};

/*
 * ============================================================
 * SALDO DA ENTRADA
 * ============================================================
 */

export type WasteEntryQuantityState = {
  collectedQuantity: number;
  destinedQuantity: number;
  remainingQuantity: number;

  unit: WasteUnit;
  status: CollectionEntryStatus;
};

/*
 * ============================================================
 * RESULTADO DO RECÁLCULO
 * ============================================================
 */

export type WasteEntryRecalculationResult = {
  collectedQuantity: number;
  destinedQuantity: number;
  remainingQuantity: number;

  status: CollectionEntryStatus;
};

/*
 * ============================================================
 * RESULTADO DA CRIAÇÃO
 * ============================================================
 */

export type CreateWasteDestinationResult = {
  success: true;

  message: string;

  destination: unknown;

  entry: unknown;

  stockLot?: unknown | null;
};

/*
 * ============================================================
 * RESULTADO DA CONSULTA
 * ============================================================
 */

export type WasteDestinationFindResult = {
  success: true;

  destination: unknown;
};

/*
 * ============================================================
 * RESULTADO DA LISTAGEM
 * ============================================================
 */

export type WasteDestinationPagination = {
  page: number;
  limit: number;

  total: number;
  totalPages: number;

  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type WasteDestinationTotalsByUnit = Partial<
  Record<
    WasteUnit,
    {
      totalQuantity: number;
      destinationsCount: number;
    }
  >
>;

export type WasteDestinationListResult = {
  success: true;

  destinations: unknown[];

  pagination: WasteDestinationPagination;

  totalsByUnit: WasteDestinationTotalsByUnit;
};

/*
 * ============================================================
 * FILTROS
 * ============================================================
 */

export type WasteDestinationListFilters = {
  collectionWasteEntryId?: string;
  collectionId?: string;
  collectionMaterialId?: string;

  type?: WasteDestinationType;
  unit?: WasteUnit;

  stockItemId?: string;
  stockLotId?: string;

  generatorId?: string;
  collectorId?: string;
  driverId?: string;
  vehicleId?: string;
  routeId?: string;

  search?: string;

  dateFrom?: string;
  dateTo?: string;

  page: number;
  limit: number;
};

/*
 * ============================================================
 * CANCELAMENTO
 * ============================================================
 */

/**
 * O cancelamento será usado para desfazer uma destinação.
 *
 * Quando a destinação for do tipo STOCK:
 *
 * - o lote vinculado precisa ser validado;
 * - não poderá haver movimentação posterior incompatível;
 * - a quantidade deverá retornar ao saldo da entrada.
 */
export type CancelWasteDestinationData = {
  reason: string;

  cancelledAt?: Date;
};

/*
 * ============================================================
 * AUDITORIA
 * ============================================================
 */

export type WasteDestinationAuditSnapshot = {
  userId: string;

  userNameSnapshot?: string | null;
  userEmailSnapshot?: string | null;

  createdAt: Date;
};

/*
 * ============================================================
 * MAPEAMENTO DE STATUS
 * ============================================================
 */

/**
 * Status esperado quando toda a quantidade da entrada tiver sido
 * destinada para um único tipo.
 */
export type WasteDestinationFinalStatusMap = Record<
  WasteDestinationType,
  CollectionEntryStatus
>;

export const WASTE_DESTINATION_FINAL_STATUS_MAP: WasteDestinationFinalStatusMap =
  {
    STOCK: CollectionEntryStatus.ADDED_TO_STOCK,

    TRIAGE: CollectionEntryStatus.SENT_TO_TRIAGE,

    REJECT: CollectionEntryStatus.REJECTED,

    DISPOSAL: CollectionEntryStatus.DISCARDED,

    DIRECT_DESTINATION:
      CollectionEntryStatus.DIRECTLY_DESTINED,

    RESERVATION: CollectionEntryStatus.RESERVED,
  };

/*
 * ============================================================
 * ERROS DE DOMÍNIO
 * ============================================================
 */

export class WasteDestinationDomainError extends Error {
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

    this.name = "WasteDestinationDomainError";

    this.statusCode =
      options?.statusCode ?? 400;

    this.code =
      options?.code ??
      "WASTE_DESTINATION_ERROR";

    this.details = options?.details;
  }
}

export function isWasteDestinationDomainError(
  error: unknown
): error is WasteDestinationDomainError {
  return (
    error instanceof
    WasteDestinationDomainError
  );
}