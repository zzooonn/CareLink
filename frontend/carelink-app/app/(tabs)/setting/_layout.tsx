// app/(tabs)/setting/_layout.tsx
import { Stack } from "expo-router";

export default function SettingStack() {
  return (
    <Stack
      initialRouteName="SettingsScreen" // ✅ 기본 진입 화면 지정
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
