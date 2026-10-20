/** Operação administrativa explícita, nunca executada no deploy. Não cria contas/senhas. */
import "dotenv/config";
import { parseArgs } from "node:util";
import { prisma } from "../src/lib/prisma";
import { accessSchema } from "../src/modules/environmental/environmental.schemas";
import {
  actorContext,
  environmentalService,
} from "../src/modules/environmental/environmental.service";

async function main() {
  const { values } = parseArgs({
    options: {
      "admin-email": { type: "string" },
      "user-email": { type: "string" },
      municipality: { type: "string" },
      permission: { type: "string" },
      appointment: { type: "string" },
      revoke: { type: "boolean", default: false },
    },
    strict: true,
  });
  if (!values["admin-email"] || !values["user-email"])
    throw Error("Informe --admin-email e --user-email de contas existentes.");
  const [admin, user] = await Promise.all([
    prisma.user.findUnique({
      where: { email: values["admin-email"].trim().toLowerCase() },
    }),
    prisma.user.findUnique({
      where: { email: values["user-email"].trim().toLowerCase() },
    }),
  ]);
  if (!admin || admin.role !== "ADMIN" || !user)
    throw Error("Administrador ou usuário não identificado. Nenhuma conta foi criada.");
  const input = accessSchema.parse({
    userId: user.id,
    municipalityCode: values.municipality,
    permission: values.permission || "VIEWER",
    appointmentReference: values.appointment,
    active: !values.revoke,
  });
  const result = await environmentalService.grant(await actorContext(admin.id), input);
  console.log(JSON.stringify({
    id: result.id,
    municipalityCode: result.municipalityCode,
    permission: result.permission,
    active: result.active,
  }));
  console.log("O usuário deve entrar novamente no painel para atualizar o perfil. Acesso a documentos de cooperativa depende de compartilhamento explícito pela organização.");
}

main()
  .catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
