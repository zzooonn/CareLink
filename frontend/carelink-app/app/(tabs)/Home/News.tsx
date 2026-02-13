// app/(tabs)/Home/News.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
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
import { SafeAreaView } from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

  const { height: H } = useWindowDimensions();

  // ---- 높이 계산 수정: 5개 -> 4개로 줄여서 카드 크기 확대 ----
  const LIST_TOP_PADDING = 16;
  const LIST_BOTTOM_PADDING = 24;
  const SEARCH_AREA_HEIGHT = 50 + 20; // input(50) + marginBottom(20)
  const SAFE_EXTRA = Platform.OS === "ios" ? 8 : 12;

  const LIST_AVAILABLE_HEIGHT =
    H - (LIST_TOP_PADDING + LIST_BOTTOM_PADDING + SEARCH_AREA_HEIGHT + SAFE_EXTRA);

  const GAP = 16; // 간격도 살짝 늘림
  // 여기서 / 5 대신 / 4로 변경하여 카드 높이를 키움
  const VISIBLE_ITEMS = 4; 
  const CARD_HEIGHT = Math.max(150, Math.floor((LIST_AVAILABLE_HEIGHT - GAP * (VISIBLE_ITEMS - 1)) / VISIBLE_ITEMS));

  const fetchWithTimeout = async (url: string, options: any = {}, timeout = TIMEOUT_MS) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return res;
    } catch (e: any) {
      clearTimeout(id);
      if (e?.name === "AbortError") throw new Error("timeout");
      throw e;
    }
  };

  const fetchNews = useCallback(async () => {
    if (!API_BASE_URL) return;

    const storedUserId = await AsyncStorage.getItem("userId");
    if (!storedUserId) {
      setNews([]);
      return;
    }

    try {
      setLoading(true);

      const url =
        `${API_BASE_URL}/api/news` +
        `?userId=${encodeURIComponent(storedUserId)}` +
        `&limit=5`; // 데이터는 여전히 5개 가져옴 (스크롤 가능하게)

      const res = await fetchWithTimeout(url, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        setNews([]);
        return;
      }

      const data = await res.json();
      setNews(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.log("News error:", err);
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
    // 최소 4개는 채워지도록 설정 (화면 꽉 차게)
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
          <Text style={styles.chevron}>›</Text>
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
            <ActivityIndicator size="large" color="#2563EB" />
          </View>
        )}

        {!loading && news.length === 0 && (
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // 배경을 흰색으로 변경
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  whiteBody: { flex: 1, backgroundColor: "#FFFFFF" },

  searchContainer: { paddingHorizontal: 16, marginBottom: 20 },
  searchInput: {
    backgroundColor: "#F3F4F6", // 밝은 회색 배경
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#111827", // 검정 글씨
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  card: {
    borderRadius: 20, // 둥글기 약간 더
    padding: 18,
    backgroundColor: "#FFFFFF", // 카드 배경 흰색
    borderWidth: 1,
    borderColor: "#E5E7EB", // 연한 회색 테두리

    // 그림자 (흰 배경에 맞게 조정)
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
    backgroundColor: "#EFF6FF", // 아주 연한 파랑
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },

  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#3B82F6", // 파란색 점
  },

  badgeText: {
    color: "#1E40AF", // 짙은 파란 글씨
    fontSize: 12,
    fontWeight: "700",
  },

  metaText: {
    color: "#6B7280", // 회색 텍스트
    fontSize: 11,
    fontWeight: "600",
  },

  cardTitle: {
    marginTop: 8,
    fontSize: 18, // 폰트 사이즈 키움
    fontWeight: "800",
    color: "#111827", // 진한 검정
    lineHeight: 26,
  },

  learnMoreBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#F3F4F6", // 버튼 배경 밝은 회색
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  learnMoreText: { 
    fontSize: 14, 
    fontWeight: "700", 
    color: "#1F2937" // 버튼 글씨 검정(진회색)
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