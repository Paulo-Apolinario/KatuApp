/** Exclusivo para banco descartável local; nunca acessa a VPS. */
import { randomBytes } from "node:crypto";
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
  process.env.JWT_SECRET = randomBytes(48).toString("hex");
  process.env.CORS_ORIGIN = "http://127.0.0.1:5179";
  const { prisma: p } = await import("../../src/lib/prisma");
  const { buildApp } = await import("../../src/app");
  const owner = await p.user.create({
    data: {
      email: "planner@example.invalid",
      displayName: "QA Planejamento",
      passwordHash: "unused",
      role: "COOPERATIVE",
    },
  });
  const other = await p.user.create({
    data: {
      email: "other@example.invalid",
      displayName: "Outra QA",
      passwordHash: "unused",
      role: "COOPERATIVE",
    },
  });
  const driverUser = await p.user.create({
    data: {
      email: "driver@example.invalid",
      displayName: "Motorista QA",
      passwordHash: "unused",
      role: "DRIVER",
    },
  });
  const coop = await p.cooperative.create({
    data: {
      userId: owner.id,
      name: "Cooperativa QA",
      latitude: -3.73,
      longitude: -38.52,
    },
  });
  const foreign = await p.cooperative.create({
    data: { userId: other.id, name: "Outra cooperativa" },
  });
  const driver = await p.driver.create({
    data: {
      cooperativeId: coop.id,
      userId: driverUser.id,
      name: "Motorista QA",
      email: driverUser.email,
      status: "AVAILABLE",
    },
  });
  const inactive = await p.driver.create({
    data: {
      cooperativeId: coop.id,
      name: "Motorista inativo",
      email: "inactive@example.invalid",
      status: "INACTIVE",
    },
  });
  const otherDriver = await p.driver.create({
    data: {
      cooperativeId: coop.id,
      name: "Outro motorista QA",
      email: "other-driver@example.invalid",
      status: "AVAILABLE",
    },
  });
  const vehicle = await p.vehicle.create({
    data: {
      cooperativeId: coop.id,
      driverId: driver.id,
      plate: "QAP1234",
      model: "Caminhão QA",
      capacityKg: 1500,
    },
  });
  const maintenance = await p.vehicle.create({
    data: {
      cooperativeId: coop.id,
      plate: "QAM1234",
      model: "Manutenção",
      status: "MAINTENANCE",
    },
  });
  const gen = await p.generator.create({
    data: {
      cooperativeId: coop.id,
      type: "SMALL",
      name: "Mercado Centro QA",
      email: "gen@example.invalid",
      street: "Rua Centro",
      number: "10",
      neighborhood: "Centro",
      city: "Sobral",
      state: "CE",
      latitude: -3.69,
      longitude: -40.34,
    },
  });
  const unmapped = await p.generator.create({
    data: {
      cooperativeId: coop.id,
      type: "LARGE",
      name: "Gerador sem GPS QA",
      email: "unmapped@example.invalid",
      city: "Cruz",
      neighborhood: "Centro",
    },
  });
  const bin = await p.bin.create({
    data: {
      cooperativeId: coop.id,
      binId: "PEV-QA",
      name: "PEV Praça QA",
      city: "Jijoca de Jericoacoara",
      latitude: -2.89,
      longitude: -40.44,
    },
  });
  const item = await p.wasteStockItem.create({
    data: {
      cooperativeId: coop.id,
      name: "Papel",
      category: "Papel",
      unit: "KG",
    },
  });
  const liter = await p.wasteStockItem.create({
    data: {
      cooperativeId: coop.id,
      name: "Óleo",
      category: "Óleo",
      unit: "LITER",
    },
  });
  const a = await p.collection.create({
    data: {
      cooperativeId: coop.id,
      generatorId: gen.id,
      status: "PENDING",
      collectionMaterials: {
        create: {
          wasteTypeId: item.id,
          nameSnapshot: "Papel",
          quantity: 10,
          unit: "KG",
        },
      },
    },
  });
  const b = await p.collection.create({
    data: {
      cooperativeId: coop.id,
      binId: bin.id,
      status: "PENDING",
      collectionMaterials: {
        create: {
          wasteTypeId: liter.id,
          nameSnapshot: "Óleo",
          quantity: 5,
          unit: "LITER",
        },
      },
    },
  });
  const c = await p.collection.create({
    data: {
      cooperativeId: coop.id,
      generatorId: unmapped.id,
      status: "PENDING",
    },
  });
  const race = await p.collection.create({
    data: { cooperativeId: coop.id, generatorId: gen.id, status: "PENDING" },
  });
  const foreignCollection = await p.collection.create({
    data: { cooperativeId: foreign.id, status: "PENDING" },
  });
  const legacy = await p.route.create({
    data: {
      cooperativeId: coop.id,
      name: "Rota antiga QA",
      stops: ["Portaria antiga, 123"],
      scheduledDate: new Date("2026-10-23T12:00:00-03:00"),
      driverId: driver.id,
      vehicleId: vehicle.id,
    },
  });
  const finished = await p.collection.create({
    data: {
      cooperativeId: coop.id,
      generatorId: gen.id,
      status: "COLLECTED",
      routeId: legacy.id,
      driverId: driver.id,
      vehicleId: vehicle.id,
    },
  });
  const closed = await p.route.create({
    data: {
      cooperativeId: coop.id,
      name: "Rota encerrada QA",
      stops: ["Histórico"],
      status: "COMPLETED",
    },
  });
  const collectorUser = await p.user.create({
    data: {
      email: "collector-route@example.invalid",
      role: "COLLECTOR",
      displayName: "Catador Rota QA",
      passwordHash: "unused",
    },
  });
  const collector = await p.collector.create({
    data: {
      cooperativeId: coop.id,
      userId: collectorUser.id,
      name: "Catador Rota QA",
      email: collectorUser.email,
    },
  });
  const outsiderUser = await p.user.create({
    data: {
      email: "outsider-route@example.invalid",
      role: "COLLECTOR",
      displayName: "Catador externo QA",
      passwordHash: "unused",
    },
  });
  await p.collector.create({
    data: {
      cooperativeId: foreign.id,
      userId: outsiderUser.id,
      name: "Catador externo QA",
      email: outsiderUser.email,
    },
  });
  // Provedor rodoviário controlado: nunca consulta ruas ou coordenadas reais em serviços externos.
  const { createServer } = await import("node:http");
  const { existsSync } = await import("node:fs");
  process.env.ROUTING_OSRM_URL = "http://127.0.0.1:3341";
  const roads = createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    if (existsSync(process.env.KATUA_VALIDATION_DIR + "/roads-down")) {
      res.statusCode = 503;
      res.end(JSON.stringify({ code: "Error" }));
      return;
    }
    const path = req.url!.split("?")[0];
    const coords = path
      .split("/")
      .pop()!
      .split(";")
      .map((p) => p.split(",").map(Number));
    const matrix = coords.map((a) =>
      coords.map(
        (b) => Math.abs(a[0] - b[0]) * 100000 + Math.abs(a[1] - b[1]) * 100000,
      ),
    );
    if (path.startsWith("/table"))
      res.end(
        JSON.stringify({ code: "Ok", distances: matrix, durations: matrix }),
      );
    else
      res.end(
        JSON.stringify({
          code: "Ok",
          waypoints: coords.map(() => ({ distance: 0 })),
          routes: [
            {
              distance: matrix
                .slice(0, -1)
                .reduce((s, r, i) => s + r[i + 1], 0),
              duration: 600,
              geometry: { type: "LineString", coordinates: coords },
            },
          ],
        }),
      );
  });
  await new Promise<void>((res) => roads.listen(3341, "127.0.0.1", res));
  const app = await buildApp();
  await app.listen({ host: "127.0.0.1", port: 3339 });
  const sign = (u: any) => app.jwt.sign({ sub: u.id, role: u.role });
  if (!process.env.KATUA_VALIDATION_DIR) throw Error("Diretório obrigatório");
  writeFileSync(
    process.env.KATUA_VALIDATION_DIR + "/fixture.json",
    JSON.stringify({
      owner,
      coop,
      gen,
      bin,
      collector,
      collectorUser,
      collectorToken: sign(collectorUser),
      outsiderToken: sign(outsiderUser),
      driver,
      inactive,
      otherDriver,
      vehicle,
      maintenance,
      a,
      b,
      c,
      race,
      foreignCollection,
      legacy,
      finished,
      closed,
      token: sign(owner),
      otherToken: sign(other),
      driverToken: sign(driverUser),
    }),
    { mode: 0o600 },
  );
  console.log("LOCAL_API_READY");
  const close = async () => {
    await app.close();
    roads.close();
    await p.$disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", close);
  process.on("SIGINT", close);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
