import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";

async function clearSessionAndRedirect() {
  await AsyncStorage.multiRemove(["token", "refreshToken", "userId"]);
  router.replace("/(tabs)/auth/login");
}

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

  if (response.status !== 401) {
    return response;
  }

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
      await clearSessionAndRedirect();
      return response;
    }

    const data = await refreshRes.json();
    const newToken = data.token || data.accessToken;
    const newRefreshToken = data.refreshToken;

    if (!newToken) {
      await clearSessionAndRedirect();
      return response;
    }

    await AsyncStorage.setItem("token", newToken);
    if (newRefreshToken) await AsyncStorage.setItem("refreshToken", newRefreshToken);

    return fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${newToken}`,
        ...(options.headers ?? {}),
      },
    });

  } catch (error) {
    await clearSessionAndRedirect();
    return response;
  }
}