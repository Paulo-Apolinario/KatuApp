import { stockDocumentGroups } from "./document-groups";
import {
  matchingDocumentIds,
  operationFilter,
  withDocumentContext,
} from "./document-context";
import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { wasteCooperativeScope } from "../waste-workspace/waste-workspace.routes";
const query = z
  .object({
    grouped: z.literal("1").optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    q: z.string().trim().max(100).default(""),
    collectionId: z.string().max(100).optional(),
    serviceOrderId: z.string().max(100).optional(),
    operation: z.enum(["STOCK_EXIT", "DESTINATION", "COLLECTION"]).optional(),
    lotId: z.string().max(100).optional(),
    status: z
      .enum([
        "PENDING",
        "SCHEDULED",
        "IN_PROGRESS",
        "COLLECTED",
        "RECEIVED",
        "SORTING",
        "COMPLETED",
        "CANCELLED",
      ])
      .optional(),
    kind: z
      .enum([
        "SERVICE_ORDER",
        "START_RECORD",
        "COLLECTION_RECEIPT",
        "RECEIVING_RECEIPT",
        "CLOSURE",
        "CANCELLATION",
        "DESTINATION_RECORD",
        "TRANSPORT_RECORD",
        "HISTORICAL_RECORD",
        "STOCK_DISPATCH",
      ])
      .optional(),
    dateFrom: z.string().date().optional(),
    dateTo: z.string().date().optional(),
  })
  .strict()
  .superRefine((q, c) => {
    if (q.dateFrom && q.dateTo && q.dateFrom > q.dateTo)
      c.addIssue({
        code: "custom",
        message: "Período inválido.",
      });
  });
const summary = {
  id: true,
  snapshot: true,
  number: true,
  kind: true,
  collectionId: true,
  lotId: true,
  movementId: true,
  destinationId: true,
  createdAt: true,
  orders: {
    select: {
      serviceOrder: {
        select: {
          id: true,
          number: true,
        },
      },
    },
  },
} as const;
function period(q: z.infer<typeof query>) {
  return q.dateFrom || q.dateTo
    ? {
        createdAt: {
          ...(q.dateFrom
            ? {
                gte: new Date(q.dateFrom + "T00:00:00-03:00"),
              }
            : {}),
          ...(q.dateTo
            ? {
                lt: new Date(
                  new Date(q.dateTo + "T00:00:00-03:00").getTime() + 86400000,
                ),
              }
            : {}),
        },
      }
    : {};
}
export async function serviceOrderRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);
  const guard = (fn: Function) => async (r: any, p: any) => {
    try {
      const coop = await wasteCooperativeScope(r.user.sub);
      p.header("Cache-Control", "private, no-store");
      return await fn(r, p, coop);
    } catch (e: any) {
      return p.code(e instanceof z.ZodError ? 400 : e.statusCode || 500).send({
        error:
          e instanceof z.ZodError
            ? "Filtros inválidos. Confira o período."
            : e.statusCode
              ? e.message
              : "Não foi possível consultar os documentos.",
      });
    }
  };
  app.get(
    "/service-orders",
    guard(async (r: any, p: any, cooperativeId: string) => {
      const q = query.parse(r.query),
        term = q.q.replace(/^#+/, "");
      const searchTerm = term.replace(/[\\%_]/g, "\\$&");
      const matchingIds = await matchingDocumentIds(cooperativeId, term);
      const sources = term
        ? await prisma.collection.findMany({
            where: {
              cooperativeId,
              OR: [
                {
                  extraOrder: {
                    payload: {
                      path: ["originName"],
                      string_contains: searchTerm,
                      mode: "insensitive",
                    },
                  },
                },
                {
                  id: {
                    contains: searchTerm,
                    mode: "insensitive",
                  },
                },
                {
                  scheduleId: {
                    contains: searchTerm,
                    mode: "insensitive",
                  },
                },
                {
                  generator: {
                    name: {
                      contains: searchTerm,
                      mode: "insensitive",
                    },
                  },
                },
                {
                  collector: {
                    name: {
                      contains: searchTerm,
                      mode: "insensitive",
                    },
                  },
                },
                {
                  driver: {
                    name: {
                      contains: searchTerm,
                      mode: "insensitive",
                    },
                  },
                },
                {
                  vehicle: {
                    plate: {
                      contains: searchTerm,
                      mode: "insensitive",
                    },
                  },
                },
                {
                  route: {
                    name: {
                      contains: searchTerm,
                      mode: "insensitive",
                    },
                  },
                },
              ],
            },
            select: {
              id: true,
              routeId: true,
            },
          })
        : [];
      const where: Prisma.ServiceOrderWhereInput = {
        cooperativeId,
        ...period(q),
        ...(term
          ? {
              OR: [
                {
                  number: {
                    contains: searchTerm,
                    mode: "insensitive",
                  },
                },
                {
                  sourceId: {
                    contains: searchTerm,
                    mode: "insensitive",
                  },
                },
                {
                  sourceId: {
                    in: sources.flatMap((s) => [
                      s.id,
                      ...(s.routeId ? [s.routeId] : []),
                    ]),
                  },
                },
                {
                  documents: {
                    some: {
                      document: {
                        number: {
                          contains: searchTerm,
                          mode: "insensitive",
                        },
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      };
      if (term && Array.isArray(where.OR))
        where.OR.push({
          documents: {
            some: { document: { cooperativeId, id: { in: matchingIds } } },
          },
        });
      if (q.operation || q.kind)
        where.AND = [
          {
            documents: {
              some: {
                document: {
                  cooperativeId,
                  ...operationFilter(q.operation),
                  ...(q.kind ? { kind: q.kind } : {}),
                },
              },
            },
          },
        ];
      if (q.collectionId) {
        const c = await prisma.collection.findFirst({
          where: {
            id: q.collectionId,
            cooperativeId,
          },
          select: {
            id: true,
            routeId: true,
          },
        });
        if (!c)
          return p.code(404).send({
            error: "Coleta não encontrada.",
          });
        where.AND = [
          ...(Array.isArray(where.AND) ? where.AND : []),
          {
            OR: [
              {
                collections: {
                  some: {
                    collectionId: c.id,
                  },
                },
              },
              {
                sourceId: {
                  in: [c.id, ...(c.routeId ? [c.routeId] : [])],
                },
              },
              {
                documents: {
                  some: {
                    document: {
                      collectionId: c.id,
                      cooperativeId,
                    },
                  },
                },
              },
            ],
          },
        ];
      }
      if (q.status) {
        const [rs, cs] = await Promise.all([
          prisma.route.findMany({
            where: {
              cooperativeId,
              status: {
                in: [
                  "SCHEDULED",
                  "IN_PROGRESS",
                  "COMPLETED",
                  "CANCELLED",
                ].includes(q.status)
                  ? [q.status as any]
                  : [],
              },
            },
            select: {
              id: true,
            },
          }),
          prisma.collection.findMany({
            where: {
              cooperativeId,
              status: {
                in: [
                  "PENDING",
                  "IN_PROGRESS",
                  "COLLECTED",
                  "RECEIVED",
                  "SORTING",
                  "COMPLETED",
                  "CANCELLED",
                ].includes(q.status)
                  ? [q.status as any]
                  : [],
              },
            },
            select: {
              id: true,
            },
          }),
        ]);
        const filters = Array.isArray(where.AND) ? where.AND : [];
        where.AND = [
          ...filters,
          {
            OR: [
              {
                sourceType: "ROUTE",
                sourceId: {
                  in: rs.map((x) => x.id),
                },
              },
              {
                sourceType: "COLLECTION",
                sourceId: {
                  in: cs.map((x) => x.id),
                },
              },
            ],
          },
        ];
      }
      const [orders, total] = await prisma.$transaction([
        prisma.serviceOrder.findMany({
          where,
          orderBy: [
            {
              createdAt: "desc",
            },
            {
              id: "desc",
            },
          ],
          take: q.limit,
          skip: (q.page - 1) * q.limit,
          include: {
            _count: {
              select: {
                documents: true,
              },
            },
            documents: {
              where: {
                document: {
                  kind: "SERVICE_ORDER",
                },
              },
              select: {
                document: {
                  select: {
                    id: true,
                    number: true,
                  },
                },
              },
              orderBy: {
                document: {
                  createdAt: "desc",
                },
              },
              take: 1,
            },
          },
        }),
        prisma.serviceOrder.count({
          where,
        }),
      ]);
      const [routes, collections] = await Promise.all([
        prisma.route.findMany({
          where: {
            cooperativeId,
            id: {
              in: orders
                .filter((o) => o.sourceType === "ROUTE")
                .map((o) => o.sourceId),
            },
          },
          select: {
            id: true,
            name: true,
            status: true,
            scheduledDate: true,
            closureOutcome: true,
            _count: {
              select: {
                collections: true,
              },
            },
          },
        }),
        prisma.collection.findMany({
          where: {
            cooperativeId,
            id: {
              in: orders
                .filter((o) => o.sourceType === "COLLECTION")
                .map((o) => o.sourceId),
            },
          },
          select: {
            id: true,
            status: true,
            schedule: {
              select: {
                scheduledDate: true,
              },
            },
            routePoint: true,
            generator: {
              select: {
                name: true,
              },
            },
            bin: {
              select: {
                name: true,
              },
            },
          },
        }),
      ]);
      const extraOrigins = collections.length
        ? await prisma.$queryRaw<
            { collectionId: string; originName: string }[]
          >`SELECT "collectionId", payload->>'originName' AS "originName" FROM "ExtraCollectionOrder" WHERE "cooperativeId"=${cooperativeId} AND "collectionId" IN (${Prisma.join(collections.map((c) => c.id))})`
        : [];
      const links = await prisma.internalDocumentLink.findMany({
        where: {
          serviceOrderId: { in: orders.map((o) => o.id) },
          document: { cooperativeId },
        },
        select: {
          serviceOrderId: true,
          document: { select: { id: true, kind: true, movementId: true } },
        },
      });
      const stockGroups = await stockDocumentGroups(cooperativeId);
      return {
        orders: orders.map((o) => {
          const route = routes.find((x) => x.id === o.sourceId),
            c = collections.find((x) => x.id === o.sourceId);
          const stockDocs = links.filter(
            (l) =>
              l.serviceOrderId === o.id &&
              (l.document.kind === "STOCK_DISPATCH" ||
                (l.document.kind === "TRANSPORT_RECORD" &&
                  l.document.movementId)),
          );
          const ownIds = new Set(stockDocs.map((l) => l.document.id));
          const children = new Set(
            stockGroups
              .filter((g) => ownIds.has(g.parentId))
              .map((g) => g.childId),
          );
          return {
            ...o,
            stockOperationCount: stockDocs.filter(
              (l) => !children.has(l.document.id),
            ).length,
            documentTypes: [
              ...new Set(
                links
                  .filter((l) => l.serviceOrderId === o.id)
                  .map((l) => l.document.kind),
              ),
            ].map((kind) => ({
              kind,
              count: links.filter(
                (l) => l.serviceOrderId === o.id && l.document.kind === kind,
              ).length,
            })),
            stockExitCount: links.filter(
              (l) =>
                l.serviceOrderId === o.id &&
                (l.document.kind === "STOCK_DISPATCH" ||
                  (l.document.kind === "TRANSPORT_RECORD" &&
                    l.document.movementId)),
            ).length,
            title:
              route?.name ||
              c?.generator?.name ||
              c?.bin?.name ||
              (c?.routePoint as any)?.name ||
              extraOrigins.find((e) => e.collectionId === c?.id)?.originName ||
              "Coleta individual",
            status: route?.status || c?.status || "HISTORICAL",
            scheduledDate: route?.scheduledDate || c?.schedule?.scheduledDate,
            points: route?._count.collections ?? 1,
            outcome: route?.closureOutcome,
          };
        }),
        pagination: {
          page: q.page,
          total,
          totalPages: Math.max(1, Math.ceil(total / q.limit)),
        },
      };
    }),
  );
  app.get(
    "/service-orders/:id",
    guard(async (r: any, p: any, cooperativeId: string) => {
      const order = await prisma.serviceOrder.findFirst({
        where: {
          id: r.params.id,
          cooperativeId,
        },
      });
      if (!order)
        return p.code(404).send({
          error: "Ordem de serviço não encontrada.",
        });
      const grouped =
        z
          .object({ grouped: z.literal("1").optional() })
          .strict()
          .parse(r.query).grouped === "1";
      const groups = grouped ? await stockDocumentGroups(cooperativeId) : [];
      const documents = await prisma.internalDocument.findMany({
        where: {
          cooperativeId,
          orders: {
            some: {
              serviceOrderId: order.id,
            },
          },
        },
        select: summary,
        orderBy: [
          {
            createdAt: "desc",
          },
          {
            number: "desc",
          },
        ],
      });
      const current = await prisma.$queryRaw<
        {
          snapshot: Prisma.JsonValue;
        }[]
      >`SELECT katua_order_snapshot(${cooperativeId},${order.sourceType},${order.sourceId}) AS snapshot`;
      return {
        order,
        documents: documents
          .filter(
            (d) =>
              !groups.some(
                (g) =>
                  g.childId === d.id &&
                  documents.some((parent) => parent.id === g.parentId),
              ),
          )
          .map(withDocumentContext),
        current: current[0]?.snapshot,
      };
    }),
  );
  app.get(
    "/internal-documents",
    guard(async (r: any, _p: any, cooperativeId: string) => {
      const q = query.parse(r.query),
        term = q.q.replace(/^#+/, "");
      const searchTerm = term.replace(/[\\%_]/g, "\\$&");
      const matchingIds = await matchingDocumentIds(cooperativeId, term);
      const grouped =
        q.grouped === "1" &&
        (!q.operation || q.operation === "STOCK_EXIT") &&
        (!q.kind || q.kind === "STOCK_DISPATCH");
      const groups = grouped ? await stockDocumentGroups(cooperativeId) : [];
      const scopedParents =
        grouped && q.serviceOrderId
          ? new Set(
              (
                await prisma.internalDocument.findMany({
                  where: {
                    cooperativeId,
                    kind: "STOCK_DISPATCH",
                    orders: { some: { serviceOrderId: q.serviceOrderId } },
                  },
                  select: { id: true },
                })
              ).map((d) => d.id),
            )
          : null;
      const visibleGroups = scopedParents
        ? groups.filter((g) => scopedParents.has(g.parentId))
        : groups;
      const matched = new Set(matchingIds);
      const matchingParents = groups
        .filter((g) => matched.has(g.childId))
        .map((g) => g.parentId);
      const where: Prisma.InternalDocumentWhereInput = {
        cooperativeId,
        AND: [
          operationFilter(q.operation),
          ...(grouped
            ? [{ id: { notIn: visibleGroups.map((g) => g.childId) } }]
            : []),
          ...(q.serviceOrderId
            ? [{ orders: { some: { serviceOrderId: q.serviceOrderId } } }]
            : []),
          ...(q.lotId
            ? [
                {
                  OR: [
                    { lotId: q.lotId },
                    {
                      snapshot: {
                        path: ["dispatch", "allocations"],
                        array_contains: [{ lotId: q.lotId }],
                      },
                    },
                  ],
                },
              ]
            : []),
        ],
        ...period(q),
        ...(q.kind
          ? {
              kind: q.kind,
            }
          : {}),
        ...(q.collectionId
          ? {
              collectionId: q.collectionId,
            }
          : {}),

        ...(term
          ? {
              OR: [
                {
                  number: {
                    contains: searchTerm,
                    mode: "insensitive",
                  },
                },
                {
                  collectionId: {
                    contains: searchTerm,
                    mode: "insensitive",
                  },
                },
                {
                  lotId: {
                    contains: searchTerm,
                    mode: "insensitive",
                  },
                },
                {
                  orders: {
                    some: {
                      serviceOrder: {
                        number: {
                          contains: searchTerm,
                          mode: "insensitive",
                        },
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      };
      if (term && Array.isArray(where.OR))
        where.OR.push({ id: { in: [...matchingIds, ...matchingParents] } });
      const [documents, total] = await prisma.$transaction([
        prisma.internalDocument.findMany({
          where,
          select: summary,
          orderBy: [
            {
              createdAt: "desc",
            },
            {
              number: "desc",
            },
          ],
          take: q.limit,
          skip: (q.page - 1) * q.limit,
        }),
        prisma.internalDocument.count({
          where,
        }),
      ]);
      return {
        documents: documents.map(withDocumentContext),
        pagination: {
          page: q.page,
          total,
          totalPages: Math.max(1, Math.ceil(total / q.limit)),
        },
      };
    }),
  );
  app.get(
    "/internal-documents/:id/lots",
    guard(async (r: any, p: any, cooperativeId: string) => {
      const parent = await prisma.internalDocument.findFirst({
        where: { id: r.params.id, cooperativeId, kind: "STOCK_DISPATCH" },
        select: { id: true, number: true, snapshot: true },
      });
      if (!parent)
        return p
          .code(404)
          .send({ error: "Comprovante consolidado não encontrado." });
      const dispatch = (parent.snapshot as any)?.dispatch;
      const allocations: any[] = Array.isArray(dispatch?.allocations)
        ? dispatch.allocations
        : [];
      const movements = allocations
        .map((a) => a.movementId)
        .filter((id): id is string => typeof id === "string" && !!id);
      const children = await prisma.internalDocument.findMany({
        where: {
          cooperativeId,
          kind: "TRANSPORT_RECORD",
          movementId: { in: movements },
        },
        select: summary,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      return {
        documentId: parent.id,
        number: parent.number,
        unit: dispatch?.unit || "",
        lots: allocations.map((a) => ({
          lotId: a.lotId,
          lotCode: a.lotCode || a.lotId,
          quantity: a.quantity,
          before: a.before,
          after: a.after,
          unit: dispatch?.unit || "",
          originCollectionId: a.originCollectionId || null,
          documents: children
            .filter((c) => c.movementId === a.movementId)
            .map(withDocumentContext),
        })),
      };
    }),
  );
  app.get(
    "/internal-documents/:id",
    guard(async (r: any, p: any, cooperativeId: string) => {
      const document = await prisma.internalDocument.findFirst({
        where: {
          id: r.params.id,
          cooperativeId,
        },
        include: {
          orders: {
            select: {
              serviceOrder: {
                select: {
                  id: true,
                  number: true,
                },
              },
            },
          },
        },
      });
      if (!document)
        return p.code(404).send({
          error: "Documento não encontrado.",
        });
      const destinationCurrentState = document.destinationId
        ? await prisma.collectionWasteDestination.findFirst({
            where: {
              id: document.destinationId,
              cooperativeId,
            },
            select: {
              status: true,
              version: true,
              cancelledReason: true,
            },
          })
        : null;
      return {
        document,
        destinationCurrentState,
      };
    }),
  );
}
