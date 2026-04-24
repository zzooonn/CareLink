// app/(tabs)/Home/_layout.tsx
import { Stack } from "expo-router";

export default function HomeStack() {
  return (
    <Stack
      initialRouteName="HomePage"
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
