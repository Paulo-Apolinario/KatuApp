import { api } from "../services/api";
import { saveExtraRecord } from "../database/repositories/extraOrderRepository";
import type { ExtraOrder } from "../types/extraOrder";
export async function syncExtraOrder(payload: {
  action: "create" | "revise";
  orderId: string;
  body: unknown;
  __ownerId: string;
}) {
  if (
    !["create", "revise"].includes(payload.action) ||
    !payload.orderId ||
    !payload.__ownerId
  )
    throw Error("Operação de O.C. inválida.");
  const { order } = await api.post<{ order: ExtraOrder }>(
    payload.action === "create"
      ? "/extra-collection-orders"
      : `/extra-collection-orders/${payload.orderId}/revise`,
    payload.body,
    true,
  );
  if (!order?.id)
    throw Error("Resposta da O.C. não confirmada. A pendência foi preservada.");
  await saveExtraRecord(
    order.id,
    { ...order, syncStatus: "SYNCED" },
    order.status,
    payload.__ownerId,
  );
}
