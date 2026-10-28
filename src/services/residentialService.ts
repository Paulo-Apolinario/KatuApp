import { api, isApiHttpError } from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { sessionService } from "./sessionService";
import type { CreateSchedulePayload } from "../types/schedule";
export type SavedAddress = { id: string; label: string; address: string; latitude: number | null; longitude: number | null };
export type ResidentialRequest = {
  id: string; status: string; createdAt: string; preferredDate: string | null; scheduledDate: string | null;
  pickupAddress: string | null; pickupLatitude: number | null; pickupLongitude: number | null; notes: string | null;
  cooperative: { id: string; name: string; phone?: string | null; email?: string | null; city?: string | null; address?: string | null };
  requestedMaterials: { id?: string; wasteTypeId: string | null; nameSnapshot: string; categorySnapshot?: string | null; subcategorySnapshot?: string | null; estimatedQuantity: string | number | null; unit: string }[];
  collections: { id: string; status: string; startedAt: string | null; collectedAt: string | null; receivedAt: string | null; sortingStartedAt: string | null; completedAt: string | null; cancelledAt: string | null; totalWeightKg: number; collectionMaterials: { nameSnapshot: string; quantity: string | number; reportedQuantity: string | number | null; unit: string }[] }[];
};
export type ResidentialOverview = { lastReceived: { scheduleId: string | null; totalWeightKg: number; collectedAt: string | null; receivedAt: string | null } | null; counts: Record<string, number>; receivedKg: number; receivedCollections: number; requests: ResidentialRequest[]; months: { month: string; kg: number; count: number }[]; profile: { address: string | null; savedAddresses: SavedAddress[] } | null; updatedAt: string };
export type ResidentialSubmission = CreateSchedulePayload & { cooperativeId: string; pickupAddress: string; preferredDate: string };
const key = (userId: string) => `@katu:residential:submission:${userId}`;
export const residentialService = {
  overview: () => api.get<ResidentialOverview>("/residential/overview", true),
  detail: async (id: string) => (await api.get<{ schedule: ResidentialRequest }>(`/residential/requests/${encodeURIComponent(id)}`, true)).schedule,
  cancel: (id: string) => api.post(`/residential/requests/${encodeURIComponent(id)}/cancel`, {}, true),
  profile: (data: { displayName: string; phone: string; address: string; savedAddresses: SavedAddress[] }) => api.patch("/residential/profile", data, true),
  async pendingSubmission(userId: string): Promise<{ operationId: string; payload: ResidentialSubmission } | null> {
    const raw = await AsyncStorage.getItem(key(userId)); return raw ? JSON.parse(raw) : null;
  },
  async submit(userId: string, payload?: ResidentialSubmission) {
    if ((await sessionService.getSession())?.userId !== userId) throw Error("A conta mudou. Entre novamente.");
    let pending = await this.pendingSubmission(userId);
    if (!pending) {
      if (!payload) throw Error("Não há envio para retomar.");
      pending = { operationId: Crypto.randomUUID(), payload };
      await AsyncStorage.setItem(key(userId), JSON.stringify(pending));
    }
    // A primeira tentativa e todas as retomadas enviam o mesmo conteúdo e identificador.
    let response: { schedule: ResidentialRequest };
    try { response = await api.post<{ schedule: ResidentialRequest }>("/schedules", { ...pending.payload, operationId: pending.operationId }, true); }
    catch (e) { if (isApiHttpError(e) && [400, 404, 422].includes(e.status)) await AsyncStorage.removeItem(key(userId)); throw e; }
    if (!response?.schedule?.id) throw Error("Não foi possível confirmar o envio. A tentativa foi preservada.");
    await AsyncStorage.removeItem(key(userId)); return response.schedule;
  },
  async acknowledgeSubmission(userId: string) {
    // Descartar a tentativa só é permitido após consultar o próprio histórico no servidor.
    const pending = await this.pendingSubmission(userId);
    if (!pending) return;
    const result = await api.get<{ schedule: ResidentialRequest | null }>(`/residential/submissions/${pending.operationId}`, true);
    if (!result.schedule) throw Error("O envio ainda não foi confirmado. Retome a tentativa com os mesmos dados.");
    await AsyncStorage.removeItem(key(userId)); return result.schedule;
  },
};
