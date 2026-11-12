import assert from "node:assert/strict";
import { buildApp } from "../../src/app";
import { prisma } from "../../src/lib/prisma";
import { writeFileSync } from "node:fs";
async function main() {
  const url = new URL(process.env.DATABASE_URL || "");
  if (
    url.hostname !== "127.0.0.1" ||
    url.port !== "54341" ||
    process.env.KATUA_QUICK_REGISTRATION_TEST !== "1"
  )
    throw Error("Somente banco descartável local.");
  const app = await buildApp();
  try {
    for (const id of ["a", "b"]) {
      await prisma.user.create({
        data: {
          id,
          email: `${id}@qa.invalid`,
          passwordHash: "unused",
          displayName: id,
          role: "COOPERATIVE",
        },
      });
      await prisma.cooperative.create({
        data: { id: `coop-${id}`, userId: id, name: id },
      });
    }
    await prisma.user.create({
      data: {
        id: "pf",
        email: "pf@qa.invalid",
        passwordHash: "unused",
        displayName: "Pessoa",
        role: "PF",
      },
    });
    const token = (sub: string, role = "COOPERATIVE") =>
      app.jwt.sign({ sub, role, authVersion: 0 });
    const auth = token("a");
    const call = (
      method: "GET" | "POST" | "PATCH",
      url: string,
      body?: unknown,
      login = auth,
    ) =>
      app.inject({
        method,
        url,
        headers: login ? { authorization: `Bearer ${login}` } : {},
        ...(body === undefined ? {} : { payload: body as any }),
      });
    const count = await prisma.user.count();
    const created = async (path: string, name: string) => {
      const response = await call("POST", path, {
        name,
        ...(path === "/generators" ? { type: "SMALL" } : {}),
      });
      assert.equal(response.statusCode, 201, response.body);
      const r =
        response.json()[path === "/generators" ? "generator" : "collector"];
      assert.equal(r.email, null);
      assert.equal(r.userId, null);
      assert.equal(r.cooperativeId, "coop-a");
      assert.equal(r.registrationStatus, "TO_COMPLETE");
      assert.equal(r.hasOnlineAccess, false);
      assert(r.missingRegistrationFields.includes("email"));
      return r;
    };
    const gen = await created("/generators", "Mercado do bairro");
    const gen2 = await created("/generators", "Outro gerador");
    const col = await created("/collectors", "Catadora de teste");
    const col2 = await created("/collectors", "Outro catador");
    assert.notEqual(gen.id, gen2.id);
    assert.notEqual(col.id, col2.id);
    assert.equal(await prisma.user.count(), count);
    assert.equal(
      (await call("GET", `/generators/${gen.id}`, undefined, token("b")))
        .statusCode,
      404,
    );
    assert.equal(
      (
        await call(
          "PATCH",
          `/generators/${gen.id}`,
          { name: "Indevido" },
          token("b"),
        )
      ).statusCode,
      404,
    );
    assert.notEqual(
      (await call("GET", `/collectors/${col.id}`, undefined, token("b")))
        .statusCode,
      200,
    );
    assert.notEqual(
      (
        await call(
          "PATCH",
          `/collectors/${col.id}`,
          { name: "Indevido" },
          token("b"),
        )
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await call(
          "POST",
          "/generators",
          { name: "Indevido", type: "SMALL" },
          token("pf", "PF"),
        )
      ).statusCode,
      403,
    );
    assert.equal(
      (await call("POST", "/collectors", { name: "Indevido" }, "")).statusCode,
      401,
    );
    for (const path of ["/generators", "/collectors"]) {
      assert.equal(
        (await call("POST", path, { name: "A", type: "SMALL" })).statusCode,
        400,
      );
      assert.equal(
        (
          await call("POST", path, {
            name: "Teste",
            type: "SMALL",
            email: "inválido",
          })
        ).statusCode,
        400,
      );
      const invalid =
        path === "/generators"
          ? { documentNumber: "11111111111" }
          : { cpf: "11111111111" };
      assert.equal(
        (
          await call(
            "PATCH",
            `${path}/${path === "/generators" ? gen.id : col.id}`,
            invalid,
          )
        ).statusCode,
        400,
      );
    }
    const enriched = await call("PATCH", `/generators/${gen.id}`, {
      email: "  MERCADO@QA.INVALID  ",
      documentNumber: "529.982.247-25",
      phone: "85999990000",
      address: "Rua da cooperativa, 100",
    });
    assert.equal(enriched.statusCode, 200, enriched.body);
    assert.equal(enriched.json().generator.registrationStatus, "COMPLETE");
    assert.equal(enriched.json().generator.email, "mercado@qa.invalid");
    assert.equal(enriched.json().generator.hasOnlineAccess, false);
    const blankDocument = await call("PATCH", `/generators/${gen.id}`, {
      name: "Mercado do bairro",
      documentNumber: "",
      email: "",
    });
    assert.equal(blankDocument.statusCode, 200, blankDocument.body);
    assert.equal(blankDocument.json().generator.documentNumber, "52998224725");
    assert.equal(blankDocument.json().generator.email, "mercado@qa.invalid");
    assert.equal(
      (
        await call("POST", "/collectors", {
          name: "Mesmo email",
          email: "mercado@qa.invalid",
        })
      ).statusCode,
      400,
    );
    const completed = await call("PATCH", `/collectors/${col.id}`, {
      email: "catadora@qa.invalid",
      cpf: "11144477735",
      phone: "85999991111",
      address: "Rua da cooperativa, 200",
    });
    assert.equal(completed.statusCode, 200, completed.body);
    assert.equal(completed.json().collector.registrationStatus, "COMPLETE");
    assert.equal(await prisma.user.count(), count);
    assert.equal(
      (
        await call("POST", "/generators", {
          name: "Mesmo email",
          type: "SMALL",
          email: "catadora@qa.invalid",
        })
      ).statusCode,
      400,
    );
    const schedule = await call("POST", "/schedules", {
      generatorId: gen2.id,
      pickupAddress: "Endereço informado na coleta",
      requestedMaterials: ["PAPEL"],
    });
    assert.equal(schedule.statusCode, 201, schedule.body);
    const operation = await prisma.collection.create({
      data: {
        cooperativeId: "coop-a",
        generatorId: gen2.id,
        collectorId: col2.id,
        status: "PENDING",
      },
    });
    assert.equal(operation.generatorId, gen2.id);
    assert.equal(operation.collectorId, col2.id);
    const legacy = await call("PATCH", "/collectors/legacy-col", {
      name: "Indevido",
    });
    assert.notEqual(legacy.statusCode, 200);
    // Blank optional email must not erase a linked login or an already-filled email.
    const blank = await call("PATCH", `/collectors/${col.id}`, {
      name: "Catadora revisada",
      email: "",
    });
    assert.equal(blank.statusCode, 200, blank.body);
    assert.equal(blank.json().collector.email, "catadora@qa.invalid");
    const activeUser = await prisma.user.create({
      data: {
        email: "linked@qa.invalid",
        passwordHash: "unused",
        displayName: "Linked",
        role: "GENERATOR_SMALL",
      },
    });
    const linked = await prisma.generator.create({
      data: {
        name: "Ativo",
        type: "SMALL",
        email: activeUser.email,
        userId: activeUser.id,
        cooperativeId: "coop-a",
        accessReleased: true,
        accessStatus: "ACTIVE",
      },
    });
    assert.equal(
      (
        await call("PATCH", `/generators/${linked.id}`, {
          email: "different@qa.invalid",
        })
      ).statusCode,
      400,
    );
    assert.equal(
      (
        await call("PATCH", `/generators/${gen2.id}`, {
          email: "mercado@qa.invalid",
        })
      ).statusCode,
      409,
    );
    const list = (await call("GET", "/generators")).json().generators;
    assert(list.some((r: any) => r.id === gen2.id && r.email === null));
    if (process.env.KATUA_QUICK_FIXTURE)
      writeFileSync(
        process.env.KATUA_QUICK_FIXTURE,
        JSON.stringify({
          generators: list,
          collectors: (await call("GET", "/collectors")).json().collectors,
        }),
      );
    console.log(
      "PASS: name-only registrations, multiple null emails/documents, validation, completion without activation, blank email preservation, linked login protection, cross-profile uniqueness, tenant isolation, scheduling and operational assignment",
    );
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
