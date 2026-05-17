import crypto from "node:crypto";
import {
  AccountStatus,
  DriverStatus,
  GeneratorAccessStatus,
  GeneratorType,
  UserRole,
} from "@prisma/client";
import nodemailer from "nodemailer";

import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { hashPassword, comparePassword } from "../../utils/hash";
import {
  ActivateGeneratorAccessInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterCooperativeInput,
  RegisterPfInput,
  ResetPasswordInput,
} from "./auth.schemas";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function sanitizeDocument(value: string) {
  return value.replace(/\D/g, "");
}

function buildAddress(data: {
  address?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}) {
  if (data.address?.trim()) {
    return data.address.trim();
  }

  const parts = [
    data.street?.trim(),
    data.number?.trim(),
    data.neighborhood?.trim(),
    data.city?.trim(),
    data.state?.trim(),
    data.zipCode?.trim(),
  ].filter(Boolean);

  return parts.length ? parts.join(", ") : null;
}

function generateTemporaryPassword() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

async function sendPasswordResetEmail(data: {
  to: string;
  name: string;
  resetToken: string;
  temporaryPassword: string;
  expiresAt: Date;
}) {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS || !env.SMTP_FROM) {
    console.warn("SMTP não configurado. Email de recuperação não será enviado.");
    return;
  }

  const resetUrl = `${env.APP_WEB_URL}/reset-password?email=${encodeURIComponent(
    data.to
  )}&token=${encodeURIComponent(data.resetToken)}`;

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: data.to,
    subject: "Redefinição de senha - KATUÁ",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; color: #111827;">
        <h2 style="color: #028C56;">Redefinição de senha - KATUÁ</h2>

        <p>Olá, <strong>${data.name}</strong>.</p>

        <p>Recebemos uma solicitação para redefinir sua senha de acesso ao sistema KATUÁ.</p>

        <p><strong>Senha temporária:</strong></p>

        <div style="font-size: 22px; font-weight: bold; letter-spacing: 2px; background: #F3F4F6; padding: 14px; border-radius: 10px; margin: 16px 0;">
          ${data.temporaryPassword}
        </div>

        <p>Clique no botão abaixo para criar sua nova senha:</p>

        <p>
          <a href="${resetUrl}" style="display: inline-block; background: #028C56; color: #FFFFFF; padding: 12px 18px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Redefinir minha senha
          </a>
        </p>

        <p>Esse link expira em 15 minutos.</p>

        <p style="color: #6B7280; font-size: 13px;">
          Se você não solicitou essa recuperação, ignore este e-mail.
        </p>
      </div>
    `,
  });
}

export class AuthService {
  async registerPf(data: RegisterPfInput) {
    const email = normalizeEmail(data.email);
    const cpf = sanitizeDocument(data.cpf);

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error("Este e-mail já está em uso.");
    }

    const existingCpf = await prisma.personProfile.findUnique({
      where: { cpf },
    });

    if (existingCpf) {
      throw new Error("Este CPF já está cadastrado.");
    }

    const passwordHash = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName: data.displayName.trim(),
        role: UserRole.PF,
        accountStatus: AccountStatus.ACTIVE,
        isActive: true,
        phone: data.phone.trim(),
        rememberMe: data.rememberMe ?? false,
        personProfile: {
          create: {
            cpf,
            address: data.address?.trim() || null,
            totalKg: 0,
            greenStreak: 0,
          },
        },
      },
      include: {
        personProfile: true,
        generator: true,
        collector: true,
        cooperative: true,
        driver: true,
      },
    });

    return user;
  }

  async registerCooperative(data: RegisterCooperativeInput) {
    const email = normalizeEmail(data.email);
    const registrationNumber = sanitizeDocument(data.registrationNumber);

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error("Este e-mail já está em uso.");
    }

    const existingCooperativeByEmail = await prisma.cooperative.findUnique({
      where: { email },
    });

    if (existingCooperativeByEmail) {
      throw new Error("Já existe cooperativa cadastrada com este e-mail.");
    }

    const existingCooperativeByRegistration =
      await prisma.cooperative.findUnique({
        where: { registrationNumber },
      });

    if (existingCooperativeByRegistration) {
      throw new Error("Já existe cooperativa cadastrada com este registro.");
    }

    const passwordHash = await hashPassword(data.password);

    const address = buildAddress({
      address: data.address,
      zipCode: data.zipCode,
      street: data.street,
      number: data.number,
      neighborhood: data.neighborhood,
      city: data.city,
      state: data.state,
    });

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          displayName: data.displayName.trim(),
          role: UserRole.COOPERATIVE,
          accountStatus: AccountStatus.ACTIVE,
          isActive: true,
          phone: data.phone.trim(),
          rememberMe: data.rememberMe ?? false,
        },
      });

      const cooperative = await tx.cooperative.create({
        data: {
          userId: user.id,
          name: data.cooperativeName.trim(),
          registrationNumber,
          email,
          phone: data.phone.trim(),

          address,

          zipCode: data.zipCode?.trim() || null,
          street: data.street?.trim() || null,
          number: data.number?.trim() || null,
          neighborhood: data.neighborhood?.trim() || null,
          city: data.city?.trim() || null,
          state: data.state?.trim() || null,

          latitude:
            typeof data.latitude === "number" && !Number.isNaN(data.latitude)
              ? data.latitude
              : null,
          longitude:
            typeof data.longitude === "number" && !Number.isNaN(data.longitude)
              ? data.longitude
              : null,
        },
      });

      const hydratedUser = await tx.user.findUnique({
        where: { id: user.id },
        include: {
          personProfile: true,
          generator: true,
          collector: true,
          cooperative: true,
          driver: true,
        },
      });

      if (!hydratedUser) {
        throw new Error("Erro ao carregar o usuário da cooperativa.");
      }

      return {
        user: hydratedUser,
        cooperative,
      };
    });

    return result;
  }

  async login(data: LoginInput) {
    const email = normalizeEmail(data.email);

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        personProfile: true,
        generator: true,
        collector: true,
        cooperative: true,
        driver: true,
      },
    });

    if (!user) {
      throw new Error("E-mail ou senha inválidos.");
    }

    if (!user.isActive || user.accountStatus !== AccountStatus.ACTIVE) {
      throw new Error("Conta inativa ou bloqueada.");
    }

    const passwordMatches = await comparePassword(
      data.password,
      user.passwordHash
    );

    if (!passwordMatches) {
      throw new Error("E-mail ou senha inválidos.");
    }

    return user;
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        personProfile: true,
        generator: true,
        collector: true,
        cooperative: true,
        driver: true,
      },
    });

    if (!user) {
      throw new Error("Usuário não encontrado.");
    }

    return user;
  }

  async updateProfile(
    userId: string,
    data: {
      displayName: string;
    }
  ) {
    const displayName = data.displayName.trim();

    if (!displayName) {
      throw new Error("Informe o nome completo.");
    }

    if (displayName.length < 3) {
      throw new Error("O nome precisa ter pelo menos 3 caracteres.");
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        personProfile: true,
        generator: true,
        collector: true,
        cooperative: true,
        driver: true,
      },
    });

    if (!currentUser) {
      throw new Error("Usuário não encontrado.");
    }

    if (!currentUser.isActive || currentUser.accountStatus !== AccountStatus.ACTIVE) {
      throw new Error("Conta inativa ou bloqueada.");
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          displayName,
        },
      });

      if (currentUser.role === UserRole.COOPERATIVE && currentUser.cooperative) {
        await tx.cooperative.update({
          where: { id: currentUser.cooperative.id },
          data: {
            name: displayName,
          },
        });
      }

      if (
        (currentUser.role === UserRole.GENERATOR_SMALL ||
          currentUser.role === UserRole.GENERATOR_LARGE) &&
        currentUser.generator
      ) {
        await tx.generator.update({
          where: { id: currentUser.generator.id },
          data: {
            name: displayName,
          },
        });
      }

      if (currentUser.role === UserRole.COLLECTOR && currentUser.collector) {
        await tx.collector.update({
          where: { id: currentUser.collector.id },
          data: {
            name: displayName,
          },
        });
      }

      if (currentUser.role === UserRole.DRIVER && currentUser.driver) {
        await tx.driver.update({
          where: { id: currentUser.driver.id },
          data: {
            name: displayName,
          },
        });
      }

      const hydratedUser = await tx.user.findUnique({
        where: { id: userId },
        include: {
          personProfile: true,
          generator: true,
          collector: true,
          cooperative: true,
          driver: true,
        },
      });

      if (!hydratedUser) {
        throw new Error("Erro ao carregar usuário atualizado.");
      }

      return hydratedUser;
    });

    return updatedUser;
  }

  async changePassword(
    userId: string,
    data: {
      currentPassword: string;
      newPassword: string;
    }
  ) {
    const currentPassword = data.currentPassword;
    const newPassword = data.newPassword;

    if (!currentPassword) {
      throw new Error("Informe a senha atual.");
    }

    if (!newPassword) {
      throw new Error("Informe a nova senha.");
    }

    if (newPassword.length < 6) {
      throw new Error("A nova senha precisa ter pelo menos 6 caracteres.");
    }

    if (currentPassword === newPassword) {
      throw new Error("A nova senha precisa ser diferente da senha atual.");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("Usuário não encontrado.");
    }

    if (!user.isActive || user.accountStatus !== AccountStatus.ACTIVE) {
      throw new Error("Conta inativa ou bloqueada.");
    }

    const passwordMatches = await comparePassword(
      currentPassword,
      user.passwordHash
    );

    if (!passwordMatches) {
      throw new Error("Senha atual inválida.");
    }

    const passwordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        resetPasswordToken: null,
        resetPasswordExpiresAt: null,
      },
    });

    return {
      message: "Senha alterada com sucesso.",
    };
  }

  async activateGeneratorAccess(data: ActivateGeneratorAccessInput) {
    const email = normalizeEmail(data.email);

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error("Este e-mail já possui acesso liberado.");
    }

    const generator = await prisma.generator.findUnique({
      where: { email },
    });

    if (generator) {
      if (
        generator.accessReleased ||
        generator.accessStatus === GeneratorAccessStatus.ACTIVE
      ) {
        throw new Error("Este gerador já possui acesso ativo.");
      }

      const passwordHash = await hashPassword(data.password);

      const role =
        generator.type === GeneratorType.LARGE
          ? UserRole.GENERATOR_LARGE
          : UserRole.GENERATOR_SMALL;

      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            passwordHash,
            displayName: generator.name,
            role,
            accountStatus: AccountStatus.ACTIVE,
            isActive: true,
            phone: generator.phone || null,
          },
          include: {
            personProfile: true,
            generator: true,
            collector: true,
            cooperative: true,
            driver: true,
          },
        });

        const updatedGenerator = await tx.generator.update({
          where: { id: generator.id },
          data: {
            userId: user.id,
            accessReleased: true,
            accessStatus: GeneratorAccessStatus.ACTIVE,
            activatedAt: new Date(),
          },
        });

        return {
          user,
          generator: updatedGenerator,
          collector: null,
          driver: null,
        };
      });

      return result;
    }

    const collector = await prisma.collector.findUnique({
      where: { email },
    });

    if (collector) {
      if (collector.userId) {
        throw new Error("Este catador já possui acesso ativo.");
      }

      const passwordHash = await hashPassword(data.password);

      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            passwordHash,
            displayName: collector.name,
            role: UserRole.COLLECTOR,
            accountStatus: AccountStatus.ACTIVE,
            isActive: true,
            phone: collector.phone || null,
          },
          include: {
            personProfile: true,
            generator: true,
            collector: true,
            cooperative: true,
            driver: true,
          },
        });

        const updatedCollector = await tx.collector.update({
          where: { id: collector.id },
          data: {
            userId: user.id,
          },
        });

        return {
          user,
          generator: null,
          collector: updatedCollector,
          driver: null,
        };
      });

      return result;
    }

    const driver = await prisma.driver.findUnique({
      where: { email },
    });

    if (driver) {
      if (driver.userId) {
        throw new Error("Este motorista já possui acesso ativo.");
      }

      if (driver.status === DriverStatus.INACTIVE) {
        throw new Error(
          "Este motorista está inativo. Procure a cooperativa responsável."
        );
      }

      const passwordHash = await hashPassword(data.password);

      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            passwordHash,
            displayName: driver.name,
            role: UserRole.DRIVER,
            accountStatus: AccountStatus.ACTIVE,
            isActive: true,
            phone: driver.phone || null,
          },
          include: {
            personProfile: true,
            generator: true,
            collector: true,
            cooperative: true,
            driver: true,
          },
        });

        const updatedDriver = await tx.driver.update({
          where: { id: driver.id },
          data: {
            userId: user.id,
          },
        });

        const hydratedUser = await tx.user.findUnique({
          where: { id: user.id },
          include: {
            personProfile: true,
            generator: true,
            collector: true,
            cooperative: true,
            driver: true,
          },
        });

        if (!hydratedUser) {
          throw new Error("Erro ao finalizar a ativação do motorista.");
        }

        return {
          user: hydratedUser,
          generator: null,
          collector: null,
          driver: updatedDriver,
        };
      });

      return result;
    }

    throw new Error(
      "Não encontramos cadastro com este e-mail. Verifique com a cooperativa."
    );
  }

  async forgotPassword(data: ForgotPasswordInput) {
    const email = normalizeEmail(data.email);

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return {
        message:
          "Se o e-mail existir em nossa base, a recuperação foi iniciada.",
        expiresAt: null,
      };
    }

    if (!user.isActive || user.accountStatus !== AccountStatus.ACTIVE) {
      throw new Error("Conta inativa ou bloqueada.");
    }

    const resetToken = crypto.randomBytes(16).toString("hex");
    const temporaryPassword = generateTemporaryPassword();
    const resetPasswordExpiresAt = new Date(Date.now() + 1000 * 60 * 15);

    const temporaryPasswordHash = await hashPassword(temporaryPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetToken,
        resetPasswordExpiresAt,
        passwordHash: temporaryPasswordHash,
      },
    });

    await sendPasswordResetEmail({
      to: user.email,
      name: user.displayName,
      resetToken,
      temporaryPassword,
      expiresAt: resetPasswordExpiresAt,
    });

    return {
      message:
        "Se o e-mail existir em nossa base, enviamos as instruções de recuperação.",
      expiresAt: resetPasswordExpiresAt,
    };
  }

  async resetPassword(data: ResetPasswordInput) {
    const email = normalizeEmail(data.email);
    const token = data.token.trim();

    const temporaryPassword =
      data.temporaryPassword || data.temporary_password || "";

    const newPassword = data.newPassword || data.password || "";

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new Error("Usuário não encontrado.");
    }

    if (!user.resetPasswordToken || !user.resetPasswordExpiresAt) {
      throw new Error("Nenhuma solicitação de redefinição foi encontrada.");
    }

    if (user.resetPasswordToken !== token) {
      throw new Error("Token inválido.");
    }

    if (user.resetPasswordExpiresAt.getTime() < Date.now()) {
      throw new Error("Token expirado.");
    }

    const temporaryPasswordMatches = await comparePassword(
      temporaryPassword,
      user.passwordHash
    );

    if (!temporaryPasswordMatches) {
      throw new Error("Senha temporária inválida.");
    }

    const passwordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetPasswordToken: null,
        resetPasswordExpiresAt: null,
      },
    });

    return {
      message: "Senha redefinida com sucesso.",
    };
  }
}