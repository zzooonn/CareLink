import React, { useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from "react-native";
import { ScaledText as Text } from "../../../components/ScaledText";
import { useRouter, Stack } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width, height } = Dimensions.get("window");
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export default function Login() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchWithTimeout = async (url: string, options: any, timeout = 10000) => {
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
      if (err?.message === "timeout" || err?.name === "AbortError") {
        Alert.alert("Timeout", "Server is not responding. Please try again.");
      } else {
        Alert.alert("Connection Error", "Could not connect to the server.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen />

      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: "#f7f9fb" }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
        {/* Brand Header */}
        <View style={styles.brandContainer}>
          <Image
            source={require("../../../assets/images/CareLinkicon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.brand}>CareLink</Text>
        </View>

        {/* Login Card */}
        <View style={styles.card}>
          <Text style={styles.loginTitle}>{loading ? "Logging in..." : "Login"}</Text>

          <TextInput
            style={styles.input}
            placeholder="User ID"
            placeholderTextColor="#999"
            value={userId}
            onChangeText={setUserId}
            autoCapitalize="none"
            editable={!loading}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            secureTextEntry
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.loginButton, loading && { opacity: 0.6 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.loginButtonText}>{loading ? "Please wait..." : "Login"}</Text>
          </TouchableOpacity>

          <View style={styles.authLinksRow}>
            <TouchableOpacity onPress={() => router.push("/(tabs)/auth/find-id")} disabled={loading}>
              <Text style={[styles.forgotText, loading && { opacity: 0.6 }]}>Find ID</Text>
            </TouchableOpacity>
            <Text style={styles.divider}>|</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/auth/forgot-password")} disabled={loading}>
              <Text style={[styles.forgotText, loading && { opacity: 0.6 }]}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => router.push("/(tabs)/auth/data-agreement")} disabled={loading} style={{ marginTop: height * 0.02 }}>
            <Text style={[styles.signupText, loading && { opacity: 0.6 }]}>
              Don't have an account? <Text style={{ fontWeight: "bold" }}>Sign Up</Text>
            </Text>
          </TouchableOpacity>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: width * 0.08,
    paddingVertical: height * 0.05,
  },
  brandContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: height * 0.04,
  },
  logo: {
    width: width * 0.1,
    height: height * 0.05,
    marginRight: width * 0.02,
  },
  brand: {
    fontSize: width * 0.07,
    fontWeight: "bold",
    color: "#111",
  },
  card: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: height * 0.04,
    paddingHorizontal: width * 0.06,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
    alignItems: "center",
  },
  loginTitle: {
    fontSize: width * 0.06,
    fontWeight: "bold",
    marginBottom: height * 0.03,
    color: "#111",
  },
  input: {
    width: "100%",
    backgroundColor: "#f1f3f6",
    borderRadius: 10,
    paddingVertical: height * 0.015,
    paddingHorizontal: width * 0.04,
    fontSize: width * 0.04,
    marginBottom: height * 0.02,
    color: "#333",
  },
  loginButton: {
    backgroundColor: "#0ea5e9",
    borderRadius: 10,
    width: "100%",
    paddingVertical: height * 0.018,
    alignItems: "center",
    marginTop: height * 0.01,
  },
  loginButtonText: {
    color: "#fff",
    fontSize: width * 0.045,
    fontWeight: "bold",
  },
  authLinksRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: height * 0.015,
    gap: width * 0.03,
  },
  divider: {
    color: "#d1d5db",
    fontSize: width * 0.04,
  },
  forgotText: {
    color: "#0ea5e9",
    fontSize: width * 0.04,
  },
  signupText: {
    color: "#6b7280",
    fontSize: width * 0.038,
    textAlign: "center",
  },
});