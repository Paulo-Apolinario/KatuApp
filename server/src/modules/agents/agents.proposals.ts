import { proposalFreshness } from "./agents.freshness";
import type { AgentProposalStatus, Prisma } from "@prisma/client";
import { notifyCooperative } from "../inbox/inbox.service";
import { audit, fingerprint, json, lockCooperative } from "./agents.audit";
import { AgentError, LIMITS, type ProposalDraft } from "./agents.types";
import { prisma } from "../../lib/prisma";
export function assertProposalTransition(
  from: AgentProposalStatus,
  to: AgentProposalStatus,
) {
  if (from === "PENDING" && (to === "APPROVED" || to === "REJECTED")) return;
  throw new AgentError(
    409,
    "TRANSITION_BLOCKED",
    "Transição indisponível. A etapa 1 apenas registra aprovação ou rejeição de propostas pendentes; não executa operações.",
  );
}
export async function persistProposals(
  tx: Prisma.TransactionClient,
  cooperativeId: string,
  runId: string,
  drafts: ProposalDraft[],
  notificationsEnabled = true,
) {
  const ids: string[] = [];
  for (const draft of drafts.slice(0, LIMITS.proposals)) {
    const key = fingerprint({ kind: draft.kind, evidence: draft.evidence });
    let row = await tx.agentProposal.findUnique({
      where: { cooperativeId_fingerprint: { cooperativeId, fingerprint: key } },
    });
    if (!row) {
      row = await tx.agentProposal.create({
        data: {
          cooperativeId,
          runId,
          fingerprint: key,
          ...draft,
          evidence: json(draft.evidence),
        },
      });
      await audit(
        tx,
        cooperativeId,
        null,
        `proposal:${row.id}`,
        "PROPOSAL_CREATED",
        row.id,
        { runId, kind: row.kind },
      );
      // Reuse the existing inbox with a valid existing panel destination. Future UI can use proposalId.
      if (notificationsEnabled)
        await notifyCooperative(
          tx,
          cooperativeId,
          `agent:proposal:${row.id}`,
          "Nova recomendação dos agentes",
          row.title,
          {
            proposalId: row.id,
            agentRunId: runId,
            href: "/notifications",
            advisoryOnly: true,
            ...(typeof draft.evidence.routeId === "string"
              ? { routeId: draft.evidence.routeId }
              : {}),
            ...(draft.kind === "GROUP_COLLECTIONS" &&
            Array.isArray(draft.evidence.records)
              ? { scheduleId: draft.evidence.records[0]?.id }
              : {}),
          },
        );
    }
    ids.push(row.id);
  }
  return ids;
}
export async function decideProposal(
  cooperativeId: string,
  actorId: string,
  proposalId: string,
  input: {
    eventId: string;
    status: "APPROVED" | "REJECTED";
    expectedVersion: number;
    reason: string;
  },
) {
  return prisma.$transaction(async (tx) => {
    await lockCooperative(tx, cooperativeId);
    const row = await tx.agentProposal.findFirst({
      where: { id: proposalId, cooperativeId },
    });
    if (!row)
      throw new AgentError(404, "NOT_FOUND", "Proposta não encontrada.");
    const key = `decision:${input.eventId}`,
      hash = fingerprint({ actorId, proposalId, ...input });
    const previous = await tx.agentAuditEvent.findUnique({
      where: { cooperativeId_eventKey: { cooperativeId, eventKey: key } },
    });
    if (previous) {
      if ((previous.data as any).hash !== hash)
        throw new AgentError(
          409,
          "EVENT_CONFLICT",
          "Identificador de evento já utilizado com outros dados.",
        );
      return {
        proposal: row,
        replayed: true,
        operationalExecutionEnabled: false,
      };
    }
    if (row.version !== input.expectedVersion)
      throw new AgentError(
        409,
        "VERSION_CONFLICT",
        "A proposta foi alterada. Consulte novamente.",
      );
    assertProposalTransition(row.status, input.status);
    if (
      input.status === "APPROVED" &&
      !(await proposalFreshness(row, tx)).current
    )
      throw new AgentError(
        409,
        "STALE_PROPOSAL",
        "Os dados desta proposta mudaram. Solicite uma nova análise antes de aprovar.",
      );
    const proposal = await tx.agentProposal.update({
      where: { id: row.id },
      data: {
        status: input.status,
        version: { increment: 1 },
        decidedAt: new Date(),
      },
    });
    await audit(
      tx,
      cooperativeId,
      actorId,
      key,
      "PROPOSAL_DECIDED",
      proposalId,
      { hash, from: row.status, to: input.status, reason: input.reason },
    );
    return { proposal, replayed: false, operationalExecutionEnabled: false };
  });
}
