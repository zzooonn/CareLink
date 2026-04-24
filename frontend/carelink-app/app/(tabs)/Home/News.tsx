// app/(tabs)/Home/News.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScaledText as Text } from "../../../components/ScaledText";
import { authFetch } from "../../../utils/api";
import {
  palette,
  pressShadow,
  radius,
  shadow,
  spacing,
  typeScale,
  webShell,
} from "../../../constants/design";

type NewsItem = {
  id: number;
  diseaseName: string;
  title: string;
  url: string;
};

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
const TIMEOUT_MS = 8000;

export default function NewsScreen() {
  const [searchText, setSearchText] = useState("");
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);

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
      (item) =>
        (item.title || "").toLowerCase().includes(q) ||
        (item.diseaseName || "").toLowerCase().includes(q)
    );
  }, [news, searchText]);

  const openLink = async (url?: string) => {
    if (!url) return;
    try {
      const can = await Linking.canOpenURL(url);
      if (can) await Linking.openURL(url);
    } catch {
      Alert.alert("Error", "Could not open link.");
    }
  };

  const emptyTitle = fetchError
    ? "Unable to load trends"
    : news.length === 0
      ? "No trend updates yet"
      : "No matching results";

  const emptyBody = fetchError
    ? "Pull down to retry the latest disease news."
    : news.length === 0
      ? "New personalized articles will appear here after the server prepares them."
      : "Try a broader disease name or keyword.";

  const renderItem = ({ item }: { item: NewsItem }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.badgeRow}>
          <View style={styles.dot} />
          <Text style={styles.badgeText} numberOfLines={1}>
            {item.diseaseName || "Health"}
          </Text>
        </View>
        <Text style={styles.metaText}>Personalized</Text>
      </View>

      <Text style={styles.cardTitle} numberOfLines={3}>
        {item.title}
      </Text>

      <TouchableOpacity
        style={styles.learnMoreBtn}
        activeOpacity={0.85}
        onPress={() => openLink(item.url)}
      >
        <Text style={styles.learnMoreText}>Read More</Text>
        <Ionicons name="arrow-forward" size={17} color={palette.primaryDark} />
      </TouchableOpacity>
    </View>
  );

  const renderEmpty = () => {
    if (loading) return null;

    return (
      <View style={styles.emptyBox}>
        <View style={styles.emptyIcon}>
          <Ionicons
            name={fetchError ? "cloud-offline-outline" : "newspaper-outline"}
            size={24}
            color={fetchError ? palette.rescue : palette.primary}
          />
        </View>
        <Text style={styles.emptyTitle}>{emptyTitle}</Text>
        <Text style={styles.emptyText}>{emptyBody}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <View style={styles.body}>
        <View style={styles.header}>
          <Text style={styles.title}>Disease Trends</Text>
          <Text style={styles.subtitle}>Latest personalized health news</Text>
        </View>

        <View style={styles.searchShell}>
          <Ionicons name="search" size={19} color={palette.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by disease or keyword"
            placeholderTextColor={palette.faint}
            value={searchText}
            onChangeText={setSearchText}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <FlatList
          data={loading || fetchError ? [] : filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListHeaderComponent={
            loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={palette.primary} />
                <Text style={styles.loadingText}>Loading trends</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={palette.primary}
            />
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  body: {
    ...webShell,
    flex: 1,
    width: "100%",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  header: {
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  title: {
    color: palette.ink,
    fontSize: typeScale.title,
    fontWeight: "900",
  },
  subtitle: {
    color: palette.muted,
    fontSize: typeScale.meta,
    fontWeight: "700",
  },
  searchShell: {
    minHeight: 54,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    ...shadow,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: palette.ink,
    fontSize: typeScale.body,
    fontWeight: "700",
    paddingVertical: 0,
  },
  listContent: {
    flexGrow: 1,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  separator: {
    height: spacing.md,
  },
  card: {
    minHeight: 152,
    borderRadius: radius.card,
    padding: spacing.lg,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    justifyContent: "space-between",
    ...shadow,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  badgeRow: {
    flex: 1,
    minWidth: 0,
    maxWidth: "72%",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: palette.primarySoft,
    borderWidth: 1,
    borderColor: palette.line,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: palette.primary,
  },
  badgeText: {
    flex: 1,
    minWidth: 0,
    color: palette.primaryDark,
    fontSize: typeScale.caption,
    fontWeight: "900",
  },
  metaText: {
    color: palette.muted,
    fontSize: typeScale.caption,
    fontWeight: "800",
  },
  cardTitle: {
    marginTop: spacing.md,
    color: palette.ink,
    fontSize: typeScale.cardTitle,
    lineHeight: 25,
    fontWeight: "900",
  },
  learnMoreBtn: {
    marginTop: spacing.md,
    minHeight: 42,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    borderRadius: radius.card,
    backgroundColor: palette.primarySoft,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    ...pressShadow,
  },
  learnMoreText: {
    fontSize: typeScale.meta,
    fontWeight: "900",
    color: palette.primaryDark,
  },
  loadingBox: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  loadingText: {
    color: palette.muted,
    fontSize: typeScale.meta,
    fontWeight: "800",
  },
  emptyBox: {
    minHeight: 250,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    ...shadow,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: palette.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: typeScale.cardTitle,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyText: {
    marginTop: spacing.xs,
    color: palette.muted,
    fontSize: typeScale.meta,
    lineHeight: 20,
    fontWeight: "700",
    textAlign: "center",
  },
});
