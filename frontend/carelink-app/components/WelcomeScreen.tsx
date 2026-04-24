import React, { useEffect, useState } from "react";
import { Image, StyleSheet, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScaledText as Text } from "./ScaledText";
import { palette, pressShadow, radius, shadow, spacing, typeScale, webShell } from "../constants/design";

export default function WelcomeScreen() {
  const router = useRouter();
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem("userId"),
      AsyncStorage.getItem("token"),
    ]).then(([userId, token]) => {
      setHasSession(!!(userId && token));
    });
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.shell}>
        <View style={styles.heroPanel}>
          <View style={styles.visualRail}>
            <Image
              source={require("../assets/images/HomeScreen.png")}
              style={styles.image}
              resizeMode="contain"
            />
          </View>

          <View style={styles.copy}>
            <Text style={styles.kicker}>CARELINK</Text>
            <Text style={styles.title}>Family health command center</Text>
            <Text style={styles.subtitle}>
              Daily vitals, medication, ECG, and caregiver signals in one calm view.
            </Text>
          </View>

          <View style={styles.actionStack}>
            {hasSession && (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => router.push("/(tabs)/Home/HomePage")}
                activeOpacity={0.85}
              >
                <Ionicons name="grid-outline" size={20} color={palette.surface} />
                <Text style={styles.primaryButtonText}>Continue</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={hasSession ? styles.secondaryButton : styles.primaryButton}
              onPress={() => router.push("/(tabs)/auth/login")}
              activeOpacity={0.85}
            >
              <Ionicons
                name="log-in-outline"
                size={20}
                color={hasSession ? palette.primary : palette.surface}
              />
              <Text style={hasSession ? styles.secondaryButtonText : styles.primaryButtonText}>Login</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.push("/(tabs)/auth/data-agreement")}
              activeOpacity={0.85}
            >
              <Ionicons name="person-add-outline" size={20} color={palette.primary} />
              <Text style={styles.secondaryButtonText}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  shell: {
    ...webShell,
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xl,
    justifyContent: "center",
  },
  heroPanel: {
    backgroundColor: palette.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.line,
    padding: spacing.lg,
    gap: spacing.lg,
    ...shadow,
  },
  visualRail: {
    minHeight: 220,
    borderRadius: radius.card,
    backgroundColor: palette.canvasDeep,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  image: {
    width: "88%",
    height: 210,
  },
  copy: {
    gap: spacing.sm,
  },
  kicker: {
    color: palette.primary,
    fontSize: typeScale.caption,
    fontWeight: "900",
  },
  title: {
    color: palette.ink,
    fontSize: typeScale.hero,
    lineHeight: 39,
    fontWeight: "900",
  },
  subtitle: {
    color: palette.muted,
    fontSize: typeScale.body,
    lineHeight: 23,
    fontWeight: "600",
  },
  actionStack: {
    gap: spacing.sm,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: radius.card,
    backgroundColor: palette.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    ...pressShadow,
  },
  primaryButtonText: {
    color: palette.surface,
    fontSize: typeScale.body,
    fontWeight: "900",
  },
  secondaryButton: {
    minHeight: 54,
    borderRadius: radius.card,
    backgroundColor: palette.primarySoft,
    borderWidth: 1,
    borderColor: palette.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  secondaryButtonText: {
    color: palette.primaryDark,
    fontSize: typeScale.body,
    fontWeight: "900",
  },
});
