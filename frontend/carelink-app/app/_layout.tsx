import { useState } from "react";
import { Stack } from "expo-router";
import { FontSizeProvider } from "../contexts/FontSizeContext";
import { AuthProvider } from "../contexts/AuthContext";
import Toast from "../components/Toast";

export default function RootLayout() {
  const [sessionExpired, setSessionExpired] = useState(false);

  return (
    <FontSizeProvider>
      <AuthProvider onSessionExpired={() => setSessionExpired(true)}>
        <Stack screenOptions={{ headerShown: false }} />
        <Toast
          visible={sessionExpired}
          message="Your session has expired. Please log in again."
          onHide={() => setSessionExpired(false)}
        />
      </AuthProvider>
    </FontSizeProvider>
  );
}
