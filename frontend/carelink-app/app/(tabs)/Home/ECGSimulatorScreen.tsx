import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import Svg, { Polyline } from "react-native-svg";

// --- UI Constants ---
const API_BASE_URL = process.env.EXPO_PUBLIC_AI_API_BASE_URL;

// ✅ 앱에 고정으로 박아둘 thresholds
const DEFAULT_THRESHOLDS = [0.6, 0.45, 0.5, 0.6, 0.7];

// ✅ 입력 소스 타입
type Source = "SIM_CLEAN" | "SIM_NOISY" | "SERVER_SAMPLE";

const SOURCE_CONFIG: Record<Source, { label: string }> = {
  SIM_CLEAN: { label: "SIM (Clean)" },
  SIM_NOISY: { label: "SIM (Noisy)" },
  SERVER_SAMPLE: { label: "SERVER Sample" },
};

// ✅ 서버 응답 타입
type PredictResponse = {
  probs: number[];
  thresholds?: number[];
  active_labels?: string[];
  risk_level?: "low" | "medium" | "high";
  top_label?: string;
  top_confidence?: number;
};

// ✅ 서버 샘플 응답 타입
type SampleResponse = {
  x: number[][];
  fs: number;
  label?: string;
  id?: string;
  from?: string;
};

// --- small utils ---
function randn() {
  let u = 0,
    v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function to12xL(x: number[][]): number[][] {
  if (!x || !x.length) throw new Error("x is empty");
  if (x.length === 12) return x;
  if (x[0].length === 12) {
    const L = x.length;
    const out = Array.from({ length: 12 }, () => new Array(L).fill(0));
    for (let i = 0; i < L; i++) {
      for (let ch = 0; ch < 12; ch++) out[ch][i] = x[i][ch];
    }
    return out;
  }
  throw new Error(`Expected (12,L) or (L,12). Got (${x.length}, ${x[0].length})`);
}

function padOrCrop12xL(x12: number[][], targetL: number) {
  const out = Array.from({ length: 12 }, () => new Array(targetL).fill(0));
  for (let ch = 0; ch < 12; ch++) {
    const src = x12[ch] ?? [];
    if (src.length >= targetL) {
      for (let i = 0; i < targetL; i++) out[ch][i] = src[src.length - targetL + i];
    } else {
      const pad = targetL - src.length;
      for (let i = 0; i < src.length; i++) out[ch][pad + i] = src[i];
    }
  }
  return out;
}

function decodeMultiLabelClient(probs: number[], thresholds: number[]) {
  const NAMES = ["NORM", "STTC", "MI", "CD", "HYP"];
  const active: string[] = [];
  for (let i = 0; i < probs.length; i++) {
    if (probs[i] >= thresholds[i]) active.push(NAMES[i] ?? `C${i}`);
  }
  return active;
}

function getRiskLevelClient(probs: number[]) {
  const abnormal = Math.max(probs[1] ?? 0, probs[2] ?? 0, probs[3] ?? 0, probs[4] ?? 0);
  if (abnormal >= 0.8) return "high";
  if (abnormal >= 0.6) return "medium";
  return "low";
}

function top1(probs: number[]) {
  const NAMES = ["NORM", "STTC", "MI", "CD", "HYP"];
  let bestIdx = 0;
  let best = -1;
  for (let i = 0; i < probs.length; i++) {
    if (probs[i] > best) {
      best = probs[i];
      bestIdx = i;
    }
  }
  return { idx: bestIdx, label: NAMES[bestIdx] ?? `C${bestIdx}`, prob: best };
}

function beatTemplate(t: number) {
  const g = (mu: number, sigma: number, amp: number) =>
    amp * Math.exp(-0.5 * Math.pow((t - mu) / sigma, 2));
  return (
    g(0.18, 0.03, 0.12) +
    g(0.38, 0.012, -0.15) +
    g(0.4, 0.01, 1.0) +
    g(0.43, 0.014, -0.25) +
    g(0.68, 0.05, 0.3)
  );
}

function createSimGenerator(fs: number, variant: "clean" | "noisy") {
  const hr = 70;
  const noiseStd = variant === "noisy" ? 0.12 : 0.02;
  const leadMults = [0.7, 1.1, 0.4, -0.9, -0.2, 0.8, 0.2, 0.5, 0.8, 1.1, 1.0, 0.8];
  let phase = 0;
  const beatDuration = 60 / hr;
  let tSec = 0;
  const wanderFreq = 0.2;
  const wanderAmp = variant === "noisy" ? 0.03 : 0.015;
  const wanderPhase = Math.random() * Math.PI * 2;

  return () => {
    const dt = 1 / fs;
    tSec += dt;
    phase += dt / beatDuration;
    if (phase >= 1) phase -= 1;
    const clean = beatTemplate(phase);
    const wander = wanderAmp * Math.sin(2 * Math.PI * wanderFreq * tSec + wanderPhase);
    return leadMults.map((m) => clean * m + wander + noiseStd * randn());
  };
}

async function predictWindow(window12xL: number[][], fs: number) {
  if (!API_BASE_URL) throw new Error("API URL is not set");
  const res = await fetch(`${API_BASE_URL}/predict_window`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ x: window12xL, fs }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${text}`.trim());
  }
  return (await res.json()) as PredictResponse;
}

async function fetchRandomSampleWindow() {
  if (!API_BASE_URL) throw new Error("API URL is not set");
  const url = `${API_BASE_URL}/sample_window?_t=${Date.now()}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Sample HTTP ${res.status} ${text}`.trim());
  }
  return (await res.json()) as SampleResponse;
}

export default function ECGSimulatorScreen() {
  const fs = 500;
  const viewSec = 10;
  const targetL = fs * viewSec;
  const AUTO_RELOAD_SAMPLE_MS = 6000;

  // ✅ 화면 크기 반응형
  const { height: winH } = useWindowDimensions();
  const chartH = Math.round(winH * 0.27);

  // ✅ chartBox 실제 너비(패딩/여백 포함한 실제 렌더 폭)
  const [chartW, setChartW] = useState<number>(0);

  const [source, setSource] = useState<Source>("SIM_CLEAN");
  const [isRunning, setIsRunning] = useState(true);
  const [sampleMeta, setSampleMeta] = useState<string>("");
  const [pred, setPred] = useState<PredictResponse | null>(null);
  const [netErr, setNetErr] = useState<string | null>(null);
  const [view1ch, setView1ch] = useState<number[]>(Array(targetL).fill(0));

  const buf12Ref = useRef<number[][]>(Array.from({ length: 12 }, () => Array(targetL).fill(0)));
  const genRef = useRef<null | (() => number[])>(null);
  const inFlight = useRef(false);
  const lastSampleIdRef = useRef<string | null>(null);

  const resetBuffers = useCallback(() => {
    buf12Ref.current = Array.from({ length: 12 }, () => Array(targetL).fill(0));
    setView1ch(Array(targetL).fill(0));
    setPred(null);
    setNetErr(null);
  }, [targetL]);

  const runInferenceOnce = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const result = await predictWindow(buf12Ref.current, fs);
      setPred(result);
      setNetErr(null);
    } catch (e: any) {
      setNetErr(e?.message ?? "Infer error");
    } finally {
      inFlight.current = false;
    }
  }, [fs]);

  const loadSample = useCallback(
    async (forceNew: boolean = false) => {
      try {
        setNetErr(null);
        setPred(null);
        setSampleMeta("Loading sample...");
        const prevId = lastSampleIdRef.current;
        let s: SampleResponse | null = null;
        let tries = 0;
        const maxTries = forceNew ? 5 : 1;

        while (tries < maxTries) {
          tries += 1;
          s = await fetchRandomSampleWindow();
          if (forceNew && s?.id && prevId && s.id === prevId) continue;
          break;
        }
        if (!s) throw new Error("Failed to load sample");

        const x12 = padOrCrop12xL(to12xL(s.x), targetL);
        buf12Ref.current = x12;
        setView1ch(x12[1].slice());
        lastSampleIdRef.current = s.id ?? null;
        setSampleMeta(`Sample loaded: label=${s.label ?? "-"} | id=${s.id ?? "-"}`);
      } catch (e: any) {
        setSampleMeta("");
        setNetErr(e?.message ?? "Failed to load sample");
      }
    },
    [targetL]
  );

  useEffect(() => {
    resetBuffers();
    if (source === "SIM_CLEAN") genRef.current = createSimGenerator(fs, "clean");
    else if (source === "SIM_NOISY") genRef.current = createSimGenerator(fs, "noisy");
    else genRef.current = null;
  }, [source, fs, resetBuffers]);

  // SIM Streaming
  useEffect(() => {
    if (!(source === "SIM_CLEAN" || source === "SIM_NOISY")) return;
    if (!isRunning) return;

    const chunk = 10;
    const intervalMs = (1000 * chunk) / fs;

    const id = setInterval(() => {
      if (!genRef.current) return;

      const gen = genRef.current;
      const newData: number[][] = Array.from({ length: 12 }, () => []);
      const new1ch: number[] = [];

      for (let i = 0; i < chunk; i++) {
        const s12 = gen();
        new1ch.push(s12[1]);
        for (let ch = 0; ch < 12; ch++) newData[ch].push(s12[ch]);
      }

      for (let ch = 0; ch < 12; ch++) {
        buf12Ref.current[ch] = buf12Ref.current[ch].slice(chunk).concat(newData[ch]);
      }

      setView1ch((prev) => prev.slice(chunk).concat(new1ch));
    }, intervalMs);

    return () => clearInterval(id);
  }, [source, isRunning, fs]);

  // Server Sample Init
  useEffect(() => {
    if (source === "SERVER_SAMPLE") loadSample(false);
  }, [source, loadSample]);

  // Auto Inference Loop (2sec)
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(runInferenceOnce, 2000);
    return () => clearInterval(id);
  }, [isRunning, runInferenceOnce]);

  // Server Sample Auto Reload
  useEffect(() => {
    if (source !== "SERVER_SAMPLE" || !isRunning) return;
    const id = setInterval(() => loadSample(true), AUTO_RELOAD_SAMPLE_MS);
    return () => clearInterval(id);
  }, [source, isRunning, loadSample]);

  // ✅ 반응형 points: chartW/chartH 기준으로 계산
  const points = useMemo(() => {
    if (!chartW || !chartH) return "";

    const downsample = 5;
    const data = view1ch.filter((_, i) => i % downsample === 0);

    const paddingX = 15;
    const paddingY = 10;

    const width = Math.max(1, chartW - paddingX * 2);
    const height = Math.max(1, chartH - paddingY * 2);
    const xStep = width / Math.max(1, data.length - 1);

    const yMin = -1.5;
    const yMax = 2.0;

    return data
      .map((v, i) => {
        const x = paddingX + i * xStep;
        const normalized = (v - yMin) / (yMax - yMin);
        const y = paddingY + height * (1 - normalized);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [view1ch, chartW, chartH]);

  const thresholds = pred?.thresholds ?? DEFAULT_THRESHOLDS;
  const probs = pred?.probs ?? null;
  const activeLabels = probs ? decodeMultiLabelClient(probs, thresholds) : [];
  const risk = probs ? getRiskLevelClient(probs) : "low";
  const top = probs ? top1(probs) : null;

  const badge = (() => {
    if (!probs) return { bg: "#f3f4f6", txt: "#111827", label: "Analyzing..." };
    const labelStr = activeLabels.length ? activeLabels.join(", ") : top?.label ?? "UNCERTAIN";
    if (activeLabels.includes("NORM") && activeLabels.length === 1)
      return { bg: "#d1fae5", txt: "#065f46", label: "NORMAL" };
    if (risk === "high") return { bg: "#fee2e2", txt: "#991b1b", label: labelStr };
    if (risk === "medium") return { bg: "#ffedd5", txt: "#9a3412", label: labelStr };
    return { bg: "#e0f2fe", txt: "#075985", label: labelStr };
  })();

  return (
    <View style={styles.container}>
      <Text style={styles.header}>AI ECG Diagnostics</Text>

      <View style={[styles.badge, { backgroundColor: badge.bg }]}>
        <Text style={[styles.badgeText, { color: badge.txt }]}>{badge.label}</Text>
        {!!probs && (
          <Text style={[styles.subBadge, { color: badge.txt }]}>
            Risk: {risk.toUpperCase()} {top ? `| Top: ${(top.prob * 100).toFixed(1)}%` : ""}
          </Text>
        )}
      </View>

      {netErr && <Text style={styles.err}>Error: {netErr}</Text>}
      {!!sampleMeta && source === "SERVER_SAMPLE" && <Text style={styles.meta}>{sampleMeta}</Text>}

      {/* ✅ chartBox 실제 width를 onLayout으로 받고, Svg도 동일 width 사용 */}
      <View
        style={[styles.chartBox, { height: chartH }]}
        onLayout={(e) => setChartW(e.nativeEvent.layout.width)}
      >
        <Svg width={chartW || 1} height={chartH}>
          <Polyline points={points} fill="none" stroke="#2563eb" strokeWidth="2" />
        </Svg>
        <Text style={styles.chartLabel}>Lead II (Display)</Text>
      </View>

      <View style={styles.controls}>
        {(Object.keys(SOURCE_CONFIG) as Source[]).map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.btn, source === s && styles.btnActive]}
            onPress={() => setSource(s)}
          >
            <Text style={[styles.btnText, source === s && styles.btnTextActive]}>
              {SOURCE_CONFIG[s].label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.controls2}>
        <TouchableOpacity
          style={[styles.smallBtn, isRunning ? styles.smallBtnActive : null]}
          onPress={() => setIsRunning((p) => !p)}
        >
          <Text style={[styles.smallBtnText, isRunning ? styles.smallBtnTextActive : null]}>
            {isRunning ? "Running" : "Paused"}
          </Text>
        </TouchableOpacity>

        {source === "SERVER_SAMPLE" && (
          <TouchableOpacity style={styles.smallBtn} onPress={() => loadSample(true)}>
            <Text style={styles.smallBtnText}>New Random Sample</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView 
        style={styles.infoBox}
        contentContainerStyle={styles.infoBoxContent}
        showsVerticalScrollIndicator
      >
        <Text style={styles.infoTitle}>AI Analysis Details</Text>
        {probs ? (
          ["NORM", "STTC", "MI", "CD", "HYP"].map((name, i) => (
            <Text key={name} style={styles.infoText}>
              • {name}: {(probs[i] * 100).toFixed(1)}% (Threshold: {thresholds[i]})
            </Text>
          ))
        ) : (
          <Text style={styles.infoText}>Calculating probabilities...</Text>
        )}
        <View style={styles.divider} />
        <Text style={styles.infoTitle}>System Status</Text>
        <Text style={styles.infoText}>• Source: {SOURCE_CONFIG[source].label}</Text>
        <Text style={styles.infoText}>
          • Status: {isRunning ? "Real-time Monitoring Active" : "Paused"}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 14,
    color: "#111827",
  },

  badge: {
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  badgeText: { fontSize: 18, fontWeight: "700" },
  subBadge: { marginTop: 4, fontSize: 12, fontWeight: "700" },

  err: { color: "red", textAlign: "center", marginBottom: 6 },
  meta: { color: "#334155", textAlign: "center", marginBottom: 6, fontSize: 12 },

  chartBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 14,
    justifyContent: "center",
  },
  chartLabel: {
    position: "absolute",
    top: 10,
    left: 10,
    fontSize: 12,
    color: "#64748b",
  },
  infoBox: {
    flex: 1,                 // ⭐ 이게 핵심 (남는 공간을 ScrollView가 차지)
    padding: 14,
    backgroundColor: "#f0f9ff",
    borderRadius: 10,
  },
  infoBoxContent: {
    paddingBottom: 24,       // ⭐ 맨 아래 잘림/터치여유 방지
  },


  controls: { flexDirection: "row", gap: 10, marginBottom: 10 },
  btn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
  },
  btnActive: { backgroundColor: "#111827" },
  btnText: { fontWeight: "700", color: "#64748b", fontSize: 12 },
  btnTextActive: { color: "#fff" },

  controls2: { flexDirection: "row", gap: 10, marginBottom: 10 },
  smallBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
  },
  smallBtnActive: { backgroundColor: "#0f172a" },
  smallBtnText: { fontWeight: "800", color: "#0f172a", fontSize: 12 },
  smallBtnTextActive: { color: "#fff" },
  infoTitle: { fontWeight: "900", color: "#075985", marginBottom: 6, marginTop: 6 },
  infoText: { color: "#0369a1", marginBottom: 4, fontSize: 13 },
  divider: { height: 10 },
});
