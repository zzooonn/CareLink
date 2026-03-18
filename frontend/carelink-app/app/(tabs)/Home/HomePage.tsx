import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
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
import { ScaledText as Text } from "../../../components/ScaledText";
import { authFetch } from "../../../utils/api";

const { width: W, height: H } = Dimensions.get("window");

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
const CAREGIVERS_STORAGE_KEY = "caregivers:list";

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
  avatarId: number;
};

/* ---------- UI Constants ---------- */
const HP = W * 0.045;
const GAP = W * 0.03;
const CARD_GAP = W * 0.03;
const CARD_WIDTH = W - HP * 2;
// 노인 접근성: 주요 텍스트 최소 22sp 보장 (반응형)
const FS_H1   = Math.max(22, W * 0.055); // 헤딩1 ≥ 22sp
const FS_H2   = Math.max(20, W * 0.048); // 헤딩2
const FS_BODY = Math.max(18, W * 0.044); // 본문
const FS_SUB  = Math.max(16, W * 0.040); // 보조
const FS_CAP  = Math.max(14, W * 0.038); // 캡션
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

const NEWS_CARDS = [
  { id: "c1", title: "Disease Trends", desc: "Check the latest safety guidelines.", route: "/Home/News", icon: "newspaper-outline" },
  { id: "c2", title: "Vitals Snapshot", desc: "Check blood pressure, glucose & ECG score at a glance.", route: "/Home/Vitals", icon: "pulse-outline" },
  { id: "c3", title: "Brain Training", desc: "Flip cards, earn points, and keep your mind sharp.", route: "/setting/BrainTraining", icon: "game-controller-outline" },
  { id: "c4", title: "ECG Simulator", desc: "Real-time simulated ECG powered by your model.", route: "/Home/ECGSimulatorScreen", icon: "heart-outline" },
];

function pickAvatarSource(profileImageId?: number) {
  const id = profileImageId ?? 1;
  return AVATAR_LIST.find((a) => a.id === id)?.source ?? AVATAR_LIST[0].source;
}


export default function HomePage() {
  const [page, setPage] = useState(0);
  const listRef = useRef<FlatList>(null);
  const router = useRouter();


  const [myName, setMyName] = useState<string>("");
  const [myAvatarId, setMyAvatarId] = useState<number>(1);
  const [loadingMe, setLoadingMe] = useState(false);
  const [caregiverAvatarIds, setCaregiverAvatarIds] = useState<number[]>([]);
  const [insightsScore, setInsightsScore] = useState<number>(0);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const insightsMeta = useMemo(() => {
    const s = insightsScore;
    if (s >= 80) return { text: `Insight score: ${s} - Amazing work!`, tone: "good" as const, icon: "happy-outline" as const };
    if (s >= 60) return { text: `Insight score: ${s} - Doing well. Stay consistent.`, tone: "warn" as const, icon: "thumbs-up-outline" as const };
    if (s >= 40) return { text: `Insight score: ${s} - Irregular trends detected. Consider consulting your caregiver.`, tone: "bad" as const, icon: "warning-outline" as const };
    return { text: `Insight score: ${s} - High risk. Alert your caregiver.`, tone: "bad" as const, icon: "alert-circle-outline" as const };
  }, [insightsScore]);

  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        try {
          setLoadingMe(true);
          const userId = await AsyncStorage.getItem("userId");
          
          // 1. Profile Info (Cache First)
          const cachedName = await AsyncStorage.getItem("userName");
          const cachedImg = await AsyncStorage.getItem("profileImageId");
          if (cachedName) setMyName(cachedName);
          if (cachedImg) setMyAvatarId(Number(cachedImg));

          if (API_BASE_URL && userId) {
            const res = await authFetch(`/api/users/${userId}`);
            if (res.ok) {
              const u = await res.json();
              const sName = u.name || u.userName || "";
              const sImg = u.profileImageId || u.profile_image_id || 1;
              setMyName(sName);
              setMyAvatarId(sImg);
              await AsyncStorage.setItem("userName", sName);
              await AsyncStorage.setItem("profileImageId", String(sImg));
            }
          }

          // 2. Caregivers
          const cgRaw = await AsyncStorage.getItem(CAREGIVERS_STORAGE_KEY);
          if (cgRaw) {
            const parsed = JSON.parse(cgRaw) as Caregiver[];
            setCaregiverAvatarIds(parsed.map(c => c.avatarId || 1).slice(0, 3));
          } else {
            setCaregiverAvatarIds([]);
          }

          // 3. Insights — weeklyScore는 서버에서 계산 (glucose 35% + bp 35% + ecg 30%)
          if (API_BASE_URL && userId) {
            setLoadingInsights(true);
            const iRes = await authFetch(`/api/vitals/insights?userId=${userId}&range=7d`);
            if (iRes.ok) {
              const data = await iRes.json();
              setInsightsScore(data.weeklyScore ?? 0);
            }
          }
        } catch (e) {
          console.log("Home Sync Error:", e);
        } finally {
          setLoadingMe(false);
          setLoadingInsights(false);
        }
      };
      fetchData();
    }, [])
  );

  const onScroll = (e: any) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / (CARD_WIDTH + CARD_GAP));
    if (idx !== page) setPage(idx);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <View style={styles.header}>
          <View style={{ position: "relative" }}>
            <Image source={pickAvatarSource(myAvatarId)} style={styles.profile} />
            {loadingMe && <View style={styles.profileLoadingOverlay}><ActivityIndicator size="small" /></View>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { fontSize: FS_H1 }]}>{myName ? `${myName}'s Dashboard` : "CareLink Dashboard"}</Text>
            <Text style={[styles.subtle, { fontSize: FS_SUB }]}>Alerts for today</Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/Home/Notification")}>
            <Text style={[styles.seeAll, { fontSize: FS_CAP }]}>SEE ALL</Text>
          </TouchableOpacity>
        </View>

        {/* Carousel */}
        <View>
          <FlatList
            ref={listRef}
            data={NEWS_CARDS}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_WIDTH + CARD_GAP}
            decelerationRate="fast"
            contentContainerStyle={{ paddingRight: HP }}
            renderItem={({ item }) => (
              <TouchableOpacity activeOpacity={0.9} onPress={() => router.push(item.route as any)} style={[styles.newsCard, { width: CARD_WIDTH, marginRight: CARD_GAP }]}>
                <View style={styles.newsHeader}>
                  <Text style={[styles.newsTitle, { fontSize: FS_H1 }]}>{item.title}</Text>
                  <View style={styles.iconCircle}><Ionicons name={item.icon as any} size={20} color="#111" /></View>
                </View>
                <Text style={[styles.newsDesc, { fontSize: FS_BODY }]} numberOfLines={2}>{item.desc}</Text>
                <View style={styles.newsFooter}>
                  <Text style={[styles.readMoreText, { fontSize: FS_BODY }]}>Read update</Text>
                  <Ionicons name="arrow-forward-circle" size={24} color="#111" />
                </View>
              </TouchableOpacity>
            )}
            onScroll={onScroll}
            scrollEventThrottle={16}
          />
          <View style={styles.dots}>
            {NEWS_CARDS.map((_, i) => <View key={i} style={[styles.dot, i === page && styles.dotActive]} />)}
          </View>
        </View>

        <Text style={[styles.sectionTitle, { fontSize: FS_H2 }]}>Weekly summary</Text>

        <SummaryCard
          title="Health insights"
          desc="Monitor health trends for loved ones"
          iconRight={<Ionicons name="pie-chart-outline" size={20} color="#111" />}
          metaText={loadingInsights ? "Syncing..." : insightsMeta.text}
          metaTone={insightsMeta.tone}
          metaIcon={insightsMeta.icon}
          onPress={() => router.push("/Home/Insights")}
                  />

        <SummaryCard
          title="Medication reminders"
          desc="Keep track of your daily medications."
          iconRight={<Ionicons name="notifications-outline" size={20} color="#111" />}
          metaText="Enable reminders to maintain your medication schedule."
          onPress={() => router.push("/Home/Medication")}
                  />

        <View style={styles.familyHeaderRow}>
          <Text style={[styles.sectionTitle, { fontSize: FS_H2 }]}>Family connections</Text>
          <TouchableOpacity style={styles.roundAction} onPress={() => router.push("/Home/Caregivers")}>
            <Ionicons name="add" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        <FamilyRow icon={<Ionicons name="people-outline" size={20} color="#111" />} label="Caregivers" avatarIds={caregiverAvatarIds} onPress={() => router.push("/Home/Caregivers")} />
        <FamilyRow icon={<Ionicons name="call-outline" size={20} color="#111" />} label="Emergency contacts" avatarIds={caregiverAvatarIds} showDivider={false} onPress={() => router.push("/Home/Emergency")} />

      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------- Sub Components ---------- */

function SummaryCard({ title, desc, iconRight, onPress, metaText, metaTone = "neutral", metaIcon = "calendar-outline" }: any) {
  const metaColor = metaTone === "good" ? "#059669" : metaTone === "warn" ? "#d97706" : metaTone === "bad" ? "#dc2626" : "#4b5563";
  return (
    <TouchableOpacity style={styles.summaryCard} onPress={onPress} activeOpacity={0.9}>
      <View style={{ flex: 1, gap: 5 }}>
        <Text style={[styles.cardTitle, { fontSize: FS_H2 }]}>{title}</Text>
        <Text style={[styles.cardDesc, { fontSize: FS_BODY }]}>{desc}</Text>
        {!!metaText && (
          <View style={styles.timeRow}>
            <Ionicons name={metaIcon as any} size={16} color={metaColor} />
            <Text style={[styles.timeText, { color: metaColor, fontSize: FS_SUB }]} numberOfLines={2}>{metaText}</Text>
          </View>
        )}
      </View>
      <View style={styles.rightIcon}>{iconRight}</View>
    </TouchableOpacity>
  );
}

function FamilyRow({ icon, label, avatarIds, showDivider = true, onPress }: any) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[styles.familyRow, !showDivider && { borderBottomWidth: 0 }]}>
      <View style={styles.familyLeft}>{icon}<Text style={[styles.familyText, { fontSize: FS_BODY }]}>{label}</Text></View>
      <View style={styles.avatarStack}>
        {avatarIds.slice(0, 3).map((id: number, idx: number) => (
          <Image key={idx} source={pickAvatarSource(id)} style={[styles.avatar, { left: idx * AVATAR_SHIFT, zIndex: 10 - idx }]} />
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

