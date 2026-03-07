import { useEffect, useState } from "react";
import { useRouter, useSegments, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { View, ActivityIndicator } from "react-native"; // ✅ 추가
import AppHeader from "../../components/AppHeader";

export default function TabsLayout() {
  const router = useRouter();
  const segments = useSegments();
  // ✅ 확인 완료 여부를 추적하는 상태 (기존 checked보다 명확하게 변경)
  const [isAuthChecked, setIsAuthChecked] = useState(false);

  useEffect(() => {
    const check = async () => {
      // 탭 이동 시 로딩 상태로 초기화하고 싶다면 주석 해제 (단, 탭 누를 때마다 로딩이 뜰 수 있음)
      // setIsAuthChecked(false); 
      
      const userId = await AsyncStorage.getItem("userId");
      const inAuth = (segments[1] as string) === "auth";
      const inIndex = (segments[1] as string) === "index" || segments.length === 1;
      
      if (!userId && !inAuth && !inIndex) {
        // 1. 로그인 안 된 상태에서 보호된 페이지 접근 시
        router.replace("/(tabs)/auth/login");
        // ✅ 비동기 화면 이동이 완료될 시간을 벌어주기 위해 약간의 딜레이를 줍니다.
        setTimeout(() => setIsAuthChecked(true), 50); 
      } else if (userId && inAuth) {
        // 2. 이미 로그인된 상태에서 auth 페이지 접근 시
        router.replace("/(tabs)/Home/HomePage");
        setTimeout(() => setIsAuthChecked(true), 50);
      } else {
        // 3. 정상적인 접근인 경우 즉시 렌더링 허용
        setIsAuthChecked(true);
      }
    };
    check();
  }, [segments]);

  // ✅ 검사가 진행 중이거나 화면 이동 중일 때는 앱 화면 대신 로딩을 보여줍니다. (깜빡임 완벽 차단)
  if (!isAuthChecked) {
    return (
      <View style={{ flex: 1, backgroundColor: "#ffffff", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#00AEEF" />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: true,
        header: () => <AppHeader />,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          height: 70,
          paddingBottom: 10,
        },
        tabBarActiveTintColor: "#00AEEF",
        tabBarInactiveTintColor: "#111827",
        tabBarIcon: ({ color, size, focused }) => {
          let icon: keyof typeof Ionicons.glyphMap;

          switch (route.name) {
            case "index":
              icon = focused ? "heart" : "heart-outline";
              break;
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
      <Tabs.Screen name="index" />
      <Tabs.Screen name="Home" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="setting" />

      {/* auth 폴더를 탭에서 제거 */}
      <Tabs.Screen name="auth" options={{ href: null }} />
    </Tabs>
  );
}