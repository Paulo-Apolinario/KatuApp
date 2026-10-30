import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";

export async function checkGeneratorDocument(app: FastifyInstance, p: PrismaClient, users: any, coop: any, pass: (name: string) => void) {
  async function call(who: any, method: any, url: string, payload?: any, expected = 200) {
    const r = await app.inject({ method, url, payload, headers: who ? { authorization: `Bearer ${app.jwt.sign({ sub: who.id, role: who.role })}` } : {} });
    assert.equal(r.statusCode, expected, r.body); return r.json();
  }
  const old = await p.generator.findUniqueOrThrow({ where: { id: "generator-before-document" } });
  assert.equal(old.documentNumber, null); assert.equal(old.name, "Gerador histórico preservado");assert.equal(old.type,"SMALL");assert.equal(old.totalKg,42);
  pass("Migração aditiva preserva dados, tipo e produção de gerador antigo sem inventar documento");
  let seq = 0;
  const body = (documentNumber?: string) => ({ type: "SMALL", name: "Gerador Documento QA", email: `doc-${++seq}@test.invalid`, latitude: -3.73, longitude: -38.52, ...(documentNumber !== undefined ? { documentNumber } : {}) });
  const cpf = "52998224725", cnpj = "11222333000181", alpha = "12ABC34501DE35";
  const residential = (await call(users.owner,"POST","/generators",{...body("529.982.247-25"),documentType:"CNPJ",registrationCategory:"SMALL_BUSINESS"},201)).generator;
  assert.equal(residential.documentNumber,cpf);assert.equal(residential.documentType,"CPF");assert.equal(residential.registrationCategory,"REGISTERED_RESIDENTIAL");assert.equal(residential.type,"SMALL");
  const business=(await call(users.owner,"POST","/generators",body("11.222.333/0001-81"),201)).generator;
  assert.equal(business.documentNumber,cnpj);assert.equal(business.documentType,"CNPJ");assert.equal(business.registrationCategory,"SMALL_BUSINESS");
  pass("CPF identifica residencial cadastrado e CNPJ identifica pequeno gerador dentro do mesmo tipo SMALL");
  const alphanumeric=(await call(users.owner,"POST","/generators",body("12.abc.345/01de-35"),201)).generator;
  assert.equal(alphanumeric.documentNumber,alpha);assert.equal(alphanumeric.documentType,"CNPJ");
  pass("CNPJ alfanumérico normaliza letras e valida os dígitos oficiais sem rejeitar o formato numérico");
  for(const documentNumber of ["", "11111111111","00000000000000","52998224726","11222333000182","12ABC34501DE34","5299822472","12.abc.345/01de-XX","52998224725!", "@52998224725", "529982247251111"])
    await call(users.owner,"POST","/generators",body(documentNumber),400);
  await call(users.owner,"PATCH",`/generators/${residential.id}`,{documentNumber:null},400);
  await call(users.owner,"PATCH",`/generators/${residential.id}`,{documentNumber:""},400);
  await call(users.owner,"PATCH",`/generators/${residential.id}`,{registrationCategory:"SMALL_BUSINESS"},400);
  pass("Servidor rejeita dígitos inválidos, repetição, caracteres indevidos, remoção e classificação forjada");
  const duplicate=await call(users.owner,"POST","/generators",body(cpf),409);assert.match(duplicate.error,/nesta cooperativa/);assert(!duplicate.error.includes(cpf));
  const other=(await call(users.foreign,"POST","/generators",body(cpf),201)).generator;assert.equal(other.documentNumber,cpf);
  const outsider=await call(users.foreign,"GET",`/generators/${residential.id}`,undefined,404);assert(!JSON.stringify(outsider).includes(cpf));
  await call(users.foreign,"PATCH",`/generators/${residential.id}`,{documentNumber:"12345678909"},404);
  await call(users.cat,"POST","/generators",body("12345678909"),403);
  pass("Documento é único por cooperativa e consultas/edições respeitam o proprietário e o perfil");
  const legacy=(await call(users.owner,"POST","/generators",body(),201)).generator;assert.equal(legacy.documentNumber,null);assert.equal(legacy.registrationCategory,"PENDING_DOCUMENT");
  const edited=(await call(users.owner,"PATCH",`/generators/${legacy.id}`,{phone:"85999999999"})).generator;assert.equal(edited.documentNumber,null);
  const completed=(await call(users.owner,"PATCH",`/generators/${legacy.id}`,{documentNumber:"123.456.789-09"})).generator;assert.equal(completed.registrationCategory,"REGISTERED_RESIDENTIAL");
  await call(users.owner,"PATCH",`/generators/${legacy.id}`,{phone:"85888888888"});assert.equal((await p.generator.findUniqueOrThrow({where:{id:legacy.id}})).documentNumber,"12345678909");
  pass("Cliente legado continua compatível e cadastro antigo pode receber documento sem perder dados anteriores");
  await call(users.owner,"PATCH",`/generators/${legacy.id}`,{type:"LARGE"},400);
  await call(users.owner,"POST","/generators",{...body("11144477735"),type:"LARGE"},400);
  const large=(await call(users.owner,"POST","/generators",{...body(),type:"LARGE"},201)).generator;assert.equal(large.registrationCategory,"LARGE");
  pass("Grande gerador mantém cadastro legado e não é confundido com residencial por CPF");
  const snapshot=await p.collection.create({data:{cooperativeId:coop.id,generatorId:residential.id,collectorId:(await p.collector.findUniqueOrThrow({where:{userId:users.cat.id}})).id,status:"COMPLETED",totalWeightKg:25}});
  await p.generator.update({where:{id:residential.id},data:{totalKg:25}});
  const replacement=(await call(users.owner,"PATCH",`/generators/${residential.id}`,{documentNumber:"04.252.011/0001-10"})).generator;
  assert.equal(replacement.registrationCategory,"SMALL_BUSINESS");assert.equal(replacement.totalKg,25);assert.deepEqual(await p.collection.findUniqueOrThrow({where:{id:snapshot.id}}),snapshot);
  const operational=await call(users.cat,"GET",`/collections/${snapshot.id}`);
  assert(!("documentNumber" in operational.collection.generator));
  pass("Correção de CPF para CNPJ reclassifica o mesmo cadastro sem alterar produção nem coletas históricas");
  const existingPF=await p.user.create({data:{email:"existing-pf-doc@test.invalid",displayName:"Residencial independente QA",passwordHash:"unused",role:"PF",personProfile:{create:{cpf:"12345678909"}}},include:{personProfile:true}});
  const pfBefore=await p.personProfile.findUniqueOrThrow({where:{userId:existingPF.id}});
  // Existing activation contract: both registered SMALL variants get GENERATOR_SMALL, never PF.
  const activated=[];
  for(const generator of [completed,business]) {
    const r=await call(null,"POST","/auth/activate-generator-access",{email:generator.email,password:"SenhaQA12345"},201);
    assert.equal(r.user.role,"GENERATOR_SMALL");assert(!r.user.personProfile);activated.push(r.user);
    const me=await call(r.user,"GET","/auth/me");assert.equal(me.user.role,"GENERATOR_SMALL");assert.equal(me.user.generator.id,generator.id);
  }
  assert.deepEqual(await p.personProfile.findUniqueOrThrow({where:{userId:existingPF.id}}),pfBefore);
  assert.equal((await p.user.findUniqueOrThrow({where:{id:existingPF.id}})).role,"PF");
  await call(activated[0],"GET","/residential/overview",undefined,403);
  await call(existingPF,"GET","/residential/overview");
  pass("Ativação mantém o mesmo perfil de gerador nos dois casos e preserva integralmente o residencial PF independente");
  const raceBodies=[body("45.723.174/0001-10"),body("45.723.174/0001-10")];
  // Known numeric test identifier; derive a fresh valid CNPJ instead of relying on external data.
  function dv(base:string,weights:number[]){const r=[...base].reduce((s,c,i)=>s+Number(c)*weights[i],0)%11;return String(r<2?0:11-r);}
  const base="987654320001",first=dv(base,[5,4,3,2,9,8,7,6,5,4,3,2]),fresh=base+first+dv(base+first,[6,5,4,3,2,9,8,7,6,5,4,3,2]);
  const response=await Promise.all(raceBodies.map(payload=>app.inject({method:"POST",url:"/generators",headers:{authorization:`Bearer ${app.jwt.sign({sub:users.owner.id,role:users.owner.role})}`},payload:{...payload,documentNumber:fresh}})));
  assert.deepEqual(response.map(r=>r.statusCode).sort(),[201,409]);assert.equal(await p.generator.count({where:{cooperativeId:coop.id,documentNumber:fresh}}),1);
  pass("Banco impede dois cadastros simultâneos do mesmo documento, mesmo com e-mails diferentes");
  const list=await call(users.owner,"GET","/generators");assert(list.generators.some((g:any)=>g.id===legacy.id&&g.registrationCategory==="REGISTERED_RESIDENTIAL"));
  assert(!list.generators.some((g:any)=>g.id===other.id));
  pass("Lista e detalhes retornam classificação derivada e documento apenas dentro do escopo da cooperativa");
}
