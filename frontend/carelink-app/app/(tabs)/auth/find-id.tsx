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
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from "react-native";
import { ScaledText as Text } from "../../../components/ScaledText";
import { useRouter } from "expo-router";

const { width, height } = Dimensions.get("window");
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

export default function FindId() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDateChange = (text: string) => {
    const cleaned = text.replace(/\D/g, "");
    let formatted = cleaned;
    if (cleaned.length > 4 && cleaned.length <= 6) {
      formatted = `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
    } else if (cleaned.length > 6) {
      formatted = `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
    }
    setBirthDate(formatted);
  };

  const handleFindId = async () => {
    if (!name.trim() || !birthDate.trim() || !phone.trim()) {
      Alert.alert("Required Field", "Please enter your name, date of birth, and phone number.");
      return;
    }
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(birthDate.trim())) {
      Alert.alert("Format Error", "Please enter your date of birth in YYYY-MM-DD format.\ne.g., 1990-01-15");
      return;
    }
    if (!API_BASE_URL) {
      Alert.alert("Configuration Error", "Server address is not configured.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/auth/find-id`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), birthDate: birthDate.trim(), phone: phone.trim() }),
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {}

      if (!res.ok) {
        Alert.alert("Search Failed", data?.message || "Could not find a matching account.");
        return;
      }

      Alert.alert(
        "Find ID Complete",
        `Your ID is\n\n"${data.userId}"`,
        [{ text: "Go to Login", onPress: () => router.replace("/(tabs)/auth/login") }]
      );
    } catch {
      Alert.alert("Connection Error", "Cannot connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#f7f9fb" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandContainer}>
          <Image
            source={require("../../../assets/images/CareLinkicon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.brand}>CareLink</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Find ID</Text>
          <Text style={styles.subtitle}>
            Enter the name, date of birth, and phone number registered to your account.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Name"
            placeholderTextColor="#999"
            value={name}
            onChangeText={setName}
            editable={!loading}
          />
          <TextInput
            style={styles.input}
            placeholder="Date of Birth (e.g. 1990-01-15)"
            placeholderTextColor="#999"
            value={birthDate}
            onChangeText={handleDateChange}
            keyboardType="numeric"
            maxLength={10}
            editable={!loading}
          />
          <TextInput
            style={styles.input}
            placeholder="Phone Number"
            placeholderTextColor="#999"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.button, loading && { opacity: 0.6 }]}
            onPress={handleFindId}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>Find ID</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.back()}
            disabled={loading}
            style={{ marginTop: height * 0.02 }}
          >
            <Text style={styles.backText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#f7f9fb",
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
  title: {
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
  button: {
    backgroundColor: "#0ea5e9",
    borderRadius: 10,
    width: "100%",
    paddingVertical: height * 0.018,
    alignItems: "center",
    marginTop: height * 0.01,
  },
  buttonText: {
    color: "#fff",
    fontSize: width * 0.045,
    fontWeight: "bold",
  },
  backText: {
    color: "#0ea5e9",
    fontSize: width * 0.038,
  },
});
