// app/(tabs)/setting/SettingsScreen.tsx
import React, { useCallback, useState } from "react";
import {
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  Alert,
  ScrollView,
} from "react-native";
import { ScaledText as Text } from "../../../components/ScaledText";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFontSize, type FontScale } from "../../../contexts/FontSizeContext";
import { useAuth } from "../../../contexts/AuthContext";

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

function pickAvatarSource(id?: number) {
  const safeId = id && id >= 1 && id <= 12 ? id : 1;
  return AVATAR_LIST.find((a) => a.id === safeId)?.source ?? AVATAR_LIST[0].source;
}

const { width: W, height: H } = Dimensions.get("window");

/* ---------- Responsive Tokens (Vitals.tsx 스타일 참고) ---------- */
const HP = W * 0.05;

const FS_TITLE = W * 0.05;
const FS_FAMILY = W * 0.042;
const FS_BTN = W * 0.036;
const FS_LOGOUT = W * 0.05;

const AV = W * 0.24;
const AV_R = W * 0.035;

const R_BTN = W * 0.035;
const PAD_BTN_H = W * 0.03;

const GRID_TOP = H * 0.02;
const GRID_BOTTOM = H * 0.02; 
const GRID_V_GAP = H * 0.02;

const BORDER = Math.max(1, W * 0.0025);

/* ✅ 어떤 화면에서도 다 들어오게: 버튼 높이 상한(너무 커지지 않게) */
const BTN_H = Math.min(H * 0.12, 92);

export default function SettingsScreen() {
  const router = useRouter();
  const go = (path: Href) => router.push(path);
  const { fontScale, setFontScale } = useFontSize();
  const { signOut } = useAuth();
  const [profileImageId, setProfileImageId] = useState<number>(1);
  const [userName, setUserName] = useState<string>("");

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.multiGet(["profileImageId", "userName"]).then((pairs) => {
        const imgVal = pairs[0][1];
        const nameVal = pairs[1][1];
        const n = Number(imgVal);
        if (!Number.isNaN(n) && n >= 1 && n <= 12) setProfileImageId(n);
        if (nameVal) setUserName(nameVal);
      });
    }, [])
  );

  const handleLogout = () => {
    Alert.alert(
      "Log out",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log out",
          style: "destructive",
          onPress: () => signOut(),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      {/* ✅ ScrollView 적용: flexGrow를 통해 화면 전체를 채우면서 스크롤 지원 */}
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 위 영역(타이틀/프로필/그리드) */}
        <View style={styles.topSection}>
          {/* Title */}
          <Text style={styles.title}>Settings</Text>
          <View style={styles.separator} />

          {/* Profile / Family */}
          <View style={styles.center}>
            <Image
              source={pickAvatarSource(profileImageId)}
              style={styles.avatar}
            />
            {!!userName && <Text style={styles.family}>{userName}</Text>}
          </View>

          {/* Feature Buttons (2*2 유지) */}
          <View style={styles.grid}>
            <FeatureButton label="Vital Data Log" onPress={() => go("/(tabs)/Home/Vitals")} />
            <FeatureButton label="Medication Planner" onPress={() => go("/(tabs)/Home/Medication")} />
            <FeatureButton label="Brain Training" onPress={() => go("/(tabs)/setting/BrainTraining")} />
            <FeatureButton label="Manage Caregivers" onPress={() => go("/(tabs)/Home/Caregivers")} />
          </View>

          {/* Text Size Selector */}
          <View style={styles.fontSizeSection}>
            <Text style={styles.fontSizeLabel}>Text Size</Text>
            <View style={styles.fontSizeRow}>
              {(["small", "normal", "large"] as FontScale[]).map((scale) => (
                <TouchableOpacity
                  key={scale}
                  style={[styles.fontSizeBtn, fontScale === scale && styles.fontSizeBtnActive]}
                  onPress={() => setFontScale(scale)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.fontSizeBtnText, fontScale === scale && styles.fontSizeBtnTextActive, { fontSize: scale === "small" ? W * 0.04 : scale === "normal" ? W * 0.052 : W * 0.065 }]}>
                    A
                  </Text>
                  <Text style={[styles.fontSizeSubText, fontScale === scale && styles.fontSizeBtnTextActive]}>
                    {scale === "small" ? "Small" : scale === "normal" ? "Normal" : "Large"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* ✅ 동적 여백: 내용이 꽉 차도 로그아웃 버튼 위에 최소한의 공간을 보장 */}
        <View style={{ height: H * 0.04 }} />
        
        {/* 아래 영역(Log out 고정 느낌) */}
        <TouchableOpacity
          onPress={handleLogout}
          style={styles.logoutBtn}
          activeOpacity={0.85}
        >
          <Ionicons name="log-out-outline" size={FS_LOGOUT * 1.1} color="#ef4444" />
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function FeatureButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.featureButton} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.featureButtonText} numberOfLines={2}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },

  /* ✅ ScrollView 컨텐츠 스타일 설정 */
  scrollContent: {
    flexGrow: 1, // 화면에 꽉 차지 않아도 전체 높이를 차지하도록 설정
    paddingHorizontal: HP,
    paddingTop: H * 0.01,
    paddingBottom: H * 0.03,
    justifyContent: "space-between", // topSection과 로그아웃 버튼을 위아래로 분리
  },

  topSection: {
    // 위쪽 컨텐츠들을 하나로 묶어주는 역할
  },

  title: {
    textAlign: "center",
    fontSize: FS_TITLE,
    fontWeight: "800",
    color: "#111827",
    marginTop: H * 0.008,
    marginBottom: H * 0.012,
  },
  separator: {
    height: BORDER,
    backgroundColor: "#e5e7eb",
    marginBottom: H * 0.018,
  },

  center: { alignItems: "center" },
  avatar: {
    width: AV,
    height: AV,
    borderRadius: AV_R,
    marginBottom: H * 0.012,
  },
  family: {
    fontWeight: "600",
    fontSize: FS_FAMILY,
    color: "#111827",
    marginBottom: H * 0.02,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: GRID_TOP,
    marginBottom: GRID_BOTTOM,
  },

  featureButton: {
    width: "48%",
    height: BTN_H,
    borderRadius: R_BTN,
    backgroundColor: "#28add8",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: PAD_BTN_H,

    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: W * 0.015,
    shadowOffset: { width: 0, height: H * 0.003 },
    elevation: 2,

    marginBottom: GRID_V_GAP,
  },
  featureButtonText: {
    color: "#ffffff",
    fontSize: FS_BTN,
    lineHeight: FS_BTN * 1.2,
    fontWeight: "600",
    textAlign: "center",
  },

  fontSizeSection: {
    marginTop: H * 0.015,
  },
  fontSizeLabel: {
    fontSize: W * 0.038,
    fontWeight: "700",
    color: "#374151",
    marginBottom: H * 0.012,
  },
  fontSizeRow: {
    flexDirection: "row",
    gap: W * 0.03,
  },
  fontSizeBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: H * 0.012,
    borderRadius: W * 0.03,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    gap: H * 0.004,
  },
  fontSizeBtnActive: {
    borderColor: "#0ea5e9",
    backgroundColor: "#e0f2fe",
  },
  fontSizeBtnText: {
    color: "#6b7280",
    fontWeight: "700",
  },
  fontSizeBtnTextActive: {
    color: "#0284c7",
  },
  fontSizeSubText: {
    fontSize: W * 0.028,
    color: "#9ca3af",
    fontWeight: "500",
  },

  /* ✅ Log out 버튼: 자동 마진으로 항상 제일 아래로 밀어냄 */
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: W * 0.02,

    paddingVertical: H * 0.016,
    paddingHorizontal: W * 0.12,

    borderRadius: W * 0.06,
    borderWidth: BORDER,
    borderColor: "#ef4444",

    backgroundColor: "#fff5f5",
    
    marginTop: "auto", // 스크롤 안에서 하단 고정 역할을 함
  },
  logoutText: {
    color: "#ef4444",
    fontWeight: "800",
    fontSize: FS_LOGOUT,
  },
});