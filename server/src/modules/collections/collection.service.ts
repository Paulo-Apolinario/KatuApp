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
  WasteStockStatus,
  WasteUnit,
} from "@prisma/client";

import { prisma } from "../../lib/prisma";

import type {
  CreateCollectionInput,
  UpdateCollectionStatusInput,
} from "./collection.schemas";

import {
  CollectionDomainError,
  type CollectionAccessContext,
  type CollectionWeightSummary,
  type NormalizedCollectionMaterial,
} from "./collection.types";

/*
 * ============================================================
 * TIPOS INTERNOS
 * ============================================================
 */

type MaterialPayload = {
  wasteTypeId?: string;
  type?: string;
  name?: string;
  category?: string;
  subcategory?: string;
  quantity?: number;
  quantityKg?: number;
  unit?: WasteUnit;
};

type TransactionClient = Prisma.TransactionClient;

type CollectionRecordForUpdate = Prisma.CollectionGetPayload<{
  include: {
    schedule: true;
    collectionMaterials: {
      include: {
        wasteEntry: {
          include: {
            destinations: true;
          };
        };
      };
    };
  };
}>;

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
  zipCode: true,
  street: true,
  number: true,
  neighborhood: true,
  city: true,
  state: true,
  address: true,
  latitude: true,
  longitude: true,
  createdAt: true,
  updatedAt: true,
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
  zipCode: true,
  street: true,
  number: true,
  neighborhood: true,
  city: true,
  state: true,
  address: true,
  latitude: true,
  longitude: true,
  status: true,
  accessReleased: true,
  accessStatus: true,
  totalKg: true,
  createdAt: true,
  updatedAt: true,
  activatedAt: true,

  user: {
    select: userSelect,
  },

  cooperative: {
    select: cooperativeSelect,
  },
} satisfies Prisma.GeneratorSelect;

const collectionInclude = {
  generator: {
    select: generatorSelect,
  },

  collector: {
    include: {
      user: {
        select: userSelect,
      },

      cooperative: {
        select: cooperativeSelect,
      },
    },
  },

  driver: {
    include: {
      cooperative: {
        select: cooperativeSelect,
      },
    },
  },

  vehicle: {
    include: {
      cooperative: {
        select: cooperativeSelect,
      },

      driver: {
        select: {
          id: true,
          name: true,
          phone: true,
          status: true,
        },
      },
    },
  },

  route: {
    include: {
      driver: {
        select: {
          id: true,
          name: true,
          phone: true,
          status: true,
        },
      },

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

      cooperative: {
        select: cooperativeSelect,
      },
    },
  },

  schedule: {
    include: {
      requestedBy: {
        select: userSelect,
      },

      generator: {
        select: generatorSelect,
      },

      cooperative: {
        include: {
          user: {
            select: userSelect,
          },
        },
      },
    },
  },

  collectionMaterials: {
    include: {
      wasteType: true,

      wasteEntry: {
        include: {
          destinations: {
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
 * FUNÇÕES AUXILIARES
 * ============================================================
 */

function isGeneratorRole(role: string) {
  return (
    role === UserRole.GENERATOR_SMALL ||
    role === UserRole.GENERATOR_LARGE
  );
}

function normalizeText(value?: string | null) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();

  return normalized || null;
}

function normalizeRole(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function normalizeQuantity(value: unknown) {
  const quantity = Number(value);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new CollectionDomainError(
      "A quantidade do material deve ser maior que zero.",
      {
        statusCode: 400,
        code: "INVALID_MATERIAL_QUANTITY",
      }
    );
  }

  return quantity;
}

function normalizeUnit(
  unit?: WasteUnit | null,
  hasLegacyQuantityKg = false
): WasteUnit {
  if (hasLegacyQuantityKg) {
    return WasteUnit.KG;
  }

  return unit || WasteUnit.KG;
}

function quantityToKg(
  quantity: number,
  unit: WasteUnit
) {
  if (unit === WasteUnit.KG) {
    return quantity;
  }

  if (unit === WasteUnit.TON) {
    return quantity * 1000;
  }

  return 0;
}

function calculateWeightSummary(
  materials: NormalizedCollectionMaterial[]
): CollectionWeightSummary {
  const totalsByUnit: Partial<
    Record<WasteUnit, number>
  > = {};

  let totalWeightKg = 0;

  for (const material of materials) {
    totalsByUnit[material.unit] =
      Number(totalsByUnit[material.unit] || 0) +
      material.quantity;

    totalWeightKg += quantityToKg(
      material.quantity,
      material.unit
    );
  }

  return {
    totalWeightKg,
    totalsByUnit,
  };
}

function toLegacyMaterialJson(
  materials: NormalizedCollectionMaterial[]
): Prisma.InputJsonValue {
  return materials.map((material) => ({
    wasteTypeId: material.wasteTypeId,
    type: material.name,
    name: material.name,
    category: material.category,
    subcategory: material.subcategory,
    quantity: material.quantity,
    quantityKg: material.quantityKg,
    unit: material.unit,
  })) as Prisma.InputJsonValue;
}

function normalizeLegacyMaterials(
  materials: unknown
): MaterialPayload[] {
  if (!Array.isArray(materials)) {
    return [];
  }

  return materials.map((item: any) => ({
    wasteTypeId:
      normalizeText(item?.wasteTypeId) || undefined,

    type:
      normalizeText(item?.type) || undefined,

    name:
      normalizeText(item?.name) || undefined,

    category:
      normalizeText(item?.category) || undefined,

    subcategory:
      normalizeText(item?.subcategory) || undefined,

    quantity:
      item?.quantity !== undefined
        ? Number(item.quantity)
        : undefined,

    quantityKg:
      item?.quantityKg !== undefined
        ? Number(item.quantityKg)
        : undefined,

    unit:
      item?.unit &&
      Object.values(WasteUnit).includes(
        String(item.unit).toUpperCase() as WasteUnit
      )
        ? (String(item.unit).toUpperCase() as WasteUnit)
        : undefined,
  }));
}

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
      throw new CollectionDomainError(
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
        throw new CollectionDomainError(
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
    throw new CollectionDomainError(
      "Catador do usuário autenticado não encontrado.",
      {
        statusCode: 404,
        code: "COLLECTOR_NOT_FOUND",
      }
    );
  }

  if (!collector.cooperativeId) {
    throw new CollectionDomainError(
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
    cooperativeId: collector.cooperativeId,
    collectorId: collector.id,
  };
}

    if (role === UserRole.DRIVER) {
      const driver = await prisma.driver.findUnique({
        where: {
          userId: authUserId,
        },

        select: {
          id: true,
          cooperativeId: true,
        },
      });

      if (!driver) {
        throw new CollectionDomainError(
          "Motorista do usuário autenticado não encontrado.",
          {
            statusCode: 404,
            code: "DRIVER_NOT_FOUND",
          }
        );
      }

      return {
        userId: authUserId,
        role,
        cooperativeId: driver.cooperativeId,
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
        throw new CollectionDomainError(
          "Gerador do usuário autenticado não encontrado.",
          {
            statusCode: 404,
            code: "GENERATOR_NOT_FOUND",
          }
        );
      }

      if (!generator.cooperativeId) {
        throw new CollectionDomainError(
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
        cooperativeId: generator.cooperativeId,
        generatorId: generator.id,
      };
    }

    throw new CollectionDomainError(
      "Usuário sem permissão para acessar coletas.",
      {
        statusCode: 403,
        code: "COLLECTION_ACCESS_DENIED",
      }
    );
  }

  /*
   * ============================================================
   * NORMALIZAÇÃO DOS MATERIAIS
   * ============================================================
   */

  private async normalizeMaterials(
    transaction: TransactionClient,
    cooperativeId: string,
    materialsInput: MaterialPayload[]
  ): Promise<NormalizedCollectionMaterial[]> {
    if (!materialsInput.length) {
      return [];
    }

    const wasteTypeIds = Array.from(
      new Set(
        materialsInput
          .map((material) =>
            normalizeText(material.wasteTypeId)
          )
          .filter(
            (value): value is string =>
              typeof value === "string" &&
              value.length > 0
          )
      )
    );

    const wasteTypes =
      wasteTypeIds.length > 0
        ? await transaction.wasteStockItem.findMany({
            where: {
              id: {
                in: wasteTypeIds,
              },

              cooperativeId,

              status: WasteStockStatus.ACTIVE,
            },

            select: {
              id: true,
              cooperativeId: true,
              name: true,
              category: true,
              subcategory: true,
              unit: true,
            },
          })
        : [];

    const wasteTypesMap = new Map(
      wasteTypes.map((wasteType) => [
        wasteType.id,
        wasteType,
      ])
    );

    if (wasteTypes.length !== wasteTypeIds.length) {
      const foundIds = new Set(
        wasteTypes.map((wasteType) => wasteType.id)
      );

      const missingIds = wasteTypeIds.filter(
        (id) => !foundIds.has(id)
      );

      throw new CollectionDomainError(
        "Um ou mais tipos de resíduos não foram encontrados no catálogo ativo da cooperativa.",
        {
          statusCode: 400,
          code: "INVALID_WASTE_TYPES",
          details: {
            wasteTypeIds: missingIds,
          },
        }
      );
    }

    const normalizedMaterials =
      materialsInput.map((material, index) => {
        const wasteTypeId =
          normalizeText(material.wasteTypeId);

        const catalogItem = wasteTypeId
          ? wasteTypesMap.get(wasteTypeId)
          : undefined;

        const hasLegacyQuantityKg =
          material.quantity === undefined &&
          material.quantityKg !== undefined;

        const quantity = normalizeQuantity(
          material.quantity ??
            material.quantityKg
        );

        const unit = normalizeUnit(
          material.unit || catalogItem?.unit,
          hasLegacyQuantityKg
        );

        const providedName =
          normalizeText(material.name) ||
          normalizeText(material.type);

        const name =
          catalogItem?.name ||
          providedName;

        if (!name) {
          throw new CollectionDomainError(
            `Informe o nome ou o tipo do material na posição ${
              index + 1
            }.`,
            {
              statusCode: 400,
              code: "MATERIAL_NAME_REQUIRED",
              details: {
                index,
              },
            }
          );
        }

        const category =
          catalogItem?.category ||
          normalizeText(material.category);

        const subcategory =
          catalogItem?.subcategory ||
          normalizeText(material.subcategory);

        return {
          wasteTypeId:
            catalogItem?.id || wasteTypeId || null,

          name,

          category,
          subcategory,

          quantity,

          quantityKg: quantityToKg(
            quantity,
            unit
          ),

          unit,
        };
      });

    this.ensureNoDuplicateMaterials(
      normalizedMaterials
    );

    return normalizedMaterials;
  }

  private ensureNoDuplicateMaterials(
    materials: NormalizedCollectionMaterial[]
  ) {
    const keys = new Set<string>();

    for (const material of materials) {
      const key = material.wasteTypeId
        ? `catalog:${material.wasteTypeId}:${material.unit}`
        : `name:${material.name
            .trim()
            .toLocaleLowerCase(
              "pt-BR"
            )}:${material.unit}`;

      if (keys.has(key)) {
        throw new CollectionDomainError(
          `O material "${material.name}" foi informado mais de uma vez com a mesma unidade.`,
          {
            statusCode: 400,
            code: "DUPLICATE_COLLECTION_MATERIAL",
            details: {
              material: material.name,
              unit: material.unit,
            },
          }
        );
      }

      keys.add(key);
    }
  }

  /*
   * ============================================================
   * CONTROLE DOS REGISTROS NORMALIZADOS
   * ============================================================
   */

  private async createNormalizedMaterials(
    transaction: TransactionClient,
    options: {
      collection: {
        id: string;
        cooperativeId: string;
        generatorId: string | null;
        collectorId: string | null;
        driverId: string | null;
        vehicleId: string | null;
        routeId: string | null;
        collectedAt: Date | null;
        notes: string | null;
      };

      materials: NormalizedCollectionMaterial[];

      createdByUserId: string;

      createdByNameSnapshot: string | null;
    }
  ) {
    const {
      collection,
      materials,
      createdByUserId,
      createdByNameSnapshot,
    } = options;

    for (const material of materials) {
      const collectionMaterial =
        await transaction.collectionMaterial.create({
          data: {
            collectionId: collection.id,

            wasteTypeId: material.wasteTypeId,

            nameSnapshot: material.name,
            categorySnapshot: material.category,
            subcategorySnapshot:
              material.subcategory,

            unit: material.unit,
            quantity: material.quantity,
          },
        });

      await transaction.collectionWasteEntry.create({
        data: {
          cooperativeId:
            collection.cooperativeId,

          collectionId: collection.id,

          collectionMaterialId:
            collectionMaterial.id,

          wasteTypeId: material.wasteTypeId,

          generatorId:
            collection.generatorId,

          routeId: collection.routeId,

          vehicleId: collection.vehicleId,

          driverId: collection.driverId,

          collectorId:
            collection.collectorId,

          materialNameSnapshot:
            material.name,

          categorySnapshot:
            material.category,

          subcategorySnapshot:
            material.subcategory,

          unit: material.unit,

          collectedQuantity:
            material.quantity,

          destinedQuantity: 0,

          remainingQuantity:
            material.quantity,

          status:
            CollectionEntryStatus.PENDING_DESTINATION,

          origin: "COLLECTION",

          notes:
            collection.notes || null,

          collectedAt:
            collection.collectedAt,

          createdByUserId,

          createdByNameSnapshot,
        },
      });
    }
  }

  private async replaceNormalizedMaterials(
    transaction: TransactionClient,
    collection: CollectionRecordForUpdate,
    materials: NormalizedCollectionMaterial[],
    createdByUserId: string,
    createdByNameSnapshot: string | null,
    collectedAt: Date | null,
    notes: string | null
  ) {
    const hasDestinations =
      collection.collectionMaterials.some(
        (material) =>
          Boolean(
            material.wasteEntry?.destinations
              ?.length
          )
      );

    if (hasDestinations) {
      throw new CollectionDomainError(
        "Os materiais desta coleta não podem mais ser alterados porque já existem destinações registradas.",
        {
          statusCode: 409,
          code: "COLLECTION_MATERIALS_ALREADY_DESTINED",
        }
      );
    }

    if (
      collection.collectionMaterials.length > 0
    ) {
      await transaction.collectionWasteDestination.deleteMany({
        where: {
          collectionWasteEntry: {
            is: {
              collectionId: collection.id,
            },
          },
        },
      });

      await transaction.collectionWasteEntry.deleteMany({
        where: {
          collectionId: collection.id,
        },
      });

      await transaction.collectionMaterial.deleteMany({
        where: {
          collectionId: collection.id,
        },
      });
    }

    await this.createNormalizedMaterials(
      transaction,
      {
        collection: {
          id: collection.id,

          cooperativeId:
            collection.cooperativeId,

          generatorId:
            collection.generatorId,

          collectorId:
            collection.collectorId,

          driverId: collection.driverId,

          vehicleId:
            collection.vehicleId,

          routeId: collection.routeId,

          collectedAt,

          notes,
        },

        materials,

        createdByUserId,

        createdByNameSnapshot,
      }
    );
  }

  /*
   * ============================================================
   * CRIAÇÃO DA COLETA
   * ============================================================
   */

  async create(
    authUserId: string,
    authUserRole: string,
    data: CreateCollectionInput
  ) {
    if (
      normalizeRole(authUserRole) !==
      UserRole.COOPERATIVE
    ) {
      throw new CollectionDomainError(
        "Apenas cooperativas podem delegar coletas.",
        {
          statusCode: 403,
          code: "ONLY_COOPERATIVE_CAN_CREATE_COLLECTION",
        }
      );
    }

    const context = await this.getAccessContext(
      authUserId,
      authUserRole
    );

    return prisma.$transaction(
      async (transaction) => {
        const schedule =
          await transaction.schedule.findFirst({
            where: {
              id: data.scheduleId,

              cooperativeId:
                context.cooperativeId,
            },

            include: {
              generator: true,

              collections: {
                where: {
                  status: {
                    in: [
                      CollectionStatus.PENDING,
                      CollectionStatus.IN_PROGRESS,
                      CollectionStatus.COMPLETED,
                    ],
                  },
                },

                select: {
                  id: true,
                  status: true,
                },
              },
            },
          });

        if (!schedule) {
          throw new CollectionDomainError(
            "Agendamento não encontrado para esta cooperativa.",
            {
              statusCode: 404,
              code: "SCHEDULE_NOT_FOUND",
            }
          );
        }

        if (
          schedule.status ===
            ScheduleStatus.CANCELLED ||
          schedule.status ===
            ScheduleStatus.COMPLETED
        ) {
          throw new CollectionDomainError(
            "Não é possível delegar um agendamento encerrado.",
            {
              statusCode: 409,
              code: "SCHEDULE_ALREADY_CLOSED",
            }
          );
        }

        if (
          schedule.collections.length > 0
        ) {
          throw new CollectionDomainError(
            "Este agendamento já possui uma coleta vinculada.",
            {
              statusCode: 409,
              code: "SCHEDULE_ALREADY_HAS_COLLECTION",
            }
          );
        }

        const collector =
          await transaction.collector.findFirst({
            where: {
              id: data.collectorId,

              cooperativeId:
                context.cooperativeId,

              status:
                CollectorStatus.AVAILABLE,
            },
          });

        if (!collector) {
          throw new CollectionDomainError(
            "Catador não encontrado ou indisponível para esta cooperativa.",
            {
              statusCode: 404,
              code: "COLLECTOR_UNAVAILABLE",
            }
          );
        }

        let driverId: string | null = null;
        let vehicleId: string | null = null;
        let routeId: string | null = null;

        if (data.driverId) {
          const driver =
            await transaction.driver.findFirst({
              where: {
                id: data.driverId,

                cooperativeId:
                  context.cooperativeId,

                status: {
                  not: DriverStatus.INACTIVE,
                },
              },
            });

          if (!driver) {
            throw new CollectionDomainError(
              "Motorista não encontrado ou indisponível para esta cooperativa.",
              {
                statusCode: 404,
                code: "DRIVER_UNAVAILABLE",
              }
            );
          }

          driverId = driver.id;
        }

        if (data.vehicleId) {
          const vehicle =
            await transaction.vehicle.findFirst({
              where: {
                id: data.vehicleId,

                cooperativeId:
                  context.cooperativeId,

                status: {
                  not: VehicleStatus.INACTIVE,
                },
              },
            });

          if (!vehicle) {
            throw new CollectionDomainError(
              "Veículo não encontrado ou indisponível para esta cooperativa.",
              {
                statusCode: 404,
                code: "VEHICLE_UNAVAILABLE",
              }
            );
          }

          if (
            driverId &&
            vehicle.driverId &&
            vehicle.driverId !== driverId
          ) {
            throw new CollectionDomainError(
              "O veículo informado está vinculado a outro motorista.",
              {
                statusCode: 409,
                code: "VEHICLE_DRIVER_CONFLICT",
              }
            );
          }

          vehicleId = vehicle.id;
        }

        if (data.routeId) {
          const route =
            await transaction.route.findFirst({
              where: {
                id: data.routeId,

                cooperativeId:
                  context.cooperativeId,

                status: {
                  in: [
                    RouteStatus.SCHEDULED,
                    RouteStatus.IN_PROGRESS,
                  ],
                },
              },
            });

          if (!route) {
            throw new CollectionDomainError(
              "Rota não encontrada ou indisponível para esta cooperativa.",
              {
                statusCode: 404,
                code: "ROUTE_UNAVAILABLE",
              }
            );
          }

          if (
            driverId &&
            route.driverId &&
            route.driverId !== driverId
          ) {
            throw new CollectionDomainError(
              "A rota informada pertence a outro motorista.",
              {
                statusCode: 409,
                code: "ROUTE_DRIVER_CONFLICT",
              }
            );
          }

          if (
            vehicleId &&
            route.vehicleId &&
            route.vehicleId !== vehicleId
          ) {
            throw new CollectionDomainError(
              "A rota informada pertence a outro veículo.",
              {
                statusCode: 409,
                code: "ROUTE_VEHICLE_CONFLICT",
              }
            );
          }

          driverId =
            driverId || route.driverId || null;

          vehicleId =
            vehicleId ||
            route.vehicleId ||
            null;

          routeId = route.id;
        }

        const materialPayload =
          data.materials
            ? (data.materials as MaterialPayload[])
            : [];

        const normalizedMaterials =
          await this.normalizeMaterials(
            transaction,
            context.cooperativeId,
            materialPayload
          );

        const weightSummary =
          calculateWeightSummary(
            normalizedMaterials
          );

        const totalWeightKg =
          typeof data.totalWeightKg === "number"
            ? data.totalWeightKg
            : weightSummary.totalWeightKg;

        const collection =
          await transaction.collection.create({
            data: {
              cooperativeId:
                context.cooperativeId,

              generatorId:
                schedule.generatorId || null,

              collectorId: collector.id,

              scheduleId: schedule.id,

              driverId,

              vehicleId,

              routeId,

              collectedAt: data.collectedAt
                ? new Date(data.collectedAt)
                : null,

              totalWeightKg,

              materials:
                normalizedMaterials.length > 0
                  ? toLegacyMaterialJson(
                      normalizedMaterials
                    )
                  : Prisma.JsonNull,

              notes:
                normalizeText(data.notes),

              status:
                CollectionStatus.PENDING,
            },
          });

        await transaction.schedule.update({
          where: {
            id: schedule.id,
          },

          data: {
            status:
              ScheduleStatus.SCHEDULED,

            scheduledDate:
              schedule.scheduledDate ||
              new Date(),
          },
        });

        return transaction.collection.findUniqueOrThrow({
          where: {
            id: collection.id,
          },

          include: collectionInclude,
        });
      }
    );
  }

  /*
   * ============================================================
   * LISTAGEM
   * ============================================================
   */

  async listMine(
    authUserId: string,
    authUserRole: string
  ) {
    const context = await this.getAccessContext(
      authUserId,
      authUserRole
    );

    const role = normalizeRole(authUserRole);

    let where: Prisma.CollectionWhereInput;

    if (role === UserRole.COOPERATIVE) {
      where = {
        cooperativeId:
          context.cooperativeId,
      };
    } else if (
      role === UserRole.COLLECTOR
    ) {
      where = {
        collectorId:
          context.collectorId,
      };
    } else if (
      role === UserRole.DRIVER
    ) {
      where = {
        driverId:
          context.driverId,
      };
    } else if (
      isGeneratorRole(role)
    ) {
      where = {
        generatorId:
          context.generatorId,
      };
    } else {
      throw new CollectionDomainError(
        "Usuário sem permissão para listar coletas.",
        {
          statusCode: 403,
          code: "COLLECTION_LIST_DENIED",
        }
      );
    }

    return prisma.collection.findMany({
      where,

      include: collectionInclude,

      orderBy: [
        {
          status: "asc",
        },
        {
          createdAt: "desc",
        },
      ],
    });
  }

  /*
   * ============================================================
   * CONSULTA POR ID
   * ============================================================
   */

  async findById(
    authUserId: string,
    authUserRole: string,
    collectionId: string
  ) {
    const context = await this.getAccessContext(
      authUserId,
      authUserRole
    );

    const role = normalizeRole(authUserRole);

    let where: Prisma.CollectionWhereInput = {
      id: collectionId,
    };

    if (role === UserRole.COOPERATIVE) {
      where = {
        ...where,

        cooperativeId:
          context.cooperativeId,
      };
    } else if (
      role === UserRole.COLLECTOR
    ) {
      where = {
        ...where,

        collectorId:
          context.collectorId,
      };
    } else if (
      role === UserRole.DRIVER
    ) {
      where = {
        ...where,

        driverId:
          context.driverId,
      };
    } else if (
      isGeneratorRole(role)
    ) {
      where = {
        ...where,

        generatorId:
          context.generatorId,
      };
    } else {
      throw new CollectionDomainError(
        "Usuário sem permissão para consultar coleta.",
        {
          statusCode: 403,
          code: "COLLECTION_FIND_DENIED",
        }
      );
    }

    const collection =
      await prisma.collection.findFirst({
        where,

        include: collectionInclude,
      });

    if (!collection) {
      throw new CollectionDomainError(
        "Coleta não encontrada.",
        {
          statusCode: 404,
          code: "COLLECTION_NOT_FOUND",
        }
      );
    }

    return collection;
  }

  /*
   * ============================================================
   * ATUALIZAÇÃO DE STATUS
   * ============================================================
   */

  async updateStatus(
    authUserId: string,
    authUserRole: string,
    collectionId: string,
    data: UpdateCollectionStatusInput
  ) {
    const context = await this.getAccessContext(
      authUserId,
      authUserRole
    );

    const role = normalizeRole(authUserRole);

    if (
      role !== UserRole.COOPERATIVE &&
      role !== UserRole.COLLECTOR &&
      role !== UserRole.DRIVER
    ) {
      throw new CollectionDomainError(
        "Usuário sem permissão para atualizar coleta.",
        {
          statusCode: 403,
          code: "COLLECTION_UPDATE_DENIED",
        }
      );
    }

    return prisma.$transaction(
      async (transaction) => {
        const collection =
          await transaction.collection.findUnique({
            where: {
              id: collectionId,
            },

            include: {
              schedule: true,

              collectionMaterials: {
                include: {
                  wasteEntry: {
                    include: {
                      destinations: true,
                    },
                  },
                },
              },
            },
          });

        if (!collection) {
          throw new CollectionDomainError(
            "Coleta não encontrada.",
            {
              statusCode: 404,
              code: "COLLECTION_NOT_FOUND",
            }
          );
        }

        if (
          collection.cooperativeId !==
          context.cooperativeId
        ) {
          throw new CollectionDomainError(
            "Coleta não encontrada para esta cooperativa.",
            {
              statusCode: 404,
              code: "COLLECTION_NOT_FOUND",
            }
          );
        }

        if (
          role === UserRole.COLLECTOR &&
          collection.collectorId !==
            context.collectorId
        ) {
          throw new CollectionDomainError(
            "Coleta não encontrada para este catador.",
            {
              statusCode: 404,
              code: "COLLECTION_NOT_FOUND",
            }
          );
        }

        if (
          role === UserRole.DRIVER &&
          collection.driverId !==
            context.driverId
        ) {
          throw new CollectionDomainError(
            "Coleta não encontrada para este motorista.",
            {
              statusCode: 404,
              code: "COLLECTION_NOT_FOUND",
            }
          );
        }

        if (
          collection.status ===
            CollectionStatus.CANCELLED &&
          data.status !==
            CollectionStatus.CANCELLED
        ) {
          throw new CollectionDomainError(
            "Uma coleta cancelada não pode ser reaberta.",
            {
              statusCode: 409,
              code: "CANCELLED_COLLECTION_CANNOT_REOPEN",
            }
          );
        }

        const existingLegacyMaterials =
          normalizeLegacyMaterials(
            collection.materials
          );

        const incomingMaterialPayload =
          data.materials !== undefined
            ? (data.materials as MaterialPayload[])
            : existingLegacyMaterials;

        const normalizedMaterials =
          await this.normalizeMaterials(
            transaction,
            collection.cooperativeId,
            incomingMaterialPayload
          );

        if (
          data.status ===
            CollectionStatus.COMPLETED &&
          normalizedMaterials.length === 0
        ) {
          throw new CollectionDomainError(
            "Informe ao menos um material para concluir a coleta.",
            {
              statusCode: 400,
              code: "COLLECTION_MATERIALS_REQUIRED",
            }
          );
        }

        const weightSummary =
          calculateWeightSummary(
            normalizedMaterials
          );

        const nextCollectedAt =
          data.status ===
          CollectionStatus.COMPLETED
            ? data.collectedAt
              ? new Date(data.collectedAt)
              : collection.collectedAt ||
                new Date()
            : data.collectedAt
              ? new Date(data.collectedAt)
              : collection.collectedAt;

        const nextNotes =
          data.notes !== undefined
            ? normalizeText(data.notes)
            : collection.notes;

        const nextTotalWeightKg =
          data.status ===
          CollectionStatus.COMPLETED
            ? weightSummary.totalWeightKg
            : data.totalWeightKg !==
                undefined
              ? data.totalWeightKg
              : collection.totalWeightKg;

        const nextScheduleStatus =
          data.status ===
          CollectionStatus.IN_PROGRESS
            ? ScheduleStatus.IN_PROGRESS
            : data.status ===
                CollectionStatus.COMPLETED
              ? ScheduleStatus.COMPLETED
              : data.status ===
                  CollectionStatus.CANCELLED
                ? ScheduleStatus.CANCELLED
                : ScheduleStatus.SCHEDULED;

        const updatedCollection =
          await transaction.collection.update({
            where: {
              id: collection.id,
            },

            data: {
              status: data.status,

              collectedAt:
                nextCollectedAt,

              totalWeightKg:
                nextTotalWeightKg,

              materials:
                normalizedMaterials.length > 0
                  ? toLegacyMaterialJson(
                      normalizedMaterials
                    )
                  : Prisma.JsonNull,

              notes: nextNotes,
            },
          });

        if (collection.scheduleId) {
          await transaction.schedule.update({
            where: {
              id: collection.scheduleId,
            },

            data: {
              status:
                nextScheduleStatus,
            },
          });
        }

        if (
          data.status ===
          CollectionStatus.COMPLETED
        ) {
          const authenticatedUser =
            await transaction.user.findUnique({
              where: {
                id: authUserId,
              },

              select: {
                id: true,
                displayName: true,
                email: true,
              },
            });

          await this.replaceNormalizedMaterials(
            transaction,
            collection,
            normalizedMaterials,
            authUserId,
            authenticatedUser?.displayName ||
              authenticatedUser?.email ||
              null,
            nextCollectedAt,
            nextNotes
          );

          if (collection.generatorId) {
            const completedCollections =
              await transaction.collection.aggregate({
                where: {
                  generatorId:
                    collection.generatorId,

                  status:
                    CollectionStatus.COMPLETED,
                },

                _sum: {
                  totalWeightKg: true,
                },
              });

            await transaction.generator.update({
              where: {
                id: collection.generatorId,
              },

              data: {
                totalKg:
                  completedCollections._sum
                    .totalWeightKg || 0,
              },
            });
          }
        }

        return transaction.collection.findUniqueOrThrow({
          where: {
            id: updatedCollection.id,
          },

          include: collectionInclude,
        });
      }
    );
  }
}