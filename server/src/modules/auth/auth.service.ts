import {
  AccountStatus,
  GeneratorAccessStatus,
  GeneratorType,
  UserRole,
} from "@prisma/client";

import { prisma } from "../../lib/prisma";
import { hashPassword, comparePassword } from "../../utils/hash";
import {
  ActivateGeneratorAccessInput,
  LoginInput,
  RegisterCooperativeInput,
  RegisterPfInput,
} from "./auth.schemas";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function sanitizeDocument(value: string) {
  return value.replace(/\D/g, "");
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

    const user = await prisma.user.create({
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

    const cooperative = await prisma.cooperative.create({
      data: {
        userId: user.id,
        name: data.cooperativeName.trim(),
        registrationNumber,
        email,
        phone: data.phone.trim(),
        address: data.address?.trim() || null,
      },
    });

    return {
      user,
      cooperative,
    };
  }

  async login(data: LoginInput) {
    const email = normalizeEmail(data.email);

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        personProfile: true,
        generator: true,
        collector: true,
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

      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          displayName: generator.name,
          role,
          accountStatus: AccountStatus.ACTIVE,
          isActive: true,
          phone: generator.phone || null,
        },
      });

      const updatedGenerator = await prisma.generator.update({
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
      };
    }

    const collector = await prisma.collector.findUnique({
      where: { email },
    });

    if (!collector) {
      throw new Error(
        "Não encontramos cadastro com este e-mail. Verifique com a cooperativa."
      );
    }

    if (collector.userId) {
      throw new Error("Este catador já possui acesso ativo.");
    }

    const passwordHash = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName: collector.name,
        role: UserRole.COLLECTOR,
        accountStatus: AccountStatus.ACTIVE,
        isActive: true,
        phone: collector.phone || null,
      },
    });

    const updatedCollector = await prisma.collector.update({
      where: { id: collector.id },
      data: {
        userId: user.id,
      },
    });

    return {
      user,
      generator: null,
      collector: updatedCollector,
    };
  }
}