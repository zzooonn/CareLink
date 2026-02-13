// app/components/AppHeader.tsx
import React from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity, Platform, Dimensions } from "react-native";
import { useRouter } from "expo-router";

const { width, height } = Dimensions.get("window");

// 반응형 비율 설정
const HEADER_HEIGHT = height * 0.07;           // 화면 높이의 7%
const LOGO_SIZE = width * 0.06;                // 화면 폭의 6%
const TITLE_FONT = width * 0.055;              // 화면 폭의 5.5%
const PADDING_H = width * 0.04;                // 양쪽 padding 비율
const GAP = width * 0.02;

export default function AppHeader() {
  const router = useRouter();

  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.left} onPress={() => router.push("/(tabs)/Home/HomePage")}>
        <Image
          source={require("../assets/images/CareLinkicon.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>CareLink</Text>
      </TouchableOpacity>

      {/* 오른쪽 공간 (알림/설정 아이콘 자리 등) */}
      <View style={{ width: LOGO_SIZE }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: HEADER_HEIGHT,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: PADDING_H,

    borderBottomWidth: 0,
    ...Platform.select({
      ios: { shadowOpacity: 0, shadowOffset: { width: 0, height: 0 }, shadowRadius: 0 },
      android: { elevation: 0 },
    }),

    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },

  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: GAP,
  },

  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },

  title: {
    fontSize: TITLE_FONT,
    fontWeight: "800",
    color: "#111827",
  },
});
