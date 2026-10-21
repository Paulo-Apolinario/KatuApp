import test from "node:test";
import assert from "node:assert/strict";
import {
  validCnpj,
  companySchema,
  prefsSchema,
  defaults,
} from "../../src/modules/settings/settings.schemas";
import {
  publicIPv4,
  encryptionReady,
  encrypt,
} from "../../src/modules/settings/settings.mail";
import { randomBytes } from "node:crypto";
test("CNPJ numérico e alfanumérico conforme exemplo oficial da Receita", () => {
  assert(validCnpj("11.222.333/0001-81"));
  assert(validCnpj("12.ABC.345/01DE-35"));
  assert(validCnpj("12.abc.345/01de-35"));
  assert(!validCnpj("12.ABC.345/01DE-36"));
  assert(!validCnpj("00.000.000/0000-00"));
  assert(!validCnpj("12@ABC34501DE35"));
});
test("SMTP não aceita IPv4 privados, locais, compartilhados e multicast", () => {
  for (const ip of [
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "224.0.0.1",
    "0.0.0.0",
    "::1",
    "8.8.8.999",
  ])
    assert(!publicIPv4(ip), ip);
  assert(publicIPv4("8.8.8.8"));
});
test("Criptografia exige chave de 32 bytes e gera cifras diferentes", () => {
  delete process.env.SETTINGS_ENCRYPTION_KEY;
  assert(!encryptionReady());
  assert.throws(() => encrypt("credencial", "coop"));
  process.env.SETTINGS_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  assert(encryptionReady());
  const a = encrypt("credencial", "coop"),
    b = encrypt("credencial", "coop");
  assert.notEqual(a, b);
  assert(!a.includes("credencial"));
});
test("Campos arbitrários e avisos sem destinatários são rejeitados", () => {
  assert(
    !prefsSchema.safeParse({
      ...defaults.preferences,
      version: 0,
      emailEnabled: true,
    }).success,
  );
  assert(!companySchema.safeParse({ cooperativeId: "other" }).success);
});
