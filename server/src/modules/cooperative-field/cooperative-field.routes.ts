import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { wasteCooperativeScope } from '../waste-workspace/waste-workspace.routes';
const kinds = z.enum(['collectors', 'drivers', 'generators', 'pevs']);
const query = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  q: z.string().trim().max(100).default(''),
  filter: z.enum(['all', 'pending', 'active', 'completed']).default('all')
}).strict();
const person = {
  id: true,
  name: true,
  phone: true,
  email: true,
  status: true
} as const;
const generator = {
  id: true,
  name: true,
  phone: true,
  email: true,
  companyName: true,
  type: true,
  documentNumber: true,
  accessStatus: true,
  address: true,
  street: true,
  number: true,
  neighborhood: true,
  city: true,
  state: true,
  zipCode: true,
  latitude: true,
  longitude: true
} as const;
const bin = {
  id: true,
  name: true,
  binId: true,
  status: true,
  location: true,
  street: true,
  number: true,
  neighborhood: true,
  city: true,
  state: true,
  latitude: true,
  longitude: true,
  needsPickup: true,
  acceptedMaterials: true,
  restrictions: true,
  responsibleName: true,
  responsibleContact: true
} as const;
const work = {
  id: true,
  status: true,
  createdAt: true,
  startedAt: true,
  collectedAt: true,
  receivedAt: true,
  completedAt: true,
  cancellationReason: true,
  notes: true,
  routePoint: true,
  schedule: {
    select: {
      scheduledDate: true,
      preferredDate: true
    }
  },
  generator: {
    select: {
      id: true,
      name: true
    }
  },
  bin: {
    select: {
      id: true,
      name: true
    }
  },
  route: {
    select: {
      id: true,
      name: true,
      status: true,
      scheduledDate: true
    }
  },
  collector: {
    select: {
      id: true,
      name: true
    }
  },
  driver: {
    select: {
      id: true,
      name: true
    }
  },
  vehicle: {
    select: {
      plate: true
    }
  },
  participants: {
    select: {
      collectorId: true,
      nameSnapshot: true
    }
  },
  collectionMaterials: {
    select: {
      id: true,
      nameSnapshot: true,
      quantity: true,
      unit: true
    }
  },
  incidents: {
    select: {
      id: true,
      status: true,
      description: true,
      resolution: true
    }
  }
} satisfies Prisma.CollectionSelect;
async function entity(cooperativeId: string, kind: string, id: string) {
  if (kind === 'collectors') return prisma.collector.findFirst({
    where: {
      id,
      cooperativeId
    },
    select: person
  });
  if (kind === 'drivers') return prisma.driver.findFirst({
    where: {
      id,
      cooperativeId
    },
    select: person
  });
  if (kind === 'generators') return prisma.generator.findFirst({
    where: {
      id,
      cooperativeId
    },
    select: generator
  });
  return prisma.bin.findFirst({
    where: {
      id,
      cooperativeId
    },
    select: bin
  });
}
function collectionWhere(cooperativeId: string, kind: string, id: string): Prisma.CollectionWhereInput {
  return {
    cooperativeId,
    ...(kind === 'collectors' ? {
      OR: [{
        collectorId: id
      }, {
        participants: {
          some: {
            collectorId: id
          }
        }
      }]
    } : kind === 'drivers' ? {
      driverId: id
    } : kind === 'generators' ? {
      generatorId: id
    } : {
      binId: id
    })
  };
}
export async function cooperativeFieldRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);
  const guard = (fn: Function) => async (r: any, p: any) => {
    try {
      const coop = await wasteCooperativeScope(r.user.sub);
      p.header('Cache-Control', 'private, no-store');
      return await fn(r, p, coop);
    } catch (e: any) {
      return p.code(e instanceof z.ZodError ? 400 : e.statusCode || 500).send({
        error: e instanceof z.ZodError ? 'Filtros inválidos.' : e.statusCode ? e.message : 'Não foi possível consultar os dados de campo.'
      });
    }
  };
  app.post('/cooperative-field/geocode', guard(async (r: any, p: any) => {
    const {
      address
    } = z.object({
      address: z.string().trim().min(10).max(500)
    }).strict().parse(r.body);
    try {
      const response = await fetch('https://nominatim.openstreetmap.org/search?' + new URLSearchParams({
        q: address,
        format: 'json',
        limit: '1',
        countrycodes: 'br'
      }), {
        headers: {
          'User-Agent': 'Katua/1.0 (field address confirmation)'
        },
        signal: AbortSignal.timeout(8000)
      });
      if (!response.ok) throw Error('Geocodificação indisponível.');
      const rows = (await response.json()) as any[];
      const item = rows[0],
        latitude = Number(item?.lat),
        longitude = Number(item?.lon);
      if (!item || !Number.isFinite(latitude) || !Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180) return p.code(422).send({
        error: 'Endereço não localizado. Marque o ponto no mapa.'
      });
      return {
        latitude,
        longitude,
        label: String(item.display_name || address)
      };
    } catch {
      return p.code(503).send({
        error: 'Busca de endereço indisponível. Marque no mapa ou use o GPS.'
      });
    }
  }));
  app.get('/cooperative-field/:kind', guard(async (r: any, _p: any, cooperativeId: string) => {
    const kind = kinds.parse(r.params.kind),
      q = query.parse(r.query),
      name = {
        contains: q.q,
        mode: 'insensitive' as const
      },
      skip = (q.page - 1) * 20;
    let items: any[], total: number;
    if (kind === 'collectors') {
      const where = {
        cooperativeId,
        name
      };
      [items, total] = await prisma.$transaction([prisma.collector.findMany({
        where,
        select: person,
        orderBy: [{
          name: 'asc'
        }, {
          id: 'asc'
        }],
        skip,
        take: 20
      }), prisma.collector.count({
        where
      })]);
    } else if (kind === 'drivers') {
      const where = {
        cooperativeId,
        name
      };
      [items, total] = await prisma.$transaction([prisma.driver.findMany({
        where,
        select: person,
        orderBy: [{
          name: 'asc'
        }, {
          id: 'asc'
        }],
        skip,
        take: 20
      }), prisma.driver.count({
        where
      })]);
    } else if (kind === 'generators') {
      const where = {
        cooperativeId,
        OR: [{
          name
        }, {
          companyName: name
        }, {
          address: name
        }, {
          street: name
        }, {
          neighborhood: name
        }]
      };
      [items, total] = await prisma.$transaction([prisma.generator.findMany({
        where,
        select: generator,
        orderBy: [{
          name: 'asc'
        }, {
          id: 'asc'
        }],
        skip,
        take: 20
      }), prisma.generator.count({
        where
      })]);
    } else {
      const where = {
        cooperativeId,
        OR: [{
          name
        }, {
          binId: name
        }, {
          street: name
        }, {
          neighborhood: name
        }]
      };
      [items, total] = await prisma.$transaction([prisma.bin.findMany({
        where,
        select: bin,
        orderBy: [{
          name: 'asc'
        }, {
          id: 'asc'
        }],
        skip,
        take: 20
      }), prisma.bin.count({
        where
      })]);
    }
    return {
      items,
      pagination: {
        page: q.page,
        total,
        totalPages: Math.max(1, Math.ceil(total / 20))
      }
    };
  }));
  app.get('/cooperative-field/:kind/:id', guard(async (r: any, p: any, cooperativeId: string) => {
    const kind = kinds.parse(r.params.kind),
      q = query.parse(r.query);
    const item = await entity(cooperativeId, kind, r.params.id);
    if (!item) return p.code(404).send({
      error: 'Cadastro não encontrado.'
    });
    const where = collectionWhere(cooperativeId, kind, item.id);
    let status: Prisma.CollectionWhereInput = {};
    if (q.filter === 'active') status = {
      status: 'IN_PROGRESS'
    };
    if (q.filter === 'pending') status = {
      OR: [{
        status: 'PENDING'
      }, {
        incidents: {
          some: {
            status: 'OPEN'
          }
        }
      }]
    };
    if (q.filter === 'completed') status = {
      status: {
        in: ['COLLECTED', 'RECEIVED', 'SORTING', 'COMPLETED']
      }
    };
    const filtered = {
      AND: [where, status]
    };
    const [collections, total, pending, active, requests, incidents] = await prisma.$transaction([prisma.collection.findMany({
      where: filtered,
      select: work,
      orderBy: [{
        createdAt: 'desc'
      }, {
        id: 'desc'
      }],
      take: 20,
      skip: (q.page - 1) * 20
    }), prisma.collection.count({
      where: filtered
    }), prisma.collection.count({
      where: {
        AND: [where, {
          status: 'PENDING'
        }]
      }
    }), prisma.collection.count({
      where: {
        AND: [where, {
          status: 'IN_PROGRESS'
        }]
      }
    }), kind === 'generators' ? prisma.schedule.findMany({
      where: {
        cooperativeId,
        generatorId: item.id
      },
      select: {
        id: true,
        status: true,
        scheduledDate: true,
        preferredDate: true,
        createdAt: true,
        notes: true
      },
      orderBy: [{
        createdAt: 'desc'
      }, {
        id: 'desc'
      }],
      take: 20
    }) : prisma.schedule.findMany({
      where: {
        id: '__none__',
        cooperativeId
      },
      select: {
        id: true,
        status: true,
        scheduledDate: true,
        preferredDate: true,
        createdAt: true,
        notes: true
      }
    }), prisma.collectionIncident.count({
      where: {
        cooperativeId,
        status: 'OPEN',
        collection: where
      }
    })]);
    return {
      item,
      collections,
      requests,
      summary: {
        pending,
        active,
        incidents
      },
      pagination: {
        page: q.page,
        total,
        totalPages: Math.max(1, Math.ceil(total / 20))
      }
    };
  }));
}
