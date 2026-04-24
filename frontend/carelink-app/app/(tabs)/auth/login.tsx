import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScaledText as Text } from "../../../components/ScaledText";
import { palette, pressShadow, radius, shadow, spacing, typeScale, webShell } from "../../../constants/design";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export default function Login() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchWithTimeout = async (url: string, options: RequestInit, timeout = 30000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return res;
    } catch (e: any) {
      clearTimeout(id);
      if (e?.name === "AbortError") throw new Error("timeout");
      throw e;
    }
  };

  const handleLogin = async () => {
    if (!userId || !password) {
      Alert.alert("Required", "Please enter both your ID and password.");
      return;
    }
    if (!API_BASE_URL) {
      Alert.alert(
        "Configuration Error",
        "Please set EXPO_PUBLIC_API_BASE_URL and restart the app."
      );
      return;
    }

    try {
      setLoading(true);

      const res = await fetchWithTimeout(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, password }),
      });

      const text = await res.text();

      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        Alert.alert("Server Error", "Received an invalid response from the server.");
        return;
      }

      if (!res.ok || data?.success === false) {
        Alert.alert("Login Failed", data?.message || `HTTP ${res.status}`);
        return;
      }

      await AsyncStorage.setItem("userId", userId);
      if (data?.token) await AsyncStorage.setItem("token", data.token);
      if (data?.refreshToken) await AsyncStorage.setItem("refreshToken", data.refreshToken);

      Alert.alert("Welcome", "Login successful!", [
        { text: "OK", onPress: () => router.replace("/Home/HomePage") },
      ]);
    } catch (err: any) {
      console.log("[DEBUG] Login error:", err?.name, err?.message, err?.code);
      if (err?.message === "timeout" || err?.name === "AbortError") {
        Alert.alert("Timeout", `[${err?.name}] ${err?.message}`);
      } else {
        Alert.alert("Connection Error", `[${err?.name}] ${err?.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen />

      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.keyboard}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.shell}>
              <View style={styles.brandRow}>
                <View style={styles.logoMark}>
                  <Image
                    source={require("../../../assets/images/CareLinkicon.png")}
                    style={styles.logo}
                    resizeMode="contain"
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.kicker}>CARELINK ACCESS</Text>
                  <Text style={styles.brand}>Welcome back</Text>
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.loginTitle}>{loading ? "Checking credentials" : "Login"}</Text>

                <View style={styles.inputShell}>
                  <Ionicons name="person-outline" size={20} color={palette.muted} />
                  <TextInput
                    style={styles.input}
                    placeholder="User ID"
                    placeholderTextColor={palette.faint}
                    value={userId}
                    onChangeText={setUserId}
                    autoCapitalize="none"
                    editable={!loading}
                  />
                </View>

                <View style={styles.inputShell}>
                  <Ionicons name="lock-closed-outline" size={20} color={palette.muted} />
                  <TextInput
                    style={styles.input}
                    placeholder="Password"
                    secureTextEntry
                    placeholderTextColor={palette.faint}
                    value={password}
                    onChangeText={setPassword}
                    editable={!loading}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.loginButton, loading && styles.disabled]}
                  onPress={handleLogin}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color={palette.surface} />
                  ) : (
                    <Ionicons name="shield-checkmark-outline" size={20} color={palette.surface} />
                  )}
                  <Text style={styles.loginButtonText}>{loading ? "Please wait" : "Login"}</Text>
                </TouchableOpacity>

                <View style={styles.authLinksRow}>
                  <TouchableOpacity onPress={() => router.push("/(tabs)/auth/find-id")} disabled={loading}>
                    <Text style={[styles.linkText, loading && styles.disabledText]}>Find ID</Text>
                  </TouchableOpacity>
                  <View style={styles.divider} />
                  <TouchableOpacity onPress={() => router.push("/(tabs)/auth/forgot-password")} disabled={loading}>
                    <Text style={[styles.linkText, loading && styles.disabledText]}>Forgot Password?</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  onPress={() => router.push("/(tabs)/auth/data-agreement")}
                  disabled={loading}
                  style={styles.signupLink}
                >
                  <Text style={[styles.signupText, loading && styles.disabledText]}>
                    {"Don't have an account? "}
                    <Text style={styles.signupStrong}>Sign Up</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  keyboard: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xl,
  },
  shell: {
    ...webShell,
    gap: spacing.lg,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  logoMark: {
    width: 52,
    height: 52,
    borderRadius: radius.card,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: "center",
    justifyContent: "center",
    ...shadow,
  },
  logo: {
    width: 34,
    height: 34,
    tintColor: palette.primary,
  },
  kicker: {
    color: palette.primary,
    fontSize: typeScale.caption,
    fontWeight: "900",
  },
  brand: {
    color: palette.ink,
    fontSize: typeScale.title,
    fontWeight: "900",
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.line,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow,
  },
  loginTitle: {
    color: palette.ink,
    fontSize: typeScale.section,
    fontWeight: "900",
  },
  inputShell: {
    minHeight: 54,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surfaceMuted,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: palette.ink,
    fontSize: typeScale.body,
    fontWeight: "700",
    paddingVertical: 0,
  },
  loginButton: {
    minHeight: 54,
    borderRadius: radius.card,
    backgroundColor: palette.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    ...pressShadow,
  },
  disabled: {
    opacity: 0.68,
  },
  loginButtonText: {
    color: palette.surface,
    fontSize: typeScale.body,
    fontWeight: "900",
  },
  authLinksRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  divider: {
    width: 1,
    height: 16,
    backgroundColor: palette.line,
  },
  linkText: {
    color: palette.primaryDark,
    fontSize: typeScale.meta,
    fontWeight: "800",
  },
  signupLink: {
    alignItems: "center",
  },
  signupText: {
    color: palette.muted,
    fontSize: typeScale.meta,
    textAlign: "center",
    fontWeight: "700",
  },
  signupStrong: {
    color: palette.primaryDark,
    fontWeight: "900",
  },
  disabledText: {
    opacity: 0.6,
  },
});
