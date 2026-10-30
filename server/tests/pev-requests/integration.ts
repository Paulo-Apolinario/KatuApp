/** Testes de integração: exige banco descartável local. Nunca usa a VPS. */
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
async function main() {
  const url = new URL(process.env.DATABASE_URL || "http://invalid");
  if (
    process.env.KATUA_LOCAL_VALIDATION !== "1" ||
    url.hostname !== "127.0.0.1" ||
    url.port !== "54329"
  )
    throw Error("Banco local isolado obrigatório");
  process.env.NODE_ENV = "test";
  process.env.LOG_LEVEL = "silent";
  process.env.JWT_SECRET = randomBytes(48).toString("hex");
  const { prisma: p } = await import("../../src/lib/prisma");
  const { buildApp } = await import("../../src/app");
  const app = await buildApp();
  await app.ready();
  const checks: string[] = [];
  const ok = (s: string) => {
    checks.push(s);
    console.log(`PASS ${s}`);
  };
  const users: any = {};
  for (const [name, role] of [
    ["owner", "COOPERATIVE"],
    ["otherOwner", "COOPERATIVE"],
    ["pf", "PF"],
    ["otherPf", "PF"],
    ["cat", "COLLECTOR"],
    ["otherCat", "COLLECTOR"],
    ["driver", "DRIVER"],
  ])
    users[name] = await p.user.create({
      data: {
        email: `${name}@pev-test.invalid`,
        displayName: name,
        role: role as any,
        passwordHash: "unused",
      },
    });
  const coop = await p.cooperative.create({
      data: { name: "Cooperativa Rua", userId: users.owner.id },
    }),
    other = await p.cooperative.create({
      data: { name: "Outra Cooperativa", userId: users.otherOwner.id },
    });
  const cat = await p.collector.create({
      data: {
        userId: users.cat.id,
        cooperativeId: coop.id,
        name: "Catador da Rua",
        email: "cat@pev-test.invalid",
        status: "AVAILABLE",
      },
    }),
    otherCat = await p.collector.create({
      data: {
        userId: users.otherCat.id,
        cooperativeId: other.id,
        name: "Outro Catador",
        email: "otherCat@pev-test.invalid",
      },
    });
  const token = (name: string) =>
    app.jwt.sign({ sub: users[name].id, role: users[name].role });
  async function call(
    name: string,
    method: any,
    path: string,
    payload?: any,
    expected = 200,
  ) {
    const r = await app.inject({
      method,
      url: path,
      headers: { authorization: `Bearer ${token(name)}` },
      ...(payload !== undefined ? { payload } : {}),
    });
    assert.equal(
      r.statusCode,
      expected,
      `${method} ${path}: ${r.body.slice(0, 400)}`,
    );
    return r.json();
  }
  const createBin = async (code: string, opts: any = {}) =>
    p.bin.create({
      data: {
        cooperativeId: coop.id,
        binId: code,
        name: `PEV ${code}`,
        pointKind: "PEV",
        street: "Rua Teste",
        number: "30",
        city: "Fortaleza",
        state: "CE",
        latitude: -3.73,
        longitude: -38.52,
        publicAccess: true,
        responsibleContact: "PRIVATE-CONTACT",
        notes: "PRIVATE-NOTES",
        ...opts,
      },
    });
  const bin = await createBin("publico"),
    privateBin = await createBin("privado", { publicAccess: false }),
    partner = await createBin("parceiro", { pointKind: "PARTNER" }),
    unlocated = await createBin("sem-mapa", {
      latitude: null,
      longitude: null,
    }),
    inactive = await createBin("inativo", { status: "INACTIVE" }),
    otherBin = await createBin("outra", { cooperativeId: other.id });
  const listed = await call("pf", "GET", "/pev-points");
  assert.deepEqual(
    listed.bins.map((b: any) => b.id).sort(),
    [bin.id, otherBin.id].sort(),
  );
  assert.ok(!JSON.stringify(listed).includes("PRIVATE"));
  ok("PF vê somente PEVs públicos localizados, sem contatos ou notas internas");
  const ownPoints = await call("cat", "GET", "/pev-points");
  assert.ok(ownPoints.bins.some((b: any) => b.id === privateBin.id));
  ok("Catador também vê pontos privados da própria cooperativa");
  await call("driver", "GET", "/pev-points", undefined, 403);
  ok("Motorista não assume permissão de solicitante");
  const png =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=";
  const payload = {
    id: randomUUID(),
    binId: bin.id,
    condition: "FULL",
    notes: "PEV cheio desde hoje",
    photos: [png],
  };
  await call(
    "pf",
    "POST",
    "/pev-requests",
    { ...payload, binId: privateBin.id },
    404,
  );
  await call(
    "pf",
    "POST",
    "/pev-requests",
    { ...payload, binId: unlocated.id },
    404,
  );
  ok("PF não pode relatar ponto privado ou sem localização");
  await call(
    "pf",
    "POST",
    "/pev-requests",
    { ...payload, photos: ["data:image/png;base64,AAAA"] },
    400,
  );
  await call(
    "pf",
    "POST",
    "/pev-requests",
    { ...payload, cooperativeId: other.id },
    400,
  );
  ok("Fotos inválidas e cooperativa forjada são rejeitadas");
  const report = (await call("pf", "POST", "/pev-requests", payload, 201))
    .request;
  assert.equal(report.cooperativeId, coop.id);
  assert.equal(await p.collection.count(), 0);
  assert.equal(await p.collectionWasteEntry.count(), 0);
  assert.equal(
    (await p.bin.findUniqueOrThrow({ where: { id: bin.id } })).needsPickup,
    true,
  );
  ok(
    "Relato com foto vai à cooperativa do PEV, sinaliza retirada e não cria peso ou estoque",
  );
  await call("pf", "POST", "/pev-requests", payload, 201);
  assert.equal(await p.pevRequest.count(), 1);
  await call(
    "pf",
    "POST",
    "/pev-requests",
    { ...payload, notes: "Outro conteúdo reutilizando o protocolo" },
    409,
  );
  ok(
    "Reenvio idêntico é idempotente e protocolo com outro conteúdo é bloqueado",
  );
  await call("otherPf", "GET", `/pev-requests/${report.id}`, undefined, 404);
  await call("otherOwner", "GET", `/pev-requests/${report.id}`, undefined, 404);
  await call("otherCat", "GET", `/pev-requests/${report.id}`, undefined, 404);
  assert.equal((await call("otherOwner", "GET", "/pev-requests")).total, 0);
  assert.equal(
    (await call("pf", "GET", `/pev-requests/${report.id}`)).request.photos[0],
    png,
  );
  ok("Fotos e detalhes isolados por solicitante e cooperativa responsável");
  await call("pf", "POST", `/pev-requests/${report.id}/collect`, {}, 403);
  await call(
    "otherOwner",
    "POST",
    `/pev-requests/${report.id}/collect`,
    { collectorId: otherCat.id },
    404,
  );
  ok("PF e outra cooperativa não executam a retirada");
  const review = {
    operationId: randomUUID(),
    expectedVersion: 1,
    kind: "REVIEW",
    notes: "Vamos verificar o ponto ainda hoje",
    photos: [],
  };
  await call("owner", "POST", `/pev-requests/${report.id}/updates`, review);
  await call("owner", "POST", `/pev-requests/${report.id}/updates`, review);
  assert.equal(await p.pevRequestUpdate.count(), 1);
  await call(
    "pf",
    "POST",
    `/pev-requests/${report.id}/updates`,
    { ...review, operationId: randomUUID() },
    403,
  );
  ok("Resposta da cooperativa é idempotente e PF não altera o atendimento");
  await call(
    "pf",
    "POST",
    `/pev-requests/${report.id}/updates`,
    {
      operationId: randomUUID(),
      expectedVersion: 1,
      kind: "EVIDENCE",
      notes: "Foto adicional da situação",
      photos: [png],
    },
    409,
  );
  ok("Controle de versão bloqueia sobrescrita de atualização concorrente");
  const earlier = (
    await call(
      "otherPf",
      "POST",
      "/pev-requests",
      {
        ...payload,
        id: randomUUID(),
        notes: "Outro relato anterior ao encaminhamento da retirada",
      },
      201,
    )
  ).request;
  const collection = (
    await call("cat", "POST", `/pev-requests/${report.id}/collect`, {})
  ).collection;
  assert.equal(
    (await p.pevRequest.findUniqueOrThrow({ where: { id: earlier.id } }))
      .collectionId,
    collection.id,
  );
  ok(
    "Encaminhamento vincula todos os relatos abertos do mesmo PEV à única coleta",
  );
  assert.equal(collection.binId, bin.id);
  assert.equal(collection.collectorId, cat.id);
  assert.equal(collection.routeId, null);
  assert.equal(collection.status, "PENDING");
  assert.equal(
    (await call("cat", "POST", `/pev-requests/${report.id}/collect`, {}))
      .collection.id,
    collection.id,
  );
  assert.equal(await p.collection.count(), 1);
  ok("Catador abre retirada sem rota; repetição não duplica coleta");
  const secondPayload = {
    ...payload,
    id: randomUUID(),
    notes: "Outro morador confirma que está cheio",
  };
  const second = (
    await call("otherPf", "POST", "/pev-requests", secondPayload, 201)
  ).request;
  assert.equal(second.collectionId, collection.id);
  assert.equal(await p.collection.count(), 1);
  ok(
    "Novos relatos se vinculam à retirada já ativa sem gerar coleta duplicada",
  );
  await call("otherCat", "POST", "/pev-requests", { ...payload, id: randomUUID(), notes: "Tentativa de acessar ponto alheio" }, 404);
  assert.ok(!(await call("otherCat", "GET", "/pev-points")).bins.some((b: any) => b.id === bin.id));
  assert.ok(!(await call("otherOwner", "GET", "/pev-points")).bins.some((b: any) => b.id === bin.id));
  ok("PEV público permanece oculto para outra cooperativa e seus catadores, inclusive por ID direto");
  let current = (await call("pf", "GET", `/pev-requests/${report.id}`)).request;
  await call("cat", "POST", `/pev-requests/${report.id}/updates`, {
    operationId: randomUUID(),
    expectedVersion: current.version,
    kind: "EVIDENCE",
    notes: "Foto do PEV antes da retirada",
    photos: [png],
  });
  ok("Catador da cooperativa complementa relato de PF com fotos");
  await call("cat", "POST", `/collections/${collection.id}/start`, {});
  const complete = await call(
    "cat",
    "POST",
    `/collections/${collection.id}/complete-field`,
    {
      materials: [
        {
          proposedMaterial: { name: "Papelão do PEV", unit: "KG" },
          unit: "KG",
          quantity: 40,
        },
      ],
    },
  );
  assert.equal(complete.collection.status, "COLLECTED");
  assert.equal(await p.collectionWasteEntry.count(), 1);
  ok(
    "Retirada segue o fluxo de campo e registra material somente na conclusão",
  );
  await call("owner", "POST", `/collections/${collection.id}/receive`, {});
  const after = (await call("pf", "GET", `/pev-requests/${report.id}`)).request;
  assert.equal(after.collection.status, "RECEIVED");
  assert.ok(
    (await call("pf", "GET", "/notifications")).notifications.some(
      (n: any) => n.kind === "COLLECTION_STAGE" && n.data?.pevRequestId,
    ),
  );
  assert.ok(
    (await call("owner", "GET", "/notifications")).notifications.some(
      (n: any) => n.kind === "PEV_REQUEST",
    ),
  );
  ok(
    "PF acompanha recebimento e recebe notificações das etapas; cooperativa recebe o relato",
  );
  current = (await call("owner", "GET", `/pev-requests/${report.id}`)).request;
  await call("owner", "POST", `/pev-requests/${report.id}/updates`, {
    operationId: randomUUID(),
    expectedVersion: current.version,
    kind: "RESOLVE",
    notes: "Retirada recebida e atendimento encerrado",
    photos: [],
  });
  await call("cat", "POST", `/pev-requests/${report.id}/collect`, {}, 409);
  assert.equal(
    (await p.collection.findUniqueOrThrow({ where: { id: collection.id } }))
      .status,
    "RECEIVED",
  );
  ok(
    "Encerramento impede nova retirada pelo mesmo protocolo e preserva coleta e estoque",
  );
  const requestPrivate = (
    await call(
      "cat",
      "POST",
      "/pev-requests",
      {
        ...payload,
        id: randomUUID(),
        binId: privateBin.id,
        notes: "Ponto interno precisa de verificação",
      },
      201,
    )
  ).request;
  await p.collector.update({
    where: { id: cat.id },
    data: { status: "ON_ROUTE" },
  });
  const extra = (
    await call("cat", "POST", `/pev-requests/${requestPrivate.id}/collect`, {})
  ).collection;
  assert.equal(extra.routeId, null);
  ok("Catador em rota pode abrir retirada avulsa na própria cooperativa");
  await call("owner", "POST", `/collections/${extra.id}/cancel`, {
    cancellationReason: "Coleta reagendada para nova verificação",
  });
  const retried = (
    await call("cat", "POST", `/pev-requests/${requestPrivate.id}/collect`, {})
  ).collection;
  assert.notEqual(retried.id, extra.id);
  assert.equal(
    await p.collection.count({
      where: {
        binId: privateBin.id,
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
    }),
    1,
  );
  ok(
    "Retirada cancelada pode ser reencaminhada sem perder o histórico nem duplicar coleta ativa",
  );
  await call(
    "owner",
    "PUT",
    `/bins/${unlocated.id}`,
    { publicAccess: true },
    400,
  );
  await call(
    "owner",
    "PUT",
    `/bins/${partner.id}`,
    { publicAccess: true },
    400,
  );
  ok(
    "Publicação no App exige modalidade pública compatível e localização salva",
  );
  await p.user.update({
    where: { id: users.cat.id },
    data: { isActive: false },
  });
  await call("cat", "GET", "/pev-points", undefined, 401);
  ok("Conta desativada perde acesso imediatamente");
  const evidence = await call("pf", "GET", `/pev-requests/${report.id}`);
  assert.ok(evidence.request.updatesTotal >= 3);
  assert.ok(evidence.request.updates.length <= 5);
  assert.ok(
    !("photos" in (await call("pf", "GET", "/pev-requests")).requests[0]),
  );
  ok("Listagem não transfere fotos; histórico de evidências tem paginação");
  writeFileSync(
    process.env.KATUA_PEV_TEST_RESULT || "/tmp/katua-pev-api-results.json",
    JSON.stringify({ passed: checks.length, checks }, null, 2),
  );
  if (process.env.KATUA_PEV_UI_FIXTURE) {
    await p.user.update({
      where: { id: users.cat.id },
      data: { isActive: true },
    });
    await p.collector.update({
      where: { id: cat.id },
      data: { status: "AVAILABLE" },
    });
    await p.cooperative.update({
      where: { id: coop.id },
      data: { latitude: -3.735, longitude: -38.525 },
    });
    await p.driver.create({
      data: {
        userId: users.driver.id,
        cooperativeId: coop.id,
        name: "Motorista QA",
        email: "driver@pev-test.invalid",
      },
    });
    const uiBin = await createBin("Teste de interface", {
      latitude: -3.728,
      longitude: -38.518,
    });

    writeFileSync(
      process.env.KATUA_PEV_UI_FIXTURE,
      JSON.stringify({
        tokens: Object.fromEntries(
          Object.keys(users).map((k) => [k, token(k)]),
        ),
        users,
        coop,
        bin: uiBin,
        reportId: second.id,
      }),
    );
    await app.listen({ host: "127.0.0.1", port: 3339 });
    console.log("PEV_UI_READY");
    return;
  }
  await app.close();
  await p.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
