import { useEffect, useRef } from "react";
import { useRouter, useSegments, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AppHeader from "../../components/AppHeader";
import { palette, radius } from "../../constants/design";

const TAB_BAR_STYLE = {
  backgroundColor: palette.surface,
  borderTopWidth: 1,
  borderTopColor: palette.line,
  height: 78,
  paddingBottom: 10,
  paddingTop: 8,
  elevation: 8,
  shadowColor: "#0b2b24",
  shadowOpacity: 0.08,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: -8 },
} as const;

const HIDDEN_TAB_BAR = { display: "none" } as const;

export default function TabsLayout() {
  const router = useRouter();
  const segments = useSegments();
  const segKey = segments.join("/");
  const redirecting = useRef(false);

  // ?고???auth 媛??
  useEffect(() => {
    if (redirecting.current) return;

    // segments瑜?await ?댁쟾??罹≪쿂 (stale closure 諛⑹?)
    const seg1 = segments[1] as string | undefined;
    const inAuth = seg1 === "auth";
    const inIndex = !seg1 || seg1 === "index";

    // ?몄쬆???꾩슂 ?녿뒗 ?붾㈃?대㈃ 泥댄겕 ?먯껜瑜?嫄대꼫?
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
        router.replace("/");
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
          fontSize: 12,
          fontWeight: "800",
          marginBottom: 4,
        },
        tabBarItemStyle: {
          borderRadius: radius.card,
          marginHorizontal: 4,
        },
        tabBarStyle: TAB_BAR_STYLE,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.muted,
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

          return <Ionicons name={icon} size={focused ? size + 1 : size} color={color} />;
        },
      })}
    >
      {/* Welcome: ??컮?먯꽌 ?꾩쟾 ?쒓굅 (怨듦컙 李⑥? X) + ???붾㈃?먯꽑 ??컮 ?④? */}
      <Tabs.Screen
        name="index"
        options={{ href: null, headerShown: false, tabBarStyle: HIDDEN_TAB_BAR }}
      />

      <Tabs.Screen name="Home" options={{ title: "Home" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      <Tabs.Screen name="setting" options={{ title: "Settings" }} />

      {/* auth: ??컮 踰꾪듉 ?④? + ??컮 ?먯껜???④? (濡쒓렇???뚯썝媛???붾㈃) */}
      <Tabs.Screen
        name="auth"
        options={{ href: null, headerShown: false, tabBarStyle: HIDDEN_TAB_BAR }}
      />
    </Tabs>
  );
}
