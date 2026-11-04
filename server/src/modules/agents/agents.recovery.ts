import { prisma } from "../../lib/prisma";
import { audit, lockCooperative } from "./agents.audit";
/** Recover interrupted metadata independently of new-run quotas or configuration state. No operational replay. */
export async function recoverExpiredRuns(cooperativeId?: string) {
  const now = new Date();
  const rows = await prisma.agentRun.findMany({
    where: {
      ...(cooperativeId ? { cooperativeId } : {}),
      status: "RUNNING",
      expiresAt: { lte: now },
    },
    orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
    take: 20,
    select: { id: true, cooperativeId: true, conversationId: true },
  });
  for (const run of rows) {
    await prisma.$transaction(async (tx) => {
      await lockCooperative(tx, run.cooperativeId);
      const changed = await tx.agentRun.updateMany({
        where: {
          id: run.id,
          cooperativeId: run.cooperativeId,
          status: "RUNNING",
          expiresAt: { lte: now },
        },
        data: { status: "FAILED", errorCode: "LEASE_EXPIRED", finishedAt: now },
      });
      if (!changed.count) return;
      if (run.conversationId)
        await tx.agentMessage.createMany({
          data: [
            {
              cooperativeId: run.cooperativeId,
              conversationId: run.conversationId,
              runId: run.id,
              role: "ASSISTANT",
              content:
                "A análise foi interrompida. Confira o histórico antes de solicitar uma nova análise.",
            },
          ],
          skipDuplicates: true,
        });
      await audit(
        tx,
        run.cooperativeId,
        null,
        `expired:${run.id}`,
        "RUN_FAILED",
        run.id,
        { code: "LEASE_EXPIRED" },
      );
    });
  }
}
