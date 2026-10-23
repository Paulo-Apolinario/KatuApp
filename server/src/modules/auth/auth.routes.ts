import { isIP } from "node:net";
import { FastifyInstance } from "fastify";
import { AuthController } from "./auth.controller";

const authController = new AuthController();

export async function authRoutes(app: FastifyInstance) {
  app.post("/register/pf", authController.registerPf);
  app.post("/register/cooperative", authController.registerCooperative);
  app.post("/login", authController.login);
  app.post("/activate-generator-access", authController.activateGeneratorAccess);
  // Só aceita o último IP encaminhado quando a conexão vem do proxy local.
  // Para múltiplas instâncias, aplicar também limite no proxy/armazenamento compartilhado.
  const buckets = new Map<string, { count: number; until: number }>();
  const emailLimit = async (request: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) => {
    const now = Date.now();
    for (const [key, value] of buckets) if (value.until <= now) buckets.delete(key);
    const peer = request.raw.socket.remoteAddress || "unknown";
    const forwarded = String(request.headers["x-forwarded-for"] || "").split(",").at(-1)?.trim() || "";
    const localProxy = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(peer);
    const key = localProxy && isIP(forwarded) ? forwarded : peer;
    const bucket = buckets.get(key) || { count: 0, until: now + 15 * 60000 };
    if (bucket.count >= 20 || (!buckets.has(key) && buckets.size >= 10000)) {
      reply.header("Retry-After", "900");
      return reply.code(429).send({ success: false, error: "Muitas tentativas. Aguarde antes de tentar novamente." });
    }
    bucket.count++; buckets.set(key, bucket);
  };
  app.post("/login-link", { preHandler: emailLimit }, authController.requestLoginLink);
  app.post("/login-link/consume", { preHandler: emailLimit }, authController.consumeLoginLink);
  app.post("/forgot-password", { preHandler: emailLimit }, authController.forgotPassword);
  app.post("/reset-password", authController.resetPassword);

  app.get(
    "/me",
    {
      preHandler: [app.authenticate],
    },
    authController.me
  );

  app.patch(
    "/profile",
    {
      preHandler: [app.authenticate],
    },
    authController.updateProfile
  );

  app.patch(
    "/change-password",
    {
      preHandler: [app.authenticate],
    },
    authController.changePassword
  );
}