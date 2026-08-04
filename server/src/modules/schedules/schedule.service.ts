import {
  AccountStatus,
  CollectionStatus,
  Prisma,
  ScheduleStatus,
  UserRole,
  WasteCatalogSuggestionOrigin,
  WasteStockStatus,
  WasteUnit,
} from "@prisma/client";

import { prisma } from "../../lib/prisma";

import {
  CreateScheduleInput,
  RequestedScheduleMaterial,
  UpdateScheduleStatusInput,
} from "./schedule.schemas";

/*
 * ============================================================
 * TIPOS INTERNOS
 * ============================================================
 */

type TransactionClient =
  Prisma.TransactionClient;

type NormalizedRequestedMaterial = {
  wasteTypeId: string | null;
  name: string;
  category: string | null;
  subcategory: string | null;
  estimatedQuantity: number | null;
  unit: WasteUnit;
};

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

function normalizeText(
  value?: string | null
): string | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const normalized = String(value).trim();

  return normalized || null;
}

function normalizeDate(
  date?: string | null
): Date | null {
  if (!date) {
    return null;
  }

  const normalizedDate = new Date(date);

  if (
    Number.isNaN(
      normalizedDate.getTime()
    )
  ) {
    throw new Error(
      "A data informada é inválida."
    );
  }

  return normalizedDate;
}

function resolveInitialStatus(
  data: CreateScheduleInput
) {
  return data.scheduledDate
    ? ScheduleStatus.SCHEDULED
    : ScheduleStatus.REQUESTED;
}

function normalizeEstimatedQuantity(
  value?: number | null
): number | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const quantity = Number(value);

  if (
    !Number.isFinite(quantity) ||
    quantity <= 0
  ) {
    throw new Error(
      "A quantidade estimada deve ser maior que zero."
    );
  }

  return quantity;
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
  createdAt: true,
  updatedAt: true,
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
  userId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CooperativeSelect;

const generatorSelect = {
  id: true,
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
  type: true,
  accessReleased: true,
  accessStatus: true,
  totalKg: true,
  userId: true,
  cooperativeId: true,
} satisfies Prisma.GeneratorSelect;

const collectorSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  rg: true,
  birthDate: true,
  status: true,
  kgMonth: true,
  collectionsToday: true,
  totalKg: true,
} satisfies Prisma.CollectorSelect;

const driverSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  cpf: true,
  cnh: true,
  cnhCategory: true,
  status: true,
} satisfies Prisma.DriverSelect;

const vehicleSelect = {
  id: true,
  plate: true,
  model: true,
  brand: true,
  year: true,
  capacityKg: true,
  status: true,
} satisfies Prisma.VehicleSelect;

const routeSelect = {
  id: true,
  name: true,
  description: true,
  scheduledDate: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.RouteSelect;

const requestedMaterialInclude = {
  wasteType: {
    select: {
      id: true,
      cooperativeId: true,
      name: true,
      category: true,
      subcategory: true,
      defaultUnit: true,
      unit: true,
      internalCode: true,
      ncm: true,
      wasteClass: true,
      description: true,
      isActive: true,
      status: true,
    },
  },

  catalogSuggestion: {
    select: {
      id: true,
      cooperativeId: true,
      origin: true,
      status: true,
      name: true,
      category: true,
      subcategory: true,
      unit: true,
      approvedWasteTypeId: true,
      reviewedByUserId: true,
      reviewedAt: true,
      rejectionReason: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.ScheduleRequestedMaterialInclude;

const scheduleInclude = {
  generator: {
    select: generatorSelect,
  },

  cooperative: {
    select: cooperativeSelect,
  },

  requestedBy: {
    select: userSelect,
  },

  requestedMaterials: {
    include: requestedMaterialInclude,

    orderBy: {
      createdAt: "asc" as const,
    },
  },

  collections: {
    include: {
      collector: {
        select: collectorSelect,
      },

      driver: {
        select: driverSelect,
      },

      vehicle: {
        select: vehicleSelect,
      },

      route: {
        select: routeSelect,
      },
    },

    orderBy: {
      createdAt: "desc" as const,
    },
  },
} satisfies Prisma.ScheduleInclude;

/*
 * ============================================================
 * SERVICE
 * ============================================================
 */

export class ScheduleService {
  /*
   * ============================================================
   * NORMALIZAÇÃO DOS MATERIAIS SOLICITADOS
   * ============================================================
   */

  private async normalizeRequestedMaterials(
    transaction: TransactionClient,
    cooperativeId: string,
    materials: RequestedScheduleMaterial[]
  ): Promise<
    NormalizedRequestedMaterial[]
  > {
    if (
      !Array.isArray(materials) ||
      materials.length === 0
    ) {
      throw new Error(
        "Informe ao menos um tipo de resíduo."
      );
    }

    const wasteTypeIds = Array.from(
      new Set(
        materials
          .map((material) =>
            normalizeText(
              material.wasteTypeId
            )
          )
          .filter(
            (
              wasteTypeId
            ): wasteTypeId is string =>
              Boolean(wasteTypeId)
          )
      )
    );

    const catalogItems =
      wasteTypeIds.length > 0
        ? await transaction.wasteStockItem.findMany(
            {
              where: {
                id: {
                  in: wasteTypeIds,
                },

                cooperativeId,

                isActive: true,

                status:
                  WasteStockStatus.ACTIVE,
              },

              select: {
                id: true,
                name: true,
                category: true,
                subcategory: true,
                defaultUnit: true,
                unit: true,
              },
            }
          )
        : [];

    if (
      catalogItems.length !==
      wasteTypeIds.length
    ) {
      const foundIds = new Set(
        catalogItems.map(
          (catalogItem) =>
            catalogItem.id
        )
      );

      const invalidIds =
        wasteTypeIds.filter(
          (wasteTypeId) =>
            !foundIds.has(wasteTypeId)
        );

      throw new Error(
        `Um ou mais materiais não foram encontrados no catálogo ativo da cooperativa: ${invalidIds.join(
          ", "
        )}.`
      );
    }

    const catalogMap = new Map(
      catalogItems.map(
        (catalogItem) => [
          catalogItem.id,
          catalogItem,
        ]
      )
    );

    const normalizedMaterials =
      materials.map(
        (
          material,
          index
        ): NormalizedRequestedMaterial => {
          const wasteTypeId =
            normalizeText(
              material.wasteTypeId
            );

          const catalogItem =
            wasteTypeId
              ? catalogMap.get(
                  wasteTypeId
                )
              : undefined;

          if (wasteTypeId && !catalogItem) {
            throw new Error(
              `O material do catálogo informado na posição ${
                index + 1
              } não foi encontrado.`
            );
          }

          if (catalogItem) {
            const providedUnit =
              String(
                material.unit || ""
              )
                .trim()
                .toUpperCase() as WasteUnit;

            const unit =
              Object.values(
                WasteUnit
              ).includes(
                providedUnit
              )
                ? providedUnit
                : catalogItem.unit ||
                  catalogItem.defaultUnit ||
                  WasteUnit.KG;

            return {
              wasteTypeId:
                catalogItem.id,

              name:
                catalogItem.name,

              category:
                catalogItem.category,

              subcategory:
                catalogItem.subcategory,

              estimatedQuantity:
                normalizeEstimatedQuantity(
                  material.estimatedQuantity
                ),

              unit,
            };
          }

          const proposedMaterial =
            material.proposedMaterial;

          const proposedName =
            normalizeText(
              proposedMaterial?.name
            );

          if (!proposedName) {
            throw new Error(
              `Informe um material do catálogo ou um novo material na posição ${
                index + 1
              }.`
            );
          }

          const proposedUnit =
            String(
              proposedMaterial?.unit ||
                material.unit ||
                WasteUnit.KG
            )
              .trim()
              .toUpperCase() as WasteUnit;

          const unit =
            Object.values(
              WasteUnit
            ).includes(
              proposedUnit
            )
              ? proposedUnit
              : WasteUnit.KG;

          return {
            wasteTypeId: null,

            name:
              proposedName,

            category:
              normalizeText(
                proposedMaterial?.category
              ),

            subcategory:
              normalizeText(
                proposedMaterial?.subcategory
              ),

            estimatedQuantity:
              normalizeEstimatedQuantity(
                material.estimatedQuantity
              ),

            unit,
          };
        }
      );

    this.ensureNoDuplicateRequestedMaterials(
      normalizedMaterials
    );

    return normalizedMaterials;
  }

  private ensureNoDuplicateRequestedMaterials(
    materials: NormalizedRequestedMaterial[]
  ) {
    const materialKeys =
      new Set<string>();

    for (
      const material of materials
    ) {
      const key = material.wasteTypeId
        ? `catalog:${material.wasteTypeId}:${material.unit}`
        : `name:${material.name
            .trim()
            .toLocaleLowerCase(
              "pt-BR"
            )}:${material.unit}`;

      if (materialKeys.has(key)) {
        throw new Error(
          `O material "${material.name}" foi informado mais de uma vez com a mesma unidade.`
        );
      }

      materialKeys.add(key);
    }
  }

  private buildRequestedMaterialsCreate(
    cooperativeId: string,
    suggestedByUserId: string,
    materials: NormalizedRequestedMaterial[]
  ): Prisma.ScheduleRequestedMaterialCreateWithoutScheduleInput[] {
    return materials.map(
      (material) => ({
        nameSnapshot:
          material.name,

        categorySnapshot:
          material.category,

        subcategorySnapshot:
          material.subcategory,

        estimatedQuantity:
          material.estimatedQuantity,

        unit: material.unit,

        wasteType:
          material.wasteTypeId
            ? {
                connect: {
                  id: material.wasteTypeId,
                },
              }
            : undefined,

        catalogSuggestion:
          material.wasteTypeId
            ? undefined
            : {
                create: {
                  cooperativeId,

                  suggestedByUserId,

                  origin:
                    WasteCatalogSuggestionOrigin.GENERATOR_REQUEST,

                  name:
                    material.name,

                  category:
                    material.category,

                  subcategory:
                    material.subcategory,

                  unit:
                    material.unit,
                },
              },
      })
    );
  }

  /*
   * ============================================================
   * CRIAÇÃO DO AGENDAMENTO
   * ============================================================
   */

  async create(
    authUserId: string,
    authUserRole: string,
    data: CreateScheduleInput
  ) {
    const role = normalizeRole(
      authUserRole
    );

    if (!authUserId) {
      throw new Error(
        "Usuário autenticado não identificado."
      );
    }

    return prisma.$transaction(
      async (transaction) => {
        let cooperativeId: string;
        let generatorId:
          | string
          | null = null;

        if (
          role ===
          UserRole.COOPERATIVE
        ) {
          const cooperative =
            await transaction.cooperative.findUnique(
              {
                where: {
                  userId:
                    authUserId,
                },

                select: {
                  id: true,
                },
              }
            );

          if (!cooperative) {
            throw new Error(
              "Cooperativa do usuário autenticado não encontrada."
            );
          }

          if (!data.generatorId) {
            throw new Error(
              "Gerador é obrigatório."
            );
          }

          const generator =
            await transaction.generator.findFirst(
              {
                where: {
                  id: data.generatorId,

                  cooperativeId:
                    cooperative.id,
                },

                select: {
                  id: true,
                  cooperativeId:
                    true,
                },
              }
            );

          if (!generator) {
            throw new Error(
              "Gerador não encontrado para esta cooperativa."
            );
          }

          cooperativeId =
            cooperative.id;

          generatorId =
            generator.id;
        } else if (
          isGeneratorRole(role)
        ) {
          const generator =
            await transaction.generator.findUnique(
              {
                where: {
                  userId:
                    authUserId,
                },

                select: {
                  id: true,

                  cooperativeId:
                    true,
                },
              }
            );

          if (!generator) {
            throw new Error(
              "Gerador do usuário autenticado não encontrado."
            );
          }

          cooperativeId =
            generator.cooperativeId;

          generatorId =
            generator.id;
        } else if (
          role === UserRole.PF
        ) {
          if (
            !data.cooperativeId
          ) {
            throw new Error(
              "Cooperativa é obrigatória para agendamento PF."
            );
          }

          const cooperative =
            await transaction.cooperative.findFirst(
              {
                where: {
                  id: data.cooperativeId,

                  user: {
                    role:
                      UserRole.COOPERATIVE,

                    isActive: true,

                    accountStatus:
                      AccountStatus.ACTIVE,
                  },
                },

                select: {
                  id: true,
                },
              }
            );

          if (!cooperative) {
            throw new Error(
              "Cooperativa não encontrada ou inativa."
            );
          }

          cooperativeId =
            cooperative.id;
        } else {
          throw new Error(
            "Usuário sem permissão para criar agendamentos."
          );
        }

        const normalizedMaterials =
          await this.normalizeRequestedMaterials(
            transaction,
            cooperativeId,
            data.requestedMaterials
          );

        return transaction.schedule.create(
          {
            data: {
              cooperativeId,

              generatorId,

              requestedByUserId:
                authUserId,

              preferredDate:
                normalizeDate(
                  data.preferredDate
                ),

              scheduledDate:
                normalizeDate(
                  data.scheduledDate
                ),

              /**
               * Os materiais deixam de ser gravados dentro de notes.
               * notes passa a armazenar somente a observação livre.
               */
              notes:
                normalizeText(
                  data.notes
                ),

              status:
                resolveInitialStatus(
                  data
                ),

              requestedMaterials: {
                create:
                  this.buildRequestedMaterialsCreate(
                    cooperativeId,
                    authUserId,
                    normalizedMaterials
                  ),
              },
            },

            include:
              scheduleInclude,
          }
        );
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
    const role = normalizeRole(
      authUserRole
    );

    if (
      role ===
      UserRole.COOPERATIVE
    ) {
      const cooperative =
        await prisma.cooperative.findUnique(
          {
            where: {
              userId:
                authUserId,
            },

            select: {
              id: true,
            },
          }
        );

      if (!cooperative) {
        throw new Error(
          "Cooperativa do usuário autenticado não encontrada."
        );
      }

      return prisma.schedule.findMany(
        {
          where: {
            cooperativeId:
              cooperative.id,
          },

          include:
            scheduleInclude,

          orderBy: [
            {
              status: "asc",
            },

            {
              scheduledDate:
                "asc",
            },

            {
              preferredDate:
                "asc",
            },

            {
              createdAt:
                "desc",
            },
          ],
        }
      );
    }

    if (
      isGeneratorRole(role)
    ) {
      const generator =
        await prisma.generator.findUnique(
          {
            where: {
              userId:
                authUserId,
            },

            select: {
              id: true,
            },
          }
        );

      if (!generator) {
        throw new Error(
          "Gerador do usuário autenticado não encontrado."
        );
      }

      return prisma.schedule.findMany(
        {
          where: {
            generatorId:
              generator.id,
          },

          include:
            scheduleInclude,

          orderBy: [
            {
              status: "asc",
            },

            {
              scheduledDate:
                "asc",
            },

            {
              preferredDate:
                "asc",
            },

            {
              createdAt:
                "desc",
            },
          ],
        }
      );
    }

    if (role === UserRole.PF) {
      return prisma.schedule.findMany(
        {
          where: {
            requestedByUserId:
              authUserId,
          },

          include:
            scheduleInclude,

          orderBy: [
            {
              status: "asc",
            },

            {
              scheduledDate:
                "asc",
            },

            {
              preferredDate:
                "asc",
            },

            {
              createdAt:
                "desc",
            },
          ],
        }
      );
    }

    throw new Error(
      "Usuário sem permissão para listar agendamentos."
    );
  }

  /*
   * ============================================================
   * CONSULTA POR ID
   * ============================================================
   */

  async findById(
    authUserId: string,
    authUserRole: string,
    scheduleId: string
  ) {
    const role = normalizeRole(
      authUserRole
    );

    if (
      role ===
      UserRole.COOPERATIVE
    ) {
      const cooperative =
        await prisma.cooperative.findUnique(
          {
            where: {
              userId:
                authUserId,
            },

            select: {
              id: true,
            },
          }
        );

      if (!cooperative) {
        throw new Error(
          "Cooperativa do usuário autenticado não encontrada."
        );
      }

      const schedule =
        await prisma.schedule.findFirst(
          {
            where: {
              id: scheduleId,

              cooperativeId:
                cooperative.id,
            },

            include:
              scheduleInclude,
          }
        );

      if (!schedule) {
        throw new Error(
          "Agendamento não encontrado."
        );
      }

      return schedule;
    }

    if (
      isGeneratorRole(role)
    ) {
      const generator =
        await prisma.generator.findUnique(
          {
            where: {
              userId:
                authUserId,
            },

            select: {
              id: true,
            },
          }
        );

      if (!generator) {
        throw new Error(
          "Gerador do usuário autenticado não encontrado."
        );
      }

      const schedule =
        await prisma.schedule.findFirst(
          {
            where: {
              id: scheduleId,

              generatorId:
                generator.id,
            },

            include:
              scheduleInclude,
          }
        );

      if (!schedule) {
        throw new Error(
          "Agendamento não encontrado."
        );
      }

      return schedule;
    }

    if (role === UserRole.PF) {
      const schedule =
        await prisma.schedule.findFirst(
          {
            where: {
              id: scheduleId,

              requestedByUserId:
                authUserId,
            },

            include:
              scheduleInclude,
          }
        );

      if (!schedule) {
        throw new Error(
          "Agendamento não encontrado."
        );
      }

      return schedule;
    }

    throw new Error(
      "Usuário sem permissão para consultar agendamentos."
    );
  }

  /*
   * ============================================================
   * ATUALIZAÇÃO DE STATUS
   * ============================================================
   */

  async updateStatus(
    cooperativeUserId: string,
    scheduleId: string,
    data: UpdateScheduleStatusInput
  ) {
    const cooperative =
      await prisma.cooperative.findUnique(
        {
          where: {
            userId:
              cooperativeUserId,
          },

          select: {
            id: true,
          },
        }
      );

    if (!cooperative) {
      throw new Error(
        "Cooperativa do usuário autenticado não encontrada."
      );
    }

    const existingSchedule =
      await prisma.schedule.findFirst(
        {
          where: {
            id:
              scheduleId,

            cooperativeId:
              cooperative.id,
          },

          include: {
            collections: {
              select: {
                id: true,
                status: true,
              },
            },
          },
        }
      );

    if (!existingSchedule) {
      throw new Error(
        "Agendamento não encontrado."
      );
    }

    /*
     * Um agendamento encerrado não pode retornar para outro estado.
     *
     * COMPLETED é definido pelo módulo Collection quando o fluxo
     * operacional termina.
     *
     * CANCELLED é definitivo.
     */
    if (
      existingSchedule.status ===
        ScheduleStatus.COMPLETED ||
      existingSchedule.status ===
        ScheduleStatus.CANCELLED
    ) {
      throw new Error(
        "O agendamento já está encerrado e não pode ser alterado."
      );
    }

    /*
     * A atualização manual do módulo Schedule é limitada a:
     *
     * - SCHEDULED;
     * - CANCELLED.
     *
     * IN_PROGRESS e COMPLETED são controlados internamente pelo
     * módulo Collection.
     */
    if (
      data.status !==
        ScheduleStatus.SCHEDULED &&
      data.status !==
        ScheduleStatus.CANCELLED
    ) {
      throw new Error(
        "O status informado deve ser atualizado pelo fluxo operacional da coleta."
      );
    }

    if (
      data.status ===
      ScheduleStatus.SCHEDULED
    ) {
      if (
        existingSchedule.status !==
          ScheduleStatus.REQUESTED &&
        existingSchedule.status !==
          ScheduleStatus.SCHEDULED
      ) {
        throw new Error(
          "Somente agendamentos solicitados podem ser confirmados."
        );
      }

      return prisma.schedule.update(
        {
          where: {
            id:
              existingSchedule.id,
          },

          data: {
            status:
              ScheduleStatus.SCHEDULED,

            scheduledDate:
              existingSchedule.scheduledDate ||
              new Date(),
          },

          include:
            scheduleInclude,
        }
      );
    }

    /*
     * Não é permitido cancelar diretamente o Schedule depois que
     * uma Collection foi criada e ainda pertence ao fluxo operacional.
     *
     * O cancelamento deverá ocorrer no módulo Collection, que também
     * atualizará o Schedule para CANCELLED.
     */
    const blockingCollection =
      existingSchedule.collections.find(
        (collection) =>
          collection.status !==
          CollectionStatus.CANCELLED
      );

    if (blockingCollection) {
      throw new Error(
        "Não é possível cancelar o agendamento porque ele já possui uma coleta vinculada. Cancele a coleta pelo módulo operacional."
      );
    }

    return prisma.schedule.update(
      {
        where: {
          id:
            existingSchedule.id,
        },

        data: {
          status:
            ScheduleStatus.CANCELLED,
        },

        include:
          scheduleInclude,
      }
    );
  }
}
