import * as Crypto from "expo-crypto";
import { api, isApiNetworkError, isApiHttpError } from "./api";
import {
  enqueueSyncItem,
  removeOwnedSyncItem,
  getPendingSyncItems,
} from "../database/repositories/syncQueueRepository";
import {
  extraOwner,
  getExtraRecord,
  listExtraRecords,
  saveExtraRecord,
} from "../database/repositories/extraOrderRepository";
import { syncManager } from "../offline/syncManager";
import type {
  ExtraOrder,
  ExtraOrderPayload,
  ExtraContext,
} from "../types/extraOrder";
function project(q: any, old: any) {
  const b = q.payload.body;
  return {
    ...old,
    id: q.entityId,
    cooperativeId: b.cooperativeId || old?.cooperativeId,
    payload: b.payload,
    status: "LOCAL_PENDING",
    revision: b.expectedRevision || 1,
    createdAt: old?.createdAt || q.createdAt,
    custody: b.payload.custody,
    custodyNotes: b.payload.custodyNotes,
    syncStatus: q.status,
    syncError: q.errorMessage || undefined,
  };
}
const prefix = "/extra-collection-orders";
export const newExtraId = () => Crypto.randomUUID();
export const extraOrderService = {
  sync: (options?: { manual?: boolean }) => syncManager.runSyncNow(options),
  async context(): Promise<ExtraContext | null> {
    const owner = await extraOwner();
    try {
      const c = await api.get<ExtraContext>(prefix + "/context", true);
      await saveExtraRecord("__context__", c, "CONTEXT", owner || undefined);
      return c;
    } catch (e) {
      if (!isApiNetworkError(e)) throw e;
      return getExtraRecord("__context__");
    }
  },
  async list(page = 1) {
    const owner = await extraOwner();
    let remote: {
      orders: ExtraOrder[];
      hasMore: boolean;
      total: number;
      page: number;
    } | null = null;
    try {
      remote = await api.get(`${prefix}?page=${page}`, true);
      for (const o of remote!.orders)
        await saveExtraRecord(o.id, o, o.status, owner || undefined);
    } catch (e) {
      if (!isApiNetworkError(e)) throw e;
    }
    const local = (await listExtraRecords()).filter(
      (r: any) => r?.id && r?.payload,
    ) as ExtraOrder[];
    const pending = await getPendingSyncItems();
    const pendingIds = new Set(
      pending
        .filter((q) => q?.operationType === "EXTRA_ORDER_WRITE")
        .map((q) => q!.entityId),
    );
    const rows = remote
      ? [
          ...remote.orders,
          ...local.filter((o) => pendingIds.has(o.id) || o.status === "DRAFT"),
        ]
      : local;
    for (const q of pending.filter(
      (q) => q?.operationType === "EXTRA_ORDER_WRITE",
    ))
      rows.push(
        project(
          q,
          local.find((o) => o.id === q!.entityId),
        ),
      );
    const orders = [...new Map(rows.map((o) => [o.id, o])).values()].map(
      (o) => {
        const q = pending.find(
          (q) =>
            q?.operationType === "EXTRA_ORDER_WRITE" && q.entityId === o.id,
        );
        return q
          ? {
              ...o,
              status: "LOCAL_PENDING",
              syncStatus: q.status,
              syncError: q.errorMessage || undefined,
            }
          : o;
      },
    );
    return {
      orders,
      hasMore: remote?.hasMore || false,
      offline: !remote,
      total: remote?.total ?? orders.length,
    };
  },
  async get(id: string): Promise<ExtraOrder> {
    const owner = await extraOwner();
    const q = (await getPendingSyncItems()).find(
      (q) => q?.operationType === "EXTRA_ORDER_WRITE" && q.entityId === id,
    );
    if (q) return project(q, await getExtraRecord(id));
    try {
      const r = await api.get<{ order: ExtraOrder }>(`${prefix}/${id}`, true);
      await saveExtraRecord(id, r.order, r.order.status, owner || undefined);
      return r.order;
    } catch (e) {
      if (!isApiNetworkError(e)) throw e;
      const cached = await getExtraRecord(id);
      if (!cached) throw e;
      return cached;
    }
  },
  async draft(order: ExtraOrder, owner: string) {
    if (
      (await getPendingSyncItems()).some(
        (q) =>
          q?.entityId === order.id && q.operationType === "EXTRA_ORDER_WRITE",
      )
    )
      return;
    await saveExtraRecord(order.id, order, "DRAFT", owner);
  },
  async submit(
    id: string,
    cooperativeId: string,
    payload: ExtraOrderPayload,
    revision?: number,
  ) {
    const owner = await extraOwner();
    if (!owner) throw Error("Entre na sua conta para salvar a O.C.");
    const action = revision ? "revise" : "create";
    const old = (await getPendingSyncItems()).find(
      (q) => q?.operationType === "EXTRA_ORDER_WRITE" && q.entityId === id,
    );
    if (old)
      throw Error(
        "Esta ordem já tem envio pendente. Sincronize e confira o protocolo antes de reenviar.",
      );
    const operationId = Crypto.randomUUID();
    const body = revision
      ? { operationId, expectedRevision: revision, payload }
      : { id, cooperativeId, payload };
    await enqueueSyncItem({
      id: `oc:${id}:${operationId}`,
      operationType: "EXTRA_ORDER_WRITE",
      entityType: "EXTRA_ORDER",
      entityId: id,
      payload: { action, orderId: id, body },
    });
    const order: ExtraOrder = {
      id,
      cooperativeId,
      status: "LOCAL_PENDING",
      revision: revision || 1,
      payload,
      createdAt: new Date().toISOString(),
      custody: payload.custody,
      custodyNotes: payload.custodyNotes,
      syncStatus: "PENDING",
    };
    await saveExtraRecord(id, order, order.status, owner);
    await syncManager.runSyncNow();
    return this.get(id);
  },
  async recoverFailed(id: string): Promise<ExtraOrder> {
    if (syncManager.isSyncRunning())
      throw Error("Aguarde a sincronização em andamento antes de corrigir.");
    const q = (await getPendingSyncItems()).find(
      (q) => q?.operationType === "EXTRA_ORDER_WRITE" && q.entityId === id,
    );
    if (!q || q.status !== "ERROR")
      throw Error("Somente envio com erro pode ser corrigido desta forma.");
    const owner = await extraOwner(),
      old = await getExtraRecord(id),
      body = q.payload.body;
    const c = await this.context();
    if (!c || c.cooperative.id !== (body.cooperativeId || old?.cooperativeId))
      throw Error(
        "Confira seu vínculo com a cooperativa antes de corrigir esta pendência.",
      );
    let remote: ExtraOrder | undefined;
    try {
      remote = (await api.get<{ order: ExtraOrder }>(`${prefix}/${id}`, true))
        .order;
    } catch (e) {
      if (!isApiHttpError(e) || e.status !== 404) throw e;
    }
    if (q.payload.action === "create" && remote)
      throw Error(
        "A ordem já existe na cooperativa. Atualize e sincronize o protocolo original.",
      );
    if (
      q.payload.action === "revise" &&
      (!remote ||
        remote.status !== "NEEDS_INFO" ||
        remote.revision !== body.expectedRevision)
    )
      throw Error(
        "A análise da ordem mudou. Atualize o protocolo antes de complementar.",
      );
    if (syncManager.isSyncRunning())
      throw Error("Aguarde a sincronização em andamento.");
    const draft = {
      ...project(q, old),
      status: remote ? "NEEDS_INFO" : "DRAFT",
      syncStatus: undefined,
      syncError: undefined,
    };
    await saveExtraRecord(id, draft, draft.status, owner || undefined);
    await removeOwnedSyncItem(q.id);
    return draft;
  },
  async review(id: string, body: Record<string, unknown>) {
    return (
      await api.post<{ order: ExtraOrder }>(
        `${prefix}/${id}/review`,
        body,
        true,
      )
    ).order;
  },
  async receive(id: string, body: Record<string, unknown>) {
    return (
      await api.post<{ order: ExtraOrder }>(
        `${prefix}/${id}/receive`,
        body,
        true,
      )
    ).order;
  },
};
