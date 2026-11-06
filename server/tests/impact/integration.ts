import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
async function main() {
  if (
    process.env.KATUA_LOCAL_VALIDATION !== "1" ||
    !process.env.DATABASE_URL?.startsWith("postgresql://qa:qa@127.0.0.1:54329/")
  )
    throw Error("Exige banco descartável local");
  const { prisma: p } = await import("../../src/lib/prisma");
  const { buildApp } = await import("../../src/app");
  const { materialProfileSchema } =
    await import("../../src/modules/impact/material-profile");
  const app = await buildApp();
  await app.ready();
  const checks: string[] = [];
  const pass = (s: string) => {
    checks.push(s);
    console.log("PASS", s);
  };
  const stamp = randomUUID().slice(0, 8);
  const owner = await p.user.create({
    data: {
      email: `impact-${stamp}@example.invalid`,
      displayName: "Cooperativa Impacto QA",
      passwordHash: "qa",
      role: "COOPERATIVE",
    },
  });
  const other = await p.user.create({
    data: {
      email: `foreign-${stamp}@example.invalid`,
      displayName: "Outra QA",
      passwordHash: "qa",
      role: "COOPERATIVE",
    },
  });
  const coop = await p.cooperative.create({
      data: { userId: owner.id, name: owner.displayName },
    }),
    foreign = await p.cooperative.create({
      data: { userId: other.id, name: other.displayName },
    });
  const gen = await p.generator.create({
      data: {
        cooperativeId: coop.id,
        name: "Gerador Norte",
        email: `north-${stamp}@example.invalid`,
        type: "SMALL",
      },
    }),
    gen2 = await p.generator.create({
      data: {
        cooperativeId: coop.id,
        name: "Gerador Sul",
        email: `south-${stamp}@example.invalid`,
        type: "SMALL",
      },
    });
  const foreignItem = await p.wasteStockItem.create({
    data: {
      cooperativeId: foreign.id,
      name: "Material externo",
      category: "QA",
    },
  });
  const sign = (u: any) =>
    app.jwt.sign({ sub: u.id, role: u.role, email: u.email });
  const token = sign(owner);
  const api = async (method: any, url: string, payload?: any, bearer = token) =>
    app.inject({
      method,
      url,
      payload,
      headers: { authorization: `Bearer ${bearer}` },
    });
  const profile = materialProfileSchema.parse({
    materialCode: "PP",
    identification: "VERIFIED",
    identificationEvidence: "Identificação de teste",
    responsible: "Técnico QA",
  });
  let r = await api("POST", "/waste-stock/items", {
    name: "Cadeira branca",
    category: "Plásticos",
    unit: "KG",
    technicalProfile: profile,
  });
  assert.equal(r.statusCode, 201, r.body);
  const pp = r.json().item;
  assert.equal(pp.technicalProfile.materialCode, "PP");
  pass("Perfil técnico persistido no catálogo");
  const oil = await p.wasteStockItem.create({
    data: {
      cooperativeId: coop.id,
      name: "Óleo cozinha",
      category: "Óleo",
      unit: "LITER",
      defaultUnit: "LITER",
    },
  });
  const date = new Date("2026-11-06T10:00:00Z");
  async function col(
    generatorId: string,
    item: any,
    q: number,
    confirmed = true,
  ) {
    return p.collection.create({
      data: {
        cooperativeId: coop.id,
        generatorId,
        status: "COMPLETED",
        collectedAt: date,
        quantitiesReviewedAt: confirmed ? date : null,
        collectionMaterials: {
          create: {
            wasteTypeId: item.id,
            nameSnapshot: item.name,
            quantity: q,
            unit: item.unit,
            identificationSnapshot: { declared: item.technicalProfile || {} },
          },
        },
      },
      include: { collectionMaterials: true },
    });
  }
  const c1 = await col(gen.id, pp, 30),
    c2 = await col(gen2.id, pp, 70);
  await col(gen.id, oil, 80);
  await col(gen.id, pp, 10, false);
  const method = {
    approved: true,
    approvedBy: "Técnico QA",
    source: "Fonte fictícia exclusivamente de teste",
    version: "qa-1",
    region: "CE",
    processScenario: "Cenário demonstrativo",
    validFrom: "2026-01-01",
    label: "Metodologia de teste",
    url: "",
    factors: [{ materialId: pp.id, materialCode: "PP", co2PerKg: 2 }],
  };
  r = await api("PUT", "/reports/config", {
    version: 0,
    goals: { monthlyCollections: null, monthlyMassKg: null },
    methodology: method,
  });
  assert.equal(r.statusCode, 200, r.body);
  pass("Metodologia documentada aceita");
  const url = "/environmental-impact?year=2026";
  r = await api("GET", url);
  assert.equal(r.statusCode, 200, r.body);
  let d = r.json().data;
  assert.equal(d.totalMassKg, 110);
  assert.equal(d.units.LITER, 80);
  assert.equal(d.confirmedMassKg, 100);
  assert.equal(d.co2Kg, null);
  pass("Peso e litros separados sem estimativa prematura");
  for (const c of [c1, c2]) {
    const m = c.collectionMaterials[0];
    const payload = {
      operationId: randomUUID(),
      expectedUpdatedAt: m.updatedAt.toISOString(),
      profile,
    };
    r = await api(
      "PUT",
      `/environmental-impact/materials/${m.id}/identification`,
      payload,
    );
    assert.equal(r.statusCode, 200, r.body);
    r = await api(
      "PUT",
      `/environmental-impact/materials/${m.id}/identification`,
      payload,
    );
    assert.equal(r.statusCode, 200, r.body);
    assert(r.json().replayed);
  }
  pass("Conferência preserva declaração e aceita reenvio idempotente");
  r = await api("GET", url);
  d = r.json().data;
  assert.equal(d.co2Kg, 200);
  assert.equal(d.metricCoverage.co2Kg, 100);
  assert.equal(
    d.generators.reduce((s: number, m: any) => s + (m.co2Kg || 0), 0),
    200,
  );
  pass("Consolidado igual à soma das origens sem duplicação");
  r = await api("GET", `${url}&generatorId=${gen.id}&materialId=${pp.id}`);
  assert.equal(r.json().data.totalMassKg, 40);
  assert.equal(r.json().data.co2Kg, 60);
  pass("Filtros combinados por gerador e item");
  r = await api("GET", `${url}&materialCode=COOKING_OIL`);
  assert.equal(r.json().data.collections, 0);
  pass("Composição não é deduzida pelo nome");
  r = await api("GET", `${url}&materialId=${foreignItem.id}`);
  assert.equal(r.statusCode, 404);
  r = await api(
    "PUT",
    `/environmental-impact/materials/${c1.collectionMaterials[0].id}/identification`,
    {
      operationId: randomUUID(),
      expectedUpdatedAt: date.toISOString(),
      profile,
    },
    sign(other),
  );
  assert.equal(r.statusCode, 404);
  pass("Isolamento entre cooperativas");
  r = await api(
    "PUT",
    `/environmental-impact/materials/${c1.collectionMaterials[0].id}/identification`,
    {
      operationId: randomUUID(),
      expectedUpdatedAt: date.toISOString(),
      profile,
    },
  );
  assert.equal(r.statusCode, 409);
  pass("Rejeição de edição concorrente");
  r = await api("GET", "/environmental-impact?start=2026-02-30&end=2026-03-05");
  assert.equal(r.statusCode, 400);
  pass("Datas inválidas rejeitadas");
  for (let i = 0; i < 501; i++)
    await p.collection.create({
      data: {
        cooperativeId: coop.id,
        generatorId: gen2.id,
        status: "COLLECTED",
        collectedAt: new Date("2025-12-31T23:00:00Z"),
        collectionMaterials: {
          create: {
            wasteTypeId: pp.id,
            nameSnapshot: pp.name,
            quantity: 1,
            unit: "KG",
          },
        },
      },
    });
  r = await api("GET", "/environmental-impact?start=2025-12-01&end=2026-11-30");
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json().data.totalMassKg, 611);
  assert(r.json().data.monthly.some((m: any) => m.month === "2025-12"));
  assert(r.json().data.monthly.some((m: any) => m.month === "2026-11"));
  assert.equal(r.json().data.trace.length, 50);
  pass("Paginação e intervalo entre anos sem truncar totais");
  for (const [c, itemQuantity, outQuantity] of [
    [c1, 30, 10],
    [c2, 70, 40],
  ] as const) {
    const lot = await p.wasteStockLot.create({
      data: {
        cooperativeId: coop.id,
        stockItemId: pp.id,
        lotCode: `QA-${randomUUID()}`,
        quantity: itemQuantity,
        availableQuantity: itemQuantity - outQuantity,
        originCollectionId: c.id,
        originCollectionMaterialId: c.collectionMaterials[0].id,
        unit: "KG",
      },
    });
    await p.wasteStockMovement.create({
      data: {
        cooperativeId: coop.id,
        lotId: lot.id,
        operationId: randomUUID(),
        operationHash: "qa",
        kind: "SALE",
        quantity: outQuantity,
        unit: "KG",
        actorUserId: owner.id,
        before: { availableQuantity: itemQuantity },
        after: { availableQuantity: itemQuantity - outQuantity },
        movementDate: date,
        destinationName: "Recicladora QA",
      },
    });
  }
  r = await api("GET", url);
  d = r.json().data;
  assert.equal(d.flows.dispatched.KG, 50);
  assert.equal(d.flows.currentStock.KG, 50);
  assert.equal(d.co2Kg, 200);
  pass("Saídas parciais preservam saldo sem multiplicar o potencial da coleta");
  r = await api("GET", `${url}&generatorId=${gen.id}`);
  assert.equal(r.json().data.flows.dispatched.KG, 10);
  assert.equal(r.json().data.flows.currentStock.KG, 20);
  pass("Destinações e saldo respeitam origem do gerador");
  r = await api("GET", url);
  d = r.json().data;
  const ctx = (await api("GET", "/reports/context")).json().data;
  assert.equal(
    await p.reportConfigurationRevision.count({
      where: { cooperativeId: coop.id },
    }),
    1,
  );
  pass("Metodologia preservada em revisão imutável");
  if (process.env.KATUA_IMPACT_FIXTURE)
    writeFileSync(
      process.env.KATUA_IMPACT_FIXTURE,
      JSON.stringify({
        token,
        owner,
        coop,
        gen,
        pp,
        oil,
        context: ctx,
        data: d,
      }),
      { mode: 0o600 },
    );
  console.log(JSON.stringify({ passed: checks.length, checks }));
  await app.close();
  await p.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
