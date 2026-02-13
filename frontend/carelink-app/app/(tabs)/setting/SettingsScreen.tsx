// app/(tabs)/setting/SettingsScreen.tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

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
const GRID_BOTTOM = H * 0.02; // ✅ 스크롤 제거하니 아래 여백 줄임
const GRID_V_GAP = H * 0.02;

const BORDER = Math.max(1, W * 0.0025);

/* ✅ 어떤 화면에서도 다 들어오게: 버튼 높이 상한(너무 커지지 않게) */
const BTN_H = Math.min(H * 0.12, 92);

export default function SettingsScreen() {
  const router = useRouter();
  const go = (path: Href) => router.push(path);

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      {/* ✅ ScrollView 제거: 스크롤 자체가 안 됨 */}
      <View style={styles.container}>
        {/* 위 영역(타이틀/프로필/그리드) */}
        <View>
          {/* Title */}
          <Text style={styles.title}>Settings</Text>
          <View style={styles.separator} />

          {/* Profile / Family */}
          <View style={styles.center}>
            <Image
              source={{
                uri: "https://images.unsplash.com/photo-1604881991720-f91add269bed?q=80&w=400&auto=format&fit=crop",
              }}
              style={styles.avatar}
            />
            <Text style={styles.family}>Family Care</Text>
          </View>

          {/* Feature Buttons (2*2 유지) */}
          <View style={styles.grid}>
            <FeatureButton label="Vital Data Log" onPress={() => go("/(tabs)/Home/Vitals")} />
            <FeatureButton label="Medication Planner" onPress={() => go("/(tabs)/Home/Medication")} />
            <FeatureButton label="Brain Training" onPress={() => go("/(tabs)/setting/BrainTraining")} />
            <FeatureButton label="Manage Caregivers" onPress={() => go("/(tabs)/Home/Caregivers")} />
          </View>
        </View>

        {/* 아래 영역(Log out 고정 느낌) */}
        <TouchableOpacity
          onPress={() => go("/(tabs)/auth/login")}
          style={styles.logoutBtn}
          activeOpacity={0.85}
        >
          <Ionicons name="log-out-outline" size={FS_LOGOUT * 1.1} color="#ef4444" />
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </View>
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

  /* ✅ 한 화면에 무조건 보이게: 위/아래 영역을 space-between으로 배치 */
  container: {
    flex: 1,
    paddingHorizontal: HP,
    paddingTop: H * 0.01,
    paddingBottom: H * 0.03,
    justifyContent: "space-between",
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

  /* ✅ 2열 유지: rowGap/columnGap 사용 안 함 */
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

  /* ✅ Log out 버튼 꾸미기 */
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
  },
  logoutText: {
    color: "#ef4444",
    fontWeight: "800",
    fontSize: FS_LOGOUT,
  },
});
