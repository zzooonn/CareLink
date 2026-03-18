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

  // 런타임 auth 가드
  useEffect(() => {
    if (redirecting.current) return;

    // segments를 await 이전에 캡처 (stale closure 방지)
    const seg1 = segments[1] as string | undefined;
    const inAuth = seg1 === "auth";
    const inIndex = !seg1 || seg1 === "index";

    // 인증이 필요 없는 화면이면 체크 자체를 건너뜀
    if (inAuth || inIndex) return;

    let cancelled = false;

    const check = async () => {
      const [userId, token] = await Promise.all([
        AsyncStorage.getItem("userId"),
        AsyncStorage.getItem("token"),
      ]);
      if (cancelled) return;

      const isLoggedIn = !!(userId && token);
      if (!isLoggedIn) {
        redirecting.current = true;
        router.replace("/(tabs)");
        setTimeout(() => { redirecting.current = false; }, 1000);
      }
    };
    check();
    return () => { cancelled = true; };
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
