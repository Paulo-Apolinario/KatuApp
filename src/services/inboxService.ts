import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";
export type InboxNotice = {
  id: string;
  collectionId: string | null;
  title: string;
  message: string;
  kind: string;
  readAt: string | null;
  createdAt: string;
  data?: {
    routeId?: string;
    extraOrderId?: string;
    pevRequestId?: string;
    items?: {
      name: string;
      unit: string;
      reportedQuantity: number;
      previousQuantity: number;
      confirmedQuantity: number;
    }[];
    reason?: string;
    actorName?: string;
  };
};
export type InboxPage = {
  userId: string;
  notifications: InboxNotice[];
  unreadCount: number;
  nextCursor: string | null;
};
const listeners = new Set<() => void>();
export const inboxChanged = () => listeners.forEach((listener) => listener());
export const onInboxChanged = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const key = (userId: string) => `@katu:inbox:${userId}`;
export async function cachedInbox(userId: string): Promise<InboxPage | null> {
  try {
    return JSON.parse((await AsyncStorage.getItem(key(userId))) || "null");
  } catch {
    return null;
  }
}
export async function loadInbox(
  userId: string,
  cursor?: string,
): Promise<InboxPage> {
  const data = await api.get<InboxPage>(
    `/notifications${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
    true,
  );
  if (data.userId !== userId)
    throw new Error("A sessão mudou. Atualize a central de notificações.");
  if (!cursor) await AsyncStorage.setItem(key(userId), JSON.stringify(data));
  return data;
}
export async function readNotice(id: string) {
  await api.patch(`/notifications/${encodeURIComponent(id)}/read`, {}, true);
  inboxChanged();
}
export async function readAllNotices() {
  await api.post("/notifications/read-all", {}, true);
  inboxChanged();
}
