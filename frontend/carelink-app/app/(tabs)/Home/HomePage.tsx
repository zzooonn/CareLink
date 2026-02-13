import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width: W, height: H } = Dimensions.get("window");

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
const NGROK_HEADER = { "ngrok-skip-browser-warning": "true" as const };

/* ✅ Caregivers.tsx 와 동일한 저장 키 */
const CAREGIVERS_STORAGE_KEY = "caregivers:list";

/* ✅ 로컬 아바타 매핑 (SignUp과 동일) */
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

type MetaTone = "neutral" | "good" | "warn" | "bad";

type Caregiver = {
  id: string;
  name: string;
  phone: string;
  avatarId: number; // 1~12
};

/* ---------- Responsive Tokens (비율 기반) ---------- */
const HP = W * 0.045;
const GAP = W * 0.03;
const CARD_GAP = W * 0.03;
const CARD_WIDTH = W - HP * 2;

const FS_H1 = W * 0.046;
const FS_H2 = W * 0.04;
const FS_BODY = W * 0.035;
const FS_SUB = W * 0.032;
const FS_CAP = W * 0.03;

const PROFILE = W * 0.11;
const ICON_CIRCLE = W * 0.085;
const ROUND_ACTION = W * 0.075;

const RADIUS_L = W * 0.045;
const RADIUS_M = W * 0.04;
const PAD_CARD = W * 0.045;
const PAD_ROW_V = H * 0.016;
const CARD_MIN_H = H * 0.18;

const DOT = W * 0.016;

const AV_STACK_W = W * 0.18;
const AV_STACK_H = W * 0.08;
const AVATAR = W * 0.07;
const AVATAR_SHIFT = W * 0.04;

/* ✅ News/Trends cards data */
const NEWS_CARDS = [
  {
    id: "c1",
    title: "Disease Trends",
    desc: "Check the latest safety guidelines.",
    route: "/Home/News",
    icon: "newspaper-outline",
  },
  {
    id: "c2",
    title: "Vitals Snapshot",
    desc: "Check blood pressure, glucose & ECG score at a glance.",
    route: "/Home/Vitals",
    icon: "pulse-outline",
  },
  {
    id: "c3",
    title: "Brain Training",
    desc: "Flip cards, earn points, and keep your mind sharp.",
    route: "/setting/BrainTraining",
    icon: "game-controller-outline",
  },
  {
    id: "c4",
    title: "ECG Simulator",
    desc: "Real-time simulated ECG powered by your model.",
    route: "/Home/ECGSimulatorScreen",
    icon: "heart-outline",
  },
];

async function getStoredUserId() {
  return await AsyncStorage.getItem("userId");
}

function pickAvatarSource(profileImageId?: number) {
  const id = profileImageId ?? 1;
  return AVATAR_LIST.find((a) => a.id === id)?.source ?? AVATAR_LIST[0].source;
}

function randomAvatarId() {
  return Math.floor(Math.random() * 12) + 1;
}

export default function HomePage() {
  const [page, setPage] = useState(0);
  const listRef = useRef<FlatList>(null);
  const router = useRouter();

  // ✅ Home에서 사용할 사용자 표시용 상태
  const [myName, setMyName] = useState<string>("");
  const [myAvatarId, setMyAvatarId] = useState<number>(1);
  const [loadingMe, setLoadingMe] = useState(false);

  // ✅ Home에 표시할 caregivers 아바타들
  const [caregiverAvatarIds, setCaregiverAvatarIds] = useState<number[]>([]);
  const [emergencyAvatarIds, setEmergencyAvatarIds] = useState<number[]>([randomAvatarId()]);

  // ✅ 서버에서 받아올 인사이트 점수
  const [insightsScore, setInsightsScore] = useState<number>(0);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const insightsMeta = useMemo(() => {
    const score = insightsScore;

    if (score >= 80) {
      return {
        text: `Insight score: ${score} 👍 Amazing work! Keep up the routine you're building.`,
        tone: "good" as const,
        icon: "happy-outline" as const,
      };
    }
    if (score >= 60) {
      return {
        text: `Insight score: ${score} 🙂 You're doing well. Try to get a bit more rest and stay consistent.`,
        tone: "warn" as const,
        icon: "thumbs-up-outline" as const,
      };
    }
    if (score >= 40) {
      return {
        text: `Insight score: ${score} 😕 Things look a bit off lately. Take it easy today and focus on recovery.`,
        tone: "bad" as const,
        icon: "warning-outline" as const,
      };
    }
    return {
      text: `Insight score: ${score} 🚨 High risk detected. Consider sharing this update with a caregiver.`,
      tone: "bad" as const,
      icon: "alert-circle-outline" as const,
    };
  }, [insightsScore]);

  useFocusEffect(
    useCallback(() => {
      const run = async () => {
        try {
          setLoadingMe(true);

          /* ---------------- (A) 내 프로필 캐시/서버 동기화 ---------------- */
          const cachedAvatarId = await AsyncStorage.getItem("profileImageId");
          if (cachedAvatarId) {
            const n = Number(cachedAvatarId);
            if (!Number.isNaN(n)) setMyAvatarId(n);
          }

          const cachedName = await AsyncStorage.getItem("userName");
          if (cachedName) setMyName(cachedName);

          if (API_BASE_URL) {
            const USER_ID = await getStoredUserId();
            if (USER_ID) {
              const res = await fetch(`${API_BASE_URL}/api/users/${USER_ID}`, {
                method: "GET",
                headers: { "Content-Type": "application/json", ...NGROK_HEADER },
              });

              const text = await res.text();
              if (res.ok) {
                const u = text ? JSON.parse(text) : null;

                const serverAvatarId =
                  typeof u?.profileImageId === "number"
                    ? u.profileImageId
                    : typeof u?.profile_image_id === "number"
                    ? u?.profile_image_id
                    : undefined;

                const serverName =
                  typeof u?.name === "string"
                    ? u.name
                    : typeof u?.userName === "string"
                    ? u.userName
                    : "";

                if (serverName) {
                  setMyName(serverName);
                  await AsyncStorage.setItem("userName", serverName);
                }

                if (serverAvatarId) {
                  setMyAvatarId(serverAvatarId);
                  await AsyncStorage.setItem("profileImageId", String(serverAvatarId));
                }
              }
            }
          }

          /* ---------------- (B) Caregivers 리스트 연동 ---------------- */
          const raw = await AsyncStorage.getItem(CAREGIVERS_STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw) as Caregiver[];
            if (Array.isArray(parsed)) {
              const ids = parsed
                .map((c) => (typeof c.avatarId === "number" ? c.avatarId : 1))
                .filter((n) => n >= 1 && n <= 12);

              setCaregiverAvatarIds(ids.slice(0, 3));
            }
          } else {
            setCaregiverAvatarIds([randomAvatarId(), randomAvatarId()]);
          }

          setEmergencyAvatarIds([randomAvatarId()]);

          /* ---------------- (C) Insights 점수 동기화 ---------------- */
          if (API_BASE_URL) {
            const USER_ID = await getStoredUserId(); // 예: "kevin"
            if (USER_ID) {
              try {
                setLoadingInsights(true);

                const url =
                  `${API_BASE_URL}/api/vitals/insights` +
                  `?userId=${encodeURIComponent(USER_ID)}` +
                  `&range=7d`;

                const res = await fetch(url, {
                  method: "GET",
                  headers: { ...NGROK_HEADER },
                });

                const text = await res.text();
                if (!res.ok) throw new Error(text || `HTTP ${res.status}`);

                const data = text ? JSON.parse(text) : null;

                // data: { labels:[], glucose:[], bp:[], ecg:[], max:100 }
                const glucose: number[] = Array.isArray(data?.glucose) ? data.glucose : [];
                const bp: number[] = Array.isArray(data?.bp) ? data.bp : [];
                const ecg: number[] = Array.isArray(data?.ecg) ? data.ecg : [];

                const L = Math.min(glucose.length, bp.length, ecg.length);

                if (L > 0) {
                  // Insights.tsx와 동일 가중치
                  const wG = 0.35,
                    wB = 0.35,
                    wE = 0.3;

                  let sum = 0;
                  for (let i = 0; i < L; i++) {
                    const total = Math.round(
                      (glucose[i] ?? 0) * wG + (bp[i] ?? 0) * wB + (ecg[i] ?? 0) * wE
                    );
                    sum += total;
                  }
                  const weekly = Math.round(sum / L);
                  const clamped = Math.max(0, Math.min(100, weekly));
                  setInsightsScore(clamped);
                } else {
                  setInsightsScore(0);
                }
              } catch (e) {
                console.log("Insights sync failed:", e);
              } finally {
                setLoadingInsights(false);
              }
            }
          }
        } finally {
          setLoadingMe(false);
        }
      };

      run();
    }, [])
  );

  const myAvatarSource = useMemo(() => pickAvatarSource(myAvatarId), [myAvatarId]);

  const onScroll = useCallback(
    (e: any) => {
      const x = e.nativeEvent.contentOffset.x;
      const idx = Math.round(x / (CARD_WIDTH + CARD_GAP));
      if (idx !== page) setPage(idx);
    },
    [page]
  );

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: H * 0.03 }}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ position: "relative" }}>
            <Image source={myAvatarSource} style={styles.profile} resizeMode="cover" />
            {loadingMe && (
              <View style={styles.profileLoadingOverlay}>
                <ActivityIndicator />
              </View>
            )}
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>
              {myName ? `${myName}'s Dashboard` : "CareLink Dashboard"}
            </Text>
            <Text style={styles.subtle}>Alerts for today</Text>
          </View>

          <TouchableOpacity onPress={() => router.push("/(tabs)/Home/Notification")}>
            <Text style={styles.seeAll}>SEE ALL</Text>
          </TouchableOpacity>
        </View>

        {/* News / Trends Carousel */}
        <View style={{ marginTop: H * 0.006 }}>
          <FlatList
            ref={listRef}
            data={NEWS_CARDS}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            snapToAlignment="start"
            decelerationRate="fast"
            snapToInterval={CARD_WIDTH + CARD_GAP}
            contentContainerStyle={{ paddingRight: HP }}
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => router.push(item.route as any)}
                style={[styles.newsCard, { width: CARD_WIDTH, marginRight: CARD_GAP }]}
              >
                <View style={styles.newsHeader}>
                  <Text style={styles.newsTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <View style={styles.iconCircle}>
                    <Ionicons name={item.icon as any} size={W * 0.05} color="#111" />
                  </View>
                </View>

                <Text style={styles.newsDesc} numberOfLines={2}>
                  {item.desc}
                </Text>

                <View style={styles.newsFooter}>
                  <Text style={styles.readMoreText}>Read update</Text>
                  <Ionicons name="arrow-forward-circle" size={W * 0.06} color="#111827" />
                </View>
              </TouchableOpacity>
            )}
            onScroll={onScroll}
            scrollEventThrottle={16}
            getItemLayout={(_, index) => ({
              length: CARD_WIDTH + CARD_GAP,
              offset: (CARD_WIDTH + CARD_GAP) * index,
              index,
            })}
          />

          {/* dots */}
          <View style={styles.dots}>
            {NEWS_CARDS.map((_, i) => (
              <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
            ))}
          </View>
        </View>

        {/* Weekly summary */}
        <Text style={styles.sectionTitle}>Weekly summary</Text>

        <SummaryCard
          title="Health insights"
          desc="Monitor health trends for loved ones"
          iconRight={<Ionicons name="pie-chart-outline" size={W * 0.05} color="#111" />}
          metaText={loadingInsights ? "Syncing insights..." : insightsMeta.text}
          metaTone={loadingInsights ? "neutral" : insightsMeta.tone}
          metaIcon={loadingInsights ? "sync-outline" : insightsMeta.icon}
          onPress={() => router.push("/Home/Insights")}
        />

        <SummaryCard
          title="Check medication reminders"
          desc="Don't forget to take medications."
          iconRight={<Ionicons name="notifications-outline" size={W * 0.05} color="#111" />}
          metaText="Turn on reminders so you never miss a dose."
          metaTone="neutral"
          metaIcon="calendar-outline"
          onPress={() => router.push("/Home/Medication")}
        />

        {/* Family connections */}
        <View style={styles.familyHeaderRow}>
          <Text style={styles.sectionTitle}>Family connections</Text>
          <TouchableOpacity style={styles.roundAction} onPress={() => router.push("/Home/Caregivers")}>
            <Ionicons name="add" size={W * 0.045} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Caregivers */}
        <FamilyRow
          icon={<Ionicons name="people-outline" size={W * 0.05} color="#111" />}
          label="Caregivers"
          avatarIds={caregiverAvatarIds}
          onPress={() => router.push("/Home/Caregivers")}
        />

        {/* Emergency contacts */}
        <FamilyRow
          icon={<Ionicons name="call-outline" size={W * 0.05} color="#111" />}
          label="Emergency contacts"
          avatarIds={emergencyAvatarIds}
          showDivider={false}
          onPress={() => router.push("/Home/Emergency")}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------- Sub Components ---------- */

function SummaryCard({
  title,
  desc,
  iconRight,
  onPress,
  metaText,
  metaTone = "neutral",
  metaIcon = "calendar-outline",
}: {
  title: string;
  desc: string;
  iconRight: React.ReactNode;
  onPress?: () => void;
  metaText?: string;
  metaTone?: MetaTone;
  metaIcon?: keyof typeof Ionicons.glyphMap;
}) {
  const metaColor =
    metaTone === "good"
      ? "#059669"
      : metaTone === "warn"
      ? "#d97706"
      : metaTone === "bad"
      ? "#dc2626"
      : "#4b5563";

  return (
    <TouchableOpacity style={styles.summaryCard} onPress={onPress} activeOpacity={0.9}>
      <View style={{ flex: 1, gap: H * 0.008 }}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDesc}>{desc}</Text>

        {!!metaText && (
          <View style={styles.timeRow}>
            <Ionicons name={metaIcon as any} size={W * 0.04} color={metaColor} />
            <Text style={[styles.timeText, { color: metaColor }]} numberOfLines={2}>
              {metaText}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.rightIcon}>{iconRight}</View>
    </TouchableOpacity>
  );
}

function FamilyRow({
  icon,
  label,
  avatarIds,
  showDivider = true,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  avatarIds: number[];
  showDivider?: boolean;
  onPress?: () => void;
}) {
  const ids = avatarIds?.length ? avatarIds.slice(0, 3) : [1];

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.familyRow, !showDivider && { borderBottomWidth: 0 }]}
    >
      <View style={styles.familyLeft}>
        {icon}
        <Text style={styles.familyText}>{label}</Text>
      </View>

      <View style={styles.avatarStack}>
        {ids.map((id, idx) => (
          <Image
            key={`${id}-${idx}`}
            source={pickAvatarSource(id)}
            style={[styles.avatar, { left: idx * AVATAR_SHIFT, zIndex: 10 - idx }]}
          />
        ))}
      </View>
    </TouchableOpacity>
  );
}

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#ffffff" },
  container: { flex: 1, paddingHorizontal: HP },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: GAP,
    marginTop: H * 0.01,
    marginBottom: H * 0.015,
  },
  profile: {
    width: PROFILE,
    height: PROFILE,
    borderRadius: PROFILE / 2,
  },
  profileLoadingOverlay: {
    position: "absolute",
    left: 0,
    top: 0,
    width: PROFILE,
    height: PROFILE,
    borderRadius: PROFILE / 2,
    backgroundColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: FS_H1,
    fontWeight: "700",
    color: "#111827",
  },
  subtle: {
    marginTop: H * 0.002,
    color: "#6b7280",
    fontSize: FS_SUB,
  },
  seeAll: {
    fontSize: FS_CAP,
    fontWeight: "600",
    color: "#111827",
    letterSpacing: W * 0.0008,
  },

  newsCard: {
    backgroundColor: "#e7e9ee",
    borderRadius: RADIUS_L,
    padding: PAD_CARD,
    minHeight: CARD_MIN_H,
    justifyContent: "space-between",
  },
  newsHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: H * 0.01,
  },
  newsTitle: {
    fontSize: FS_H1,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
    marginRight: W * 0.03,
  },
  iconCircle: {
    width: ICON_CIRCLE,
    height: ICON_CIRCLE,
    borderRadius: ICON_CIRCLE / 2,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  newsDesc: {
    fontSize: FS_BODY,
    color: "#4b5563",
    lineHeight: FS_BODY * 1.45,
    marginBottom: H * 0.012,
  },
  newsFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  readMoreText: {
    fontSize: FS_BODY,
    fontWeight: "600",
    color: "#111827",
  },

  dots: {
    flexDirection: "row",
    alignSelf: "center",
    gap: W * 0.015,
    marginVertical: H * 0.015,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: "#d1d5db",
  },
  dotActive: { backgroundColor: "#60a5fa" },

  sectionTitle: {
    fontSize: FS_H2,
    fontWeight: "700",
    color: "#111827",
    marginTop: H * 0.01,
    marginBottom: H * 0.01,
  },

  summaryCard: {
    backgroundColor: "#e5e7eb",
    borderRadius: RADIUS_M,
    padding: PAD_CARD,
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: H * 0.015,
  },
  cardTitle: {
    fontSize: FS_H2,
    fontWeight: "700",
    color: "#111827",
  },
  cardDesc: { fontSize: FS_BODY, color: "#374151" },
  timeRow: {
    marginTop: H * 0.008,
    flexDirection: "row",
    alignItems: "center",
    gap: W * 0.015,
  },
  timeText: { color: "#4b5563", fontSize: FS_SUB, flexShrink: 1 },
  rightIcon: { marginLeft: W * 0.03 },

  familyHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: H * 0.01,
  },
  roundAction: {
    width: ROUND_ACTION,
    height: ROUND_ACTION,
    borderRadius: ROUND_ACTION / 2,
    backgroundColor: "#22d3ee",
    alignItems: "center",
    justifyContent: "center",
  },
  familyRow: {
    backgroundColor: "#e5e7eb",
    borderRadius: RADIUS_M,
    paddingHorizontal: PAD_CARD,
    paddingVertical: PAD_ROW_V,
    marginBottom: H * 0.012,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#d1d5db",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  familyLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: W * 0.025,
  },
  familyText: { fontSize: FS_BODY, color: "#111827", fontWeight: "600" },
  avatarStack: {
    width: AV_STACK_W,
    height: AV_STACK_H,
    flexDirection: "row",
    position: "relative",
  },
  avatar: {
    position: "absolute",
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: W * 0.004,
    borderColor: "#e5e7eb",
  },
});
