// app/(tabs)/setting/_layout.tsx
import { Stack } from "expo-router";

export default function SettingStack() {
  return (
    <Stack
      initialRouteName="SettingsScreen"
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
