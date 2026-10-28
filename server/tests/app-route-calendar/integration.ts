import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
async function main() {
  const db = new URL(process.env.DATABASE_URL!);
  if (
    process.env.KATUA_LOCAL_VALIDATION !== "1" ||
    db.hostname !== "127.0.0.1" ||
    db.port !== "54329"
  )
    throw Error("Banco local descartável obrigatório");
  process.env.NODE_ENV = "test";
  process.env.LOG_LEVEL = "silent";
  process.env.JWT_SECRET = randomBytes(48).toString("hex");
  const { prisma: p } = await import("../../src/lib/prisma");
  const { buildApp } = await import("../../src/app");
  const app = await buildApp();
  await app.ready();
  const checks: string[] = [];
  const pass = (label: string) => {
    checks.push(label);
    console.log("PASS " + label);
  };
  const users: any = {};
  for (const [name, role] of [
    ["owner", "COOPERATIVE"],
    ["collector", "COLLECTOR"],
    ["other", "COLLECTOR"],
    ["driver", "DRIVER"],
  ])
    users[name] = await p.user.create({
      data: {
        email: `${name}@route.test.invalid`,
        displayName: name!,
        role: role as any,
        passwordHash: "unused-local",
      },
    });
  const coop = await p.cooperative.create({
    data: { userId: users.owner.id, name: "Cooperativa QA" },
  });
  const collector = await p.collector.create({
    data: {
      cooperativeId: coop.id,
      userId: users.collector.id,
      email: users.collector.email,
      name: "Catador QA",
    },
  });
  await p.collector.create({
    data: {
      cooperativeId: coop.id,
      userId: users.other.id,
      email: users.other.email,
      name: "Outro catador QA",
    },
  });
  const driver = await p.driver.create({
    data: {
      cooperativeId: coop.id,
      userId: users.driver.id,
      email: users.driver.email,
      name: "Motorista QA",
    },
  });
  const vehicle = await p.vehicle.create({
    data: {
      cooperativeId: coop.id,
      driverId: driver.id,
      plate: "QAT2026",
      model: "QA",
    },
  });
  const route = await p.route.create({
    data: {
      cooperativeId: coop.id,
      name: "Diária QA",
      collectorIds: [collector.id],
      scheduledDate: new Date(),
      status: "SCHEDULED",
    },
  });
  await p.collection.create({
    data: {
      cooperativeId: coop.id,
      routeId: route.id,
      collectorId: collector.id,
      status: "PENDING",
    },
  });
  async function call(
    who: string,
    method: any,
    url: string,
    payload: any,
    expected = 200,
  ) {
    const u = users[who];
    const r = await app.inject({
      method,
      url,
      headers: {
        authorization: "Bearer " + app.jwt.sign({ sub: u.id, role: u.role }),
      },
      ...(payload === undefined ? {} : { payload }),
    });
    assert.equal(r.statusCode, expected, r.body);
    return r.json();
  }
  const blocked = await call(
    "collector",
    "POST",
    `/routes/${route.id}/field-status`,
    { status: "IN_PROGRESS", driverId: driver.id, vehicleId: vehicle.id },
    400,
  );
  assert.match(blocked.error, /preparação pela cooperativa/);
  const original = await p.route.findUniqueOrThrow({ where: { id: route.id } });
  assert.equal(original.driverId, null);
  assert.equal(original.vehicleId, null);
  assert.equal(original.status, "SCHEDULED");
  pass(
    "Execução incompleta permanece agendada e informa preparação pela cooperativa; App não atribui recursos",
  );
  await call(
    "other",
    "POST",
    `/routes/${route.id}/field-status`,
    { status: "IN_PROGRESS" },
    400,
  );
  pass("Catador não atribuído não inicia a execução");
  await call("owner", "PATCH", `/routes/${route.id}`, {
    driverId: driver.id,
    vehicleId: vehicle.id,
  });
  const assigned = await p.route.findUniqueOrThrow({ where: { id: route.id } });
  assert.equal(assigned.driverId, driver.id);
  assert.equal(assigned.vehicleId, vehicle.id);
  pass("Cooperativa prepara a mesma execução sem criar outra rota ou coleta");
  const started = await call(
    "collector",
    "POST",
    `/routes/${route.id}/field-status`,
    { status: "IN_PROGRESS" },
  );
  assert.equal(started.route.status, "IN_PROGRESS");
  assert.equal(await p.collection.count({ where: { routeId: route.id } }), 1);
  pass("Catador inicia a rota depois da preparação");
  await call("driver", "POST", `/routes/${route.id}/field-status`, {
    status: "IN_PROGRESS",
  });
  pass("Motorista atribuído acompanha a execução sem duplicidade");
  await call(
    "collector",
    "POST",
    `/routes/${route.id}/field-status`,
    { status: "COMPLETED" },
    400,
  );
  pass("Encerramento continua bloqueado enquanto houver ponto pendente");
  fs.writeFileSync(
    path.join(
      process.env.KATUA_VALIDATION_TOOLS || "/tmp",
      "app-route-calendar-api-results.json",
    ),
    JSON.stringify({ passed: checks.length, checks }, null, 2),
  );
  await app.close();
  await p.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
