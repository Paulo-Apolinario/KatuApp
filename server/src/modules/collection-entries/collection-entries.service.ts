import {
  CollectionEntryStatus,
  Prisma,
  UserRole,
  WasteUnit,
} from "@prisma/client";

import { prisma } from "../../lib/prisma";

import type {
  CollectionEntryListQuery,
  CollectionEntrySummaryQuery,
  PendingCollectionEntryQuery,
} from "./collection-entries.schemas";

import {
  CollectionEntryDomainError,
  type CollectionEntryAccessContext,
  type CollectionEntryPagination,
  type CollectionEntryTotalsByUnit,
} from "./collection-entries.types";

/*
 * ============================================================
 * TIPOS INTERNOS
 * ============================================================
 */

type CollectionEntryFilters =
  | CollectionEntryListQuery
  | PendingCollectionEntryQuery
  | CollectionEntrySummaryQuery;

type EntryQuantityRecord = {
  unit: WasteUnit;

  collectedQuantity:
    | Prisma.Decimal
    | number;

  destinedQuantity:
    | Prisma.Decimal
    | number;

  remainingQuantity:
    | Prisma.Decimal
    | number;
};

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

const cooperativeSelect = {
  id: true,
  name: true,
  registrationNumber: true,
  email: true,
  phone: true,
  city: true,
  state: true,
  address: true,
  latitude: true,
  longitude: true,
  userId: true,
} satisfies Prisma.CooperativeSelect;

const generatorSelect = {
  id: true,
  cooperativeId: true,
  userId: true,
  type: true,
  name: true,
  companyName: true,
  email: true,
  phone: true,
  city: true,
  state: true,
  address: true,
  latitude: true,
  longitude: true,
  status: true,

  user: {
    select: userSelect,
  },
} satisfies Prisma.GeneratorSelect;

const collectionEntryInclude = {
  cooperative: {
    select: cooperativeSelect,
  },

  wasteType: true,

  collectionMaterial: {
    include: {
      wasteType: true,
    },
  },

  collection: {
    include: {
      schedule: {
        select: {
          id: true,
          status: true,
          preferredDate: true,
          scheduledDate: true,
          requestedByUserId: true,
        },
      },
    },
  },

  generator: {
    select: generatorSelect,
  },

  collector: {
    include: {
      user: {
        select: userSelect,
      },
    },
  },

  driver: true,

  vehicle: {
    select: {
      id: true,
      plate: true,
      model: true,
      brand: true,
      year: true,
      capacityKg: true,
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

  destinations: {
    include: {
      stockLot: {
        include: {
          stockItem: true,
        },
      },
    },

    orderBy: {
      createdAt: "desc" as const,
    },
  },

  createdBy: {
    select: userSelect,
  },
} satisfies Prisma.CollectionWasteEntryInclude;

/*
 * ============================================================
 * FUNÇÕES AUXILIARES
 * ============================================================
 */

function normalizeRole(role: unknown) {
  return String(role || "")
    .trim()
    .toUpperCase();
}

function isGeneratorRole(role: string) {
  return (
    role === UserRole.GENERATOR_SMALL ||
    role === UserRole.GENERATOR_LARGE
  );
}

function normalizeSearch(search?: string) {
  const normalized = String(search || "").trim();

  return normalized || undefined;
}

function normalizeNumber(value: unknown) {
  const quantity = Number(value);

  if (!Number.isFinite(quantity)) {
    return 0;
  }

  return quantity;
}

function calculatePagination(
  page: number,
  limit: number,
  total: number
): CollectionEntryPagination {
  const totalPages =
    total > 0
      ? Math.ceil(total / limit)
      : 0;

  return {
    page,
    limit,

    total,
    totalPages,

    hasNextPage:
      totalPages > 0 &&
      page < totalPages,

    hasPreviousPage:
      page > 1 &&
      totalPages > 0,
  };
}

function calculateTotalsByUnit(
  entries: EntryQuantityRecord[]
): CollectionEntryTotalsByUnit {
  const totals: CollectionEntryTotalsByUnit = {};

  for (const entry of entries) {
    const unit = entry.unit;

    if (!totals[unit]) {
      totals[unit] = {
        collectedQuantity: 0,
        destinedQuantity: 0,
        remainingQuantity: 0,
        entriesCount: 0,
      };
    }

    const unitTotals = totals[unit];

    if (!unitTotals) {
      continue;
    }

    unitTotals.collectedQuantity +=
      normalizeNumber(
        entry.collectedQuantity
      );

    unitTotals.destinedQuantity +=
      normalizeNumber(
        entry.destinedQuantity
      );

    unitTotals.remainingQuantity +=
      normalizeNumber(
        entry.remainingQuantity
      );

    unitTotals.entriesCount += 1;
  }

  return totals;
}

/*
 * ============================================================
 * SERVICE
 * ============================================================
 */

export class CollectionEntriesService {
  /*
   * ============================================================
   * CONTEXTO DE ACESSO
   * ============================================================
   */

  private async getAccessContext(
    authUserId: string,
    authUserRole: string
  ): Promise<CollectionEntryAccessContext> {
    const role = normalizeRole(
      authUserRole
    );

    if (!authUserId) {
      throw new CollectionEntryDomainError(
        "Usuário autenticado não identificado.",
        {
          statusCode: 401,
          code: "AUTH_USER_NOT_IDENTIFIED",
        }
      );
    }

    if (role === UserRole.COOPERATIVE) {
      const cooperative =
        await prisma.cooperative.findUnique({
          where: {
            userId: authUserId,
          },

          select: {
            id: true,
          },
        });

      if (!cooperative) {
        throw new CollectionEntryDomainError(
          "Cooperativa do usuário autenticado não encontrada.",
          {
            statusCode: 404,
            code: "COOPERATIVE_NOT_FOUND",
          }
        );
      }

      return {
        userId: authUserId,
        role,
        cooperativeId: cooperative.id,
      };
    }

    if (role === UserRole.COLLECTOR) {
      const collector =
        await prisma.collector.findUnique({
          where: {
            userId: authUserId,
          },

          select: {
            id: true,
            cooperativeId: true,
          },
        });

      if (!collector) {
        throw new CollectionEntryDomainError(
          "Catador do usuário autenticado não encontrado.",
          {
            statusCode: 404,
            code: "COLLECTOR_NOT_FOUND",
          }
        );
      }

      if (!collector.cooperativeId) {
        throw new CollectionEntryDomainError(
          "O catador não está vinculado a uma cooperativa.",
          {
            statusCode: 403,
            code: "COLLECTOR_WITHOUT_COOPERATIVE",
          }
        );
      }

      return {
        userId: authUserId,
        role,
        cooperativeId:
          collector.cooperativeId,
        collectorId: collector.id,
      };
    }

    if (role === UserRole.DRIVER) {
      const driver =
        await prisma.driver.findUnique({
          where: {
            userId: authUserId,
          },

          select: {
            id: true,
            cooperativeId: true,
          },
        });

      if (!driver) {
        throw new CollectionEntryDomainError(
          "Motorista do usuário autenticado não encontrado.",
          {
            statusCode: 404,
            code: "DRIVER_NOT_FOUND",
          }
        );
      }

      if (!driver.cooperativeId) {
        throw new CollectionEntryDomainError(
          "O motorista não está vinculado a uma cooperativa.",
          {
            statusCode: 403,
            code: "DRIVER_WITHOUT_COOPERATIVE",
          }
        );
      }

      return {
        userId: authUserId,
        role,
        cooperativeId:
          driver.cooperativeId,
        driverId: driver.id,
      };
    }

    if (isGeneratorRole(role)) {
      const generator =
        await prisma.generator.findUnique({
          where: {
            userId: authUserId,
          },

          select: {
            id: true,
            cooperativeId: true,
          },
        });

      if (!generator) {
        throw new CollectionEntryDomainError(
          "Gerador do usuário autenticado não encontrado.",
          {
            statusCode: 404,
            code: "GENERATOR_NOT_FOUND",
          }
        );
      }

      if (!generator.cooperativeId) {
        throw new CollectionEntryDomainError(
          "O gerador não está vinculado a uma cooperativa.",
          {
            statusCode: 403,
            code: "GENERATOR_WITHOUT_COOPERATIVE",
          }
        );
      }

      return {
        userId: authUserId,
        role,
        cooperativeId:
          generator.cooperativeId,
        generatorId: generator.id,
      };
    }

    throw new CollectionEntryDomainError(
      "Usuário sem permissão para consultar resíduos coletados.",
      {
        statusCode: 403,
        code: "COLLECTION_ENTRY_ACCESS_DENIED",
      }
    );
  }

  /*
   * ============================================================
   * RESTRIÇÃO PELO PERFIL
   * ============================================================
   */

  private buildAccessWhere(
    context: CollectionEntryAccessContext
  ): Prisma.CollectionWasteEntryWhereInput {
    const role = normalizeRole(
      context.role
    );

    const baseWhere: Prisma.CollectionWasteEntryWhereInput =
      {
        cooperativeId:
          context.cooperativeId,
      };

    if (role === UserRole.COOPERATIVE) {
      return baseWhere;
    }

    if (role === UserRole.COLLECTOR) {
      return {
        ...baseWhere,
        collectorId: context.collectorId,
      };
    }

    if (role === UserRole.DRIVER) {
      return {
        ...baseWhere,
        driverId: context.driverId,
      };
    }

    if (isGeneratorRole(role)) {
      return {
        ...baseWhere,
        generatorId: context.generatorId,
      };
    }

    throw new CollectionEntryDomainError(
      "Usuário sem permissão para consultar resíduos coletados.",
      {
        statusCode: 403,
        code: "COLLECTION_ENTRY_ACCESS_DENIED",
      }
    );
  }

  /*
   * ============================================================
   * CONSTRUÇÃO DOS FILTROS
   * ============================================================
   */

  private buildFiltersWhere(
    filters: CollectionEntryFilters
  ): Prisma.CollectionWasteEntryWhereInput {
    const search =
      "search" in filters
        ? normalizeSearch(filters.search)
        : undefined;

    const dateFrom =
      filters.dateFrom
        ? new Date(filters.dateFrom)
        : undefined;

    const dateTo =
      filters.dateTo
        ? new Date(filters.dateTo)
        : undefined;

    const onlyWithBalance =
      "onlyWithBalance" in filters
        ? filters.onlyWithBalance
        : undefined;

    return {
      ...("status" in filters &&
      filters.status
        ? {
            status: filters.status,
          }
        : {}),

      ...(filters.wasteTypeId
        ? {
            wasteTypeId:
              filters.wasteTypeId,
          }
        : {}),

      ...("collectionId" in filters &&
      filters.collectionId
        ? {
            collectionId:
              filters.collectionId,
          }
        : {}),

      ...("collectionMaterialId" in
        filters &&
      filters.collectionMaterialId
        ? {
            collectionMaterialId:
              filters.collectionMaterialId,
          }
        : {}),

      ...(filters.generatorId
        ? {
            generatorId:
              filters.generatorId,
          }
        : {}),

      ...(filters.collectorId
        ? {
            collectorId:
              filters.collectorId,
          }
        : {}),

      ...(filters.driverId
        ? {
            driverId:
              filters.driverId,
          }
        : {}),

      ...(filters.vehicleId
        ? {
            vehicleId:
              filters.vehicleId,
          }
        : {}),

      ...(filters.routeId
        ? {
            routeId:
              filters.routeId,
          }
        : {}),

      ...(filters.unit
        ? {
            unit: filters.unit,
          }
        : {}),

      ...(onlyWithBalance === true
        ? {
            remainingQuantity: {
              gt: 0,
            },
          }
        : {}),

      ...(dateFrom || dateTo
        ? {
            collectedAt: {
              ...(dateFrom
                ? {
                    gte: dateFrom,
                  }
                : {}),

              ...(dateTo
                ? {
                    lte: dateTo,
                  }
                : {}),
            },
          }
        : {}),

      ...(search
        ? {
            OR: [
              {
                materialNameSnapshot: {
                  contains: search,
                  mode: "insensitive",
                },
              },

              {
                categorySnapshot: {
                  contains: search,
                  mode: "insensitive",
                },
              },

              {
                subcategorySnapshot: {
                  contains: search,
                  mode: "insensitive",
                },
              },

              {
                generator: {
                  is: {
                    name: {
                      contains: search,
                      mode: "insensitive",
                    },
                  },
                },
              },

              {
                generator: {
                  is: {
                    companyName: {
                      contains: search,
                      mode: "insensitive",
                    },
                  },
                },
              },

              {
                route: {
                  is: {
                    name: {
                      contains: search,
                      mode: "insensitive",
                    },
                  },
                },
              },

              {
                collection: {
                  is: {
                    notes: {
                      contains: search,
                      mode: "insensitive",
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };
  }

  private buildWhere(
    context: CollectionEntryAccessContext,
    filters: CollectionEntryFilters
  ): Prisma.CollectionWasteEntryWhereInput {
    return {
      AND: [
        this.buildAccessWhere(context),
        this.buildFiltersWhere(filters),
      ],
    };
  }

  /*
   * ============================================================
   * LISTAGEM GERAL
   * ============================================================
   */

  async list(
    authUserId: string,
    authUserRole: string,
    filters: CollectionEntryListQuery
  ) {
    const context =
      await this.getAccessContext(
        authUserId,
        authUserRole
      );

    const where = this.buildWhere(
      context,
      filters
    );

    const page = filters.page;
    const limit = filters.limit;

    const skip =
      (page - 1) * limit;

    const [entries, total, quantityEntries] =
      await prisma.$transaction([
        prisma.collectionWasteEntry.findMany({
          where,

          include:
            collectionEntryInclude,

          orderBy: [
            {
              collectedAt: "desc",
            },
            {
              createdAt: "desc",
            },
          ],

          skip,
          take: limit,
        }),

        prisma.collectionWasteEntry.count({
          where,
        }),

        prisma.collectionWasteEntry.findMany({
          where,

          select: {
            unit: true,
            collectedQuantity: true,
            destinedQuantity: true,
            remainingQuantity: true,
          },
        }),
      ]);

    return {
      success: true,

      entries,

      pagination:
        calculatePagination(
          page,
          limit,
          total
        ),

      totalsByUnit:
        calculateTotalsByUnit(
          quantityEntries
        ),
    };
  }

  /*
   * ============================================================
   * ENTRADAS PENDENTES
   * ============================================================
   */

  async listPending(
    authUserId: string,
    authUserRole: string,
    filters: PendingCollectionEntryQuery
  ) {
    const context =
      await this.getAccessContext(
        authUserId,
        authUserRole
      );

    const baseFilters =
      this.buildFiltersWhere(filters);

    const where: Prisma.CollectionWasteEntryWhereInput =
      {
        AND: [
          this.buildAccessWhere(context),

          baseFilters,

          {
            remainingQuantity: {
              gt: 0,
            },

            status: {
              notIn: [
                CollectionEntryStatus.FULLY_DESTINED,
                CollectionEntryStatus.CANCELLED,
              ],
            },
          },
        ],
      };

    const page = filters.page;
    const limit = filters.limit;

    const skip =
      (page - 1) * limit;

    const [entries, total, quantityEntries] =
      await prisma.$transaction([
        prisma.collectionWasteEntry.findMany({
          where,

          include:
            collectionEntryInclude,

          orderBy: [
            {
              collectedAt: "asc",
            },
            {
              createdAt: "asc",
            },
          ],

          skip,
          take: limit,
        }),

        prisma.collectionWasteEntry.count({
          where,
        }),

        prisma.collectionWasteEntry.findMany({
          where,

          select: {
            unit: true,
            collectedQuantity: true,
            destinedQuantity: true,
            remainingQuantity: true,
          },
        }),
      ]);

    return {
      success: true,

      entries,

      pagination:
        calculatePagination(
          page,
          limit,
          total
        ),

      totalsByUnit:
        calculateTotalsByUnit(
          quantityEntries
        ),
    };
  }

  /*
   * ============================================================
   * RESUMO
   * ============================================================
   */

  async summary(
    authUserId: string,
    authUserRole: string,
    filters: CollectionEntrySummaryQuery
  ) {
    const context =
      await this.getAccessContext(
        authUserId,
        authUserRole
      );

    const where = this.buildWhere(
      context,
      filters
    );

    const entries =
      await prisma.collectionWasteEntry.findMany({
        where,

        select: {
          status: true,
          unit: true,
          collectedQuantity: true,
          destinedQuantity: true,
          remainingQuantity: true,
        },
      });

    const statusCounts = new Map<
      CollectionEntryStatus,
      number
    >();

    for (const entry of entries) {
      statusCounts.set(
        entry.status,
        Number(
          statusCounts.get(
            entry.status
          ) || 0
        ) + 1
      );
    }

    const entriesByStatus =
      Array.from(
        statusCounts.entries()
      ).map(([status, entriesCount]) => ({
        status,
        entriesCount,
      }));

    const pendingStatuses: CollectionEntryStatus[] =
      [
        CollectionEntryStatus.PENDING_DESTINATION,
        CollectionEntryStatus.SENT_TO_TRIAGE,
        CollectionEntryStatus.REJECTED,
        CollectionEntryStatus.RESERVED,
      ];

    const pendingEntries =
      entries.filter(
        (entry) =>
          normalizeNumber(
            entry.remainingQuantity
          ) > 0 &&
          pendingStatuses.includes(
            entry.status
          )
      ).length;

    const partiallyDestinedEntries =
      entries.filter(
        (entry) =>
          entry.status ===
          CollectionEntryStatus.PARTIALLY_DESTINED
      ).length;

    const fullyDestinedEntries =
      entries.filter(
        (entry) =>
          entry.status ===
          CollectionEntryStatus.FULLY_DESTINED ||
          normalizeNumber(
            entry.remainingQuantity
          ) <= 0
      ).length;

    return {
      success: true,

      totalEntries: entries.length,

      pendingEntries,

      partiallyDestinedEntries,

      fullyDestinedEntries,

      totalsByUnit:
        calculateTotalsByUnit(
          entries
        ),

      entriesByStatus,
    };
  }

  /*
   * ============================================================
   * CONSULTA POR ID
   * ============================================================
   */

  async findById(
    authUserId: string,
    authUserRole: string,
    entryId: string
  ) {
    const context =
      await this.getAccessContext(
        authUserId,
        authUserRole
      );

    const accessWhere =
      this.buildAccessWhere(context);

    const entry =
      await prisma.collectionWasteEntry.findFirst({
        where: {
          AND: [
            {
              id: entryId,
            },

            accessWhere,
          ],
        },

        include:
          collectionEntryInclude,
      });

    if (!entry) {
      throw new CollectionEntryDomainError(
        "Entrada de resíduo coletado não encontrada.",
        {
          statusCode: 404,
          code: "COLLECTION_ENTRY_NOT_FOUND",
        }
      );
    }

    return {
      success: true,
      entry,
    };
  }
}