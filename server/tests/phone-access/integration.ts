import { usageOverview } from "../../src/modules/analytics/usage.service";
import { participationQuery } from "../../src/modules/analytics/participation.schemas";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";
import { writeFileSync } from "node:fs";
import { buildApp } from "../../src/app";
import { prisma } from "../../src/lib/prisma";
import { hashPassword } from "../../src/utils/hash";
const mails: any[] = [];
let smtpFailure = false;
(nodemailer as any).createTransport = () => ({
  sendMail: async (m: any) => {
    if (smtpFailure) throw Error("SMTP QA");
    mails.push(m);
    return { accepted: [m.to] };
  },
  close() {},
});
async function main() {
  const url = new URL(process.env.DATABASE_URL || "");
  if (
    url.hostname !== "127.0.0.1" ||
    url.port !== "54343" ||
    process.env.KATUA_PHONE_ACCESS_TEST !== "1"
  )
    throw Error("Somente banco descartável local.");
  const app = await buildApp();
  const password = "ValidLocalPass2026";
  let seq = 0;
  const token = (id: string, role = "COOPERATIVE", authVersion = 0) =>
    app.jwt.sign({ sub: id, role, authVersion });
  const call = (
    method: "GET" | "POST" | "PATCH",
    url: string,
    payload?: any,
    id: string | null = "a",
    role = "COOPERATIVE",
  ) =>
    app.inject({
      method,
      url,
      remoteAddress: `198.51.100.${(++seq % 240) + 1}`,
      headers: id ? { authorization: `Bearer ${token(id, role)}` } : {},
      ...(payload === undefined ? {} : { payload }),
    });
  const login = async (identifier: string, legacy = false) => {
    const r = await call(
      "POST",
      "/auth/login",
      { [legacy ? "email" : "identifier"]: identifier, password },
      null,
    );
    assert.equal(r.statusCode, 200, r.body);
    return r.json();
  };
  const proof = (m: any) => ({
    token: new URL(m.text.match(/https?:\/\/\S+/)[0]).searchParams.get("token"),
    temporaryPassword: m.text.match(
      /Senha temporária para redefinição: ([A-F0-9]+)/,
    )[1],
  });
  const reset = (p: any, extra: any = {}) =>
    call(
      "POST",
      "/auth/reset-password",
      { ...p, password, confirmPassword: password, ...extra },
      null,
    );
  const forgot = (
    identifier: string,
    identifierType: string,
    audience = "APP",
  ) =>
    call(
      "POST",
      "/auth/forgot-password",
      { identifier, identifierType, audience },
      null,
    );
  const clear = () => prisma.authEmailToken.deleteMany({});
  try {
    for (const id of ["a", "b"]) {
      const phone = id === "a" ? "85988880001" : "85988880002";
      await prisma.user.create({
        data: {
          id,
          email: `${id}@qa.invalid`,
          phone,
          passwordHash: await hashPassword(password),
          displayName: id,
          role: "COOPERATIVE",
        },
      });
      await prisma.cooperative.create({
        data: {
          id: `coop-${id}`,
          userId: id,
          name: id,
          email: `${id}@qa.invalid`,
          phone,
        },
      });
    }
    await login("a@qa.invalid");
    await login("+55 (85) 98888-0001");
    await login("85988880001", true);
    assert.equal(
      (await prisma.user.findUniqueOrThrow({ where: { id: "legacy-user" } }))
        .credentialsReady,
      true,
    );
    const offlineBody={operationId:"00000000-0000-4000-8000-000000000123",kind:"GENERATOR_CREATE",data:{type:"SMALL",name:"Gerador mínimo pela fila",state:"CE",street:"",city:"",address:"",phone:"85999991009",recoveryEmail:"queue@recovery.qa.invalid"}};
    const offline=await call("POST","/mobile-offline/operations",offlineBody);
    assert.equal(offline.statusCode,201,offline.body);
    assert.equal(offline.json().entity.email,null);assert.equal(offline.json().entity.latitude,null);assert.equal(offline.json().entity.recoveryEmail,"queue@recovery.qa.invalid");
    const replay=await call("POST","/mobile-offline/operations",offlineBody);
    assert.equal(replay.statusCode,200,replay.body);assert.equal(replay.json().entity.id,offline.json().entity.id);
    const g = await call("POST", "/generators", {
      type: "SMALL",
      name: "Gerador sem e-mail",
      phone: "(85) 99999-1001",
      recoveryEmail: "central@recovery.qa.invalid",
      documentNumber: "52998224725",
    });
    assert.equal(g.statusCode, 201, g.body);
    const gen = g.json().generator;
    const c = await call("POST", "/collectors", {
      name: "Catador rodízio",
      phone: "+55 85 99999-1002",
      recoveryEmail: "central@recovery.qa.invalid",
      cpf: "11144477735",
    });
    assert.equal(c.statusCode, 201, c.body);
    const col = c.json().collector;
    const access = (
      kind: string,
      id: string,
      who: string | null = "a",
      payload?: any,
    ) => call("POST", `/registrations/${kind}/${id}/access-link`, payload, who);
    assert.equal((await access("generators", gen.id, "b")).statusCode, 404);
    assert.equal((await access("collectors", col.id, null)).statusCode, 401);
    assert.equal(
      (
        await access("generators", gen.id, "a", {
          recoveryEmail: "other@qa.invalid",
        })
      ).statusCode,
      400,
    );
    for (const [kind, id] of [
      ["generators", gen.id],
      ["collectors", col.id],
    ]) {
      const r = await access(kind, id);
      assert.equal(r.statusCode, 200, r.body);
    }
    assert.equal(mails.length, 2);
    assert(mails.every((m) => m.to === "central@recovery.qa.invalid"));
    const pending = await prisma.generator.findUniqueOrThrow({
      where: { id: gen.id },
      include: { user: true },
    });
    assert.equal(pending.user!.email, null);
    assert.equal(pending.user!.credentialsReady, false);
    const usage=await usageOverview("a",participationQuery.parse({start:"2026-11-01",end:"2026-11-12"}));
    assert.equal(usage.summary.accounts,1,"Contas sem senha definida não contam como acesso ativado");
    assert.equal(
      (
        await call(
          "GET",
          "/auth/me",
          undefined,
          pending.userId!,
          "GENERATOR_SMALL",
        )
      ).statusCode,
      401,
    );
    const detail = (await call("GET", `/generators/${gen.id}`)).json()
      .generator;
    assert.equal(detail.hasOnlineAccess, false);
    assert.equal(detail.accessActivationPending, true);
    const gp = proof(mails[0]);
    assert.equal((await reset(gp)).statusCode, 200);
    assert.equal((await reset(gp)).statusCode, 400);
    const gl = await login("85999991001");
    assert.equal(gl.user.email, null);
    assert.equal(gl.user.id, pending.userId);
    assert.equal((await reset(proof(mails[1]))).statusCode, 200);
    assert.equal((await login("+5585999991002")).user.role, "COLLECTOR");
    assert.equal(
      (
        await call(
          "GET",
          "/auth/me",
          undefined,
          pending.userId!,
          "GENERATOR_SMALL",
        )
      ).statusCode,
      401,
    );
    await clear();
    let before = mails.length;
    assert.equal((await forgot("111.444.777-35", "CPF")).statusCode, 200);
    assert.equal(mails.length, before + 1);
    const old = proof(mails.at(-1));
    assert.equal(
      (
        await call("PATCH", `/collectors/${col.id}`, {
          recoveryEmail: "new@recovery.qa.invalid",
        })
      ).statusCode,
      200,
    );
    assert.equal((await reset(old)).statusCode, 400);
    await clear();
    await forgot("85999991002", "PHONE");
    assert.equal(mails.at(-1).to, "new@recovery.qa.invalid");
    const latest = proof(mails.at(-1));
    for (let i = 0; i < 5; i++)
      assert.equal(
        (await reset(latest, { temporaryPassword: "WRONG" })).statusCode,
        400,
      );
    assert.equal((await reset(latest)).statusCode, 400);
    await clear();
    const known = await forgot("85999991002", "PHONE");
    before = mails.length;
    const unknown = await forgot("85999999999", "PHONE");
    assert.deepEqual(known.json(), unknown.json());
    assert.equal(mails.length, before);
    await forgot("new@recovery.qa.invalid", "EMAIL");
    assert.equal(mails.length, before);
    await forgot("11144477735", "CPF", "PANEL");
    assert.equal(mails.length, before);
    await prisma.user.create({
      data: {
        id: "duplicate",
        email: "duplicate@qa.invalid",
        phone: "85 99999-1002",
        passwordHash: await hashPassword(password),
        displayName: "Outro",
        role: "PF",
      },
    });
    assert.equal(
      (
        await call(
          "POST",
          "/auth/login",
          { identifier: "85999991002", password },
          null,
        )
      ).statusCode,
      400,
    );
    await login("duplicate@qa.invalid");
    await clear();
    before = mails.length;
    await forgot("85999991002", "PHONE");
    assert.equal(mails.length, before);
    await clear();
    smtpFailure = true;
    assert.equal((await forgot("52998224725", "CPF")).statusCode, 400);
    assert.equal(await prisma.authEmailToken.count(), 0);
    smtpFailure = false;
    await clear();
    await forgot("52998224725", "CPF");
    const expired = proof(mails.at(-1));
    await prisma.authEmailToken.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    assert.equal((await reset(expired)).statusCode, 400);
    const events = await prisma.registrationAccessEvent.findMany({
      where: { recordId: col.id },
    });
    assert(events.some((e) => e.action === "RECOVERY_CONTACT_CHANGED"));
    assert(events.some((e) => e.action === "ACCESS_PREPARED"));
    assert(!JSON.stringify(events).includes(gp.token));
    const field = (await call("GET", "/cooperative-field/collectors")).json();
    assert(
      field.items.some(
        (r: any) =>
          r.id === col.id && r.recoveryEmail === "new@recovery.qa.invalid",
      ),
    );
    const fieldDetail = (
      await call("GET", `/cooperative-field/generators/${gen.id}`)
    ).json();
    assert.equal(fieldDetail.item.hasOnlineAccess, true);
    for(let i=0;i<22;i++) {
      const r=await app.inject({method:"POST",url:"/auth/login",remoteAddress:"203.0.113.1",payload:{identifier:`unknown-${i}@qa.invalid`,password}});
      assert.equal(r.statusCode,400,"Logins de usuários diferentes não compartilham o limite no Wi-Fi da cooperativa");
    }
    for(let i=0;i<21;i++) {
      const r=await app.inject({method:"POST",url:"/auth/login",remoteAddress:"203.0.113.2",payload:{identifier:"limited@qa.invalid",password}});
      assert.equal(r.statusCode,i<20?400:429);
    }
    if (process.env.KATUA_PHONE_FIXTURE)
      writeFileSync(
        process.env.KATUA_PHONE_FIXTURE,
        JSON.stringify({
          user: {
            id: "a",
            email: "a@qa.invalid",
            phone: "85988880001",
            displayName: "Cooperativa QA",
            role: "COOPERATIVE",
            cooperative: { email: "a@qa.invalid" },
          },
          generator: (await call("GET", `/generators/${gen.id}`)).json()
            .generator,
          collector: (await call("GET", `/collectors/${col.id}`)).json()
            .collector,
        }),
      );
    console.log(
      "PASS: legacy email/phone login, enrollment without personal email, pending-account guard, one-use recovery, CPF/phone lookup, shared recipient, contact/old-session revocation, SMTP failure, token guessing limit, ambiguity refusal, tenant isolation, app field metadata, secret-free audit",
    );
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
