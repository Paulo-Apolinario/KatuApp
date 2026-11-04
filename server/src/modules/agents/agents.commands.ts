import { keywordCandidates } from "./agents.keywords";
import type { AgentKey } from "@prisma/client";
import type { Command } from "./agents.types";
export const COMMANDS: {
  key: Command;
  agent: AgentKey;
  example: string;
  aliases: string[];
}[] = [
  {
    key: "PENDING_COLLECTIONS",
    agent: "COLLECTIONS",
    example: "Quais coletas estão pendentes?",
    aliases: [
      "coletas pendentes",
      "mostrar coletas pendentes",
      "listar coletas pendentes",
    ],
  },
  {
    key: "OVERDUE_REQUESTS",
    agent: "COLLECTIONS",
    example: "Mostrar solicitações atrasadas.",
    aliases: [
      "solicitacoes atrasadas",
      "listar solicitacoes atrasadas",
      "ver solicitacoes atrasadas",
    ],
  },
  {
    key: "COLLECTION_PRIORITIES",
    agent: "COLLECTIONS",
    example: "Analisar prioridades de coleta.",
    aliases: [
      "prioridades de coleta",
      "prioridades das coletas",
      "ver prioridades de coleta",
    ],
  },
  {
    key: "SCHEDULED_ROUTES",
    agent: "ROUTES",
    example: "Verificar rotas programadas.",
    aliases: [
      "rotas programadas",
      "mostrar rotas programadas",
      "listar rotas programadas",
    ],
  },
  {
    key: "ROUTES_ATTENTION",
    agent: "ROUTES",
    example: "Quais rotas precisam de atenção?",
    aliases: [
      "rotas com problemas",
      "analisar rotas",
      "rotas que precisam de atencao",
    ],
  },
  {
    key: "OPERATIONAL_SUMMARY",
    agent: "MANAGER",
    example: "Mostrar resumo operacional.",
    aliases: ["resumo operacional", "resumo do dia", "mostrar resumo do dia"],
  },
  {
    key: "ATTENTION_OCCURRENCES",
    agent: "MANAGER",
    example: "Quais ocorrências precisam de atenção?",
    aliases: [
      "ocorrencias pendentes",
      "mostrar ocorrencias",
      "alertas pendentes",
    ],
  },
  {
    key: "TODAY_COLLECTIONS",
    agent: "COLLECTIONS",
    example: "Quais coletas estão previstas para hoje?",
    aliases: ["coletas de hoje", "agenda de coletas de hoje"],
  },
  {
    key: "ROUTES_WITHOUT_RESOURCES",
    agent: "ROUTES",
    example: "Quais rotas estão sem motorista ou veículo?",
    aliases: ["rotas sem motorista", "rotas sem veiculo", "rotas sem recursos"],
  },
  {
    key: "PENDING_PROPOSALS",
    agent: "MANAGER",
    example: "Quais recomendações aguardam revisão?",
    aliases: [
      "recomendacoes pendentes",
      "propostas pendentes",
      "propostas para revisao",
    ],
  },
  {
    key: "AUTOMATION_HEALTH",
    agent: "MANAGER",
    example: "Existem análises com falha ou eventos pendentes?",
    aliases: ["saude dos agentes", "falhas dos agentes", "fila de eventos"],
  },
];
export const normalizeCommand = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[?!.,;:]/g, "")
    .replace(/\s+/g, " ")
    .trim();
/** Interpretation may be replaced; execution always uses the closed Command union. No SQL, code or tool names from text. */
export interface CommandInterpreter {
  interpret(text: string): Command | null;
}
export function resolveCommandText(text: string): {
  command: Command | null;
  candidates: Command[];
  method: "EXACT" | "KEYWORDS" | "CLARIFICATION" | "UNKNOWN";
} {
  const normal = normalizeCommand(text);
  const exact = COMMANDS.find((c) =>
    [c.example, ...c.aliases].some((a) => normalizeCommand(a) === normal),
  );
  if (exact)
    return { command: exact.key, candidates: [exact.key], method: "EXACT" };
  const candidates = keywordCandidates(normal);
  return {
    command: candidates.length === 1 ? candidates[0] : null,
    candidates,
    method:
      candidates.length === 1
        ? "KEYWORDS"
        : candidates.length > 1
          ? "CLARIFICATION"
          : "UNKNOWN",
  };
}
export const structuredInterpreter: CommandInterpreter = {
  interpret(text) {
    return resolveCommandText(text).command;
  },
};
export function commandAgent(command: Command): AgentKey {
  return COMMANDS.find((c) => c.key === command)!.agent;
}
export const defaultCommand = (agent: AgentKey): Command =>
  agent === "COLLECTIONS"
    ? "COLLECTION_PRIORITIES"
    : agent === "ROUTES"
      ? "ROUTES_ATTENTION"
      : "OPERATIONAL_SUMMARY";
