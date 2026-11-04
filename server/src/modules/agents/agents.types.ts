import type { AgentKey } from "@prisma/client";
export type Command =
  | "PENDING_COLLECTIONS"
  | "OVERDUE_REQUESTS"
  | "COLLECTION_PRIORITIES"
  | "SCHEDULED_ROUTES"
  | "ROUTES_ATTENTION"
  | "OPERATIONAL_SUMMARY"
  | "ATTENTION_OCCURRENCES"
  | "TODAY_COLLECTIONS"
  | "ROUTES_WITHOUT_RESOURCES"
  | "PENDING_PROPOSALS"
  | "AUTOMATION_HEALTH";
export interface Finding {
  kind: string;
  id: string;
  title: string;
  href: string;
  reasons: string[];
  status?: string;
  date?: string | null;
}
export interface ProposalDraft {
  kind: string;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
}
export interface Analysis {
  agent: AgentKey;
  command: Command;
  generatedAt: string;
  summary: string;
  counts: Record<string, number>;
  items: Finding[];
  warnings: string[];
  truncated: boolean;
  method: string;
  proposals: ProposalDraft[];
  indicators?: Record<string, unknown>;
}
export class AgentError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export const AGENTS = [
  {
    key: "COLLECTIONS",
    name: "AgentCollections",
    label: "Agente de Coletas",
    description:
      "Pendências, atrasos, prioridades e possibilidades de agrupamento.",
  },
  {
    key: "ROUTES",
    name: "AgentRoutes",
    label: "Agente de Rotas",
    description: "Programação, equipe, conflitos e sugestões de sequência.",
  },
  {
    key: "MANAGER",
    name: "AgentManager",
    label: "Agente Gestor",
    description: "Resumo operacional e ocorrências da central de alertas.",
  },
] as const;
export const LIMITS = {
  globalConcurrency: 1,
  durationMs: 45000,
  eventBatch: 20,
  eventAttempts: 3,
  perMinute: 10,
  perDay: 100,
  leaseMinutes: 15,
  records: 100,
  proposals: 10,
  routeValidation: 20,
} as const;
