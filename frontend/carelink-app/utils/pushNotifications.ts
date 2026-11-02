import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authFetch } from "./api";

const PUSH_TOKEN_KEY = "pushToken";

/**
 * 원격 푸시용 Expo 토큰을 발급받아 백엔드에 등록한다.
 * - 로그인 직후 호출
 * - 실패해도 로그인 흐름은 막지 않는다 (알림은 앱의 알림 화면에서 계속 볼 수 있음)
 * - Expo Go(Android)에서는 원격 푸시가 지원되지 않으므로 개발용 빌드(eas build)에서 테스트
 */
export async function registerPushTokenAsync(): Promise<string | null> {
  try {
    if (Platform.OS === "android") {
      // Android 13+는 채널이 있어야 권한 요청 창이 뜬다. 백엔드는 channelId "default"로 보낸다.
      await Notifications.setNotificationChannelAsync("default", {
        name: "건강 알림",
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== "granted") {
      console.log("[Push] permission not granted");
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      console.log("[Push] EAS projectId 없음 — `eas init` 후 다시 빌드하세요");
      return null;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    const res = await authFetch("/api/users/me/push-token", {
      method: "PUT",
      body: JSON.stringify({ token }),
    });
    if (!res.ok) {
      console.log("[Push] token register failed:", res.status);
      return null;
    }

    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    return token;
  } catch (e: any) {
    // 시뮬레이터, Expo Go 등 푸시를 쓸 수 없는 환경
    console.log("[Push] register skipped:", e?.message ?? e);
    return null;
  }
}

/**
 * 로그아웃할 때 이 기기의 토큰을 서버에서 지운다.
 * 로그인 토큰을 지우기 전에 호출해야 한다.
 */
export async function unregisterPushTokenAsync(): Promise<void> {
  try {
    const saved = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (!saved) return;
    await authFetch("/api/users/me/push-token", { method: "DELETE" });
  } catch {
    // 네트워크 오류여도 로그아웃은 계속 진행
  } finally {
    await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
  }
}
