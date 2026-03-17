import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";

/**
 * 저장된 JWT 토큰을 Authorization 헤더에 자동으로 포함하는 fetch 래퍼.
 * 401 응답 시 refreshToken으로 자동 갱신 후 한 번 재시도한다.
 * 로그인/회원가입 같은 공개 엔드포인트는 일반 fetch를 쓰고,
 * 보호된 API는 이 함수를 사용한다.
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
  if (!refreshToken) return response;

  try {
    const refreshRes = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!refreshRes.ok) return response;

    const data = await refreshRes.json();
    if (!data?.token) return response;

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
    return response;
  }
}
