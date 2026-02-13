// app/(tabs)/Home/Emergency.tsx
import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Dimensions,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";

const { width: W, height: H } = Dimensions.get("window");

/* ---------- ✅ Caregivers 연동 (AsyncStorage) ---------- */
const CAREGIVERS_STORAGE_KEY = "caregivers:list";

type Caregiver = {
  id: string; // 로컬 row id
  userId: string; // 앱 회원 userId
  name: string;
  phone: string;
  avatarId: number; // 1~12
};

/* ---------- ✅ 로컬 아바타 (1~12) ---------- */
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

/* ---------- (선택) caregivers가 없을 때 보여줄 기본 연락처 ---------- */
type Contact = {
  id: string;
  name: string;
  role: string;
  phone: string;
};

const FALLBACK_CONTACTS: Contact[] = [
  { id: "1", name: "Dr. Emily Watson", role: "Family Physician", phone: "+1-555-0101" },
  { id: "2", name: "John Smith", role: "Brother", phone: "+1-555-0202" },
];

/* ---------- Responsive Tokens ---------- */
const HP = W * 0.05;
const VSP = H * 0.014;
const GAP = W * 0.03;

const FS_SECTION = W * 0.040;
const FS_NAME = W * 0.040;
const FS_ROLE = W * 0.032;
const FS_SOS = W * 0.048;
const FS_BTN = W * 0.036;
const FS_BODY = W * 0.035;

const R_CARD = W * 0.035;
const R_BTN = W * 0.03;

const PAD_CARD = W * 0.04;
const PAD_BTN_V = H * 0.012;
const PAD_BTN_H = W * 0.04;

const SOS_PV = H * 0.02;

const AVATAR_SIZE = W * 0.13;
const AVATAR_R = AVATAR_SIZE / 2;

const BORDER = Math.max(1, W * 0.0025);

export default function EmergencyScreen() {
  const [caregivers, setCaregivers] = useState<Caregiver[]>([]);

  // ✅ 화면 들어올 때마다 caregivers 최신 로드
  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        try {
          const raw = await AsyncStorage.getItem(CAREGIVERS_STORAGE_KEY);
          if (!raw) {
            setCaregivers([]);
            return;
          }
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setCaregivers(parsed);
          else setCaregivers([]);
        } catch (e) {
          console.log("Failed to load caregivers:", e);
          setCaregivers([]);
        }
      };

      load();
    }, [])
  );

  const onCall = (phone: string) => {
    const digits = phone.replace(/[^\d+]/g, "");
    if (!digits) return;
    Linking.openURL(`tel:${digits}`);
  };

  const onPressSOS = () => {
    Linking.openURL("tel:119");
  };

  const hasCaregivers = caregivers.length > 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: H * 0.05 }}
        showsVerticalScrollIndicator={false}
      >
        {/* SOS Button */}
        <TouchableOpacity
          style={styles.sosButton}
          onPress={onPressSOS}
          accessibilityRole="button"
          accessibilityLabel="SOS Emergency"
          activeOpacity={0.9}
        >
          <Text style={styles.sosText}>SOS Emergency</Text>
        </TouchableOpacity>

        {/* Emergency Contacts (Caregivers 연동) */}
        <Text style={styles.sectionTitle}>Emergency Contacts</Text>

        {hasCaregivers ? (
          <View style={{ gap: VSP }}>
            {caregivers.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={styles.contactCard}
                activeOpacity={0.9}
                onPress={() => onCall(c.phone)} // ✅ 카드 누르면 바로 전화
              >
                <Image source={pickAvatarSource(c.avatarId)} style={styles.contactAvatar} />

                <View style={{ flex: 1 }}>
                  <Text style={styles.contactName}>{c.name}</Text>
                  {/* role이 없으니 userId를 보조 정보로 */}
                  <Text style={styles.contactRole}>{c.userId}</Text>
                </View>

                <TouchableOpacity
                  onPress={() => onCall(c.phone)}
                  style={styles.callBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`Call ${c.name}`}
                  activeOpacity={0.9}
                >
                  <Text style={styles.callBtnText}>Call</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <>
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>연동된 Caregiver가 없어요.</Text>
              <Text style={styles.emptySub}>Caregivers에서 추가하면 여기에도 자동으로 표시돼요.</Text>
            </View>

            {/* (선택) 기존 더미 연락처 보여주고 싶으면 유지 */}
            <View style={{ gap: VSP }}>
              {FALLBACK_CONTACTS.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.contactCard}
                  activeOpacity={0.9}
                  onPress={() => onCall(c.phone)}
                >
                  <View style={[styles.contactAvatar, styles.fallbackAvatar]}>
                    <Text style={styles.fallbackAvatarText}>{c.name.trim().slice(0, 1)}</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.contactName}>{c.name}</Text>
                    <Text style={styles.contactRole}>{c.role}</Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => onCall(c.phone)}
                    style={styles.callBtn}
                    accessibilityRole="button"
                    accessibilityLabel={`Call ${c.name}`}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.callBtnText}>Call</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Vital Information */}
        <Text style={styles.sectionTitle}>Vital Information</Text>
        <View style={styles.card}>
          <Text style={styles.cardLine}>Blood Type: O+</Text>
          <Text style={styles.cardLine}>Allergies: Penicillin</Text>
          <Text style={styles.cardLine}>Medical Conditions: Asthma</Text>
        </View>

        {/* Health Resources */}
        <Text style={styles.sectionTitle}>Health Resources</Text>
        <View style={[styles.card, styles.resourceCard]}>
          <Text style={styles.resourceText}>
            Stay hydrated and maintain a balanced diet to support overall health. Visit the CareLink
            website for more tips and resources on managing your health effectively.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  container: {
    flex: 1,
    paddingHorizontal: HP,
  },

  /* SOS */
  sosButton: {
    backgroundColor: "#34c6ef",
    borderRadius: R_CARD,
    paddingVertical: SOS_PV,
    alignItems: "center",
    justifyContent: "center",

    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: W * 0.015,
    shadowOffset: { width: 0, height: H * 0.003 },

    marginBottom: H * 0.02,
  },
  sosText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: FS_SOS,
    letterSpacing: W * 0.0008,
  },

  /* Section title */
  sectionTitle: {
    fontSize: FS_SECTION,
    fontWeight: "700",
    color: "#111827",
    marginTop: H * 0.01,
    marginBottom: H * 0.01,
  },

  /* Contact Card */
  contactCard: {
    backgroundColor: "#ffffff",
    borderRadius: R_CARD,
    padding: PAD_CARD,
    flexDirection: "row",
    alignItems: "center",
    gap: GAP,
    borderWidth: BORDER,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: W * 0.01,
    shadowOffset: { width: 0, height: H * 0.002 },
  },
  contactAvatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_R,
    backgroundColor: "#e5e7eb",
  },
  contactName: {
    fontSize: FS_NAME,
    fontWeight: "700",
    color: "#111827",
  },
  contactRole: {
    color: "#6b7280",
    marginTop: H * 0.003,
    fontSize: FS_ROLE,
  },
  callBtn: {
    backgroundColor: "#AEE9FA",
    paddingVertical: PAD_BTN_V,
    paddingHorizontal: PAD_BTN_H,
    borderRadius: R_BTN,
  },
  callBtnText: {
    color: "#0c4a6e",
    fontWeight: "700",
    fontSize: FS_BTN,
  },

  /* Empty state */
  emptyBox: {
    backgroundColor: "#ffffff",
    borderRadius: R_CARD,
    borderWidth: BORDER,
    borderColor: "#e5e7eb",
    padding: PAD_CARD,
    marginBottom: H * 0.012,
  },
  emptyTitle: {
    fontSize: FS_BODY,
    fontWeight: "800",
    color: "#111827",
  },
  emptySub: {
    marginTop: H * 0.006,
    fontSize: W * 0.032,
    color: "#64748b",
    lineHeight: W * 0.045,
  },

  /* Fallback avatar */
  fallbackAvatar: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D7F1FB",
  },
  fallbackAvatarText: {
    fontSize: FS_NAME,
    fontWeight: "800",
    color: "#0c4a6e",
  },

  /* Generic Card */
  card: {
    backgroundColor: "#ffffff",
    borderRadius: R_CARD,
    borderWidth: BORDER,
    borderColor: "#e5e7eb",
    padding: PAD_CARD,
    marginBottom: H * 0.012,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: W * 0.01,
    shadowOffset: { width: 0, height: H * 0.002 },
  },
  cardLine: {
    color: "#111827",
    marginBottom: H * 0.006,
    fontSize: FS_BODY,
  },

  /* Resource */
  resourceCard: {
    backgroundColor: "#D7F1FB",
  },
  resourceText: {
    color: "#0f172a",
    lineHeight: FS_BODY * 1.5,
    fontSize: FS_BODY,
  },
});
