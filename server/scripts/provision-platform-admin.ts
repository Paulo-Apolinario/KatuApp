/** Explicit VPS operation. Reads the password from stdin; never stores plaintext or emails it. */
import "dotenv/config";
import { parseArgs } from "node:util";
import { z } from "zod";
import { prisma } from "../src/lib/prisma";
import { provisionPlatformAdministrator } from "../src/modules/platform-admin/platform-admin.service";
async function main() {
  const { values } = parseArgs({ options: { email: { type: "string" }, name: { type: "string" }, "password-stdin": { type: "boolean" } }, strict: true });
  const email = z.string().email().max(255).parse(values.email?.trim().toLowerCase());
  const name = z.string().trim().min(3).max(150).parse(values.name || "Administrador KATUÁ");
  if (!values["password-stdin"] || process.stdin.isTTY) throw Error("Informe --password-stdin e forneça a senha por entrada padrão protegida.");
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.from(chunk); size += buffer.length;
    if (size > 1024) throw Error("Entrada de senha acima do limite.");
    chunks.push(buffer);
  }
  const password = z.string().min(8).max(256).parse(Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, ""));
  const user = await provisionPlatformAdministrator(email, password, name);
  console.log(JSON.stringify({ email: user.email, role: user.role, active: user.isActive, ready: user.credentialsReady }));
  console.log("Conta administrativa pronta. Entre no painel com o e-mail e a senha informados. A administração possui cadastro de cooperativas e Analytics de todas as cooperativas.");
}
main().catch(() => { console.error("Não foi possível provisionar o administrador. Confira o e-mail, a senha (8 a 256 caracteres), as migrações e se o e-mail já possui outro perfil. Nenhuma senha foi exibida."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
