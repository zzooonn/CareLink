import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";

/** 토큰 전부 삭제 후 로그인 화면으로 이동 */
async function clearSessionAndRedirect() {
  await AsyncStorage.multiRemove(["token", "refreshToken", "userId"]);
  router.replace("/(tabs)");
}

/**
 * 저장된 JWT 토큰을 Authorization 헤더에 자동으로 포함하는 fetch 래퍼.
 * 401 응답 시 refreshToken으로 자동 갱신 후 한 번 재시도한다.
 * 갱신도 실패하면 토큰을 전부 삭제하고 로그인 화면으로 이동한다.
 */
export async function authFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await AsyncStorage.getItem("token");

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (response.status !== 401) return response;

  // 401 → 리프레시 토큰으로 액세스 토큰 갱신 시도
  const refreshToken = await AsyncStorage.getItem("refreshToken");
  if (!refreshToken) {
    await clearSessionAndRedirect();
    return response;
  }

  try {
    const refreshRes = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!refreshRes.ok) {
      // 리프레시도 실패 → 세션 만료, 로그인 화면으로
      await clearSessionAndRedirect();
      return response;
    }

    const data = await refreshRes.json();
    if (!data?.token) {
      await clearSessionAndRedirect();
      return response;
    }

    await AsyncStorage.setItem("token", data.token);
    if (data?.refreshToken) await AsyncStorage.setItem("refreshToken", data.refreshToken);

    // 갱신된 토큰으로 원래 요청 재시도
    return fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.token}`,
        ...(options.headers ?? {}),
      },
    });
  } catch {
    await clearSessionAndRedirect();
    return response;
  }
}
