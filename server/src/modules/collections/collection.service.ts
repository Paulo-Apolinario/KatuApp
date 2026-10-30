import { type HistoryPage, pageResult } from "../../shared/history-page";
import { creditedKg } from "../collector-teams/team.model";
import { refreshTeamTotals } from "../collector-teams/team.service";
import { notifyCooperative, notifyCollection } from "../inbox/inbox.service";
import type { ReviewQuantitiesInput } from "./collection.schemas";
import { createHash } from "node:crypto";
import {
  CollectionEntryStatus,
  CollectionStatus,
  CollectorStatus,
  DriverStatus,
  Prisma,
  RouteStatus,
  ScheduleStatus,
  UserRole,
  VehicleStatus,
  WasteCatalogSuggestionOrigin,
  WasteStockStatus,
  WasteUnit,
} from "@prisma/client";

import { prisma } from "../../lib/prisma";

import type {
  CancelCollectionInput,
  CollectionMaterialSchemaInput,
  CompleteCollectionInput,
  CompleteFieldCollectionInput,
  CreateCollectionInput,
  ReceiveCollectionInput,
  StartCollectionInput,
  StartSortingInput,
  UpdateCollectionStatusInput,
} from "./collection.schemas";

import {
  CollectionDomainError,
  type CollectionAccessContext,
  type NormalizedCollectionMaterial,
} from "./collection.types";

type TransactionClient = Prisma.TransactionClient;

/*
 * ============================================================
 * FUNÇÕES AUXILIARES
 * ============================================================
 */

function normalizeRole(value: unknown): string {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function normalizeText(value?: string | null): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return String(value).trim() || null;
}

function normalizeDate(value?: string | null): Date {
  if (!value) {
    return new Date();
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new CollectionDomainError("A data informada é inválida.", {
      statusCode: 400,
      code: "INVALID_DATE",
    });
  }

  return date;
}

function quantityToKg(quantity: number, unit: WasteUnit): number {
  if (unit === WasteUnit.KG) {
    return quantity;
  }
  if (unit === WasteUnit.TON) {
    return quantity * 1000;
  }
  return 0;
}

function isGeneratorRole(
  role: string,
): role is "GENERATOR_SMALL" | "GENERATOR_LARGE" {
  return role === "GENERATOR_SMALL" || role === "GENERATOR_LARGE";
}

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

const collectionInclude = {
  participants: true,
  allocationReviews: { orderBy: { version: "desc" as const } },
  quantityReviews: { orderBy: { version: "desc" as const } },
  extraOrder: {
    select: { id: true, contextRouteId: true, routeNameSnapshot: true },
  },
  incidents: { orderBy: { createdAt: "desc" as const } },
  bin: {
    select: {
      id: true,
      binId: true,
      name: true,
      location: true,
      street: true,
      number: true,
      neighborhood: true,
      city: true,
      state: true,
      latitude: true,
      longitude: true,
    },
  },
  generator: { omit: { documentNumber: true } },
  collector: true,
  driver: true,
  vehicle: true,
  route: true,

  schedule: {
    include: {
      requestedBy: {
        select: userSelect,
      },
      requestedMaterials: {
        include: {
          wasteType: true,
          catalogSuggestion: true,
        },
        orderBy: {
          createdAt: "asc" as const,
        },
      },
    },
  },

  startedBy: { select: userSelect },
  fieldCompletedBy: { select: userSelect },
  receivedBy: { select: userSelect },
  sortingStartedBy: { select: userSelect },
  completedBy: { select: userSelect },
  cancelledBy: { select: userSelect },

  collectionMaterials: {
    include: {
      wasteType: true,
      catalogSuggestion: true,

      wasteEntry: {
        include: {
          destinations: {
            include: {
              stockItem: true,
              stockLot: true,
              createdBy: { select: userSelect },
              cancelledBy: { select: userSelect },
            },
            orderBy: {
              createdAt: "desc" as const,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "asc" as const,
    },
  },
} satisfies Prisma.CollectionInclude;

/*
 * ============================================================
 * SERVICE
 * ============================================================
 */

export class CollectionService {
  /*
   * ============================================================
   * CONTEXTO DE ACESSO
   * ============================================================
   */

  private async getAccessContext(
    authUserId: string,
    authUserRole: string,
  ): Promise<CollectionAccessContext> {
    const role = normalizeRole(authUserRole);

    if (!authUserId) {
      throw new CollectionDomainError("Usuário autenticado não identificado.", {
        statusCode: 401,
        code: "AUTH_USER_NOT_IDENTIFIED",
      });
    }

    if (role === UserRole.COOPERATIVE) {
      const cooperative = await prisma.cooperative.findUnique({
        where: { userId: authUserId },
        select: { id: true },
      });

      if (!cooperative) {
        throw new CollectionDomainError(
          "Cooperativa do usuário autenticado não encontrada.",
          {
            statusCode: 404,
            code: "COOPERATIVE_NOT_FOUND",
          },
        );
      }

      return {
        userId: authUserId,
        role: "COOPERATIVE",
        cooperativeId: cooperative.id,
      };
    }

    if (role === UserRole.COLLECTOR) {
      const collector = await prisma.collector.findUnique({
        where: { userId: authUserId },
        select: { id: true, cooperativeId: true, status: true },
      });

      if (!collector) {
        throw new CollectionDomainError(
          "Catador do usuário autenticado não encontrado.",
          {
            statusCode: 404,
            code: "COLLECTOR_NOT_FOUND",
          },
        );
      }

      if (collector.status === "INACTIVE")
        throw new CollectionDomainError("Catador inativo.", {
          statusCode: 403,
          code: "INACTIVE_COLLECTOR",
        });
      if (!collector.cooperativeId) {
        throw new CollectionDomainError(
          "O catador não está vinculado a uma cooperativa.",
          {
            statusCode: 403,
            code: "COLLECTOR_WITHOUT_COOPERATIVE",
          },
        );
      }

      return {
        userId: authUserId,
        role: "COLLECTOR",
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
        throw new CollectionDomainError(
          "Motorista do usuário autenticado não encontrado.",
          {
            statusCode: 404,
            code: "DRIVER_NOT_FOUND",
          },
        );
      }

      return {
        userId: authUserId,
        role: "DRIVER",
        cooperativeId: driver.cooperativeId!,
        driverId: driver.id,
      };
    }

    if (isGeneratorRole(role)) {
      const generator = await prisma.generator.findUnique({
        where: { userId: authUserId },
        select: { id: true, cooperativeId: true },
      });

      if (!generator) {
        throw new CollectionDomainError(
          "Gerador do usuário autenticado não encontrado.",
          {
            statusCode: 404,
            code: "GENERATOR_NOT_FOUND",
          },
        );
      }

      return {
        userId: authUserId,
        role:
          role === UserRole.GENERATOR_SMALL
            ? "GENERATOR_SMALL"
            : "GENERATOR_LARGE",
        cooperativeId: generator.cooperativeId!,
        generatorId: generator.id,
      };
    }

    throw new CollectionDomainError(
      "Usuário sem permissão para acessar coletas.",
      {
        statusCode: 403,
        code: "COLLECTION_ACCESS_DENIED",
      },
    );
  }

  /*
   * ============================================================
   * TRANSIÇÕES
   * ============================================================
   */

  private assertTransition(
    currentStatus: CollectionStatus,
    expectedStatus: CollectionStatus,
    targetStatus: CollectionStatus,
  ) {
    if (currentStatus !== expectedStatus) {
      throw new CollectionDomainError(
        `A coleta precisa estar em ${expectedStatus} para avançar para ${targetStatus}.`,
        {
          statusCode: 409,
          code: "INVALID_COLLECTION_TRANSITION",
          details: {
            currentStatus,
            expectedStatus,
            targetStatus,
          },
        },
      );
    }
  }

  /*
   * ============================================================
   * NORMALIZAÇÃO DOS MATERIAIS
   * ============================================================
   */

  private async normalizeMaterials(
    transaction: TransactionClient,
    cooperativeId: string,
    materialsInput: CollectionMaterialSchemaInput[],
  ): Promise<NormalizedCollectionMaterial[]> {
    if (!Array.isArray(materialsInput) || materialsInput.length === 0) {
      throw new CollectionDomainError(
        "Informe ao menos um material coletado.",
        {
          statusCode: 400,
          code: "COLLECTION_MATERIALS_REQUIRED",
        },
      );
    }

    const wasteTypeIds = Array.from(
      new Set(
        materialsInput
          .map((material) => normalizeText(material.wasteTypeId))
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const wasteTypes =
      wasteTypeIds.length > 0
        ? await transaction.wasteStockItem.findMany({
            where: {
              id: { in: wasteTypeIds },
              cooperativeId,
              isActive: true,
              status: WasteStockStatus.ACTIVE,
            },
            select: {
              id: true,
              name: true,
              category: true,
              subcategory: true,
              unit: true,
              defaultUnit: true,
            },
          })
        : [];

    if (wasteTypes.length !== wasteTypeIds.length) {
      const foundIds = new Set(wasteTypes.map((item) => item.id));
      const missingIds = wasteTypeIds.filter((id) => !foundIds.has(id));

      throw new CollectionDomainError(
        "Um ou mais tipos de resíduos não foram encontrados no catálogo ativo da cooperativa.",
        {
          statusCode: 400,
          code: "INVALID_WASTE_TYPES",
          details: { wasteTypeIds: missingIds },
        },
      );
    }

    const wasteTypesMap = new Map(wasteTypes.map((item) => [item.id, item]));
    const keys = new Set<string>();

    const normalized = materialsInput.map(
      (material, index): NormalizedCollectionMaterial => {
        const wasteTypeId = normalizeText(material.wasteTypeId);
        const catalogItem = wasteTypeId
          ? wasteTypesMap.get(wasteTypeId)
          : undefined;
        const quantity = Number(material.quantity);

        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new CollectionDomainError(
            `A quantidade do material na posição ${index + 1} deve ser maior que zero.`,
            {
              statusCode: 400,
              code: "INVALID_MATERIAL_QUANTITY",
            },
          );
        }

        const proposed = material.proposedMaterial;
        const name = catalogItem?.name || normalizeText(proposed?.name);

        if (!name) {
          throw new CollectionDomainError(
            `Informe o nome do material na posição ${index + 1}.`,
            {
              statusCode: 400,
              code: "MATERIAL_NAME_REQUIRED",
            },
          );
        }

        const unit =
          material.unit ||
          proposed?.unit ||
          catalogItem?.unit ||
          catalogItem?.defaultUnit ||
          WasteUnit.KG;

        if (
          catalogItem &&
          (catalogItem.unit !== unit || catalogItem.defaultUnit !== unit)
        )
          throw new CollectionDomainError(
            "A unidade coletada deve corresponder à unidade do catálogo. Revise o material antes de concluir.",
            { statusCode: 400, code: "COLLECTION_MATERIAL_UNIT_MISMATCH" },
          );

        return {
          wasteTypeId: catalogItem?.id || null,
          name,
          category: catalogItem?.category || normalizeText(proposed?.category),
          subcategory:
            catalogItem?.subcategory || normalizeText(proposed?.subcategory),
          quantity,
          quantityKg: quantityToKg(quantity, unit),
          unit,
          notes: normalizeText(material.notes),
        };
      },
    );

    for (const material of normalized) {
      const key = material.wasteTypeId
        ? `catalog:${material.wasteTypeId}:${material.unit}`
        : `proposal:${material.name.trim().toLocaleLowerCase("pt-BR")}:${material.unit}`;

      if (keys.has(key)) {
        throw new CollectionDomainError(
          `O material "${material.name}" foi informado mais de uma vez com a mesma unidade.`,
          {
            statusCode: 400,
            code: "DUPLICATE_COLLECTION_MATERIAL",
          },
        );
      }
      keys.add(key);
    }

    return normalized;
  }

  /*
   * ============================================================
   * CRIAÇÃO DOS REGISTROS NORMALIZADOS
   * ============================================================
   */

  private async createCollectedMaterials(
    transaction: TransactionClient,
    collection: {
      id: string;
      cooperativeId: string;
      generatorId: string | null;
      collectorId: string | null;
      driverId: string | null;
      vehicleId: string | null;
      routeId: string | null;
    },
    materials: NormalizedCollectionMaterial[],
    createdByUserId: string,
    createdByNameSnapshot: string | null,
    collectedAt: Date,
  ) {
    for (const material of materials) {
      const collectionMaterial = await transaction.collectionMaterial.create({
        data: {
          collectionId: collection.id,
          wasteTypeId: material.wasteTypeId,
          nameSnapshot: material.name,
          categorySnapshot: material.category,
          subcategorySnapshot: material.subcategory,
          unit: material.unit,
          quantity: new Prisma.Decimal(material.quantity),
          reportedQuantity: new Prisma.Decimal(material.quantity),
        },
      });

      if (!material.wasteTypeId) {
        await transaction.wasteCatalogSuggestion.create({
          data: {
            cooperativeId: collection.cooperativeId,
            suggestedByUserId: createdByUserId,
            origin: WasteCatalogSuggestionOrigin.COLLECTION_FOUND,
            name: material.name,
            category: material.category,
            subcategory: material.subcategory,
            unit: material.unit,
            collectionMaterialId: collectionMaterial.id,
          },
        });
      }

      await transaction.collectionWasteEntry.create({
        data: {
          cooperativeId: collection.cooperativeId,
          collectionId: collection.id,
          collectionMaterialId: collectionMaterial.id,
          wasteTypeId: material.wasteTypeId,
          generatorId: collection.generatorId,
          routeId: collection.routeId,
          vehicleId: collection.vehicleId,
          driverId: collection.driverId,
          collectorId: collection.collectorId,
          materialNameSnapshot: material.name,
          categorySnapshot: material.category,
          subcategorySnapshot: material.subcategory,
          unit: material.unit,
          collectedQuantity: new Prisma.Decimal(material.quantity),
          destinedQuantity: new Prisma.Decimal(0),
          remainingQuantity: new Prisma.Decimal(material.quantity),
          status: CollectionEntryStatus.PENDING_DESTINATION,
          origin: "COLLECTION_FIELD_COMPLETION",
          notes: material.notes,
          collectedAt,
          createdByUserId,
          createdByNameSnapshot,
        },
      });
    }
  }

  private async applyFieldTotals(
    transaction: TransactionClient,
    collection: { collectorId: string | null; generatorId: string | null },
    totalWeightKg: number,
  ) {
    const collectorId = collection.collectorId;
    if (!collectorId) return;
    await transaction.$queryRaw`SELECT id FROM "Collector" WHERE id = ${collectorId} FOR UPDATE`;
    const collectorState = await transaction.collector.findUniqueOrThrow({
      where: { id: collectorId },
    });
    const localDay = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Fortaleza",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const dayStart = new Date(`${localDay}T00:00:00-03:00`);
    const monthStart = new Date(`${localDay.slice(0, 7)}-01T00:00:00-03:00`);
    const monthEnd = new Date(monthStart);
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    const kgMonth = await transaction.collection.aggregate({
      where: { collectorId, collectedAt: { gte: monthStart, lt: monthEnd } },
      _sum: { totalWeightKg: true },
    });
    const collectionsToday = await transaction.collection.count({
      where: { collectorId, collectedAt: { gte: dayStart, lt: dayEnd } },
    });
    await transaction.collector.update({
      where: { id: collectorId },
      data: {
        status:
          collectorState.status === CollectorStatus.INACTIVE
            ? CollectorStatus.INACTIVE
            : (await transaction.collection.count({
                  where: {
                    collectorId,
                    status: CollectionStatus.IN_PROGRESS,
                  },
                })) > 0
              ? CollectorStatus.ON_ROUTE
              : CollectorStatus.AVAILABLE,
        totalKg: { increment: totalWeightKg },
        kgMonth: kgMonth._sum.totalWeightKg || 0,
        collectionsToday,
      },
    });

    if (collection.generatorId && totalWeightKg > 0) {
      await transaction.generator.update({
        where: { id: collection.generatorId },
        data: {
          totalKg: { increment: totalWeightKg },
        },
      });
    }
  }

  /** Called only by the scoped OC approval transaction; never exposed as a route. */
  async createApprovedExtra(
    transaction: TransactionClient,
    data: {
      cooperativeId: string;
      collectorId: string;
      scheduleId: string;
      generatorId?: string | null;
      driverId?: string;
      vehicleId?: string;
      notes: string;
      collectedAt?: Date;
      receivedAt?: Date;
      receivedByUserId?: string | null;
      reporterUserId: string;
      reporterName: string;
      estimatedQuantities?: (number | undefined)[];
      materials: CollectionMaterialSchemaInput[];
    },
  ) {
    await this.validateTeam(
      transaction,
      data.cooperativeId,
      data.driverId || null,
      data.vehicleId || null,
    );
    const normalized = await this.normalizeMaterials(
      transaction,
      data.cooperativeId,
      data.materials,
    );
    if (
      !data.collectedAt &&
      !(await transaction.scheduleRequestedMaterial.count({
        where: { scheduleId: data.scheduleId },
      }))
    ) {
      for (const [index, m] of normalized.entries())
        await transaction.scheduleRequestedMaterial.create({
          data: {
            scheduleId: data.scheduleId,
            wasteTypeId: m.wasteTypeId,
            nameSnapshot: m.name,
            categorySnapshot: m.category,
            subcategorySnapshot: m.subcategory,
            unit: m.unit,
            estimatedQuantity: data.estimatedQuantities?.[index],
          },
        });
    }
    const totalWeightKg = data.collectedAt
      ? normalized.reduce((sum, m) => sum + m.quantityKg, 0)
      : 0;
    const collection = await transaction.collection.create({
      data: {
        cooperativeId: data.cooperativeId,
        collectorId: data.collectorId,
        scheduleId: data.scheduleId,
        generatorId: data.generatorId,
        driverId: data.driverId,
        vehicleId: data.vehicleId,
        routeId: null,
        notes: data.notes,
        status: data.collectedAt
          ? data.receivedAt
            ? CollectionStatus.RECEIVED
            : CollectionStatus.COLLECTED
          : CollectionStatus.PENDING,
        collectedAt: data.collectedAt,
        fieldCompletedByUserId: data.collectedAt ? data.reporterUserId : null,
        receivedAt: data.receivedAt,
        receivedByUserId: data.receivedByUserId,
        totalWeightKg,
        materials: data.collectedAt
          ? (normalized as unknown as Prisma.InputJsonValue)
          : [],
      },
    });
    if (data.collectedAt) {
      await this.createCollectedMaterials(
        transaction,
        collection,
        normalized,
        data.reporterUserId,
        data.reporterName,
        data.collectedAt,
      );
      await notifyCollection(
        transaction,
        collection.id,
        `field-collected:${collection.id}`,
        "COLLECTION_STAGE",
        "Coleta realizada em campo",
        "A retirada foi registrada. O material seguirá para recebimento e conferência pela cooperativa.",
      );
      await notifyCooperative(transaction, collection.cooperativeId!, `awaiting-receipt:${collection.id}`,
        "Coleta aguardando recebimento", "A equipe finalizou uma retirada em campo. Confira o recebimento dos materiais.", { collectionId: collection.id });
      const participantsToLock =
        await transaction.collectionParticipant.findMany({
          where: { collectionId: collection.id },
          select: { collectorId: true },
        });
      for (const id of [
        ...new Set([
          ...(collection.collectorId ? [collection.collectorId] : []),
          ...participantsToLock.map((p) => p.collectorId),
        ]),
      ].sort())
        await transaction.$queryRaw`SELECT id FROM "Collector" WHERE id=${id} FOR UPDATE`;
      await this.applyFieldTotals(transaction, collection, totalWeightKg);
      const team = await transaction.collectionParticipant.findMany({
        where: { collectionId: collection.id },
        select: { collectorId: true },
      });
      if (team.length)
        await refreshTeamTotals(transaction, [
          ...team.map((p) => p.collectorId),
          ...(collection.collectorId ? [collection.collectorId] : []),
        ]);
    }
    return collection;
  }

  /*
   * ============================================================
   * CRIAÇÃO E DELEGAÇÃO
   * ============================================================
   */

  async create(
    authUserId: string,
    authUserRole: string,
    data: CreateCollectionInput,
  ) {
    if (normalizeRole(authUserRole) !== UserRole.COOPERATIVE) {
      throw new CollectionDomainError(
        "Apenas cooperativas podem delegar coletas.",
        {
          statusCode: 403,
          code: "ONLY_COOPERATIVE_CAN_CREATE_COLLECTION",
        },
      );
    }

    const context = await this.getAccessContext(authUserId, authUserRole);

    if (context.role !== "COOPERATIVE") {
      throw new CollectionDomainError("Cooperativa não identificada.", {
        statusCode: 403,
        code: "COOPERATIVE_CONTEXT_REQUIRED",
      });
    }

    return prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM "Schedule" WHERE id=${data.scheduleId} FOR UPDATE`;
      const schedule = await transaction.schedule.findFirst({
        where: {
          id: data.scheduleId,
          cooperativeId: context.cooperativeId,
        },
        include: {
          collections: { select: { id: true } },
        },
      });

      if (!schedule) {
        throw new CollectionDomainError(
          "Agendamento não encontrado para esta cooperativa.",
          {
            statusCode: 404,
            code: "SCHEDULE_NOT_FOUND",
          },
        );
      }

      if (
        schedule.status === ScheduleStatus.CANCELLED ||
        schedule.status === ScheduleStatus.COMPLETED
      ) {
        throw new CollectionDomainError(
          "Não é possível delegar um agendamento encerrado.",
          {
            statusCode: 409,
            code: "SCHEDULE_ALREADY_CLOSED",
          },
        );
      }

      if (schedule.collections.length > 0) {
        throw new CollectionDomainError(
          "Este agendamento já possui uma coleta vinculada.",
          {
            statusCode: 409,
            code: "SCHEDULE_ALREADY_HAS_COLLECTION",
          },
        );
      }

      const collector = await transaction.collector.findFirst({
        where: {
          id: data.collectorId,
          cooperativeId: context.cooperativeId,
          status: CollectorStatus.AVAILABLE,
        },
      });

      if (!collector) {
        throw new CollectionDomainError(
          "Catador não encontrado ou indisponível para esta cooperativa.",
          { statusCode: 404, code: "COLLECTOR_UNAVAILABLE" },
        );
      }

      let driverId: string | null = null;
      let vehicleId: string | null = null;
      let routeId: string | null = null;

      if (data.driverId) {
        const driver = await transaction.driver.findFirst({
          where: {
            id: data.driverId,
            cooperativeId: context.cooperativeId,
            status: { not: DriverStatus.INACTIVE },
          },
        });

        if (!driver) {
          throw new CollectionDomainError(
            "Motorista não encontrado ou indisponível.",
            {
              statusCode: 404,
              code: "DRIVER_UNAVAILABLE",
            },
          );
        }
        driverId = driver.id;
      }

      if (data.vehicleId) {
        const vehicle = await transaction.vehicle.findFirst({
          where: {
            id: data.vehicleId,
            cooperativeId: context.cooperativeId,
            status: VehicleStatus.ACTIVE,
          },
        });

        if (!vehicle) {
          throw new CollectionDomainError(
            "Veículo não encontrado ou indisponível.",
            {
              statusCode: 404,
              code: "VEHICLE_UNAVAILABLE",
            },
          );
        }

        if (driverId && vehicle.driverId && vehicle.driverId !== driverId) {
          throw new CollectionDomainError(
            "O veículo informado está vinculado a outro motorista.",
            {
              statusCode: 409,
              code: "VEHICLE_DRIVER_CONFLICT",
            },
          );
        }
        vehicleId = vehicle.id;
      }

      if (data.routeId) {
        const route = await transaction.route.findFirst({
          where: {
            id: data.routeId,
            cooperativeId: context.cooperativeId,
            status: { in: [RouteStatus.SCHEDULED, RouteStatus.IN_PROGRESS] },
          },
        });

        if (!route) {
          throw new CollectionDomainError(
            "Rota não encontrada ou indisponível.",
            {
              statusCode: 404,
              code: "ROUTE_UNAVAILABLE",
            },
          );
        }

        if (driverId && route.driverId && route.driverId !== driverId) {
          throw new CollectionDomainError(
            "A rota informada pertence a outro motorista.",
            {
              statusCode: 409,
              code: "ROUTE_DRIVER_CONFLICT",
            },
          );
        }

        if (vehicleId && route.vehicleId && route.vehicleId !== vehicleId) {
          throw new CollectionDomainError(
            "A rota informada pertence a outro veículo.",
            {
              statusCode: 409,
              code: "ROUTE_VEHICLE_CONFLICT",
            },
          );
        }

        driverId = driverId || route.driverId || null;
        vehicleId = vehicleId || route.vehicleId || null;
        routeId = route.id;
      }

      await this.validateTeam(
        transaction,
        context.cooperativeId!,
        driverId,
        vehicleId,
      );

      const collection = await transaction.collection.create({
        data: {
          cooperativeId: context.cooperativeId,
          generatorId: schedule.generatorId,
          collectorId: collector.id,
          scheduleId: schedule.id,
          driverId,
          vehicleId,
          routeId,
          notes: normalizeText(data.notes),
          status: CollectionStatus.PENDING,
        },
      });

      await transaction.schedule.update({
        where: { id: schedule.id },
        data: {
          status: ScheduleStatus.SCHEDULED,
          scheduledDate: schedule.scheduledDate || new Date(),
        },
      });

      await notifyCollection(transaction, collection.id, `assigned:${collection.id}`, "COLLECTION_ASSIGNED",
        "Atendimento atribuído", "A cooperativa atribuiu a equipe responsável pela coleta. Consulte os detalhes do atendimento.");
      return transaction.collection.findUniqueOrThrow({
        where: { id: collection.id },
        include: collectionInclude,
      });
    });
  }

  /*
   * ============================================================
   * LISTAGEM
   * ============================================================
   */

  async listMine(authUserId: string, authUserRole: string): Promise<(Prisma.CollectionGetPayload<{ include: typeof collectionInclude }> & { creditedWeightKg?: number; myCollectorId?: string })[]>;
  async listMine(authUserId: string, authUserRole: string, page: HistoryPage): Promise<{ collections: (Prisma.CollectionGetPayload<{ include: typeof collectionInclude }> & { creditedWeightKg?: number; myCollectorId?: string })[]; pagination: ReturnType<typeof pageResult> }>;
  async listMine(authUserId: string, authUserRole: string, page?: HistoryPage) {
    const context = await this.getAccessContext(authUserId, authUserRole);
    let where: Prisma.CollectionWhereInput;

    switch (context.role) {
      case "COOPERATIVE":
        where = { cooperativeId: context.cooperativeId };
        break;
      case "COLLECTOR":
        where = {
          cooperativeId: context.cooperativeId,
          OR: [
            { collectorId: context.collectorId },
            { participants: { some: { collectorId: context.collectorId } } },
          ],
        };
        break;
      case "DRIVER":
        where = { driverId: context.driverId };
        break;
      case "GENERATOR_SMALL":
      case "GENERATOR_LARGE":
        where = { generatorId: context.generatorId };
        break;
      default:
        throw new CollectionDomainError(
          "Usuário sem permissão para listar coletas.",
          {
            statusCode: 403,
            code: "COLLECTION_LIST_DENIED",
          },
        );
    }

    if (page) where = { AND: [where, { status: "COMPLETED" }, ...(page.until ? [{ createdAt: { lte: new Date(page.until) } }] : [])] };
    const rows = await prisma.collection.findMany({
      where,
      include: collectionInclude,
      ...(page ? { skip: (page.page - 1) * page.limit, take: page.limit } : {}),
      orderBy: page ? [{ createdAt: "desc" }, { id: "desc" }] : [{ status: "asc" }, { createdAt: "desc" }],
    });
    const collections = context.role === "COLLECTOR"
      ? rows.map((c) => ({
          ...c,
          creditedWeightKg: creditedKg(c, context.collectorId!),
          myCollectorId: context.collectorId,
        }))
      : rows;
    return page ? { collections, pagination: pageResult(await prisma.collection.count({ where }), page) } : collections;
  }

  /*
   * ============================================================
   * CONSULTA POR ID
   * ============================================================
   */

  async findById(
    authUserId: string,
    authUserRole: string,
    collectionId: string,
  ) {
    const context = await this.getAccessContext(authUserId, authUserRole);

    let where: Prisma.CollectionWhereInput = {
      id: collectionId,
      cooperativeId: context.cooperativeId,
    };

    switch (context.role) {
      case "COOPERATIVE":
        break;
      case "COLLECTOR":
        where = {
          ...where,
          OR: [
            { collectorId: context.collectorId },
            { participants: { some: { collectorId: context.collectorId } } },
          ],
        };
        break;
      case "DRIVER":
        where = { ...where, driverId: context.driverId };
        break;
      case "GENERATOR_SMALL":
      case "GENERATOR_LARGE":
        where = { ...where, generatorId: context.generatorId };
        break;
      default:
        throw new CollectionDomainError(
          "Usuário sem permissão para consultar coleta.",
          {
            statusCode: 403,
            code: "COLLECTION_FIND_DENIED",
          },
        );
    }

    const collection = await prisma.collection.findFirst({
      where,
      include: collectionInclude,
    });

    if (!collection) {
      throw new CollectionDomainError("Coleta não encontrada.", {
        statusCode: 404,
        code: "COLLECTION_NOT_FOUND",
      });
    }

    return context.role === "COLLECTOR"
      ? {
          ...collection,
          creditedWeightKg: creditedKg(collection, context.collectorId!),
          myCollectorId: context.collectorId,
        }
      : collection;
  }

  /*
   * ============================================================
   * INÍCIO DA COLETA PELO CATADOR
   * ============================================================
   */

  private async validateTeam(
    transaction: TransactionClient,
    cooperativeId: string,
    driverId: string | null,
    vehicleId: string | null,
  ) {
    const driver = driverId
      ? await transaction.driver.findFirst({
          where: {
            id: driverId,
            cooperativeId,
            status: { not: DriverStatus.INACTIVE },
          },
        })
      : null;
    const vehicle = vehicleId
      ? await transaction.vehicle.findFirst({
          where: { id: vehicleId, cooperativeId, status: VehicleStatus.ACTIVE },
        })
      : null;
    if ((driverId && !driver) || (vehicleId && !vehicle))
      throw new CollectionDomainError(
        "Motorista ou veículo indisponível. Revise a equipe antes de iniciar.",
        { statusCode: 409, code: "TEAM_UNAVAILABLE" },
      );
    if (vehicle?.driverId && driverId && vehicle.driverId !== driverId)
      throw new CollectionDomainError(
        "O veículo está vinculado a outro motorista.",
        { statusCode: 409, code: "VEHICLE_DRIVER_CONFLICT" },
      );
  }

  async start(
    authUserId: string,
    authUserRole: string,
    collectionId: string,
    data: StartCollectionInput,
  ) {
    const context = await this.getAccessContext(authUserId, authUserRole);

    if (context.role !== "COLLECTOR") {
      throw new CollectionDomainError(
        "Apenas o catador responsável pode iniciar a coleta.",
        {
          statusCode: 403,
          code: "ONLY_COLLECTOR_CAN_START",
        },
      );
    }

    const collectorId = context.collectorId;

    return prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM "Collection" WHERE id = ${collectionId} FOR UPDATE`;
      const collection = await transaction.collection.findFirst({
        where: {
          id: collectionId,
          OR: [{ collectorId }, { participants: { some: { collectorId } } }],
          cooperativeId: context.cooperativeId,
        },
      });

      if (!collection) {
        throw new CollectionDomainError(
          "Coleta não encontrada para este catador.",
          {
            statusCode: 404,
            code: "COLLECTION_NOT_FOUND",
          },
        );
      }

      const operationHash = createHash("sha256")
        .update(JSON.stringify(data))
        .digest("hex");
      if (
        data.operationId &&
        collection.startOperationId === data.operationId
      ) {
        if (collection.startOperationHash !== operationHash)
          throw new CollectionDomainError(
            "Operação já registrada com dados diferentes.",
            { statusCode: 409, code: "OPERATION_PAYLOAD_CONFLICT" },
          );
        return transaction.collection.findUniqueOrThrow({
          where: { id: collection.id },
          include: collectionInclude,
        });
      }
      this.assertTransition(
        collection.status,
        CollectionStatus.PENDING,
        CollectionStatus.IN_PROGRESS,
      );

      await this.validateTeam(
        transaction,
        collection.cooperativeId,
        collection.driverId,
        collection.vehicleId,
      );

      const participants = await transaction.collectionParticipant.findMany({
        where: { collectionId },
        select: { collectorId: true },
      });
      const memberIds = [
        ...new Set([
          collection.collectorId!,
          ...participants.map((p) => p.collectorId),
        ]),
      ]
        .filter(Boolean)
        .sort();
      for (const id of memberIds)
        await transaction.$queryRaw`SELECT id FROM "Collector" WHERE id=${id} FOR UPDATE`;
      if (
        (await transaction.collector.count({
          where: {
            id: { in: memberIds },
            cooperativeId: context.cooperativeId,
            status: { not: "INACTIVE" },
            user: { isActive: true, accountStatus: "ACTIVE" },
          },
        })) !== memberIds.length
      )
        throw new CollectionDomainError(
          "Revise os participantes inativos antes de iniciar.",
          { statusCode: 409, code: "TEAM_INACTIVE" },
        );
      await transaction.collector.updateMany({
        where: { id: { in: memberIds } },
        data: { status: CollectorStatus.ON_ROUTE },
      });

      if (collection.scheduleId) {
        await transaction.schedule.update({
          where: { id: collection.scheduleId },
          data: { status: ScheduleStatus.IN_PROGRESS },
        });
      }

      const started = await transaction.collection.update({
        where: { id: collection.id },
        data: {
          status: CollectionStatus.IN_PROGRESS,
          startOperationId: data.operationId,
          startOperationHash: data.operationId ? operationHash : undefined,
          startedAt: normalizeDate(data.startedAt),
          startedByUserId: authUserId,
          notes:
            data.notes !== undefined
              ? normalizeText(data.notes)
              : collection.notes,
        },
        include: collectionInclude,
      });
      await notifyCollection(transaction, collection.id, `started:${collection.id}`, "COLLECTION_STAGE",
        "Atendimento iniciado", "A equipe iniciou o atendimento desta coleta.");
      return started;
    });
  }

  /*
   * ============================================================
   * CONCLUSÃO DA ETAPA DE CAMPO
   * ============================================================
   */

  async completeField(
    authUserId: string,
    authUserRole: string,
    collectionId: string,
    data: CompleteFieldCollectionInput,
  ) {
    const context = await this.getAccessContext(authUserId, authUserRole);

    if (context.role !== "COLLECTOR") {
      throw new CollectionDomainError(
        "Apenas o catador responsável pode concluir a etapa de campo.",
        { statusCode: 403, code: "ONLY_COLLECTOR_CAN_COMPLETE_FIELD" },
      );
    }

    const collectorId = context.collectorId;

    return prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM "Collection" WHERE id = ${collectionId} FOR UPDATE`;
      const collection = await transaction.collection.findFirst({
        where: {
          id: collectionId,
          OR: [{ collectorId }, { participants: { some: { collectorId } } }],
          cooperativeId: context.cooperativeId,
        },
        include: {
          collectionMaterials: { select: { id: true } },
        },
      });

      if (!collection) {
        throw new CollectionDomainError(
          "Coleta não encontrada para este catador.",
          {
            statusCode: 404,
            code: "COLLECTION_NOT_FOUND",
          },
        );
      }

      const operationHash = createHash("sha256")
        .update(JSON.stringify(data))
        .digest("hex");
      if (
        data.operationId &&
        collection.fieldOperationId === data.operationId
      ) {
        if (collection.fieldOperationHash !== operationHash)
          throw new CollectionDomainError(
            "Operação já registrada com dados diferentes.",
            { statusCode: 409, code: "OPERATION_PAYLOAD_CONFLICT" },
          );
        return transaction.collection.findUniqueOrThrow({
          where: { id: collection.id },
          include: collectionInclude,
        });
      }
      this.assertTransition(
        collection.status,
        CollectionStatus.IN_PROGRESS,
        CollectionStatus.COLLECTED,
      );

      if (collection.collectionMaterials.length > 0) {
        throw new CollectionDomainError(
          "Os materiais desta coleta já foram registrados.",
          {
            statusCode: 409,
            code: "COLLECTION_MATERIALS_ALREADY_CREATED",
          },
        );
      }

      const normalizedMaterials = await this.normalizeMaterials(
        transaction,
        collection.cooperativeId,
        data.materials,
      );

      const authenticatedUser = await transaction.user.findUnique({
        where: { id: authUserId },
        select: { displayName: true, email: true },
      });

      const collectedAt = normalizeDate(data.collectedAt);

      await this.createCollectedMaterials(
        transaction,
        collection,
        normalizedMaterials,
        authUserId,
        authenticatedUser?.displayName || authenticatedUser?.email || null,
        collectedAt,
      );

      const totalWeightKg =
        data.totalWeightKg ??
        normalizedMaterials.reduce(
          (total, material) => total + material.quantityKg,
          0,
        );

      const updated = await transaction.collection.update({
        where: { id: collection.id },
        data: {
          status: CollectionStatus.COLLECTED,
          fieldOperationId: data.operationId,
          fieldOperationHash: data.operationId ? operationHash : undefined,
          collectedAt,
          fieldCompletedByUserId: authUserId,
          totalWeightKg,
          materials: normalizedMaterials as unknown as Prisma.InputJsonValue,
          notes:
            data.notes !== undefined
              ? normalizeText(data.notes)
              : collection.notes,
        },
        include: collectionInclude,
      });

      if (collection.binId) {
        await transaction.bin.update({
          where: { id: collection.binId },
          data: { needsPickup: false, pickupReason: null },
        });
        await transaction.binEvent.create({
          data: {
            binId: collection.binId,
            cooperativeId: collection.cooperativeId,
            kind: "PICKUP_COLLECTED",
            actorUserId: authUserId,
            actorName: authenticatedUser?.displayName || null,
            notes:
              "Retirada finalizada em campo. Recebimento e destinação seguem o fluxo de resíduos.",
            data: { collectionId: collection.id },
          },
        });
      }

      await notifyCollection(
        transaction,
        collection.id,
        `field-collected:${collection.id}`,
        "COLLECTION_STAGE",
        "Coleta realizada em campo",
        "A retirada foi registrada. O material seguirá para recebimento e conferência pela cooperativa.",
      );
      const participantsToLock =
        await transaction.collectionParticipant.findMany({
          where: { collectionId: collection.id },
          select: { collectorId: true },
        });
      for (const id of [
        ...new Set([
          ...(collection.collectorId ? [collection.collectorId] : []),
          ...participantsToLock.map((p) => p.collectorId),
        ]),
      ].sort())
        await transaction.$queryRaw`SELECT id FROM "Collector" WHERE id=${id} FOR UPDATE`;
      await this.applyFieldTotals(transaction, collection, totalWeightKg);
      const team = await transaction.collectionParticipant.findMany({
        where: { collectionId: collection.id },
        select: { collectorId: true },
      });
      if (team.length)
        await refreshTeamTotals(transaction, [
          ...team.map((p) => p.collectorId),
          ...(collection.collectorId ? [collection.collectorId] : []),
        ]);

      return updated;
    });
  }

  /*
   * ============================================================
   * TRANSIÇÃO DA COOPERATIVA
   * ============================================================
   */

  private async cooperativeTransition(
    authUserId: string,
    authUserRole: string,
    collectionId: string,
    expectedStatus: CollectionStatus,
    targetStatus: CollectionStatus,
    data: Prisma.CollectionUncheckedUpdateInput,
  ) {
    const context = await this.getAccessContext(authUserId, authUserRole);

    if (context.role !== "COOPERATIVE") {
      throw new CollectionDomainError(
        "Apenas a cooperativa pode executar esta operação.",
        {
          statusCode: 403,
          code: "ONLY_COOPERATIVE_CAN_TRANSITION",
        },
      );
    }

    return prisma.$transaction(async (transaction) => {
      const extra = await transaction.extraCollectionOrder.findUnique({
        where: { collectionId },
      });
      if (extra)
        await transaction.$queryRaw`SELECT id FROM "ExtraCollectionOrder" WHERE id=${extra.id} FOR UPDATE`;
      await transaction.$queryRaw`SELECT id FROM "Collection" WHERE id = ${collectionId} FOR UPDATE`;
      const collection = await transaction.collection.findFirst({
        where: {
          id: collectionId,
          cooperativeId: context.cooperativeId,
        },
      });

      if (!collection) {
        throw new CollectionDomainError(
          "Coleta não encontrada para esta cooperativa.",
          {
            statusCode: 404,
            code: "COLLECTION_NOT_FOUND",
          },
        );
      }

      this.assertTransition(collection.status, expectedStatus, targetStatus);
      if (
        targetStatus === CollectionStatus.SORTING &&
        !collection.quantityReviewVersion
      )
        throw new CollectionDomainError(
          "Registre a conferência de quantidades antes de iniciar a triagem.",
          { statusCode: 409, code: "QUANTITY_REVIEW_REQUIRED" },
        );

      const updated = await transaction.collection.update({
        where: { id: collection.id },
        data: {
          ...data,
          status: targetStatus,
        },
        include: collectionInclude,
      });
      if (extra && targetStatus === CollectionStatus.RECEIVED) {
        const actor = await transaction.user.findUnique({
          where: { id: authUserId },
          select: { displayName: true },
        });
        await transaction.extraCollectionOrder.update({
          where: { id: extra.id },
          data: {
            receivedAt: updated.receivedAt,
            receivedByUserId: authUserId,
            custody: "COOPERATIVE",
            custodyNotes:
              "Recebimento confirmado pelo fluxo da coleta vinculada.",
          },
        });
        await transaction.extraCollectionOrderEvent.create({
          data: {
            orderId: extra.id,
            operationId: `receive-collection:${collectionId}`,
            operationHash: createHash("sha256")
              .update(collectionId)
              .digest("hex"),
            kind: "RECEIVED_BY_COLLECTION",
            actorUserId: authUserId,
            actorName: actor?.displayName || "Cooperativa",
            notes: "Recebimento confirmado no fluxo da coleta vinculada.",
            data: { collectionId },
          },
        });
      }
      const title =
        targetStatus === CollectionStatus.RECEIVED
          ? "Coleta recebida pela cooperativa"
          : "Triagem da coleta iniciada";
      await notifyCollection(
        transaction,
        collectionId,
        `stage:${collectionId}:${targetStatus}`,
        "COLLECTION_STAGE",
        title,
        "A cooperativa atualizou a etapa da sua coleta. Acesse os detalhes para acompanhar.",
      );
      return updated;
    });
  }

  /*
   * ============================================================
   * RECEBIMENTO
   * ============================================================
   */

  async reviewQuantities(
    authUserId: string,
    authUserRole: string,
    collectionId: string,
    data: ReviewQuantitiesInput,
  ) {
    const context = await this.getAccessContext(authUserId, authUserRole);
    if (context.role !== "COOPERATIVE")
      throw new CollectionDomainError(
        "Somente a cooperativa pode conferir a quantidade recebida.",
        { statusCode: 403, code: "REVIEW_FORBIDDEN" },
      );
    return prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Collection" WHERE id = ${collectionId} FOR UPDATE`;
        const collection = await tx.collection.findFirst({
          where: { id: collectionId, cooperativeId: context.cooperativeId },
          include: collectionInclude,
        });
        if (!collection)
          throw new CollectionDomainError("Coleta não encontrada.", {
            statusCode: 404,
            code: "COLLECTION_NOT_FOUND",
          });
        if (!["RECEIVED", "SORTING"].includes(collection.status))
          throw new CollectionDomainError(
            "Confira as quantidades após o recebimento, durante a triagem. Coletas encerradas não podem ser alteradas.",
            { statusCode: 409, code: "REVIEW_STAGE_INVALID" },
          );
        if (collection.quantityReviewVersion !== data.expectedVersion)
          throw new CollectionDomainError(
            "A conferência foi atualizada por outro usuário. Recarregue a coleta antes de continuar.",
            { statusCode: 409, code: "REVIEW_VERSION_CONFLICT" },
          );
        const materials = collection.collectionMaterials;
        const ids = new Set(data.items.map((item) => item.materialId));
        if (
          ids.size !== data.items.length ||
          ids.size !== materials.length ||
          materials.some((m) => !ids.has(m.id))
        )
          throw new CollectionDomainError(
            "Informe uma quantidade para cada material desta coleta, sem duplicar itens.",
            { statusCode: 400, code: "REVIEW_ITEMS_INVALID" },
          );
        const quantities = new Map(
          data.items.map((item) => [item.materialId, item.quantity]),
        );
        const items = materials.map((m) => ({
          materialId: m.id,
          name: m.nameSnapshot,
          unit: m.unit,
          reportedQuantity: Number(m.reportedQuantity ?? m.quantity),
          previousQuantity: Number(m.quantity),
          confirmedQuantity: quantities.get(m.id)!,
        }));
        const changed = items.some(
          (item) => item.previousQuantity !== item.confirmedQuantity,
        );
        if (changed && data.reason.trim().length < 5)
          throw new CollectionDomainError(
            "Descreva a justificativa da diferença (mínimo de 5 caracteres).",
            { statusCode: 400, code: "REVIEW_REASON_REQUIRED" },
          );
        if (!changed && collection.quantityReviewVersion > 0) return collection;
        for (const m of materials) {
          if (!m.wasteEntry)
            throw new CollectionDomainError(
              "Material sem entrada operacional. Regularize a coleta antes da conferência.",
              { statusCode: 409, code: "REVIEW_ENTRY_MISSING" },
            );
          await tx.$queryRaw`SELECT id FROM "CollectionWasteEntry" WHERE id = ${m.wasteEntry.id} FOR UPDATE`;
          const entry = await tx.collectionWasteEntry.findUniqueOrThrow({
            where: { id: m.wasteEntry.id },
          });
          const quantity = new Prisma.Decimal(quantities.get(m.id)!);
          if (quantity.lt(entry.destinedQuantity))
            throw new CollectionDomainError(
              `A quantidade de ${m.nameSnapshot} é menor que a já destinada. Cancele ou regularize as destinações afetadas antes de conferir.`,
              { statusCode: 409, code: "REVIEW_BELOW_DESTINED" },
            );
          const remaining = quantity.sub(entry.destinedQuantity);
          await tx.collectionMaterial.update({
            where: { id: m.id },
            data: {
              quantity,
              reportedQuantity: m.reportedQuantity ?? m.quantity,
            },
          });
          await tx.collectionWasteEntry.update({
            where: { id: entry.id },
            data: {
              collectedQuantity: quantity,
              remainingQuantity: remaining,
              status: remaining.eq(0)
                ? "FULLY_DESTINED"
                : entry.destinedQuantity.gt(0)
                  ? "PARTIALLY_DESTINED"
                  : "PENDING_DESTINATION",
            },
          });
        }
        const total =
          Math.round(
            items.reduce(
              (sum, item) =>
                sum + quantityToKg(item.confirmedQuantity, item.unit),
              0,
            ) * 1000,
          ) / 1000;
        const version = collection.quantityReviewVersion + 1;
        const actor = await tx.user.findUniqueOrThrow({
          where: { id: authUserId },
          select: { displayName: true },
        });
        const reason =
          data.reason.trim() || "Conferência sem divergência de quantidade.";
        await tx.collectionQuantityReview.create({
          data: {
            collectionId,
            version,
            actorUserId: authUserId,
            actorName: actor.displayName,
            reason,
            items,
            previousTotalKg: collection.totalWeightKg,
            confirmedTotalKg: total,
          },
        });
        const updated = await tx.collection.update({
          where: { id: collectionId },
          data: {
            reportedTotalWeightKg:
              collection.reportedTotalWeightKg ?? collection.totalWeightKg,
            totalWeightKg: total,
            quantityReviewVersion: version,
            quantitiesReviewedAt: new Date(),
            materials: materials.map((m) => ({
              type: m.nameSnapshot,
              name: m.nameSnapshot,
              wasteTypeId: m.wasteTypeId,
              category: m.categorySnapshot,
              subcategory: m.subcategorySnapshot,
              notes: m.wasteEntry?.notes,
              unit: m.unit,
              quantity: quantities.get(m.id)!,
              quantityKg: quantityToKg(quantities.get(m.id)!, m.unit),
            })),
          },
          include: collectionInclude,
        });
        const delta = total - collection.totalWeightKg;
        if (collection.collectorId && delta !== 0) {
          await tx.$queryRaw`SELECT id FROM "Collector" WHERE id = ${collection.collectorId} FOR UPDATE`;
          const day = new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Fortaleza",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date());
          const monthStart = new Date(`${day.slice(0, 7)}-01T00:00:00-03:00`),
            monthEnd = new Date(monthStart);
          monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
          const month = await tx.collection.aggregate({
            where: {
              collectorId: collection.collectorId,
              status: { in: ["COLLECTED", "RECEIVED", "SORTING", "COMPLETED"] },
              collectedAt: { gte: monthStart, lt: monthEnd },
            },
            _sum: { totalWeightKg: true },
          });
          await tx.collector.update({
            where: { id: collection.collectorId },
            data: {
              totalKg: { increment: delta },
              kgMonth: month._sum.totalWeightKg || 0,
            },
          });
        }
        if (collection.generatorId && delta !== 0) {
          await tx.$queryRaw`SELECT id FROM "Generator" WHERE id=${collection.generatorId} FOR UPDATE`;
          const sum = await tx.collection.aggregate({
            where: {
              generatorId: collection.generatorId,
              cooperativeId: context.cooperativeId,
              status: { in: ["COLLECTED", "RECEIVED", "SORTING", "COMPLETED"] },
            },
            _sum: { totalWeightKg: true },
          });
          await tx.generator.update({
            where: { id: collection.generatorId },
            data: { totalKg: sum._sum.totalWeightKg || 0 },
          });
        }
        if (collection.participants.length) {
          await refreshTeamTotals(
            tx,
            collection.participants.map((p) => p.collectorId),
          );
        }
        const differences = items
          .map(
            (i) =>
              `${i.name}: informado ${i.reportedQuantity}, conferido ${i.confirmedQuantity} ${i.unit}`,
          )
          .join("; ");
        await notifyCollection(
          tx,
          collectionId,
          `quantity-review:${collectionId}:${version}`,
          "QUANTITY_REVIEW",
          changed ? "Quantidade recebida ajustada" : "Quantidades conferidas",
          `${differences}. Justificativa: ${reason}`,
          { version, items, reason, actorName: actor.displayName },
        );
        return updated;
      },
      { timeout: 15000 },
    );
  }

  async receive(
    authUserId: string,
    authUserRole: string,
    collectionId: string,
    data: ReceiveCollectionInput,
  ) {
    return this.cooperativeTransition(
      authUserId,
      authUserRole,
      collectionId,
      CollectionStatus.COLLECTED,
      CollectionStatus.RECEIVED,
      {
        receivedAt: normalizeDate(data.receivedAt),
        receivedByUserId: authUserId,
        notes: data.notes !== undefined ? normalizeText(data.notes) : undefined,
      },
    );
  }

  /*
   * ============================================================
   * INÍCIO DA TRIAGEM
   * ============================================================
   */

  async startSorting(
    authUserId: string,
    authUserRole: string,
    collectionId: string,
    data: StartSortingInput,
  ) {
    return this.cooperativeTransition(
      authUserId,
      authUserRole,
      collectionId,
      CollectionStatus.RECEIVED,
      CollectionStatus.SORTING,
      {
        sortingStartedAt: normalizeDate(data.sortingStartedAt),
        sortingStartedByUserId: authUserId,
        notes: data.notes !== undefined ? normalizeText(data.notes) : undefined,
      },
    );
  }

  /*
   * ============================================================
   * CONCLUSÃO OPERACIONAL
   * ============================================================
   */

  async complete(
    authUserId: string,
    authUserRole: string,
    collectionId: string,
    data: CompleteCollectionInput,
  ) {
    const context = await this.getAccessContext(authUserId, authUserRole);

    if (context.role !== "COOPERATIVE") {
      throw new CollectionDomainError(
        "Apenas a cooperativa pode concluir operacionalmente a coleta.",
        { statusCode: 403, code: "ONLY_COOPERATIVE_CAN_COMPLETE" },
      );
    }

    return prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM "Collection" WHERE id = ${collectionId} FOR UPDATE`;
      const collection = await transaction.collection.findFirst({
        where: {
          id: collectionId,
          cooperativeId: context.cooperativeId,
        },
        include: {
          participants: true,
          collectionWasteEntries: {
            select: {
              id: true,
              remainingQuantity: true,
            },
          },
        },
      });

      if (!collection) {
        throw new CollectionDomainError(
          "Coleta não encontrada para esta cooperativa.",
          {
            statusCode: 404,
            code: "COLLECTION_NOT_FOUND",
          },
        );
      }

      if (![CollectionStatus.RECEIVED, CollectionStatus.SORTING].some(status => status === collection.status)) {
        throw new CollectionDomainError("A coleta precisa estar recebida e conferida ou em triagem para ser concluída.", {
          statusCode: 409, code: "INVALID_COLLECTION_TRANSITION",
        });
      }

      if (
        collection.participants.length &&
        (!collection.allocationVersion ||
          collection.allocationQuantityVersion !==
            collection.quantityReviewVersion)
      )
        throw new CollectionDomainError(
          "Confirme a divisão dos materiais entre os participantes antes de concluir.",
          { statusCode: 409, code: "ALLOCATION_REQUIRED" },
        );

      if (collection.collectionWasteEntries.length === 0) {
        throw new CollectionDomainError(
          "A coleta não possui entradas de resíduos.",
          {
            statusCode: 409,
            code: "COLLECTION_WITHOUT_WASTE_ENTRIES",
          },
        );
      }

      const pendingEntries = collection.collectionWasteEntries.filter(
        (entry) => Number(entry.remainingQuantity) > 0,
      );

      if (pendingEntries.length > 0) {
        throw new CollectionDomainError(
          "Ainda existem materiais sem encaminhamento. Registre estoque, triagem, reserva ou uma destinação final para todo o saldo antes de concluir a coleta.",
          {
            statusCode: 409,
            code: "COLLECTION_HAS_PENDING_DESTINATIONS",
            details: {
              pendingEntryIds: pendingEntries.map((entry) => entry.id),
            },
          },
        );
      }

      if (!collection.quantityReviewVersion)
        throw new CollectionDomainError(
          "Registre a conferência antes de concluir.",
          { statusCode: 409, code: "QUANTITY_REVIEW_REQUIRED" },
        );

      if (
        await transaction.collectionIncident.count({
          where: { collectionId, status: "OPEN" },
        })
      )
        throw new CollectionDomainError(
          "Trate as ocorrências abertas antes de concluir a operação.",
          { statusCode: 409, code: "COLLECTION_HAS_OPEN_INCIDENTS" },
        );

      const updated = await transaction.collection.update({
        where: { id: collection.id },
        data: {
          status: CollectionStatus.COMPLETED,
          completedAt: normalizeDate(data.completedAt),
          completedByUserId: authUserId,
          notes:
            data.notes !== undefined
              ? normalizeText(data.notes)
              : collection.notes,
        },
        include: collectionInclude,
      });

      if (collection.scheduleId) {
        await transaction.schedule.update({
          where: { id: collection.scheduleId },
          data: { status: ScheduleStatus.COMPLETED },
        });
      }

      await notifyCollection(
        transaction,
        collectionId,
        `stage:${collectionId}:${updated.status}`,
        "COLLECTION_STAGE",
        "Operação da coleta concluída",
        "A cooperativa atualizou a etapa da sua coleta. Acesse os detalhes para acompanhar.",
      );
      return updated;
    });
  }

  /*
   * ============================================================
   * CANCELAMENTO
   * ============================================================
   */

  async cancel(
    authUserId: string,
    authUserRole: string,
    collectionId: string,
    data: CancelCollectionInput,
  ) {
    const context = await this.getAccessContext(authUserId, authUserRole);

    if (context.role !== "COOPERATIVE") {
      throw new CollectionDomainError(
        "Apenas a cooperativa pode cancelar uma coleta.",
        {
          statusCode: 403,
          code: "ONLY_COOPERATIVE_CAN_CANCEL",
        },
      );
    }

    return prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM "Collection" WHERE id = ${collectionId} FOR UPDATE`;
      const collection = await transaction.collection.findFirst({
        where: {
          id: collectionId,
          cooperativeId: context.cooperativeId,
        },
        include: {
          collectionWasteEntries: { select: { id: true } },
        },
      });

      if (!collection) {
        throw new CollectionDomainError(
          "Coleta não encontrada para esta cooperativa.",
          {
            statusCode: 404,
            code: "COLLECTION_NOT_FOUND",
          },
        );
      }

      if (
        collection.status === CollectionStatus.COMPLETED ||
        collection.status === CollectionStatus.CANCELLED
      ) {
        throw new CollectionDomainError(
          "Não é possível cancelar uma coleta já encerrada.",
          {
            statusCode: 409,
            code: "COLLECTION_ALREADY_CLOSED",
          },
        );
      }

      if (collection.collectionWasteEntries.length > 0) {
        throw new CollectionDomainError(
          "Não é possível cancelar uma coleta que já possui entradas de resíduos.",
          { statusCode: 409, code: "COLLECTION_HAS_WASTE_ENTRIES" },
        );
      }

      const updated = await transaction.collection.update({
        where: { id: collection.id },
        data: {
          status: CollectionStatus.CANCELLED,
          cancelledAt: normalizeDate(data.cancelledAt),
          cancelledByUserId: authUserId,
          cancellationReason: normalizeText(data.cancellationReason),
        },
        include: collectionInclude,
      });

      if (collection.collectorId) {
        await transaction.$queryRaw`SELECT id FROM "Collector" WHERE id = ${collection.collectorId} FOR UPDATE`;
        const collectorState = await transaction.collector.findUniqueOrThrow({
          where: { id: collection.collectorId },
        });
        await transaction.collector.update({
          where: { id: collection.collectorId },
          data: {
            status:
              collectorState.status === CollectorStatus.INACTIVE
                ? CollectorStatus.INACTIVE
                : (await transaction.collection.count({
                      where: {
                        collectorId: collection.collectorId,
                        status: CollectionStatus.IN_PROGRESS,
                      },
                    })) > 0
                  ? CollectorStatus.ON_ROUTE
                  : CollectorStatus.AVAILABLE,
          },
        });
      }

      if (collection.scheduleId) {
        await transaction.schedule.update({
          where: { id: collection.scheduleId },
          data: { status: ScheduleStatus.CANCELLED },
        });
      }

      await notifyCollection(
        transaction,
        collectionId,
        `stage:${collectionId}:${updated.status}`,
        "COLLECTION_STAGE",
        "Coleta cancelada",
        "A cooperativa atualizou a etapa da sua coleta. Acesse os detalhes para acompanhar.",
      );
      const participants = await transaction.collectionParticipant.findMany({
        where: { collectionId },
        select: { collectorId: true },
      });
      if (participants.length)
        await refreshTeamTotals(
          transaction,
          participants.map((p) => p.collectorId),
        );
      return updated;
    });
  }

  /*
   * ============================================================
   * ATUALIZAÇÃO DE STATUS — COMPATIBILIDADE LEGADA
   * ============================================================
   */

  async reportIncident(
    authUserId: string,
    authUserRole: string,
    collectionId: string,
    data: { description: string; operationId?: string },
  ) {
    const context = await this.getAccessContext(authUserId, authUserRole);
    if (!["COLLECTOR", "COOPERATIVE"].includes(context.role))
      throw new CollectionDomainError(
        "Perfil sem permissão para registrar esta ocorrência.",
        { statusCode: 403, code: "INCIDENT_ACCESS_DENIED" },
      );
    return prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM "Collection" WHERE id = ${collectionId} FOR UPDATE`;
      const collection = await transaction.collection.findFirst({
        where: {
          id: collectionId,
          cooperativeId: context.cooperativeId,
          ...(context.role === "COLLECTOR"
            ? {
                OR: [
                  { collectorId: context.collectorId },
                  {
                    participants: {
                      some: { collectorId: context.collectorId },
                    },
                  },
                ],
              }
            : {}),
        },
      });
      if (!collection)
        throw new CollectionDomainError(
          "Coleta não encontrada para este usuário.",
          { statusCode: 404, code: "COLLECTION_NOT_FOUND" },
        );
      const prior = data.operationId
        ? await transaction.collectionIncident.findFirst({
            where: {
              collectionId,
              reportedByUserId: authUserId,
              operationId: data.operationId,
            },
          })
        : null;
      if (prior && prior.description !== data.description)
        throw new CollectionDomainError(
          "Operação já utilizada com outra descrição.",
          { statusCode: 409, code: "INCIDENT_PAYLOAD_CONFLICT" },
        );
      const actor = await transaction.user.findUnique({
        where: { id: authUserId },
        select: { displayName: true, email: true },
      });
      if (!prior)
        await transaction.collectionIncident.create({
          data: {
            ...data,
            collectionId,
            cooperativeId: collection.cooperativeId,
            reportedByUserId: authUserId,
            reportedByName: actor?.displayName || actor?.email,
          },
        });
      return transaction.collection.findUniqueOrThrow({
        where: { id: collectionId },
        include: collectionInclude,
      });
    });
  }

  async resolveIncident(
    authUserId: string,
    authUserRole: string,
    collectionId: string,
    incidentId: string,
    resolution: string,
  ) {
    const context = await this.getAccessContext(authUserId, authUserRole);
    if (context.role !== "COOPERATIVE")
      throw new CollectionDomainError(
        "Somente a cooperativa pode concluir o tratamento.",
        { statusCode: 403, code: "INCIDENT_RESOLUTION_DENIED" },
      );
    return prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM "Collection" WHERE id = ${collectionId} FOR UPDATE`;
      const incident = await transaction.collectionIncident.findFirst({
        where: {
          id: incidentId,
          collectionId,
          cooperativeId: context.cooperativeId,
        },
      });
      if (!incident)
        throw new CollectionDomainError("Ocorrência não encontrada.", {
          statusCode: 404,
          code: "INCIDENT_NOT_FOUND",
        });
      if (incident.status !== "OPEN")
        throw new CollectionDomainError("Esta ocorrência já foi tratada.", {
          statusCode: 409,
          code: "INCIDENT_ALREADY_RESOLVED",
        });
      const actor = await transaction.user.findUnique({
        where: { id: authUserId },
        select: { displayName: true, email: true },
      });
      await transaction.collectionIncident.update({
        where: { id: incident.id },
        data: {
          status: "RESOLVED",
          resolution,
          resolvedAt: new Date(),
          resolvedByUserId: authUserId,
          resolvedByName: actor?.displayName || actor?.email,
        },
      });
      return transaction.collection.findUniqueOrThrow({
        where: { id: collectionId },
        include: collectionInclude,
      });
    });
  }

  async updateStatus(
    authUserId: string,
    authUserRole: string,
    collectionId: string,
    data: UpdateCollectionStatusInput,
  ) {
    switch (data.status) {
      case CollectionStatus.IN_PROGRESS:
        return this.start(authUserId, authUserRole, collectionId, {
          notes: data.notes,
        });
      case CollectionStatus.COLLECTED:
        return this.completeField(authUserId, authUserRole, collectionId, {
          collectedAt: data.collectedAt,
          materials: data.materials || [],
          totalWeightKg: data.totalWeightKg,
          notes: data.notes,
        });
      case CollectionStatus.RECEIVED:
        return this.receive(authUserId, authUserRole, collectionId, {
          notes: data.notes,
        });
      case CollectionStatus.SORTING:
        return this.startSorting(authUserId, authUserRole, collectionId, {
          notes: data.notes,
        });
      case CollectionStatus.COMPLETED:
        return this.complete(authUserId, authUserRole, collectionId, {
          notes: data.notes,
        });
      case CollectionStatus.CANCELLED:
        return this.cancel(authUserId, authUserRole, collectionId, {
          cancellationReason:
            data.cancellationReason ||
            "Cancelamento solicitado pela rota legada.",
        });
      case CollectionStatus.PENDING:
        throw new CollectionDomainError(
          "Não é permitido retornar uma coleta para PENDING.",
          {
            statusCode: 409,
            code: "COLLECTION_CANNOT_RETURN_TO_PENDING",
          },
        );
      default:
        throw new CollectionDomainError("Status de coleta não suportado.", {
          statusCode: 400,
          code: "UNSUPPORTED_COLLECTION_STATUS",
        });
    }
  }
}
