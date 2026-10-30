import type { Prisma } from "@prisma/client";

export const FINAL_TYPES = ["REJECT", "DISPOSAL", "DIRECT_DESTINATION"] as const;
export const editableAfterCollection = (type: string) =>
  type === "TRIAGE" || type === "RESERVATION";

export function destinationFlowWhere(flow?: string): Prisma.CollectionWasteDestinationWhereInput {
  if (flow === "intermediate") return {
    AND: [{ OR: [
      { type: { in: ["TRIAGE", "RESERVATION"] } },
      { type: "STOCK", OR: [
        { stockLotId: null },
        { stockLot: { is: {
          status: { in: ["AVAILABLE", "RESERVED"] },
          availableQuantity: { gt: 0 },
        } } },
      ] },
    ] }],
  };
  if (flow === "final") return {
    AND: [{ OR: [
      { type: { in: [...FINAL_TYPES] } },
      { type: "STOCK", stockLot: { is: {
        status: { in: ["SOLD", "DISCARDED"] },
      } } },
    ] }],
  };
  return {};
}
