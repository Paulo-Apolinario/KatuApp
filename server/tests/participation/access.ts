import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import {
  AnalyticsAccess,
  AnalyticsAccessError,
} from "../../src/modules/analytics/access.service";
const grants = new WeakMap<FastifyInstance, Map<string, Promise<string>>>();
const password = () => {
  const value = process.env.KATUA_TEST_ANALYTICS_PASSWORD;
  if (!value)
    throw Error("Informe KATUA_TEST_ANALYTICS_PASSWORD para os testes locais.");
  return value;
};
export async function analyticsGet(
  app: FastifyInstance,
  url: string,
  login: string,
) {
  let cache = grants.get(app);
  if (!cache) {
    cache = new Map();
    grants.set(app, cache);
  }
  if (login && !cache.has(login))
    cache.set(
      login,
      (async () => {
        const response = await app.inject({
          method: "POST",
          url: "/analytics/access/unlock",
          headers: { authorization: `Bearer ${login}` },
          payload: { password: password() },
        });
        return response.json().data?.token || "";
      })(),
    );
  const grant = login ? await cache.get(login) : "";
  return app.inject({
    method: "GET",
    url,
    headers: {
      ...(login ? { authorization: `Bearer ${login}` } : {}),
      ...(grant ? { "x-analytics-access": grant } : {}),
    },
  });
}
export async function testAccess(app: FastifyInstance) {
  const login = app.jwt.sign({ sub: "a", role: "COOPERATIVE", authVersion: 0 });
  const headers = { authorization: `Bearer ${login}` };
  for (const path of [
    "context",
    "overview",
    "participants",
    "participants/GENERATOR/old",
    "attendance",
    "usage",
    "territory",
    "generators",
    "collectors",
    "coverage/GENERATOR",
    "coverage/GENERATOR/old",
    "requests/ALL",
    "quality/unweighed",
    "comparison",
    "executive",
  ]) {
    const r = await app.inject({
      method: "GET",
      url: `/analytics/participation/${path}`,
      headers,
    });
    assert.equal(r.statusCode, 403, path);
    assert.equal(r.json().code, "ANALYTICS_LOCKED");
    assert.equal(r.headers["cache-control"], "private, no-store");
  }
  const unlock = (body: unknown, h = headers) =>
    app.inject({
      method: "POST",
      url: "/analytics/access/unlock",
      headers: h,
      payload: body as any,
    });
  assert.equal(
    (await unlock({ password: "wrong" })).json().code,
    "ANALYTICS_BAD_PASSWORD",
  );
  assert.equal((await unlock({ password: "x".repeat(129) })).statusCode, 400);
  const pf = app.jwt.sign({ sub: "pf", role: "PF", authVersion: 0 });
  assert.equal(
    (await unlock({ password: password() }, { authorization: `Bearer ${pf}` }))
      .statusCode,
    403,
  );
  const result = await unlock({ password: password() });
  assert.equal(result.statusCode, 200, result.body);
  const token = result.json().data.token;
  assert.equal(token.length, 64);
  const h = { ...headers, "x-analytics-access": token };
  assert.equal(
    (
      await app.inject({
        method: "GET",
        url: "/analytics/access/status",
        headers: h,
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await app.inject({
        method: "GET",
        url: "/analytics/participation/context",
        headers: { ...headers, "x-analytics-access": "x".repeat(64) },
      })
    ).statusCode,
    403,
  );
  const secondLogin = app.jwt.sign({
    sub: "a",
    role: "COOPERATIVE",
    authVersion: 0,
    jti: "different-login",
  });
  assert.equal(
    (
      await app.inject({
        method: "GET",
        url: "/analytics/access/status",
        headers: { ...h, authorization: `Bearer ${secondLogin}` },
      })
    ).statusCode,
    403,
  );
  const other = app.jwt.sign({ sub: "b", role: "COOPERATIVE", authVersion: 0 });
  assert.equal(
    (
      await app.inject({
        method: "GET",
        url: "/analytics/access/status",
        headers: { ...h, authorization: `Bearer ${other}` },
      })
    ).statusCode,
    403,
  );
  await app.inject({
    method: "POST",
    url: "/analytics/access/lock",
    headers: h,
  });
  assert.equal(
    (
      await app.inject({
        method: "GET",
        url: "/analytics/access/status",
        headers: h,
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await app.inject({
        method: "GET",
        url: "/analytics/participation/context",
        headers: { authorization: `Bearer ${token}` },
      })
    ).statusCode,
    401,
  );
  let now = 0;
  const gate = new AnalyticsAccess(() => now);
  const grant = await gate.unlock("user", "login", password());
  gate.require("user", "login", grant.token);
  now = 30 * 60_000;
  assert.throws(
    () => gate.require("user", "login", grant.token),
    AnalyticsAccessError,
  );
  for (let i = 0; i < 5; i++)
    await assert.rejects(
      gate.unlock("user", "login", "wrong"),
      AnalyticsAccessError,
    );
  await assert.rejects(
    gate.unlock("user", "login", password()),
    (e: any) => e.statusCode === 429,
  );
  now += 15 * 60_000;
  assert((await gate.unlock("user", "login", password())).token);
  console.log(
    "PASS: analytics gate enforces every read, password, role, session binding, revocation, expiry and attempt limits",
  );
}
