import {
  CollectorGender,
  CollectorSex,
  CollectorStatus,
  Prisma,
} from "@prisma/client";

import { prisma } from "../../lib/prisma";

import {
  CreateCollectorInput,
  UpdateCollectorStatusInput,
  UpdateCollectorInput,
} from "./collector.schemas";

export type CollectorDocumentCreateData = {
  documentType?: string | null;
  documentName?: string | null;
  fileUrl: string;
  fileMimeType?: string | null;
  fileSize?: number | null;
  notes?: string | null;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeOptionalText(value?: string | null) {
  const normalized = value?.trim();

  return normalized ? normalized : null;
}

function normalizeCpf(value?: string | null) {
  if (!value) return null;

  const normalized = value.replace(/\D/g, "");

  return normalized || null;
}

function parseOptionalDate(
  value?: string | null,
  fieldLabel = "data"
): Date | null {
  if (!value) return null;

  const normalized = value.trim();

  if (!normalized) return null;

  const date = new Date(`${normalized}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldLabel} inválida.`);
  }

  return date;
}

function normalizeCollectorStatus(
  status?: CreateCollectorInput["status"]
): CollectorStatus {
  switch (status) {
    case "ON_ROUTE":
      return CollectorStatus.ON_ROUTE;

    case "INACTIVE":
      return CollectorStatus.INACTIVE;

    case "AVAILABLE":
    default:
      return CollectorStatus.AVAILABLE;
  }
}

function normalizeCollectorSex(
  sex?: CreateCollectorInput["sex"]
): CollectorSex | null {
  switch (sex) {
    case "FEMALE":
      return CollectorSex.FEMALE;

    case "MALE":
      return CollectorSex.MALE;

    case "INTERSEX":
      return CollectorSex.INTERSEX;

    case "NOT_INFORMED":
      return CollectorSex.NOT_INFORMED;

    default:
      return null;
  }
}

function normalizeCollectorGender(
  gender?: CreateCollectorInput["gender"]
): CollectorGender | null {
  switch (gender) {
    case "CIS_WOMAN":
      return CollectorGender.CIS_WOMAN;

    case "CIS_MAN":
      return CollectorGender.CIS_MAN;

    case "TRANS_WOMAN":
      return CollectorGender.TRANS_WOMAN;

    case "TRANS_MAN":
      return CollectorGender.TRANS_MAN;

    case "NON_BINARY":
      return CollectorGender.NON_BINARY;

    case "OTHER":
      return CollectorGender.OTHER;

    case "NOT_INFORMED":
      return CollectorGender.NOT_INFORMED;

    default:
      return null;
  }
}

function normalizeDocuments(
  documents: CollectorDocumentCreateData[] = []
): CollectorDocumentCreateData[] {
  return documents
    .filter((document) => Boolean(document?.fileUrl?.trim()))
    .map((document) => ({
      documentType: normalizeOptionalText(document.documentType),
      documentName: normalizeOptionalText(document.documentName),
      fileUrl: document.fileUrl.trim(),
      fileMimeType: normalizeOptionalText(document.fileMimeType),
      fileSize:
        typeof document.fileSize === "number" &&
        Number.isFinite(document.fileSize) &&
        document.fileSize >= 0
          ? Math.trunc(document.fileSize)
          : null,
      notes: normalizeOptionalText(document.notes),
    }));
}

const collectorInclude = {
  documents: {
    orderBy: {
      createdAt: "desc",
    },
  },
} satisfies Prisma.CollectorInclude;

export class CollectorService {
  private async findAuthenticatedCooperative(cooperativeUserId: string) {
    const cooperative = await prisma.cooperative.findUnique({
      where: {
        userId: cooperativeUserId,
      },
      select: {
        id: true,
        name: true,
        userId: true,
      },
    });

    if (!cooperative) {
      throw new Error(
        "Cooperativa do usuário autenticado não encontrada."
      );
    }

    return cooperative;
  }

  private async validateCollectorUniqueness(
    email: string,
    cpf?: string | null
  ) {
    const existingUser = await prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      throw new Error("Já existe um usuário com este e-mail.");
    }

    const existingCollectorByEmail = await prisma.collector.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
      },
    });

    if (existingCollectorByEmail) {
      throw new Error("Já existe um catador com este e-mail.");
    }

    if (cpf) {
      const existingCollectorByCpf = await prisma.collector.findFirst({
        where: {
          cpf,
        },
        select: {
          id: true,
        },
      });

      if (existingCollectorByCpf) {
        throw new Error("Já existe um catador com este CPF.");
      }
    }
  }

  async create(
    cooperativeUserId: string,
    data: CreateCollectorInput,
    documents: CollectorDocumentCreateData[] = []
  ) {
    const cooperative =
      await this.findAuthenticatedCooperative(cooperativeUserId);

    const email = normalizeEmail(data.email);
    const cpf = normalizeCpf(data.cpf);
    const normalizedDocuments = normalizeDocuments(documents);

    await this.validateCollectorUniqueness(email, cpf);

    const associationDate = parseOptionalDate(
      data.associationDate,
      "Data de filiação"
    );

    return prisma.$transaction(async (transaction) => {
      const collector = await transaction.collector.create({
        data: {
          cooperativeId: cooperative.id,

          name: data.name.trim(),
          socialName: normalizeOptionalText(data.socialName),

          email,
          phone: normalizeOptionalText(data.phone),

          cpf,
          rg: normalizeOptionalText(data.rg),
          birthDate: normalizeOptionalText(data.birthDate),

          sex: normalizeCollectorSex(data.sex),
          gender: normalizeCollectorGender(data.gender),

          address: normalizeOptionalText(data.address),

          associationDate,
          registrationNumber: normalizeOptionalText(data.registrationNumber),
          membershipCategory: data.membershipCategory ?? null,
          isAutonomous: data.isAutonomous ?? false,

          incomeRange: normalizeOptionalText(data.incomeRange),
          socialBenefits: normalizeOptionalText(data.socialBenefits),
          occupationalDiseases: normalizeOptionalText(
            data.occupationalDiseases
          ),
          socioeconomicNotes: normalizeOptionalText(
            data.socioeconomicNotes
          ),

          status: normalizeCollectorStatus(data.status),

          kgMonth: 0,
          collectionsToday: 0,
          totalKg: 0,

          documents:
            normalizedDocuments.length > 0
              ? {
                  create: normalizedDocuments.map((document) => ({
                    cooperativeId: cooperative.id,
                    documentType: document.documentType,
                    documentName: document.documentName,
                    fileUrl: document.fileUrl,
                    fileMimeType: document.fileMimeType,
                    fileSize: document.fileSize,
                    notes: document.notes,
                  })),
                }
              : undefined,
        },
        include: collectorInclude,
      });

      return collector;
    });
  }

  async listByAuthenticatedCooperative(cooperativeUserId: string) {
    const cooperative =
      await this.findAuthenticatedCooperative(cooperativeUserId);

    return prisma.collector.findMany({
      where: {
        cooperativeId: cooperative.id,
      },
      include: collectorInclude,
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async findById(
    cooperativeUserId: string,
    collectorId: string
  ) {
    const cooperative =
      await this.findAuthenticatedCooperative(cooperativeUserId);

    const collector = await prisma.collector.findFirst({
      where: {
        id: collectorId,
        cooperativeId: cooperative.id,
      },
      include: collectorInclude,
    });

    if (!collector) {
      throw new Error("Catador não encontrado.");
    }

    return collector;
  }

  async update(cooperativeUserId: string, collectorId: string, data: UpdateCollectorInput) {
    const cooperative = await this.findAuthenticatedCooperative(cooperativeUserId);
    return prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Collector" WHERE id = ${collectorId} AND "cooperativeId" = ${cooperative.id} FOR UPDATE`;
      const current = await tx.collector.findFirst({ where: { id: collectorId, cooperativeId: cooperative.id } });
      if (!current) throw new Error("Catador não encontrado.");
      const changes: Prisma.CollectorUpdateInput = {};
      const provided = (key: keyof UpdateCollectorInput) => Object.prototype.hasOwnProperty.call(data, key);
      if (provided("name")) changes.name = data.name!.trim();
      if (provided("email")) {
        const email = normalizeEmail(data.email!);
        const [otherCollector, otherUser] = await Promise.all([
          tx.collector.findFirst({ where: { email, id: { not: current.id } }, select: { id: true } }),
          tx.user.findFirst({ where: { email, ...(current.userId ? { id: { not: current.userId } } : {}) }, select: { id: true } }),
        ]);
        if (otherCollector || otherUser) throw new Error("Este e-mail já está em uso por outro cadastro.");
        changes.email = email;
      }
      if (provided("cpf")) {
        const cpf = normalizeCpf(data.cpf);
        if (cpf && await tx.collector.findFirst({ where: { cpf, id: { not: current.id } }, select: { id: true } })) throw new Error("Já existe um catador com este CPF.");
        changes.cpf = cpf;
      }
      for (const key of ["socialName", "phone", "rg", "birthDate", "address", "registrationNumber", "incomeRange", "socialBenefits", "occupationalDiseases", "socioeconomicNotes"] as const) {
        if (provided(key)) changes[key] = normalizeOptionalText(data[key]);
      }
      if (provided("associationDate")) changes.associationDate = parseOptionalDate(data.associationDate, "Data de filiação");
      if (provided("membershipCategory")) changes.membershipCategory = data.membershipCategory ?? null;
      if (provided("sex")) changes.sex = normalizeCollectorSex(data.sex);
      if (provided("gender")) changes.gender = normalizeCollectorGender(data.gender);
      if (provided("isAutonomous")) changes.isAutonomous = data.isAutonomous ?? false;
      // Ativo também abrange um catador que já esteja em rota: editar o cadastro não encerra sua operação.
      if (provided("status")) changes.status = data.status === "AVAILABLE" && current.status === "ON_ROUTE" ? "ON_ROUTE" : normalizeCollectorStatus(data.status);
      if (current.userId && (provided("email") || provided("name") || provided("phone"))) {
        await tx.user.update({ where: { id: current.userId }, data: {
          ...(provided("email") ? { email: changes.email as string } : {}),
          ...(provided("name") ? { displayName: changes.name as string } : {}),
          ...(provided("phone") ? { phone: normalizeOptionalText(data.phone) } : {}),
        } });
      }
      return tx.collector.update({ where: { id: current.id }, data: changes, include: collectorInclude });
    });
  }

  async updateStatus(
    cooperativeUserId: string,
    collectorId: string,
    status: UpdateCollectorStatusInput["status"]
  ) {
    const cooperative =
      await this.findAuthenticatedCooperative(cooperativeUserId);

    const collector = await prisma.collector.findFirst({
      where: {
        id: collectorId,
        cooperativeId: cooperative.id,
      },
      select: {
        id: true,
      },
    });

    if (!collector) {
      throw new Error("Catador não encontrado.");
    }

    return prisma.collector.update({
      where: {
        id: collector.id,
      },
      data: {
        status: normalizeCollectorStatus(status),
      },
      include: collectorInclude,
    });
  }

  async addDocument(
    cooperativeUserId: string,
    collectorId: string,
    document: CollectorDocumentCreateData
  ) {
    const cooperative =
      await this.findAuthenticatedCooperative(cooperativeUserId);

    const collector = await prisma.collector.findFirst({
      where: {
        id: collectorId,
        cooperativeId: cooperative.id,
      },
      select: {
        id: true,
      },
    });

    if (!collector) {
      throw new Error("Catador não encontrado.");
    }

    const [normalizedDocument] = normalizeDocuments([document]);

    if (!normalizedDocument) {
      throw new Error("O arquivo do documento é obrigatório.");
    }

    return prisma.collectorDocument.create({
      data: {
        collectorId: collector.id,
        cooperativeId: cooperative.id,
        documentType: normalizedDocument.documentType,
        documentName: normalizedDocument.documentName,
        fileUrl: normalizedDocument.fileUrl,
        fileMimeType: normalizedDocument.fileMimeType,
        fileSize: normalizedDocument.fileSize,
        notes: normalizedDocument.notes,
      },
    });
  }

  async listDocuments(
    cooperativeUserId: string,
    collectorId: string
  ) {
    const cooperative =
      await this.findAuthenticatedCooperative(cooperativeUserId);

    const collector = await prisma.collector.findFirst({
      where: {
        id: collectorId,
        cooperativeId: cooperative.id,
      },
      select: {
        id: true,
      },
    });

    if (!collector) {
      throw new Error("Catador não encontrado.");
    }

    return prisma.collectorDocument.findMany({
      where: {
        collectorId: collector.id,
        cooperativeId: cooperative.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async deleteDocument(
    cooperativeUserId: string,
    collectorId: string,
    documentId: string
  ) {
    const cooperative =
      await this.findAuthenticatedCooperative(cooperativeUserId);

    const document = await prisma.collectorDocument.findFirst({
      where: {
        id: documentId,
        collectorId,
        cooperativeId: cooperative.id,
      },
    });

    if (!document) {
      throw new Error("Documento do catador não encontrado.");
    }

    await prisma.collectorDocument.delete({
      where: {
        id: document.id,
      },
    });

    return document;
  }
}