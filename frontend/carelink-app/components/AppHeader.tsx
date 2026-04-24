import React from "react";
import { Image, StyleSheet, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScaledText as Text } from "./ScaledText";
import { palette, radius, shadow, spacing, typeScale, webShell } from "../constants/design";

export default function AppHeader() {
  const router = useRouter();

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <View style={styles.shell}>
        <TouchableOpacity
          style={styles.brand}
          onPress={() => router.replace("/(tabs)/Home/HomePage")}
          activeOpacity={0.84}
        >
          <View style={styles.logoMark}>
            <Image
              source={require("../assets/images/CareLinkicon.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <View style={styles.brandCopy}>
            <Text style={styles.kicker} numberOfLines={1}>CARELINK</Text>
            <Text style={styles.title} numberOfLines={1}>Care Operations</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => router.push("/(tabs)/Home/Notification")}
          activeOpacity={0.82}
        >
          <Ionicons name="notifications-outline" size={20} color={palette.ink} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: palette.canvas,
  },
  shell: {
    ...webShell,
    minHeight: 76,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: palette.canvas,
  },
  brand: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  logoMark: {
    width: 44,
    height: 44,
    borderRadius: radius.card,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: "center",
    justifyContent: "center",
    ...shadow,
  },
  logo: {
    width: 28,
    height: 28,
    tintColor: palette.primary,
  },
  brandCopy: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    color: palette.primary,
    fontSize: typeScale.caption,
    fontWeight: "900",
  },
  title: {
    marginTop: 1,
    color: palette.ink,
    fontSize: typeScale.cardTitle,
    fontWeight: "800",
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: radius.card,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: "center",
    justifyContent: "center",
  },
});
