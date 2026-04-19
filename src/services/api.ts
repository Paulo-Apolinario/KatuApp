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
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, auth = false } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (auth) {
    const token = await sessionService.getToken();

    if (!token) {
      throw new Error("Usuário não autenticado.");
    }

    headers.Authorization = `Bearer ${token}`;
  }

  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  let response: Response;

  try {
    const url = `${API_BASE_URL}${normalizedEndpoint}`;
    console.log("[API] Request:", { url, method, auth });

    response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error: any) {
    console.log("[API] Fetch error:", {
      apiBaseUrl: API_BASE_URL,
      endpoint: normalizedEndpoint,
      method,
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
    });

    throw new ApiNetworkError(
      `Falha de conexão com a API (${API_BASE_URL}${normalizedEndpoint}).`
    );
  }

  const contentType = response.headers.get("content-type");
  let data: any = null;

  if (contentType?.includes("application/json")) {
    data = await response.json();
  }

  if (!response.ok) {
    console.log("[API] HTTP error:", {
      status: response.status,
      endpoint: normalizedEndpoint,
      data,
    });

    throw new ApiHttpError(
      response.status,
      data?.message ||
        data?.error ||
        `Erro HTTP ${response.status} na comunicação com o servidor.`,
      data
    );
  }

  return data as T;
}

async function getExternalJson<T>(url: string): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });
  } catch {
    throw new ApiNetworkError("Não foi possível consultar o serviço externo.");
  }

  if (!response.ok) {
    throw new ApiHttpError(
      response.status,
      `Serviço externo respondeu com erro ${response.status}.`
    );
  }

  return (await response.json()) as T;
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

  post: <T>(endpoint: string, body?: unknown, auth = false) =>
    request<T>(endpoint, { method: "POST", body, auth }),

  patch: <T>(endpoint: string, body?: unknown, auth = false) =>
    request<T>(endpoint, { method: "PATCH", body, auth }),

  put: <T>(endpoint: string, body?: unknown, auth = false) =>
    request<T>(endpoint, { method: "PUT", body, auth }),

  delete: <T>(endpoint: string, auth = false) =>
    request<T>(endpoint, { method: "DELETE", auth }),

  getExternalJson,
};

export default api;