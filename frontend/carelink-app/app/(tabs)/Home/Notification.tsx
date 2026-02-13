// app/(tabs)/Home/Notification.tsx
import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  Pressable,
  Dimensions,
  ImageSourcePropType,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";

/* ✅ Caregivers와 동일 */
const CAREGIVERS_STORAGE_KEY = "caregivers:list";

/* ✅ 로컬 아바타 (1~12) */
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

/* ✅ 여기서 fallback도 로컬로 (무조건 보이게) */
const DEFAULT_AVATAR_SOURCE = pickAvatarSource(1);

/* ✅ Caregivers 저장 구조 */
type Caregiver = {
  id: string;      // 로컬 row id
  userId: string;  // 연동 키
  name: string;
  phone: string;
  avatarId: number; // 1~12
};

export type NotificationItem = {
  id: string;
  actorUserId?: string; // ✅ 이 값으로 caregivers와 매칭
  message: string;
  createdAt: string | number | Date;
  read?: boolean;

  // (선택) 예전 방식 호환이 필요하면 남겨도 됨
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

/** ✅ item + map으로 최종 source 결정 */
function resolveAvatarSource(
  item: NotificationItem,
  avatarIdByUserId: Record<string, number>
): ImageSourcePropType {
  // 1) actorUserId로 caregivers avatarId 매칭되면 로컬 사용
  if (item.actorUserId) {
    const avatarId = avatarIdByUserId[item.actorUserId];
    if (typeof avatarId === "number") return pickAvatarSource(avatarId);
  }

  // 2) (호환) item.avatar url 있으면 사용
  if (item.avatar) return { uri: item.avatar };

  // 3) 무조건 보이게 로컬 fallback
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
          // 디버깅용: 여기 찍히면 source가 문제거나 파일 경로/번들 문제일 수 있어요
          console.log("Avatar load error:", e.nativeEvent);
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

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        try {
          const raw = await AsyncStorage.getItem(CAREGIVERS_STORAGE_KEY);

          // ✅ caregivers:list가 없으면 빈맵 (fallback은 로컬이라 이미지 보임)
          if (!raw) {
            setAvatarIdByUserId({});
            return;
          }

          const parsed = JSON.parse(raw) as Caregiver[];
          if (!Array.isArray(parsed)) {
            setAvatarIdByUserId({});
            return;
          }

          const map: Record<string, number> = {};
          for (const c of parsed) {
            if (c?.userId && typeof c.avatarId === "number") {
              map[c.userId] = c.avatarId;
            }
          }
          setAvatarIdByUserId(map);
        } catch (e) {
          console.log("Failed to load caregivers for avatar map:", e);
          setAvatarIdByUserId({});
        }
      };

      load();
    }, [])
  );

  // 데모 fallback: actorUserId가 caregivers에 존재하면 그 avatarId로 뜸
  const fallback = useMemo<NotificationItem[]>(
    () => [
      {
        id: "1",
        actorUserId: "guardian010",
        message: "guardian010 recorded a blood pressure measurement.",
        createdAt: Date.now() - 5 * 60 * 1000,
        read: false,
      },
      {
        id: "2",
        actorUserId: "patient001",
        message: "patient001 updated ECG data.",
        createdAt: Date.now() - 60 * 60 * 1000,
        read: true,
      },
    ],
    []
  );

  const list = data && data.length > 0 ? data : fallback;

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <View style={styles.headerWrap}>
        <Text style={styles.header}>Notification</Text>
      </View>

      <FlatList
        data={list}
        extraData={avatarIdByUserId}  // ✅ 이거 꼭! (매핑 바뀌면 row 다시 그림)
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotificationRow
            item={item}
            onPress={onPressItem}
            avatarSource={resolveAvatarSource(item, avatarIdByUserId)}
          />
        )}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="never"
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>표시할 알림이 없습니다</Text>
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
    borderBottomColor: "#f1f5f9",
  },
  header: {
    fontSize: FS_HEADER,
    fontWeight: "800",
    color: "#111827",
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
    backgroundColor: "#e5e7eb",
  },

  textWrap: {
    flex: 1,
    minHeight: AV,
  },

  message: {
    fontSize: FS_MSG,
    color: "#111827",
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
