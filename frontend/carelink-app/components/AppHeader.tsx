// app/components/AppHeader.tsx
import React from "react";
import { View, Image, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import { ScaledText as Text } from "./ScaledText";
import { useRouter } from "expo-router";
// ✅ 안전 영역 확보를 위해 SafeAreaView를 가져옵니다.
import { SafeAreaView } from "react-native-safe-area-context";

const { width, height } = Dimensions.get("window");

const LOGO_SIZE = width * 0.06;
const TITLE_FONT = width * 0.055;
const PADDING_H = width * 0.04;
const GAP = width * 0.02;

export default function AppHeader() {
  const router = useRouter();

  return (
    // ✅ 기존 View를 SafeAreaView로 감싸고 edges 속성을 추가합니다.
    // edges={["top"]}는 상단만 안전 영역을 계산하겠다는 뜻입니다.
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <View style={styles.wrap}>
        <TouchableOpacity style={styles.left} onPress={() => router.replace("/(tabs)/Home/HomePage")}>
          <Image
            source={require("../assets/images/CareLinkicon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>CareLink</Text>
        </TouchableOpacity>

        <View style={{ width: LOGO_SIZE }} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ✅ SafeAreaView를 위한 스타일 추가
  safeArea: {
    backgroundColor: "#ffffff", // 헤더 배경색과 맞춰주세요.
  },
  wrap: {
    // 💡 HEADER_HEIGHT를 고정값으로 주면 SafeAreaView 안에서 답답해 보일 수 있으므로
    // paddingVertical이나 적절한 height를 설정하세요.
    height: height * 0.07, 
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: PADDING_H,
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