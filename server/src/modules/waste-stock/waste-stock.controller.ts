import { FastifyReply, FastifyRequest } from "fastify";
import { WasteStockService } from "./waste-stock.service";

const wasteStockService = new WasteStockService();

export class WasteStockController {
  async listMine(request: FastifyRequest, reply: FastifyReply) {
    try {
      const result = await wasteStockService.listMine(request.user as any);
      return reply.send(result);
    } catch (error: any) {
      return reply.badRequest(error.message || "Erro ao listar estoque.");
    }
  }

  async findById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const result = await wasteStockService.findById(
        request.user as any,
        request.params.id
      );

      return reply.send(result);
    } catch (error: any) {
      return reply.badRequest(
        error.message || "Erro ao buscar material de estoque."
      );
    }
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const result = await wasteStockService.create(
        request.user as any,
        request.body
      );

      return reply.status(201).send(result);
    } catch (error: any) {
      return reply.badRequest(
        error.message || "Erro ao cadastrar estoque de resíduos."
      );
    }
  }

  async update(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const result = await wasteStockService.update(
        request.user as any,
        request.params.id,
        request.body
      );

      return reply.send(result);
    } catch (error: any) {
      return reply.badRequest(
        error.message || "Erro ao atualizar material de estoque."
      );
    }
  }

  async delete(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const result = await wasteStockService.delete(
        request.user as any,
        request.params.id
      );

      return reply.send(result);
    } catch (error: any) {
      return reply.badRequest(
        error.message || "Erro ao remover material de estoque."
      );
    }
  }

  async listLots(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const result = await wasteStockService.listLots(
        request.user as any,
        request.params.id
      );

      return reply.send(result);
    } catch (error: any) {
      return reply.badRequest(error.message || "Erro ao listar lotes.");
    }
  }

  async createLot(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const result = await wasteStockService.createLot(
        request.user as any,
        request.params.id,
        request.body
      );

      return reply.status(201).send(result);
    } catch (error: any) {
      return reply.badRequest(error.message || "Erro ao cadastrar lote.");
    }
  }

  async updateLot(
    request: FastifyRequest<{ Params: { lotId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const result = await wasteStockService.updateLot(
        request.user as any,
        request.params.lotId,
        request.body
      );

      return reply.send(result);
    } catch (error: any) {
      return reply.badRequest(error.message || "Erro ao atualizar lote.");
    }
  }

  async deleteLot(
    request: FastifyRequest<{ Params: { lotId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const result = await wasteStockService.deleteLot(
        request.user as any,
        request.params.lotId
      );

      return reply.send(result);
    } catch (error: any) {
      return reply.badRequest(error.message || "Erro ao remover lote.");
    }
  }
}