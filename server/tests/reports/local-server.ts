/** Banco descartável obrigatório. Não usa dados da VPS. */
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
async function main() {
  const u = new URL(process.env.DATABASE_URL || "http://invalid");
  if (
    process.env.KATUA_LOCAL_VALIDATION !== "1" ||
    u.hostname !== "127.0.0.1" ||
    u.port !== "54329"
  )
    throw Error("Banco local isolado obrigatório");
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = randomBytes(48).toString("hex");
  process.env.CORS_ORIGIN = "http://127.0.0.1:5179";
  const { prisma: p } = await import("../../src/lib/prisma");
  const { buildApp } = await import("../../src/app");
  const owner = await p.user.create({
    data: {
      email: "owner@example.invalid",
      displayName: "QA Relatórios",
      passwordHash: "not-a-password",
      role: "COOPERATIVE",
    },
  });
  const other = await p.user.create({
    data: {
      email: "other@example.invalid",
      displayName: "QA Outra",
      passwordHash: "not-a-password",
      role: "COOPERATIVE",
    },
  });
  const driverUser = await p.user.create({
    data: {
      email: "driver@example.invalid",
      displayName: "QA Motorista",
      passwordHash: "not-a-password",
      role: "DRIVER",
    },
  });
  const coop = await p.cooperative.create({
    data: {
      userId: owner.id,
      name: "Cooperativa QA Sobral",
      city: "Sobral",
      state: "CE",
      latitude: -3.68,
      longitude: -40.35,
    },
  });
  const foreign = await p.cooperative.create({
    data: { userId: other.id, name: "Outra cooperativa" },
  });
  const collector = await p.collector.create({
    data: {
      cooperativeId: coop.id,
      name: "Catadora QA",
      email: "catadora@example.invalid",
    },
  });
  const driver = await p.driver.create({
    data: {
      cooperativeId: coop.id,
      userId: driverUser.id,
      name: "Motorista QA",
      email: "motorista@example.invalid",
    },
  });
  const vehicle = await p.vehicle.create({
    data: {
      cooperativeId: coop.id,
      plate: "QAA1234",
      model: "Caminhão QA",
      capacityKg: 1000,
    },
  });
  const gen = await p.generator.create({
    data: {
      cooperativeId: coop.id,
      type: "SMALL",
      name: "Gerador QA Sobral",
      email: "gen@example.invalid",
      city: "Sobral",
      latitude: -3.7,
      longitude: -40.34,
    },
  });
  const kg = await p.wasteStockItem.create({
    data: {
      cooperativeId: coop.id,
      name: "Papel QA",
      category: "Papel",
      unit: "KG",
    },
  });
  const liter = await p.wasteStockItem.create({
    data: {
      cooperativeId: coop.id,
      name: "Óleo QA",
      category: "Óleo",
      unit: "LITER",
    },
  });
  const dt = (s: string) => new Date(s);
  async function collection(
    status: any,
    date: string | null,
    quantity: number | null,
    unit: any = "KG",
    extra: any = {},
  ) {
    return p.collection.create({
      data: {
        cooperativeId: coop.id,
        generatorId: gen.id,
        collectorId: collector.id,
        driverId: driver.id,
        vehicleId: vehicle.id,
        status,
        collectedAt: date ? dt(date) : null,
        totalWeightKg: 0,
        ...extra,
        ...(quantity === null
          ? {}
          : {
              collectionMaterials: {
                create: {
                  wasteTypeId: unit === "LITER" ? liter.id : kg.id,
                  nameSnapshot: unit === "LITER" ? "Óleo QA" : "Papel QA",
                  quantity,
                  unit,
                },
              },
            }),
      },
      include: { collectionMaterials: true },
    });
  }
  const first = await collection("COLLECTED", "2026-10-01T03:00:00Z", 100);
  await collection("COMPLETED", "2026-10-02T12:00:00Z", 0.1, "TON", {
    receivedAt: dt("2026-10-03T12:00:00Z"),
    completedAt: dt("2026-10-04T12:00:00Z"),
  });
  await collection("SORTING", "2026-10-03T12:00:00Z", 7, "LITER");
  await collection("CANCELLED", "2026-10-04T12:00:00Z", 999);
  await collection(
    "RECEIVED",
    "2026-10-05T12:00:00Z",
    null,
    "KG",
    { receivedAt: dt("2026-10-06T12:00:00Z") },
  );
  await collection("COLLECTED", null, null);
  await collection("COLLECTED", "2026-10-01T02:59:59.999Z", 500);
  await collection("COLLECTED", "2026-10-22T03:00:00Z", 800);
  await collection("COLLECTED", "2026-10-06T12:00:00Z", null, "KG", {
    totalWeightKg: 25,
  });
  await collection("PENDING", "2026-10-07T12:00:00Z", 1000);
  for (let i = 0; i < 21; i++)
    await collection("COLLECTED", "2026-10-08T12:00:00Z", 1);
  const foreignCollection = await p.collection.create({
    data: {
      cooperativeId: foreign.id,
      status: "COLLECTED",
      totalWeightKg: 9000,
      collectedAt: dt("2026-10-08T12:00:00Z"),
    },
  });
  const entry = await p.collectionWasteEntry.create({
    data: {
      cooperativeId: coop.id,
      collectionId: first.id,
      collectionMaterialId: first.collectionMaterials[0].id,
      wasteTypeId: kg.id,
      materialNameSnapshot: "Papel QA",
      unit: "KG",
      collectedQuantity: 100,
      destinedQuantity: 100,
      remainingQuantity: 0,
    },
  });
  const lot = await p.wasteStockLot.create({
    data: {
      cooperativeId: coop.id,
      stockItemId: kg.id,
      quantity: 100,
      availableQuantity: 100,
      unit: "KG",
      lotCode: "QA-100",
      originCollectionId: first.id,
      originCollectionWasteEntryId: entry.id,
    },
  });
  await p.collectionWasteDestination.create({
    data: {
      cooperativeId: coop.id,
      collectionWasteEntryId: entry.id,
      stockItemId: kg.id,
      stockLotId: lot.id,
      type: "STOCK",
      quantity: 100,
      unit: "KG",
      destinationDate: dt("2026-10-09T12:00:00Z"),
    },
  });
  await p.collectionWasteDestination.create({
    data: {
      cooperativeId: coop.id,
      collectionWasteEntryId: entry.id,
      type: "STOCK",
      quantity: 500,
      unit: "KG",
      status: "CANCELLED",
      destinationDate: dt("2026-10-09T12:00:00Z"),
    },
  });
  await p.maintenanceLog.create({
    data: {
      cooperativeId: coop.id,
      vehicleId: vehicle.id,
      maintenanceType: "Revisão",
      maintenanceDate: dt("2026-10-10T12:00:00Z"),
      cost: 123.5,
      status: "COMPLETED",
    },
  });
  mkdirSync("uploads", { recursive: true });
  const app = await buildApp();
  await app.listen({ port: 3339, host: "127.0.0.1" });
  const sign = (user: any) =>
    app.jwt.sign({ sub: user.id, role: user.role, email: user.email });
  const dir = process.env.KATUA_VALIDATION_DIR;
  if (!dir) throw Error("Diretório obrigatório");
  writeFileSync(
    dir + "/fixture.json",
    JSON.stringify({
      token: sign(owner),
      otherToken: sign(other),
      driverToken: sign(driverUser),
      owner,
      coop,
      collector,
      driver,
      vehicle,
      gen,
      kg,
      liter,
      first,
      foreignCollection,
    }),
    { mode: 0o600 },
  );
  console.log("LOCAL_API_READY");
  const close = async () => {
    await app.close();
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
