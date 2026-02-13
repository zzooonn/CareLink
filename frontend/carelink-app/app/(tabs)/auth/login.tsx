import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
  Alert,
} from "react-native";
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
      Alert.alert("⚠️", "아이디와 비밀번호를 모두 입력해주세요.");
      return;
    }
    if (!API_BASE_URL) {
      Alert.alert(
        "환경 변수 미설정",
        "EXPO_PUBLIC_API_BASE_URL를 설정한 뒤 앱을 다시 시작해주세요."
      );
      return;
    }

    try {
      setLoading(true);
      console.log("API_BASE_URL:", API_BASE_URL);

      console.log("🔵 요청 시작");
      const res = await fetchWithTimeout(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ userId, password }),
      });

      console.log("🟢 응답 도착:", res.status);
      const text = await res.text();
      console.log("📄 응답 내용:", text);

      // ✅ 응답이 JSON이 아닐 수 있으니 안전 파싱
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        // ngrok/서버 에러가 HTML/텍스트로 오면 여기로 들어옴
        Alert.alert("🚫 서버 응답 오류", "서버가 JSON이 아닌 응답을 반환했습니다.");
        return;
      }

      if (!res.ok || data?.success === false) {
        Alert.alert("❌ 로그인 실패", data?.message || `HTTP ${res.status}`);
        return;
      }

      // ✅ 여기서 핵심: 로그인한 userId 저장
      await AsyncStorage.setItem("userId", userId);

      // (선택) 토큰도 저장하고 싶으면:
      // if (data?.token) await AsyncStorage.setItem("token", data.token);

      Alert.alert("✅ 로그인 성공", "환영합니다!", [
        { text: "확인", onPress: () => router.replace("/Home/HomePage") },
      ]);
    } catch (err: any) {
      console.error(err);
      if (err?.message === "timeout" || err?.name === "AbortError") {
        Alert.alert("⏰ 서버 응답 지연", "서버가 응답하지 않습니다. 잠시 후 다시 시도해주세요.");
      } else {
        Alert.alert("🚫 서버 오류", "서버에 연결할 수 없습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen />

      <View style={styles.container}>
        {/* 로고 + CareLink 한 줄 */}
        <View style={styles.brandContainer}>
          <Image
            source={require("../../../assets/images/CareLinkicon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.brand}>CareLink</Text>
        </View>

        {/* 로그인 카드 */}
        <View style={styles.card}>
          <Text style={styles.loginTitle}>{loading ? "Logging in..." : "Login"}</Text>

          <TextInput
            style={styles.input}
            placeholder="User ID"
            placeholderTextColor="#999"
            value={userId}
            onChangeText={setUserId}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            secureTextEntry
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            style={[styles.loginButton, loading && { opacity: 0.6 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.loginButtonText}>{loading ? "Please wait..." : "Login"}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push("/(tabs)/auth/forgot-password")} disabled={loading}>
            <Text style={[styles.forgotText, loading && { opacity: 0.6 }]}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7f9fb",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: width * 0.08,
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
  forgotText: {
    color: "#0ea5e9",
    fontSize: width * 0.04,
    marginTop: height * 0.015,
  },
});
