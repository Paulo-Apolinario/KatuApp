import { analyzeCollections } from "./agents.collections";
import { analyzeRoutes } from "./agents.routes-analysis";
import { analyzeManager } from "./agents.manager";
import { commandAgent } from "./agents.commands";
import type { Analysis, Command } from "./agents.types";
/** Closed read-only tool registry. A future interpreter cannot add tool names, SQL, or bypass tenant checks. */
export interface AgentTools {
  analyze(cooperativeId: string, command: Command): Promise<Analysis>;
}
export const readOnlyTools: AgentTools = {
  analyze(cooperativeId, command) {
    const agent = commandAgent(command);
    if (agent === "COLLECTIONS")
      return analyzeCollections(cooperativeId, command);
    if (agent === "ROUTES") return analyzeRoutes(cooperativeId, command);
    return analyzeManager(cooperativeId, command);
  },
};
