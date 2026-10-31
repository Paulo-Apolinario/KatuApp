import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
export async function checkCooperativeField(app: FastifyInstance, p: PrismaClient, users: any, coop: any, pass: (s: string) => void) {
  const call = async (who: string, method: any, url: string, payload?: any, status = 200) => {
    const r = await app.inject({
      method,
      url,
      payload,
      headers: {
        authorization: 'Bearer ' + app.jwt.sign({
          sub: users[who].id,
          role: users[who].role
        })
      }
    });
    assert.equal(r.statusCode, status, r.body);
    return r.json();
  };
  const driver = await p.driver.findFirstOrThrow({
      where: {
        userId: users.driver.id
      }
    }),
    cat = await p.collector.findFirstOrThrow({
      where: {
        userId: users.cat.id
      }
    }),
    member = await p.collector.findFirstOrThrow({
      where: {
        userId: users.member.id
      }
    }),
    vehicle = await p.vehicle.findFirstOrThrow({
      where: {
        cooperativeId: coop.id
      }
    });
  await p.driver.update({
    where: {
      id: driver.id
    },
    data: {
      status: 'AVAILABLE'
    }
  });
  const route = await p.route.create({
    data: {
      cooperativeId: coop.id,
      driverId: driver.id,
      vehicleId: vehicle.id,
      name: 'Rota gestor em campo QA',
      scheduledDate: new Date('2026-10-31T11:00:00Z'),
      status: 'IN_PROGRESS',
      stops: []
    }
  });
  const gen = await p.generator.create({
    data: {
      cooperativeId: coop.id,
      type: 'SMALL',
      name: 'Gerador campo QA',
      email: 'campo-qa@test.invalid',
      documentNumber: '52998224725',
      street: 'Rua QA',
      number: '123',
      city: 'Fortaleza',
      state: 'CE',
      latitude: -3.73,
      longitude: -38.52
    }
  });
  const bin = await p.bin.create({
    data: {
      cooperativeId: coop.id,
      binId: 'PEV-FIELD-QA',
      name: 'PEV campo QA',
      street: 'Rua do PEV',
      number: '40',
      city: 'Fortaleza',
      state: 'CE',
      latitude: -3.74,
      longitude: -38.53,
      needsPickup: true
    }
  });
  const schedule = await p.schedule.create({
    data: {
      cooperativeId: coop.id,
      generatorId: gen.id,
      requestedByUserId: users.owner.id,
      status: 'REQUESTED',
      preferredDate: new Date('2026-10-31T11:00:00Z')
    }
  });
  const collection = await p.collection.create({
    data: {
      cooperativeId: coop.id,
      generatorId: gen.id,
      collectorId: cat.id,
      driverId: driver.id,
      vehicleId: vehicle.id,
      routeId: route.id,
      scheduleId: schedule.id,
      status: 'IN_PROGRESS',
      startedAt: new Date(),
      participants: {
        create: [{
          collectorId: cat.id,
          nameSnapshot: cat.name
        }, {
          collectorId: member.id,
          nameSnapshot: member.name
        }]
      },
      collectionMaterials: {
        create: {
          nameSnapshot: 'Óleo campo QA',
          quantity: 50,
          unit: 'LITER'
        }
      }
    }
  });
  await p.collectionIncident.create({
    data: {
      collectionId: collection.id,
      cooperativeId: coop.id,
      reportedByUserId: users.cat.id,
      description: 'Portão fechado no atendimento QA'
    }
  });
  for (const k of ['collectors', 'drivers', 'generators', 'pevs']) {
    const list = await call('owner', 'GET', '/cooperative-field/' + k);
    assert(Array.isArray(list.items));
    assert(!JSON.stringify(list).includes('passwordHash'));
  }
  const detail = await call('owner', 'GET', `/cooperative-field/generators/${gen.id}`);
  assert.equal(detail.requests[0].id, schedule.id);
  assert.equal(detail.summary.active, 1);
  assert.equal(detail.summary.incidents, 1);
  assert.equal(Number(detail.collections[0].collectionMaterials[0].quantity), 50);
  pass('Diretórios e detalhe do gerador trazem coletas, solicitações, pendências e quantidades em litros');
  assert((await call('owner', 'GET', `/cooperative-field/collectors/${member.id}`)).collections.some((c: any) => c.id === collection.id));
  assert((await call('owner', 'GET', `/cooperative-field/drivers/${driver.id}?filter=active`)).collections.some((c: any) => c.id === collection.id));
  const pevs = await call('owner', 'GET', '/cooperative-field/pevs?q=PEV-FIELD-QA');
  assert.equal(pevs.items.length, 1);
  assert.equal(pevs.items[0].latitude, -3.74);
  pass('Trabalhos reconhecem colaboradores; PEVs são buscados por código e fornecem coordenadas confirmadas');
  for (const [kind, id] of [['drivers', driver.id], ['collectors', cat.id], ['generators', gen.id], ['pevs', bin.id]]) await call('foreign', 'GET', `/cooperative-field/${kind}/${id}`, undefined, 404);
  await call('cat', 'GET', '/cooperative-field/drivers', undefined, 403);
  await call('owner', 'GET', '/cooperative-field/drivers?page=0', undefined, 400);
  pass('Dados de campo respeitam cooperativa, perfil e paginação');
  const start = await call('driver', 'POST', '/driver-tracking/start', {
    routeId: route.id,
    mode: 'BACKGROUND'
  }, 201);
  assert.match(start.sessionId, /^[a-f0-9-]{36}$/);
  assert.equal((await call('owner', 'GET', `/driver-tracking/drivers/${driver.id}`)).state, 'WAITING');
  await call('owner', 'POST', '/driver-tracking/start', {
    routeId: route.id,
    mode: 'BACKGROUND'
  }, 403);
  await call('driver', 'POST', '/driver-tracking/start', {
    routeId: 'foreign-route',
    mode: 'FOREGROUND'
  }, 404);
  await call('driver', 'POST', '/driver-tracking/start', {
    routeId: route.id,
    collectionId: collection.id,
    mode: 'FOREGROUND'
  }, 400);
  await call('driver','POST','/driver-tracking/start',{collectionId:collection.id,mode:'FOREGROUND'},404);
  pass('Compartilhamento depende de motorista ativo, serviço próprio e contexto único; gestor não inicia GPS alheio');
  const point = {
    sessionId: start.sessionId,
    latitude: -3.7301,
    longitude: -38.5201,
    accuracy: 12,
    capturedAt: new Date().toISOString()
  };
  await call('driver', 'PUT', '/driver-tracking/position', point);
  const live = await call('owner', 'GET', `/driver-tracking/drivers/${driver.id}`);
  assert.equal(live.state, 'LIVE');
  assert.equal(live.position.latitude, point.latitude);
  assert.equal(live.position.accuracy, 12);
  await call('foreign', 'GET', `/driver-tracking/drivers/${driver.id}`, undefined, 404);
  await call('cat', 'GET', `/driver-tracking/drivers/${driver.id}`, undefined, 403);
  pass('Gestor recebe posição real, horário e precisão; outras cooperativas e perfis não acessam a localização');
  await call('driver', 'PUT', '/driver-tracking/position', {
    ...point,
    latitude: 91
  }, 400);
  await call('driver', 'PUT', '/driver-tracking/position', {
    ...point,
    capturedAt: new Date(Date.now() - 180000).toISOString()
  }, 400);
  await call('driver', 'PUT', '/driver-tracking/position', {
    ...point,
    capturedAt: new Date(Date.now() + 60000).toISOString()
  }, 400);
  const stale = await call('driver', 'PUT', '/driver-tracking/position', {
    ...point,
    capturedAt: new Date(Date.now() - 10000).toISOString()
  });
  assert.equal(stale.accepted, false);
  assert.equal((await call('owner', 'GET', `/driver-tracking/drivers/${driver.id}`)).position.latitude, point.latitude);
  pass('Coordenadas inválidas, pontos antigos/futuros e reenvios fora de ordem não deslocam o motorista');
  await p.driverLiveLocation.update({
    where: {
      driverId: driver.id
    },
    data: {
      capturedAt: new Date(Date.now() - 60000)
    }
  });
  assert.equal((await call('owner', 'GET', `/driver-tracking/drivers/${driver.id}`)).state, 'STALE');
  await p.driverLiveLocation.update({
    where: {
      driverId: driver.id
    },
    data: {
      capturedAt: new Date(Date.now() - 180000)
    }
  });
  assert.equal((await call('owner', 'GET', `/driver-tracking/drivers/${driver.id}`)).state, 'OFFLINE');
  const next = await call('driver', 'POST', '/driver-tracking/start', {
    routeId: route.id,
    mode: 'FOREGROUND'
  }, 201);
  await call('driver', 'PUT', '/driver-tracking/position', {
    ...point,
    capturedAt: new Date().toISOString()
  }, 409);
  await call('driver', 'POST', '/driver-tracking/stop', {
    sessionId: next.sessionId
  });
  const stopped = await call('owner', 'GET', `/driver-tracking/drivers/${driver.id}`);
  assert.equal(stopped.state, 'STOPPED');
  assert.equal(stopped.position, null);
  pass('Sinal atrasado fica desatualizado, nova sessão invalida aparelho anterior e encerramento remove coordenadas');
  const final = await call('driver', 'POST', '/driver-tracking/start', {
    routeId: route.id,
    mode: 'BACKGROUND'
  }, 201);
  await p.route.update({
    where: {
      id: route.id
    },
    data: {
      status: 'COMPLETED'
    }
  });
  await call('driver', 'PUT', '/driver-tracking/position', {
    ...point,
    sessionId: final.sessionId,
    capturedAt: new Date().toISOString()
  }, 409);
  assert.equal((await call('owner', 'GET', `/driver-tracking/drivers/${driver.id}`)).position, null);
  pass('Finalizar ou cancelar o serviço impede novas posições e oculta localização do gestor');
  const individual = await p.collection.create({
    data: {
      cooperativeId: coop.id,
      driverId: driver.id,
      collectorId: cat.id,
      status: 'PENDING'
    }
  });
  const share = await call('driver', 'POST', '/driver-tracking/start', {
    collectionId: individual.id,
    mode: 'FOREGROUND'
  }, 201);
  await call('driver', 'PUT', '/driver-tracking/position', {
    ...point,
    sessionId: share.sessionId,
    capturedAt: new Date().toISOString()
  });
  assert.equal((await call('owner', 'GET', `/driver-tracking/drivers/${driver.id}`)).state, 'LIVE');
  const reports = await call('owner', 'GET', '/reports/overview?start=2026-10-01&end=2026-10-31');
  assert(reports.data.summary);
  assert(reports.data.rows);
  await call('driver', 'GET', '/reports/overview?start=2026-10-01&end=2026-10-31', undefined, 403);
  pass('Coleta individual também compartilha posição e relatórios reutilizam cálculos e permissões do painel');
  for (let i = 0; i < 22; i++) await p.generator.create({
    data: {
      cooperativeId: coop.id,
      type: 'SMALL',
      name: 'Paginação campo ' + String(i).padStart(2, '0'),
      email: `field-page-${i}@test.invalid`
    }
  });
  const a = await call('owner', 'GET', '/cooperative-field/generators?q=Paginação campo&page=1'),
    b = await call('owner', 'GET', '/cooperative-field/generators?q=Paginação campo&page=2');
  assert.equal(a.items.length, 20);
  assert.equal(b.items.length, 2);
  assert(!a.items.some((x: any) => b.items.some((y: any) => y.id === x.id)));
  pass('Paginação e busca de geradores atravessam páginas sem perda ou duplicação');
  const originalFetch=globalThis.fetch;let addressSent='';try{
    globalThis.fetch=(async(input:any)=>{addressSent=String(input);return new Response(JSON.stringify([{lat:'-3.732',lon:'-38.521',display_name:'Rua endereço QA, 123'}]),{status:200});}) as any;
    const location=await call('owner','POST','/cooperative-field/geocode',{address:'Rua endereço QA, 123, Fortaleza, CE'});assert.equal(location.latitude,-3.732);assert(new URL(addressSent).searchParams.get('q')!.includes('123'));
    globalThis.fetch=(async()=>new Response('[]',{status:429})) as any;await call('owner','POST','/cooperative-field/geocode',{address:'Rua endereço QA, 123, Fortaleza, CE'},503);
    globalThis.fetch=(async()=>new Response(JSON.stringify([{lat:'91',lon:'-38.521'}]),{status:200})) as any;await call('owner','POST','/cooperative-field/geocode',{address:'Rua endereço QA, 123, Fortaleza, CE'},422);
    await call('driver','POST','/cooperative-field/geocode',{address:'Rua endereço QA, 123, Fortaleza, CE'},403);
  }finally{globalThis.fetch=originalFetch;}
  pass('Busca de endereço inclui número e cidade; falha externa orienta marcação manual e coordenadas impossíveis são rejeitadas');
  return {
    driver: driver.id,
    collector: cat.id,
    generator: gen.id,
    pev: bin.id,
    route: route.id,
    collection: collection.id,
    individual: individual.id,
    sessionId: share.sessionId,
    driverToken: app.jwt.sign({
      sub: users.driver.id,
      role: 'DRIVER'
    }),
    driverUser: users.driver
  };
}
