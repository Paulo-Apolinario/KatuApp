import { FastifyReply, FastifyRequest } from "fastify";

import { AuthService } from "./auth.service";
import {
  activateGeneratorAccessSchema,
  forgotPasswordSchema,
  loginSchema,
  registerCooperativeSchema,
  registerPfSchema,
  resetPasswordSchema,
} from "./auth.schemas";

const authService = new AuthService();

function serializeUser(user: any) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    accountStatus: user.accountStatus,
    isActive: user.isActive,
    phone: user.phone,
    rememberMe: user.rememberMe,
    personProfile: user.personProfile ?? null,
    generator: user.generator ?? null,
    collector: user.collector ?? null,
    cooperative: user.cooperative ?? null,
    driver: user.driver ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export class AuthController {
  async registerPf(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = registerPfSchema.parse(request.body);

      const user = await authService.registerPf(body);

      const token = await reply.jwtSign({
        sub: user.id,
        role: user.role,
        email: user.email,
      });

      return reply.status(201).send({
        success: true,
        token,
        user: serializeUser(user),
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || "Erro ao registrar pessoa física.",
      });
    }
  }

  async registerCooperative(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = registerCooperativeSchema.parse(request.body);

      const result = await authService.registerCooperative(body);

      const token = await reply.jwtSign({
        sub: result.user.id,
        role: result.user.role,
        email: result.user.email,
      });

      return reply.status(201).send({
        success: true,
        token,
        user: serializeUser(result.user),
        cooperative: result.cooperative,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || "Erro ao registrar cooperativa.",
      });
    }
  }

  async login(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = loginSchema.parse(request.body);

      const user = await authService.login(body);

      const token = await reply.jwtSign({
        sub: user.id,
        role: user.role,
        email: user.email,
      });

      return reply.send({
        success: true,
        token,
        user: serializeUser(user),
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || "Erro ao fazer login.",
      });
    }
  }

  async me(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authUser = request.user as { sub: string };

      const user = await authService.getMe(authUser.sub);

      return reply.send({
        success: true,
        user: serializeUser(user),
      });
    } catch (error: any) {
      return reply.status(404).send({
        success: false,
        error: error.message || "Erro ao buscar usuário.",
      });
    }
  }

  async activateGeneratorAccess(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      const body = activateGeneratorAccessSchema.parse(request.body);

      const result = await authService.activateGeneratorAccess(body);

      const token = await reply.jwtSign({
        sub: result.user.id,
        role: result.user.role,
        email: result.user.email,
      });

      return reply.status(201).send({
        success: true,
        message: "Acesso liberado com sucesso.",
        token,
        user: serializeUser(result.user),
        generator: result.generator ?? null,
        collector: result.collector ?? null,
        driver: result.driver ?? null,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || "Erro ao liberar acesso.",
      });
    }
  }

  async forgotPassword(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = forgotPasswordSchema.parse(request.body);

      const result = await authService.forgotPassword(body);

      return reply.send({
        success: true,
        message: result.message,
        resetToken: result.resetToken,
        expiresAt: result.expiresAt ?? null,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || "Erro ao solicitar redefinição de senha.",
      });
    }
  }

  async resetPassword(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = resetPasswordSchema.parse(request.body);

      const result = await authService.resetPassword(body);

      return reply.send({
        success: true,
        message: result.message,
      });
    } catch (error: any) {
      return reply.status(400).send({
        success: false,
        error: error.message || "Erro ao redefinir senha.",
      });
    }
  }
}