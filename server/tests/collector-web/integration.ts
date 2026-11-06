import { documentSearchTests } from "./document-search.integration";
import { dispatchTests } from "./stock-dispatch.integration";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/prisma";
import { buildApp } from "../../src/app";
import { extraOrderPayload } from "../../src/modules/extra-collection-orders/extra-order.schemas";
import {
  selectGenerator,
  clearOrigin,
  originError,
} from "../../../src/screens/extra-orders/collectorOrderHelpers";
async function main() {
  const url = new URL(process.env.DATABASE_URL || "");
  if (
    process.env.KATUA_COLLECTOR_LOCAL !== "1" ||
    url.hostname !== "127.0.0.1" ||
    url.port !== "54329"
  )
    throw Error("Somente banco descartável local permitido.");
  const app = await buildApp();
  let count = 0;
  async function test(name: string, fn: () => Promise<void> | void) {
    await fn();
    count++;
    console.log("PASS", name);
  }
  try {
    for (const [id, role] of [
      ["coop-user", "COOPERATIVE"],
      ["collector-user", "COLLECTOR"],
      ["other-user", "COOPERATIVE"],
      ["driver-user", "DRIVER"],
    ] as const)
      await prisma.user.create({
        data: {
          id,
          email: `${id}@qa.invalid`,
          displayName: id,
          passwordHash: "unused",
          role,
        },
      });
    await prisma.cooperative.create({
      data: { id: "coop", userId: "coop-user", name: "Coop QA" },
    });
    await prisma.cooperative.create({
      data: { id: "other", userId: "other-user", name: "Outra" },
    });
    await prisma.collector.create({
      data: {
        id: "collector",
        userId: "collector-user",
        cooperativeId: "coop",
        name: "Catador QA",
        email: "collector@qa.invalid",
      },
    });
    const generator = await prisma.generator.create({
      data: {
        id: "generator",
        cooperativeId: "coop",
        name: "Maria QA",
        companyName: "Loja QA",
        email: "gen@qa.invalid",
        type: "SMALL",
        phone: "85900001111",
        street: "Rua QA",
        number: "42",
        neighborhood: "Centro",
        city: "Fortaleza",
        state: "CE",
        zipCode: "60000000",
        address: "Rua QA, 42",
        latitude: -3.7,
        longitude: -38.5,
      },
    });
    await prisma.generator.create({
      data: {
        id: "foreign",
        cooperativeId: "other",
        name: "Fora",
        email: "foreign@qa.invalid",
        type: "SMALL",
      },
    });
    const item = await prisma.wasteStockItem.create({
      data: {
        id: "item",
        cooperativeId: "coop",
        name: "Papel QA",
        category: "Papel",
        unit: "KG",
        defaultUnit: "KG",
      },
    });
    const token = (role: string, sub: string) =>
      app.jwt.sign({ role, sub, authVersion: 0 });
    const collector = token("COLLECTOR", "collector-user"),
      manager = token("COOPERATIVE", "coop-user");
    const call = async (
      method: string,
      url: string,
      payload?: unknown,
      bearer = collector,
    ) => {
      const r = await app.inject({
        method: method as any,
        url,
        headers: bearer ? { authorization: `Bearer ${bearer}` } : {},
        ...(payload ? { payload: payload as any } : {}),
      });
      return { status: r.statusCode, body: r.json() };
    };
    const ok = (r: any, status: number) =>
      assert.equal(r.status, status, JSON.stringify(r.body));
    await prisma.wasteStockItem.createMany({
      data: [
        {
          id: "foreign-catalog",
          cooperativeId: "other",
          name: "Material de outra cooperativa",
          category: "Papel",
          unit: "KG",
          defaultUnit: "KG",
        },
        {
          id: "inactive-catalog",
          cooperativeId: "coop",
          name: "Material inativo",
          category: "Papel",
          unit: "KG",
          defaultUnit: "KG",
          status: "INACTIVE",
        },
        {
          id: "hidden-catalog",
          cooperativeId: "coop",
          name: "Material desativado",
          category: "Papel",
          unit: "KG",
          defaultUnit: "KG",
          isActive: false,
        },
      ],
    });
    await test("catálogo: catador autenticado consulta apenas materiais ativos da própria cooperativa", async () => {
      const r = await call("GET", "/waste-stock/catalog");
      ok(r, 200);
      assert.deepEqual(
        r.body.items.map((m: any) => m.id),
        ["item"],
      );
    });
    await test("catálogo: indicar outra cooperativa é bloqueado; indicar a própria funciona", async () => {
      ok(await call("GET", "/waste-stock/catalog?cooperativeId=other"), 403);
      ok(await call("GET", "/waste-stock/catalog?cooperativeId=coop"), 200);
    });
    await test("catálogo: pesquisa não encontra materiais de outras cooperativas", async () => {
      const r = await call("GET", "/waste-stock/catalog?search=outra");
      ok(r, 200);
      assert.equal(r.body.items.length, 0);
    });
    await test("catálogo: não expõe lotes, saldos ou quantidades de estoque", async () => {
      const r = await call("GET", "/waste-stock/catalog");
      ok(r, 200);
      for (const m of r.body.items)
        for (const key of [
          "lots",
          "totalQuantity",
          "availableQuantity",
          "quantityKg",
          "movements",
        ])
          assert.equal(key in m, false);
    });
    await test("catálogo: leitura não libera endpoints administrativos ao catador", async () => {
      for (const url of [
        "/waste-stock/items",
        "/waste-stock/items/item",
        "/waste-stock/items/item/lots",
      ])
        ok(await call("GET", url), 403);
      ok(
        await call("POST", "/waste-stock/items", {
          name: "Material indevido",
          category: "Papel",
          unit: "KG",
          defaultUnit: "KG",
        }),
        403,
      );
      assert.equal(
        await prisma.wasteStockItem.count({
          where: { name: "Material indevido" },
        }),
        0,
      );
    });
    await test("catálogo: JWT ausente ou inválido continua bloqueado", async () => {
      ok(await call("GET", "/waste-stock/catalog", undefined, ""), 401);
      ok(await call("GET", "/waste-stock/catalog", undefined, "invalid"), 401);
    });
    await test("catálogo: catador sem vínculo e catador inativo continuam bloqueados", async () => {
      await prisma.collector.update({
        where: { id: "collector" },
        data: { cooperativeId: null },
      });
      try {
        ok(await call("GET", "/waste-stock/catalog"), 403);
      } finally {
        await prisma.collector.update({
          where: { id: "collector" },
          data: { cooperativeId: "coop" },
        });
      }
      await prisma.collector.update({
        where: { id: "collector" },
        data: { status: "INACTIVE" },
      });
      try {
        ok(await call("GET", "/waste-stock/catalog"), 403);
      } finally {
        await prisma.collector.update({
          where: { id: "collector" },
          data: { status: "AVAILABLE" },
        });
      }
    });
    await test("catálogo: motorista não ganha acesso e cooperativa mantém sua consulta", async () => {
      ok(
        await call(
          "GET",
          "/waste-stock/catalog",
          undefined,
          token("DRIVER", "driver-user"),
        ),
        403,
      );
      const r = await call("GET", "/waste-stock/catalog", undefined, manager);
      ok(r, 200);
      assert.deepEqual(
        r.body.items.map((m: any) => m.id),
        ["item"],
      );
    });
    const payload: any = {
      mode: "COLLECTED",
      originType: "GENERATOR",
      generatorId: "generator",
      originName: "Loja QA",
      pickupAddress: "Rua QA, 42, Centro",
      occurredAt: new Date(Date.now() - 60000).toISOString(),
      custody: "COLLECTOR",
      materials: [{ wasteTypeId: item.id, unit: "KG" }],
      photos: [],
    };
    await test("motivo e notas opcionais; coleta sem quantidade aceita sem inventar valor", () => {
      const p = extraOrderPayload.parse(payload);
      assert.equal(p.reasonNotes, "");
      assert.equal(p.custodyNotes, "");
      assert.equal(p.materials[0].quantity, undefined);
    });
    await test("quantidade negativa, coordenada incompleta e data futura continuam bloqueadas", () => {
      for (const change of [
        { materials: [{ wasteTypeId: item.id, unit: "KG", quantity: -1 }] },
        { latitude: -3.7 },
        { occurredAt: new Date(Date.now() + 86400000).toISOString() },
      ])
        assert.equal(
          extraOrderPayload.safeParse({ ...payload, ...change }).success,
          false,
        );
    });
    await test("local de guarda diferente exige explicação e solicitação futura fica na origem", () => {
      assert.equal(
        extraOrderPayload.safeParse({ ...payload, custody: "OTHER" }).success,
        false,
      );
      assert.equal(
        extraOrderPayload.safeParse({
          ...payload,
          mode: "REQUESTED",
          occurredAt: undefined,
        }).success,
        false,
      );
    });
    await test("preenchimento do gerador inclui contato, endereço detalhado e coordenadas sem alterar fonte", () => {
      const copy = JSON.stringify(generator);
      const mapped = selectGenerator(payload, generator as any);
      assert.equal(mapped.payload.contactPhone, "85900001111");
      assert.equal(mapped.draft.number, "42");
      assert.equal(mapped.draft.city, "Fortaleza");
      assert.equal(mapped.payload.latitude, -3.7);
      assert.equal(mapped.payload.originName, "Loja QA");
      assert.equal(JSON.stringify(generator), copy);
      assert.equal(originError(mapped.payload), "");
    });
    await test("troca de origem limpa vínculo, endereço e coordenadas antigos", () => {
      const cleared = clearOrigin(payload, "PF");
      assert.equal(cleared.generatorId, undefined);
      assert.equal(cleared.pickupAddress, "");
      assert.equal(cleared.latitude, undefined);
      assert(originError(cleared));
    });
    await test("contexto fornece dados completos só da cooperativa e preserva restrição JWT/RBAC", async () => {
      ok(
        await call("GET", "/extra-collection-orders/context", undefined, ""),
        401,
      );
      ok(
        await call(
          "GET",
          "/extra-collection-orders/context",
          undefined,
          token("DRIVER", "driver-user"),
        ),
        403,
      );
      const r = await call("GET", "/extra-collection-orders/context");
      ok(r, 200);
      assert.deepEqual(
        r.body.generators.map((g: any) => g.id),
        ["generator"],
      );
      assert.equal(r.body.generators[0].phone, "85900001111");
      assert.equal(r.body.generators[0].neighborhood, "Centro");
      assert.equal(r.body.generators[0].documentNumber, undefined);
    });
    const id = randomUUID();
    await test("nova OC sem motivo/quantidade persiste para análise e reenvio é idempotente", async () => {
      const input = { id, cooperativeId: "coop", payload };
      const first = await call("POST", "/extra-collection-orders", input);
      ok(first, 201);
      const second = await call("POST", "/extra-collection-orders", input);
      ok(second, 201);
      assert.equal(await prisma.extraCollectionOrder.count(), 1);
      assert.equal(first.body.order.payload.reasonNotes, "");
    });
    await test("referência a gerador de outra cooperativa continua bloqueada", async () => {
      ok(
        await call("POST", "/extra-collection-orders", {
          id: randomUUID(),
          cooperativeId: "coop",
          payload: { ...payload, generatorId: "foreign" },
        }),
        400,
      );
    });
    await test("aprovação sem pesagem gera material pendente com zero e informado nulo; totais não recebem 1 kg fictício", async () => {
      const approved = await call(
        "POST",
        `/extra-collection-orders/${id}/review`,
        {
          operationId: randomUUID(),
          expectedRevision: 1,
          decision: "ACCEPT",
          notes: "",
        },
        manager,
      );
      ok(approved, 200);
      const col = await prisma.collection.findUniqueOrThrow({
        where: { id: approved.body.order.collectionId },
        include: { collectionMaterials: true },
      });
      assert.equal(col.status, "COLLECTED");
      assert.equal(col.totalWeightKg, 0);
      assert.equal(Number(col.collectionMaterials[0].quantity), 0);
      assert.equal(col.collectionMaterials[0].reportedQuantity, null);
      assert.equal((col.materials as any)[0].quantityPending, true);
      assert.equal(
        (
          await prisma.collector.findUniqueOrThrow({
            where: { id: "collector" },
          })
        ).totalKg,
        0,
      );
      assert.equal(await prisma.wasteStockLot.count(), 0);
    });
    await test("recebimento continua exclusivo da cooperativa e não cria pesagem automática", async () => {
      ok(
        await call("POST", `/extra-collection-orders/${id}/receive`, {
          operationId: randomUUID(),
          receivedAt: new Date().toISOString(),
          notes: "",
        }),
        403,
      );
      const received = await call(
        "POST",
        `/extra-collection-orders/${id}/receive`,
        {
          operationId: randomUUID(),
          receivedAt: new Date().toISOString(),
          notes: "",
        },
        manager,
      );
      ok(received, 200);
      const col = await prisma.collection.findUniqueOrThrow({
        where: { id: received.body.order.collectionId },
      });
      assert.equal(col.status, "RECEIVED");
      assert.equal(col.totalWeightKg, 0);
    });
    await test("pesagem posterior atualiza peso real, remove pendência e mantém auditoria", async () => {
      const order = await prisma.extraCollectionOrder.findUniqueOrThrow({
        where: { id },
      });
      const col = await prisma.collection.findUniqueOrThrow({
        where: { id: order.collectionId! },
        include: { collectionMaterials: true },
      });
      const reviewed = await call(
        "POST",
        `/collections/${col.id}/review-quantities`,
        {
          expectedVersion: 0,
          reason: "",
          items: [{ materialId: col.collectionMaterials[0].id, quantity: 8 }],
        },
        manager,
      );
      ok(reviewed, 200);
      const updated = await prisma.collection.findUniqueOrThrow({
        where: { id: col.id },
      });
      assert.equal(updated.totalWeightKg, 8);
      assert.equal((updated.materials as any)[0].quantityPending, undefined);
      assert.equal(updated.quantityReviewVersion, 1);
      const latest = await call("GET", `/extra-collection-orders/${id}`);
      ok(latest, 200);
      assert.equal(latest.body.order.collection.quantityReviewVersion, 1);
      assert.equal(
        Number(latest.body.order.collection.collectionMaterials[0].quantity),
        8,
      );
      assert.equal(
        (
          await prisma.collector.findUniqueOrThrow({
            where: { id: "collector" },
          })
        ).totalKg,
        8,
      );
    });
    await test("quantidade informada continua preservada na aprovação", async () => {
      const knownId = randomUUID();
      ok(
        await call("POST", "/extra-collection-orders", {
          id: knownId,
          cooperativeId: "coop",
          payload: {
            ...payload,
            reasonNotes: "Retirada extra solicitada.",
            custodyNotes: "Com o catador.",
            materials: [{ wasteTypeId: item.id, unit: "KG", quantity: 3 }],
          },
        }),
        201,
      );
      const approved = await call(
        "POST",
        `/extra-collection-orders/${knownId}/review`,
        {
          operationId: randomUUID(),
          expectedRevision: 1,
          decision: "ACCEPT",
          notes: "Conferido e aprovado.",
        },
        manager,
      );
      ok(approved, 200);
      const col = await prisma.collection.findUniqueOrThrow({
        where: { id: approved.body.order.collectionId },
      });
      assert.equal(col.totalWeightKg, 3);
      ok(
        await call("POST", `/collections/${col.id}/receive`, {}, manager),
        200,
      );
      const current = await prisma.collection.findUniqueOrThrow({
        where: { id: col.id },
        include: { collectionMaterials: true },
      });
      const diverged = await call(
        "POST",
        `/collections/${col.id}/review-quantities`,
        {
          expectedVersion: 0,
          reason: "",
          items: [
            { materialId: current.collectionMaterials[0].id, quantity: 4 },
          ],
        },
        manager,
      );
      ok(diverged, 400);
    });
    await test("endereço vazio é permitido só para origem sem cadastro e nome continua obrigatório", () => {
      const manual={...payload,originType:"PF",generatorId:undefined,pickupAddress:""};
      assert.equal(extraOrderPayload.parse(manual).pickupAddress,"");
      assert.equal(extraOrderPayload.parse({...manual,pickupAddress:undefined}).pickupAddress,"");
      assert.equal(originError(manual),"");
      assert(!extraOrderPayload.safeParse({...manual,originName:""}).success);
      assert(!extraOrderPayload.safeParse({...manual,pickupAddress:"abc"}).success);
      assert(!extraOrderPayload.safeParse({...payload,pickupAddress:""}).success);
      assert(originError({...payload,pickupAddress:""}));
    });
    await test("API registra e aprova solicitação e coleta realizada sem endereço de origem não cadastrada", async () => {
      for (const mode of ["REQUESTED","COLLECTED"]) {
        const id=randomUUID();
        const manual={...payload,mode,originType:"PF",generatorId:undefined,pickupAddress:"",custody:mode==="REQUESTED"?"ORIGIN":"COLLECTOR",occurredAt:mode==="COLLECTED"?payload.occurredAt:undefined};
        const created=await call("POST","/extra-collection-orders",{id,cooperativeId:"coop",payload:manual});ok(created,201);
        assert.equal(created.body.order.payload.pickupAddress,"");
        const approved=await call("POST",`/extra-collection-orders/${id}/review`,{operationId:randomUUID(),expectedRevision:1,decision:"ACCEPT"},manager);ok(approved,200);
        const collection=await prisma.collection.findUniqueOrThrow({where:{id:approved.body.order.collectionId},include:{schedule:true}});
        assert.equal(collection.schedule!.pickupAddress,"");
      }
    });
    await dispatchTests(call, manager, collector, token("COOPERATIVE", "other-user"), test);
    await documentSearchTests(call, manager, collector, token("COOPERATIVE", "other-user"), test);
    console.log(`${count} testes de integração aprovados`);
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
