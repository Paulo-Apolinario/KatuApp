import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
export async function checkCommunication(app: FastifyInstance, p: PrismaClient, users: any, coop: any, cat: any, driver: any, vehicle: any, pass: (s: string) => void) {
  async function call(who: any, method: any, url: string, payload?: any, expected = 200) {
    const r = await app.inject({ method, url, payload, headers: { authorization: `Bearer ${app.jwt.sign({ sub: who.id, role: who.role })}` } });
    assert.equal(r.statusCode, expected, r.body); return r.json();
  }
  await p.collector.update({ where: { id: cat.id }, data: { status: "AVAILABLE" } });
  await p.driver.update({ where: { id: driver.id }, data: { status: "AVAILABLE" } });
  const resident = await p.user.create({ data: { email: "communication@test.invalid", passwordHash: "unused", displayName: "Residência QA", role: "PF", personProfile: { create: { cpf: "22345678901" } } } });
  const item = await p.wasteStockItem.findFirstOrThrow({ where: { cooperativeId: coop.id } });
  const payload = { operationId: randomUUID(), cooperativeId: coop.id, pickupAddress: "Rua Comunicação, 100, Fortaleza", preferredDate: new Date(Date.now() + 86400000 * 2).toISOString(), requestedMaterials: [{ wasteTypeId: item.id, estimatedQuantity: 10, unit: item.unit }] };
  const { schedule } = await call(resident, "POST", "/schedules", payload, 201);
  await call(resident, "POST", "/schedules", payload, 201);
  assert.equal(await p.inboxNotification.count({ where: { userId: users.owner.id, eventKey: `schedule-request:${schedule.id}` } }), 1);
  pass("Solicitação gera um aviso à cooperativa, inclusive após reenvio da mesma operação");
  const { collection } = await call(users.owner, "POST", "/collections", { scheduleId: schedule.id, collectorId: cat.id, driverId: driver.id, vehicleId: vehicle.id }, 201);
  const assigned = await p.inboxNotification.findMany({ where: { collectionId: collection.id, kind: "COLLECTION_ASSIGNED" } });
  assert.deepEqual(new Set(assigned.map(n => n.userId)), new Set([resident.id, users.cat.id, users.driver.id]));
  pass("Delegação avisa somente o solicitante e a equipe atribuída");
  const start = { operationId: randomUUID() };
  await call(users.cat, "POST", `/collections/${collection.id}/start`, start);
  await call(users.cat, "POST", `/collections/${collection.id}/start`, start);
  assert.equal(await p.inboxNotification.count({ where: { userId: resident.id, eventKey: `started:${collection.id}` } }), 1);
  pass("Início individual notifica sem duplicar o aviso ao repetir a confirmação");
  const inbox = await call(users.owner, "GET", "/notifications?limit=1");
  assert.equal(inbox.userId, users.owner.id); assert.equal(inbox.notifications.length, 1); assert(inbox.nextCursor);
  const next = await call(users.owner, "GET", `/notifications?limit=1&cursor=${inbox.nextCursor}`);
  assert.notEqual(next.notifications[0].id, inbox.notifications[0].id);
  await call(users.foreign, "PATCH", `/notifications/${inbox.notifications[0].id}/read`, {}, 404);
  await call(users.foreign, "GET", `/notifications?cursor=${inbox.notifications[0].id}`, undefined, 400);
  await call(users.owner, "PATCH", `/notifications/${inbox.notifications[0].id}/read`, {});
  await call(users.owner, "PATCH", `/notifications/${inbox.notifications[0].id}/read`, {});
  assert((await p.inboxNotification.findUniqueOrThrow({ where: { id: inbox.notifications[0].id } })).readAt);
  pass("Central pagina avisos, marca leitura de forma idempotente e impede leitura entre contas");
  const orderId = randomUUID();
  const body = { id: orderId, cooperativeId: coop.id, payload: { mode: "REQUESTED", reason: "EXTRA_REQUEST", reasonNotes: "Solicitação extra de teste", originType: "PF", originName: "Morador QA", pickupAddress: "Rua Teste, 100", custody: "ORIGIN", custodyNotes: "Material permanece no endereço", materials: [{ wasteTypeId: item.id, unit: item.unit, quantity: 10 }], photos: [] } };
  await call(users.cat, "POST", "/extra-collection-orders", body, 201);
  await call(users.cat, "POST", "/extra-collection-orders", body, 201);
  assert.equal(await p.inboxNotification.count({ where: { userId: users.owner.id, eventKey: `extra-submitted:${orderId}` } }), 1);
  const decision = { operationId: randomUUID(), expectedRevision: 1, decision: "NEEDS_INFO", notes: "Informe o acesso ao endereço." };
  await call(users.owner, "POST", `/extra-collection-orders/${orderId}/review`, decision);
  await call(users.owner, "POST", `/extra-collection-orders/${orderId}/review`, decision);
  const notices = await p.inboxNotification.findMany({ where: { userId: users.cat.id, eventKey: `extra-review:${decision.operationId}` } });
  assert.equal(notices.length, 1); assert.equal((notices[0].data as any).extraOrderId, orderId);
  pass("O.C. e pedido de complementação geram avisos com protocolo e sem duplicação após reenvio");
  const rejected = { ...decision, operationId: randomUUID(), decision: "REJECT", custody: "ORIGIN", custodyNotes: "Permanece no endereço de origem" };
  await call(users.owner, "POST", `/extra-collection-orders/${orderId}/review`, rejected);
  assert.equal(await p.inboxNotification.count({ where: { userId: users.cat.id, eventKey: `extra-review:${rejected.operationId}`, title: "O.C. recusada pela cooperativa" } }), 1);
  const acceptedId = randomUUID();
  await call(users.cat, "POST", "/extra-collection-orders", { ...body, id: acceptedId }, 201);
  const accepted = { ...decision, operationId: randomUUID(), decision: "ACCEPT" };
  await call(users.owner, "POST", `/extra-collection-orders/${acceptedId}/review`, accepted);
  await call(users.owner, "POST", `/extra-collection-orders/${acceptedId}/review`, accepted);
  assert.equal(await p.inboxNotification.count({ where: { userId: users.cat.id, eventKey: `extra-review:${accepted.operationId}`, title: "O.C. aceita pela cooperativa" } }), 1);
  pass("Aceite e recusa de O.C. notificam o catador com decisão persistida e repetição segura");
  await p.collector.update({ where: { id: cat.id }, data: { status: "AVAILABLE" } });
  const rollbackSchedule = await p.schedule.create({ data: { cooperativeId: coop.id, requestedByUserId: resident.id, status: "REQUESTED" } });
  await p.$executeRawUnsafe(`CREATE FUNCTION communication_fail_notice() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind='COLLECTION_ASSIGNED' THEN RAISE EXCEPTION 'Falha de aviso QA'; END IF; RETURN NEW; END $$`);
  await p.$executeRawUnsafe(`CREATE TRIGGER communication_fail_notice BEFORE INSERT ON "InboxNotification" FOR EACH ROW EXECUTE FUNCTION communication_fail_notice()`);
  try {
    await call(users.owner, "POST", "/collections", { scheduleId: rollbackSchedule.id, collectorId: cat.id }, 400);
    assert.equal(await p.collection.count({ where: { scheduleId: rollbackSchedule.id } }), 0);
    assert.equal((await p.schedule.findUniqueOrThrow({ where: { id: rollbackSchedule.id } })).status, "REQUESTED");
  } finally { await p.$executeRawUnsafe(`DROP TRIGGER communication_fail_notice ON "InboxNotification"`); await p.$executeRawUnsafe(`DROP FUNCTION communication_fail_notice()`); }
  pass("Falha ao registrar aviso provoca rollback da delegação, sem confirmação parcial");
  const routeIds: string[] = [];
  for (let i = 0; i < 24; i++) {
    const r = await p.route.create({ data: { name: `Resumo de rota ${i}`, cooperativeId: coop.id, collectorIds: [cat.id], driverId: driver.id, status: i < 22 ? "SCHEDULED" : "COMPLETED", scheduledDate: new Date(2026, 11, i + 1), stops: [] } });routeIds.push(r.id);
  }
  await p.route.create({ data: { cooperativeId: (await p.cooperative.findUniqueOrThrow({ where: { userId: users.foreign.id } })).id, collectorIds: [cat.id], name: "Nunca expor", stops: [] } });
  const first = await call(users.cat, "GET", "/routes/field-workspace?limit=5&page=1");
  const second = await call(users.cat, "GET", "/routes/field-workspace?limit=5&page=2");
  assert.equal(first.routes.length, 5);assert(first.pagination.hasMore);
  assert(first.routes.every((r: any) => !('collections' in r) && ['SCHEDULED', 'IN_PROGRESS'].includes(r.status)));
  assert(!first.routes.some((r: any) => second.routes.some((s: any) => s.id === r.id)));
  const history = await call(users.cat, "GET", "/routes/field-workspace?view=history&limit=50");
  assert(history.routes.some((r: any) => routeIds.includes(r.id)));assert(history.routes.every((r: any) => ["COMPLETED", "CANCELLED"].includes(r.status)));
  pass("Rotas ativas e histórico têm paginação independente e resumos sem transferir pontos");
  const foreign = await call(users.driver, "GET", "/routes/field-workspace?limit=50"); assert(!foreign.routes.some((r: any) => r.name === "Nunca expor"));
  await call(users.owner, "GET", "/routes/field-workspace", undefined, 403);
  await call(resident, "GET", "/routes/field-workspace", undefined, 403);
  await call(users.cat, "GET", "/routes/field-workspace?limit=1000", undefined, 400);
  const legacy = await call(users.owner, "GET", "/routes");assert(legacy.routes.length > 0);assert('stats' in legacy.routes[0]);
  const legacyField = await call(users.cat, 'GET', '/routes'); assert('collectionOrder' in legacyField.routes[0]);
  pass("Consultas novas respeitam perfil e cooperativa sem alterar o contrato legado de rotas");
}
