import {
  PrismaClient,
  WasteLotStatus,
  WasteProcessingStage,
  WasteStockStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

type AuthUser = {
  id?: string;
  sub?: string;
  userId?: string;
  role?: string;
};

function getAuthUserId(user: AuthUser) {
  return user?.id || user?.sub || user?.userId;
}

export class WasteStockService {
  async getCooperativeIdFromUser(user: AuthUser) {
    const userId = getAuthUserId(user);

    if (!userId) {
      throw new Error("Usuário autenticado não identificado.");
    }

    const foundUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        cooperative: true,
      },
    });

    if (!foundUser) {
      throw new Error("Usuário não encontrado.");
    }

    if (!foundUser.cooperative?.id) {
      throw new Error("Usuário não está vinculado a uma cooperativa.");
    }

    return foundUser.cooperative.id;
  }

  async listMine(user: AuthUser) {
    const cooperativeId = await this.getCooperativeIdFromUser(user);

    const items = await prisma.wasteStockItem.findMany({
      where: {
        cooperativeId,
      },
      include: {
        lots: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const stock = items.map((item) => {
      const totalQuantityKg = item.lots.reduce((sum, lot) => {
        if (lot.status === "DISCARDED") return sum;
        return sum + Number(lot.quantityKg || 0);
      }, 0);

      return {
        ...item,
        totalQuantityKg,
        lotsCount: item.lots.length,
      };
    });

    return {
      success: true,
      stock,
      items: stock,
    };
  }

  async findById(user: AuthUser, id: string) {
    const cooperativeId = await this.getCooperativeIdFromUser(user);

    const item = await prisma.wasteStockItem.findFirst({
      where: {
        id,
        cooperativeId,
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
      throw new Error("Material de estoque não encontrado.");
    }

    return {
      success: true,
      item,
    };
  }

  async create(user: AuthUser, payload: any) {
    const cooperativeId = await this.getCooperativeIdFromUser(user);

    const itemPayload = payload?.item || {};
    const lotPayload = payload?.lot || {};

    if (!itemPayload.name) {
      throw new Error("Nome do material é obrigatório.");
    }

    if (!itemPayload.category) {
      throw new Error("Categoria do material é obrigatória.");
    }

    if (!lotPayload.lotCode) {
      throw new Error("Código do lote é obrigatório.");
    }

    const quantityKg = Number(lotPayload.quantityKg || 0);

    if (quantityKg <= 0) {
      throw new Error("Quantidade do lote deve ser maior que zero.");
    }

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.wasteStockItem.create({
        data: {
          cooperativeId,
          name: String(itemPayload.name).trim(),
          category: String(itemPayload.category).trim(),
          description: itemPayload.description || null,
          status: itemPayload.status || WasteStockStatus.ACTIVE,
        },
      });

      const lot = await tx.wasteStockLot.create({
        data: {
          cooperativeId,
          stockItemId: item.id,
          lotCode: String(lotPayload.lotCode).trim(),
          quantityKg,
          storageLocation: lotPayload.storageLocation || null,
          processingStage:
            lotPayload.processingStage || WasteProcessingStage.TRIADO,
          origin: lotPayload.origin || null,
          notes: lotPayload.notes || null,
          status: lotPayload.status || WasteLotStatus.AVAILABLE,
        },
      });

      return { item, lot };
    });

    return {
      success: true,
      message: "Material e lote cadastrados no estoque com sucesso.",
      ...result,
    };
  }

  async update(user: AuthUser, id: string, payload: any) {
    const cooperativeId = await this.getCooperativeIdFromUser(user);

    const exists = await prisma.wasteStockItem.findFirst({
      where: {
        id,
        cooperativeId,
      },
    });

    if (!exists) {
      throw new Error("Material de estoque não encontrado.");
    }

    const itemPayload = payload?.item || payload || {};

    const item = await prisma.wasteStockItem.update({
      where: {
        id,
      },
      data: {
        name: itemPayload.name ?? exists.name,
        category: itemPayload.category ?? exists.category,
        description: itemPayload.description ?? exists.description,
        status: itemPayload.status ?? exists.status,
      },
      include: {
        lots: true,
      },
    });

    return {
      success: true,
      message: "Material de estoque atualizado com sucesso.",
      item,
    };
  }

  async delete(user: AuthUser, id: string) {
    const cooperativeId = await this.getCooperativeIdFromUser(user);

    const exists = await prisma.wasteStockItem.findFirst({
      where: {
        id,
        cooperativeId,
      },
    });

    if (!exists) {
      throw new Error("Material de estoque não encontrado.");
    }

    const item = await prisma.wasteStockItem.update({
      where: {
        id,
      },
      data: {
        status: WasteStockStatus.INACTIVE,
      },
    });

    return {
      success: true,
      message: "Material de estoque inativado com sucesso.",
      item,
    };
  }

  async listLots(user: AuthUser, stockItemId: string) {
    const cooperativeId = await this.getCooperativeIdFromUser(user);

    const item = await prisma.wasteStockItem.findFirst({
      where: {
        id: stockItemId,
        cooperativeId,
      },
    });

    if (!item) {
      throw new Error("Material de estoque não encontrado.");
    }

    const lots = await prisma.wasteStockLot.findMany({
      where: {
        cooperativeId,
        stockItemId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return {
      success: true,
      lots,
    };
  }

  async createLot(user: AuthUser, stockItemId: string, payload: any) {
    const cooperativeId = await this.getCooperativeIdFromUser(user);

    const item = await prisma.wasteStockItem.findFirst({
      where: {
        id: stockItemId,
        cooperativeId,
      },
    });

    if (!item) {
      throw new Error("Material de estoque não encontrado.");
    }

    const quantityKg = Number(payload.quantityKg || 0);

    if (!payload.lotCode) {
      throw new Error("Código do lote é obrigatório.");
    }

    if (quantityKg <= 0) {
      throw new Error("Quantidade do lote deve ser maior que zero.");
    }

    const lot = await prisma.wasteStockLot.create({
      data: {
        cooperativeId,
        stockItemId,
        lotCode: String(payload.lotCode).trim(),
        quantityKg,
        storageLocation: payload.storageLocation || null,
        processingStage: payload.processingStage || WasteProcessingStage.TRIADO,
        origin: payload.origin || null,
        notes: payload.notes || null,
        status: payload.status || WasteLotStatus.AVAILABLE,
      },
    });

    return {
      success: true,
      message: "Lote cadastrado com sucesso.",
      lot,
    };
  }

  async updateLot(user: AuthUser, lotId: string, payload: any) {
    const cooperativeId = await this.getCooperativeIdFromUser(user);

    const exists = await prisma.wasteStockLot.findFirst({
      where: {
        id: lotId,
        cooperativeId,
      },
    });

    if (!exists) {
      throw new Error("Lote não encontrado.");
    }

    const lot = await prisma.wasteStockLot.update({
      where: {
        id: lotId,
      },
      data: {
        lotCode: payload.lotCode ?? exists.lotCode,
        quantityKg:
          payload.quantityKg !== undefined
            ? Number(payload.quantityKg)
            : exists.quantityKg,
        storageLocation: payload.storageLocation ?? exists.storageLocation,
        processingStage: payload.processingStage ?? exists.processingStage,
        origin: payload.origin ?? exists.origin,
        notes: payload.notes ?? exists.notes,
        status: payload.status ?? exists.status,
      },
    });

    return {
      success: true,
      message: "Lote atualizado com sucesso.",
      lot,
    };
  }

  async deleteLot(user: AuthUser, lotId: string) {
    const cooperativeId = await this.getCooperativeIdFromUser(user);

    const exists = await prisma.wasteStockLot.findFirst({
      where: {
        id: lotId,
        cooperativeId,
      },
    });

    if (!exists) {
      throw new Error("Lote não encontrado.");
    }

    const lot = await prisma.wasteStockLot.update({
      where: {
        id: lotId,
      },
      data: {
        status: WasteLotStatus.DISCARDED,
      },
    });

    return {
      success: true,
      message: "Lote descartado/inativado com sucesso.",
      lot,
    };
  }
}