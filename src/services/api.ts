import { Platform } from "react-native";
import {canCacheRead,cachedRead,cachedDirectory,saveRead,markCacheFault,markLocalRead,clearLocalRead} from "../offline/readCache";
import { notifySessionExpired } from "./sessionEvents";
import { sessionService } from "./sessionService";

export const STORAGE_KEYS = {
  token: "@katu:token",
  user: "@katu:user",
};

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL!;

type RequestMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

type RequestOptions = {
  method?: RequestMethod;
  body?: unknown;
  auth?: boolean;
  expectedOwner?: string;
};

export class ApiNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiNetworkError";
  }
}

export class ApiHttpError extends Error {
  status: number;
  data?: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = "ApiHttpError";
    this.status = status;
    this.data = data;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, auth = false, expectedOwner } = options;

  let requestToken: string | null = null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (auth) {
    const token = await sessionService.getToken();

    if (!token) {
      throw new Error("Usuário não autenticado.");
    }

    requestToken = token;
    headers.Authorization = `Bearer ${token}`;
    if(expectedOwner&&((await sessionService.getUser() as any)?.id!==expectedOwner||token!==(await sessionService.getToken())))throw new ApiHttpError(409,'A conta mudou. Reabra a pendência na conta original.');
  }

  const normalizedEndpoint = endpoint.startsWith("/")
    ? endpoint
    : `/${endpoint}`;

  const readOwner=auth&&method==='GET'&&canCacheRead(normalizedEndpoint)?(await sessionService.getUser() as any)?.id:null;
  let response: Response;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const url = `${API_BASE_URL}${normalizedEndpoint}`;
    if (__DEV__) console.log("[API] Request:", { url, method, auth });

    if(Platform.OS==='web'&&typeof navigator!=='undefined'&&navigator.onLine===false)throw Error('Sem conexão.');
    response = await fetch(url, {
      method,
      signal: controller.signal,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error: any) {
    if (__DEV__)
      console.log("[API] Fetch error:", {
        apiBaseUrl: API_BASE_URL,
        endpoint: normalizedEndpoint,
        method,
        message: error?.message,
        name: error?.name,
        stack: error?.stack,
      });

    if(readOwner&&requestToken===(await sessionService.getToken())){const directory=await cachedDirectory(readOwner,normalizedEndpoint);if(directory){markLocalRead(readOwner,normalizedEndpoint,new Date().toISOString());return directory as T;}const stored=await cachedRead(readOwner,normalizedEndpoint);if(stored){markLocalRead(readOwner,normalizedEndpoint,stored.savedAt);return stored.data as T;}}
    throw new ApiNetworkError(
      controller.signal.aborted
        ? "A conexão demorou além do esperado. Confira sua conexão e tente novamente."
        : "Não foi possível conectar ao KATUÁ. Confira sua conexão.",
    );
  } finally {
    clearTimeout(timeout);
  }

  if (
    response.status === 401 &&
    auth &&
    requestToken === (await sessionService.getToken())
  ) {
    await sessionService.clearSession();
    notifySessionExpired();
  }
  const contentType = response.headers.get("content-type");
  let data: any = null;

  if (contentType?.includes("application/json")) {
    data = await response.json();
  }

  if(auth&&requestToken!==(await sessionService.getToken()))throw new ApiHttpError(409,'A conta mudou durante a consulta. Reabra os dados na conta atual.');
  if(readOwner&&[500,502,503,504].includes(response.status)&&requestToken===(await sessionService.getToken())){const stored=await cachedRead(readOwner,normalizedEndpoint);if(stored){markLocalRead(readOwner,normalizedEndpoint,stored.savedAt);return stored.data as T;}}
  if (!response.ok) {
    if (__DEV__)
      console.log("[API] HTTP error:", {
        status: response.status,
        endpoint: normalizedEndpoint,
        code: data?.code,
      });

    throw new ApiHttpError(
      response.status,
      data?.message ||
        data?.error ||
        `Erro HTTP ${response.status} na comunicação com o servidor.`,
      data,
    );
  }

  if(readOwner&&requestToken===(await sessionService.getToken())){try{await saveRead(readOwner,normalizedEndpoint,data);clearLocalRead(readOwner,normalizedEndpoint);}catch(e:any){markCacheFault(e.message||"Não foi possível guardar estes dados para uso offline.");}}
  if(Platform.OS==='web'&&method!=='GET'&&(/\/start$/.test(normalizedEndpoint)||normalizedEndpoint.includes('/field-status')||normalizedEndpoint.includes('/status')))window.dispatchEvent(new Event('katua:field-started'));
  return data as T;
}

async function getExternalJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok)
      throw new ApiHttpError(
        response.status,
        `Serviço externo respondeu com erro ${response.status}.`,
      );
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiHttpError) throw error;
    throw new ApiNetworkError(
      controller.signal.aborted
        ? "O serviço externo demorou além do esperado. Tente novamente."
        : "Não foi possível consultar o serviço externo.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function isApiNetworkError(error: unknown): error is ApiNetworkError {
  return error instanceof ApiNetworkError;
}

export function isApiHttpError(error: unknown): error is ApiHttpError {
  return error instanceof ApiHttpError;
}

export const api = {
  get: <T>(endpoint: string, auth = false) =>
    request<T>(endpoint, { method: "GET", auth }),

  post: <T>(endpoint: string, body?: unknown, auth = false, expectedOwner?: string) =>
    request<T>(endpoint, { method: "POST", body, auth, expectedOwner }),

  patch: <T>(endpoint: string, body?: unknown, auth = false, expectedOwner?: string) =>
    request<T>(endpoint, { method: "PATCH", body, auth, expectedOwner }),

  put: <T>(endpoint: string, body?: unknown, auth = false) =>
    request<T>(endpoint, { method: "PUT", body, auth }),

  delete: <T>(endpoint: string, auth = false) =>
    request<T>(endpoint, { method: "DELETE", auth }),

  getExternalJson,
};

export default api;
