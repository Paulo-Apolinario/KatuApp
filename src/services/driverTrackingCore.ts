import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, isApiHttpError } from './api';
import { sessionService } from './sessionService';
import type { LocationObject } from 'expo-location';
export type SharingSession = {
  sessionId: string;
  ownerId: string;
  mode: 'FOREGROUND' | 'BACKGROUND';
  routeId?: string;
  collectionId?: string;
};
export const TRACKING_KEY = '@katua:driver-live-sharing';
let lastError = '';
const stopListeners = new Set<() => void>();
export function onSharingStopped(fn: () => void) {
  stopListeners.add(fn);
  return () => stopListeners.delete(fn);
}
export function recordSharingError(message: string) {
  lastError = message;
}
export const sharingError = () => lastError;
export async function sharingSession(): Promise<SharingSession | null> {
  const text = await AsyncStorage.getItem(TRACKING_KEY);
  if (!text) return null;
  try {
    const value = JSON.parse(text);
    if (typeof value.sessionId === 'string' && typeof value.ownerId === 'string') return value;
  } catch {}
  await AsyncStorage.removeItem(TRACKING_KEY);
  return null;
}
export async function clearSharing() {
  await AsyncStorage.removeItem(TRACKING_KEY);
  for (const listener of stopListeners) listener();
}
export async function beginSharing(context: {
  routeId?: string;
  collectionId?: string;
}, mode: 'FOREGROUND' | 'BACKGROUND') {
  const user = (await sessionService.getUser()) as any;
  if (user?.role !== 'DRIVER') throw Error('Apenas o motorista pode compartilhar sua localização.');
  const result = await api.post<{
    sessionId: string;
  }>('/driver-tracking/start', {
    ...context,
    mode
  }, true);
  const current: SharingSession = {
    ...context,
    mode,
    ownerId: user.id,
    sessionId: result.sessionId
  };
  await AsyncStorage.setItem(TRACKING_KEY, JSON.stringify(current));
  lastError = '';
  return current;
}
let sending = false;
export async function sendDriverPosition(location: LocationObject) {
  if (sending || Date.now() - location.timestamp > 120000) return;
  const current = await sharingSession();
  if (!current) return;
  const user = (await sessionService.getUser()) as any;
  if (user?.id !== current.ownerId || user?.role !== 'DRIVER') {
    await clearSharing();
    return;
  }
  sending = true;
  try {
    await api.put('/driver-tracking/position', {
      sessionId: current.sessionId,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      capturedAt: new Date(location.timestamp).toISOString()
    }, true);
    lastError = '';
  } catch (e: any) {
    lastError = e.message || 'Localização sem conexão com a cooperativa.';
    if (isApiHttpError(e) && [401, 403, 409].includes(e.status)) {
      const live = await sharingSession();
      if (live?.sessionId === current.sessionId) await clearSharing();
    }
  } finally {
    sending = false;
  }
}
export async function endSharing() {
  const current = await sharingSession();
  await clearSharing();
  if (current) await api.post('/driver-tracking/stop', {
    sessionId: current.sessionId
  }, true);
}
export async function ownedSharingSession() {
  const current = await sharingSession();
  if (!current) return null;
  const user = (await sessionService.getUser()) as any;
  if (user?.id !== current.ownerId || user?.role !== 'DRIVER') {
    await clearSharing();
    return null;
  }
  return current;
}
