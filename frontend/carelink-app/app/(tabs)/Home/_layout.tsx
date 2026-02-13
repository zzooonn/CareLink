// app/(tabs)/Home/_layout.tsx
import { Stack } from "expo-router";

export default function HomeStack() {
  return (
    <Stack
      initialRouteName="HomePage" // ✅ 기본 진입 화면 지정
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
