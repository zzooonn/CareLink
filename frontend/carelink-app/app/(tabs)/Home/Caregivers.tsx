// app/(tabs)/Home/Caregivers.tsx
import React, { useCallback, useMemo, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Linking,
  Dimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { ScaledText as Text } from "../../../components/ScaledText";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { authFetch } from "../../../utils/api";

const { width: W, height: H } = Dimensions.get("window");

/* ---------- ??濡쒖뺄 ?꾨컮? (1~12) ---------- */
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

const CAREGIVERS_STORAGE_KEY = "caregivers:list";
const CAREGIVERS_AVATAR_KEY = "caregivers:avatars"; // { [userId]: avatarId }
const HP = W * 0.05;

/* ---------- ??媛?낆꽦 媛쒖꽑???고듃 ?ъ씠利??곹뼢 ---------- */
const FS_NAME = W * 0.042;
const FS_PHONE = W * 0.035;
const FS_TITLE = W * 0.048;
const FS_LABEL = W * 0.035;
const FS_BTN = W * 0.04;

const R_CARD = W * 0.04;
const R_AVATAR = W * 0.06;
const R_INPUT = W * 0.03;
const R_BTN = W * 0.03;

const PAD_CARD = W * 0.04;
const PAD_ICON = W * 0.015;
const PAD_INPUT_V = Platform.OS === "ios" ? H * 0.015 : H * 0.012;
const PAD_INPUT_H = W * 0.035;
const BTN_PV = H * 0.015;
const BTN_PH = W * 0.04;
const GAP_CARD = H * 0.016;
const GAP_ACTIONS = W * 0.03;
const MODAL_PAD = W * 0.05;
const BORDER = Math.max(1, W * 0.003); // ?뚮몢由??먭퍡 蹂닿컯

type Caregiver = {
  id: string;
  userId: string;
  name: string;
  phone: string;
  avatarId: number;
};

type UserProfileResponse = {
  userId: string;
  name: string;
  phone: string;
  profileImageId: number;
};

type GuardianListItem = {
  userId: string;
  name: string;
  phone: string;
};

const initialData: Caregiver[] = [];

async function fetchUserProfile(userId: string): Promise<
  | { ok: true; data: UserProfileResponse }
  | { ok: false; status?: number; message?: string }
> {
  try {
    const res = await authFetch(`/api/users/${encodeURIComponent(userId)}`, { method: "GET" });
    if (!res.ok) return { ok: false, status: res.status, message: await res.text().catch(() => "") };
    const data = (await res.json()) as UserProfileResponse;
    return { ok: true, data };
  } catch (e: any) {
    return { ok: false, message: e?.message ?? "network error" };
  }
}

export default function CaregiversScreen() {
  const [list, setList] = useState<Caregiver[]>(initialData);
  const [loadingList, setLoadingList] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Caregiver | null>(null);

  const [cgUserId, setCgUserId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarId, setAvatarId] = useState<number>(1);
  const [checking, setChecking] = useState(false);
  const [verifiedUserId, setVerifiedUserId] = useState<string>("");

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        setLoadingList(true);
        try {
          const myUserId = await AsyncStorage.getItem("userId");
          if (!myUserId) return;

          // ?쒕쾭?먯꽌 蹂댄샇??紐⑸줉 濡쒕뱶 (??긽 理쒖떊 name/phone)
          const res = await authFetch(`/api/guardian/my-guardians/${encodeURIComponent(myUserId)}`);
          if (res.ok) {
            const serverList = await res.json(); // ConnectedPatientResponseDto[]
            // avatarId??濡쒖뺄 罹먯떆?먯꽌 蹂듭썝
            const avatarRaw = await AsyncStorage.getItem(CAREGIVERS_AVATAR_KEY);
            const avatarMap: Record<string, number> = avatarRaw ? JSON.parse(avatarRaw) : {};

            const mapped: Caregiver[] = serverList.map((g: GuardianListItem) => ({
              id: g.userId,
              userId: g.userId,
              name: g.name ?? "",
              phone: g.phone ?? "",
              avatarId: avatarMap[g.userId] ?? 1,
            }));

            setList(mapped);
            // AsyncStorage 罹먯떆 媛깆떊 (?ㅽ봽?쇱씤 fallback??
            await AsyncStorage.setItem(CAREGIVERS_STORAGE_KEY, JSON.stringify(mapped));
          } else {
            // ?쒕쾭 ?ㅽ뙣 ??濡쒖뺄 罹먯떆 ?ъ슜 (?ㅽ봽?쇱씤 ???
            const raw = await AsyncStorage.getItem(CAREGIVERS_STORAGE_KEY);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) setList(parsed);
            }
          }
        } catch (e) {
          // ?ㅽ듃?뚰겕 ?ㅻ쪟 ??濡쒖뺄 罹먯떆 ?ъ슜
          try {
            const raw = await AsyncStorage.getItem(CAREGIVERS_STORAGE_KEY);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) setList(parsed);
            }
          } catch { /* ignore */ }
        } finally {
          setLoadingList(false);
        }
      };
      load();
    }, [])
  );

  const openAdd = () => {
    setEditing(null);
    setCgUserId("");
    setName("");
    setPhone("");
    setAvatarId(1);
    setVerifiedUserId("");
    setModalVisible(true);
  };

  const openEdit = (c: Caregiver) => {
    setEditing(c);
    setCgUserId(c.userId);
    setName(c.name);
    setPhone(c.phone);
    setAvatarId(c.avatarId ?? 1);
    setVerifiedUserId(c.userId);
    setModalVisible(true);
  };

  const call = (p: string) => {
    const digits = p.replace(/[^\d+]/g, "");
    if (digits) Linking.openURL(`tel:${digits}`);
  };

  const remove = (id: string) => {
    Alert.alert("Delete", "Remove this caregiver?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const myUserId = await AsyncStorage.getItem("userId");
            if (myUserId) {
              const res = await authFetch(
                `/api/guardian/disconnect?patientId=${encodeURIComponent(myUserId)}&guardianId=${encodeURIComponent(id)}`,
                { method: "DELETE" }
              );
              if (!res.ok && res.status !== 404) {
                Alert.alert("Error", "Failed to remove caregiver from server. Please try again.");
                return;
              }
            }
          } catch {
            Alert.alert("Connection Error", "Cannot connect to the server. Please check your network.");
            return;
          }
          const nextList = list.filter((c) => c.id !== id);
          setList(nextList);
          await AsyncStorage.setItem(CAREGIVERS_STORAGE_KEY, JSON.stringify(nextList));
        },
      },
    ]);
  };

  const onCheckMember = async () => {
    const userId = cgUserId.trim();
    if (!userId) {
      Alert.alert("Check", "Please enter User ID.");
      return;
    }
    try {
      setChecking(true);
      const r = await fetchUserProfile(userId);
      if (!r.ok) {
        Alert.alert("Failed", "User not found.");
        return;
      }
      setName(r.data.name ?? "");
      setPhone(r.data.phone ?? "");
      setAvatarId(r.data.profileImageId ?? 1);
      setVerifiedUserId(userId);
    } finally { setChecking(false); }
  };

  const saveCaregiver = async () => {
    const userId = cgUserId.trim();
    if (verifiedUserId !== userId) {
      Alert.alert("Required", "Please verify member first.");
      return;
    }

    // ???덈줈 異붽????뚮쭔 諛깆뿏?쒖뿉 Guardian ?곌껐 ?깅줉
    if (!editing) {
      try {
        const myUserId = await AsyncStorage.getItem("userId");
        if (myUserId) {
          const res = await authFetch("/api/guardian/connect", {
            method: "POST",
            body: JSON.stringify({ patientId: myUserId, guardianId: userId, contactPhone: phone.trim() }),
          });
          if (!res.ok && res.status !== 409) {
            // 409 = ?대? ?곌껐??(以묐났) ??臾댁떆?섍퀬 吏꾪뻾
            const msg = await res.text().catch(() => "");
            Alert.alert("Connection Failed", msg || "Failed to link guardian. Please try again.");
            return;
          }
        }
      } catch {
        Alert.alert("Connection Error", "Cannot connect to the server. Please check your network.");
        return;
      }
    }

    // avatarId瑜?userId 湲곗??쇰줈 濡쒖뺄 罹먯떆?????(?쒕쾭 ?묐떟??avatarId ?놁쓬)
    const avatarRaw = await AsyncStorage.getItem(CAREGIVERS_AVATAR_KEY);
    const avatarMap: Record<string, number> = avatarRaw ? JSON.parse(avatarRaw) : {};
    avatarMap[userId] = avatarId;
    await AsyncStorage.setItem(CAREGIVERS_AVATAR_KEY, JSON.stringify(avatarMap));

    const nextList: Caregiver[] = editing
      ? list.map((c) => (c.id === editing.id ? { ...c, userId, name, phone, avatarId } : c))
      : [...list, { id: userId, userId, name, phone, avatarId }];
    setList(nextList);
    await AsyncStorage.setItem(CAREGIVERS_STORAGE_KEY, JSON.stringify(nextList));
    setModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: H * 0.05 }} showsVerticalScrollIndicator={false}>
        {loadingList ? (
          <View style={styles.emptyBox}>
            <ActivityIndicator size="large" color="#0F766E" />
          </View>
        ) : list.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="people-outline" size={W * 0.12} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No caregivers yet.</Text>
            <Text style={styles.emptySub}>
              {'Tap "Add Caregiver" to link someone who can support you.'}
            </Text>
          </View>
        ) : null}

        <View style={{ gap: GAP_CARD, marginTop: 10 }}>
          {list.map((c) => (
            <View key={c.id} style={styles.card}>
              <Image source={pickAvatarSource(c.avatarId)} style={styles.avatar} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{c.name}</Text>
                <Text style={styles.idText}>ID: {c.userId}</Text>
                <Text style={styles.phoneText}>{c.phone}</Text>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity onPress={() => call(c.phone)} style={styles.iconBtn}>
                  <Ionicons name="call" size={W * 0.05} color="#000" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openEdit(c)} style={styles.iconBtn}>
                  <Ionicons name="pencil" size={W * 0.05} color="#0F766E" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => remove(c.id)} style={styles.iconBtn}>
                  <Ionicons name="trash" size={W * 0.05} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.85}>
          <Ionicons name="person-add" size={W * 0.045} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.addText}>Add Caregiver</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalWrap}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ width: "100%" }}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{editing ? "Edit Caregiver" : "Add Caregiver"}</Text>

              <Text style={styles.label}>User ID</Text>
              <View style={styles.inlineRow}>
                <TextInput
                  value={cgUserId}
                  onChangeText={(t) => { setCgUserId(t); setVerifiedUserId(""); }}
                  placeholder="Enter User ID"
                  placeholderTextColor="#94A3B8"
                  style={[styles.input, { flex: 1 }]}
                  autoCapitalize="none"
                />
                <TouchableOpacity style={styles.checkBtn} onPress={onCheckMember} disabled={checking}>
                  {checking ? <ActivityIndicator color="#000" /> : <Text style={styles.checkBtnText}>Check</Text>}
                </TouchableOpacity>
              </View>

              {verifiedUserId === cgUserId.trim() && !!verifiedUserId && (
                <Text style={styles.verifiedText}>Verified: {verifiedUserId}</Text>
              )}

              <Text style={styles.label}>Name</Text>
              <TextInput value={name} onChangeText={setName} placeholder="Full Name" placeholderTextColor="#94A3B8" style={styles.input} />

              <Text style={styles.label}>Phone</Text>
              <TextInput value={phone} onChangeText={setPhone} placeholder="Phone Number" placeholderTextColor="#94A3B8" style={styles.input} keyboardType="phone-pad" />

              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => setModalVisible(false)}>
                  <Text style={[styles.btnText, { color: "#000" }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={saveCaregiver}>
                  <Text style={[styles.btnText, { color: "#fff" }]}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#ffffff" },
  container: { flex: 1, paddingHorizontal: HP },

  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: W * 0.03,
    backgroundColor: "#fff",
    borderRadius: R_CARD,
    borderWidth: BORDER,
    borderColor: "#94A3B8", // ?뚮몢由??좊챸?섍쾶
    padding: PAD_CARD,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 3,
  },
  avatar: { width: W * 0.14, height: W * 0.14, borderRadius: W * 0.07 },
  name: { fontSize: FS_NAME, fontWeight: "900", color: "#000000" },
  idText: { fontSize: FS_PHONE, color: "#66736F", fontWeight: "600" },
  phoneText: { fontSize: FS_PHONE, color: "#000000", fontWeight: "700", marginTop: 2 },

  actions: { flexDirection: "row", alignItems: "center", gap: GAP_ACTIONS },
  iconBtn: { padding: 4 },

  addBtn: {
    marginTop: H * 0.03,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F766E",
    borderRadius: R_BTN,
    paddingVertical: BTN_PV,
    paddingHorizontal: BTN_PH,
  },
  addText: { color: "#fff", fontWeight: "900", fontSize: FS_BTN },

  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: MODAL_PAD },
  modalCard: { width: "100%", backgroundColor: "#fff", borderRadius: W * 0.05, padding: MODAL_PAD },
  modalTitle: { fontSize: FS_TITLE, fontWeight: "900", color: "#000000", marginBottom: 15 },

  label: { fontSize: FS_LABEL, color: "#000000", marginBottom: 6, marginTop: 12, fontWeight: "800" },
  input: {
    borderWidth: BORDER,
    borderColor: "#94A3B8",
    backgroundColor: "#fff",
    borderRadius: R_INPUT,
    paddingVertical: PAD_INPUT_V,
    paddingHorizontal: PAD_INPUT_H,
    fontSize: W * 0.04,
    color: "#000000",
    fontWeight: "600",
    minHeight: H * 0.06,
  },

  inlineRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkBtn: { height: H * 0.06, paddingHorizontal: 15, borderRadius: R_INPUT, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center", borderWidth: BORDER, borderColor: "#CBD5E1" },
  checkBtnText: { fontWeight: "800", color: "#000" },
  verifiedText: { marginTop: 8, color: "#16a34a", fontWeight: "800" },

  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: H * 0.06,
    gap: H * 0.012,
  },
  emptyTitle: { fontSize: FS_NAME, fontWeight: "700", color: "#94A3B8", marginTop: H * 0.01 },
  emptySub: { fontSize: FS_PHONE, color: "#CBD5E1", textAlign: "center", paddingHorizontal: W * 0.04 },

  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 25 },
  btn: { borderRadius: R_BTN, paddingVertical: 14, paddingHorizontal: 20 },
  btnGhost: { backgroundColor: "#F1F5F9" },
  btnPrimary: { backgroundColor: "#0F766E" },
  btnText: { fontWeight: "900", fontSize: W * 0.038 },
});
