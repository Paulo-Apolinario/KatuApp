import {
  Prisma,
  WasteClass,
  WasteLotStatus,
  WasteProcessingStage,
  WasteStockStatus,
  WasteUnit,
} from "@prisma/client";

import { prisma } from "../../lib/prisma";

import type {
  CreateLegacyWasteStockInput,
  CreateWasteStockItemInput,
  CreateWasteStockLotInput,
  UpdateWasteStockItemInput,
  UpdateWasteStockLotInput,
} from "./waste-stock.schemas";

type AuthUser = {
  id?: string;
  sub?: string;
  userId?: string;
  role?: string;
};

function getAuthUserId(user: AuthUser) {
  return user?.sub || user?.id || user?.userId;
}

function normalizeRole(role?: string) {
  return String(role || "")
    .trim()
    .toUpperCase();
}

function normalizeText(value?: string | null) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();

  return normalized || null;
}

function normalizeRequiredText(value: string) {
  return String(value).trim();
}

function normalizeSearchText(
  value:
    | string
    | null
    | undefined
) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function normalizeInternalCode(value?: string | null) {
  const normalized = normalizeText(value);

  return normalized
    ? normalized.toUpperCase()
    : null;
}

function normalizeNcm(value?: string | null) {
  if (!value) return null;

  const normalized = String(value)
    .replace(/\D/g, "")
    .trim();

  return normalized || null;
}

function normalizeQuantity(value: unknown) {
  const quantity = Number(value);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(
      "A quantidade deve ser um número maior que zero."
    );
  }

  return quantity;
}

function normalizeUnit(
  value?: WasteUnit | null
): WasteUnit {
  return value || WasteUnit.KG;
}

function quantityToKgCompatibility(
  quantity: number,
  unit: WasteUnit
) {
  if (unit === WasteUnit.KG) {
    return quantity;
  }

  if (unit === WasteUnit.TON) {
    return quantity * 1000;
  }

  /*
   * Litros, unidades e metros cúbicos não possuem conversão
   * automática segura para quilogramas.
   *
   * Mantemos quantityKg como zero nesses casos durante a transição.
   */
  return 0;
}

function getEffectiveLotQuantity(lot: {
  quantity?:
    | Prisma.Decimal
    | number
    | null;

  quantityKg?:
    | number
    | null;
}) {
  const currentQuantity = Number(
    lot.quantity ?? 0
  );

  if (
    Number.isFinite(currentQuantity) &&
    currentQuantity > 0
  ) {
    return currentQuantity;
  }

  const legacyQuantityKg = Number(
    lot.quantityKg ?? 0
  );

  return Number.isFinite(
    legacyQuantityKg
  )
    ? legacyQuantityKg
    : 0;
}

function mapWasteStockItem(item: any) {
  const lots = Array.isArray(item?.lots)
    ? item.lots
    : [];

  const validLots = lots.filter(
    (lot: any) =>
      lot.status !== WasteLotStatus.DISCARDED
  );

  const totalQuantity = validLots.reduce(
    (sum: number, lot: any) =>
      sum + getEffectiveLotQuantity(lot),
    0
  );

  const totalsByUnit = validLots.reduce(
    (
      accumulator: Record<string, number>,
      lot: any
    ) => {
      const unit = lot.unit || item.unit || WasteUnit.KG;
      const quantity = getEffectiveLotQuantity(lot);

      accumulator[unit] =
        (accumulator[unit] || 0) + quantity;

      return accumulator;
    },
    {}
  );

  const totalQuantityKg = validLots.reduce(
    (sum: number, lot: any) =>
      sum + Number(lot.quantityKg || 0),
    0
  );

  return {
    ...item,
    lots,
    lotsCount: lots.length,
    activeLotsCount: validLots.length,
    totalQuantity,
    totalQuantityKg,
    totalsByUnit,
  };
}

export class WasteStockService {
  private async getAuthenticatedCooperative(
    user: AuthUser
  ) {
    const userId = getAuthUserId(user);

    if (!userId) {
      throw new Error(
        "Usuário autenticado não identificado."
      );
    }

    if (
      normalizeRole(user.role) !== "COOPERATIVE"
    ) {
      throw new Error(
        "Apenas cooperativas podem administrar tipos e estoques de resíduos."
      );
    }

    const cooperative =
      await prisma.cooperative.findUnique({
        where: {
          userId,
        },
        select: {
          id: true,
          name: true,
          userId: true,
        },
      });

    if (!cooperative) {
      throw new Error(
        "Cooperativa do usuário autenticado não encontrada."
      );
    }

    return cooperative;
  }

  private async ensureItemBelongsToCooperative(
    cooperativeId: string,
    itemId: string
  ) {
    const item =
      await prisma.wasteStockItem.findFirst({
        where: {
          id: itemId,
          cooperativeId,
        },
      });

    if (!item) {
      throw new Error(
        "Tipo de resíduo não encontrado."
      );
    }

    return item;
  }

  private async ensureLotBelongsToCooperative(
    cooperativeId: string,
    lotId: string
  ) {
    const lot =
      await prisma.wasteStockLot.findFirst({
        where: {
          id: lotId,
          cooperativeId,
        },
        include: {
          stockItem: true,
        },
      });

    if (!lot) {
      throw new Error("Lote não encontrado.");
    }

    return lot;
  }

  private async ensureUniqueItemName(
    cooperativeId: string,
    name: string,
    ignoredItemId?: string
  ) {
    const normalizedName =
      normalizeSearchText(name);

    const items =
      await prisma.wasteStockItem.findMany({
        where: {
          cooperativeId,
          ...(ignoredItemId
            ? {
                id: {
                  not: ignoredItemId,
                },
              }
            : {}),
        },
        select: {
          id: true,
          name: true,
        },
      });

    const duplicate = items.find(
      (item) =>
        normalizeSearchText(item.name) ===
        normalizedName
    );

    if (duplicate) {
      throw new Error(
        "Já existe um tipo de resíduo com este nome."
      );
    }
  }

  private async ensureUniqueInternalCode(
    cooperativeId: string,
    internalCode?: string | null,
    ignoredItemId?: string
  ) {
    const normalizedCode =
      normalizeInternalCode(internalCode);

    if (!normalizedCode) return;

    const duplicate =
      await prisma.wasteStockItem.findFirst({
        where: {
          cooperativeId,
          internalCode: normalizedCode,
          ...(ignoredItemId
            ? {
                id: {
                  not: ignoredItemId,
                },
              }
            : {}),
        },
        select: {
          id: true,
        },
      });

    if (duplicate) {
      throw new Error(
        "Já existe um tipo de resíduo com este código interno."
      );
    }
  }

  private async ensureUniqueLotCode(
    cooperativeId: string,
    lotCode: string,
    ignoredLotId?: string
  ) {
    const normalizedCode =
      normalizeSearchText(lotCode);

    const lots =
      await prisma.wasteStockLot.findMany({
        where: {
          cooperativeId,
          ...(ignoredLotId
            ? {
                id: {
                  not: ignoredLotId,
                },
              }
            : {}),
        },
        select: {
          id: true,
          lotCode: true,
        },
      });

    const duplicate = lots.find(
      (lot) =>
        normalizeSearchText(lot.lotCode) ===
        normalizedCode
    );

    if (duplicate) {
      throw new Error(
        "Já existe um lote com este código."
      );
    }
  }

  /*
   * ============================================================
   * CATÁLOGO DE TIPOS DE RESÍDUOS
   * ============================================================
   */

  async listItems(
    user: AuthUser,
    filters?: {
      status?: WasteStockStatus;
      category?: string;
      search?: string;
    }
  ) {
    const cooperative =
      await this.getAuthenticatedCooperative(user);

    const items =
      await prisma.wasteStockItem.findMany({
        where: {
          cooperativeId: cooperative.id,

          ...(filters?.status
            ? {
                status: filters.status,
              }
            : {}),

          ...(filters?.category
            ? {
                category: {
                  equals: filters.category.trim(),
                  mode: "insensitive",
                },
              }
            : {}),

          ...(filters?.search?.trim()
            ? {
                OR: [
                  {
                    name: {
                      contains:
                        filters.search.trim(),
                      mode: "insensitive",
                    },
                  },
                  {
                    category: {
                      contains:
                        filters.search.trim(),
                      mode: "insensitive",
                    },
                  },
                  {
                    subcategory: {
                      contains:
                        filters.search.trim(),
                      mode: "insensitive",
                    },
                  },
                  {
                    internalCode: {
                      contains:
                        filters.search.trim(),
                      mode: "insensitive",
                    },
                  },
                  {
                    ncm: {
                      contains:
                        filters.search.trim(),
                      mode: "insensitive",
                    },
                  },
                ],
              }
            : {}),
        },

        include: {
          lots: {
            orderBy: {
              createdAt: "desc",
            },
          },
        },

        orderBy: [
          {
            status: "asc",
          },
          {
            name: "asc",
          },
        ],
      });

    const mappedItems =
      items.map(mapWasteStockItem);

    return {
      success: true,
      items: mappedItems,
      stock: mappedItems,
      total: mappedItems.length,
    };
  }

  async findItemById(
    user: AuthUser,
    itemId: string
  ) {
    const cooperative =
      await this.getAuthenticatedCooperative(user);

    const item =
      await prisma.wasteStockItem.findFirst({
        where: {
          id: itemId,
          cooperativeId: cooperative.id,
        },

        include: {
          lots: {
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      });

    if (!item) {
      throw new Error(
        "Tipo de resíduo não encontrado."
      );
    }

    return {
      success: true,
      item: mapWasteStockItem(item),
    };
  }

  async createItem(
    user: AuthUser,
    data: CreateWasteStockItemInput
  ) {
    const cooperative =
      await this.getAuthenticatedCooperative(user);

    const name =
      normalizeRequiredText(data.name);

    await this.ensureUniqueItemName(
      cooperative.id,
      name
    );

    await this.ensureUniqueInternalCode(
      cooperative.id,
      data.internalCode
    );

    const item =
      await prisma.wasteStockItem.create({
        data: {
          cooperativeId: cooperative.id,

          name,
          category: normalizeRequiredText(
            data.category
          ),

          subcategory: normalizeText(
            data.subcategory
          ),

          unit: normalizeUnit(data.unit),

          ncm: normalizeNcm(data.ncm),

          internalCode:
            normalizeInternalCode(
              data.internalCode
            ),

          wasteClass:
            data.wasteClass ||
            WasteClass.NOT_INFORMED,

          description: normalizeText(
            data.description
          ),

          status:
            data.status ||
            WasteStockStatus.ACTIVE,
        },

        include: {
          lots: true,
        },
      });

    return {
      success: true,
      message:
        "Tipo de resíduo cadastrado com sucesso.",
      item: mapWasteStockItem(item),
    };
  }

  async updateItem(
    user: AuthUser,
    itemId: string,
    data: UpdateWasteStockItemInput
  ) {
    const cooperative =
      await this.getAuthenticatedCooperative(user);

    const currentItem =
      await this.ensureItemBelongsToCooperative(
        cooperative.id,
        itemId
      );

    if (data.name !== undefined) {
      await this.ensureUniqueItemName(
        cooperative.id,
        data.name,
        itemId
      );
    }

    if (data.internalCode !== undefined) {
      await this.ensureUniqueInternalCode(
        cooperative.id,
        data.internalCode,
        itemId
      );
    }

    const item =
      await prisma.wasteStockItem.update({
        where: {
          id: currentItem.id,
        },

        data: {
          ...(data.name !== undefined
            ? {
                name:
                  normalizeRequiredText(
                    data.name
                  ),
              }
            : {}),

          ...(data.category !== undefined
            ? {
                category:
                  normalizeRequiredText(
                    data.category
                  ),
              }
            : {}),

          ...(data.subcategory !== undefined
            ? {
                subcategory:
                  normalizeText(
                    data.subcategory
                  ),
              }
            : {}),

          ...(data.unit !== undefined
            ? {
                unit: data.unit,
              }
            : {}),

          ...(data.ncm !== undefined
            ? {
                ncm: normalizeNcm(
                  data.ncm
                ),
              }
            : {}),

          ...(data.internalCode !== undefined
            ? {
                internalCode:
                  normalizeInternalCode(
                    data.internalCode
                  ),
              }
            : {}),

          ...(data.wasteClass !== undefined
            ? {
                wasteClass:
                  data.wasteClass,
              }
            : {}),

          ...(data.description !== undefined
            ? {
                description:
                  normalizeText(
                    data.description
                  ),
              }
            : {}),

          ...(data.status !== undefined
            ? {
                status: data.status,
              }
            : {}),
        },

        include: {
          lots: {
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      });

    return {
      success: true,
      message:
        "Tipo de resíduo atualizado com sucesso.",
      item: mapWasteStockItem(item),
    };
  }

  async deactivateItem(
    user: AuthUser,
    itemId: string
  ) {
    const cooperative =
      await this.getAuthenticatedCooperative(user);

    const currentItem =
      await this.ensureItemBelongsToCooperative(
        cooperative.id,
        itemId
      );

    if (
      currentItem.status ===
      WasteStockStatus.INACTIVE
    ) {
      return {
        success: true,
        message:
          "O tipo de resíduo já está inativo.",
        item: currentItem,
      };
    }

    const item =
      await prisma.wasteStockItem.update({
        where: {
          id: currentItem.id,
        },

        data: {
          status:
            WasteStockStatus.INACTIVE,
        },

        include: {
          lots: {
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      });

    return {
      success: true,
      message:
        "Tipo de resíduo inativado com sucesso.",
      item: mapWasteStockItem(item),
    };
  }

  /*
   * ============================================================
   * LOTES DE ESTOQUE
   * ============================================================
   */

  async listLots(
    user: AuthUser,
    stockItemId: string
  ) {
    const cooperative =
      await this.getAuthenticatedCooperative(user);

    const item =
      await this.ensureItemBelongsToCooperative(
        cooperative.id,
        stockItemId
      );

    const lots =
      await prisma.wasteStockLot.findMany({
        where: {
          cooperativeId: cooperative.id,
          stockItemId: item.id,
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    return {
      success: true,
      item,
      lots,
      total: lots.length,
    };
  }

  async createLot(
    user: AuthUser,
    stockItemId: string,
    data: CreateWasteStockLotInput
  ) {
    const cooperative =
      await this.getAuthenticatedCooperative(user);

    const item =
      await this.ensureItemBelongsToCooperative(
        cooperative.id,
        stockItemId
      );

    if (
      item.status ===
      WasteStockStatus.INACTIVE
    ) {
      throw new Error(
        "Não é possível adicionar lotes a um tipo de resíduo inativo."
      );
    }

    const lotCode =
      normalizeRequiredText(data.lotCode);

    await this.ensureUniqueLotCode(
      cooperative.id,
      lotCode
    );

    const quantity =
      normalizeQuantity(data.quantity);

    const unit =
      normalizeUnit(data.unit || item.unit);

    const lot =
      await prisma.wasteStockLot.create({
        data: {
          cooperativeId: cooperative.id,
          stockItemId: item.id,

          lotCode,

          quantity,

          quantityKg:
            quantityToKgCompatibility(
              quantity,
              unit
            ),

          unit,

          storageLocation:
            normalizeText(
              data.storageLocation
            ),

          processingStage:
            data.processingStage ||
            WasteProcessingStage.TRIADO,

          origin: normalizeText(data.origin),

          notes: normalizeText(data.notes),

          status:
            data.status ||
            WasteLotStatus.AVAILABLE,
        },

        include: {
          stockItem: true,
        },
      });

    return {
      success: true,
      message:
        "Lote cadastrado com sucesso.",
      lot,
    };
  }

  async updateLot(
    user: AuthUser,
    lotId: string,
    data: UpdateWasteStockLotInput
  ) {
    const cooperative =
      await this.getAuthenticatedCooperative(user);

    const currentLot =
      await this.ensureLotBelongsToCooperative(
        cooperative.id,
        lotId
      );

    if (data.lotCode !== undefined) {
      await this.ensureUniqueLotCode(
        cooperative.id,
        data.lotCode,
        lotId
      );
    }

    const nextQuantity =
      data.quantity !== undefined
        ? normalizeQuantity(data.quantity)
        : getEffectiveLotQuantity(
            currentLot
          );

    const nextUnit =
      data.unit ||
      currentLot.unit ||
      currentLot.stockItem.unit ||
      WasteUnit.KG;

    const lot =
      await prisma.wasteStockLot.update({
        where: {
          id: currentLot.id,
        },

        data: {
          ...(data.lotCode !== undefined
            ? {
                lotCode:
                  normalizeRequiredText(
                    data.lotCode
                  ),
              }
            : {}),

          ...(data.quantity !== undefined
            ? {
                quantity: nextQuantity,

                quantityKg:
                  quantityToKgCompatibility(
                    nextQuantity,
                    nextUnit
                  ),
              }
            : data.unit !== undefined
              ? {
                  quantityKg:
                    quantityToKgCompatibility(
                      nextQuantity,
                      nextUnit
                    ),
                }
              : {}),

          ...(data.unit !== undefined
            ? {
                unit: data.unit,
              }
            : {}),

          ...(data.storageLocation !==
          undefined
            ? {
                storageLocation:
                  normalizeText(
                    data.storageLocation
                  ),
              }
            : {}),

          ...(data.processingStage !==
          undefined
            ? {
                processingStage:
                  data.processingStage,
              }
            : {}),

          ...(data.origin !== undefined
            ? {
                origin:
                  normalizeText(
                    data.origin
                  ),
              }
            : {}),

          ...(data.notes !== undefined
            ? {
                notes:
                  normalizeText(
                    data.notes
                  ),
              }
            : {}),

          ...(data.status !== undefined
            ? {
                status: data.status,
              }
            : {}),
        },

        include: {
          stockItem: true,
        },
      });

    return {
      success: true,
      message:
        "Lote atualizado com sucesso.",
      lot,
    };
  }

  async discardLot(
    user: AuthUser,
    lotId: string
  ) {
    const cooperative =
      await this.getAuthenticatedCooperative(user);

    const currentLot =
      await this.ensureLotBelongsToCooperative(
        cooperative.id,
        lotId
      );

    if (
      currentLot.status ===
      WasteLotStatus.DISCARDED
    ) {
      return {
        success: true,
        message:
          "O lote já está descartado.",
        lot: currentLot,
      };
    }

    const lot =
      await prisma.wasteStockLot.update({
        where: {
          id: currentLot.id,
        },

        data: {
          status:
            WasteLotStatus.DISCARDED,
        },

        include: {
          stockItem: true,
        },
      });

    return {
      success: true,
      message:
        "Lote descartado com sucesso.",
      lot,
    };
  }

  /*
   * ============================================================
   * COMPATIBILIDADE COM O FRONTEND ANTIGO
   * ============================================================
   */

  async listMine(user: AuthUser) {
    return this.listItems(user);
  }

  async findById(
    user: AuthUser,
    id: string
  ) {
    return this.findItemById(user, id);
  }

  async create(
    user: AuthUser,
    payload: CreateLegacyWasteStockInput
  ) {
    const cooperative =
      await this.getAuthenticatedCooperative(user);

    const itemData = payload.item;
    const lotData = payload.lot;

    const name =
      normalizeRequiredText(itemData.name);

    await this.ensureUniqueItemName(
      cooperative.id,
      name
    );

    await this.ensureUniqueInternalCode(
      cooperative.id,
      itemData.internalCode
    );

    const lotCode =
      normalizeRequiredText(
        lotData.lotCode
      );

    await this.ensureUniqueLotCode(
      cooperative.id,
      lotCode
    );

    const quantity =
      normalizeQuantity(
        lotData.quantity ??
          lotData.quantityKg
      );

    const unit =
      normalizeUnit(
        lotData.unit ||
          itemData.unit ||
          WasteUnit.KG
      );

    const result =
      await prisma.$transaction(
        async (transaction) => {
          const item =
            await transaction.wasteStockItem.create({
              data: {
                cooperativeId:
                  cooperative.id,

                name,

                category:
                  normalizeRequiredText(
                    itemData.category
                  ),

                subcategory:
                  normalizeText(
                    itemData.subcategory
                  ),

                unit:
                  normalizeUnit(
                    itemData.unit
                  ),

                ncm:
                  normalizeNcm(
                    itemData.ncm
                  ),

                internalCode:
                  normalizeInternalCode(
                    itemData.internalCode
                  ),

                wasteClass:
                  itemData.wasteClass ||
                  WasteClass.NOT_INFORMED,

                description:
                  normalizeText(
                    itemData.description
                  ),

                status:
                  itemData.status ||
                  WasteStockStatus.ACTIVE,
              },
            });

          const lot =
            await transaction.wasteStockLot.create({
              data: {
                cooperativeId:
                  cooperative.id,

                stockItemId: item.id,

                lotCode,

                quantity,

                quantityKg:
                  quantityToKgCompatibility(
                    quantity,
                    unit
                  ),

                unit,

                storageLocation:
                  normalizeText(
                    lotData.storageLocation
                  ),

                processingStage:
                  lotData.processingStage ||
                  WasteProcessingStage.TRIADO,

                origin:
                  normalizeText(
                    lotData.origin
                  ),

                notes:
                  normalizeText(
                    lotData.notes
                  ),

                status:
                  lotData.status ||
                  WasteLotStatus.AVAILABLE,
              },
            });

          return {
            item,
            lot,
          };
        }
      );

    return {
      success: true,
      message:
        "Material e lote cadastrados no estoque com sucesso.",
      ...result,
    };
  }

  async update(
    user: AuthUser,
    id: string,
    payload:
      | UpdateWasteStockItemInput
      | {
          item?: UpdateWasteStockItemInput;
        }
  ) {
    const itemPayload =
      "item" in payload && payload.item
        ? payload.item
        : (payload as UpdateWasteStockItemInput);

    return this.updateItem(
      user,
      id,
      itemPayload
    );
  }

  async delete(
    user: AuthUser,
    id: string
  ) {
    return this.deactivateItem(
      user,
      id
    );
  }

  async deleteLot(
    user: AuthUser,
    lotId: string
  ) {
    return this.discardLot(
      user,
      lotId
    );
  }
}