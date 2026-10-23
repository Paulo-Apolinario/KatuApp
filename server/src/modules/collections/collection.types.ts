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
 * Material proposto quando o resíduo ainda não existe no catálogo.
 */
export type ProposedCollectionMaterialInput = {
  name: string;
  category?: string;
  subcategory?: string;
  unit: WasteUnit;
};

/**
 * Formato aceito pelo fluxo de coletas.
 *
 * Mantém compatibilidade com:
 * - wasteTypeId;
 * - proposedMaterial;
 * - type/name;
 * - quantity/quantityKg.
 */
export type CollectionMaterialInput = {
  wasteTypeId?: string;

  proposedMaterial?: ProposedCollectionMaterialInput;

  type?: string;
  name?: string;

  category?: string;
  subcategory?: string;

  quantity?: number;
  quantityKg?: number;

  unit?: WasteUnit;

  notes?: string;
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

  notes: string | null;
};

/**
 * Informações mínimas obtidas do catálogo de resíduos.
 */
export type WasteStockItemReference = {
  id: string;
  cooperativeId: string;

  name: string;
  category: string | null;
  subcategory: string | null;

  unit: WasteUnit;
  defaultUnit: WasteUnit;
};

/**
 * Contextos de acesso discriminados.
 *
 * O campo `role` funciona como discriminador. Assim, quando o código
 * confirma que o perfil é COLLECTOR, o TypeScript sabe que collectorId
 * é obrigatoriamente string.
 */
export type CooperativeCollectionAccessContext = {
  userId: string;
  role: "COOPERATIVE";
  cooperativeId: string;
};

export type CollectorCollectionAccessContext = {
  userId: string;
  role: "COLLECTOR";
  cooperativeId: string;
  collectorId: string;
};

export type DriverCollectionAccessContext = {
  userId: string;
  role: "DRIVER";
  cooperativeId: string;
  driverId: string;
};

export type GeneratorCollectionAccessContext = {
  userId: string;
  role:
    | "GENERATOR_SMALL"
    | "GENERATOR_LARGE";
  cooperativeId: string;
  generatorId: string;
};

export type CollectionAccessContext =
  | CooperativeCollectionAccessContext
  | CollectorCollectionAccessContext
  | DriverCollectionAccessContext
  | GeneratorCollectionAccessContext;

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
 */
export type CollectionNormalizationState = {
  hasCollectionMaterials: boolean;
  hasWasteEntries: boolean;

  collectionMaterialsCount: number;
  wasteEntriesCount: number;
};

/**
 * Configuração utilizada para reconstruir materiais normalizados.
 */
export type CollectionMaterialReplacementOptions = {
  allowReplacement: boolean;
  hasDestinations: boolean;
};

/**
 * Forma padronizada de erro de domínio.
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

    Object.setPrototypeOf(
      this,
      CollectionDomainError.prototype
    );
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
