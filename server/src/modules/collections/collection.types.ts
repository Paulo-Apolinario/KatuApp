import {
  CollectionEntryStatus,
  CollectionStatus,
  WasteUnit,
} from "@prisma/client";

/**
 * Usuário extraído do token JWT.
 *
 * O backend atual grava o ID do usuário autenticado em `sub`.
 * Os campos alternativos permanecem disponíveis para compatibilidade
 * com módulos mais antigos.
 */
export type AuthenticatedUser = {
  sub: string;
  role: string;
  id?: string;
  userId?: string;
};

/**
 * Formato antigo ainda enviado pelo aplicativo e por algumas telas.
 *
 * Exemplo:
 * {
 *   type: "Plástico",
 *   quantityKg: 10
 * }
 */
export type LegacyCollectionMaterialInput = {
  type: string;
  quantityKg: number;
};

/**
 * Formato normalizado aceito pelo novo fluxo de coletas.
 *
 * O wasteTypeId vincula o material coletado ao catálogo de resíduos.
 * Ele permanece opcional durante a etapa de compatibilidade.
 */
export type CollectionMaterialInput = {
  wasteTypeId?: string;

  type?: string;
  name?: string;

  category?: string;
  subcategory?: string;

  quantity?: number;
  quantityKg?: number;

  unit?: WasteUnit;
};

/**
 * Material após a normalização do payload.
 *
 * Este formato é utilizado internamente pelo service.
 */
export type NormalizedCollectionMaterial = {
  wasteTypeId: string | null;

  name: string;

  category: string | null;
  subcategory: string | null;

  quantity: number;
  quantityKg: number;

  unit: WasteUnit;
};

/**
 * Informações mínimas obtidas do catálogo de resíduos.
 *
 * Evita carregar campos desnecessários durante a validação dos materiais.
 */
export type WasteStockItemReference = {
  id: string;
  cooperativeId: string;

  name: string;
  category: string;
  subcategory: string | null;

  unit: WasteUnit;
};

/**
 * Contexto operacional da coleta.
 *
 * Centraliza as entidades identificadas a partir do usuário autenticado.
 */
export type CollectionAccessContext = {
  userId: string;
  role: string;

  cooperativeId: string;

  collectorId?: string | null;
  driverId?: string | null;
  generatorId?: string | null;
};

/**
 * Quantidades utilizadas para criar uma CollectionWasteEntry.
 */
export type CollectionWasteEntryBalance = {
  collectedQuantity: number;
  destinedQuantity: number;
  remainingQuantity: number;
};

/**
 * Dados necessários para criar um material normalizado no banco.
 */
export type CollectionMaterialCreateData = {
  collectionId: string;

  wasteTypeId: string | null;

  nameSnapshot: string;
  categorySnapshot: string | null;
  subcategorySnapshot: string | null;

  unit: WasteUnit;
  quantity: number;
};

/**
 * Dados necessários para criar a entrada operacional do resíduo.
 */
export type CollectionWasteEntryCreateData = {
  cooperativeId: string;
  collectionId: string;
  collectionMaterialId: string;

  wasteTypeId: string | null;

  generatorId: string | null;
  routeId: string | null;
  vehicleId: string | null;
  driverId: string | null;
  collectorId: string | null;

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

  createdByUserId: string | null;
  createdByNameSnapshot: string | null;
};

/**
 * Resultado da normalização do peso da coleta.
 *
 * totalWeightKg contém somente materiais que podem ser convertidos
 * com segurança para quilogramas.
 */
export type CollectionWeightSummary = {
  totalWeightKg: number;

  totalsByUnit: Partial<Record<WasteUnit, number>>;
};

/**
 * Resultado interno da conclusão da coleta.
 */
export type CollectionCompletionResult = {
  collectionId: string;
  status: CollectionStatus;

  materialsCreated: number;
  entriesCreated: number;

  totalWeightKg: number;
};

/**
 * Situação dos registros normalizados de uma coleta.
 *
 * Utilizado para evitar duplicação durante chamadas repetidas.
 */
export type CollectionNormalizationState = {
  hasCollectionMaterials: boolean;
  hasWasteEntries: boolean;

  collectionMaterialsCount: number;
  wasteEntriesCount: number;
};

/**
 * Configuração utilizada para reconstruir os materiais normalizados.
 *
 * A reconstrução só poderá ocorrer quando nenhuma destinação tiver sido
 * registrada para as entradas da coleta.
 */
export type CollectionMaterialReplacementOptions = {
  allowReplacement: boolean;
  hasDestinations: boolean;
};

/**
 * Forma padronizada de erro de domínio.
 *
 * O controller poderá usar o statusCode sem depender de comparação
 * de mensagens de erro.
 */
export class CollectionDomainError extends Error {
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

    this.name = "CollectionDomainError";
    this.statusCode = options?.statusCode ?? 400;
    this.code = options?.code ?? "COLLECTION_ERROR";
    this.details = options?.details;
  }
}

/**
 * Verifica se um valor é um CollectionDomainError.
 */
export function isCollectionDomainError(
  error: unknown
): error is CollectionDomainError {
  return error instanceof CollectionDomainError;
}