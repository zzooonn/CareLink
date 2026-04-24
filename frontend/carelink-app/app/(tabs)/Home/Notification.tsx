// app/(tabs)/Home/Notification.tsx
import React, { useCallback, useState } from "react";
import {
  View,
  FlatList,
  Image,
  StyleSheet,
  Pressable,
  Dimensions,
  ImageSourcePropType,
} from "react-native";
import { ScaledText as Text } from "../../../components/ScaledText";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { authFetch } from "../../../utils/api";

/* ??Caregivers? ?숈씪 */
const CAREGIVERS_STORAGE_KEY = "caregivers:list";

/* ??濡쒖뺄 ?꾨컮? (1~12) */
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

function pickAvatarSource(id?: number) {
  const safeId = id && id >= 1 && id <= 12 ? id : 1;
  return AVATAR_LIST.find((a) => a.id === safeId)?.source ?? AVATAR_LIST[0].source;
}

/* ???ш린??fallback??濡쒖뺄濡?(臾댁“嫄?蹂댁씠寃? */
const DEFAULT_AVATAR_SOURCE = pickAvatarSource(1);

/* ??Caregivers ???援ъ“ */
type Caregiver = {
  id: string;      // 濡쒖뺄 row id
  userId: string;
  name: string;
  phone: string;
  avatarId: number; // 1~12
};

export type NotificationItem = {
  id: string;
  actorUserId?: string; // ????媛믪쑝濡?caregivers? 留ㅼ묶
  message: string;
  createdAt: string | number | Date;
  read?: boolean;
  avatar?: string;
};

type Props = {
  data?: NotificationItem[];
  onPressItem?: (item: NotificationItem) => void;
};

/* ---------- Responsive Tokens ---------- */
const { width: W, height: H } = Dimensions.get("window");

const HP = W * 0.05;
const BORDER = Math.max(1, W * 0.0025);

const FS_HEADER = Math.max(18, W * 0.055);
const FS_MSG = Math.max(13, W * 0.04);
const FS_TIME = Math.max(11, W * 0.032);
const FS_EMPTY = Math.max(12, W * 0.036);

const LH_MSG = Math.round(FS_MSG * 1.35);

const AV = Math.max(40, W * 0.12);
const AV_R = Math.max(10, W * 0.03);
const GAP_ROW = Math.max(10, W * 0.03);

const PAD_TOP = H * 0.01;
const PAD_HEADER_BOTTOM = H * 0.015;

const LIST_PT = H * 0.012;
const LIST_PB = H * 0.035;

const DIV_MT = H * 0.015;
const DIV_MB = H * 0.02;

function formatRelativeTime(dateLike: string | number | Date) {
  const d = new Date(dateLike);
  const diff = Date.now() - d.getTime();
  const sec = Math.max(1, Math.floor(diff / 1000));
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  if (sec < 60) return `${sec} seconds ago`;
  if (min < 60) return `${min} minutes ago`;
  if (hr < 24) return `${hr} hours ago`;
  if (day < 7) return `${day} days ago`;
  return d.toLocaleDateString();
}

/** ??item + map?쇰줈 理쒖쥌 source 寃곗젙 */
function resolveAvatarSource(
  item: NotificationItem,
  avatarIdByUserId: Record<string, number>
): ImageSourcePropType {
  // 1) actorUserId濡?caregivers avatarId 留ㅼ묶?섎㈃ 濡쒖뺄 ?ъ슜
  if (item.actorUserId) {
    const avatarId = avatarIdByUserId[item.actorUserId];
    if (typeof avatarId === "number") return pickAvatarSource(avatarId);
  }

  // 2) (?명솚) item.avatar url ?덉쑝硫??ъ슜
  if (item.avatar) return { uri: item.avatar };

  // 3) 臾댁“嫄?蹂댁씠寃?濡쒖뺄 fallback
  return DEFAULT_AVATAR_SOURCE;
}

const NotificationRow = ({
  item,
  onPress,
  avatarSource,
}: {
  item: NotificationItem;
  onPress?: (item: NotificationItem) => void;
  avatarSource: ImageSourcePropType;
}) => {
  return (
    <Pressable
      onPress={() => onPress?.(item)}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
      accessibilityRole="button"
      accessibilityLabel={item.message}
    >
      <Image
        source={avatarSource}
        style={styles.avatar}
        resizeMode="cover"
        onError={(e) => {
          // ?붾쾭源낆슜: ?ш린 李랁엳硫?source媛 臾몄젣嫄곕굹 ?뚯씪 寃쎈줈/踰덈뱾 臾몄젣?????덉뼱??          console.log("Avatar load error:", e.nativeEvent);
        }}
      />
      <View style={styles.textWrap}>
        <Text style={[styles.message, !item.read && styles.unread]} numberOfLines={2}>
          {item.message}
        </Text>
        <Text style={styles.time}>{formatRelativeTime(item.createdAt)}</Text>
        <View style={styles.divider} />
      </View>
    </Pressable>
  );
};

export default function NotificationScreen({ data, onPressItem }: Props) {
  const [avatarIdByUserId, setAvatarIdByUserId] = useState<Record<string, number>>({});
  const [alerts, setAlerts] = useState<NotificationItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        // Load avatar map from caregivers
        try {
          const raw = await AsyncStorage.getItem(CAREGIVERS_STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw) as Caregiver[];
            if (Array.isArray(parsed)) {
              const map: Record<string, number> = {};
              for (const c of parsed) {
                if (c?.userId && typeof c.avatarId === "number") {
                  map[c.userId] = c.avatarId;
                }
              }
              setAvatarIdByUserId(map);
            }
          }
        } catch (e) {
          console.log("Failed to load caregivers for avatar map:", e);
        }

        // Load real alerts from backend
        try {
          const userId = await AsyncStorage.getItem("userId");
          if (!userId) return;
          const res = await authFetch(`/api/notification/${userId}`);
          if (res.ok) {
            const json = await res.json();
            const items: NotificationItem[] = json.map((a: any) => ({
              id: String(a.id),
              actorUserId: a.patientUserId,
              message: a.message,
              createdAt: a.createdAt,
              read: a.read,
            }));
            setAlerts(items);
          }
        } catch (e) {
          console.log("Failed to load notifications:", e);
        }
      };

      load();
    }, [])
  );

  const handlePressItem = useCallback(async (item: NotificationItem) => {
    onPressItem?.(item);
    if (!item.read) {
      try {
        const userId = await AsyncStorage.getItem("userId");
        if (!userId) return;
        await authFetch(`/api/notification/${userId}/${item.id}/read`, { method: "PATCH" });
        setAlerts((prev) =>
          prev.map((a) => (a.id === item.id ? { ...a, read: true } : a))
        );
      } catch (e) {
        console.log("Failed to mark notification as read:", e);
      }
    }
  }, [onPressItem]);

  const list = data && data.length > 0 ? data : alerts;

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <View style={styles.headerWrap}>
        <Text style={styles.header}>Notification</Text>
      </View>

      <FlatList
        data={list}
        extraData={avatarIdByUserId}  // ???닿굅 瑗? (留ㅽ븨 諛붾뚮㈃ row ?ㅼ떆 洹몃┝)
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotificationRow
            item={item}
            onPress={handlePressItem}
            avatarSource={resolveAvatarSource(item, avatarIdByUserId)}
          />
        )}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="never"
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No notifications yet.</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#ffffff" },

  headerWrap: {
    paddingHorizontal: HP,
    paddingTop: PAD_TOP,
    paddingBottom: PAD_HEADER_BOTTOM,
    borderBottomWidth: BORDER,
    borderBottomColor: "#F8FBF9",
  },
  header: {
    fontSize: FS_HEADER,
    fontWeight: "800",
    color: "#13201C",
    textAlign: "center",
  },

  content: {
    paddingHorizontal: HP,
    paddingTop: LIST_PT,
    paddingBottom: LIST_PB,
  },

  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: GAP_ROW,
  },

  avatar: {
    width: AV,
    height: AV,
    borderRadius: AV / 2,
    backgroundColor: "#DBE7E1",
  },

  textWrap: {
    flex: 1,
    minHeight: AV,
  },

  message: {
    fontSize: FS_MSG,
    color: "#13201C",
    lineHeight: LH_MSG,
  },
  unread: { fontWeight: "700" },

  time: {
    marginTop: H * 0.006,
    fontSize: FS_TIME,
    color: "#6B7280",
  },

  divider: {
    height: BORDER,
    backgroundColor: "#E5E7EB",
    marginTop: DIV_MT,
    marginBottom: DIV_MB,
  },

  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: H * 0.06,
  },
  emptyText: {
    fontSize: FS_EMPTY,
    color: "#6B7280",
    fontWeight: "600",
  },
});