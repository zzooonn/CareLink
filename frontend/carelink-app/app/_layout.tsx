import { useEffect, useState } from "react";
import { Stack, router } from "expo-router";
import * as Notifications from "expo-notifications";
import { FontSizeProvider } from "../contexts/FontSizeContext";
import { AuthProvider } from "../contexts/AuthContext";
import Toast from "../components/Toast";

// 앱이 켜져 있을 때도 서버 푸시를 배너로 보여 준다.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// 서버가 보낸 건강 알림(data.alertId가 있음)을 누르면 알림 화면으로 이동
function openAlertFromPush(response: Notifications.NotificationResponse | null) {
  const data = response?.notification.request.content.data as { alertId?: number } | undefined;
  if (data?.alertId != null) {
    router.push("/Home/Notification");
  }
}

export default function RootLayout() {
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    // 앱이 꺼진 상태에서 알림을 눌러 실행된 경우
    Notifications.getLastNotificationResponseAsync().then(openAlertFromPush);
    // 앱이 켜져 있거나 백그라운드일 때 알림을 누른 경우
    const sub = Notifications.addNotificationResponseReceivedListener(openAlertFromPush);
    return () => sub.remove();
  }, []);

  return (
    <FontSizeProvider>
      <AuthProvider onSessionExpired={() => setSessionExpired(true)}>
        <Stack screenOptions={{ headerShown: false }} />
        <Toast
          visible={sessionExpired}
          message="Your session has expired. Please log in again."
          onHide={() => setSessionExpired(false)}
        />
      </AuthProvider>
    </FontSizeProvider>
  );
}
