import { FastifyInstance } from "fastify";
import { createFeedbackController } from "./feedback.controller";
import { createFeedbackSchema } from "./feedback.schemas";

export async function feedbackRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/feedback",
    {
      schema: createFeedbackSchema,
      preHandler: [fastify.authenticate],
    },
    createFeedbackController
  );
}