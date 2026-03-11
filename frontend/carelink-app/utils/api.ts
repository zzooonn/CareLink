import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "";

/**
 * 저장된 JWT 토큰을 Authorization 헤더에 자동으로 포함하는 fetch 래퍼.
 * 로그인/회원가입 같은 공개 엔드포인트는 일반 fetch를 쓰고,
 * 보호된 API는 이 함수를 사용한다.
 */
export async function authFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await AsyncStorage.getItem("token");

  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
}
