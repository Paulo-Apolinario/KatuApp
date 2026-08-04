import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  clearSession as clearSessionRepository,
  getSession as getSessionRepository,
  saveSession as saveSessionRepository,
} from "../database/repositories/sessionRepository";

export const SESSION_STORAGE_KEYS = {
  token: "@katu:token",
  user: "@katu:user",
} as const;

type SaveSessionInput = {
  token: string;
  user?: unknown;
  userId?: string | null;
};

async function saveSession(input: SaveSessionInput) {
  const serializedUser = input.user ? JSON.stringify(input.user) : null;

  await AsyncStorage.setItem(SESSION_STORAGE_KEYS.token, input.token);

  if (serializedUser) {
    await AsyncStorage.setItem(SESSION_STORAGE_KEYS.user, serializedUser);
  } else {
    await AsyncStorage.removeItem(SESSION_STORAGE_KEYS.user);
  }

  await saveSessionRepository({
    token: input.token,
    userId: input.userId ?? null,
    payload: input.user ?? null,
  });
}

async function getSession() {
  const [token, rawUser, localSession] = await Promise.all([
    AsyncStorage.getItem(SESSION_STORAGE_KEYS.token),
    AsyncStorage.getItem(SESSION_STORAGE_KEYS.user),
    getSessionRepository(),
  ]);

  const parsedUser = rawUser ? JSON.parse(rawUser) : null;

  if (!token && !localSession) {
    return null;
  }

  return {
    token: token ?? localSession?.token ?? null,
    user: parsedUser ?? localSession?.payload ?? null,
    userId: localSession?.userId ?? null,
    updatedAt: localSession?.updatedAt ?? null,
  };
}

async function getToken() {
  const session = await getSession();
  return session?.token ?? null;
}

async function getUser() {
  const session = await getSession();
  return session?.user ?? null;
}

async function clearSession() {
  await Promise.all([
    AsyncStorage.removeItem(SESSION_STORAGE_KEYS.token),
    AsyncStorage.removeItem(SESSION_STORAGE_KEYS.user),
    clearSessionRepository(),
  ]);
}

export const sessionService = {
  saveSession,
  getSession,
  getToken,
  getUser,
  clearSession,
};

export default sessionService;