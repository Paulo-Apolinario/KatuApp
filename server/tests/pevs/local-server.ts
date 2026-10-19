/** Ambiente descartável de validação. Nunca executar com banco de produção. */
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import bcrypt from "bcryptjs";

async function main() {
  const url = new URL(process.env.DATABASE_URL || "http://invalid");
  if (
    process.env.KATUA_LOCAL_VALIDATION !== "1" ||
    url.hostname !== "127.0.0.1" ||
    url.port !== "54329"
  ) {
    throw new Error(
      "Validação exige KATUA_LOCAL_VALIDATION=1 e banco local isolado na porta 54329.",
    );
  }
  Object.assign(process.env, { NODE_ENV: "test" });
  process.env.JWT_SECRET = randomBytes(48).toString("hex");
  process.env.CORS_ORIGIN = "http://127.0.0.1:5179,http://127.0.0.1:8089";
  const { prisma } = await import("../../src/lib/prisma");
  const { buildApp } = await import("../../src/app");
  const run = Date.now().toString(36);
  const password = `Local-test-${randomBytes(8).toString("hex")}!`;
  const passwordHash = await bcrypt.hash(password, 4);
  const owner = await prisma.user.create({
    data: {
      email: `qa-owner-${run}@example.invalid`,
      displayName: "QA Cooperativa",
      role: "COOPERATIVE",
      passwordHash,
    },
  });
  const cooperative = await prisma.cooperative.create({
    data: { name: "QA Cooperativa", userId: owner.id },
  });
  const otherUser = await prisma.user.create({
    data: {
      email: `qa-other-${run}@example.invalid`,
      displayName: "QA Outra",
      role: "COOPERATIVE",
      passwordHash,
    },
  });
  const otherCooperative = await prisma.cooperative.create({
    data: { name: "QA Outra", userId: otherUser.id },
  });
  const driverUser = await prisma.user.create({
    data: {
      email: `qa-driver-${run}@example.invalid`,
      displayName: "QA Motorista",
      role: "DRIVER",
      passwordHash,
    },
  });
  const driver1 = await prisma.driver.create({
    data: {
      cooperativeId: cooperative.id,
      userId: driverUser.id,
      name: "QA Motorista Ana",
      email: `qa-ana-${run}@example.invalid`,
    },
  });
  const driver2 = await prisma.driver.create({
    data: {
      cooperativeId: cooperative.id,
      name: "QA Motorista Bruno",
      email: `qa-bruno-${run}@example.invalid`,
    },
  });
  const otherDriver = await prisma.driver.create({
    data: {
      cooperativeId: otherCooperative.id,
      name: "QA Outra Motorista",
      email: `qa-foreign-${run}@example.invalid`,
    },
  });
  const vehicle1 = await prisma.vehicle.create({
    data: {
      cooperativeId: cooperative.id,
      plate: `QA${run}1`.toUpperCase(),
      model: "Caminhão Azul",
      capacityKg: 1000,
      driverId: driver1.id,
    },
  });
  const vehicle2 = await prisma.vehicle.create({
    data: {
      cooperativeId: cooperative.id,
      plate: `QA${run}2`.toUpperCase(),
      model: "Caminhão Verde",
      capacityKg: 2000,
      driverId: driver2.id,
    },
  });
  const routes: Record<string, any> = {};
  for (const name of ["equipe", "mixed", "blocked", "rollback", "offline"]) {
    routes[name] = await prisma.route.create({
      data: {
        cooperativeId: cooperative.id,
        name: `QA ${name}`,
        status: "IN_PROGRESS",
        driverId: driver1.id,
        vehicleId: vehicle1.id,
        stops: ["Rua A, 123"],
      },
    });
  }
  const collections: Record<string, any> = {};
  for (const [name, route, status] of [
    ["pending", routes.equipe, "PENDING"],
    ["historical", routes.equipe, "COLLECTED"],
    ["mixedCollected", routes.mixed, "COLLECTED"],
    ["mixedCancelled", routes.mixed, "CANCELLED"],
    ["blockedPending", routes.blocked, "PENDING"],
    ["rollbackPending", routes.rollback, "PENDING"],
    ["offlineCollected", routes.offline, "COLLECTED"],
  ] as const) {
    collections[name] = await prisma.collection.create({
      data: {
        cooperativeId: cooperative.id,
        routeId: route.id,
        status,
        driverId: driver1.id,
        vehicleId: vehicle1.id,
        totalWeightKg: status === "COLLECTED" ? 25 : 0,
      },
    });
  }
  const collectorUser = await prisma.user.create({
    data: {
      email: `qa-catador-${run}@example.invalid`,
      displayName: "QA Catador",
      role: "COLLECTOR",
      passwordHash,
    },
  });
  const collector = await prisma.collector.create({
    data: {
      cooperativeId: cooperative.id,
      userId: collectorUser.id,
      name: "QA Catador",
      email: `qa-catador-${run}@example.invalid`,
    },
  });
  mkdirSync("uploads", { recursive: true });
  const app = await buildApp();
  await app.listen({ port: 3339, host: "127.0.0.1" });
  const fixture = {
    owner: { id: owner.id, email: owner.email, role: owner.role },
    otherUser: {
      id: otherUser.id,
      email: otherUser.email,
      role: otherUser.role,
    },
    cooperative,
    driver1,
    driver2,
    otherDriver,
    vehicle1,
    vehicle2,
    routes,
    collections,
    password,
    collector,
    collectorUser,
    collectorToken: app.jwt.sign({
      sub: collectorUser.id,
      role: collectorUser.role,
    }),
    token: app.jwt.sign({
      sub: owner.id,
      role: owner.role,
      email: owner.email,
    }),
    otherToken: app.jwt.sign({
      sub: otherUser.id,
      role: otherUser.role,
      email: otherUser.email,
    }),
    driverToken: app.jwt.sign({
      sub: driverUser.id,
      role: driverUser.role,
      email: driverUser.email,
    }),
  };
  const outputDir = process.env.KATUA_VALIDATION_DIR;
  if (!outputDir)
    throw new Error(
      "Defina KATUA_VALIDATION_DIR para os arquivos temporários.",
    );
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(`${outputDir}/fixture.json`, JSON.stringify(fixture), {
    mode: 0o600,
  });
  console.log("LOCAL_API_READY: 127.0.0.1:3339 — apenas dados demonstrativos");
  const close = async () => {
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", close);
  process.on("SIGINT", close);
}
main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
