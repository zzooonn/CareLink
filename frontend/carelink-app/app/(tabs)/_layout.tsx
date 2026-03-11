import { useEffect } from "react";
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

  // 런타임 auth 가드 — 로딩 스피너 없이 단순 리다이렉트만 처리
  useEffect(() => {
    const check = async () => {
      const userId = await AsyncStorage.getItem("userId");
      const seg1 = segments[1] as string | undefined;
      const inAuth = seg1 === "auth";
      const inIndex = !seg1 || seg1 === "index";

      // 비로그인 상태에서 보호된 페이지 접근 시 Welcome으로 돌려보냄
      if (!userId && !inAuth && !inIndex) {
        router.replace("/(tabs)");
      }
    };
    check();
  }, [segments]);

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
