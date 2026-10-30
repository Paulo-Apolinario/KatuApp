import { notifyCooperative } from "../inbox/inbox.service";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { collectionMaterialSchema } from "../collections/collection.schemas";
import { CollectionService } from "../collections/collection.service";
import { CollectionDomainError } from "../collections/collection.types";
import {
  createExtraOrder,
  reviseExtraOrder,
  reviewExtraOrder,
  receiveExtraOrder,
  type ExtraOrderPayload,
} from "./extra-order.schemas";
import type { z } from "zod";
const fail = (message: string, statusCode = 409) => {
  throw new CollectionDomainError(message, {
    statusCode,
    code: "EXTRA_ORDER_ERROR",
  });
};
const hash = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
const json = (v: unknown) =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const include = {
  collector: { select: { id: true, name: true } },
  collection: {
    select: { id: true, status: true, collectedAt: true, receivedAt: true },
  },
  events: { orderBy: { createdAt: "asc" as const } },
};
export class ExtraOrderService {
  private async context(userId: string, role: string) {
    if (role === "COLLECTOR") {
      const c = await prisma.collector.findUnique({
        where: { userId },
        include: { cooperative: { select: { id: true, name: true } } },
      });
      if (!c || !c.cooperativeId)
        fail("Catador sem cooperativa vinculada.", 403);
      return {
        userId,
        role,
        cooperativeId: c!.cooperativeId!,
        collectorId: c!.id,
        name: c!.name,
        inactive: c!.status === "INACTIVE",
        cooperative: c!.cooperative,
      };
    }
    if (role === "COOPERATIVE") {
      const c = await prisma.cooperative.findUnique({ where: { userId } });
      if (!c) fail("Cooperativa não identificada.", 403);
      const u = await prisma.user.findUnique({ where: { id: userId } });
      return {
        userId,
        role,
        cooperativeId: c!.id,
        collectorId: undefined,
        name: u?.displayName || c!.name,
        inactive: false,
        cooperative: { id: c!.id, name: c!.name },
      };
    }
    return fail("Perfil sem acesso às ordens extras.", 403);
  }
  private scope(c: Awaited<ReturnType<ExtraOrderService["context"]>>) {
    return {
      cooperativeId: c.cooperativeId,
      ...(c.role === "COLLECTOR" ? { collectorId: c.collectorId } : {}),
    };
  }
  async contextData(userId: string, role: string) {
    const c = await this.context(userId, role);
    const [generators, routes, schedules, catalog, drivers, vehicles] =
      await Promise.all([
        prisma.generator.findMany({
          where: { cooperativeId: c.cooperativeId },
          select: {
            id: true,
            name: true,
            address: true,
            latitude: true,
            longitude: true,
          },
          take: 200,
          orderBy: { name: "asc" },
        }),
        prisma.route.findMany({
          where: {
            cooperativeId: c.cooperativeId,
            ...(c.collectorId
              ? { collections: { some: { collectorId: c.collectorId } } }
              : {}),
          },
          select: { id: true, name: true, status: true, scheduledDate: true },
          orderBy: { createdAt: "desc" },
          take: 60,
        }),
        prisma.schedule.findMany({
          where: {
            cooperativeId: c.cooperativeId,
            status: { in: ["REQUESTED", "SCHEDULED"] },
            collections: { none: {} },
          },
          select: {
            id: true,
            generatorId: true,
            pickupAddress: true,
            requestedBy: { select: { displayName: true } },
            generator: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
        prisma.wasteStockItem.findMany({
          where: { cooperativeId: c.cooperativeId, status: "ACTIVE" },
          select: { id: true, name: true, unit: true, defaultUnit: true },
          orderBy: { name: "asc" },
          take: 250,
        }),
        c.role === "COOPERATIVE"
          ? prisma.driver.findMany({
              where: {
                cooperativeId: c.cooperativeId,
                status: { not: "INACTIVE" },
              },
              select: { id: true, name: true },
            })
          : [],
        c.role === "COOPERATIVE"
          ? prisma.vehicle.findMany({
              where: { cooperativeId: c.cooperativeId, status: "ACTIVE" },
              select: { id: true, plate: true, driverId: true },
            })
          : [],
      ]);
    return {
      cooperative: c.cooperative,
      collectorId: c.collectorId,
      generators,
      routes,
      schedules,
      catalog,
      drivers,
      vehicles,
    };
  }
  async list(
    userId: string,
    role: string,
    query: { page?: number; status?: string; search?: string },
  ) {
    const c = await this.context(userId, role),
      page = Math.max(1, Math.min(query.page || 1, 10000));
    const where: Prisma.ExtraCollectionOrderWhereInput = {
      ...this.scope(c),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { id: { contains: query.search, mode: "insensitive" } },
              { reporterName: { contains: query.search, mode: "insensitive" } },
              {
                routeNameSnapshot: {
                  contains: query.search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    };
    const [orders, total] = await Promise.all([
      prisma.extraCollectionOrder.findMany({
        where,
        omit: { payload: true, originalHash: true },
        include: {
          collector: include.collector,
          collection: include.collection,
        },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: 30,
        skip: (page - 1) * 30,
      }),
      prisma.extraCollectionOrder.count({ where }),
    ]);
    const payloads = orders.length
      ? await prisma.$queryRaw<
          { id: string; payload: Prisma.JsonValue }[]
        >`SELECT id, payload - 'photos' AS payload FROM "ExtraCollectionOrder" WHERE id IN (${Prisma.join(orders.map((o) => o.id))})`
      : [];
    const byId = new Map(payloads.map((p) => [p.id, p.payload]));
    return {
      orders: orders.map((o) => ({
        ...o,
        payload: { ...(byId.get(o.id) as object), photos: [] },
      })),
      total,
      page,
      hasMore: page * 30 < total,
    };
  }
  async get(userId: string, role: string, id: string) {
    const c = await this.context(userId, role);
    const order = await prisma.extraCollectionOrder.findFirst({
      where: { id, ...this.scope(c) },
      include,
    });
    if (!order) fail("Ordem não encontrada para este usuário.", 404);
    return order!;
  }
  private async validateReferences(
    tx: Prisma.TransactionClient,
    c: Awaited<ReturnType<ExtraOrderService["context"]>>,
    p: ExtraOrderPayload,
  ) {
    if (
      p.generatorId &&
      !(await tx.generator.findFirst({
        where: { id: p.generatorId, cooperativeId: c.cooperativeId },
      }))
    )
      fail("Gerador fora da cooperativa.", 400);
    if (p.sourceScheduleId) {
      const s = await tx.schedule.findFirst({
        where: { id: p.sourceScheduleId, cooperativeId: c.cooperativeId },
        include: { collections: { select: { id: true } } },
      });
      if (!s) fail("Solicitação fora da cooperativa.", 403);
      if ((s!.generatorId || undefined) !== p.generatorId)
        fail("O gerador deve corresponder à solicitação vinculada.", 400);
    }
    let route = null;
    if (p.contextRouteId) {
      route = await tx.route.findFirst({
        where: {
          id: p.contextRouteId,
          cooperativeId: c.cooperativeId,
          collections: { some: { collectorId: c.collectorId } },
        },
      });
      if (!route) fail("Rota não vinculada ao catador desta cooperativa.", 403);
    }
    return route;
  }
  private async snapshotPayload(
    tx: Prisma.TransactionClient,
    cooperativeId: string,
    p: ExtraOrderPayload,
  ) {
    const materials = [];
    for (const m of p.materials) {
      let name = m.proposedMaterial?.name;
      if (m.wasteTypeId) {
        const item = await tx.wasteStockItem.findFirst({
          where: { id: m.wasteTypeId, cooperativeId },
        });
        if (!item) fail("Material fora do catálogo desta cooperativa.", 400);
        name = item!.name;
      }
      materials.push({ ...m, nameSnapshot: name });
    }
    return { ...p, materials };
  }
  async create(
    userId: string,
    role: string,
    data: z.infer<typeof createExtraOrder>,
  ) {
    const c = await this.context(userId, role);
    if (c.role !== "COLLECTOR" || c.inactive)
      fail("Somente catador ativo pode abrir uma O.C.", 403);
    if (data.cooperativeId !== c.cooperativeId)
      fail(
        "A cooperativa mudou. Confira o vínculo antes de reenviar a ordem.",
        409,
      );
    return prisma.$transaction(async (tx) => {
      // Serialize initial deliveries by UUID, including a response lost after commit.
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${data.id}))`;
      const prior = await tx.extraCollectionOrder.findUnique({
        where: { id: data.id },
        include,
      });
      if (prior) {
        if (
          prior.reporterUserId !== userId ||
          prior.cooperativeId !== c.cooperativeId
        )
          fail("Identificador de ordem indisponível.", 409);
        if (prior.originalHash !== hash(data))
          fail(
            "Ordem já enviada com conteúdo diferente. Consulte o protocolo.",
          );
        return prior;
      }
      const route = await this.validateReferences(tx, c, data.payload);
      const snapshot = await this.snapshotPayload(
        tx,
        c.cooperativeId,
        data.payload,
      );
      const order = await tx.extraCollectionOrder.create({
        data: {
          id: data.id,
          cooperativeId: c.cooperativeId,
          collectorId: c.collectorId!,
          contextRouteId: data.payload.contextRouteId,
          sourceScheduleId: data.payload.sourceScheduleId,
          payload: json(snapshot),
          originalHash: hash(data),
          reporterUserId: userId,
          reporterName: c.name,
          routeNameSnapshot: route?.name,
          custody: data.payload.custody,
          custodyNotes: data.payload.custodyNotes,
        },
      });
      await tx.extraCollectionOrderEvent.create({
        data: {
          orderId: order.id,
          operationId: data.id,
          operationHash: hash(data),
          kind: "SUBMITTED",
          actorUserId: userId,
          actorName: c.name,
          notes:
            "O.C. registrada para análise. Não confirma recebimento físico.",
          data: json(snapshot),
        },
      });
      await notifyCooperative(tx, c.cooperativeId, `extra-submitted:${order.id}`, "Nova O.C. para análise", "Confira o protocolo e os materiais informados.", { extraOrderId: order.id });
      return tx.extraCollectionOrder.findUniqueOrThrow({
        where: { id: order.id },
        include,
      });
    });
  }
  private async locked(
    tx: Prisma.TransactionClient,
    c: Awaited<ReturnType<ExtraOrderService["context"]>>,
    id: string,
  ) {
    await tx.$queryRaw`SELECT id FROM "ExtraCollectionOrder" WHERE id=${id} FOR UPDATE`;
    const order = await tx.extraCollectionOrder.findFirst({
      where: { id, ...this.scope(c) },
      include,
    });
    if (!order) fail("Ordem não encontrada.", 404);
    return order!;
  }
  private async replay(
    tx: Prisma.TransactionClient,
    id: string,
    operationId: string,
    data: unknown,
    actor: string,
  ) {
    const e = await tx.extraCollectionOrderEvent.findUnique({
      where: { orderId_operationId: { orderId: id, operationId } },
    });
    if (e) {
      if (e.actorUserId !== actor || e.operationHash !== hash(data))
        fail("Identificador já utilizado com outro conteúdo.");
      return true;
    }
    return false;
  }
  async revise(
    userId: string,
    role: string,
    id: string,
    data: z.infer<typeof reviseExtraOrder>,
  ) {
    const c = await this.context(userId, role);
    if (c.role !== "COLLECTOR")
      fail("Somente o catador pode complementar o relato.", 403);
    return prisma.$transaction(async (tx) => {
      const o = await this.locked(tx, c, id);
      if (await this.replay(tx, id, data.operationId, data, userId)) return o;
      if (o.status !== "NEEDS_INFO" || o.revision !== data.expectedRevision)
        fail("A ordem mudou ou não está aguardando complementação. Atualize.");
      const route = await this.validateReferences(tx, c, data.payload);
      const snapshot = await this.snapshotPayload(
        tx,
        c.cooperativeId,
        data.payload,
      );
      if (
        o.receivedAt &&
        (data.payload.mode !== "COLLECTED" ||
          new Date(data.payload.occurredAt!) > o.receivedAt)
      )
        fail(
          "A complementação não pode contradizer o recebimento já registrado.",
        );
      await tx.extraCollectionOrder.update({
        where: { id },
        data: {
          payload: json(snapshot),
          revision: { increment: 1 },
          status: "PENDING_REVIEW",
          contextRouteId: data.payload.contextRouteId || null,
          sourceScheduleId: data.payload.sourceScheduleId || null,
          routeNameSnapshot: route?.name || null,
          ...(!o.receivedAt
            ? {
                custody: data.payload.custody,
                custodyNotes: data.payload.custodyNotes,
              }
            : {}),
        },
      });
      await tx.extraCollectionOrderEvent.create({
        data: {
          orderId: id,
          operationId: data.operationId,
          operationHash: hash(data),
          kind: "RESUBMITTED",
          actorUserId: userId,
          actorName: c.name,
          notes: "Complementação enviada pelo catador.",
          data: json(snapshot),
        },
      });
      await notifyCooperative(tx, c.cooperativeId, `extra-revised:${id}:${data.operationId || "initial"}`, "O.C. complementada", "Confira o protocolo e os materiais informados.", { extraOrderId: id });
      return tx.extraCollectionOrder.findUniqueOrThrow({
        where: { id },
        include,
      });
    });
  }
  async review(
    userId: string,
    role: string,
    id: string,
    data: z.infer<typeof reviewExtraOrder>,
  ) {
    const c = await this.context(userId, role);
    if (c.role !== "COOPERATIVE")
      fail("Somente a cooperativa pode analisar a O.C.", 403);
    return prisma.$transaction(async (tx) => {
      const o = await this.locked(tx, c, id);
      if (await this.replay(tx, id, data.operationId, data, userId)) return o;
      if (
        !["PENDING_REVIEW", "NEEDS_INFO"].includes(o.status) ||
        o.revision !== data.expectedRevision
      )
        fail("Ordem já analisada ou alterada. Atualize antes de decidir.");
      const p = o.payload as unknown as ExtraOrderPayload;
      let collectionId: string | undefined;
      if (data.decision === "ACCEPT") {
        const collector = await tx.collector.findFirst({
          where: { id: o.collectorId, cooperativeId: c.cooperativeId },
        });
        if (
          !collector ||
          (p.mode === "REQUESTED" && collector.status === "INACTIVE")
        )
          fail(
            "Revise o vínculo e a disponibilidade do catador antes de aprovar.",
          );
        if (
          p.generatorId &&
          !(await tx.generator.findFirst({
            where: { id: p.generatorId, cooperativeId: c.cooperativeId },
          }))
        )
          fail("Confira o cadastro do gerador antes de aceitar.");
        let scheduleId = o.sourceScheduleId;
        if (scheduleId) {
          await tx.$queryRaw`SELECT id FROM "Schedule" WHERE id=${scheduleId} FOR UPDATE`;
          const s = await tx.schedule.findFirst({
            where: { id: scheduleId, cooperativeId: c.cooperativeId },
            include: { collections: { select: { id: true } } },
          });
          if (
            !s ||
            s.collections.length ||
            !["REQUESTED", "SCHEDULED"].includes(s.status)
          )
            fail("A solicitação vinculada já foi atendida ou encerrada.");
          if ((s!.generatorId || undefined) !== p.generatorId)
            fail("O gerador da solicitação foi alterado. Confira os vínculos.");
          await tx.schedule.update({
            where: { id: scheduleId },
            data: {
              status: "SCHEDULED",
              scheduledDate: data.scheduledDate
                ? new Date(data.scheduledDate)
                : undefined,
              pickupAddress: p.pickupAddress,
              pickupLatitude: p.latitude,
              pickupLongitude: p.longitude,
            },
          });
        } else {
          const s = await tx.schedule.create({
            data: {
              cooperativeId: c.cooperativeId,
              requestedByUserId: o.reporterUserId,
              generatorId: p.generatorId,
              pickupAddress: p.pickupAddress,
              pickupLatitude: p.latitude,
              pickupLongitude: p.longitude,
              preferredDate: p.preferredDate ? new Date(p.preferredDate) : null,
              scheduledDate: data.scheduledDate
                ? new Date(data.scheduledDate)
                : null,
              status: "SCHEDULED",
              notes: `O.C. ${o.id} · ${p.originName} · ${p.reasonNotes}`,
            },
          });
          scheduleId = s.id;
        }
        const col = await new CollectionService().createApprovedExtra(tx, {
          cooperativeId: c.cooperativeId,
          collectorId: o.collectorId,
          scheduleId: scheduleId!,
          generatorId: p.generatorId,
          driverId: data.driverId,
          vehicleId: data.vehicleId,
          notes: `O.C. ${o.id} · ${p.originName} · ${p.reasonNotes}`,
          collectedAt:
            p.mode === "COLLECTED" ? new Date(p.occurredAt!) : undefined,
          receivedAt: o.receivedAt || undefined,
          receivedByUserId: o.receivedByUserId,
          reporterUserId: o.reporterUserId,
          reporterName: o.reporterName,
          estimatedQuantities: p.materials.map((m) => m.quantity),
          materials: p.materials.map((m) =>
            collectionMaterialSchema.parse({ ...m, quantity: m.quantity || 1 }),
          ),
        });
        collectionId = col.id;
      }
      await tx.extraCollectionOrder.update({
        where: { id },
        data: {
          status:
            data.decision === "ACCEPT"
              ? "ACCEPTED"
              : data.decision === "REJECT"
                ? "REJECTED"
                : "NEEDS_INFO",
          collectionId,
          ...(data.decision === "REJECT"
            ? { custody: data.custody!, custodyNotes: data.custodyNotes! }
            : {}),
        },
      });
      await tx.extraCollectionOrderEvent.create({
        data: {
          orderId: id,
          operationId: data.operationId,
          operationHash: hash(data),
          kind: data.decision,
          actorUserId: userId,
          actorName: c.name,
          notes: data.notes,
          data: json({ ...data, collectionId }),
        },
      });
      const title = data.decision === "ACCEPT" ? "O.C. aceita pela cooperativa" : data.decision === "REJECT" ? "O.C. recusada pela cooperativa" : "Complementação de O.C. solicitada";
      await tx.inboxNotification.createMany({ data: [{ userId: o.reporterUserId, eventKey: `extra-review:${data.operationId}`, kind: "EXTRA_ORDER_REVIEW",
        title, message: data.notes, data: { extraOrderId: id, decision: data.decision } }], skipDuplicates: true });
      return tx.extraCollectionOrder.findUniqueOrThrow({
        where: { id },
        include,
      });
    });
  }
  async receive(
    userId: string,
    role: string,
    id: string,
    data: z.infer<typeof receiveExtraOrder>,
  ) {
    const c = await this.context(userId, role);
    if (c.role !== "COOPERATIVE")
      fail("Somente a cooperativa confirma recebimento.", 403);
    return prisma.$transaction(async (tx) => {
      const o = await this.locked(tx, c, id);
      if (await this.replay(tx, id, data.operationId, data, userId)) return o;
      const p = o.payload as unknown as ExtraOrderPayload;
      const receivedAt = new Date(data.receivedAt);
      if (
        p.mode !== "COLLECTED" ||
        o.receivedAt ||
        receivedAt.getTime() > Date.now() + 300000 ||
        receivedAt < new Date(p.occurredAt!)
      )
        fail(
          "Confira as datas: recebimento deve ser posterior à coleta, sem duplicar registro.",
        );
      if (o.status === "REJECTED")
        fail(
          "Ordem recusada: confira o encaminhamento registrado antes de receber.",
        );
      if (o.collectionId) {
        await tx.$queryRaw`SELECT id FROM "Collection" WHERE id=${o.collectionId} FOR UPDATE`;
        const col = await tx.collection.findUniqueOrThrow({
          where: { id: o.collectionId },
        });
        if (col.status !== "COLLECTED")
          fail(
            "O recebimento já foi registrado ou a coleta mudou. Consulte os detalhes.",
          );
        await tx.collection.update({
          where: { id: col.id },
          data: { status: "RECEIVED", receivedAt, receivedByUserId: userId },
        });
      }
      await tx.extraCollectionOrder.update({
        where: { id },
        data: {
          receivedAt,
          receivedByUserId: userId,
          custody: "COOPERATIVE",
          custodyNotes: data.notes,
        },
      });
      await tx.extraCollectionOrderEvent.create({
        data: {
          orderId: id,
          operationId: data.operationId,
          operationHash: hash(data),
          kind: "RECEIVED",
          actorUserId: userId,
          actorName: c.name,
          notes: data.notes,
          data: json({ receivedAt: data.receivedAt }),
        },
      });
      return tx.extraCollectionOrder.findUniqueOrThrow({
        where: { id },
        include,
      });
    });
  }
}
