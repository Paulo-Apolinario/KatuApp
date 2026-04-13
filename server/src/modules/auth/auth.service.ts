import crypto from "node:crypto";
import {
  AccountStatus,
  DriverStatus,
  GeneratorAccessStatus,
  GeneratorType,
  UserRole,
} from "@prisma/client";

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
        resetToken: null,
      };
    }

    if (!user.isActive || user.accountStatus !== AccountStatus.ACTIVE) {
      throw new Error("Conta inativa ou bloqueada.");
    }

    const resetToken = crypto.randomBytes(3).toString("hex").toUpperCase();
    const resetPasswordExpiresAt = new Date(Date.now() + 1000 * 60 * 15);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetToken,
        resetPasswordExpiresAt,
      },
    });

    return {
      message: "Token de redefinição gerado com sucesso.",
      resetToken,
      expiresAt: resetPasswordExpiresAt,
    };
  }

  async resetPassword(data: ResetPasswordInput) {
    const email = normalizeEmail(data.email);
    const token = data.token.trim().toUpperCase();

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

    const passwordHash = await hashPassword(data.newPassword);

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