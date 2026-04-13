import { FastifyInstance } from "fastify";
import { AuthController } from "./auth.controller";

const authController = new AuthController();

export async function authRoutes(app: FastifyInstance) {
  app.post("/register/pf", authController.registerPf);
  app.post("/register/cooperative", authController.registerCooperative);
  app.post("/login", authController.login);
  app.post("/activate-generator-access", authController.activateGeneratorAccess);
  app.post("/forgot-password", authController.forgotPassword);
  app.post("/reset-password", authController.resetPassword);

  app.get(
    "/me",
    {
      preHandler: [app.authenticate],
    },
    authController.me
  );
}