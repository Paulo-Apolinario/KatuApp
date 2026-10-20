import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { MUNICIPALITIES, validTaxId } from "./environmental.schemas";
import { integrationCapabilities } from "./environmental.connector";
export class EnvironmentalError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
    public code = "ENVIRONMENTAL_ERROR",
  ) {
    super(message);
  }
}
type Ctx = Awaited<ReturnType<typeof actorContext>>;
export async function actorContext(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      displayName: true,
      isActive: true,
      accountStatus: true,
      cooperative: {
        select: { id: true, name: true, registrationNumber: true },
      },
    },
  });
  if (
    !user ||
    !user.isActive ||
    user.accountStatus !== "ACTIVE" ||
    !["COOPERATIVE", "MUNICIPAL_MANAGER", "ADMIN"].includes(user.role)
  )
    throw new EnvironmentalError(
      "Acesso não permitido à central ambiental.",
      403,
    );
  const grants =
    user.role === "MUNICIPAL_MANAGER"
      ? await prisma.environmentalMunicipalAccess.findMany({
          where: { userId, active: true },
        })
      : [];
  return {
    user,
    cooperativeId:
      user.role === "COOPERATIVE" ? user.cooperative?.id : undefined,
    grants,
  };
}
export function unitWhere(ctx: Ctx): Prisma.EnvironmentalUnitWhereInput {
  if (ctx.cooperativeId) return { cooperativeId: ctx.cooperativeId };
  if (ctx.user.role === "MUNICIPAL_MANAGER")
    return {
      municipalityCode: { in: ctx.grants.map((g) => g.municipalityCode) },
      OR: [{ kind: "MUNICIPAL_AUTHORITY" }, { shareWithMunicipality: true }],
    };
  // ADMIN administra permissões; não recebe acesso implícito aos documentos.
  return { id: "__no_access__" };
}
function canWrite(ctx: Ctx, unit: any) {
  return (
    !!(ctx.cooperativeId && unit.cooperativeId === ctx.cooperativeId) ||
    (unit.kind === "MUNICIPAL_AUTHORITY" &&
      ctx.grants.some(
        (g) =>
          g.municipalityCode === unit.municipalityCode &&
          g.permission !== "VIEWER",
      ))
  );
}
function canReview(ctx: Ctx, unit: any) {
  return (
    !!(ctx.cooperativeId && unit.cooperativeId === ctx.cooperativeId) ||
    (unit.kind === "MUNICIPAL_AUTHORITY" &&
      ctx.grants.some(
        (g) =>
          g.municipalityCode === unit.municipalityCode &&
          g.permission === "REVIEWER",
      ))
  );
}
export async function findUnit(
  ctx: Ctx,
  id: string,
  write = false,
  db: any = prisma,
) {
  const unit = await db.environmentalUnit.findFirst({
    where: { AND: [{ id }, unitWhere(ctx)] },
  });
  if (!unit)
    throw new EnvironmentalError(
      "Unidade não encontrada para seu acesso.",
      404,
    );
  if (write && !canWrite(ctx, unit))
    throw new EnvironmentalError(
      "Seu acesso permite somente consultar esta unidade.",
      403,
    );
  return unit;
}
export async function findDocument(
  ctx: Ctx,
  id: string,
  write = false,
  db: any = prisma,
) {
  const doc = await db.environmentalDocument.findFirst({
    where: { id, unit: unitWhere(ctx) },
    include: { unit: true },
  });
  if (!doc)
    throw new EnvironmentalError(
      "Documento não encontrado para seu acesso.",
      404,
    );
  if (write && !canWrite(ctx, doc.unit))
    throw new EnvironmentalError(
      "Seu acesso permite somente consultar este documento.",
      403,
    );
  return doc;
}
function editable(doc: any, v: number) {
  if (doc.version !== v)
    throw new EnvironmentalError(
      "O documento mudou. Recarregue antes de continuar; suas alterações não foram gravadas.",
      409,
      "VERSION_CONFLICT",
    );
  if (doc.status !== "DRAFT")
    throw new EnvironmentalError(
      "Reabra o documento como rascunho antes de editar.",
      409,
    );
}
async function lockDocument(tx: any, id: string) {
  await tx.$queryRaw`SELECT id FROM "EnvironmentalDocument" WHERE id = ${id} FOR UPDATE`;
}
export async function audit(
  tx: any,
  ctx: Ctx,
  doc: any,
  kind: string,
  notes?: string,
) {
  await tx.environmentalEvent.create({
    data: {
      documentId: doc.id,
      documentVersion: doc.version,
      actorUserId: ctx.user.id,
      actorName: ctx.user.displayName,
      kind,
      notes,
    },
  });
}
export function reviewIssues(doc: any) {
  const issues: string[] = [],
    p = doc.payload || {},
    u = doc.unit;
  if (!validTaxId(u.taxId || ""))
    issues.push("Cadastre um CNPJ válido da organização.");
  if (!u.responsibleName) issues.push("Informe o responsável da unidade.");
  if (doc.family === "MUNICIPAL_DECLARATION") {
    if (!doc.referenceYear) issues.push("Informe o ano de referência.");
    if (
      u.kind === "COOPERATIVE" &&
      p.diagnosis?.coverage !== "OPERATIONAL_ONLY"
    )
      issues.push(
        "Dados da cooperativa devem ser identificados como operação acompanhada, sem representar o total municipal.",
      );
    if (!p.diagnosis?.wasteRows?.length)
      issues.push("Inclua ao menos uma categoria no diagnóstico.");
    if (
      p.diagnosis?.wasteRows?.some(
        (r: any) =>
          !r.category || r.quantity == null || !r.source || !r.destination,
      )
    )
      issues.push(
        "Complete quantidade, fonte e destinação das categorias; dados desconhecidos devem permanecer em branco.",
      );
    if (!p.delivery?.responsibleName || !p.delivery?.appointmentReference)
      issues.push(
        "Informe responsável e referência da designação/autorização para revisão.",
      );
    if (!p.costs?.source)
      issues.push(
        "Informe a fonte dos custos, inclusive quando indisponíveis.",
      );
    if (
      p.areas?.masterPlan === "UNKNOWN" ||
      p.areas?.zoning === "UNKNOWN" ||
      p.liabilities?.exists === "UNKNOWN"
    )
      issues.push(
        "Revise as informações de planejamento e passivo ambiental ainda desconhecidas.",
      );
  } else if (doc.family === "CDF") {
    if (
      !p.manifestNumbers?.length ||
      p.manifestNumbers.some((n: string) => !n.trim())
    )
      issues.push("Relacione os números oficiais dos manifestos recebidos.");
    if (
      !validDate(p.periodStart) ||
      !validDate(p.periodEnd) ||
      p.periodStart > p.periodEnd
    )
      issues.push("Informe um período de destinação válido.");
    if (
      !p.technicalResponsible ||
      !p.technicalRegistration ||
      !p.treatmentDescription
    )
      issues.push(
        "Informe o tratamento, responsável técnico e registro profissional.",
      );
    if (
      !u.operationalRoles.includes("DESTINATION") &&
      !u.operationalRoles.includes("FINAL_RECYCLER")
    )
      issues.push("Revise o perfil de destinador/reciclador da unidade.");
  } else {
    for (const [key, label] of [
      ["origin", "origem"],
      ["carrier", "transportador"],
      ["recipient", "destinatário"],
    ]) {
      const party = p[key];
      if (
        !party?.name ||
        !validTaxId(party?.taxId || "") ||
        !party?.officialUnitCode ||
        !/^\d{7}$/.test(party?.municipalityCode || "") ||
        !party?.address
      )
        issues.push(
          `Complete identificação, CPF/CNPJ válido, unidade oficial, código IBGE e endereço de ${label}.`,
        );
    }
    if (!validDate(p.departureDate))
      issues.push("Informe a data de expedição.");
    if (
      !p.driverName ||
      !/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(
        (p.vehiclePlate || "").replace(/[-\s]/g, "").toUpperCase(),
      )
    )
      issues.push("Informe motorista e placa válidos.");
    if (
      !p.materials?.length ||
      p.materials.some(
        (m: any) =>
          !m.name ||
          !/^\d{6}$/.test(m.ibamaCode.replace(/[ .-]/g, "")) ||
          !(m.quantity > 0) ||
          !m.physicalStateCode ||
          !m.classificationCode ||
          !m.packagingCode ||
          !m.treatmentCode,
      )
    )
      issues.push(
        "Complete os materiais, quantidade positiva, código IBAMA e códigos oficiais de classificação, estado físico, acondicionamento e tratamento.",
      );
    if (!u.officialUnitCode)
      issues.push("Informe o código oficial da unidade emitente.");
    if (!u.operationalRoles.length)
      issues.push("Informe os perfis operacionais da unidade para revisão.");
    if (
      doc.family === "MTR_LR_PROCESS" &&
      (!p.originManifestNumbers?.length ||
        !p.invoiceNumber ||
        !/^\d{44}$/.test(p.invoiceAccessKey || ""))
    )
      issues.push("Relacione MTR LR de origem e número/chave da nota fiscal.");
  }
  return issues;
}
function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value || "") &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
function present(ctx: Ctx, doc: any) {
  return {
    ...doc,
    permissions: {
      write: canWrite(ctx, doc.unit),
      review: canReview(ctx, doc.unit),
    },
    issues: reviewIssues(doc),
    officialConfirmed: false,
    integration: integrationCapabilities(),
  };
}
export const environmentalService = {
  async context(ctx: Ctx) {
    return {
      role: ctx.user.role,
      cooperative: ctx.user.cooperative,
      municipalities:
        ctx.user.role === "MUNICIPAL_MANAGER"
          ? MUNICIPALITIES.filter((m) =>
              ctx.grants.some((g) => g.municipalityCode === m.code),
            )
          : ctx.cooperativeId
            ? MUNICIPALITIES
            : [],
      grants: ctx.grants.map((g) => ({
        municipalityCode: g.municipalityCode,
        permission: g.permission,
      })),
      integration: integrationCapabilities(),
    };
  },
  async units(ctx: Ctx) {
    const units = await prisma.environmentalUnit.findMany({
      where: unitWhere(ctx),
      orderBy: { name: "asc" },
    });
    return units.map((u) => ({
      ...u,
      permissions: { write: canWrite(ctx, u), review: canReview(ctx, u) },
    }));
  },
  async saveUnit(ctx: Ctx, input: any, id?: string, v?: number) {
    return prisma.$transaction(async (tx) => {
      if (id) {
        const current = await findUnit(ctx, id, true, tx);
        if (input.municipalityCode !== current.municipalityCode)
          throw new EnvironmentalError(
            "O município de uma unidade cadastrada não pode ser alterado.",
            409,
          );
        const count = await tx.environmentalUnit.updateMany({
          where: { id, version: v },
          data: { ...input, version: { increment: 1 } },
        });
        if (!count.count)
          throw new EnvironmentalError(
            "A unidade mudou. Recarregue antes de salvar.",
            409,
            "VERSION_CONFLICT",
          );
        return tx.environmentalUnit.findUniqueOrThrow({ where: { id } });
      }
      if (ctx.cooperativeId)
        return tx.environmentalUnit.create({
          data: {
            ...input,
            kind: "COOPERATIVE",
            cooperativeId: ctx.cooperativeId,
          },
        });
      const grant = ctx.grants.find(
        (g) =>
          g.municipalityCode === input.municipalityCode &&
          g.permission !== "VIEWER",
      );
      if (!grant)
        throw new EnvironmentalError(
          "Você não pode cadastrar uma unidade nesse município.",
          403,
        );
      return tx.environmentalUnit.create({
        data: {
          ...input,
          shareWithMunicipality: false,
          kind: "MUNICIPAL_AUTHORITY",
          authorityKey: input.municipalityCode,
        },
      });
    });
  },
  async list(
    ctx: Ctx,
    filters: { unitId: string; page: number; family?: string; status?: string },
  ) {
    await findUnit(ctx, filters.unitId);
    const where = {
      unitId: filters.unitId,
      ...(filters.family ? { family: filters.family } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.environmentalDocument.findMany({
        where,
        select: {
          id: true,
          title: true,
          family: true,
          status: true,
          referenceYear: true,
          version: true,
          updatedAt: true,
          sourceCollectionId: true,
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip: (filters.page - 1) * 20,
        take: 20,
      }),
      prisma.environmentalDocument.count({ where }),
    ]);
    return { items, total, page: filters.page, pageSize: 20 };
  },
  async create(ctx: Ctx, input: any) {
    const unit = await findUnit(ctx, input.unitId, true);
    if (
      input.family === "MUNICIPAL_DECLARATION" &&
      unit.kind === "COOPERATIVE" &&
      input.payload.diagnosis.coverage !== "OPERATIONAL_ONLY"
    )
      throw new EnvironmentalError(
        "Uma cooperativa prepara dados da própria operação, sem declarar o total municipal.",
      );
    if (input.sourceCollectionId) {
      if (!unit.cooperativeId)
        throw new EnvironmentalError(
          "Uma unidade municipal não importa uma coleta de cooperativa como própria.",
          403,
        );
      const c = await prisma.collection.findFirst({
        where: {
          id: input.sourceCollectionId,
          cooperativeId: unit.cooperativeId,
        },
        select: { id: true },
      });
      if (!c)
        throw new EnvironmentalError(
          "Coleta de origem não encontrada para esta organização.",
          404,
        );
    }
    return prisma.$transaction(async (tx) => {
      const d = await tx.environmentalDocument.create({
        data: {
          ...input,
          payload: input.payload as Prisma.InputJsonValue,
          createdBy: ctx.user.id,
        },
      });
      await audit(tx, ctx, d, "CREATED");
      return d;
    });
  },
  async detail(ctx: Ctx, id: string) {
    const d = await findDocument(ctx, id);
    const attachments = await prisma.environmentalAttachment.findMany({
      where: { documentId: id },
      select: {
        id: true,
        filename: true,
        mediaType: true,
        size: true,
        sha256: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return { ...present(ctx, d), attachments };
  },
  async update(ctx: Ctx, id: string, input: any) {
    return prisma.$transaction(async (tx) => {
      await lockDocument(tx, id);
      const d = await findDocument(ctx, id, true, tx);
      editable(d, input.version);
      if (
        d.family === "MUNICIPAL_DECLARATION" &&
        d.unit.kind === "COOPERATIVE" &&
        input.payload.diagnosis.coverage !== "OPERATIONAL_ONLY"
      )
        throw new EnvironmentalError(
          "A abrangência deve permanecer restrita à operação da cooperativa.",
        );
      const updated = await tx.environmentalDocument.update({
        where: { id },
        data: {
          title: input.title,
          referenceYear: input.referenceYear,
          payload: input.payload,
          version: { increment: 1 },
        },
      });
      await audit(tx, ctx, updated, "UPDATED");
      return updated;
    });
  },
  async transition(ctx: Ctx, id: string, input: any) {
    return prisma.$transaction(async (tx) => {
      await lockDocument(tx, id);
      const d = await findDocument(ctx, id, true, tx);
      if (d.version !== input.version)
        throw new EnvironmentalError(
          "O documento mudou. Recarregue antes de continuar.",
          409,
          "VERSION_CONFLICT",
        );
      let status: string;
      if (input.action === "REQUEST_REVIEW") {
        editable(d, input.version);
        const issues = reviewIssues(d);
        if (issues.length)
          throw new EnvironmentalError(
            issues.join(" "),
            422,
            "REVIEW_INCOMPLETE",
          );
        status = "IN_REVIEW";
      } else if (input.action === "APPROVE") {
        if (d.status !== "IN_REVIEW" || !canReview(ctx, d.unit))
          throw new EnvironmentalError(
            "Revisão não permitida para este documento.",
            403,
          );
        const issues = reviewIssues(d);
        if (issues.length) throw new EnvironmentalError(issues.join(" "), 422);
        status = "APPROVED";
      } else if (input.action === "REOPEN") {
        if (d.status === "ARCHIVED")
          throw new EnvironmentalError(
            "Documento arquivado não pode ser reaberto.",
            409,
          );
        status = "DRAFT";
      } else {
        if (d.status !== "DRAFT")
          throw new EnvironmentalError(
            "Reabra o rascunho antes de arquivar.",
            409,
          );
        status = "ARCHIVED";
      }
      const updated = await tx.environmentalDocument.update({
        where: { id },
        data: {
          status,
          version: { increment: 1 },
          reviewedBy: status === "APPROVED" ? ctx.user.id : null,
          reviewedAt: status === "APPROVED" ? new Date() : null,
          reviewedUnitVersion: status === "APPROVED" ? d.unit.version : null,
        },
      });
      await audit(tx, ctx, updated, input.action, input.notes);
      return updated;
    });
  },
  async history(ctx: Ctx, id: string, page: number) {
    await findDocument(ctx, id);
    const where = { documentId: id };
    const [items, total] = await prisma.$transaction([
      prisma.environmentalEvent.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * 20,
        take: 20,
      }),
      prisma.environmentalEvent.count({ where }),
    ]);
    return { items, total, page, pageSize: 20 };
  },
  async submit(ctx: Ctx, id: string, v: number) {
    const d = await findDocument(ctx, id, true);
    if (d.version !== v)
      throw new EnvironmentalError(
        "Recarregue o documento antes de transmitir.",
        409,
      );
    if (d.status !== "APPROVED" || d.reviewedUnitVersion !== d.unit.version)
      throw new EnvironmentalError(
        "Conclua a revisão interna com a versão atual da unidade antes de transmitir.",
        409,
      );
    throw new EnvironmentalError(
      integrationCapabilities().reason,
      503,
      "INTEGRATION_UNAVAILABLE",
    );
  },
  async importCollection(ctx: Ctx, unitId: string, collectionId: string) {
    const u = await findUnit(ctx, unitId, true);
    if (!u.cooperativeId)
      throw new EnvironmentalError(
        "Importação disponível somente para a organização da coleta.",
        403,
      );
    const c = await prisma.collection.findFirst({
      where: { id: collectionId, cooperativeId: u.cooperativeId },
      include: {
        generator: true,
        bin: true,
        driver: true,
        vehicle: true,
        collector: true,
        collectionMaterials: {
          select: { nameSnapshot: true, quantity: true, unit: true },
        },
      },
    });
    if (!c)
      throw new EnvironmentalError(
        "Coleta não encontrada para esta organização.",
        404,
      );
    return {
      id: c.id,
      status: c.status,
      origin: c.bin || c.generator,
      driverName: c.driver?.name || c.collector?.name || "",
      vehiclePlate: c.vehicle?.plate || "",
      materials: c.collectionMaterials.map((m) => ({
        name: m.nameSnapshot,
        quantity: m.quantity.toString(),
        unit: m.unit,
      })),
      warning:
        "Dados de origem para conferência. Confirme o município, participantes e códigos oficiais. Isso não emite documento nem altera a coleta.",
    };
  },
  async grant(ctx: Ctx, input: any) {
    if (ctx.user.role !== "ADMIN")
      throw new EnvironmentalError(
        "Somente administrador pode designar acesso municipal.",
        403,
      );
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: input.userId } });
      if (!user || !["PF", "MUNICIPAL_MANAGER"].includes(user.role))
        throw new EnvironmentalError(
          "Selecione um usuário PF ou gestor municipal existente, sem vínculo operacional de outro perfil.",
        );
      if (input.active)
        await tx.user.update({
          where: { id: user.id },
          data: { role: "MUNICIPAL_MANAGER" },
        });
      return tx.environmentalMunicipalAccess.upsert({
        where: {
          userId_municipalityCode: {
            userId: input.userId,
            municipalityCode: input.municipalityCode,
          },
        },
        create: { ...input, grantedBy: ctx.user.id },
        update: { ...input, grantedBy: ctx.user.id },
      });
    });
  },
  async addAttachment(ctx: Ctx, id: string, v: number, file: any) {
    return prisma.$transaction(async (tx) => {
      await lockDocument(tx, id);
      const d = await findDocument(ctx, id, true, tx);
      editable(d, v);
      const count = await tx.environmentalAttachment.count({
        where: { documentId: id },
      });
      if (count >= 20)
        throw new EnvironmentalError(
          "Limite de 20 evidências por documento.",
          409,
        );
      const saved = await tx.environmentalAttachment.create({
        data: { ...file, documentId: id, createdBy: ctx.user.id },
      });
      const updated = await tx.environmentalDocument.update({
        where: { id },
        data: { version: { increment: 1 } },
      });
      await audit(tx, ctx, updated, "EVIDENCE_ADDED", file.filename);
      return { id: saved.id, version: updated.version };
    });
  },
};
