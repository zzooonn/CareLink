// app/(tabs)/auth/_layout.tsx
import { Stack } from "expo-router";

export default function AuthStack() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
