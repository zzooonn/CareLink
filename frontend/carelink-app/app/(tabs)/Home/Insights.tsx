// app/(tabs)/Home/Insights.tsx
import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

type RangeKey = "7d" | "30d" | "365d";

const ranges: Record<RangeKey, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "365d": "This year",
};

// ✅ 서버 응답 타입
type InsightsApi = {
  labels: string[];     // ["01/08", ...]
  glucose: number[];    // 0~100
  bp: number[];         // 0~100
  ecg: number[];        // 0~100
  max: number;          // 보통 100
};

const { width: W, height: H } = Dimensions.get("window");

/* ---------- Responsive Tokens ---------- */
const HP = W * 0.05;
const VSP = H * 0.014;
const RADIUS = W * 0.04;
const BORDER = Math.max(1, W * 0.0025);

const FS_PAGE = W * 0.052;
const FS_CARD_TITLE = W * 0.038;
const FS_SELECT = W * 0.036;
const FS_TICK = W * 0.030;
const FS_LABEL = W * 0.033;

const SELECT_PV = H * 0.012;
const SELECT_PH = W * 0.035;

const CARD_PAD = W * 0.045;
const CARD_MT = H * 0.016;

const BIG_SCORE = W * 0.085;

const TRACK_H = Math.max(6, H * 0.01);
const DOT = W * 0.025;

// Chart sizing
const YAXIS_W = W * 0.09;
const CHART_H = H * 0.18;
const BAR_W = W * 0.018;
const BAR_R = BAR_W * 0.5;
const BAR_GAP = W * 0.012;

const COLORS = {
  glucose: "#f59e0b",
  bp: "#22c55e",
  ecg: "#8b5cf6",
  total: "#111827",
};

// ✅ 환경변수 (예: http://localhost:8080 or http://10.0.2.2:8080)
const BACKEND_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

// ✅ 임시: 로그인 붙이기 전까지 테스트용 userId
const USER_ID = "kevin";

export default function InsightsScreen() {
  const [openSelect, setOpenSelect] = useState(false);
  const [range, setRange] = useState<RangeKey>("7d");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ✅ 서버에서 받은 vitals
  const [vitals, setVitals] = useState<InsightsApi>({
    labels: ["-", "-", "-", "-", "-", "-", "-"],
    glucose: [0, 0, 0, 0, 0, 0, 0],
    bp: [0, 0, 0, 0, 0, 0, 0],
    ecg: [0, 0, 0, 0, 0, 0, 0],
    max: 100,
  });

  // ✅ range 바뀔 때마다 서버에서 다시 가져오기
  useEffect(() => {
    const run = async () => {
      if (!BACKEND_URL) {
        setErr("BACKEND_URL is not set (.env EXPO_PUBLIC_BACKEND_URL)");
        return;
      }

      setLoading(true);
      setErr(null);

      try {
        const url = `${BACKEND_URL}/api/vitals/insights?userId=${encodeURIComponent(
          USER_ID
        )}&range=${encodeURIComponent(range)}`;

        const res = await fetch(url, {
          method: "GET",
          headers: { "Accept": "application/json" },
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status} ${text}`.trim());
        }

        const data = (await res.json()) as InsightsApi;

        // ✅ 방어: 배열 길이 불일치 시 UI 깨짐 방지
        const n = data.labels?.length ?? 0;
        if (!n || !data.glucose || !data.bp || !data.ecg) {
          throw new Error("Invalid insights response shape");
        }

        setVitals(data);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load insights");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [range]);

  // ✅ 종합 점수 (가중치 예시)
  const totals = useMemo(() => {
    const wG = 0.35,
      wB = 0.35,
      wE = 0.3;
    const L = Math.min(vitals.glucose.length, vitals.bp.length, vitals.ecg.length);
    return Array.from({ length: L }, (_, i) =>
      Math.round(vitals.glucose[i] * wG + vitals.bp[i] * wB + vitals.ecg[i] * wE)
    );
  }, [vitals]);

  // ✅ 평균 점수
  const avg = useMemo(() => {
    const mean = (arr: number[]) =>
      Math.round(arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length));
    return {
      glucose: mean(vitals.glucose),
      bp: mean(vitals.bp),
      ecg: mean(vitals.ecg),
      total: mean(totals),
    };
  }, [vitals, totals]);

  // ✅ 주간 점수 (표시용): totals 평균
  const weeklyScore = useMemo(() => {
    const a = totals.reduce((x, y) => x + y, 0) / Math.max(1, totals.length);
    return Math.round(a);
  }, [totals]);

  const selectItem = (key: RangeKey) => {
    setRange(key);
    setOpenSelect(false);
  };

  // ✅ x축 라벨: 서버 labels 사용 (7d면 7개, 30d면 30개…)
  // UI가 30/365는 너무 빽빽할 수 있으니 “표시용”으로 7d만 예쁘게 쓰고 싶으면 여기에서 downsample 하면 됨.
  const xLabels = vitals.labels;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: H * 0.05 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Health Insights</Text>

        {/* Selector */}
        <View style={{ marginBottom: VSP }}>
          <TouchableOpacity
            style={styles.select}
            onPress={() => setOpenSelect((v) => !v)}
            accessibilityRole="button"
            activeOpacity={0.9}
          >
            <Text style={styles.selectText}>{ranges[range]}</Text>
            <Ionicons
              name={openSelect ? "chevron-up" : "chevron-down"}
              size={W * 0.05}
              color="#111827"
            />
          </TouchableOpacity>

          {openSelect && (
            <View style={styles.selectMenu}>
              {(Object.keys(ranges) as RangeKey[]).map((k) => (
                <TouchableOpacity
                  key={k}
                  style={[styles.selectItem, k === range && { backgroundColor: "#f1f5f9" }]}
                  onPress={() => selectItem(k)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.selectItemText}>{ranges[k]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Loading / Error */}
        {loading && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <ActivityIndicator />
            <Text style={{ color: "#475569", fontWeight: "700" }}>Loading insights...</Text>
          </View>
        )}
        {err && (
          <Text style={{ color: "#ef4444", marginBottom: 10, fontWeight: "700" }}>
            Error: {err}
          </Text>
        )}

        {/* Weekly health score */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Weekly health score</Text>

          <View style={styles.scoreRow}>
            <Text style={styles.bigScore}>{weeklyScore}</Text>
            <Text style={styles.scoreOutOf}>/ 100</Text>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${weeklyScore}%` }]} />
          </View>
          <Text style={styles.progressLabel}>{weeklyScore}/100</Text>
        </View>

        {/* Vitals score chart */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Vitals score (Glucose / BP / ECG)</Text>

          {/* 평균 요약 */}
          <View style={styles.pillRow}>
            <View style={styles.pill}>
              <View style={[styles.pillDot, { backgroundColor: COLORS.glucose }]} />
              <Text style={styles.pillLabel}>Glucose</Text>
              <Text style={styles.pillValue}>{avg.glucose}</Text>
            </View>
            <View style={styles.pill}>
              <View style={[styles.pillDot, { backgroundColor: COLORS.bp }]} />
              <Text style={styles.pillLabel}>BP</Text>
              <Text style={styles.pillValue}>{avg.bp}</Text>
            </View>
            <View style={styles.pill}>
              <View style={[styles.pillDot, { backgroundColor: COLORS.ecg }]} />
              <Text style={styles.pillLabel}>ECG</Text>
              <Text style={styles.pillValue}>{avg.ecg}</Text>
            </View>
            <View style={styles.pillStrong}>
              <Text style={styles.pillStrongLabel}>Total</Text>
              <Text style={styles.pillStrongValue}>{avg.total}/100</Text>
            </View>
          </View>

          <View style={styles.chartArea}>
            {/* Y-axis labels */}
            <View style={styles.yAxis}>
              {[100, 75, 50, 25, 0].map((v) => (
                <Text key={v} style={styles.yTick}>
                  {v}
                </Text>
              ))}
            </View>

            {/* Bars */}
            <View style={styles.barsWrap}>
              {xLabels.map((d, i) => {
                const max = vitals.max || 100;

                const g = vitals.glucose[i] ?? 0;
                const b = vitals.bp[i] ?? 0;
                const e = vitals.ecg[i] ?? 0;

                const hG = Math.max(2, (g / max) * CHART_H);
                const hB = Math.max(2, (b / max) * CHART_H);
                const hE = Math.max(2, (e / max) * CHART_H);

                const total = totals[i] ?? 0;

                return (
                  <View key={d + i} style={styles.dayCol}>
                    <View style={styles.dayBars}>
                      <View
                        style={[
                          styles.metricBar,
                          { height: hG, backgroundColor: COLORS.glucose },
                        ]}
                      />
                      <View
                        style={[
                          styles.metricBar,
                          { height: hB, backgroundColor: COLORS.bp, marginLeft: BAR_GAP },
                        ]}
                      />
                      <View
                        style={[
                          styles.metricBar,
                          { height: hE, backgroundColor: COLORS.ecg, marginLeft: BAR_GAP },
                        ]}
                      />
                    </View>

                    <Text style={styles.dayTotal}>{total}</Text>
                    <Text style={styles.xTick}>{d}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Legend */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.glucose }]} />
              <Text style={styles.legendText}>Glucose</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.bp }]} />
              <Text style={styles.legendText}>BP</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.ecg }]} />
              <Text style={styles.legendText}>ECG</Text>
            </View>
          </View>

          <Text style={styles.noteText}>
            * Total score is a weighted composite of Glucose, BP, and ECG.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#ffffff" },
  container: { flex: 1, paddingHorizontal: HP },

  pageTitle: {
    fontSize: FS_PAGE,
    fontWeight: "800",
    color: "#111827",
    marginVertical: H * 0.012,
  },

  /* Selector */
  select: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: BORDER,
    borderColor: "#e5e7eb",
    borderRadius: RADIUS * 0.8,
    paddingVertical: SELECT_PV,
    paddingHorizontal: SELECT_PH,
    backgroundColor: "#fff",
  },
  selectText: {
    color: "#111827",
    fontWeight: "600",
    fontSize: FS_SELECT,
  },
  selectMenu: {
    marginTop: H * 0.008,
    borderWidth: BORDER,
    borderColor: "#e5e7eb",
    borderRadius: RADIUS * 0.8,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  selectItem: { paddingVertical: SELECT_PV, paddingHorizontal: SELECT_PH },
  selectItemText: { color: "#111827", fontSize: FS_SELECT },

  /* Cards */
  card: {
    backgroundColor: "#D7F1FB",
    borderRadius: RADIUS,
    padding: CARD_PAD,
    marginTop: CARD_MT,
  },
  cardTitle: {
    fontSize: FS_CARD_TITLE,
    fontWeight: "700",
    color: "#111827",
    marginBottom: H * 0.012,
  },

  /* Weekly score */
  scoreRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: W * 0.012,
    marginBottom: H * 0.012,
  },
  bigScore: {
    fontSize: BIG_SCORE,
    fontWeight: "800",
    color: "#111827",
    lineHeight: BIG_SCORE * 1.05,
  },
  scoreOutOf: {
    fontSize: FS_LABEL,
    fontWeight: "700",
    color: "#475569",
    marginBottom: H * 0.004,
  },

  /* Progress */
  progressTrack: {
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    backgroundColor: "#cfd8dc",
  },
  progressFill: {
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    backgroundColor: "#60a5fa",
  },
  progressLabel: {
    textAlign: "right",
    color: "#111827",
    marginTop: H * 0.01,
    fontWeight: "700",
    fontSize: FS_LABEL,
  },

  /* Pills */
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: W * 0.02,
    marginTop: H * 0.004,
    marginBottom: H * 0.012,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: W * 0.01,
    paddingVertical: H * 0.008,
    paddingHorizontal: W * 0.03,
    borderRadius: 999,
    backgroundColor: "#ffffff",
  },
  pillDot: {
    width: DOT * 0.8,
    height: DOT * 0.8,
    borderRadius: (DOT * 0.8) / 2,
  },
  pillLabel: { color: "#111827", fontWeight: "700", fontSize: FS_TICK },
  pillValue: { color: "#111827", fontWeight: "800", fontSize: FS_TICK },

  pillStrong: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: H * 0.008,
    paddingHorizontal: W * 0.035,
    borderRadius: 999,
    backgroundColor: "#111827",
    minWidth: W * 0.32,
  },
  pillStrongLabel: { color: "#fff", fontWeight: "800", fontSize: FS_TICK },
  pillStrongValue: { color: "#fff", fontWeight: "800", fontSize: FS_TICK },

  /* Chart */
  chartArea: {
    flexDirection: "row",
    marginTop: H * 0.008,
    paddingVertical: H * 0.01,
  },
  yAxis: {
    width: YAXIS_W,
    height: CHART_H + H * 0.04,
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingRight: W * 0.02,
  },
  yTick: {
    color: "#475569",
    fontSize: FS_TICK,
  },
  barsWrap: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: W * 0.02,
  },
  dayCol: {
    alignItems: "center",
    justifyContent: "flex-end",
    height: CHART_H + H * 0.04,
  },
  dayBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: CHART_H,
  },
  metricBar: {
    width: BAR_W,
    borderRadius: BAR_R,
  },
  dayTotal: {
    marginTop: H * 0.008,
    color: "#111827",
    fontSize: FS_TICK,
    fontWeight: "800",
  },
  xTick: {
    marginTop: H * 0.004,
    color: "#111827",
    fontSize: FS_TICK,
    fontWeight: "700",
  },

  /* Legend */
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: W * 0.04,
    marginTop: H * 0.012,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: W * 0.015,
  },
  legendDot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
  },
  legendText: { color: "#111827", fontSize: FS_LABEL, fontWeight: "700" },

  noteText: {
    marginTop: H * 0.01,
    color: "#475569",
    fontSize: FS_TICK,
  },
});
