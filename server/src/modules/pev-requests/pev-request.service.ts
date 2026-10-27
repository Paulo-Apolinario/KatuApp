import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { BinError, binsService } from "../bins/bins.service";
import {
  createPevRequest,
  updatePevRequest,
  pevRequestQuery,
} from "./pev-request.schemas";
const collectionSelect = {
  id: true,
  status: true,
  collectorId: true,
  collectedAt: true,
  collector: { select: { name: true } },
} as const;
const summarySelect = {
  id: true,
  binId: true,
  binName: true,
  address: true,
  cooperativeId: true,
  requesterName: true,
  requesterRole: true,
  condition: true,
  notes: true,
  status: true,
  version: true,
  response: true,
  createdAt: true,
  updatedAt: true,
  collectionId: true,
  collection: { select: collectionSelect },
} as const;
export async function pevActor(id: string) {
  const u = await prisma.user.findFirst({
    where: { id, isActive: true, accountStatus: "ACTIVE" },
    select: {
      id: true,
      role: true,
      displayName: true,
      cooperative: { select: { id: true } },
      collector: { select: { id: true, cooperativeId: true, status: true } },
    },
  });
  if (!u || !["PF", "COLLECTOR", "COOPERATIVE"].includes(u.role))
    throw new BinError("Perfil sem acesso às solicitações de PEV.", 403);
  if (
    u.role === "COLLECTOR" &&
    (!u.collector?.cooperativeId || u.collector.status === "INACTIVE")
  )
    throw new BinError("Catador sem vínculo ativo com uma cooperativa.", 403);
  return {
    ...u,
    coopId: u.cooperative?.id || u.collector?.cooperativeId || null,
  };
}
type Actor = Awaited<ReturnType<typeof pevActor>>;
function scope(a: Actor): Prisma.PevRequestWhereInput {
  return a.role === "COOPERATIVE"
    ? { cooperativeId: a.coopId || "__none__" }
    : a.role === "COLLECTOR"
      ? { cooperativeId: a.coopId! }
      : { requesterUserId: a.id };
}
const publicBin = {
  publicAccess: true,
  pointKind: { in: ["PEV", "ECOPONTO"] },
  status: { in: ["ACTIVE", "FULL", "MAINTENANCE"] },
  latitude: { not: null },
  longitude: { not: null },
  cooperative: { user: { isActive: true, accountStatus: "ACTIVE" } },
} satisfies Prisma.BinWhereInput;
function accessibleBin(a: Actor): Prisma.BinWhereInput {
  if (a.role === "PF") return publicBin;
  return {
    cooperativeId: a.coopId || "__none__",
    status: { not: "INACTIVE" },
    pointKind: { in: ["PEV", "ECOPONTO"] },
    cooperative: { user: { isActive: true, accountStatus: "ACTIVE" } },
  };
}

const address = (b: any) =>
  [b.street, b.number, b.neighborhood, b.city, b.state]
    .filter(Boolean)
    .join(", ") ||
  b.location ||
  "Endereço não informado";
async function notify(
  tx: Prisma.TransactionClient,
  id: string,
  recipient: string,
  key: string,
  title: string,
  message: string,
) {
  await tx.inboxNotification.createMany({
    data: [
      {
        userId: recipient,
        eventKey: key,
        kind: "PEV_REQUEST",
        title,
        message,
        data: { pevRequestId: id },
      },
    ],
    skipDuplicates: true,
  });
}
export const pevRequestService = {
  async bins(a: Actor, q: z.infer<typeof pevRequestQuery>) {
    const where: Prisma.BinWhereInput = {
      AND: [
        accessibleBin(a),
        ...(q.search
          ? [
              {
                OR: [
                  {
                    name: { contains: q.search, mode: "insensitive" as const },
                  },
                  {
                    binId: { contains: q.search, mode: "insensitive" as const },
                  },
                  {
                    city: { contains: q.search, mode: "insensitive" as const },
                  },
                  {
                    neighborhood: {
                      contains: q.search,
                      mode: "insensitive" as const,
                    },
                  },
                ],
              },
            ]
          : []),
      ],
    };
    const [bins, total] = await prisma.$transaction([
      prisma.bin.findMany({
        where,
        select: {
          id: true,
          binId: true,
          name: true,
          pointKind: true,
          location: true,
          street: true,
          number: true,
          neighborhood: true,
          city: true,
          state: true,
          reference: true,
          latitude: true,
          longitude: true,
          acceptedMaterials: true,
          restrictions: true,
          status: true,
          needsPickup: true,
          lastCollectionDate: true,
          cooperativeId: true,
          cooperative: { select: { name: true } },
        },
        orderBy: [{ city: "asc" }, { name: "asc" }, { id: "asc" }],
        skip: (q.page - 1) * 20,
        take: 20,
      }),
      prisma.bin.count({ where }),
    ]);
    return {
      bins: bins.map((b) => ({
        ...b,
        address: address(b),
        canCollect: a.role === "COLLECTOR" && a.coopId === b.cooperativeId,
      })),
      total,
      page: q.page,
    };
  },
  async list(a: Actor, q: z.infer<typeof pevRequestQuery>) {
    const where: Prisma.PevRequestWhereInput = {
      AND: [
        scope(a),
        ...(q.binId ? [{ binId: q.binId }] : []),
        ...(q.status ? [{ status: q.status }] : []),
      ],
    };
    const [requests, total] = await prisma.$transaction([
      prisma.pevRequest.findMany({
        where,
        select: summarySelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (q.page - 1) * 20,
        take: 20,
      }),
      prisma.pevRequest.count({ where }),
    ]);
    return { requests, total, page: q.page };
  },
  async detail(a: Actor, id: string, page = 1) {
    const report = await prisma.pevRequest.findFirst({
      where: { AND: [{ id }, scope(a)] },
      include: {
        collection: { select: collectionSelect },
        updates: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 5,
          skip: (page - 1) * 5,
        },
      },
    });
    if (!report) throw new BinError("Solicitação não encontrada.", 404);
    return {
      ...report,
      updatesTotal: await prisma.pevRequestUpdate.count({
        where: { requestId: id },
      }),
      updatesPage: page,
    };
  },
  async create(a: Actor, p: z.infer<typeof createPevRequest>) {
    if (a.role === "COOPERATIVE")
      throw new BinError("Use a solicitação de retirada da ficha do PEV.", 403);
    return prisma.$transaction(async (tx) => {
      // Serializa também o limite diário e as tentativas repetidas do aparelho.
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${a.id} FOR NO KEY UPDATE`;
      const previous = await tx.pevRequest.findUnique({ where: { id: p.id } });
      if (previous) {
        if (
          previous.requesterUserId !== a.id ||
          previous.binId !== p.binId ||
          previous.notes !== p.notes ||
          previous.condition !== p.condition ||
          JSON.stringify(previous.photos) !== JSON.stringify(p.photos)
        )
          throw new BinError("Protocolo já utilizado. Atualize a tela.", 409);
        return previous;
      }
      if (
        (await tx.pevRequest.count({
          where: {
            requesterUserId: a.id,
            createdAt: { gte: new Date(Date.now() - 86400000) },
          },
        })) >= 20
      )
        throw new BinError("Limite de 20 solicitações por dia atingido.", 429);
      await tx.$queryRaw`SELECT id FROM "Bin" WHERE id=${p.binId} FOR UPDATE`;
      const bin = await tx.bin.findFirst({
        where: { AND: [{ id: p.binId }, accessibleBin(a)] },
        include: { cooperative: { select: { userId: true } } },
      });
      if (!bin)
        throw new BinError(
          "PEV indisponível para solicitação. Atualize os pontos.",
          404,
        );
      const active = await tx.collection.findFirst({
        where: { binId: bin.id, status: { in: ["PENDING", "IN_PROGRESS"] } },
        select: { id: true },
      });
      const report = await tx.pevRequest.create({
        data: {
          id: p.id,
          binId: bin.id,
          cooperativeId: bin.cooperativeId,
          requesterUserId: a.id,
          requesterName: a.displayName,
          requesterRole: a.role,
          binName: bin.name || bin.binId,
          address: address(bin),
          condition: p.condition,
          notes: p.notes,
          photos: p.photos,
          status: active ? "ASSIGNED" : "OPEN",
          collectionId: active?.id,
        },
      });
      await tx.bin.update({
        where: { id: bin.id },
        data: {
          needsPickup: true,
          pickupReason: "Há solicitação de verificação pelo App.",
        },
      });
      await tx.binEvent.create({
        data: {
          binId: bin.id,
          cooperativeId: bin.cooperativeId,
          kind: "APP_REQUEST",
          actorUserId: a.id,
          actorName: a.displayName,
          notes:
            "Solicitação recebida pelo App. Consulte os relatos e fotos na ficha do PEV.",
          data: { requestId: report.id, condition: p.condition },
        },
      });
      await notify(
        tx,
        report.id,
        bin.cooperative.userId,
        `pev-open:${report.id}`,
        "PEV precisa de atenção",
        `${report.binName}: novo relato pelo App. Consulte as solicitações na ficha do PEV.`,
      );
      return report;
    });
  },
  async update(a: Actor, id: string, p: z.infer<typeof updatePevRequest>) {
    const current = await this.detail(a, id);
    if (p.kind !== "EVIDENCE" && a.role !== "COOPERATIVE")
      throw new BinError("Somente a cooperativa pode tratar o pedido.", 403);
    if (
      p.kind === "EVIDENCE" &&
      current.requesterUserId !== a.id &&
      a.role !== "COOPERATIVE" &&
      a.coopId !== current.cooperativeId
    )
      throw new BinError("Sem acesso ao relato.", 403);
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${a.id} FOR NO KEY UPDATE`;
      await tx.$queryRaw`SELECT id FROM "Bin" WHERE id=${current.binId} FOR UPDATE`;
      const repeated = await tx.pevRequestUpdate.findUnique({
        where: { operationId: p.operationId },
      });
      if (repeated) {
        if (
          repeated.requestId !== id ||
          repeated.actorUserId !== a.id ||
          repeated.kind !== p.kind ||
          repeated.notes !== p.notes ||
          JSON.stringify(repeated.photos) !== JSON.stringify(p.photos)
        )
          throw new BinError("Operação já utilizada.", 409);
        return tx.pevRequest.findUniqueOrThrow({ where: { id } });
      }
      if (
        a.role !== "COOPERATIVE" &&
        (await tx.pevRequestUpdate.count({
          where: {
            actorUserId: a.id,
            createdAt: { gte: new Date(Date.now() - 86400000) },
          },
        })) >= 40
      )
        throw new BinError("Limite de 40 atualizações por dia atingido.", 429);
      const fresh = await tx.pevRequest.findUniqueOrThrow({ where: { id } });
      if (!["OPEN", "ASSIGNED"].includes(fresh.status))
        throw new BinError(
          "Pedido encerrado. Abra um novo relato se necessário.",
          409,
        );
      if (
        (await tx.pevRequestUpdate.count({ where: { requestId: id } })) >= 100
      )
        throw new BinError(
          "Limite de complementações atingido. Contate a cooperativa.",
          409,
        );
      const status =
        p.kind === "RESOLVE"
          ? "RESOLVED"
          : p.kind === "DISMISS"
            ? "DISMISSED"
            : fresh.status;
      const changed = await tx.pevRequest.updateMany({
        where: { id, version: p.expectedVersion },
        data: {
          status,
          version: { increment: 1 },
          ...(a.role === "COOPERATIVE" ? { response: p.notes } : {}),
        },
      });
      if (!changed.count)
        throw new BinError(
          "Pedido alterado por outro usuário. Atualize e tente novamente.",
          409,
        );
      await tx.pevRequestUpdate.create({
        data: {
          requestId: id,
          operationId: p.operationId,
          actorUserId: a.id,
          actorName: a.displayName,
          kind: p.kind,
          notes: p.notes,
          photos: p.photos,
        },
      });
      const recipient =
        a.role === "COOPERATIVE"
          ? fresh.requesterUserId
          : (
              await tx.cooperative.findUniqueOrThrow({
                where: { id: fresh.cooperativeId },
              })
            ).userId;
      await notify(
        tx,
        id,
        recipient,
        `pev-update:${p.operationId}`,
        a.role === "COOPERATIVE"
          ? "Resposta à solicitação do PEV"
          : "Novas informações sobre o PEV",
        p.notes,
      );
      // Encerrar relato não cancela coleta nem altera estoque/condição física do ponto.
      return tx.pevRequest.findUniqueOrThrow({ where: { id } });
    });
  },
  async assign(a: Actor, id: string, collectorId?: string) {
    const r = await this.detail(a, id);
    if (a.role === "PF" || a.coopId !== r.cooperativeId)
      throw new BinError(
        "A coleta exige vínculo com a cooperativa responsável pelo PEV.",
        403,
      );
    const target = a.role === "COLLECTOR" ? a.collector!.id : collectorId;
    if (!target) throw new BinError("Selecione o catador responsável.");
    const coop = await prisma.cooperative.findUniqueOrThrow({
      where: { id: r.cooperativeId },
      select: { userId: true },
    });
    const collection = await binsService.pickup(
      coop.userId,
      r.binId,
      {
        collectorId: target,
        requestId: r.id,
        notes: `Solicitação de PEV ${r.id}: ${r.notes}`,
      },
      a.id,
    );
    return { collection };
  },
};
