import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
export const fingerprint = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export async function audit(
  tx: Prisma.TransactionClient,
  cooperativeId: string,
  actorId: string | null,
  eventKey: string,
  action: string,
  targetId: string,
  data: unknown = {},
) {
  return tx.agentAuditEvent.create({
    data: {
      cooperativeId,
      actorId,
      eventKey,
      action,
      targetId,
      data: json(data),
    },
  });
}
/** Serialize claims/configuration/decisions per tenant across API processes; no in-memory-only lock. */
export async function lockCooperative(
  tx: Prisma.TransactionClient,
  cooperativeId: string,
) {
  await tx.$queryRaw`SELECT true AS locked FROM pg_advisory_xact_lock(hashtextextended(${`agents:${cooperativeId}`}, 0))`;
}
