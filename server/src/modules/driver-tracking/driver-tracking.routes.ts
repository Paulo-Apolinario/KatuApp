import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { wasteCooperativeScope } from '../waste-workspace/waste-workspace.routes';
const session = z.object({
  sessionId: z.string().uuid()
}).strict();
const start = z.object({
  routeId: z.string().min(1).max(100).optional(),
  collectionId: z.string().min(1).max(100).optional(),
  mode: z.enum(['FOREGROUND', 'BACKGROUND'])
}).strict().refine(v => !!v.routeId !== !!v.collectionId, 'Selecione uma rota ou coleta.');
const position = session.extend({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracy: z.number().finite().min(0).max(100000).nullable(),
  capturedAt: z.string().datetime({
    offset: true
  })
}).strict();
function fail(message: string, statusCode = 403): never {
  throw Object.assign(Error(message), {
    statusCode
  });
}
async function driver(userId: string) {
  const u = await prisma.user.findUnique({
    where: {
      id: userId
    },
    select: {
      role: true,
      isActive: true,
      accountStatus: true,
      driver: {
        select: {
          id: true,
          status: true,
          cooperativeId: true,
          cooperative: {
            select: {
              user: {
                select: {
                  isActive: true,
                  accountStatus: true
                }
              }
            }
          }
        }
      }
    }
  });
  if (!u?.isActive || u.accountStatus !== 'ACTIVE' || u.role !== 'DRIVER' || !u.driver || u.driver.status === 'INACTIVE' || !u.driver.cooperative.user.isActive || u.driver.cooperative.user.accountStatus !== 'ACTIVE') fail('Acesso restrito ao motorista ativo.');
  return u.driver;
}
async function context(d: any, v: any, db: any = prisma) {
  return v.routeId ? db.route.findFirst({
    where: {
      id: v.routeId,
      cooperativeId: d.cooperativeId,
      driverId: d.id,
      status: {
        in: ['SCHEDULED', 'IN_PROGRESS']
      }
    }
  }) : db.collection.findFirst({
    where: {
      id: v.collectionId,
      routeId:null,
      cooperativeId: d.cooperativeId,
      driverId: d.id,
      status: {
        in: ['PENDING', 'IN_PROGRESS']
      }
    }
  });
}
export async function driverTrackingRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);
  const guard = (fn: Function) => async (r: any, p: any) => {
    try {
      p.header('Cache-Control', 'private, no-store');
      return await fn(r, p);
    } catch (e: any) {
      return p.code(e instanceof z.ZodError ? 400 : e.statusCode || 500).send({
        error: e instanceof z.ZodError ? e.issues.map(i => i.message).join(' ') : e.statusCode ? e.message : 'Não foi possível consultar o compartilhamento de localização.'
      });
    }
  };
  app.get('/driver-tracking/context', guard(async (r: any) => {
    const d = await driver(r.user.sub);
    const [routes, collections, current] = await Promise.all([prisma.route.findMany({
      where: {
        cooperativeId: d.cooperativeId,
        driverId: d.id,
        status: {
          in: ['SCHEDULED', 'IN_PROGRESS']
        }
      },
      select: {
        id: true,
        name: true,
        status: true,
        scheduledDate: true
      },
      orderBy: {
        scheduledDate: 'asc'
      }
    }), prisma.collection.findMany({
      where: {
        cooperativeId: d.cooperativeId,
        driverId: d.id,
        routeId: null,
        status: {
          in: ['PENDING', 'IN_PROGRESS']
        }
      },
      select: {
        id: true,
        status: true,
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
      },
      orderBy: {
        createdAt: 'desc'
      }
    }), prisma.driverLiveLocation.findUnique({
      where: {
        driverId: d.id
      },
      select: {
        sessionId: true,
        active: true,
        routeId: true,
        collectionId: true,
        mode: true
      }
    })]);
    return {
      routes,
      collections,
      current
    };
  }));
  app.post('/driver-tracking/start', guard(async (r: any, p: any) => {
    const d = await driver(r.user.sub),
      v = start.parse(r.body);
    if (!(await context(d, v))) fail('Serviço não disponível para este motorista.', 404);
    const row = await prisma.driverLiveLocation.upsert({
      where: {
        driverId: d.id
      },
      create: {
        driverId: d.id,
        cooperativeId: d.cooperativeId,
        sessionId: randomUUID(),
        routeId: v.routeId,
        collectionId: v.collectionId,
        mode: v.mode
      },
      update: {
        cooperativeId: d.cooperativeId,
        sessionId: randomUUID(),
        routeId: v.routeId || null,
        collectionId: v.collectionId || null,
        mode: v.mode,
        active: true,
        latitude: null,
        longitude: null,
        accuracy: null,
        capturedAt: null,
        receivedAt: null,
        endedAt: null,
        startedAt: new Date()
      }
    });
    return p.code(201).send({
      sessionId: row.sessionId
    });
  }));
  app.put('/driver-tracking/position', guard(async (r: any) => {
    const d = await driver(r.user.sub),
      v = position.parse(r.body),
      time = new Date(v.capturedAt);
    if (time.getTime() > Date.now() + 30000 || time.getTime() < Date.now() - 120000) fail('Posição antiga ou horário inválido. Aguarde um novo sinal GPS.', 400);
    return prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "driverId" FROM "DriverLiveLocation" WHERE "driverId"=${d.id} FOR UPDATE`;
      const current = await tx.driverLiveLocation.findUnique({
        where: {
          driverId: d.id
        }
      });
      if (!current?.active || current.sessionId !== v.sessionId || current.cooperativeId !== d.cooperativeId || !(await context(d, current, tx))) fail('Compartilhamento encerrado ou serviço finalizado.', 409);
      if (current.capturedAt && time <= current.capturedAt) return {
        accepted: false
      };
      await tx.driverLiveLocation.update({
        where: {
          driverId: d.id
        },
        data: {
          latitude: v.latitude,
          longitude: v.longitude,
          accuracy: v.accuracy,
          capturedAt: time,
          receivedAt: new Date()
        }
      });
      return {
        accepted: true
      };
    });
  }));
  app.post('/driver-tracking/stop', guard(async (r: any) => {
    const d = await driver(r.user.sub),
      v = session.parse(r.body);
    await prisma.driverLiveLocation.updateMany({
      where: {
        driverId: d.id,
        cooperativeId: d.cooperativeId,
        sessionId: v.sessionId
      },
      data: {
        active: false,
        endedAt: new Date(),
        latitude: null,
        longitude: null,
        accuracy: null
      }
    });
    return {
      success: true
    };
  }));
  app.get('/driver-tracking/drivers/:id', guard(async (r: any, p: any) => {
    const cooperativeId = await wasteCooperativeScope(r.user.sub);
    const d = await prisma.driver.findFirst({
      where: {
        id: r.params.id,
        cooperativeId
      },
      select: {
        id: true,
        name: true,
        status: true,
        user: {
          select: {
            isActive: true,
            accountStatus: true
          }
        },
        liveLocation: true
      }
    });
    if (!d) return p.code(404).send({
      error: 'Motorista não encontrado.'
    });
    const l = d.liveLocation;
    const allowed = l?.active && l.cooperativeId === cooperativeId && d.status !== 'INACTIVE' && d.user?.isActive && d.user.accountStatus === 'ACTIVE' && (await context({
      id: d.id,
      cooperativeId
    }, l));
    if (!allowed || !l) return {
      state: 'STOPPED',
      driver: {
        id: d.id,
        name: d.name
      },
      position: null
    };
    const age = l.capturedAt ? Date.now() - l.capturedAt.getTime() : Infinity;
    return {
      state: l.latitude === null ? 'WAITING' : age <= 45000 ? 'LIVE' : age <= 120000 ? 'STALE' : 'OFFLINE',
      position: l.latitude === null ? null : {
        latitude: l.latitude,
        longitude: l.longitude,
        accuracy: l.accuracy,
        capturedAt: l.capturedAt,
        receivedAt: l.receivedAt
      },
      driver: {
        id: d.id,
        name: d.name
      },
      serviceLabel: allowed.name || 'Coleta #' + String(l.collectionId).slice(-8).toUpperCase(),
      mode: l.mode,
      routeId: l.routeId,
      collectionId: l.collectionId
    };
  }));
}
