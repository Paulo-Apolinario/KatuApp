import { test } from "node:test";
import assert from "node:assert/strict";

// Processo de teste isolado: não estabelece conexão com banco nem envia e-mails.
Object.assign(process.env, {
  NODE_ENV: "test", DATABASE_URL: "postgresql://unused:unused@127.0.0.1:1/unused",
  JWT_SECRET: "local-unconfigured-test-secret-32-characters", SMTP_HOST: "", SMTP_USER: "", SMTP_PASS: "", SMTP_FROM: "",
});
test("SMTP ausente: login por e-mail e recuperação não simulam envio", async () => {
  const { buildApp } = await import("../src/app");
  const app = await buildApp();
  try {
    const link = await app.inject({ method: "POST", url: "/auth/login-link", payload: { email: "test@example.invalid", audience: "PANEL" } });
    assert.equal(link.statusCode, 503); assert.equal(link.json().success, false); assert.equal(link.json().token, undefined);
    const reset = await app.inject({ method: "POST", url: "/auth/forgot-password", payload: { email: "test@example.invalid", audience: "APP" } });
    assert.equal(reset.statusCode, 400); assert.equal(reset.json().success, false);
  } finally { await app.close(); }
});
