/** Local disposable PostgreSQL only. Never connects to the VPS. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomBytes } from "node:crypto";
async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  if (process.env.KATUA_LOCAL_VALIDATION !== "1" || url.hostname !== "127.0.0.1" || url.port !== "54329") throw Error("Banco descartável local obrigatório");
  process.env.NODE_ENV = "test";
  process.env.LOG_LEVEL = "silent";
  process.env.JWT_SECRET = randomBytes(48).toString("hex");
  const { prisma: p } = await import("../../src/lib/prisma");
  const { buildApp } = await import("../../src/app");
  const app = await buildApp(); await app.ready();
  const checks: string[] = [];
  const pass = (name: string) => { checks.push(name); console.log("PASS " + name); };
  const users: any = {};
  for (const [name, role] of [["owner", "COOPERATIVE"], ["foreign", "COOPERATIVE"], ["cat", "COLLECTOR"]]) users[name] = await p.user.create({ data: { email: `${name}@collector.test.invalid`, displayName: name!, role: role as any, passwordHash: "unused-local-test" } });
  const coop = await p.cooperative.create({ data: { userId: users.owner.id, name: "Cooperativa de teste cadastral" } });
  await p.cooperative.create({ data: { userId: users.foreign.id, name: "Outra cooperativa" } });
  async function call(method: any, url: string, payload?: any, who = "owner", expected = 200) {
    const u = users[who]; const r = await app.inject({ method, url, headers: { authorization: "Bearer " + app.jwt.sign({ sub: u.id, role: u.role }) }, ...(payload === undefined ? {} : { payload }) });
    assert.equal(r.statusCode, expected, r.body); return r.json();
  }
  const legacy = await p.collector.findUniqueOrThrow({ where: { id: "collector-before-migration" } });
  assert.equal(legacy.registrationNumber, null); assert.equal(legacy.membershipCategory, null); assert.equal(legacy.status, "ON_ROUTE"); assert.equal(legacy.associationDate?.toISOString().slice(0, 10), "2020-05-12");
  pass("Migração preserva data de filiação e status anteriores, com novos campos inicialmente vazios");
  await p.collector.update({ where: { id: legacy.id }, data: { cooperativeId: coop.id, userId: users.cat.id, email: users.cat.email, socialName: "Nome social preservado", totalKg: 123, kgMonth: 45 } });
  const doc = await p.collectorDocument.create({ data: { collectorId: legacy.id, cooperativeId: coop.id, fileUrl: "/uploads/local-test.pdf", documentName: "Documento existente" } });
  for (const [i, category] of ["FOUNDER", "EFFECTIVE", "BENEFICIARY", "CONTRIBUTOR"].entries()) {
    const { collector } = await call("POST", "/collectors", { name: `Novo catador ${i}`, email: `new${i}@collector.test.invalid`, associationDate: "2026-10-28", registrationNumber: `00${i}/2026`, membershipCategory: category, isAutonomous: true, status: "AVAILABLE" }, "owner", 201);
    assert.equal(collector.membershipCategory, category); assert.equal(collector.registrationNumber, `00${i}/2026`); assert.equal(collector.isAutonomous, true);
  }
  pass("Cadastro aceita e persiste as quatro categorias, inscrição com zeros e opção autônomo");
  const boundary = "collector-boundary-test";
  const fields = { name: "Catador multipart", email: "multipart@collector.test.invalid", registrationNumber: "005", membershipCategory: "FOUNDER" };
  const body = Object.entries(fields).map(([k, v]) => `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`).join("") + `--${boundary}--\r\n`;
  const multipart = await app.inject({ method: "POST", url: "/collectors", headers: { authorization: "Bearer " + app.jwt.sign({ sub: users.owner.id, role: "COOPERATIVE" }), "content-type": `multipart/form-data; boundary=${boundary}` }, payload: body });
  assert.equal(multipart.statusCode, 201, multipart.body); assert.equal(multipart.json().collector.registrationNumber, "005"); assert.equal(multipart.json().collector.membershipCategory, "FOUNDER");
  pass("Cadastro multipart também recebe inscrição e categoria");
  const updated = (await call("PATCH", `/collectors/${legacy.id}`, { associationDate: "2021-06-10", registrationNumber: "0007-A", membershipCategory: "EFFECTIVE", status: "AVAILABLE", phone: "85999999999" })).collector;
  assert.equal(updated.id, legacy.id); assert.equal(updated.status, "ON_ROUTE"); assert.equal(updated.userId, users.cat.id); assert.equal(updated.documents[0].id, doc.id); assert.equal(updated.totalKg, 123); assert.equal(updated.kgMonth, 45); assert.equal(updated.socialName, "Nome social preservado");
  pass("Editar cadastro existente mantém identificador, vínculo, documentos, produção e estado em rota");
  const detail = (await call("GET", `/collectors/${legacy.id}`)).collector;
  const list = (await call("GET", "/collectors")).collectors.find((c: any) => c.id === legacy.id);
  assert.equal(detail.registrationNumber, "0007-A"); assert.equal(list.membershipCategory, "EFFECTIVE");
  pass("Consulta e listagem devolvem os novos dados de filiação");
  await call("PATCH", `/collectors/${legacy.id}`, { email: "corrigido@collector.test.invalid", name: "Nome corrigido", phone: "85988888888" });
  const linked = await p.user.findUniqueOrThrow({ where: { id: users.cat.id } });
  assert.equal(linked.email, "corrigido@collector.test.invalid"); assert.equal(linked.displayName, "Nome corrigido"); assert.equal(linked.phone, "85988888888"); assert.equal(linked.passwordHash, "unused-local-test");
  pass("Edição sincroniza nome, e-mail e telefone do acesso vinculado sem alterar senha");
  await call("PATCH", `/collectors/${legacy.id}`, { email: users.owner.email, name: "Não salvar" }, "owner", 400);
  assert.equal((await p.collector.findUniqueOrThrow({ where: { id: legacy.id } })).name, "Nome corrigido");
  pass("Conflito de e-mail não deixa atualização parcial no cadastro");
  await call("PATCH", `/collectors/${legacy.id}`, { registrationNumber: "", membershipCategory: "", associationDate: "", socialName: "", phone: "" });
  const cleared = await p.collector.findUniqueOrThrow({ where: { id: legacy.id } });
  assert.equal(cleared.registrationNumber, null); assert.equal(cleared.membershipCategory, null); assert.equal(cleared.associationDate, null); assert.equal(cleared.socialName, null); assert.equal((await p.user.findUniqueOrThrow({ where: { id: users.cat.id } })).phone, null);
  pass("Campos opcionais podem ser limpos na edição sem serem silenciosamente mantidos");
  for (const payload of [{ membershipCategory: "OTHER" }, { registrationNumber: "a".repeat(51) }, { associationDate: "2026-02-30" }, { birthDate: "2026-02-30" }, { cooperativeId: "other" }, {}]) await call("PATCH", `/collectors/${legacy.id}`, payload, "owner", 400);
  pass("Validação rejeita categoria inválida, inscrição longa, data inexistente e campos não autorizados");
  await call("GET", `/collectors/${legacy.id}`, undefined, "foreign", 404);
  await call("PATCH", `/collectors/${legacy.id}`, { name: "Intruso" }, "foreign", 404);
  await call("PATCH", `/collectors/${legacy.id}`, { name: "Intruso" }, "cat", 403);
  pass("Outra cooperativa e o perfil de catador não podem editar o cadastro");
  await call("PATCH", `/collectors/${legacy.id}`, { status: "INACTIVE" }); assert.equal((await call("GET", `/collectors/${legacy.id}`)).collector.status, "INACTIVE");
  await call("PATCH", `/collectors/${legacy.id}`, { status: "AVAILABLE" }); assert.equal((await call("GET", `/collectors/${legacy.id}`)).collector.status, "AVAILABLE");
  pass("Ativação e inativação cadastral são persistidas sem recriar o catador");
  const artifacts = process.env.KATUA_VALIDATION_TOOLS || os.tmpdir();
  fs.writeFileSync(path.join(artifacts, "collector-membership-api-results.json"), JSON.stringify({ passed: checks.length, checks }, null, 2));
  if (process.env.COLLECTOR_UI === "1") {
    fs.writeFileSync(path.join(artifacts, "collector-membership-fixture.json"), JSON.stringify({ id: legacy.id, owner: users.owner, token: app.jwt.sign({ sub: users.owner.id, role: "COOPERATIVE" }) }));
    await app.listen({ host: "127.0.0.1", port: 3339 }); console.log("COLLECTOR_UI_READY"); await new Promise(resolve => process.once("SIGTERM", resolve));
  }
  await app.close(); await p.$disconnect();
}
main().catch(error => { console.error(error); process.exitCode = 1; });
