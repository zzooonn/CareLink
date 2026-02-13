// app/(tabs)/auth/Profile.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Dimensions,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

/* ---------------- Types ---------------- */

type UserRole = "PATIENT" | "GUARDIAN";

type UserProfile = {
  userId: string;
  name: string;
  gender: string; // e.g., "M" | "F"
  birthDate: string; // "yyyy-MM-dd"
  phone: string;
  address: string;
  role: UserRole;

  // ✅ 백엔드가 내려주면 자동 반영되게 optional
  profileImageId?: number;
  profile_image_id?: number; // snake_case 대비
};

type Guardian = {
  userId: string;
  name: string;
  phone: string;
};

/* ---------------- Config ---------------- */

const { width: W, height: H } = Dimensions.get("window");
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
const NGROK_HEADER = { "ngrok-skip-browser-warning": "true" as const };

/* ---------------- ✅ Avatar mapping ---------------- */

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

function pickAvatarSource(profileImageId?: number) {
  const id = profileImageId ?? 1;
  return AVATAR_LIST.find((a) => a.id === id)?.source ?? AVATAR_LIST[0].source;
}

/* ---------------- UI Tokens ---------------- */

const HP = W * 0.05;
const GAP = W * 0.02;

const IMG = W * 0.26;
const IMG_R = IMG / 2;

const FS_NAME = W * 0.052;
const FS_TITLE = W * 0.04;
const FS_LABEL = W * 0.033;
const FS_VALUE = W * 0.038;
const FS_BADGE = W * 0.032;
const FS_BTN = W * 0.042;

const BADGE_R = W * 0.06;
const BADGE_PV = H * 0.006;
const BADGE_PH = W * 0.03;

const CONTACT_R = W * 0.035;
const CONTACT_PV = H * 0.012;

const BTN_R = W * 0.03;
const BTN_PV = H * 0.017;

const INPUT_R = W * 0.02;
const INPUT_PV = H * 0.01;
const INPUT_PH = W * 0.03;

const BORDER = Math.max(1, W * 0.0025);

/* ---------------- Helpers ---------------- */

function calcAge(birthDate?: string) {
  if (!birthDate) return null;
  const [y, m, d] = birthDate.split("-").map(Number);
  if (!y || !m || !d) return null;

  const today = new Date();
  let age = today.getFullYear() - y;
  const hadBirthday =
    today.getMonth() + 1 > m || (today.getMonth() + 1 === m && today.getDate() >= d);
  if (!hadBirthday) age -= 1;
  return age;
}

function callPhone(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  if (!digits) {
    Alert.alert("Invalid", "The phone number is not valid.");
    return;
  }
  Linking.openURL(`tel:${digits}`);
}

function genderLabel(g?: string) {
  if (!g) return "N/A";
  if (g === "M") return "Male";
  if (g === "F") return "Female";
  return g;
}

async function getStoredUserId() {
  const uid = await AsyncStorage.getItem("userId");
  return uid;
}

export default function ProfileScreen() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [guardians, setGuardians] = useState<Guardian[]>([]);

  const [original, setOriginal] = useState<UserProfile | null>(null);
  const [form, setForm] = useState<UserProfile | null>(null);
  const [editingKey, setEditingKey] = useState<keyof UserProfile | null>(null);

  // ✅ 아바타 id + 모달 상태
  const [profileImageId, setProfileImageId] = useState<number>(1);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);

  const age = useMemo(() => calcAge(user?.birthDate), [user?.birthDate]);

  const dirty = useMemo(() => {
    if (!original || !form) return false;
    return JSON.stringify(form) !== JSON.stringify(original);
  }, [form, original]);

  const startEdit = (key: keyof UserProfile) => setEditingKey(key);
  const endEdit = () => setEditingKey(null);

  const onChangeField = (key: keyof UserProfile, v: string) => {
    setForm((prev) => (prev ? { ...prev, [key]: v } : prev));
  };

  const avatarSource = useMemo(() => pickAvatarSource(profileImageId), [profileImageId]);

  // ✅ 아바타 선택 처리: 선택 즉시 반영 + 로컬 저장
  const applyAvatar = async (id: number) => {
    setProfileImageId(id);
    try {
      await AsyncStorage.setItem("profileImageId", String(id));
    } catch {}
    setAvatarModalOpen(false);
  };

  useEffect(() => {
    const run = async () => {
      if (!API_BASE_URL) {
        Alert.alert("Missing env var", "Please set EXPO_PUBLIC_API_BASE_URL and restart the app.");
        return;
      }

      try {
        setLoading(true);

        const USER_ID = await getStoredUserId();
        if (!USER_ID) {
          Alert.alert("Login required", "No saved login found. Please log in again.");
          return;
        }

        // ✅ 0) 로컬 저장된 아바타 먼저 적용
        const cachedAvatarId = await AsyncStorage.getItem("profileImageId");
        if (cachedAvatarId) {
          const n = Number(cachedAvatarId);
          if (!Number.isNaN(n)) setProfileImageId(n);
        }

        // 1) Fetch user profile
        const res = await fetch(`${API_BASE_URL}/api/users/${USER_ID}`, {
          method: "GET",
          headers: { "Content-Type": "application/json", ...NGROK_HEADER },
        });

        const text = await res.text();
        if (!res.ok) throw new Error(`profile fetch failed: ${res.status} ${text}`);

        const u: UserProfile = text ? JSON.parse(text) : null;
        if (!u) throw new Error("empty profile");

        setUser(u);
        setOriginal(u);
        setForm(u);

        // ✅ 서버가 profileImageId 내려주면 동기화(백이 지원할 때만)
        const serverAvatarId =
          typeof u.profileImageId === "number"
            ? u.profileImageId
            : typeof u.profile_image_id === "number"
            ? u.profile_image_id
            : undefined;

        if (serverAvatarId) {
          setProfileImageId(serverAvatarId);
          await AsyncStorage.setItem("profileImageId", String(serverAvatarId));
        }

        // 2) guardians
        const gRes = await fetch(`${API_BASE_URL}/api/guardian/my-guardians/${USER_ID}`, {
          method: "GET",
          headers: { "Content-Type": "application/json", ...NGROK_HEADER },
        });

        const gText = await gRes.text();
        if (gRes.ok) {
          const gs: Guardian[] = gText ? JSON.parse(gText) : [];
          setGuardians(Array.isArray(gs) ? gs : []);
        } else {
          setGuardians([]);
        }
      } catch (e: any) {
        console.log("Profile load error:", e?.message || e);
        Alert.alert("Error", "Failed to load profile information.");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  const handleSave = async () => {
    if (!API_BASE_URL) {
      Alert.alert("Missing env var", "Please set EXPO_PUBLIC_API_BASE_URL and restart the app.");
      return;
    }
    if (!form) return;

    try {
      setSaving(true);

      const USER_ID = await getStoredUserId();
      if (!USER_ID) {
        Alert.alert("Login required", "No saved login found. Please log in again.");
        return;
      }

      if (!form.name.trim()) {
        Alert.alert("Check", "Please enter your name.");
        return;
      }
      if (!form.phone.trim()) {
        Alert.alert("Check", "Please enter your phone number.");
        return;
      }

      const payload = {
        name: form.name,
        gender: form.gender,
        birthDate: form.birthDate,
        phone: form.phone,
        address: form.address,
        // ❗백 수정 안하면 서버에 아바타 저장은 못하니 여기엔 안 넣음
        // profileImageId: profileImageId,
      };

      const res = await fetch(`${API_BASE_URL}/api/users/${USER_ID}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...NGROK_HEADER },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      if (!res.ok) throw new Error(`save failed: ${res.status} ${text}`);

      const updated: UserProfile = text ? JSON.parse(text) : null;
      if (!updated) throw new Error("empty update response");

      setUser(updated);
      setOriginal(updated);
      setForm(updated);
      setEditingKey(null);

      // ✅ 로컬 캐시는 유지 (Home/Profile 동일 반영)
      await AsyncStorage.setItem("profileImageId", String(profileImageId));
      await AsyncStorage.setItem("userName", form.name.trim());

      Alert.alert("Done", "Your profile has been updated.");
    } catch (e: any) {
      console.log("Save error:", e?.message || e);
      Alert.alert("Error", "Failed to save. Please check the network/server.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: H * 0.12 }}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View style={styles.imageContainer}>
          {/* ✅ 아바타 클릭하면 모달 오픈 */}
          <TouchableOpacity activeOpacity={0.85} onPress={() => setAvatarModalOpen(true)}>
            <View>
              <Image source={avatarSource} style={styles.profileImg} />
              <View style={styles.avatarHint}>
                <Ionicons name="pencil" size={W * 0.04} color="#111827" />
                <Text style={styles.avatarHintText}>Change</Text>
              </View>
            </View>
          </TouchableOpacity>

          <Text style={styles.name}>{loading ? "Loading..." : user?.name ?? "Unknown"}</Text>

          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{age !== null ? `${age} years old` : "Age N/A"}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: "#60a5fa" }]}>
              <Text style={styles.badgeText}>{genderLabel(user?.gender)}</Text>
            </View>
          </View>
        </View>

        {/* ✅ Avatar Picker Modal */}
        <Modal
          visible={avatarModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setAvatarModalOpen(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.modalOverlay}
            onPress={() => setAvatarModalOpen(false)}
          >
            <TouchableOpacity activeOpacity={1} style={styles.modalCard} onPress={() => {}}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Choose your avatar</Text>
                <TouchableOpacity onPress={() => setAvatarModalOpen(false)} activeOpacity={0.85}>
                  <Ionicons name="close" size={W * 0.07} color="#111827" />
                </TouchableOpacity>
              </View>

              <View style={styles.avatarGrid}>
                {AVATAR_LIST.map((a) => {
                  const selected = a.id === profileImageId;
                  return (
                    <TouchableOpacity
                      key={a.id}
                      activeOpacity={0.85}
                      onPress={() => applyAvatar(a.id)}
                      style={[styles.avatarItem, selected && styles.avatarItemSelected]}
                    >
                      <Image source={a.source} style={styles.avatarItemImg} />
                      {selected && (
                        <View style={styles.checkBadge}>
                          <Ionicons name="checkmark" size={W * 0.045} color="#fff" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.modalSubText}>
                Changes apply immediately.
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* Body */}
        {loading && (
          <View style={{ marginTop: H * 0.02, alignItems: "center" }}>
            <ActivityIndicator />
          </View>
        )}

        {!loading && !form && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Failed to load profile.</Text>
          </View>
        )}

        {!!form && (
          <>
            {/* Account Info */}
            <Text style={styles.sectionTitle}>Account info</Text>
            <View style={styles.infoSection}>
              <InfoItem label="User ID" value={form.userId} />

              <EditableInfoItem
                label="Name"
                value={form.name}
                isEditing={editingKey === "name"}
                onPress={() => startEdit("name")}
                onChangeText={(t) => onChangeField("name", t)}
                onEndEditing={endEdit}
                placeholder="Tap to edit name"
              />

              <EditableInfoItem
                label="Gender (M/F)"
                value={form.gender}
                isEditing={editingKey === "gender"}
                onPress={() => startEdit("gender")}
                onChangeText={(t) => onChangeField("gender", t)}
                onEndEditing={endEdit}
                placeholder="Tap to edit gender (M/F)"
              />

              <EditableInfoItem
                label="Birth date (yyyy-mm-dd)"
                value={form.birthDate}
                isEditing={editingKey === "birthDate"}
                onPress={() => startEdit("birthDate")}
                onChangeText={(t) => onChangeField("birthDate", t)}
                onEndEditing={endEdit}
                placeholder="e.g., 1998-03-15"
              />

              <EditableInfoItem
                label="Phone"
                value={form.phone}
                isEditing={editingKey === "phone"}
                onPress={() => startEdit("phone")}
                onChangeText={(t) => onChangeField("phone", t)}
                onEndEditing={endEdit}
                keyboardType="phone-pad"
                placeholder="Tap to edit phone"
              />

              <EditableInfoItem
                label="Address"
                value={form.address}
                isEditing={editingKey === "address"}
                onPress={() => startEdit("address")}
                onChangeText={(t) => onChangeField("address", t)}
                onEndEditing={endEdit}
                placeholder="Tap to edit address"
              />

              <InfoItem label="Role" value={form.role} />
            </View>

            {/* Emergency Contacts */}
            <Text style={styles.sectionTitle}>Emergency contact</Text>

            {guardians.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No emergency contacts linked.</Text>
                <Text style={styles.emptySub}>
                  Once you connect a guardian, you’ll be able to call them directly from here.
                </Text>
              </View>
            ) : (
              <View style={styles.contactRow}>
                {guardians.slice(0, 2).map((g, idx) => (
                  <TouchableOpacity
                    key={g.userId}
                    style={[styles.contactBox, idx === 1 && { backgroundColor: "#e5e7eb" }]}
                    activeOpacity={0.85}
                    onPress={() => callPhone(g.phone)}
                  >
                    <View style={styles.contactTop}>
                      <Text style={styles.contactNum}>{idx + 1}</Text>
                      <Ionicons name="call-outline" size={W * 0.045} color="#111827" />
                    </View>
                    <Text style={styles.contactLabel} numberOfLines={1}>
                      {g.name || g.userId}
                    </Text>
                    <Text style={styles.contactPhone} numberOfLines={1}>
                      {g.phone}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Update Button */}
            <TouchableOpacity
              style={[styles.updateBtn, (!dirty || saving) && { opacity: 0.5 }]}
              disabled={!dirty || saving}
              onPress={handleSave}
              activeOpacity={0.9}
            >
              <Text style={styles.updateText}>{saving ? "Saving..." : "Update info"}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------- Read-only item ---------- */
function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
      <View style={styles.divider} />
    </View>
  );
}

/* ---------- Tap → Edit item ---------- */
function EditableInfoItem({
  label,
  value,
  isEditing,
  onPress,
  onChangeText,
  onEndEditing,
  keyboardType,
  placeholder,
}: {
  label: string;
  value: string;
  isEditing: boolean;
  onPress: () => void;
  onChangeText: (t: string) => void;
  onEndEditing: () => void;
  keyboardType?: "default" | "number-pad" | "email-address" | "phone-pad";
  placeholder?: string;
}) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoLabel}>{label}</Text>

      {!isEditing ? (
        <TouchableOpacity onPress={onPress} activeOpacity={0.6} style={{ paddingVertical: H * 0.003 }}>
          <Text style={styles.infoValue}>{value?.trim() ? value : "Tap to edit"}</Text>
        </TouchableOpacity>
      ) : (
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onBlur={onEndEditing}
          onSubmitEditing={onEndEditing}
          placeholder={placeholder}
          keyboardType={keyboardType}
          autoFocus
          returnKeyType="done"
          style={styles.input}
        />
      )}

      <View style={styles.divider} />
    </View>
  );
}

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1, paddingHorizontal: HP },

  imageContainer: { alignItems: "center", marginTop: H * 0.012 },
  profileImg: { width: IMG, height: IMG, borderRadius: IMG_R, marginBottom: H * 0.01 },

  // ✅ 아바타 위에 “Change” 뱃지
  avatarHint: {
    position: "absolute",
    right: -W * 0.005,
    bottom: H * 0.006,
    backgroundColor: "#e0f2fe",
    paddingVertical: H * 0.004,
    paddingHorizontal: W * 0.02,
    borderRadius: W * 0.04,
    flexDirection: "row",
    alignItems: "center",
  },
  avatarHintText: { marginLeft: W * 0.01, fontWeight: "800", color: "#111827", fontSize: W * 0.03 },

  name: { fontSize: FS_NAME, fontWeight: "700", color: "#111827" },

  badgeRow: { flexDirection: "row", gap: GAP, marginTop: H * 0.008 },
  badge: {
    backgroundColor: "#22d3ee",
    borderRadius: BADGE_R,
    paddingVertical: BADGE_PV,
    paddingHorizontal: BADGE_PH,
  },
  badgeText: { color: "#fff", fontWeight: "600", fontSize: FS_BADGE },

  sectionTitle: {
    fontSize: FS_TITLE,
    fontWeight: "700",
    color: "#111827",
    marginTop: H * 0.028,
    marginBottom: H * 0.012,
  },

  infoSection: { marginTop: H * 0.002 },
  infoItem: { marginBottom: H * 0.012 },
  infoLabel: { fontSize: FS_LABEL, color: "#6b7280", marginBottom: H * 0.006 },
  infoValue: { fontSize: FS_VALUE, color: "#111827", fontWeight: "600", marginBottom: H * 0.006 },

  divider: { height: Math.max(1, H * 0.0012), backgroundColor: "#e5e7eb" },

  contactRow: { flexDirection: "row", gap: W * 0.03, marginBottom: H * 0.03 },
  contactBox: {
    flex: 1,
    backgroundColor: "#bae6fd",
    borderRadius: CONTACT_R,
    paddingVertical: CONTACT_PV,
    paddingHorizontal: W * 0.03,
  },
  contactTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: H * 0.006,
  },
  contactNum: { fontWeight: "800", fontSize: W * 0.042, color: "#111827" },
  contactLabel: { fontSize: FS_LABEL, color: "#111827", fontWeight: "700", marginBottom: H * 0.002 },
  contactPhone: { fontSize: W * 0.032, color: "#334155" },

  emptyBox: {
    backgroundColor: "#f1f5f9",
    borderRadius: CONTACT_R,
    padding: W * 0.04,
    marginBottom: H * 0.03,
  },
  emptyText: { fontSize: FS_LABEL, fontWeight: "800", color: "#111827" },
  emptySub: {
    marginTop: H * 0.006,
    fontSize: W * 0.032,
    color: "#475569",
    lineHeight: W * 0.045,
  },

  updateBtn: {
    backgroundColor: "#38bdf8",
    borderRadius: BTN_R,
    paddingVertical: BTN_PV,
    alignItems: "center",
  },
  updateText: { color: "#fff", fontWeight: "700", fontSize: FS_BTN },

  input: {
    borderWidth: BORDER,
    borderColor: "#e5e7eb",
    borderRadius: INPUT_R,
    paddingVertical: INPUT_PV,
    paddingHorizontal: INPUT_PH,
    fontSize: FS_VALUE,
    color: "#111827",
    marginBottom: H * 0.008,
  },

  /* ✅ modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: W * 0.06,
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: W * 0.05,
    padding: W * 0.05,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: H * 0.012,
  },
  modalTitle: { fontSize: W * 0.045, fontWeight: "800", color: "#111827" },
  modalSubText: {
    marginTop: H * 0.01,
    color: "#6b7280",
    fontSize: W * 0.032,
  },

  avatarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  avatarItem: {
    width: "23%",
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#e2e8f0",
    overflow: "hidden",
    marginBottom: H * 0.012,
    backgroundColor: "#fff",
  },
  avatarItemSelected: {
    borderColor: "#0ea5e9",
    borderWidth: 3,
    transform: [{ scale: 1.02 }],
  },
  avatarItemImg: { width: "100%", height: "100%", resizeMode: "cover" },

  checkBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: W * 0.06,
    height: W * 0.06,
    borderRadius: W * 0.03,
    backgroundColor: "#0ea5e9",
    alignItems: "center",
    justifyContent: "center",
  },
});
