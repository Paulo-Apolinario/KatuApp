import { FastifyReply, FastifyRequest } from "fastify";
import { FeedbackCategory as PrismaFeedbackCategory } from "@prisma/client";
import { createFeedback } from "./feedback.service";

type CreateFeedbackBody = {
  npsScore: number;
  categories: PrismaFeedbackCategory[];
  reason?: string;
  improvement?: string;
  likes?: string;
  continuity?: string;
};

export async function createFeedbackController(
  request: FastifyRequest<{ Body: CreateFeedbackBody }>,
  reply: FastifyReply
) {
  try {
    console.log("[FEEDBACK][request.user]", (request as any).user);

    const authUser = (request as any).user;

    const authenticatedUserId =
      authUser?.id ||
      authUser?.userId ||
      authUser?.sub ||
      null;

    if (!authenticatedUserId) {
      return reply.status(401).send({
        success: false,
        message: "Usuário não autenticado.",
      });
    }

    const result = await createFeedback({
      userId: authenticatedUserId,
      npsScore: request.body.npsScore,
      categories: request.body.categories,
      reason: request.body.reason,
      improvement: request.body.improvement,
      likes: request.body.likes,
      continuity: request.body.continuity,
    });

    return reply.status(201).send(result);
  } catch (error: any) {
    console.error("[FEEDBACK] createFeedbackController:", error);

    return reply.status(400).send({
      success: false,
      message: error?.message || "Não foi possível registrar o feedback.",
    });
  }
}