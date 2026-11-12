import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { generateStockCode } from "../waste-stock/stock-codes";
import { catalogDeclaration } from "../impact/material-profile";
import { receiveBag, sorting, mutation, adjust, cancel } from "./bags.schemas";
type Tx = Prisma.TransactionClient;
export type BagContext = {
  cooperativeId: string;
  userId: string;
  name: string;
  collectorId: string | null;
  manager: boolean;
};
export function fail(message: string, statusCode = 409): never {
  throw Object.assign(Error(message), { statusCode });
}
const dec = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);
const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const bagState = (bag: {
  grossKg: Prisma.Decimal;
  tareKg: Prisma.Decimal;
  netKg: Prisma.Decimal;
  sortedKg: Prisma.Decimal;
  rejectedKg: Prisma.Decimal;
  status: string;
  version: number;
}) => ({
  grossKg: bag.grossKg.toFixed(3),
  tareKg: bag.tareKg.toFixed(3),
  netKg: bag.netKg.toFixed(3),
  sortedKg: bag.sortedKg.toFixed(3),
  rejectedKg: bag.rejectedKg.toFixed(3),
  remainingKg: bag.netKg.sub(bag.sortedKg).sub(bag.rejectedKg).toFixed(3),
  status: bag.status,
  version: bag.version,
});
export async function bagContext(userId: string): Promise<BagContext> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      cooperative: { select: { id: true } },
      collector: { select: { id: true, cooperativeId: true, status: true } },
    },
  });
  if (
    !user ||
    !user.isActive ||
    !user.credentialsReady ||
    user.accountStatus !== "ACTIVE"
  )
    fail("Conta indisponível.", 403);
  if (user.role === "COOPERATIVE" && user.cooperative)
    return {
      cooperativeId: user.cooperative.id,
      userId,
      name: user.displayName,
      collectorId: null,
      manager: true,
    };
  if (
    user.role === "COLLECTOR" &&
    user.collector?.cooperativeId &&
    user.collector.status !== "INACTIVE"
  )
    return {
      cooperativeId: user.collector.cooperativeId,
      userId,
      name: user.displayName,
      collectorId: user.collector.id,
      manager: false,
    };
  return fail(
    "Triagem disponível apenas para a cooperativa e seus catadores ativos.",
    403,
  );
}
async function previous(
  tx: Tx,
  ctx: BagContext,
  operationId: string,
  hash: string,
  bagId?: string,
) {
  const event = await tx.mixedBagEvent.findUnique({
    where: {
      cooperativeId_operationId: {
        cooperativeId: ctx.cooperativeId,
        operationId,
      },
    },
    include: { outputs: true },
  });
  if (!event) return null;
  if (
    event.operationHash !== hash ||
    event.actorUserId !== ctx.userId ||
    (bagId && event.bagId !== bagId)
  )
    fail("Este protocolo já foi usado com outros dados.");
  const bag = await tx.mixedBag.findFirstOrThrow({
    where: { id: event.bagId, cooperativeId: ctx.cooperativeId },
  });
  return { bag: { ...bag, ...bagState(bag) }, event, replayed: true };
}
export async function receive(
  ctx: BagContext,
  input: z.infer<typeof receiveBag>,
) {
  const data = {
    ...input,
    generatorIds: [...new Set(input.generatorIds)].sort(),
    externalTag: input.externalTag?.trim().toUpperCase() || null,
  };
  const hash = digest({ kind: "RECEIVE", ...data });
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Cooperative" WHERE id=${ctx.cooperativeId} FOR UPDATE`;
      const old = await previous(tx, ctx, data.operationId, hash);
      if (old) return old;
      if (
        data.externalTag &&
        (await tx.mixedBag.findFirst({
          where: {
            cooperativeId: ctx.cooperativeId,
            externalTag: data.externalTag,
            status: { in: ["WAITING", "SORTING"] },
          },
        }))
      )
        fail(
          "Esta identificação já está em uma bag aguardando triagem. Abra o registro existente.",
        );
      let collection = data.collectionId
        ? await tx.collection.findFirst({
            where: { id: data.collectionId, cooperativeId: ctx.cooperativeId },
            include: {
              collectionMaterials: { select: { id: true } },
              collectionWasteEntries: { select: { id: true } },
            },
          })
        : null;
      if (data.collectionId) {
        await tx.$queryRaw`SELECT id FROM "Collection" WHERE id=${data.collectionId} AND "cooperativeId"=${ctx.cooperativeId} FOR UPDATE`;
        collection = await tx.collection.findFirst({
          where: { id: data.collectionId, cooperativeId: ctx.cooperativeId },
          include: {
            collectionMaterials: { select: { id: true } },
            collectionWasteEntries: { select: { id: true } },
          },
        });
        if (!collection) fail("Coleta não encontrada.", 404);
        if (collection.intakeKind === "MIXED_BAG") {
          if (!["RECEIVED", "SORTING"].includes(collection.status))
            fail(
              "Este recebimento já foi encerrado. Registre uma nova entrada.",
            );
        } else if (
          collection.status !== "COLLECTED" ||
          collection.receivedAt ||
          collection.collectionMaterials.length ||
          collection.collectionWasteEntries.length ||
          collection.totalWeightKg !== 0
        )
          fail(
            "Vincule apenas uma coleta ainda não recebida e sem materiais/peso registrados, ou um recebimento de bags em aberto. Não é criada uma segunda entrada para uma coleta já pesada.",
          );
        if (collection.generatorId) {
          if (data.generatorIds.some((id) => id !== collection!.generatorId))
            fail("As origens não correspondem ao gerador da coleta.", 400);
          data.generatorIds = [collection.generatorId];
        }
      }
      const generators = await tx.generator.findMany({
        where: {
          cooperativeId: ctx.cooperativeId,
          id: { in: data.generatorIds },
        },
        select: { id: true, name: true, companyName: true },
      });
      if (generators.length !== data.generatorIds.length)
        fail("Há origem fora da cooperativa ou indisponível.", 404);
      const id = data.operationId,
        net = dec(data.grossKg).sub(data.tareKg),
        now = new Date();
      const origin = {
        mixedBagId: id,
        generators: generators.map((g) => ({
          id: g.id,
          name: g.companyName || g.name,
        })),
        attribution:
          generators.length === 1 ? "SINGLE_ORIGIN" : "NO_QUANTITY_ALLOCATION",
        name: data.originLabel,
      };
      if (!collection) {
        const c = await tx.collection.create({
          data: {
            cooperativeId: ctx.cooperativeId,
            intakeKind: "MIXED_BAG",
            intakeOrigin: origin,
            generatorId: generators.length === 1 ? generators[0].id : null,
            status: "RECEIVED",
            receivedAt: now,
            receivedByUserId: ctx.userId,
            collectedAt: now,
            reportedTotalWeightKg: 0,
            totalWeightKg: 0,
          },
        });
        collection = {
          ...c,
          collectionMaterials: [],
          collectionWasteEntries: [],
        };
      }
      const bag = await tx.mixedBag.create({
        data: {
          id,
          cooperativeId: ctx.cooperativeId,
          collectionId: collection.id,
          code: `BAG-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8).toUpperCase()}`,
          externalTag: data.externalTag,
          grossKg: dec(data.grossKg),
          tareKg: dec(data.tareKg),
          netKg: net,
          originLabel: data.originLabel,
          originSnapshot: origin,
          storageLocation: data.storageLocation || null,
          notes: data.notes || null,
          createdByUserId: ctx.userId,
          createdByName: ctx.name,
          receivedAt: now,
        },
      });
      const total = await tx.mixedBag.aggregate({
        where: { collectionId: collection.id, status: { not: "CANCELLED" } },
        _sum: { netKg: true },
      });
      await tx.collection.update({
        where: { id: collection.id },
        data: {
          intakeKind: "MIXED_BAG",
          intakeOrigin:
            collection.intakeKind === "MIXED_BAG" ? undefined : origin,
          status: collection.status === "SORTING" ? "SORTING" : "RECEIVED",
          receivedAt: collection.receivedAt || now,
          receivedByUserId: collection.receivedByUserId || ctx.userId,
          reportedTotalWeightKg: Number(total._sum.netKg || 0),
        },
      });
      const event = await tx.mixedBagEvent.create({
        data: {
          bagId: id,
          cooperativeId: ctx.cooperativeId,
          operationId: data.operationId,
          operationHash: hash,
          kind: "RECEIVE",
          actorUserId: ctx.userId,
          actorName: ctx.name,
          participantSnapshot: [],
          notes: data.notes || null,
          before: {},
          after: bagState(bag),
        },
      });
      return { bag: { ...bag, ...bagState(bag) }, event, replayed: false };
    },
    { timeout: 20000 },
  );
}
const snapshotLot = (l: any) => ({
  quantity: String(l.quantity ?? 0),
  availableQuantity: String(l.availableQuantity),
  status: l.status,
  processingStage: l.processingStage,
  version: l.version,
});
export async function mutate(
  ctx: BagContext,
  bagId: string,
  kind: "SORT" | "CLOSE" | "ADJUST" | "CANCEL",
  input:
    | z.infer<typeof sorting>
    | z.infer<typeof mutation>
    | z.infer<typeof adjust>
    | z.infer<typeof cancel>,
) {
  const hash = digest({ kind, bagId, ...input });
  if ((kind === "ADJUST" || kind === "CANCEL") && !ctx.manager)
    fail(
      "Somente o gestor pode ajustar ou cancelar a pesagem de entrada.",
      403,
    );
  return prisma.$transaction(
    async (tx) => {
      const head = await tx.mixedBag.findFirst({
        where: { id: bagId, cooperativeId: ctx.cooperativeId },
      });
      if (!head) fail("Bag não encontrada.", 404);
      const outputs =
        kind === "SORT" ? (input as z.infer<typeof sorting>).outputs : [];
      const targetLots = await tx.wasteStockLot.findMany({
        where: {
          id: { in: outputs.flatMap((o) => (o.lotId ? [o.lotId] : [])) },
          cooperativeId: ctx.cooperativeId,
        },
        select: { originCollectionId: true },
      });
      const origins = [
        ...new Set([
          head.collectionId,
          ...targetLots.flatMap((l) =>
            l.originCollectionId ? [l.originCollectionId] : [],
          ),
        ]),
      ].sort();
      for (const id of origins)
        await tx.$queryRaw`SELECT id FROM "Collection" WHERE id=${id} AND "cooperativeId"=${ctx.cooperativeId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "MixedBag" WHERE id=${bagId} AND "cooperativeId"=${ctx.cooperativeId} FOR UPDATE`;
      const old = await previous(tx, ctx, input.operationId, hash, bagId);
      if (old) return old;
      const bag = await tx.mixedBag.findFirstOrThrow({
        where: { id: bagId, cooperativeId: ctx.cooperativeId },
      });
      if (bag.version !== input.expectedVersion)
        fail("Esta bag foi alterada. Atualize os dados antes de continuar.");
      if (!["WAITING", "SORTING"].includes(bag.status))
        fail("Bag encerrada. Seu histórico está preservado.");
      const before = bagState(bag),
        remaining = bag.netKg.sub(bag.sortedKg).sub(bag.rejectedKg);
      let next = bag;
      let participants: { id: string; name: string }[] = [];
      if (kind === "SORT") {
        const data = input as z.infer<typeof sorting>;
        const ids = [
          ...new Set([
            ...data.participantIds,
            ...(ctx.collectorId ? [ctx.collectorId] : []),
          ]),
        ];
        if (!ids.length) fail("Informe quem participou da triagem.", 400);
        const people = await tx.collector.findMany({
          where: {
            cooperativeId: ctx.cooperativeId,
            id: { in: ids },
            status: { not: "INACTIVE" },
          },
          select: { id: true, name: true },
        });
        if (people.length !== ids.length)
          fail("Há participante indisponível ou de outra cooperativa.", 400);
        participants = people.sort((a, b) => a.id.localeCompare(b.id));
        const sorted = data.outputs.reduce(
          (sum, o) => sum.add(o.quantityKg),
          dec(0),
        );
        if (sorted.add(data.rejectedKg).gt(remaining))
          fail(
            "O peso separado e os rejeitos ultrapassam o saldo da bag. Confira a pesagem; o gestor pode registrar um ajuste de entrada.",
          );
        if (
          new Set(data.outputs.flatMap((o) => (o.lotId ? [o.lotId] : [])))
            .size !== data.outputs.filter((o) => o.lotId).length
        )
          fail(
            "Adicione cada lote de destino apenas uma vez nesta pesagem.",
            400,
          );
        next = await tx.mixedBag.update({
          where: { id: bag.id },
          data: {
            sortedKg: { increment: sorted },
            rejectedKg: { increment: dec(data.rejectedKg) },
            status: "SORTING",
            version: { increment: 1 },
          },
        });
      } else if (kind === "CLOSE") {
        if (!remaining.isZero())
          fail(
            "Ainda há material a triar. Registre os materiais, os rejeitos ou solicite um ajuste ao gestor antes de concluir.",
          );
        next = await tx.mixedBag.update({
          where: { id: bag.id },
          data: {
            status: "COMPLETED",
            closedAt: new Date(),
            version: { increment: 1 },
          },
        });
      } else if (kind === "ADJUST") {
        const data = input as z.infer<typeof adjust>,
          net = dec(data.grossKg).sub(data.tareKg);
        if (net.lt(bag.sortedKg.add(bag.rejectedKg)))
          fail(
            "O novo peso líquido não pode ser menor que o material já processado.",
          );
        next = await tx.mixedBag.update({
          where: { id: bag.id },
          data: {
            grossKg: dec(data.grossKg),
            tareKg: dec(data.tareKg),
            netKg: net,
            version: { increment: 1 },
          },
        });
      } else {
        if (!bag.sortedKg.isZero() || !bag.rejectedKg.isZero())
          fail(
            "Uma bag com triagem registrada não pode ser cancelada. Preserve o histórico e registre as movimentações de estoque necessárias.",
          );
        next = await tx.mixedBag.update({
          where: { id: bag.id },
          data: {
            status: "CANCELLED",
            closedAt: new Date(),
            version: { increment: 1 },
          },
        });
      }
      const event = await tx.mixedBagEvent.create({
        data: {
          bagId: bag.id,
          cooperativeId: ctx.cooperativeId,
          operationId: input.operationId,
          operationHash: hash,
          kind,
          actorUserId: ctx.userId,
          actorName: ctx.name,
          participantSnapshot: participants,
          rejectedKg:
            kind === "SORT"
              ? dec((input as z.infer<typeof sorting>).rejectedKg)
              : dec(0),
          notes: "notes" in input ? input.notes || null : null,
          before,
          after: bagState(next),
        },
      });
      const collection = await tx.collection.findUniqueOrThrow({
        where: { id: bag.collectionId },
      });
      if (kind === "SORT") {
        for (const lotId of [
          ...new Set(outputs.flatMap((o) => (o.lotId ? [o.lotId] : []))),
        ].sort())
          await tx.$queryRaw`SELECT id FROM "WasteStockLot" WHERE id=${lotId} AND "cooperativeId"=${ctx.cooperativeId} FOR UPDATE`;
        for (const [index, o] of outputs.entries()) {
          const item = await tx.wasteStockItem.findFirst({
            where: {
              id: o.itemId,
              cooperativeId: ctx.cooperativeId,
              isActive: true,
              status: "ACTIVE",
            },
          });
          if (!item)
            fail("Material indisponível no catálogo da cooperativa.", 404);
          if (item.unit !== "KG")
            fail(
              "Esta triagem usa a balança em kg. Selecione um material do catálogo medido em kg; litros e unidades não são convertidos automaticamente.",
              400,
            );
          const material = await tx.collectionMaterial.create({
            data: {
              collectionId: collection.id,
              wasteTypeId: item.id,
              nameSnapshot: item.name,
              categorySnapshot: item.category,
              subcategorySnapshot: item.subcategory,
              unit: "KG",
              quantity: dec(o.quantityKg),
              identificationSnapshot: catalogDeclaration(item.technicalProfile),
            },
          });
          const entry = await tx.collectionWasteEntry.create({
            data: {
              cooperativeId: ctx.cooperativeId,
              collectionId: collection.id,
              collectionMaterialId: material.id,
              wasteTypeId: item.id,
              generatorId: collection.generatorId,
              materialNameSnapshot: item.name,
              categorySnapshot: item.category,
              subcategorySnapshot: item.subcategory,
              unit: "KG",
              collectedQuantity: dec(o.quantityKg),
              destinedQuantity: dec(o.quantityKg),
              remainingQuantity: dec(0),
              status: "ADDED_TO_STOCK",
              origin: "MIXED_BAG_SORTING",
              collectedAt: bag.receivedAt,
              createdByUserId: ctx.userId,
              createdByNameSnapshot: ctx.name,
            },
          });
          let lot = o.lotId
            ? await tx.wasteStockLot.findFirst({
                where: { id: o.lotId, cooperativeId: ctx.cooperativeId },
              })
            : null;
          const beforeLot = lot
            ? snapshotLot(lot)
            : {
                quantity: "0",
                availableQuantity: "0",
                status: "AVAILABLE",
                processingStage: "TRIADO",
                version: 0,
              };
          if (o.lotId) {
            if (!lot || lot.stockItemId !== item.id || lot.unit !== "KG")
              fail(
                "O lote não corresponde ao material e à unidade selecionados.",
                400,
              );
            if (lot.version !== o.expectedLotVersion)
              fail(
                "O lote de destino mudou. Atualize a lista antes de confirmar.",
              );
            if (
              lot.status !== "AVAILABLE" ||
              !["TRIADO", "ARMAZENADO"].includes(lot.processingStage)
            )
              fail(
                "Complemente somente um lote disponível, triado ou armazenado, sem reserva.",
              );
            lot = await tx.wasteStockLot.update({
              where: { id: lot.id },
              data: {
                quantity: Prisma.Decimal.max(
                  dec(lot.quantity ?? 0),
                  dec(lot.quantityKg),
                  lot.availableQuantity,
                ).add(o.quantityKg),
                availableQuantity: { increment: dec(o.quantityKg) },
                quantityKg: { increment: o.quantityKg },
                version: { increment: 1 },
              },
            });
          } else {
            const code = generateStockCode("LOT");
            lot = await tx.wasteStockLot.create({
              data: {
                cooperativeId: ctx.cooperativeId,
                stockItemId: item.id,
                code,
                lotCode: code,
                unit: "KG",
                quantity: dec(o.quantityKg),
                availableQuantity: dec(o.quantityKg),
                quantityKg: o.quantityKg,
                processingStage: "TRIADO",
                status: "AVAILABLE",
                originCollectionId: collection.id,
                originCollectionMaterialId: material.id,
                originCollectionWasteEntryId: entry.id,
                origin: `Triagem da ${bag.code}`,
                storageLocation: bag.storageLocation,
                createdByUserId: ctx.userId,
              },
            });
          }
          const destination = await tx.collectionWasteDestination.create({
            data: {
              cooperativeId: ctx.cooperativeId,
              collectionWasteEntryId: entry.id,
              stockItemId: item.id,
              stockLotId: o.lotId ? null : lot.id,
              type: "STOCK",
              quantity: dec(o.quantityKg),
              unit: "KG",
              createdByUserId: ctx.userId,
              metadata: {
                mixedBagId: bag.id,
                eventId: event.id,
                lotId: lot.id,
              },
            },
          });
          await tx.mixedBagOutput.create({
            data: {
              bagId: bag.id,
              eventId: event.id,
              lotId: lot.id,
              materialId: material.id,
              destinationId: destination.id,
              itemId: item.id,
              materialName: item.name,
              quantityKg: dec(o.quantityKg),
              lotCode: lot.lotCode || lot.code || lot.id,
            },
          });
          await tx.wasteStockMovement.create({
            data: {
              cooperativeId: ctx.cooperativeId,
              lotId: lot.id,
              operationId: `BAG:${input.operationId}:${index}`,
              operationHash: hash,
              kind: "SORTING_IN",
              quantity: dec(o.quantityKg),
              unit: "KG",
              actorUserId: ctx.userId,
              actorName: ctx.name,
              notes: `${bag.code} · ${bag.originLabel}`,
              before: beforeLot,
              after: snapshotLot(lot),
            },
          });
        }
        const added = outputs.reduce((sum, o) => sum.add(o.quantityKg), dec(0));
        if (collection.generatorId && added.gt(0))
          await tx.generator.update({
            where: { id: collection.generatorId },
            data: { totalKg: { increment: Number(added) } },
          });
      }
      const bags = await tx.mixedBag.findMany({
        where: { collectionId: collection.id },
      });
      const valid = bags.filter((b) => b.status !== "CANCELLED"),
        net = valid.reduce((s, b) => s.add(b.netKg), dec(0)),
        sorted = valid.reduce((s, b) => s.add(b.sortedKg), dec(0));
      const closed = valid.every((b) => b.status === "COMPLETED"),
        started = valid.some(
          (b) =>
            b.status === "SORTING" ||
            !b.sortedKg.isZero() ||
            !b.rejectedKg.isZero(),
        );
      await tx.collection.update({
        where: { id: collection.id },
        data: {
          reportedTotalWeightKg: Number(net),
          totalWeightKg: Number(sorted),
          ...(!valid.length
            ? {
                cancelledAt: new Date(),
                cancelledByUserId: ctx.userId,
                cancellationReason: "notes" in input ? input.notes : null,
              }
            : {}),
          status: !valid.length
            ? "CANCELLED"
            : closed
              ? "COMPLETED"
              : started
                ? "SORTING"
                : "RECEIVED",
          completedAt: closed && valid.length ? new Date() : null,
          completedByUserId: closed && valid.length ? ctx.userId : null,
          sortingStartedAt: started
            ? collection.sortingStartedAt || new Date()
            : collection.sortingStartedAt,
          quantitiesReviewedAt:
            kind === "SORT" ? new Date() : collection.quantitiesReviewedAt,
          quantityReviewVersion: kind === "SORT" ? { increment: 1 } : undefined,
        },
      });
      return {
        bag: { ...next, ...bagState(next) },
        event: json(event),
        replayed: false,
      };
    },
    { timeout: 30000 },
  );
}
