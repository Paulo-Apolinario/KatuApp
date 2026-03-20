import AsyncStorage from "@react-native-async-storage/async-storage";

export const STORAGE_KEYS = {
  token: "@katu:token",
  user: "@katu:user",
};

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://192.168.5.194:3333";

type RequestMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

type RequestOptions = {
  method?: RequestMethod;
  body?: unknown;
  auth?: boolean;
};

async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, auth = false } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (auth) {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.token);

    if (!token) {
      throw new Error("Usuário não autenticado.");
    }

    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get("content-type");
  let data: any = null;

  if (contentType?.includes("application/json")) {
    data = await response.json();
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        "Erro na comunicação com o servidor."
    );
  }

  return data as T;
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
};

export default api;