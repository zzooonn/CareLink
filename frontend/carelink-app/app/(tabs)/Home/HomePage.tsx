import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { type Href, useFocusEffect, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScaledText as Text } from "../../../components/ScaledText";
import { authFetch } from "../../../utils/api";
import { palette, pressShadow, radius, shadow, spacing, typeScale, webShell } from "../../../constants/design";

const { width: WINDOW_WIDTH } = Dimensions.get("window");
const SHELL_WIDTH = Math.min(WINDOW_WIDTH, 520);
const HORIZONTAL_PADDING = spacing.md;
const CARD_WIDTH = SHELL_WIDTH - HORIZONTAL_PADDING * 2;
const CARD_GAP = spacing.sm;

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

type NewsCard = {
  id: string;
  title: string;
  desc: string;
  route: Href;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tint: string;
  accent: string;
};

const NEWS_CARDS: NewsCard[] = [
  {
    id: "c1",
    title: "Disease Trends",
    desc: "Latest public health signals and safety guidance.",
    route: "/Home/News",
    icon: "newspaper-outline",
    label: "Watch",
    tint: palette.clinicalSoft,
    accent: palette.clinical,
  },
  {
    id: "c2",
    title: "Vitals Snapshot",
    desc: "Blood pressure, glucose, and ECG score in one review.",
    route: "/Home/Vitals",
    icon: "pulse-outline",
    label: "Log",
    tint: palette.successSoft,
    accent: palette.success,
  },
  {
    id: "c3",
    title: "Brain Training",
    desc: "Short memory rounds that keep the routine light.",
    route: "/setting/BrainTraining",
    icon: "game-controller-outline",
    label: "Train",
    tint: palette.signalSoft,
    accent: palette.signal,
  },
  {
    id: "c4",
    title: "ECG Simulator",
    desc: "A model-backed ECG stream for rhythm checks.",
    route: "/Home/ECGSimulatorScreen",
    icon: "heart-outline",
    label: "Sim",
    tint: palette.rescueSoft,
    accent: palette.rescue,
  },
];

function pickAvatarSource(profileImageId?: number) {
  const id = profileImageId ?? 1;
  return AVATAR_LIST.find((avatar) => avatar.id === id)?.source ?? AVATAR_LIST[0].source;
}

function getToneColor(tone: MetaTone) {
  if (tone === "good") return palette.success;
  if (tone === "warn") return palette.signal;
  if (tone === "bad") return palette.rescue;
  return palette.muted;
}

export default function HomePage() {
  const [page, setPage] = useState(0);
  const listRef = useRef<FlatList<NewsCard>>(null);
  const router = useRouter();

  const [myName, setMyName] = useState<string>("");
  const [myAvatarId, setMyAvatarId] = useState<number>(1);
  const [loadingMe, setLoadingMe] = useState(false);
  const [caregiverAvatarIds, setCaregiverAvatarIds] = useState<number[]>([]);
  const [insightsScore, setInsightsScore] = useState<number>(0);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const lastFetchRef = useRef(0);

  const insightsMeta = useMemo(() => {
    const s = insightsScore;
    if (s >= 80) return { text: `Insight score ${s}: stable routine`, tone: "good" as const, icon: "checkmark-circle-outline" as const };
    if (s >= 60) return { text: `Insight score ${s}: keep monitoring`, tone: "warn" as const, icon: "trending-up-outline" as const };
    if (s >= 40) return { text: `Insight score ${s}: irregular trend`, tone: "bad" as const, icon: "warning-outline" as const };
    return { text: `Insight score ${s}: caregiver review needed`, tone: "bad" as const, icon: "alert-circle-outline" as const };
  }, [insightsScore]);

  const apiStatus = API_BASE_URL ? "API configured" : "API setup needed";
  const scoreColor = getToneColor(insightsMeta.tone);

  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        try {
          setLoadingMe(true);
          const userId = await AsyncStorage.getItem("userId");

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

          const cgRaw = await AsyncStorage.getItem(CAREGIVERS_STORAGE_KEY);
          if (cgRaw) {
            const parsed = JSON.parse(cgRaw) as Caregiver[];
            setCaregiverAvatarIds(parsed.map((caregiver) => caregiver.avatarId || 1).slice(0, 3));
          } else {
            setCaregiverAvatarIds([]);
          }

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

      const now = Date.now();
      if (now - lastFetchRef.current < 10_000) return;
      lastFetchRef.current = now;
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
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statusPanel}>
          <View style={styles.heroTop}>
            <View style={styles.profileWrap}>
              <Image source={pickAvatarSource(myAvatarId)} style={styles.profile} />
              {loadingMe && (
                <View style={styles.profileLoadingOverlay}>
                  <ActivityIndicator size="small" color={palette.primary} />
                </View>
              )}
            </View>

            <View style={styles.heroCopy}>
              <Text style={styles.kicker}>TODAY</Text>
              <Text style={styles.headerTitle} numberOfLines={2}>
                {myName ? `${myName}'s dashboard` : "Care dashboard"}
              </Text>
            </View>
          </View>

          <View style={styles.signalGrid}>
            <MetricTile
              label="Insights"
              value={loadingInsights ? "Syncing" : `${insightsScore}/100`}
              icon="analytics-outline"
              color={scoreColor}
            />
            <MetricTile
              label="Care team"
              value={`${caregiverAvatarIds.length} linked`}
              icon="people-outline"
              color={palette.clinical}
            />
          </View>

          <View style={styles.scoreTrack}>
            <View
              style={[
                styles.scoreFill,
                {
                  width: `${Math.max(4, Math.min(100, insightsScore))}%`,
                  backgroundColor: scoreColor,
                },
              ]}
            />
          </View>

          <View style={styles.statusFooter}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>{apiStatus}</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/Home/Notification")} activeOpacity={0.8}>
              <Text style={styles.statusLink}>Review alerts</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Priority actions</Text>
          <Text style={styles.sectionMeta}>{page + 1}/{NEWS_CARDS.length}</Text>
        </View>

        <View>
          <FlatList
            ref={listRef}
            data={NEWS_CARDS}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_WIDTH + CARD_GAP}
            decelerationRate="fast"
            contentContainerStyle={styles.carouselContent}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => router.push(item.route)}
                style={[
                  styles.newsCard,
                  {
                    width: CARD_WIDTH,
                    marginRight: CARD_GAP,
                    backgroundColor: item.tint,
                    borderColor: item.accent,
                  },
                ]}
              >
                <View style={styles.newsHeader}>
                  <View style={[styles.iconCircle, { backgroundColor: item.accent }]}>
                    <Ionicons name={item.icon} size={22} color={palette.surface} />
                  </View>
                  <Text style={[styles.newsLabel, { color: item.accent }]}>{item.label}</Text>
                </View>
                <View>
                  <Text style={styles.newsTitle}>{item.title}</Text>
                  <Text style={styles.newsDesc} numberOfLines={2}>{item.desc}</Text>
                </View>
                <View style={styles.newsFooter}>
                  <Text style={styles.readMoreText}>Open module</Text>
                  <Ionicons name="arrow-forward" size={20} color={palette.ink} />
                </View>
              </TouchableOpacity>
            )}
            onScroll={onScroll}
            scrollEventThrottle={16}
          />
          <View style={styles.dots}>
            {NEWS_CARDS.map((card, i) => (
              <View key={card.id} style={[styles.dot, i === page && styles.dotActive]} />
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Weekly summary</Text>

        <SummaryCard
          title="Health insights"
          desc="Trend review across glucose, blood pressure, and ECG."
          iconRight={<Ionicons name="pie-chart-outline" size={22} color={palette.ink} />}
          metaText={loadingInsights ? "Syncing latest score" : insightsMeta.text}
          metaTone={insightsMeta.tone}
          metaIcon={insightsMeta.icon}
          onPress={() => router.push("/Home/Insights")}
        />

        <SummaryCard
          title="Medication reminders"
          desc="Daily adherence check and medication schedule."
          iconRight={<Ionicons name="notifications-outline" size={22} color={palette.ink} />}
          metaText="Reminder setup keeps the care loop visible."
          onPress={() => router.push("/Home/Medication")}
        />

        <View style={styles.familyHeaderRow}>
          <Text style={styles.sectionTitle}>Family connections</Text>
          <TouchableOpacity style={styles.roundAction} onPress={() => router.push("/Home/Caregivers")} activeOpacity={0.84}>
            <Ionicons name="add" size={20} color={palette.surface} />
          </TouchableOpacity>
        </View>

        <View style={styles.familyPanel}>
          <FamilyRow
            icon={<Ionicons name="people-outline" size={21} color={palette.primaryDark} />}
            label="Caregivers"
            avatarIds={caregiverAvatarIds}
            onPress={() => router.push("/Home/Caregivers")}
          />
          <FamilyRow
            icon={<Ionicons name="call-outline" size={21} color={palette.rescue} />}
            label="Emergency contacts"
            avatarIds={caregiverAvatarIds}
            showDivider={false}
            onPress={() => router.push("/Home/Emergency")}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricTile({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}) {
  return (
    <View style={styles.metricTile}>
      <View style={[styles.metricIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.metricLabel} numberOfLines={1}>{label}</Text>
        <Text style={styles.metricValue} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

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
  onPress: () => void;
  metaText?: string;
  metaTone?: MetaTone;
  metaIcon?: keyof typeof Ionicons.glyphMap;
}) {
  const metaColor = getToneColor(metaTone);
  return (
    <TouchableOpacity style={styles.summaryCard} onPress={onPress} activeOpacity={0.9}>
      <View style={[styles.summaryAccent, { backgroundColor: metaColor }]} />
      <View style={styles.summaryBody}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDesc}>{desc}</Text>
        {!!metaText && (
          <View style={[styles.timeRow, { backgroundColor: `${metaColor}12` }]}>
            <Ionicons name={metaIcon} size={16} color={metaColor} />
            <Text style={[styles.timeText, { color: metaColor }]} numberOfLines={2}>{metaText}</Text>
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
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.familyRow, !showDivider && styles.familyRowLast]}
    >
      <View style={styles.familyLeft}>
        <View style={styles.familyIcon}>{icon}</View>
        <Text style={styles.familyText}>{label}</Text>
      </View>
      {avatarIds.length > 0 ? (
        <View style={styles.avatarStack}>
          {avatarIds.slice(0, 3).map((id, idx) => (
            <Image
              key={`${id}-${idx}`}
              source={pickAvatarSource(id)}
              style={[styles.avatar, { left: idx * 24, zIndex: 10 - idx }]}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.emptyConnection}>Not linked</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  container: {
    flex: 1,
  },
  content: {
    ...webShell,
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 34,
  },
  statusPanel: {
    backgroundColor: palette.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.line,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  profileWrap: {
    position: "relative",
  },
  profile: {
    width: 58,
    height: 58,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.line,
  },
  profileLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.card,
    backgroundColor: "rgba(255,255,255,0.68)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    color: palette.primary,
    fontSize: typeScale.caption,
    fontWeight: "900",
  },
  headerTitle: {
    marginTop: 2,
    color: palette.ink,
    fontSize: typeScale.title,
    lineHeight: 31,
    fontWeight: "900",
  },
  signalGrid: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  metricTile: {
    flex: 1,
    minWidth: 0,
    minHeight: 76,
    borderRadius: radius.card,
    backgroundColor: palette.surfaceMuted,
    borderWidth: 1,
    borderColor: palette.line,
    padding: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  metricLabel: {
    color: palette.muted,
    fontSize: typeScale.caption,
    fontWeight: "800",
  },
  metricValue: {
    marginTop: 2,
    color: palette.ink,
    fontSize: typeScale.body,
    fontWeight: "900",
  },
  scoreTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: palette.canvasDeep,
    overflow: "hidden",
  },
  scoreFill: {
    height: "100%",
    borderRadius: radius.pill,
  },
  statusFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.success,
  },
  statusText: {
    flex: 1,
    color: palette.muted,
    fontSize: typeScale.meta,
    fontWeight: "800",
  },
  statusLink: {
    color: palette.primaryDark,
    fontSize: typeScale.meta,
    fontWeight: "900",
  },
  sectionHeader: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: typeScale.section,
    fontWeight: "900",
  },
  sectionMeta: {
    color: palette.muted,
    fontSize: typeScale.meta,
    fontWeight: "800",
  },
  carouselContent: {
    paddingRight: HORIZONTAL_PADDING,
  },
  newsCard: {
    minHeight: 190,
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.lg,
    justifyContent: "space-between",
  },
  newsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: radius.card,
    alignItems: "center",
    justifyContent: "center",
  },
  newsLabel: {
    fontSize: typeScale.caption,
    fontWeight: "900",
  },
  newsTitle: {
    color: palette.ink,
    fontSize: typeScale.section,
    fontWeight: "900",
  },
  newsDesc: {
    marginTop: spacing.xs,
    color: palette.muted,
    fontSize: typeScale.body,
    lineHeight: 23,
    fontWeight: "600",
  },
  newsFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  readMoreText: {
    color: palette.ink,
    fontSize: typeScale.meta,
    fontWeight: "900",
  },
  dots: {
    flexDirection: "row",
    alignSelf: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: palette.line,
  },
  dotActive: {
    width: 22,
    backgroundColor: palette.primary,
  },
  summaryCard: {
    marginTop: spacing.sm,
    backgroundColor: palette.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.line,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    ...pressShadow,
  },
  summaryAccent: {
    width: 5,
    alignSelf: "stretch",
    borderRadius: radius.pill,
  },
  summaryBody: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  cardTitle: {
    color: palette.ink,
    fontSize: typeScale.cardTitle,
    fontWeight: "900",
  },
  cardDesc: {
    color: palette.muted,
    fontSize: typeScale.body,
    lineHeight: 22,
    fontWeight: "600",
  },
  timeRow: {
    alignSelf: "flex-start",
    marginTop: spacing.xs,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    maxWidth: "100%",
  },
  timeText: {
    flexShrink: 1,
    fontSize: typeScale.meta,
    lineHeight: 19,
    fontWeight: "900",
  },
  rightIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.card,
    backgroundColor: palette.surfaceMuted,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: "center",
    justifyContent: "center",
  },
  familyHeaderRow: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  roundAction: {
    width: 40,
    height: 40,
    borderRadius: radius.card,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  familyPanel: {
    backgroundColor: palette.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.line,
    overflow: "hidden",
  },
  familyRow: {
    minHeight: 70,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  familyRowLast: {
    borderBottomWidth: 0,
  },
  familyLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  familyIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.card,
    backgroundColor: palette.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  familyText: {
    flex: 1,
    minWidth: 0,
    color: palette.ink,
    fontSize: typeScale.body,
    fontWeight: "900",
  },
  avatarStack: {
    width: 94,
    height: 36,
    position: "relative",
  },
  avatar: {
    position: "absolute",
    width: 34,
    height: 34,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: palette.surface,
  },
  emptyConnection: {
    color: palette.faint,
    fontSize: typeScale.meta,
    fontWeight: "800",
  },
});
