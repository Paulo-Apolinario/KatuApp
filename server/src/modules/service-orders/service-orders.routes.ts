import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { wasteCooperativeScope } from '../waste-workspace/waste-workspace.routes';
const query = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  q: z.string().trim().max(100).default(''),
  collectionId: z.string().max(100).optional(),
  lotId: z.string().max(100).optional(),
  status: z.enum(['PENDING', 'SCHEDULED', 'IN_PROGRESS', 'COLLECTED', 'RECEIVED', 'SORTING', 'COMPLETED', 'CANCELLED']).optional(),
  kind: z.enum(['SERVICE_ORDER', 'START_RECORD', 'COLLECTION_RECEIPT', 'RECEIVING_RECEIPT', 'CLOSURE', 'CANCELLATION', 'DESTINATION_RECORD', 'TRANSPORT_RECORD', 'HISTORICAL_RECORD']).optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional()
}).strict().superRefine((q, c) => {
  if (q.dateFrom && q.dateTo && q.dateFrom > q.dateTo) c.addIssue({
    code: 'custom',
    message: 'Período inválido.'
  });
});
const summary = {
  id: true,
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
          number: true
        }
      }
    }
  }
} as const;
function period(q: z.infer<typeof query>) {
  return q.dateFrom || q.dateTo ? {
    createdAt: {
      ...(q.dateFrom ? {
        gte: new Date(q.dateFrom + 'T00:00:00-03:00')
      } : {}),
      ...(q.dateTo ? {
        lt: new Date(new Date(q.dateTo + 'T00:00:00-03:00').getTime() + 86400000)
      } : {})
    }
  } : {};
}
;
export async function serviceOrderRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);
  const guard = (fn: Function) => async (r: any, p: any) => {
    try {
      const coop = await wasteCooperativeScope(r.user.sub);
      p.header('Cache-Control', 'private, no-store');
      return await fn(r, p, coop);
    } catch (e: any) {
      return p.code(e instanceof z.ZodError ? 400 : e.statusCode || 500).send({
        error: e instanceof z.ZodError ? 'Filtros inválidos. Confira o período.' : e.statusCode ? e.message : 'Não foi possível consultar os documentos.'
      });
    }
  };
  app.get('/service-orders', guard(async (r: any, p: any, cooperativeId: string) => {
    const q = query.parse(r.query),
      term = q.q.replace(/^#+/, '');
    const sources = term ? await prisma.collection.findMany({
      where: {
        cooperativeId,
        OR: [{
          id: {
            contains: term,
            mode: 'insensitive'
          }
        }, {
          scheduleId: {
            contains: term,
            mode: 'insensitive'
          }
        }, {
          generator: {
            name: {
              contains: term,
              mode: 'insensitive'
            }
          }
        }, {
          collector: {
            name: {
              contains: term,
              mode: 'insensitive'
            }
          }
        }, {
          driver: {
            name: {
              contains: term,
              mode: 'insensitive'
            }
          }
        }, {
          vehicle: {
            plate: {
              contains: term,
              mode: 'insensitive'
            }
          }
        }, {
          route: {
            name: {
              contains: term,
              mode: 'insensitive'
            }
          }
        }]
      },
      select: {
        id: true,
        routeId: true
      }
    }) : [];
    const where: Prisma.ServiceOrderWhereInput = {
      cooperativeId,
      ...period(q),
      ...(term ? {
        OR: [{
          number: {
            contains: term,
            mode: 'insensitive'
          }
        }, {
          sourceId: {
            contains: term,
            mode: 'insensitive'
          }
        }, {
          sourceId: {
            in: sources.flatMap(s => [s.id, ...(s.routeId ? [s.routeId] : [])])
          }
        }, {
          documents: {
            some: {
              document: {
                number: {
                  contains: term,
                  mode: 'insensitive'
                }
              }
            }
          }
        }]
      } : {})
    };
    if (q.collectionId) {
      const c = await prisma.collection.findFirst({
        where: {
          id: q.collectionId,
          cooperativeId
        },
        select: {
          id: true,
          routeId: true
        }
      });
      if (!c) return p.code(404).send({
        error: 'Coleta não encontrada.'
      });
      where.AND = [{
        OR: [{
          collections: {
            some: {
              collectionId: c.id
            }
          }
        }, {
          sourceId: {
            in: [c.id, ...(c.routeId ? [c.routeId] : [])]
          }
        }, {
          documents: {
            some: {
              document: {
                collectionId: c.id,
                cooperativeId
              }
            }
          }
        }]
      }];
    }
    if (q.status) {
      const [rs, cs] = await Promise.all([prisma.route.findMany({
        where: {
          cooperativeId,
          status: {
            in: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(q.status) ? [q.status as any] : []
          }
        },
        select: {
          id: true
        }
      }), prisma.collection.findMany({
        where: {
          cooperativeId,
          status: {
            in: ['PENDING', 'IN_PROGRESS', 'COLLECTED', 'RECEIVED', 'SORTING', 'COMPLETED', 'CANCELLED'].includes(q.status) ? [q.status as any] : []
          }
        },
        select: {
          id: true
        }
      })]);
      const filters = Array.isArray(where.AND) ? where.AND : [];
      where.AND = [...filters, {
        OR: [{
          sourceType: 'ROUTE',
          sourceId: {
            in: rs.map(x => x.id)
          }
        }, {
          sourceType: 'COLLECTION',
          sourceId: {
            in: cs.map(x => x.id)
          }
        }]
      }];
    }
    const [orders, total] = await prisma.$transaction([prisma.serviceOrder.findMany({
      where,
      orderBy: [{
        createdAt: 'desc'
      }, {
        id: 'desc'
      }],
      take: q.limit,
      skip: (q.page - 1) * q.limit,
      include: {
        _count: {
          select: {
            documents: true
          }
        },
        documents: {
          where: {
            document: {
              kind: 'SERVICE_ORDER'
            }
          },
          select: {
            document: {
              select: {
                id: true,
                number: true
              }
            }
          },
          orderBy: {
            document: {
              createdAt: 'desc'
            }
          },
          take: 1
        }
      }
    }), prisma.serviceOrder.count({
      where
    })]);
    const [routes, collections] = await Promise.all([prisma.route.findMany({
      where: {
        cooperativeId,
        id: {
          in: orders.filter(o => o.sourceType === 'ROUTE').map(o => o.sourceId)
        }
      },
      select: {
        id: true,
        name: true,
        status: true,
        scheduledDate: true,
        closureOutcome: true,
        _count: {
          select: {
            collections: true
          }
        }
      }
    }), prisma.collection.findMany({
      where: {
        cooperativeId,
        id: {
          in: orders.filter(o => o.sourceType === 'COLLECTION').map(o => o.sourceId)
        }
      },
      select: {
        id: true,
        status: true,
        schedule: {
          select: {
            scheduledDate: true
          }
        },
        generator: {
          select: {
            name: true
          }
        },
        bin: {
          select: {
            name: true
          }
        }
      }
    })]);
    return {
      orders: orders.map(o => {
        const route = routes.find(x => x.id === o.sourceId),
          c = collections.find(x => x.id === o.sourceId);
        return {
          ...o,
          title: route?.name || c?.generator?.name || c?.bin?.name || 'Coleta individual',
          status: route?.status || c?.status || 'HISTORICAL',
          scheduledDate: route?.scheduledDate || c?.schedule?.scheduledDate,
          points: route?._count.collections ?? 1,
          outcome: route?.closureOutcome
        };
      }),
      pagination: {
        page: q.page,
        total,
        totalPages: Math.max(1, Math.ceil(total / q.limit))
      }
    };
  }));
  app.get('/service-orders/:id', guard(async (r: any, p: any, cooperativeId: string) => {
    const order = await prisma.serviceOrder.findFirst({
      where: {
        id: r.params.id,
        cooperativeId
      }
    });
    if (!order) return p.code(404).send({
      error: 'Ordem de serviço não encontrada.'
    });
    const documents = await prisma.internalDocument.findMany({
      where: {
        cooperativeId,
        orders: {
          some: {
            serviceOrderId: order.id
          }
        }
      },
      select: summary,
      orderBy: [{
        createdAt: 'desc'
      }, {
        number: 'desc'
      }]
    });
    const current = await prisma.$queryRaw<{
      snapshot: Prisma.JsonValue;
    }[]>`SELECT katua_order_snapshot(${cooperativeId},${order.sourceType},${order.sourceId}) AS snapshot`;
    return {
      order,
      documents,
      current: current[0]?.snapshot
    };
  }));
  app.get('/internal-documents', guard(async (r: any, _p: any, cooperativeId: string) => {
    const q = query.parse(r.query),
      term = q.q.replace(/^#+/, '');
    const where: Prisma.InternalDocumentWhereInput = {
      cooperativeId,
      ...period(q),
      ...(q.kind ? {
        kind: q.kind
      } : {}),
      ...(q.collectionId ? {
        collectionId: q.collectionId
      } : {}),
      ...(q.lotId ? {
        lotId: q.lotId
      } : {}),
      ...(term ? {
        OR: [{
          number: {
            contains: term,
            mode: 'insensitive'
          }
        }, {
          collectionId: {
            contains: term,
            mode: 'insensitive'
          }
        }, {
          lotId: {
            contains: term,
            mode: 'insensitive'
          }
        }, {
          orders: {
            some: {
              serviceOrder: {
                number: {
                  contains: term,
                  mode: 'insensitive'
                }
              }
            }
          }
        }]
      } : {})
    };
    const [documents, total] = await prisma.$transaction([prisma.internalDocument.findMany({
      where,
      select: summary,
      orderBy: [{
        createdAt: 'desc'
      }, {
        number: 'desc'
      }],
      take: q.limit,
      skip: (q.page - 1) * q.limit
    }), prisma.internalDocument.count({
      where
    })]);
    return {
      documents,
      pagination: {
        page: q.page,
        total,
        totalPages: Math.max(1, Math.ceil(total / q.limit))
      }
    };
  }));
  app.get('/internal-documents/:id', guard(async (r: any, p: any, cooperativeId: string) => {
    const document = await prisma.internalDocument.findFirst({
      where: {
        id: r.params.id,
        cooperativeId
      },
      include: {
        orders: {
          select: {
            serviceOrder: {
              select: {
                id: true,
                number: true
              }
            }
          }
        }
      }
    });
    if (!document) return p.code(404).send({
      error: 'Documento não encontrado.'
    });
    const destinationCurrentState = document.destinationId ? await prisma.collectionWasteDestination.findFirst({
      where: {
        id: document.destinationId,
        cooperativeId
      },
      select: {
        status: true,
        version: true,
        cancelledReason: true
      }
    }) : null;
    return {
      document,
      destinationCurrentState
    };
  }));
}
