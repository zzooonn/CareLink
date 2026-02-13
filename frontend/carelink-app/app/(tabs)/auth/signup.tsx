import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  Image,
  Dimensions,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";

const { width, height } = Dimensions.get("window");

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
const NGROK_HEADER = { "ngrok-skip-browser-warning": "true" as const };

const AVATAR_LIST = [
  { id: 1, source: require("../../../assets/avatar/avatar1.png") },
  { id: 2, source: require("../../../assets/avatar/avatar2.png") },
  { id: 3, source: require("../../../assets/avatar/avatar3.png") },
  { id: 4, source: require("../../../assets/avatar/avatar4.png") },
  { id: 5, source: require("../../../assets/avatar/avatar5.png") },
  { id: 6, source: require("../../../assets/avatar/avatar6.png") },
  { id: 7, source: require("../../../assets/avatar/avatar7.png") },
  { id: 8, source: require("../../../assets/avatar/avatar8.png") },
  { id: 9, source: require("../../../assets/avatar/avatar9.png") },
  { id: 10, source: require("../../../assets/avatar/avatar10.png") },
  { id: 11, source: require("../../../assets/avatar/avatar11.png") },
  { id: 12, source: require("../../../assets/avatar/avatar12.png") },
] as const;

type GenderOption = "MAN" | "FEMALE" | "UNKNOWN";

function toApiGender(opt: GenderOption) {
  if (opt === "MAN") return "M";
  if (opt === "FEMALE") return "F";
  return "UNKNOWN";
}

function formatDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isValidBirthDate(v: string) {
  if (!v) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

// ✅ 간단 비밀번호 규칙 (필요하면 강화 가능)
function isStrongPassword(pw: string) {
  // 최소 6자 예시 (원하면 8자 + 특수문자 등으로 바꿔줄게)
  return pw.length >= 6;
}

export default function SignUp() {
  const router = useRouter();

  // 입력값
  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState<GenderOption>("UNKNOWN");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [guardianId, setGuardianId] = useState("");

  // ✅ 비밀번호 추가
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [pwVisible, setPwVisible] = useState(false);
  const [pwConfirmVisible, setPwConfirmVisible] = useState(false);

  // 체크박스/아바타
  const [isGuardian, setIsGuardian] = useState(false);
  const [selectedAvatarId, setSelectedAvatarId] = useState<number>(1);

  const [signUpLoading, setSignUpLoading] = useState(false);

  // DatePicker 상태
  const [showBirthPicker, setShowBirthPicker] = useState(false);
  const [birthPickerValue, setBirthPickerValue] = useState<Date>(new Date(2000, 0, 1));

  const currentAvatar = useMemo(
    () =>
      AVATAR_LIST.find((item) => item.id === selectedAvatarId)?.source ??
      AVATAR_LIST[0].source,
    [selectedAvatarId]
  );

  const onBirthChange = (event: any, selected?: Date) => {
    if (Platform.OS === "android") setShowBirthPicker(false);
    if (event?.type === "dismissed") return;

    if (selected) {
      setBirthPickerValue(selected);
      setBirthDate(formatDate(selected));
    }
  };

  const handleSignUp = async () => {
    if (!API_BASE_URL) {
      Alert.alert("Missing env var", "EXPO_PUBLIC_API_BASE_URL 를 설정하고 앱을 재시작하세요.");
      return;
    }

    // 필수값 체크
    if (!userId.trim() || !name.trim() || !phone.trim()) {
      Alert.alert("알림", "아이디, 이름, 전화번호는 필수 입력사항입니다.");
      return;
    }

    // ✅ 비밀번호 체크
    if (!password.trim()) {
      Alert.alert("알림", "비밀번호를 입력해주세요.");
      return;
    }
    if (!isStrongPassword(password.trim())) {
      Alert.alert("알림", "비밀번호는 최소 6자 이상이어야 합니다.");
      return;
    }
    if (password !== passwordConfirm) {
      Alert.alert("알림", "비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    // 생년월일 형식 체크
    if (!isValidBirthDate(birthDate.trim())) {
      Alert.alert("알림", "생년월일 형식이 올바르지 않습니다. (YYYY-MM-DD)");
      return;
    }

    const role = isGuardian ? "GUARDIAN" : "PATIENT";
    const normalizedGuardianId = isGuardian ? "" : guardianId.trim();

    // ✅ 서버 전송 payload (백엔드 DTO에 맞게 키 조정 필요할 수 있음)
    const payload = {
      userId: userId.trim(),
      password: password.trim(), // ✅ 추가
      name: name.trim(),
      gender: toApiGender(gender),
      birthDate: birthDate.trim(),
      phone: phone.trim(),
      address: address.trim(),
      role,
      guardianId: normalizedGuardianId,
      profileImageId: selectedAvatarId,
    };

    console.log("🚀 [Signup] payload:", payload);

    // 백엔드 라우트
    const SIGNUP_ENDPOINT = `${API_BASE_URL}/api/auth/signup`;

    try {
      setSignUpLoading(true);

      const res = await fetch(SIGNUP_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...NGROK_HEADER,
        },
        body: JSON.stringify(payload),
      });

      const text = await res.text();

      if (!res.ok) {
        console.log("❌ Signup failed:", res.status, text);
        Alert.alert("실패", text || "회원가입 중 오류가 발생했습니다.");
        return;
      }

      Alert.alert("성공", "회원가입이 완료되었습니다!");
      router.push("../auth/login");
    } catch (e) {
      console.error("Signup Error:", e);
      Alert.alert("에러", "서버와 연결할 수 없습니다.");
    } finally {
      setSignUpLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <ImageBackground
        source={require("../../../assets/images/signupbackground.png")}
        style={styles.background}
        resizeMode="cover"
      >
        {/* 헤더 */}
        <View style={styles.header}>
          <Image
            source={require("../../../assets/images/CareLinkicon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.brand}>CareLink</Text>
          <Text style={styles.slogan}>Track health, stay connected</Text>
        </View>

        {/* 카드 */}
        <View style={styles.card}>
          <Text style={styles.title}>Sign Up</Text>

          {/* 아바타 */}
          <View style={styles.avatarSection}>
            <Text style={styles.avatarLabel}>Choose Your Profile</Text>

            <View style={styles.selectedAvatarWrapper}>
              <Image source={currentAvatar} style={styles.selectedAvatar} />
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.avatarScrollContent}
            >
              {AVATAR_LIST.map((avatar) => (
                <TouchableOpacity
                  key={avatar.id}
                  onPress={() => setSelectedAvatarId(avatar.id)}
                  activeOpacity={0.7}
                  style={[
                    styles.avatarOption,
                    selectedAvatarId === avatar.id && styles.avatarOptionSelected,
                  ]}
                >
                  <Image source={avatar.source} style={styles.avatarOptionImg} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* User ID */}
          <TextInput
            style={styles.input}
            placeholder="User ID"
            placeholderTextColor="#999"
            value={userId}
            onChangeText={setUserId}
            autoCapitalize="none"
          />

          {/* ✅ Password */}
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Password"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!pwVisible}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.pwToggle}
              onPress={() => setPwVisible((v) => !v)}
              activeOpacity={0.85}
            >
              <Text style={styles.pwToggleText}>{pwVisible ? "Hide" : "Show"}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: height * 0.02 }} />

          {/* ✅ Password Confirm */}
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="Confirm Password"
              placeholderTextColor="#999"
              value={passwordConfirm}
              onChangeText={setPasswordConfirm}
              secureTextEntry={!pwConfirmVisible}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.pwToggle}
              onPress={() => setPwConfirmVisible((v) => !v)}
              activeOpacity={0.85}
            >
              <Text style={styles.pwToggleText}>{pwConfirmVisible ? "Hide" : "Show"}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: height * 0.02 }} />

          {/* Name */}
          <TextInput
            style={styles.input}
            placeholder="Name"
            placeholderTextColor="#999"
            value={name}
            onChangeText={setName}
          />

          {/* Gender */}
          <View style={styles.genderContainer}>
            {(["MAN", "FEMALE", "UNKNOWN"] as GenderOption[]).map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.genderButton,
                  gender === option && styles.genderButtonSelected,
                ]}
                onPress={() => setGender(option)}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.genderText,
                    gender === option && styles.genderTextSelected,
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 생년월일 (달력) */}
          <TouchableOpacity activeOpacity={0.85} onPress={() => setShowBirthPicker(true)}>
            <View pointerEvents="none">
              <TextInput
                style={styles.input}
                placeholder="Date of Birth (YYYY-MM-DD)"
                placeholderTextColor="#999"
                value={birthDate}
                editable={false}
              />
            </View>
          </TouchableOpacity>

          {showBirthPicker && Platform.OS === "android" && (
            <DateTimePicker
              value={birthPickerValue}
              mode="date"
              display="calendar"
              onChange={onBirthChange}
              maximumDate={new Date()}
            />
          )}

          {showBirthPicker && Platform.OS === "ios" && (
            <View style={styles.iosPickerBox}>
              <DateTimePicker
                value={birthPickerValue}
                mode="date"
                display="spinner"
                onChange={onBirthChange}
                maximumDate={new Date()}
              />
              <TouchableOpacity
                style={styles.iosDoneBtn}
                onPress={() => setShowBirthPicker(false)}
                activeOpacity={0.9}
              >
                <Text style={styles.iosDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Phone */}
          <TextInput
            style={styles.input}
            placeholder="Phone Number"
            keyboardType="phone-pad"
            placeholderTextColor="#999"
            value={phone}
            onChangeText={setPhone}
          />

          {/* Address */}
          <TextInput
            style={styles.input}
            placeholder="Address"
            placeholderTextColor="#999"
            value={address}
            onChangeText={setAddress}
          />

          {/* Guardian ID (환자일 때만) */}
          {!isGuardian && (
            <TextInput
              style={styles.input}
              placeholder="Guardian ID (Optional)"
              placeholderTextColor="#999"
              value={guardianId}
              onChangeText={setGuardianId}
              autoCapitalize="none"
            />
          )}

          {/* 체크박스 */}
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() =>
              setIsGuardian((prev) => {
                const next = !prev;
                if (next) setGuardianId("");
                return next;
              })
            }
            activeOpacity={0.85}
          >
            <View style={[styles.checkbox, isGuardian && styles.checkedBox]} />
            <Text style={styles.checkboxLabel}>I am a guardian</Text>
          </TouchableOpacity>

          {/* 가입 버튼 */}
          <TouchableOpacity
            style={[styles.joinButton, signUpLoading && { opacity: 0.6 }]}
            onPress={handleSignUp}
            disabled={signUpLoading}
            activeOpacity={0.9}
          >
            {signUpLoading ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ActivityIndicator color="#fff" />
                <Text style={styles.joinButtonText}>Signing up...</Text>
              </View>
            ) : (
              <Text style={styles.joinButtonText}>Join</Text>
            )}
          </TouchableOpacity>
        </View>
      </ImageBackground>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  header: {
    alignItems: "center",
    marginTop: height * 0.08,
    marginBottom: height * 0.02,
  },
  logo: { width: width * 0.12, height: height * 0.06 },
  brand: {
    fontSize: width * 0.07,
    fontWeight: "bold",
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  slogan: {
    color: "#090909ff",
    fontWeight: "500",
    fontSize: width * 0.035,
    marginTop: height * 0.005,
  },
  card: {
    backgroundColor: "#fff",
    width: "88%",
    borderRadius: 20,
    paddingVertical: height * 0.04,
    paddingHorizontal: width * 0.06,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
    marginBottom: height * 0.05,
  },
  title: {
    fontSize: width * 0.06,
    fontWeight: "bold",
    color: "#111",
    marginBottom: height * 0.02,
    textAlign: "center",
  },

  avatarSection: { alignItems: "center", marginBottom: height * 0.03 },
  avatarLabel: {
    fontSize: width * 0.035,
    color: "#6b7280",
    marginBottom: height * 0.015,
    fontWeight: "600",
  },
  selectedAvatarWrapper: {
    width: width * 0.25,
    height: width * 0.25,
    borderRadius: (width * 0.25) / 2,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: height * 0.02,
    borderWidth: 4,
    borderColor: "#e0f2fe",
    overflow: "hidden",
  },
  selectedAvatar: { width: "100%", height: "100%", resizeMode: "cover" },
  avatarScrollContent: { paddingHorizontal: 5, paddingVertical: 5, gap: 12 },
  avatarOption: {
    width: width * 0.14,
    height: width * 0.14,
    borderRadius: (width * 0.14) / 2,
    borderWidth: 2,
    borderColor: "#e2e8f0",
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  avatarOptionSelected: {
    borderColor: "#0ea5e9",
    borderWidth: 3,
    transform: [{ scale: 1.05 }],
  },
  avatarOptionImg: { width: "100%", height: "100%", resizeMode: "cover" },

  // ✅ 비밀번호 행
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  pwToggle: {
    marginLeft: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#e0f2fe",
  },
  pwToggleText: {
    color: "#0284c7",
    fontWeight: "800",
  },

  genderContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: height * 0.02,
    gap: 10,
  },
  genderButton: {
    flex: 1,
    backgroundColor: "#f1f3f6",
    borderRadius: 10,
    paddingVertical: height * 0.015,
    alignItems: "center",
    justifyContent: "center",
  },
  genderButtonSelected: { backgroundColor: "#0ea5e9" },
  genderText: { fontSize: width * 0.035, fontWeight: "600", color: "#999" },
  genderTextSelected: { color: "#fff", fontWeight: "bold" },

  input: {
    backgroundColor: "#f1f3f6",
    borderRadius: 10,
    paddingVertical: height * 0.015,
    paddingHorizontal: width * 0.04,
    fontSize: width * 0.04,
    color: "#333",
    marginBottom: height * 0.02,
  },

  iosPickerBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: height * 0.02,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  iosDoneBtn: {
    marginTop: 10,
    backgroundColor: "#0ea5e9",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  iosDoneText: { color: "#fff", fontWeight: "800" },

  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: height * 0.005,
    marginBottom: height * 0.02,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: "#0ea5e9",
    borderRadius: 4,
    marginRight: 8,
  },
  checkedBox: { backgroundColor: "#0ea5e9" },
  checkboxLabel: { fontSize: width * 0.04, color: "#111" },

  joinButton: {
    backgroundColor: "#0ea5e9",
    borderRadius: 10,
    paddingVertical: height * 0.018,
    alignItems: "center",
    marginTop: height * 0.01,
  },
  joinButtonText: { color: "#fff", fontSize: width * 0.045, fontWeight: "bold" },
});
