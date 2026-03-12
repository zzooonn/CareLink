import React, { useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
  Alert,
  ActivityIndicator,
} from "react-native";
import { ScaledText as Text } from "../../../components/ScaledText";
import { useRouter } from "expo-router";

const { width, height } = Dimensions.get("window");
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export default function ForgotPassword() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!userId.trim() || !fullName.trim()) {
      Alert.alert("Required", "Please enter both your ID and full name.");
      return;
    }
    if (!API_BASE_URL) {
      Alert.alert("Configuration Error", "Server address is not configured.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userId.trim(), fullName: fullName.trim() }),
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {}

      if (!res.ok) {
        Alert.alert("Verification Failed", data?.message || "ID or name does not match.");
        return;
      }

      router.push({
        pathname: "/(tabs)/auth/reset-password",
        params: {
          userId: userId.trim(),
          resetToken: data?.resetToken ?? "",
        },
      });
    } catch {
      Alert.alert("Connection Error", "Could not connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.brandContainer}>
        <Image
          source={require("../../../assets/images/CareLinkicon.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.brand}>CareLink</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.loginTitle}>Forgot Password?</Text>
        <Text style={styles.subtitle}>
          Enter the ID and name you registered with.
        </Text>

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
          placeholder="Full Name"
          placeholderTextColor="#999"
          value={fullName}
          onChangeText={setFullName}
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.loginButton, loading && { opacity: 0.6 }]}
          onPress={handleReset}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.loginButtonText}>Reset password</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.back()}
          disabled={loading}
          style={{ marginTop: height * 0.02 }}
        >
          <Text style={styles.backText}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    </View>
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
    marginBottom: height * 0.01,
    color: "#111",
  },
  subtitle: {
    fontSize: width * 0.035,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: height * 0.025,
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
  backText: {
    color: "#0ea5e9",
    fontSize: width * 0.038,
  },
});
