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

function isGeneratorRole(role: string): role is "GENERATOR_SMALL" | "GENERATOR_LARGE" {
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
  generator: true,
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
    authUserRole: string
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
        throw new CollectionDomainError("Cooperativa do usuário autenticado não encontrada.", {
          statusCode: 404,
          code: "COOPERATIVE_NOT_FOUND",
        });
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
        select: { id: true, cooperativeId: true },
      });

      if (!collector) {
        throw new CollectionDomainError("Catador do usuário autenticado não encontrado.", {
          statusCode: 404,
          code: "COLLECTOR_NOT_FOUND",
        });
      }

      if (!collector.cooperativeId) {
        throw new CollectionDomainError("O catador não está vinculado a uma cooperativa.", {
          statusCode: 403,
          code: "COLLECTOR_WITHOUT_COOPERATIVE",
        });
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
        throw new CollectionDomainError("Motorista do usuário autenticado não encontrado.", {
          statusCode: 404,
          code: "DRIVER_NOT_FOUND",
        });
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
        throw new CollectionDomainError("Gerador do usuário autenticado não encontrado.", {
          statusCode: 404,
          code: "GENERATOR_NOT_FOUND",
        });
      }

      return {
        userId: authUserId,
        role: role === UserRole.GENERATOR_SMALL ? "GENERATOR_SMALL" : "GENERATOR_LARGE",
        cooperativeId: generator.cooperativeId!,
        generatorId: generator.id,
      };
    }

    throw new CollectionDomainError("Usuário sem permissão para acessar coletas.", {
      statusCode: 403,
      code: "COLLECTION_ACCESS_DENIED",
    });
  }

  /*
   * ============================================================
   * TRANSIÇÕES
   * ============================================================
   */

  private assertTransition(
    currentStatus: CollectionStatus,
    expectedStatus: CollectionStatus,
    targetStatus: CollectionStatus
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
        }
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
    materialsInput: CollectionMaterialSchemaInput[]
  ): Promise<NormalizedCollectionMaterial[]> {
    if (!Array.isArray(materialsInput) || materialsInput.length === 0) {
      throw new CollectionDomainError("Informe ao menos um material coletado.", {
        statusCode: 400,
        code: "COLLECTION_MATERIALS_REQUIRED",
      });
    }

    const wasteTypeIds = Array.from(
      new Set(
        materialsInput
          .map((material) => normalizeText(material.wasteTypeId))
          .filter((value): value is string => Boolean(value))
      )
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
        }
      );
    }

    const wasteTypesMap = new Map(wasteTypes.map((item) => [item.id, item]));
    const keys = new Set<string>();

    const normalized = materialsInput.map((material, index): NormalizedCollectionMaterial => {
      const wasteTypeId = normalizeText(material.wasteTypeId);
      const catalogItem = wasteTypeId ? wasteTypesMap.get(wasteTypeId) : undefined;
      const quantity = Number(material.quantity);

      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new CollectionDomainError(
          `A quantidade do material na posição ${index + 1} deve ser maior que zero.`,
          {
            statusCode: 400,
            code: "INVALID_MATERIAL_QUANTITY",
          }
        );
      }

      const proposed = material.proposedMaterial;
      const name = catalogItem?.name || normalizeText(proposed?.name);

      if (!name) {
        throw new CollectionDomainError(`Informe o nome do material na posição ${index + 1}.`, {
          statusCode: 400,
          code: "MATERIAL_NAME_REQUIRED",
        });
      }

      const unit =
        material.unit ||
        proposed?.unit ||
        catalogItem?.unit ||
        catalogItem?.defaultUnit ||
        WasteUnit.KG;

      return {
        wasteTypeId: catalogItem?.id || null,
        name,
        category: catalogItem?.category || normalizeText(proposed?.category),
        subcategory: catalogItem?.subcategory || normalizeText(proposed?.subcategory),
        quantity,
        quantityKg: quantityToKg(quantity, unit),
        unit,
        notes: normalizeText(material.notes),
      };
    });

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
          }
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
    collectedAt: Date
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

  /*
   * ============================================================
   * CRIAÇÃO E DELEGAÇÃO
   * ============================================================
   */

  async create(authUserId: string, authUserRole: string, data: CreateCollectionInput) {
    if (normalizeRole(authUserRole) !== UserRole.COOPERATIVE) {
      throw new CollectionDomainError("Apenas cooperativas podem delegar coletas.", {
        statusCode: 403,
        code: "ONLY_COOPERATIVE_CAN_CREATE_COLLECTION",
      });
    }

    const context = await this.getAccessContext(authUserId, authUserRole);

    if (context.role !== "COOPERATIVE") {
      throw new CollectionDomainError("Cooperativa não identificada.", {
        statusCode: 403,
        code: "COOPERATIVE_CONTEXT_REQUIRED",
      });
    }

    return prisma.$transaction(async (transaction) => {
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
        throw new CollectionDomainError("Agendamento não encontrado para esta cooperativa.", {
          statusCode: 404,
          code: "SCHEDULE_NOT_FOUND",
        });
      }

      if (
        schedule.status === ScheduleStatus.CANCELLED ||
        schedule.status === ScheduleStatus.COMPLETED
      ) {
        throw new CollectionDomainError("Não é possível delegar um agendamento encerrado.", {
          statusCode: 409,
          code: "SCHEDULE_ALREADY_CLOSED",
        });
      }

      if (schedule.collections.length > 0) {
        throw new CollectionDomainError("Este agendamento já possui uma coleta vinculada.", {
          statusCode: 409,
          code: "SCHEDULE_ALREADY_HAS_COLLECTION",
        });
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
          { statusCode: 404, code: "COLLECTOR_UNAVAILABLE" }
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
          throw new CollectionDomainError("Motorista não encontrado ou indisponível.", {
            statusCode: 404,
            code: "DRIVER_UNAVAILABLE",
          });
        }
        driverId = driver.id;
      }

      if (data.vehicleId) {
        const vehicle = await transaction.vehicle.findFirst({
          where: {
            id: data.vehicleId,
            cooperativeId: context.cooperativeId,
            status: { not: VehicleStatus.INACTIVE },
          },
        });

        if (!vehicle) {
          throw new CollectionDomainError("Veículo não encontrado ou indisponível.", {
            statusCode: 404,
            code: "VEHICLE_UNAVAILABLE",
          });
        }

        if (driverId && vehicle.driverId && vehicle.driverId !== driverId) {
          throw new CollectionDomainError("O veículo informado está vinculado a outro motorista.", {
            statusCode: 409,
            code: "VEHICLE_DRIVER_CONFLICT",
          });
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
          throw new CollectionDomainError("Rota não encontrada ou indisponível.", {
            statusCode: 404,
            code: "ROUTE_UNAVAILABLE",
          });
        }

        if (driverId && route.driverId && route.driverId !== driverId) {
          throw new CollectionDomainError("A rota informada pertence a outro motorista.", {
            statusCode: 409,
            code: "ROUTE_DRIVER_CONFLICT",
          });
        }

        if (vehicleId && route.vehicleId && route.vehicleId !== vehicleId) {
          throw new CollectionDomainError("A rota informada pertence a outro veículo.", {
            statusCode: 409,
            code: "ROUTE_VEHICLE_CONFLICT",
          });
        }

        driverId = driverId || route.driverId || null;
        vehicleId = vehicleId || route.vehicleId || null;
        routeId = route.id;
      }

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

  async listMine(authUserId: string, authUserRole: string) {
    const context = await this.getAccessContext(authUserId, authUserRole);
    let where: Prisma.CollectionWhereInput;

    switch (context.role) {
      case "COOPERATIVE":
        where = { cooperativeId: context.cooperativeId };
        break;
      case "COLLECTOR":
        where = { collectorId: context.collectorId };
        break;
      case "DRIVER":
        where = { driverId: context.driverId };
        break;
      case "GENERATOR_SMALL":
      case "GENERATOR_LARGE":
        where = { generatorId: context.generatorId };
        break;
      default:
        throw new CollectionDomainError("Usuário sem permissão para listar coletas.", {
          statusCode: 403,
          code: "COLLECTION_LIST_DENIED",
        });
    }

    return prisma.collection.findMany({
      where,
      include: collectionInclude,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
  }

  /*
   * ============================================================
   * CONSULTA POR ID
   * ============================================================
   */

  async findById(authUserId: string, authUserRole: string, collectionId: string) {
    const context = await this.getAccessContext(authUserId, authUserRole);

    let where: Prisma.CollectionWhereInput = {
      id: collectionId,
      cooperativeId: context.cooperativeId,
    };

    switch (context.role) {
      case "COOPERATIVE":
        break;
      case "COLLECTOR":
        where = { ...where, collectorId: context.collectorId };
        break;
      case "DRIVER":
        where = { ...where, driverId: context.driverId };
        break;
      case "GENERATOR_SMALL":
      case "GENERATOR_LARGE":
        where = { ...where, generatorId: context.generatorId };
        break;
      default:
        throw new CollectionDomainError("Usuário sem permissão para consultar coleta.", {
          statusCode: 403,
          code: "COLLECTION_FIND_DENIED",
        });
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

    return collection;
  }

  /*
   * ============================================================
   * INÍCIO DA COLETA PELO CATADOR
   * ============================================================
   */

  async start(
    authUserId: string,
    authUserRole: string,
    collectionId: string,
    data: StartCollectionInput
  ) {
    const context = await this.getAccessContext(authUserId, authUserRole);

    if (context.role !== "COLLECTOR") {
      throw new CollectionDomainError("Apenas o catador responsável pode iniciar a coleta.", {
        statusCode: 403,
        code: "ONLY_COLLECTOR_CAN_START",
      });
    }

    const collectorId = context.collectorId;

    return prisma.$transaction(async (transaction) => {
      const collection = await transaction.collection.findFirst({
        where: {
          id: collectionId,
          collectorId,
          cooperativeId: context.cooperativeId,
        },
      });

      if (!collection) {
        throw new CollectionDomainError("Coleta não encontrada para este catador.", {
          statusCode: 404,
          code: "COLLECTION_NOT_FOUND",
        });
      }

      this.assertTransition(collection.status, CollectionStatus.PENDING, CollectionStatus.IN_PROGRESS);

      await transaction.collector.update({
        where: { id: collectorId },
        data: { status: CollectorStatus.ON_ROUTE },
      });

      if (collection.scheduleId) {
        await transaction.schedule.update({
          where: { id: collection.scheduleId },
          data: { status: ScheduleStatus.IN_PROGRESS },
        });
      }

      return transaction.collection.update({
        where: { id: collection.id },
        data: {
          status: CollectionStatus.IN_PROGRESS,
          startedAt: normalizeDate(data.startedAt),
          startedByUserId: authUserId,
          notes: data.notes !== undefined ? normalizeText(data.notes) : collection.notes,
        },
        include: collectionInclude,
      });
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
    data: CompleteFieldCollectionInput
  ) {
    const context = await this.getAccessContext(authUserId, authUserRole);

    if (context.role !== "COLLECTOR") {
      throw new CollectionDomainError(
        "Apenas o catador responsável pode concluir a etapa de campo.",
        { statusCode: 403, code: "ONLY_COLLECTOR_CAN_COMPLETE_FIELD" }
      );
    }

    const collectorId = context.collectorId;

    return prisma.$transaction(async (transaction) => {
      const collection = await transaction.collection.findFirst({
        where: {
          id: collectionId,
          collectorId,
          cooperativeId: context.cooperativeId,
        },
        include: {
          collectionMaterials: { select: { id: true } },
        },
      });

      if (!collection) {
        throw new CollectionDomainError("Coleta não encontrada para este catador.", {
          statusCode: 404,
          code: "COLLECTION_NOT_FOUND",
        });
      }

      this.assertTransition(collection.status, CollectionStatus.IN_PROGRESS, CollectionStatus.COLLECTED);

      if (collection.collectionMaterials.length > 0) {
        throw new CollectionDomainError("Os materiais desta coleta já foram registrados.", {
          statusCode: 409,
          code: "COLLECTION_MATERIALS_ALREADY_CREATED",
        });
      }

      const normalizedMaterials = await this.normalizeMaterials(
        transaction,
        collection.cooperativeId,
        data.materials
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
        collectedAt
      );

      const totalWeightKg =
        data.totalWeightKg ??
        normalizedMaterials.reduce((total, material) => total + material.quantityKg, 0);

      const updated = await transaction.collection.update({
        where: { id: collection.id },
        data: {
          status: CollectionStatus.COLLECTED,
          collectedAt,
          fieldCompletedByUserId: authUserId,
          totalWeightKg,
          materials: normalizedMaterials as unknown as Prisma.InputJsonValue,
          notes: data.notes !== undefined ? normalizeText(data.notes) : collection.notes,
        },
        include: collectionInclude,
      });

      await transaction.collector.update({
        where: { id: collectorId },
        data: {
          status: CollectorStatus.AVAILABLE,
          totalKg: { increment: totalWeightKg },
          kgMonth: { increment: totalWeightKg },
          collectionsToday: { increment: 1 },
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
    data: Prisma.CollectionUncheckedUpdateInput
  ) {
    const context = await this.getAccessContext(authUserId, authUserRole);

    if (context.role !== "COOPERATIVE") {
      throw new CollectionDomainError("Apenas a cooperativa pode executar esta operação.", {
        statusCode: 403,
        code: "ONLY_COOPERATIVE_CAN_TRANSITION",
      });
    }

    return prisma.$transaction(async (transaction) => {
      const collection = await transaction.collection.findFirst({
        where: {
          id: collectionId,
          cooperativeId: context.cooperativeId,
        },
      });

      if (!collection) {
        throw new CollectionDomainError("Coleta não encontrada para esta cooperativa.", {
          statusCode: 404,
          code: "COLLECTION_NOT_FOUND",
        });
      }

      this.assertTransition(collection.status, expectedStatus, targetStatus);

      return transaction.collection.update({
        where: { id: collection.id },
        data: {
          ...data,
          status: targetStatus,
        },
        include: collectionInclude,
      });
    });
  }

  /*
   * ============================================================
   * RECEBIMENTO
   * ============================================================
   */

  async receive(
    authUserId: string,
    authUserRole: string,
    collectionId: string,
    data: ReceiveCollectionInput
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
      }
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
    data: StartSortingInput
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
      }
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
    data: CompleteCollectionInput
  ) {
    const context = await this.getAccessContext(authUserId, authUserRole);

    if (context.role !== "COOPERATIVE") {
      throw new CollectionDomainError(
        "Apenas a cooperativa pode concluir operacionalmente a coleta.",
        { statusCode: 403, code: "ONLY_COOPERATIVE_CAN_COMPLETE" }
      );
    }

    return prisma.$transaction(async (transaction) => {
      const collection = await transaction.collection.findFirst({
        where: {
          id: collectionId,
          cooperativeId: context.cooperativeId,
        },
        include: {
          collectionWasteEntries: {
            select: {
              id: true,
              remainingQuantity: true,
            },
          },
        },
      });

      if (!collection) {
        throw new CollectionDomainError("Coleta não encontrada para esta cooperativa.", {
          statusCode: 404,
          code: "COLLECTION_NOT_FOUND",
        });
      }

      this.assertTransition(collection.status, CollectionStatus.SORTING, CollectionStatus.COMPLETED);

      if (collection.collectionWasteEntries.length === 0) {
        throw new CollectionDomainError("A coleta não possui entradas de resíduos.", {
          statusCode: 409,
          code: "COLLECTION_WITHOUT_WASTE_ENTRIES",
        });
      }

      const pendingEntries = collection.collectionWasteEntries.filter(
        (entry) => Number(entry.remainingQuantity) > 0
      );

      if (pendingEntries.length > 0) {
        throw new CollectionDomainError("Ainda existem resíduos com saldo pendente de destinação.", {
          statusCode: 409,
          code: "COLLECTION_HAS_PENDING_DESTINATIONS",
          details: {
            pendingEntryIds: pendingEntries.map((entry) => entry.id),
          },
        });
      }

      const updated = await transaction.collection.update({
        where: { id: collection.id },
        data: {
          status: CollectionStatus.COMPLETED,
          completedAt: normalizeDate(data.completedAt),
          completedByUserId: authUserId,
          notes: data.notes !== undefined ? normalizeText(data.notes) : collection.notes,
        },
        include: collectionInclude,
      });

      if (collection.scheduleId) {
        await transaction.schedule.update({
          where: { id: collection.scheduleId },
          data: { status: ScheduleStatus.COMPLETED },
        });
      }

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
    data: CancelCollectionInput
  ) {
    const context = await this.getAccessContext(authUserId, authUserRole);

    if (context.role !== "COOPERATIVE") {
      throw new CollectionDomainError("Apenas a cooperativa pode cancelar uma coleta.", {
        statusCode: 403,
        code: "ONLY_COOPERATIVE_CAN_CANCEL",
      });
    }

    return prisma.$transaction(async (transaction) => {
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
        throw new CollectionDomainError("Coleta não encontrada para esta cooperativa.", {
          statusCode: 404,
          code: "COLLECTION_NOT_FOUND",
        });
      }

      if (
        collection.status === CollectionStatus.COMPLETED ||
        collection.status === CollectionStatus.CANCELLED
      ) {
        throw new CollectionDomainError("Não é possível cancelar uma coleta já encerrada.", {
          statusCode: 409,
          code: "COLLECTION_ALREADY_CLOSED",
        });
      }

      if (collection.collectionWasteEntries.length > 0) {
        throw new CollectionDomainError(
          "Não é possível cancelar uma coleta que já possui entradas de resíduos.",
          { statusCode: 409, code: "COLLECTION_HAS_WASTE_ENTRIES" }
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
        await transaction.collector.update({
          where: { id: collection.collectorId },
          data: { status: CollectorStatus.AVAILABLE },
        });
      }

      if (collection.scheduleId) {
        await transaction.schedule.update({
          where: { id: collection.scheduleId },
          data: { status: ScheduleStatus.CANCELLED },
        });
      }

      return updated;
    });
  }

  /*
   * ============================================================
   * ATUALIZAÇÃO DE STATUS — COMPATIBILIDADE LEGADA
   * ============================================================
   */

  async updateStatus(
    authUserId: string,
    authUserRole: string,
    collectionId: string,
    data: UpdateCollectionStatusInput
  ) {
    switch (data.status) {
      case CollectionStatus.IN_PROGRESS:
        return this.start(authUserId, authUserRole, collectionId, { notes: data.notes });
      case CollectionStatus.COLLECTED:
        return this.completeField(authUserId, authUserRole, collectionId, {
          collectedAt: data.collectedAt,
          materials: data.materials || [],
          totalWeightKg: data.totalWeightKg,
          notes: data.notes,
        });
      case CollectionStatus.RECEIVED:
        return this.receive(authUserId, authUserRole, collectionId, { notes: data.notes });
      case CollectionStatus.SORTING:
        return this.startSorting(authUserId, authUserRole, collectionId, { notes: data.notes });
      case CollectionStatus.COMPLETED:
        return this.complete(authUserId, authUserRole, collectionId, { notes: data.notes });
      case CollectionStatus.CANCELLED:
        return this.cancel(authUserId, authUserRole, collectionId, {
          cancellationReason: data.cancellationReason || "Cancelamento solicitado pela rota legada.",
        });
      case CollectionStatus.PENDING:
        throw new CollectionDomainError("Não é permitido retornar uma coleta para PENDING.", {
          statusCode: 409,
          code: "COLLECTION_CANNOT_RETURN_TO_PENDING",
        });
      default:
        throw new CollectionDomainError("Status de coleta não suportado.", {
          statusCode: 400,
          code: "UNSUPPORTED_COLLECTION_STATUS",
        });
    }
  }
}