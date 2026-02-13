// app/(tabs)/Home/Vitals.tsx
import React, { useState } from "react";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
  Platform,
} from "react-native";

const { width: W, height: H } = Dimensions.get("window");

/* ---------- Responsive Tokens ---------- */
const HP = W * 0.05;
const VSP = H * 0.014;

const FS_TITLE = W * 0.045; // 살짝 키움
const FS_LABEL = W * 0.034; // 살짝 키움
const FS_INPUT = W * 0.04;  // 입력창 글씨 키움
const FS_BTN = W * 0.04;
const FS_RESULT = W * 0.038;

const R_CARD = W * 0.04;
const R_INPUT = W * 0.03;
const R_BTN = W * 0.035;

const PAD_CARD = W * 0.045;
const PAD_INPUT_V = Platform.OS === "ios" ? H * 0.015 : H * 0.012; // 아이폰 패딩 소폭 증가
const PAD_INPUT_H = W * 0.035;

const BTN_PV = H * 0.018;
const BORDER = Math.max(1, W * 0.003); // 테두리 가독성 상향

type StatusType = "normal" | "warning" | "danger" | "info" | null;

export default function VitalsScreen() {
  const [sys, setSys] = useState("");
  const [dia, setDia] = useState("");
  const [bpResult, setBpResult] = useState<{ msg: string; type: StatusType } | null>(null);

  const [glu, setGlu] = useState("");
  const [isFasting, setIsFasting] = useState(true);
  const [gluResult, setGluResult] = useState<{ msg: string; type: StatusType } | null>(null);

  const analyzeBP = (s: number, d: number) => {
    if (s < 90 || d < 60) return { msg: "Hypotension", type: "info" as StatusType };
    if (s >= 140 || d >= 90) return { msg: "Hypertension", type: "danger" as StatusType };
    if ((s >= 130 && s < 140) || (d >= 80 && d < 90)) return { msg: "Pre-hypertension", type: "warning" as StatusType };
    if (s >= 120 && s < 130 && d < 80) return { msg: "Elevated BP", type: "warning" as StatusType };
    if (s < 120 && d < 80) return { msg: "Normal BP", type: "normal" as StatusType };
    return { msg: "Invalid Measurement", type: "info" as StatusType };
  };

  const saveBP = async () => {
    if (!/^\d+$/.test(sys) || !/^\d+$/.test(dia)) {
      Alert.alert("Error", "Please enter numbers only.");
      return;
    }
    const s = parseInt(sys, 10);
    const d = parseInt(dia, 10);
    const result = analyzeBP(s, d);
    setBpResult(result);
    Alert.alert("Success", `Saved.\nResult: ${result.msg}`);
  };

  const analyzeGlucose = (g: number, fasting: boolean) => {
    if (g < 70) return { msg: "Hypoglycemia Warning", type: "danger" as StatusType };
    if (fasting) {
      if (g >= 126) return { msg: "Suspected Diabetes", type: "danger" as StatusType };
      if (g >= 100) return { msg: "Prediabetes", type: "warning" as StatusType };
      return { msg: "Normal", type: "normal" as StatusType };
    } else {
      if (g >= 200) return { msg: "Suspected Diabetes", type: "danger" as StatusType };
      if (g >= 140) return { msg: "Prediabetes", type: "warning" as StatusType };
      return { msg: "Normal", type: "normal" as StatusType };
    }
  };

  const saveGlucose = async () => {
    if (!/^\d+$/.test(glu)) {
      Alert.alert("Error", "Please enter numbers only.");
      return;
    }
    const g = parseInt(glu, 10);
    const result = analyzeGlucose(g, isFasting);
    setGluResult(result);
    Alert.alert("Success", `Saved.\nResult: ${result.msg}`);
  };

  const getStatusColor = (type: StatusType) => {
    switch (type) {
      case "normal": return "#10b981";
      case "warning": return "#f59e0b";
      case "danger": return "#ef4444";
      case "info": return "#3b82f6";
      default: return "#6b7280";
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: H * 0.05 }}
        showsVerticalScrollIndicator={false}
      >
        {/* --- Blood Pressure Section --- */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Blood Pressure</Text>

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.label}>Systolic</Text>
              <TextInput
                value={sys}
                onChangeText={setSys}
                keyboardType="number-pad"
                placeholder="120"
                placeholderTextColor="#94A3B8" // 아이폰 흐릿함 방지
                style={styles.input}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Diastolic</Text>
              <TextInput
                value={dia}
                onChangeText={setDia}
                keyboardType="number-pad"
                placeholder="80"
                placeholderTextColor="#94A3B8" // 아이폰 흐릿함 방지
                style={styles.input}
              />
            </View>
          </View>

          {bpResult && (
            <View style={[styles.resultBox, { backgroundColor: getStatusColor(bpResult.type) + "15" }]}>
              <Text style={[styles.resultText, { color: getStatusColor(bpResult.type) }]}>
                {bpResult.msg}
              </Text>
            </View>
          )}

          <TouchableOpacity style={styles.saveBtn} onPress={saveBP} activeOpacity={0.8}>
            <Text style={styles.saveText}>Save BP Measurement</Text>
          </TouchableOpacity>
        </View>

        {/* --- Blood Glucose Section --- */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Blood Glucose</Text>

          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, isFasting && styles.toggleBtnActive]}
              onPress={() => setIsFasting(true)}
            >
              <Text style={[styles.toggleText, isFasting && styles.toggleTextActive]}>Fasting</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, !isFasting && styles.toggleBtnActive]}
              onPress={() => setIsFasting(false)}
            >
              <Text style={[styles.toggleText, !isFasting && styles.toggleTextActive]}>Post-meal</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Glucose Level (mg/dL)</Text>
          <TextInput
            value={glu}
            onChangeText={setGlu}
            keyboardType="number-pad"
            placeholder="e.g. 100"
            placeholderTextColor="#94A3B8" // 아이폰 흐릿함 방지
            style={styles.input}
          />

          {gluResult && (
            <View style={[styles.resultBox, { backgroundColor: getStatusColor(gluResult.type) + "15" }]}>
              <Text style={[styles.resultText, { color: getStatusColor(gluResult.type) }]}>
                {gluResult.msg}
              </Text>
            </View>
          )}

          <TouchableOpacity style={styles.saveBtn} onPress={saveGlucose} activeOpacity={0.8}>
            <Text style={styles.saveText}>Save Glucose Measurement</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#ffffff" },
  container: { flex: 1, paddingHorizontal: HP, paddingTop: 10 },

  card: {
    backgroundColor: "#FFFFFF", 
    borderRadius: R_CARD,
    padding: PAD_CARD,
    marginBottom: H * 0.025,
    borderWidth: BORDER,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: FS_TITLE,
    fontWeight: "800",
    color: "#000000", // 확실한 검정
    marginBottom: VSP,
  },
  row: { flexDirection: "row", justifyContent: "space-between" },

  label: {
    fontSize: FS_LABEL,
    color: "#475569", // 라벨도 조금 더 진하게
    marginBottom: H * 0.008,
    fontWeight: "700",
  },
  input: {
    borderWidth: BORDER,
    borderColor: "#94A3B8", // 테두리를 조금 더 진하게
    backgroundColor: "#fff",
    borderRadius: R_INPUT,
    paddingVertical: PAD_INPUT_V,
    paddingHorizontal: PAD_INPUT_H,
    fontSize: FS_INPUT,
    color: "#000000", // 아이폰 선명도를 위한 완전 검정
    fontWeight: "600", // 폰트 두께 보강
  },

  toggleRow: {
    flexDirection: "row",
    marginBottom: VSP,
    backgroundColor: "#F1F5F9",
    borderRadius: R_INPUT,
    padding: 4,
  },
  toggleBtn: { flex: 1, paddingVertical: H * 0.012, alignItems: "center", borderRadius: R_INPUT - 2 },
  toggleBtnActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleText: { fontSize: FS_LABEL, color: "#64748B", fontWeight: "600" },
  toggleTextActive: { color: "#26B4E5", fontWeight: "800" },

  resultBox: { marginTop: VSP, padding: 14, borderRadius: R_INPUT, alignItems: "center" },
  resultText: { fontSize: FS_RESULT, fontWeight: "800" },

  saveBtn: {
    marginTop: H * 0.02,
    backgroundColor: "#26B4E5",
    borderRadius: R_BTN,
    paddingVertical: BTN_PV,
    alignItems: "center",
  },
  saveText: { color: "#fff", fontWeight: "800", fontSize: FS_BTN },
});