import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";

let isRedirecting = false;

async function clearSessionAndRedirect() {
  if (isRedirecting) return;
  isRedirecting = true;
  await AsyncStorage.multiRemove(["token", "refreshToken", "userId"]);
  router.replace("/");
  setTimeout(() => { isRedirecting = false; }, 5000);
}

async function tryRefreshToken(): Promise<string | null> {
  const refreshToken = await AsyncStorage.getItem("refreshToken");
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const newToken = data.token || data.accessToken;
    if (!newToken) return null;

    await AsyncStorage.setItem("token", newToken);
    if (data.refreshToken) await AsyncStorage.setItem("refreshToken", data.refreshToken);

    return newToken;
  } catch {
    return null;
  }
}

function buildHeaders(token: string | null, extra?: HeadersInit): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extra ?? {}),
  };
}

export async function authFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await AsyncStorage.getItem("token");

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: buildHeaders(token, options.headers),
  });

  if (response.status !== 401) {
    return response;
  }

  // 401 → refresh 시도
  const newToken = await tryRefreshToken();
  if (!newToken) {
    await clearSessionAndRedirect();
    return response;
  }

  // 새 토큰으로 재시도 (signal 제외 — 원본 abort가 영향 주지 않도록)
  const { signal: _signal, ...optionsWithoutSignal } = options as RequestInit & { signal?: AbortSignal };
  const retryResponse = await fetch(`${API_BASE_URL}${path}`, {
    ...optionsWithoutSignal,
    headers: buildHeaders(newToken, options.headers),
  });

  return retryResponse;
}
