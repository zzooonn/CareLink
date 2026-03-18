import { useEffect, useRef } from "react";
import { useRouter, useSegments, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Dimensions } from "react-native";
import AppHeader from "../../components/AppHeader";

const { width: W } = Dimensions.get("window");

const TAB_BAR_STYLE = {
  backgroundColor: "#fff",
  borderTopWidth: 0,
  elevation: 0,
  shadowOpacity: 0,
  height: 82,
  paddingBottom: 12,
} as const;

const HIDDEN_TAB_BAR = { display: "none" } as const;

export default function TabsLayout() {
  const router = useRouter();
  const segments = useSegments();
  const segKey = segments.join("/");
  const redirecting = useRef(false);

  // 런타임 auth 가드 — token + userId 둘 다 확인하여 불일치로 인한 무한루프 방지
  useEffect(() => {
    if (redirecting.current) return;

    const check = async () => {
      const [userId, token] = await Promise.all([
        AsyncStorage.getItem("userId"),
        AsyncStorage.getItem("token"),
      ]);
      const seg1 = segments[1] as string | undefined;
      const inAuth = seg1 === "auth";
      const inIndex = !seg1 || seg1 === "index";

      // userId 또는 token 중 하나라도 없으면 비로그인으로 판단
      const isLoggedIn = !!(userId && token);

      if (!isLoggedIn && !inAuth && !inIndex) {
        redirecting.current = true;
        router.replace("/(tabs)");
        setTimeout(() => { redirecting.current = false; }, 500);
      }
    };
    check();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segKey]);

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={({ route }) => ({
        headerShown: true,
        header: () => <AppHeader />,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: W * 0.028,
          fontWeight: "600",
          marginBottom: 4,
        },
        tabBarStyle: TAB_BAR_STYLE,
        tabBarActiveTintColor: "#00AEEF",
        tabBarInactiveTintColor: "#111827",
        tabBarIcon: ({ color, size, focused }) => {
          let icon: keyof typeof Ionicons.glyphMap;

          switch (route.name) {
            case "Home":
              icon = focused ? "home" : "home-outline";
              break;
            case "profile":
              icon = focused ? "person" : "person-outline";
              break;
            case "setting":
              icon = focused ? "settings" : "settings-outline";
              break;
            default:
              icon = "ellipse-outline";
          }

          return <Ionicons name={icon} size={size} color={color} />;
        },
      })}
    >
      {/* Welcome: 탭바에서 완전 제거 (공간 차지 X) + 이 화면에선 탭바 숨김 */}
      <Tabs.Screen
        name="index"
        options={{ href: null, tabBarStyle: HIDDEN_TAB_BAR }}
      />

      <Tabs.Screen name="Home" options={{ title: "Home" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      <Tabs.Screen name="setting" options={{ title: "Settings" }} />

      {/* auth: 탭바 버튼 숨김 + 탭바 자체도 숨김 (로그인/회원가입 화면) */}
      <Tabs.Screen
        name="auth"
        options={{ href: null, tabBarStyle: HIDDEN_TAB_BAR }}
      />
    </Tabs>
  );
}
