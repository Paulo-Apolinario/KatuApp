import { prisma } from "../../src/lib/prisma";
import { processAgentEvents } from "../../src/modules/agents/agents.events";
async function main() {
  const url = new URL(process.env.DATABASE_URL || "");
  if (
    process.env.KATUA_AGENTS_LOCAL_VALIDATION !== "1" ||
    url.hostname !== "127.0.0.1" ||
    url.port !== "54329"
  )
    throw Error("Banco de teste local obrigatório.");
  try {
    await processAgentEvents({ info: () => {}, error: () => {} } as any);
  } finally {
    await prisma.$disconnect();
  }
}
void main().catch((e) => {
  console.error(e.code || e.message);
  process.exitCode = 1;
});
