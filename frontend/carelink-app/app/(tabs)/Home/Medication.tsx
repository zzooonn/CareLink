// app/(tabs)/Home/Medication.tsx
import React, { useMemo, useState, useEffect } from "react";
import {
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import DateTimePicker from "@react-native-community/datetimepicker";

// ✅ 알림 핸들러
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type Med = {
  id: string;
  name: string;
  dosage: string;
  freq: string; 
  notificationId?: string;
};

const initialMeds: Med[] = []; 

const { width: W, height: H } = Dimensions.get("window");

/* ---------- Responsive Tokens ---------- */
const HP = W * 0.05;
const VSP = H * 0.014;
const FS_SECTION = W * 0.045; // 조금 더 크게
const FS_MED = W * 0.042;     // 조금 더 크게
const FS_SUB = W * 0.035;
const FS_LABEL = W * 0.035;
const FS_BTN = W * 0.04;
const R_CARD = W * 0.035;
const R_INPUT = W * 0.03;
const R_BTN = W * 0.035;
const R_MODAL = W * 0.04;
const PAD_CARD = W * 0.045;
const PAD_INPUT_V = Platform.OS === "ios" ? H * 0.015 : H * 0.012;
const PAD_INPUT_H = W * 0.035;
const BTN_PV = H * 0.018;
const SMALL_PV = H * 0.014;
const BORDER = Math.max(1, W * 0.003);

export default function MedicationScreen() {
  const [meds, setMeds] = useState<Med[]>(initialMeds);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Med | null>(null);

  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [modalDate, setModalDate] = useState(new Date());
  const [showModalPicker, setShowModalPicker] = useState(false);

  const title = useMemo(() => (editing ? "Edit Medicine" : "Add Medicine"), [editing]);

  useEffect(() => {
    (async () => {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== "granted") {
        await Notifications.requestPermissionsAsync();
      }
    })();
  }, []);

  const formatTime = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const stringToDate = (timeStr: string) => {
    const [h, m] = timeStr.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  };

  const openAdd = () => {
    setEditing(null);
    setName("");
    setDosage("");
    setModalDate(new Date());
    setModalVisible(true);
  };

  const openEdit = (m: Med) => {
    setEditing(m);
    setName(m.name);
    setDosage(m.dosage);
    setModalDate(stringToDate(m.freq));
    setModalVisible(true);
  };

  const removeMed = (id: string) => {
    Alert.alert("Delete", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const target = meds.find((m) => m.id === id);
          if (target?.notificationId) {
            await Notifications.cancelScheduledNotificationAsync(target.notificationId);
          }
          setMeds((prev) => prev.filter((m) => m.id !== id));
        },
      },
    ]);
  };

  const saveMed = async () => {
    if (!name.trim() || !dosage.trim()) {
      Alert.alert("Error", "Enter all details.");
      return;
    }
    const timeStr = formatTime(modalDate);
    try {
      if (editing?.notificationId) {
        await Notifications.cancelScheduledNotificationAsync(editing.notificationId);
      }
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: { title: "Medication", body: `Take ${name} (${dosage})`, sound: "default" },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: modalDate.getHours(),
          minute: modalDate.getMinutes(),
        },
      });

      if (editing) {
        setMeds((prev) => prev.map((m) => m.id === editing.id ? { ...m, name, dosage, freq: timeStr, notificationId } : m));
      } else {
        setMeds((prev) => [...prev, { id: String(Date.now()), name, dosage, freq: timeStr, notificationId }]);
      }
      setModalVisible(false);
    } catch (e) {
      Alert.alert("Error", "Failed to save.");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: H * 0.05 }} showsVerticalScrollIndicator={false}>
          
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>Medicine List</Text>
            <TouchableOpacity onPress={openAdd}>
              <Ionicons name="add-circle" size={W * 0.09} color="#26B4E5" />
            </TouchableOpacity>
          </View>

          <View style={{ gap: VSP }}>
            {meds.length === 0 && (
              <Text style={{textAlign:'center', color:'#64748B', marginTop: 40, fontWeight: '500'}}>No medications added.</Text>
            )}
            {meds.map((m) => (
              <View key={m.id} style={styles.card}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.medName}>{m.name}</Text>
                  <Text style={styles.subtitle}>{`${m.dosage} • ${m.freq}`}</Text>
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity onPress={() => openEdit(m)} style={styles.iconBtn}>
                    <Ionicons name="pencil" size={W * 0.055} color="#26B4E5" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeMed(m.id)} style={styles.iconBtn}>
                    <Ionicons name="trash" size={W * 0.055} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>

          <Text style={[styles.sectionTitle, {marginTop: 40, marginBottom: 10}]}>Settings</Text>
          <View style={{ flexDirection: "row", gap: W * 0.03 }}>
            <TouchableOpacity style={[styles.smallBtn, { backgroundColor: "#f8fafc" }]} onPress={async () => {
                const list = await Notifications.getAllScheduledNotificationsAsync();
                Alert.alert("Status", `${list.length} alarms active.`);
            }}>
              <Text style={[styles.smallBtnText, { color: "#000000" }]}>Check Alarms</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.smallBtn, { backgroundColor: "#fff1f2" }]} onPress={async () => {
                await Notifications.cancelAllScheduledNotificationsAsync();
                Alert.alert("Success", "All alarms reset.");
            }}>
              <Text style={[styles.smallBtnText, { color: "#be123c" }]}>Reset All</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalWrap}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{title}</Text>

              <Text style={styles.label}>Medicine Name</Text>
              <TextInput 
                value={name} 
                onChangeText={setName} 
                placeholder="e.g., Aspirin" 
                placeholderTextColor="#94A3B8"
                style={styles.input} 
              />

              <Text style={styles.label}>Dosage</Text>
              <TextInput 
                value={dosage} 
                onChangeText={setDosage} 
                placeholder="e.g., 75mg" 
                placeholderTextColor="#94A3B8"
                style={styles.input} 
              />

              <Text style={styles.label}>Reminder Time</Text>
              {Platform.OS === "ios" ? (
                <DateTimePicker
                  value={modalDate}
                  mode="time"
                  is24Hour={true}
                  display="spinner"
                  themeVariant="light"
                  onChange={(e, d) => d && setModalDate(d)}
                  style={{ height: 120 }}
                />
              ) : (
                <TouchableOpacity onPress={() => setShowModalPicker(true)} style={styles.input}>
                  <Text style={{ color: "#000000", fontWeight: '600' }}>{formatTime(modalDate)}</Text>
                </TouchableOpacity>
              )}
              {showModalPicker && (
                <DateTimePicker value={modalDate} mode="time" is24Hour={true} display="default" onChange={(ev, sd) => { setShowModalPicker(false); if(sd) setModalDate(sd); }} />
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => setModalVisible(false)}>
                  <Text style={[styles.btnText, { color: "#000" }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={saveMed}>
                  <Text style={[styles.btnText, { color: "#fff" }]}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#ffffff" },
  container: { flex: 1, paddingHorizontal: HP },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: H * 0.02, marginTop: H * 0.01 },
  sectionTitle: { fontSize: FS_SECTION, fontWeight: "900", color: "#000000" },

  card: {
    backgroundColor: "#ffffff",
    borderRadius: R_CARD,
    padding: PAD_CARD,
    borderWidth: BORDER,
    borderColor: "#CBD5E1",
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  medName: { fontSize: FS_MED, fontWeight: "800", color: "#000000" },
  subtitle: { color: "#475569", marginTop: 4, fontSize: FS_SUB, fontWeight: "600" },
  cardActions: { flexDirection: "row", gap: W * 0.04 },
  iconBtn: { padding: 4 },

  label: { fontSize: FS_LABEL, color: "#000000", marginBottom: 8, marginTop: 16, fontWeight: "700" },
  input: {
    borderWidth: BORDER,
    borderColor: "#94A3B8",
    backgroundColor: "#fff",
    borderRadius: R_INPUT,
    paddingVertical: PAD_INPUT_V,
    paddingHorizontal: PAD_INPUT_H,
    fontSize: FS_MED,
    color: "#000000",
    fontWeight: "600",
    justifyContent: 'center'
  },

  smallBtn: { flex: 1, borderRadius: R_BTN, paddingVertical: SMALL_PV, alignItems: "center", borderWidth: BORDER, borderColor: "#E2E8F0" },
  smallBtnText: { fontWeight: "800", fontSize: FS_BTN },

  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: HP },
  modalCard: { width: "100%", backgroundColor: "#fff", borderRadius: R_MODAL, padding: HP },
  modalTitle: { fontSize: FS_SECTION, fontWeight: "900", color: "#000000", marginBottom: 10 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 20 },

  btn: { borderRadius: R_INPUT, paddingVertical: 12, paddingHorizontal: 20 },
  btnGhost: { backgroundColor: "#F1F5F9" },
  btnPrimary: { backgroundColor: "#26B4E5" },
  btnText: { fontWeight: "800", fontSize: FS_BTN },
});