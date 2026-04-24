// app/(tabs)/Home/News.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  FlatList,
  useWindowDimensions,
  Platform,
} from "react-native";
import { ScaledText as Text } from "../../../components/ScaledText";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authFetch } from "../../../utils/api";

type NewsItem = {
  id: number;
  diseaseName: string;
  title: string;
  url: string;
};

// Placeholder type
type NewsRow = NewsItem & { __placeholder?: boolean };

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
const TIMEOUT_MS = 8000;


export default function NewsScreen() {
  const [searchText, setSearchText] = useState("");
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  const { height: H } = useWindowDimensions();

  // ---- ?믪씠 怨꾩궛 ?섏젙: 5媛?-> 4媛쒕줈 以꾩뿬??移대뱶 ?ш린 ?뺣? ----
  const LIST_TOP_PADDING = 16;
  const LIST_BOTTOM_PADDING = 24;
  const SEARCH_AREA_HEIGHT = 50 + 20; // input(50) + marginBottom(20)
  const SAFE_EXTRA = Platform.OS === "ios" ? 8 : 12;

  const LIST_AVAILABLE_HEIGHT =
    H - (LIST_TOP_PADDING + LIST_BOTTOM_PADDING + SEARCH_AREA_HEIGHT + SAFE_EXTRA);

  const GAP = 16; // 媛꾧꺽???댁쭩 ?섎┝
  // ?ш린??/ 5 ???/ 4濡?蹂寃쏀븯??移대뱶 ?믪씠瑜??ㅼ?
  const VISIBLE_ITEMS = 4; 
  const CARD_HEIGHT = Math.max(150, Math.floor((LIST_AVAILABLE_HEIGHT - GAP * (VISIBLE_ITEMS - 1)) / VISIBLE_ITEMS));

  const fetchNews = useCallback(async () => {
    if (!API_BASE_URL) return;

    const storedUserId = await AsyncStorage.getItem("userId");
    if (!storedUserId) {
      setNews([]);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      setLoading(true);
      setFetchError(false);

      const latestPath = `/api/news?userId=${encodeURIComponent(storedUserId)}&limit=5`;

      const refreshRes = await authFetch(
        `/api/news/refresh?userId=${encodeURIComponent(storedUserId)}`,
        { method: "POST", signal: controller.signal } as RequestInit
      );

      const refreshText = await refreshRes.text().catch(() => "");
      console.log("[news refresh]", refreshRes.status, refreshText);

      if (!refreshRes.ok) {
        setNews([]);
        setFetchError(true);
        return;
      }

      const res = await authFetch(latestPath, {
        method: "GET",
        signal: controller.signal,
      } as RequestInit);

      clearTimeout(timeoutId);

      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        console.log("[news latest failed]", res.status, msg);
        setNews([]);
        setFetchError(true);
        return;
      }

      const data = await res.json();
      setNews(Array.isArray(data) ? data : []);
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.log("[news fetch error]", err?.name, err?.message);
      if (err?.name !== "AbortError") setFetchError(true);
      setNews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await fetchNews();
    } finally {
      setRefreshing(false);
    }
  }, [fetchNews]);

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return news;
    return news.filter(
      (n) =>
        (n.title || "").toLowerCase().includes(q) ||
        (n.diseaseName || "").toLowerCase().includes(q)
    );
  }, [news, searchText]);

  const listData: NewsRow[] = useMemo(() => {
    const base: NewsRow[] = filtered.map((x) => ({ ...x, __placeholder: false }));
    // 理쒖냼 4媛쒕뒗 梨꾩썙吏?꾨줉 ?ㅼ젙 (?붾㈃ 苑?李④쾶)
    const need = Math.max(0, VISIBLE_ITEMS - base.length);
    for (let i = 0; i < need; i++) {
      base.push({
        id: -1000 - i,
        diseaseName: "",
        title: "",
        url: "",
        __placeholder: true,
      });
    }
    return base;
  }, [filtered]);

  const openLink = async (url?: string) => {
    if (!url) return;
    try {
      const can = await Linking.canOpenURL(url);
      if (can) await Linking.openURL(url);
    } catch {
      Alert.alert("Error", "Could not open link.");
    }
  };

  const renderItem = ({ item }: { item: NewsRow }) => {
    if (item.__placeholder) {
      return <View style={[styles.card, styles.cardPlaceholder, { height: CARD_HEIGHT }]} />;
    }

    return (
      <View style={[styles.card, { height: CARD_HEIGHT }]}>
        <View style={styles.cardHeader}>
          <View style={styles.badgeRow}>
            <View style={styles.dot} />
            <Text style={styles.badgeText}>{item.diseaseName}</Text>
          </View>

          <Text style={styles.metaText}>Personalized Health News</Text>
        </View>

        <Text style={styles.cardTitle} numberOfLines={3}>
          {item.title}
        </Text>

        <TouchableOpacity
          style={styles.learnMoreBtn}
          activeOpacity={0.7}
          onPress={() => openLink(item.url)}
        >
          <Text style={styles.learnMoreText}>Read More</Text>
          <Text style={styles.chevron}>{">"}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <View style={styles.whiteBody}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by disease or keyword"
            placeholderTextColor="#9CA3AF"
            value={searchText}
            onChangeText={setSearchText}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {loading && (
          <View style={{ paddingTop: 12 }}>
            <ActivityIndicator size="large" color="#0F766E" />
          </View>
        )}

        {!loading && fetchError && (
          <View style={styles.emptyBox}>
            <Text style={[styles.emptyText, { color: "#ef4444" }]}>
              Failed to load news. Pull down to retry.
            </Text>
          </View>
        )}

        {!loading && !fetchError && news.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              No news available yet.
            </Text>
          </View>
        )}

        {!loading && news.length > 0 && filtered.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No results found.</Text>
          </View>
        )}

        <FlatList
          data={listData}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 24,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0F766E" />}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // 諛곌꼍???곗깋?쇰줈 蹂寃?
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  whiteBody: { flex: 1, backgroundColor: "#FFFFFF" },

  searchContainer: { paddingHorizontal: 16, marginBottom: 20 },
  searchInput: {
    backgroundColor: "#F3F4F6", // 諛앹? ?뚯깋 諛곌꼍
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#13201C", // 寃??湲??
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  card: {
    borderRadius: 20, // ?κ?湲??쎄컙 ??
    padding: 18,
    backgroundColor: "#FFFFFF", // 移대뱶 諛곌꼍 ?곗깋
    borderWidth: 1,
    borderColor: "#E5E7EB", // ?고븳 ?뚯깋 ?뚮몢由?

    // 洹몃┝??(??諛곌꼍??留욊쾶 議곗젙)
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,

    justifyContent: "space-between",
    overflow: "hidden",
  },

  cardPlaceholder: {
    opacity: 0.5,
    backgroundColor: "#F9FAFB",
    borderColor: "#F3F4F6",
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#F4FAF6", // ?꾩＜ ?고븳 ?뚮옉
    borderWidth: 1,
    borderColor: "#D9F2EC",
  },

  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#0F766E", // ?뚮?????
  },

  badgeText: {
    color: "#115E59", // 吏숈? ?뚮? 湲??
    fontSize: 12,
    fontWeight: "700",
  },

  metaText: {
    color: "#6B7280", // ?뚯깋 ?띿뒪??
    fontSize: 11,
    fontWeight: "600",
  },

  cardTitle: {
    marginTop: 8,
    fontSize: 18, // ?고듃 ?ъ씠利??ㅼ?
    fontWeight: "800",
    color: "#13201C", // 吏꾪븳 寃??
    lineHeight: 26,
  },

  learnMoreBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#F3F4F6", // 踰꾪듉 諛곌꼍 諛앹? ?뚯깋
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  learnMoreText: { 
    fontSize: 14, 
    fontWeight: "700", 
    color: "#1F2937" // 踰꾪듉 湲??寃??吏꾪쉶??
  },
  
  chevron: { 
    fontSize: 18, 
    fontWeight: "800", 
    color: "#1F2937", 
    marginTop: -2 
  },

  emptyBox: { paddingHorizontal: 16, paddingTop: 16 },
  emptyText: { color: "#6B7280", textAlign: 'center' },
});
