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

export default function FindId() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [loading, setLoading] = useState(false);

  const handleFindId = async () => {
    if (!name.trim() || !birthDate.trim()) {
      Alert.alert("필수 입력", "이름과 생년월일을 모두 입력해주세요.");
      return;
    }
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(birthDate.trim())) {
      Alert.alert("형식 오류", "생년월일을 YYYY-MM-DD 형식으로 입력해주세요.\n예) 1990-01-15");
      return;
    }
    if (!API_BASE_URL) {
      Alert.alert("설정 오류", "서버 주소가 설정되지 않았습니다.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/auth/find-id`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), birthDate: birthDate.trim() }),
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {}

      if (!res.ok) {
        Alert.alert("조회 실패", data?.message || "일치하는 계정을 찾을 수 없습니다.");
        return;
      }

      Alert.alert(
        "아이디 찾기 완료",
        `회원님의 아이디는\n\n"${data.userId}"\n\n입니다.`,
        [{ text: "로그인하기", onPress: () => router.replace("/(tabs)/auth/login") }]
      );
    } catch {
      Alert.alert("연결 오류", "서버에 연결할 수 없습니다. 다시 시도해주세요.");
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
        <Text style={styles.title}>아이디 찾기</Text>
        <Text style={styles.subtitle}>
          가입 시 등록한 이름과 생년월일을 입력해주세요.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="이름"
          placeholderTextColor="#999"
          value={name}
          onChangeText={setName}
          editable={!loading}
        />
        <TextInput
          style={styles.input}
          placeholder="생년월일 (예: 1990-01-15)"
          placeholderTextColor="#999"
          value={birthDate}
          onChangeText={setBirthDate}
          keyboardType="numeric"
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.button, loading && { opacity: 0.6 }]}
          onPress={handleFindId}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>아이디 찾기</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.back()}
          disabled={loading}
          style={{ marginTop: height * 0.02 }}
        >
          <Text style={styles.backText}>뒤로 가기</Text>
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
