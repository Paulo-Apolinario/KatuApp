import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
export async function checkHistory(app: FastifyInstance, p: PrismaClient, users: Record<string, { id: string; role: string }>, coop: { id: string }, cat: { id: string }, driver: { id: string }, pass: (s: string) => void) {
  async function get(path: string, key: string, status = 200) {
    const response = await app.inject({ method: "GET", url: path, headers: { authorization: `Bearer ${app.jwt.sign({ sub: users[key].id, role: users[key].role })}` } });
    assert.equal(response.statusCode, status, response.body); return response.json();
  }
  const stamp = new Date("2026-10-01T12:00:00Z");
  const records = await Promise.all(Array.from({length: 29}, (_, i) => p.collection.create({ data: { cooperativeId: coop.id, collectorId: cat.id, driverId: driver.id, status: "COMPLETED", createdAt: stamp, totalWeightKg: i + 1 } })));
  const until = encodeURIComponent(new Date().toISOString());
  const one = await get(`/collections?page=1&limit=25&until=${until}`, "cat");
  const two = await get(`/collections?page=2&limit=25&until=${until}`, "cat");
  assert.equal(one.collections.length,25); assert.equal(two.collections.length,4); assert.equal(one.pagination.total,29); assert.equal(two.pagination.hasMore,false);
  assert.equal(new Set([...one.collections,...two.collections].map(c=>c.id)).size,29);
  assert.ok(one.collections.every(c=>c.status==="COMPLETED" && c.myCollectorId===cat.id));
  pass("Comprovantes paginam 25 + 4 sem duplicar datas iguais e preservam crédito do catador");
  const own = await get(`/collections?page=1&limit=50&until=${until}`, "driver"); assert.equal(own.pagination.total,29);
  const foreign = await get(`/collections?page=1&limit=25&until=${until}`, "foreign"); assert.equal(foreign.pagination.total,0);
  pass("Histórico de coleta mantém escopo do motorista e isolamento entre cooperativas");
  const legacy = await get("/collections", "cat"); assert.ok(Array.isArray(legacy.collections)); assert.ok(legacy.collections.some(c=>c.status!=="COMPLETED")); assert.equal(legacy.pagination,undefined);
  pass("Clientes legados continuam recebendo a lista de operações com todas as etapas");
  for (const query of ["page=0", "page=1&limit=51", "page=1&until=inválido", "page=1.5", "page=abc"] ) await get(`/collections?${query}`,"cat",400);
  pass("Paginação inválida é rejeitada antes da consulta");
  const pf = await p.user.create({data:{email:"history-pf@test.invalid",role:"PF",displayName:"Histórico QA",passwordHash:"unused"}}); users.pf=pf;
  const otherPf = await p.user.create({data:{email:"history-other@test.invalid",role:"PF",displayName:"Histórico QA",passwordHash:"unused"}}); users.otherPf=otherPf;
  await p.schedule.createMany({data:Array.from({length:27},()=>({cooperativeId:coop.id,requestedByUserId:pf.id,createdAt:stamp}))});
  await p.schedule.create({data:{cooperativeId:coop.id,requestedByUserId:otherPf.id,createdAt:stamp}});
  const s1=await get(`/schedules?page=1&limit=25&until=${until}`,"pf"), s2=await get(`/schedules?page=2&limit=25&until=${until}`,"pf");
  assert.equal(s1.pagination.total,27);assert.equal(s2.schedules.length,2);assert.equal(new Set([...s1.schedules,...s2.schedules].map(s=>s.id)).size,27);assert.ok(s1.schedules.every(s=>s.requestedByUserId===pf.id));
  assert.equal((await get(`/schedules?page=1&limit=25&until=${until}`,"otherPf")).pagination.total,1);
  pass("Solicitações de PF têm paginação estável e cada conta vê somente seus registros");
  await p.driverReport.createMany({data:Array.from({length:26},()=>({driverId:driver.id,type:"GENERAL_NOTE",description:"QA",createdAt:stamp}))});
  const d1=await get(`/drivers/me/reports?page=1&limit=25&until=${until}`,"driver"),d2=await get(`/drivers/me/reports?page=2&limit=25&until=${until}`,"driver");
  assert.equal(d1.pagination.total,26);assert.equal(d2.reports.length,1);assert.equal(new Set([...d1.reports,...d2.reports].map(s=>s.id)).size,26);
  await get("/drivers/me/reports?page=1","cat",403);
  pass("Ocorrências do motorista paginam sem vazamento para outro perfil");
  const cutoff=encodeURIComponent("2026-09-30T00:00:00Z");assert.equal((await get(`/collections?page=1&until=${cutoff}`,"cat")).pagination.total,0);
  pass("Data de corte impede que novos registros desloquem as páginas do histórico");
  const vehicle = await p.vehicle.findFirstOrThrow({where:{cooperativeId:coop.id,driverId:driver.id}});
  const material = await p.wasteStockItem.findFirstOrThrow({where:{cooperativeId:coop.id}});
  const retryPoint = await p.collection.create({data:{cooperativeId:coop.id,collectorId:cat.id,driverId:driver.id,vehicleId:vehicle.id,status:"PENDING"}});
  async function post(action: string, body: unknown, key="cat") {
    const response = await app.inject({method:"POST",url:`/collections/${retryPoint.id}/${action}`,headers:{authorization:`Bearer ${app.jwt.sign({sub:users[key].id,role:users[key].role})}`},payload:body as object});
    assert.equal(response.statusCode,200,response.body);return response.json();
  }
  const start={operationId:randomUUID()};
  await post("start",start);await post("start",start);
  const complete={operationId:randomUUID(),materials:[{wasteTypeId:material.id,quantity:10,unit:"KG"}],totalWeightKg:10};
  await post("complete-field",complete);await post("complete-field",complete);
  assert.equal(await p.collectionWasteEntry.count({where:{collectionId:retryPoint.id}}),1);
  await post("receive",{},"owner");await post("complete-field",complete);
  assert.equal((await p.collection.findUniqueOrThrow({where:{id:retryPoint.id}})).status,"RECEIVED");
  assert.equal(await p.collectionWasteEntry.count({where:{collectionId:retryPoint.id}}),1);
  pass("API real aceita reenvios com a mesma operação sem duplicar material ou regredir recebimento");
  await p.collection.delete({where:{id:retryPoint.id}});
  await p.collection.deleteMany({where:{id:{in:records.map(r=>r.id)}}});
}
