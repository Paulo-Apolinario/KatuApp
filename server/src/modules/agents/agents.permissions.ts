import { prisma } from "../../lib/prisma";
import { AgentError } from "./agents.types";
export async function agentScope(user: { sub: string; role: string }) {
  if (user.role !== "COOPERATIVE")
    throw new AgentError(
      403,
      "FORBIDDEN",
      "Agentes disponíveis somente para a cooperativa.",
    );
  const coop = await prisma.cooperative.findUnique({
    where: { userId: user.sub },
    select: { id: true, userId: true },
  });
  if (!coop)
    throw new AgentError(
      403,
      "FORBIDDEN",
      "Cooperativa não encontrada para esta conta.",
    );
  return coop;
}
export const agentsEnabled = () => process.env.AGENTS_ENABLED === "true";
export function requireAgentsEnabled() {
  if (!agentsEnabled())
    throw new AgentError(
      503,
      "AGENTS_DISABLED",
      "Módulo de agentes desativado neste servidor.",
    );
}
