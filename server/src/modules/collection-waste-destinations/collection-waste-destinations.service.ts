import {
  CollectionEntryStatus,
  Prisma,
  UserRole,
  WasteDestinationStatus,
  WasteDestinationType,
  WasteLotStatus,
  WasteUnit,
} from "@prisma/client";

import { prisma } from "../../lib/prisma";

import type {
  CancelWasteDestinationBody,
  CreateWasteDestinationBody,
  EntryWasteDestinationListQuery,
  UpdateWasteDestinationBody,
  WasteDestinationListQuery,
} from "./collection-waste-destinations.schemas";

import {
  WASTE_DESTINATION_FINAL_STATUS_MAP,
  WasteDestinationDomainError,
  type WasteDestinationAccessContext,
  type WasteDestinationPagination,
  type WasteDestinationTotalsByUnit,
  type WasteEntryRecalculationResult,
} from "./collection-waste-destinations.types";

/*
 * ============================================================
 * TIPOS INTERNOS
 * ============================================================
 */

type DestinationQuantityRecord = {
  unit: WasteUnit;
  quantity: Prisma.Decimal | number;
};

type DestinationCreateTransactionResult = {
  destination: unknown;
  entry: unknown;
  stockLot: unknown | null;
};

type CompatibleStockItem = {
  id: string;
  cooperativeId: string;
  defaultUnit: WasteUnit;
  unit: WasteUnit;
  isActive: boolean;
};

/*
 * ============================================================
 * CONSTANTES
 * ============================================================
 */

const QUANTITY_EPSILON = 0.000001;
const CANCELLED_DESTINATION_STATUS = WasteDestinationStatus.CANCELLED;
const ACTIVE_DESTINATION_STATUS = WasteDestinationStatus.ACTIVE;

/*
 * ============================================================
 * SELECTS E INCLUDES
 * ============================================================
 */

const userSelect = {
  id: true,
  displayName: true,
  email: true,
  role: true,
  phone: true,
  isActive: true,
  accountStatus: true,
} satisfies Prisma.UserSelect;

const stockItemSelect = {
  id: true,
  cooperativeId: true,
  name: true,
  category: true,
  subcategory: true,
  description: true,
  defaultUnit: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.WasteStockItemSelect;

const stockLotSelect = {
  id: true,
  cooperativeId: true,
  stockItemId: true,
  code: true,
  quantity: true,
  availableQuantity: true,
  unit: true,
  status: true,
  receivedAt: true,
  notes: true,
  originCollectionId: true,
  originCollectionMaterialId: true,
  originCollectionWasteEntryId: true,
  createdAt: true,
  updatedAt: true,

  stockItem: {
    select: stockItemSelect,
  },
} satisfies Prisma.WasteStockLotSelect;

const destinationInclude = {
  cooperative: {
    select: {
      id: true,
      name: true,
      registrationNumber: true,
      email: true,
      phone: true,
      city: true,
      state: true,
    },
  },

  collectionWasteEntry: {
    include: {
      wasteType: true,

      collectionMaterial: {
        include: {
          wasteType: true,
        },
      },

      collection: {
        select: {
          id: true,
          status: true,
          totalWeightKg: true,
          collectedAt: true,
          notes: true,
        },
      },

      generator: {
        select: {
          id: true,
          name: true,
          companyName: true,
          type: true,
          email: true,
          phone: true,
          city: true,
          state: true,
        },
      },

      collector: {
        include: {
          user: {
            select: userSelect,
          },
        },
      },

      driver: {
        include: {
          user: {
            select: userSelect,
          },
        },
      },

      vehicle: {
        select: {
          id: true,
          plate: true,
          model: true,
          brand: true,
          status: true,
        },
      },

      route: {
        select: {
          id: true,
          name: true,
          status: true,
          scheduledDate: true,
        },
      },
    },
  },

  stockItem: {
    select: stockItemSelect,
  },

  stockLot: {
    select: stockLotSelect,
  },

  createdBy: {
    select: userSelect,
  },

  cancelledBy: {
    select: userSelect,
  },
} satisfies Prisma.CollectionWasteDestinationInclude;

/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

function normalizeRole(role: unknown) {
  return String(role || "")
    .trim()
    .toUpperCase();
}

function normalizeText(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || undefined;
}

function normalizeNumber(value: unknown) {
  if (value instanceof Prisma.Decimal) {
    return value.toNumber();
  }
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return 0;
  }
  return numberValue;
}

function quantitiesAreEqual(first: number, second: number) {
  return Math.abs(first - second) <= QUANTITY_EPSILON;
}

function calculatePagination(
  page: number,
  limit: number,
  total: number
): WasteDestinationPagination {
  const safePage = Math.max(1, page || 1);
  const safeLimit = Math.max(1, limit || 10);
  const totalPages = total > 0 ? Math.ceil(total / safeLimit) : 0;

  return {
    page: safePage,
    limit: safeLimit,
    total,
    totalPages,
    hasNextPage: totalPages > 0 && safePage < totalPages,
    hasPreviousPage: totalPages > 0 && safePage > 1,
  };
}

function calculateTotalsByUnit(
  destinations: DestinationQuantityRecord[]
): WasteDestinationTotalsByUnit {
  const totals: WasteDestinationTotalsByUnit = {};

  for (const destination of destinations) {
    const unit = destination.unit;

    if (!totals[unit]) {
      totals[unit] = {
        totalQuantity: 0,
        destinationsCount: 0,
      };
    }

    const unitTotals = totals[unit];
    if (!unitTotals) continue;

    unitTotals.totalQuantity += normalizeNumber(destination.quantity);
    unitTotals.destinationsCount += 1;
  }

  return totals;
}

function generateLotCode() {
  const now = new Date();
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");

  const timePart = [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");

  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `LOT-${datePart}-${timePart}-${randomPart}`;
}

/*
 * ============================================================
 * SERVICE
 * ============================================================
 */

export class CollectionWasteDestinationsService {
  /*
   * ============================================================
   * CONTEXTO DE ACESSO
   * ============================================================
   */

  private async getAccessContext(
    authUserId: string,
    authUserRole: string
  ): Promise<WasteDestinationAccessContext> {
    const role = normalizeRole(authUserRole);

    if (!authUserId) {
      throw new WasteDestinationDomainError(
        "Usuário autenticado não identificado.",
        { statusCode: 401, code: "AUTH_USER_NOT_IDENTIFIED" }
      );
    }

    if (role === UserRole.ADMIN) {
      return { userId: authUserId, role, cooperativeId: "" };
    }

    if (role === UserRole.COOPERATIVE) {
      const cooperative = await prisma.cooperative.findUnique({
        where: { userId: authUserId },
        select: { id: true },
      });

      if (!cooperative) {
        throw new WasteDestinationDomainError(
          "Cooperativa do usuário autenticado não encontrada.",
          { statusCode: 404, code: "COOPERATIVE_NOT_FOUND" }
        );
      }

      return { userId: authUserId, role, cooperativeId: cooperative.id };
    }

    if (role === UserRole.COLLECTOR) {
      const collector = await prisma.collector.findUnique({
        where: { userId: authUserId },
        select: { id: true, cooperativeId: true },
      });

      if (!collector) {
        throw new WasteDestinationDomainError(
          "Catador do usuário autenticado não encontrado.",
          { statusCode: 404, code: "COLLECTOR_NOT_FOUND" }
        );
      }

      if (!collector.cooperativeId) {
        throw new WasteDestinationDomainError(
          "O catador não está vinculado a uma cooperativa.",
          { statusCode: 403, code: "COLLECTOR_WITHOUT_COOPERATIVE" }
        );
      }

      return {
        userId: authUserId,
        role,
        cooperativeId: collector.cooperativeId,
        collectorId: collector.id,
      };
    }

    if (role === UserRole.DRIVER) {
      const driver = await prisma.driver.findUnique({
        where: { userId: authUserId },
        select: { id: true, cooperativeId: true },
      });

      if (!driver) {
        throw new WasteDestinationDomainError(
          "Motorista do usuário autenticado não encontrado.",
          { statusCode: 404, code: "DRIVER_NOT_FOUND" }
        );
      }

      if (!driver.cooperativeId) {
        throw new WasteDestinationDomainError(
          "O motorista não está vinculado a uma cooperativa.",
          { statusCode: 403, code: "DRIVER_WITHOUT_COOPERATIVE" }
        );
      }

      return {
        userId: authUserId,
        role,
        cooperativeId: driver.cooperativeId,
        driverId: driver.id,
      };
    }

    if (role === UserRole.GENERATOR_SMALL || role === UserRole.GENERATOR_LARGE) {
      const generator = await prisma.generator.findUnique({
        where: { userId: authUserId },
        select: { id: true, cooperativeId: true },
      });

      if (!generator) {
        throw new WasteDestinationDomainError(
          "Gerador do usuário autenticado não encontrado.",
          { statusCode: 404, code: "GENERATOR_NOT_FOUND" }
        );
      }

      if (!generator.cooperativeId) {
        throw new WasteDestinationDomainError(
          "O gerador não está vinculado a uma cooperativa.",
          { statusCode: 403, code: "GENERATOR_WITHOUT_COOPERATIVE" }
        );
      }

      return {
        userId: authUserId,
        role,
        cooperativeId: generator.cooperativeId,
        generatorId: generator.id,
      };
    }

    throw new WasteDestinationDomainError(
      "Usuário sem permissão para acessar as destinações de resíduos.",
      { statusCode: 403, code: "WASTE_DESTINATION_ACCESS_DENIED" }
    );
  }

  /*
   * ============================================================
   * PERMISSÃO DE ESCRITA
   * ============================================================
   */

  private assertCanManageDestinations(context: WasteDestinationAccessContext) {
    const role = normalizeRole(context.role);
    const canManage = role === UserRole.ADMIN || role === UserRole.COOPERATIVE;

    if (!canManage) {
      throw new WasteDestinationDomainError(
        "Somente administradores e cooperativas podem gerenciar destinações.",
        { statusCode: 403, code: "WASTE_DESTINATION_MANAGEMENT_DENIED" }
      );
    }
  }

  /*
   * ============================================================
   * RESTRIÇÃO DE CONSULTA
   * ============================================================
   */

  private buildAccessWhere(
    context: WasteDestinationAccessContext
  ): Prisma.CollectionWasteDestinationWhereInput {
    const role = normalizeRole(context.role);

    if (role === UserRole.ADMIN) {
      return {};
    }

    const baseWhere: Prisma.CollectionWasteDestinationWhereInput = {
      cooperativeId: context.cooperativeId,
    };

    if (role === UserRole.COOPERATIVE) {
      return baseWhere;
    }

    if (role === UserRole.COLLECTOR) {
      return {
        ...baseWhere,
        collectionWasteEntry: {
          is: { collectorId: context.collectorId },
        },
      };
    }

    if (role === UserRole.DRIVER) {
      return {
        ...baseWhere,
        collectionWasteEntry: {
          is: { driverId: context.driverId },
        },
      };
    }

    if (role === UserRole.GENERATOR_SMALL || role === UserRole.GENERATOR_LARGE) {
      return {
        ...baseWhere,
        collectionWasteEntry: {
          is: { generatorId: context.generatorId },
        },
      };
    }

    throw new WasteDestinationDomainError(
      "Usuário sem permissão para consultar destinações.",
      { statusCode: 403, code: "WASTE_DESTINATION_ACCESS_DENIED" }
    );
  }

  /*
   * ============================================================
   * FILTROS
   * ============================================================
   */

  private buildFiltersWhere(
    filters: WasteDestinationListQuery | EntryWasteDestinationListQuery
  ): Prisma.CollectionWasteDestinationWhereInput {
    const search = "search" in filters ? normalizeText(filters.search) : undefined;
    const dateFrom = filters.dateFrom ? new Date(filters.dateFrom) : undefined;
    const dateTo = filters.dateTo ? new Date(filters.dateTo) : undefined;

    return {
      ...("collectionWasteEntryId" in filters && filters.collectionWasteEntryId
        ? { collectionWasteEntryId: filters.collectionWasteEntryId }
        : {}),

      ...("collectionId" in filters && filters.collectionId
        ? {
            collectionWasteEntry: {
              is: { collectionId: filters.collectionId },
            },
          }
        : {}),

      ...("collectionMaterialId" in filters && filters.collectionMaterialId
        ? {
            collectionWasteEntry: {
              is: { collectionMaterialId: filters.collectionMaterialId },
            },
          }
        : {}),

      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.unit ? { unit: filters.unit } : {}),

      ...("stockItemId" in filters && filters.stockItemId
        ? { stockItemId: filters.stockItemId }
        : {}),

      ...("stockLotId" in filters && filters.stockLotId
        ? { stockLotId: filters.stockLotId }
        : {}),

      ...("generatorId" in filters && filters.generatorId
        ? {
            collectionWasteEntry: {
              is: { generatorId: filters.generatorId },
            },
          }
        : {}),

      ...("collectorId" in filters && filters.collectorId
        ? {
            collectionWasteEntry: {
              is: { collectorId: filters.collectorId },
            },
          }
        : {}),

      ...("driverId" in filters && filters.driverId
        ? {
            collectionWasteEntry: {
              is: { driverId: filters.driverId },
            },
          }
        : {}),

      ...("vehicleId" in filters && filters.vehicleId
        ? {
            collectionWasteEntry: {
              is: { vehicleId: filters.vehicleId },
            },
          }
        : {}),

      ...("routeId" in filters && filters.routeId
        ? {
            collectionWasteEntry: {
              is: { routeId: filters.routeId },
            },
          }
        : {}),

      ...(dateFrom || dateTo
        ? {
            destinationDate: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : {}),

      ...(search
        ? {
            OR: [
              { destinationName: { contains: search, mode: "insensitive" } },
              { destinationDocument: { contains: search, mode: "insensitive" } },
              { destinationAddress: { contains: search, mode: "insensitive" } },
              { destinationContact: { contains: search, mode: "insensitive" } },
              { transportDocument: { contains: search, mode: "insensitive" } },
              { environmentalDocument: { contains: search, mode: "insensitive" } },
              { notes: { contains: search, mode: "insensitive" } },
              {
                stockItem: {
                  is: { name: { contains: search, mode: "insensitive" } },
                },
              },
              {
                stockLot: {
                  is: { code: { contains: search, mode: "insensitive" } },
                },
              },
            ],
          }
        : {}),
    };
  }

  /*
   * ============================================================
   * RECÁLCULO DA ENTRADA
   * ============================================================
   */

  private calculateEntryState(
    collectedQuantity: number,
    destinedQuantity: number,
    lastDestinationType?: WasteDestinationType
  ): WasteEntryRecalculationResult {
    const normalizedCollected = Math.max(0, normalizeNumber(collectedQuantity));
    const normalizedDestined = Math.max(
      0,
      Math.min(normalizedCollected, normalizeNumber(destinedQuantity))
    );

    const remainingQuantity = Math.max(0, normalizedCollected - normalizedDestined);

    let status: CollectionEntryStatus = CollectionEntryStatus.PENDING_DESTINATION;

    if (normalizedDestined <= QUANTITY_EPSILON) {
      status = CollectionEntryStatus.PENDING_DESTINATION;
    } else if (remainingQuantity > QUANTITY_EPSILON) {
      status = CollectionEntryStatus.PARTIALLY_DESTINED;
    } else if (lastDestinationType) {
      status = WASTE_DESTINATION_FINAL_STATUS_MAP[lastDestinationType];
    } else {
      status = CollectionEntryStatus.FULLY_DESTINED;
    }

    return {
      collectedQuantity: normalizedCollected,
      destinedQuantity: normalizedDestined,
      remainingQuantity,
      status,
    };
  }

  /*
   * ============================================================
   * CRIAÇÃO
   * ============================================================
   */

  async create(
    authUserId: string,
    authUserRole: string,
    data: CreateWasteDestinationBody
  ) {
    const context = await this.getAccessContext(authUserId, authUserRole);
    this.assertCanManageDestinations(context);

    const transactionResult = await prisma.$transaction(
      async (transaction): Promise<DestinationCreateTransactionResult> => {
        const entry = await transaction.collectionWasteEntry.findUnique({
          where: { id: data.collectionWasteEntryId },
          include: {
            collection: { select: { id: true } },
            collectionMaterial: { select: { id: true } },
          },
        });

        if (!entry) {
          throw new WasteDestinationDomainError(
            "Entrada de resíduo coletado não encontrada.",
            { statusCode: 404, code: "COLLECTION_WASTE_ENTRY_NOT_FOUND" }
          );
        }

        if (
          normalizeRole(context.role) !== UserRole.ADMIN &&
          entry.cooperativeId !== context.cooperativeId
        ) {
          throw new WasteDestinationDomainError(
            "A entrada de resíduo não pertence à cooperativa autenticada.",
            { statusCode: 403, code: "COLLECTION_WASTE_ENTRY_ACCESS_DENIED" }
          );
        }

        if (entry.status === CollectionEntryStatus.CANCELLED) {
          throw new WasteDestinationDomainError(
            "Não é possível destinar uma entrada cancelada.",
            { statusCode: 409, code: "COLLECTION_WASTE_ENTRY_CANCELLED" }
          );
        }

        const entryUnit = entry.unit;

        if (data.unit !== entryUnit) {
          throw new WasteDestinationDomainError(
            "A unidade da destinação deve ser igual à unidade da entrada.",
            {
              statusCode: 400,
              code: "DESTINATION_UNIT_MISMATCH",
              details: { entryUnit, destinationUnit: data.unit },
            }
          );
        }

        const remainingQuantity = normalizeNumber(entry.remainingQuantity);
        const destinationQuantity = normalizeNumber(data.quantity);

        if (destinationQuantity <= 0) {
          throw new WasteDestinationDomainError(
            "A quantidade da destinação deve ser maior que zero.",
            { statusCode: 400, code: "INVALID_DESTINATION_QUANTITY" }
          );
        }

        if (destinationQuantity > remainingQuantity + QUANTITY_EPSILON) {
          throw new WasteDestinationDomainError(
            "A quantidade informada é superior ao saldo disponível da entrada.",
            {
              statusCode: 409,
              code: "INSUFFICIENT_ENTRY_BALANCE",
              details: {
                requestedQuantity: destinationQuantity,
                remainingQuantity,
                unit: entry.unit,
              },
            }
          );
        }

        if (remainingQuantity <= QUANTITY_EPSILON) {
          throw new WasteDestinationDomainError(
            "A entrada não possui saldo disponível para destinação.",
            { statusCode: 409, code: "ENTRY_WITHOUT_AVAILABLE_BALANCE" }
          );
        }

        let stockItem: CompatibleStockItem | null = null;

        if (data.type === WasteDestinationType.STOCK) {
          if (!data.stockItemId) {
            throw new WasteDestinationDomainError(
              "O item de estoque é obrigatório para destinação ao estoque.",
              { statusCode: 400, code: "STOCK_ITEM_REQUIRED" }
            );
          }

          stockItem = await transaction.wasteStockItem.findUnique({
            where: { id: data.stockItemId },
            select: {
              id: true,
              cooperativeId: true,
              defaultUnit: true,
              unit: true,
              isActive: true,
            },
          });

          if (!stockItem) {
            throw new WasteDestinationDomainError(
              "Item do catálogo de resíduos não encontrado.",
              { statusCode: 404, code: "WASTE_STOCK_ITEM_NOT_FOUND" }
            );
          }

          if (stockItem.cooperativeId !== entry.cooperativeId) {
            throw new WasteDestinationDomainError(
              "O item de estoque não pertence à mesma cooperativa da entrada.",
              { statusCode: 403, code: "STOCK_ITEM_COOPERATIVE_MISMATCH" }
            );
          }

          if (!stockItem.isActive) {
            throw new WasteDestinationDomainError(
              "O item de estoque informado está inativo.",
              { statusCode: 409, code: "WASTE_STOCK_ITEM_INACTIVE" }
            );
          }

          const stockItemSupportsUnit =
            stockItem.defaultUnit === data.unit || stockItem.unit === data.unit;

          if (!stockItemSupportsUnit) {
            throw new WasteDestinationDomainError(
              "A unidade do item de estoque é diferente da unidade da destinação.",
              {
                statusCode: 400,
                code: "STOCK_ITEM_UNIT_MISMATCH",
                details: {
                  stockItemDefaultUnit: stockItem.defaultUnit,
                  stockItemUnit: stockItem.unit,
                  destinationUnit: data.unit,
                },
              }
            );
          }
        }

        const destinationDate = data.destinationDate ?? new Date();

        let destination = await transaction.collectionWasteDestination.create({
          data: {
            cooperativeId: entry.cooperativeId,
            collectionWasteEntryId: entry.id,
            type: data.type,
            quantity: new Prisma.Decimal(destinationQuantity),
            unit: data.unit,
            stockItemId: stockItem?.id,
            destinationName: data.destinationName,
            destinationDocument: data.destinationDocument,
            destinationAddress: data.destinationAddress,
            destinationContact: data.destinationContact,
            transportDocument: data.transportDocument,
            environmentalDocument: data.environmentalDocument,
            notes: data.notes,
            destinationDate,
            metadata: data.metadata ? (data.metadata as Prisma.InputJsonValue) : undefined,
            status: ACTIVE_DESTINATION_STATUS,
            createdByUserId: context.userId,
          },
        });

        let stockLot: unknown | null = null;

        if (data.type === WasteDestinationType.STOCK && stockItem) {
          const lotCode = normalizeText(data.stockLotCode) ?? generateLotCode();

          const existingLot = await transaction.wasteStockLot.findFirst({
            where: {
              cooperativeId: entry.cooperativeId,
              code: lotCode,
            },
            select: { id: true },
          });

          if (existingLot) {
            throw new WasteDestinationDomainError(
              "Já existe um lote com o código informado.",
              {
                statusCode: 409,
                code: "STOCK_LOT_CODE_ALREADY_EXISTS",
                details: { lotCode },
              }
            );
          }

          stockLot = await transaction.wasteStockLot.create({
            data: {
              cooperativeId: entry.cooperativeId,
              stockItemId: stockItem.id,
              code: lotCode,
              quantity: new Prisma.Decimal(destinationQuantity),
              availableQuantity: new Prisma.Decimal(destinationQuantity),
              unit: data.unit,
              status: WasteLotStatus.AVAILABLE,
              receivedAt: destinationDate,
              originCollectionId: entry.collectionId,
              originCollectionMaterialId: entry.collectionMaterialId,
              originCollectionWasteEntryId: entry.id,
              notes: data.notes,
              createdByUserId: context.userId,
            },
          });

          // Atualiza a destinação para vincular o lote recém criado
          destination = await transaction.collectionWasteDestination.update({
            where: { id: destination.id },
            data: {
              stockLotId: (stockLot as { id: string }).id,
            },
          });
        }

        const newDestinedQuantity = normalizeNumber(entry.destinedQuantity) + destinationQuantity;
        const recalculatedEntry = this.calculateEntryState(
          normalizeNumber(entry.collectedQuantity),
          newDestinedQuantity,
          data.type
        );

        const updatedEntry = await transaction.collectionWasteEntry.update({
          where: { id: entry.id },
          data: {
            destinedQuantity: new Prisma.Decimal(recalculatedEntry.destinedQuantity),
            remainingQuantity: new Prisma.Decimal(recalculatedEntry.remainingQuantity),
            status: recalculatedEntry.status,
            updatedAt: new Date(),
          },
        });

        const completeDestination = await transaction.collectionWasteDestination.findUnique({
          where: { id: destination.id },
          include: destinationInclude,
        });

        return {
          destination: completeDestination,
          entry: updatedEntry,
          stockLot,
        };
      }
    );

    return {
      success: true,
      message:
        data.type === WasteDestinationType.STOCK
          ? "Destinação registrada e lote criado no estoque com sucesso."
          : "Destinação registrada com sucesso.",
      destination: transactionResult.destination,
      entry: transactionResult.entry,
      stockLot: transactionResult.stockLot,
    };
  }

  /*
   * ============================================================
   * LISTAGEM GERAL
   * ============================================================
   */

  async list(authUserId: string, authUserRole: string, filters: WasteDestinationListQuery) {
    const context = await this.getAccessContext(authUserId, authUserRole);

    const where: Prisma.CollectionWasteDestinationWhereInput = {
      AND: [this.buildAccessWhere(context), this.buildFiltersWhere(filters)],
    };

    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, filters.limit || 10);
    const skip = (page - 1) * limit;

    const [destinations, total, quantityRecords] = await prisma.$transaction([
      prisma.collectionWasteDestination.findMany({
        where,
        include: destinationInclude,
        orderBy: [{ destinationDate: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
      prisma.collectionWasteDestination.count({ where }),
      prisma.collectionWasteDestination.findMany({
        where,
        select: { unit: true, quantity: true },
      }),
    ]);

    return {
      success: true,
      destinations,
      pagination: calculatePagination(page, limit, total),
      totalsByUnit: calculateTotalsByUnit(quantityRecords),
    };
  }

  /*
   * ============================================================
   * LISTAGEM POR ENTRADA
   * ============================================================
   */

  async listByEntry(
    authUserId: string,
    authUserRole: string,
    entryId: string,
    filters: EntryWasteDestinationListQuery
  ) {
    const context = await this.getAccessContext(authUserId, authUserRole);

    const entry = await prisma.collectionWasteEntry.findFirst({
      where: {
        AND: [
          { id: entryId },
          normalizeRole(context.role) === UserRole.ADMIN
            ? {}
            : { cooperativeId: context.cooperativeId },
        ],
      },
      select: { id: true },
    });

    if (!entry) {
      throw new WasteDestinationDomainError(
        "Entrada de resíduo coletado não encontrada.",
        { statusCode: 404, code: "COLLECTION_WASTE_ENTRY_NOT_FOUND" }
      );
    }

    const where: Prisma.CollectionWasteDestinationWhereInput = {
      AND: [
        this.buildAccessWhere(context),
        { collectionWasteEntryId: entryId },
        this.buildFiltersWhere(filters),
      ],
    };

    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, filters.limit || 10);
    const skip = (page - 1) * limit;

    const [destinations, total, quantityRecords] = await prisma.$transaction([
      prisma.collectionWasteDestination.findMany({
        where,
        include: destinationInclude,
        orderBy: [{ destinationDate: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
      prisma.collectionWasteDestination.count({ where }),
      prisma.collectionWasteDestination.findMany({
        where,
        select: { unit: true, quantity: true },
      }),
    ]);

    return {
      success: true,
      entryId,
      destinations,
      pagination: calculatePagination(page, limit, total),
      totalsByUnit: calculateTotalsByUnit(quantityRecords),
    };
  }

  /*
   * ============================================================
   * CONSULTA POR ID
   * ============================================================
   */

  async findById(authUserId: string, authUserRole: string, destinationId: string) {
    const context = await this.getAccessContext(authUserId, authUserRole);

    const destination = await prisma.collectionWasteDestination.findFirst({
      where: {
        AND: [{ id: destinationId }, this.buildAccessWhere(context)],
      },
      include: destinationInclude,
    });

    if (!destination) {
      throw new WasteDestinationDomainError("Destinação de resíduo não encontrada.", {
        statusCode: 404,
        code: "WASTE_DESTINATION_NOT_FOUND",
      });
    }

    return {
      success: true,
      destination,
    };
  }

  /*
   * ============================================================
   * ATUALIZAÇÃO DE DADOS COMPLEMENTARES
   * ============================================================
   */

  async update(
    authUserId: string,
    authUserRole: string,
    destinationId: string,
    data: UpdateWasteDestinationBody
  ) {
    const context = await this.getAccessContext(authUserId, authUserRole);
    this.assertCanManageDestinations(context);

    const existing = await prisma.collectionWasteDestination.findFirst({
      where: {
        AND: [{ id: destinationId }, this.buildAccessWhere(context)],
      },
      select: { id: true, status: true },
    });

    if (!existing) {
      throw new WasteDestinationDomainError("Destinação de resíduo não encontrada.", {
        statusCode: 404,
        code: "WASTE_DESTINATION_NOT_FOUND",
      });
    }

    if (existing.status === CANCELLED_DESTINATION_STATUS) {
      throw new WasteDestinationDomainError(
        "Não é possível editar uma destinação cancelada.",
        { statusCode: 409, code: "WASTE_DESTINATION_ALREADY_CANCELLED" }
      );
    }

    const destination = await prisma.collectionWasteDestination.update({
      where: { id: destinationId },
      data: {
        destinationName: data.destinationName,
        destinationDocument: data.destinationDocument,
        destinationAddress: data.destinationAddress,
        destinationContact: data.destinationContact,
        transportDocument: data.transportDocument,
        environmentalDocument: data.environmentalDocument,
        notes: data.notes,
        destinationDate: data.destinationDate === null ? undefined : data.destinationDate,
        metadata:
          data.metadata === null
            ? Prisma.JsonNull
            : data.metadata
            ? (data.metadata as Prisma.InputJsonValue)
            : undefined,
        updatedAt: new Date(),
      },
      include: destinationInclude,
    });

    return {
      success: true,
      message: "Destinação atualizada com sucesso.",
      destination,
    };
  }

  /*
   * ============================================================
   * CANCELAMENTO
   * ============================================================
   */

  async cancel(
    authUserId: string,
    authUserRole: string,
    destinationId: string,
    data: CancelWasteDestinationBody
  ) {
    const context = await this.getAccessContext(authUserId, authUserRole);
    this.assertCanManageDestinations(context);

    const result = await prisma.$transaction(async (transaction) => {
      const destination = await transaction.collectionWasteDestination.findFirst({
        where: {
          AND: [{ id: destinationId }, this.buildAccessWhere(context)],
        },
        include: {
          collectionWasteEntry: true,
          stockLot: true,
        },
      });

      if (!destination) {
        throw new WasteDestinationDomainError("Destinação de resíduo não encontrada.", {
          statusCode: 404,
          code: "WASTE_DESTINATION_NOT_FOUND",
        });
      }

      if (destination.status === CANCELLED_DESTINATION_STATUS) {
        throw new WasteDestinationDomainError("A destinação já está cancelada.", {
          statusCode: 409,
          code: "WASTE_DESTINATION_ALREADY_CANCELLED",
        });
      }

      if (destination.type === WasteDestinationType.STOCK && destination.stockLot) {
        const originalQuantity = normalizeNumber(destination.stockLot.quantity);
        const availableQuantity = normalizeNumber(destination.stockLot.availableQuantity);

        if (!quantitiesAreEqual(originalQuantity, availableQuantity)) {
          throw new WasteDestinationDomainError(
            "O lote já possui movimentações e não pode ser cancelado automaticamente.",
            {
              statusCode: 409,
              code: "STOCK_LOT_HAS_MOVEMENTS",
              details: {
                lotId: destination.stockLot.id,
                originalQuantity,
                availableQuantity,
              },
            }
          );
        }

        await transaction.wasteStockLot.update({
          where: { id: destination.stockLot.id },
          data: {
            status: WasteLotStatus.CANCELLED,
            availableQuantity: new Prisma.Decimal(0),
            notes: [
              destination.stockLot.notes,
              `Lote cancelado por cancelamento da destinação ${destination.id}.`,
              `Motivo: ${data.reason}`,
            ]
              .filter(Boolean)
              .join("\n"),
            updatedAt: new Date(),
          },
        });
      }

      const activeDestinations = await transaction.collectionWasteDestination.findMany({
        where: {
          collectionWasteEntryId: destination.collectionWasteEntryId,
          id: { not: destination.id },
          status: { not: CANCELLED_DESTINATION_STATUS },
        },
        select: {
          quantity: true,
          type: true,
          destinationDate: true,
          createdAt: true,
        },
        orderBy: [{ destinationDate: "desc" }, { createdAt: "desc" }],
      });

      const remainingDestinedQuantity = activeDestinations.reduce(
        (total, current) => total + normalizeNumber(current.quantity),
        0
      );

      const lastActiveDestination = activeDestinations[0];

      const recalculatedEntry = this.calculateEntryState(
        normalizeNumber(destination.collectionWasteEntry.collectedQuantity),
        remainingDestinedQuantity,
        lastActiveDestination?.type
      );

      const cancelledAt = data.cancelledAt ?? new Date();

      const cancelledDestination = await transaction.collectionWasteDestination.update({
        where: { id: destination.id },
        data: {
          status: CANCELLED_DESTINATION_STATUS,
          cancelledAt,
          cancelledReason: data.reason,
          cancelledByUserId: context.userId,
          updatedAt: new Date(),
        },
        include: destinationInclude,
      });

      const updatedEntry = await transaction.collectionWasteEntry.update({
        where: { id: destination.collectionWasteEntryId },
        data: {
          destinedQuantity: new Prisma.Decimal(recalculatedEntry.destinedQuantity),
          remainingQuantity: new Prisma.Decimal(recalculatedEntry.remainingQuantity),
          status: recalculatedEntry.status,
          updatedAt: new Date(),
        },
      });

      return {
        destination: cancelledDestination,
        entry: updatedEntry,
      };
    });

    return {
      success: true,
      message: "Destinação cancelada e saldo da entrada recalculado com sucesso.",
      destination: result.destination,
      entry: result.entry,
    };
  }
}