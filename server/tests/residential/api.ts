import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
export async function checkResidential(app: FastifyInstance, p: PrismaClient, coop: { id: string }, cat: { id: string }, driver: { id: string }, vehicle: { id: string }, pass: (s: string) => void) {
  const user = await p.user.create({data:{email:"residential@test.invalid",displayName:"Moradora QA",role:"PF",passwordHash:"unused",phone:"85999999999",personProfile:{create:{cpf:"12345678901",address:"Rua antiga, Fortaleza"}}}});
  const other = await p.user.create({data:{email:"other-residential@test.invalid",displayName:"Outra moradora",role:"PF",passwordHash:"unused",personProfile:{create:{cpf:"98765432109"}}}});
  const token=app.jwt.sign({sub:user.id,role:"PF"}), otherToken=app.jwt.sign({sub:other.id,role:"PF"});
  async function call(method: "GET" | "POST" | "PATCH", url: string, payload?: unknown, status=200, auth=token) {
    const response=await app.inject({method,url,payload:payload as object,headers:{authorization:`Bearer ${auth}`}});assert.equal(response.statusCode,status,response.body);return response.json();
  }
  const previous=await p.personProfile.findUniqueOrThrow({where:{id:"residential-profile-before-migration"}});assert.deepEqual(previous.savedAddresses,[]);assert.equal(previous.address,"Endereço preservado");
  pass("Migração residencial mantém CPF, endereço e perfil PF existentes; endereços salvos iniciam vazios");
  const address={id:randomUUID(),label:"Casa",address:"Rua da residência, 100, Fortaleza",latitude:-3.73,longitude:-38.52};
  await call("PATCH","/residential/profile",{displayName:"Moradora atualizada",phone:"(85) 99999-9999",address:address.address,savedAddresses:[address]});
  const updated=await p.user.findUniqueOrThrow({where:{id:user.id},include:{personProfile:true}});assert.equal(updated.phone,"85999999999");assert.equal(updated.personProfile?.cpf,"12345678901");assert.deepEqual(updated.personProfile?.savedAddresses,[address]);
  pass("Cadastro permite nome, telefone e endereços próprios sem alterar CPF ou e-mail");
  await call("PATCH","/residential/profile",{displayName:"Moradora",phone:"123",address:"Rua QA",savedAddresses:[]},400);
  await call("PATCH","/residential/profile",{displayName:"Moradora",phone:"85999999999",address:"Rua QA",savedAddresses:[{...address,latitude:95}]},400);
  await call("PATCH","/residential/profile",{displayName:"Moradora",phone:"85999999999",address:"Rua QA",savedAddresses:[address],cpf:"changed"},400);
  await call("GET","/residential/overview",undefined,403,app.jwt.sign({sub:(await p.collector.findUniqueOrThrow({where:{id:cat.id}})).userId!,role:"COLLECTOR"}));
  pass("Perfil residencial rejeita telefone, coordenadas e campos indevidos; outros perfis são bloqueados");
  const material=await p.wasteStockItem.findFirstOrThrow({where:{cooperativeId:coop.id}});
  const body={operationId:randomUUID(),cooperativeId:coop.id,pickupAddress:address.address,pickupLatitude:-3.73,pickupLongitude:-38.52,preferredDate:new Date(Date.now()+86400000*2).toISOString(),requestedMaterials:[{wasteTypeId:material.id,unit:"KG",estimatedQuantity:1000}],notes:"Referência QA"};
  const first=(await call("POST","/schedules",body,201)).schedule;
  const repeated=(await call("POST","/schedules",body,201)).schedule;assert.equal(first.id,repeated.id);assert.equal(await p.schedule.count({where:{requestOperationId:body.operationId}}),1);
  pass("Reenvio após perda de resposta devolve o mesmo pedido sem duplicar solicitação ou material");
  await call("POST","/schedules",{...body,notes:"Alterado"},400);await call("POST","/schedules",body,400,otherToken);
  pass("Identificador não pode ser reutilizado com outro conteúdo ou por outro titular");
  await call("POST","/schedules",{...body,operationId:randomUUID(),scheduledDate:body.preferredDate},400);
  await call("POST","/schedules",{...body,operationId:randomUUID(),preferredDate:"2020-01-01T12:00:00Z"},400);
  pass("Morador não confirma agendamento por conta própria nem envia preferência no passado");
  const ack=await call("GET",`/residential/submissions/${body.operationId}`);assert.equal(ack.schedule.id,first.id);assert.equal((await call("GET",`/residential/submissions/${body.operationId}`,undefined,200,otherToken)).schedule,null);
  await call("GET",`/residential/requests/${first.id}`,undefined,404,otherToken);
  await call("POST",`/residential/requests/${first.id}/cancel`,{},404,otherToken);
  pass("Detalhes, confirmação de envio e cancelamento respeitam o titular do pedido");
  await call("POST",`/residential/requests/${first.id}/cancel`,{});await call("POST",`/residential/requests/${first.id}/cancel`,{});
  assert.equal((await p.schedule.findUniqueOrThrow({where:{id:first.id}})).status,"CANCELLED");
  pass("Cancelamento pendente é idempotente e mantém o histórico");
  const scheduled=await p.schedule.create({data:{cooperativeId:coop.id,requestedByUserId:user.id,status:"SCHEDULED",scheduledDate:body.preferredDate,preferredDate:body.preferredDate,pickupAddress:address.address}});
  await call("POST",`/residential/requests/${scheduled.id}/cancel`,{},409);
  const delegated=await p.schedule.create({data:{cooperativeId:coop.id,requestedByUserId:user.id,status:"REQUESTED",preferredDate:body.preferredDate,pickupAddress:address.address}});
  await p.collection.create({data:{cooperativeId:coop.id,scheduleId:delegated.id,collectorId:cat.id,driverId:driver.id,vehicleId:vehicle.id,status:"PENDING"}});
  await call("POST",`/residential/requests/${delegated.id}/cancel`,{},409);
  pass("Pedido programado ou já delegado não pode ser cancelado pelo morador");
  const receivedSchedule=await p.schedule.create({data:{cooperativeId:coop.id,requestedByUserId:user.id,status:"IN_PROGRESS",pickupAddress:address.address}});
  const received=await p.collection.create({data:{cooperativeId:coop.id,scheduleId:receivedSchedule.id,status:"RECEIVED",totalWeightKg:12.5,collectedAt:new Date(),receivedAt:new Date()}});
  const fieldSchedule=await p.schedule.create({data:{cooperativeId:coop.id,requestedByUserId:user.id,status:"IN_PROGRESS"}});
  await p.collection.create({data:{cooperativeId:coop.id,scheduleId:fieldSchedule.id,status:"COLLECTED",totalWeightKg:80,collectedAt:new Date()}});
  const overview=await call("GET","/residential/overview");assert.equal(overview.receivedKg,12.5);assert.equal(overview.receivedCollections,1);assert.equal(overview.months.at(-1).kg,12.5);
  assert.equal((await call("GET","/residential/overview",undefined,200,otherToken)).receivedKg,0);
  pass("Participação usa massa recebida e separa previsão, campo e resultados de outra conta");
  const detail=await call("GET",`/residential/requests/${receivedSchedule.id}`);assert.equal(detail.schedule.collections[0].id,received.id);assert.ok(detail.schedule.collections[0].receivedAt);
  pass("Acompanhamento conserva datas e etapas reais para compor a linha do tempo");
  const proposed={...body,operationId:randomUUID(),requestedMaterials:[{proposedMaterial:{name:"Embalagem especial QA",unit:"UNIT"},unit:"UNIT"}]};
  await call("POST","/schedules",proposed,201);await call("POST","/schedules",proposed,201);assert.equal(await p.wasteCatalogSuggestion.count({where:{suggestedByUserId:user.id,name:"Embalagem especial QA"}}),1);
  pass("Material proposto também é idempotente e não duplica sugestão no catálogo");
  const ownerUser=await p.cooperative.findUniqueOrThrow({where:{id:coop.id}});
  const coopToken=app.jwt.sign({sub:ownerUser.userId,role:"COOPERATIVE"});
  const race=await p.schedule.create({data:{cooperativeId:coop.id,requestedByUserId:user.id,status:"REQUESTED"}});
  const races=await Promise.all([
    app.inject({method:"POST",url:`/residential/requests/${race.id}/cancel`,headers:{authorization:`Bearer ${token}`},payload:{}}),
    app.inject({method:"PATCH",url:`/schedules/${race.id}/status`,headers:{authorization:`Bearer ${coopToken}`},payload:{status:"SCHEDULED"}}),
  ]);
  assert.equal(races.filter(r=>r.statusCode===200).length,1);assert.ok(races.some(r=>r.statusCode===409));
  pass("Cancelamento e confirmação concorrentes não reabrem pedido cancelado");
  const racing=await p.schedule.create({data:{cooperativeId:coop.id,requestedByUserId:user.id,status:"REQUESTED"}});
  const delegateRace=await Promise.all([
    app.inject({method:"POST",url:`/residential/requests/${racing.id}/cancel`,headers:{authorization:`Bearer ${token}`},payload:{}}),
    app.inject({method:"POST",url:"/collections",headers:{authorization:`Bearer ${coopToken}`},payload:{scheduleId:racing.id,collectorId:cat.id,driverId:driver.id,vehicleId:vehicle.id}}),
  ]);
  const afterRace=await p.schedule.findUniqueOrThrow({where:{id:racing.id},include:{collections:true}});
  assert.ok(!delegateRace.every(r=>r.statusCode<300));assert.equal(afterRace.collections.length,afterRace.status==="CANCELLED"?0:1);
  pass("Cancelamento concorrente com delegação preserva uma única decisão operacional");
  const now=new Date(),boundary=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1,1,30));
  const bs=await p.schedule.create({data:{cooperativeId:coop.id,requestedByUserId:user.id,status:"COMPLETED"}});
  await p.collection.create({data:{cooperativeId:coop.id,scheduleId:bs.id,status:"COMPLETED",totalWeightKg:2,collectedAt:boundary,receivedAt:boundary}});
  const fresh=await call("GET","/residential/overview");
  const monthKey=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Fortaleza",year:"numeric",month:"2-digit"}).format(boundary);
  assert.equal(fresh.months.find((m:any)=>m.month===monthKey).kg,2);assert.equal(fresh.receivedKg,14.5);
  pass("Participação mensal usa o dia local de Fortaleza na virada do mês UTC");
  await p.schedule.createMany({data:Array.from({length:28},(_,i)=>({cooperativeId:coop.id,requestedByUserId:user.id,status:"REQUESTED" as const,pickupAddress:`Rua do histórico ${i}, Fortaleza`,preferredDate:body.preferredDate}))});
  fs.writeFileSync(path.join(process.env.KATUA_VALIDATION_TOOLS||"/tmp","residential-fixture.json"),JSON.stringify({token,otherToken,user:{...updated,passwordHash:undefined},request:first.id,scheduled:scheduled.id,received:receivedSchedule.id,coop:coop.id,material:material.id}));
}
