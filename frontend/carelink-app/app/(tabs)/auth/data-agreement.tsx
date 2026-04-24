import React, { useMemo, useState } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  useWindowDimensions,
  Platform,
} from "react-native";
import { ScaledText as Text } from "../../../components/ScaledText";
import { useRouter } from "expo-router";

const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v));

type Scale = {
  hPadding: number;
  vPadding: number;
  brandSize: number;
  titleSize: number;
  bodySize: number;
  buttonSize: number;
  logoW: number;
  logoH: number;
  infoPadding: number;
  gapSm: number;
  gapMd: number;
  gapLg: number;
  lineHeight: number;
  contentMaxWidth: number;
  checkboxSize: number;
  radius: number;
  btnVPad: number;
};

export default function DataAgreement() {
  const router = useRouter();
  const [isChecked, setIsChecked] = useState(false);
  const { width, height } = useWindowDimensions();

  // ??0/undefined 諛⑹뼱(?뱀젙 ?섍꼍?먯꽌 width/height媛 ?쒓컙 0?????덉뼱??
  const safeWidth = width || 360;
  const safeHeight = height || 640;

  const s: Scale = useMemo(() => {
    const base = Math.min(safeWidth, safeHeight);

    const hPadding = clamp(safeWidth * 0.06, 16, 28);
    const vPadding = clamp(safeHeight * 0.05, 18, 40);

    const brandSize = clamp(base * 0.06, 18, 28);
    const titleSize = clamp(base * 0.055, 16, 26);
    const bodySize = clamp(base * 0.04, 13, 18);
    const buttonSize = clamp(base * 0.045, 14, 20);

    const logoW = clamp(safeWidth * 0.08, 28, 44);
    const logoH = clamp(safeHeight * 0.04, 24, 40);

    const infoPadding = clamp(safeWidth * 0.07, 14, 22);
    const gapSm = clamp(safeHeight * 0.015, 8, 14);
    const gapMd = clamp(safeHeight * 0.03, 12, 22);
    const gapLg = clamp(safeHeight * 0.04, 16, 26);

    const lineHeight = clamp(bodySize * 1.5, 18, 28);

    // ???쒕툝由우뿉???덈Т 醫곸븘 蹂댁씠??遺遺??닿껐: ?곹븳 1200
    const contentMaxWidth = clamp(safeWidth * 0.95, 320, 1200);

    return {
      hPadding,
      vPadding,
      brandSize,
      titleSize,
      bodySize,
      buttonSize,
      logoW,
      logoH,
      infoPadding,
      gapSm,
      gapMd,
      gapLg,
      lineHeight,
      contentMaxWidth,
      checkboxSize: clamp(base * 0.03, 18, 24),
      radius: clamp(base * 0.02, 10, 16),
      btnVPad: clamp(safeHeight * 0.018, 12, 18),
    };
  }, [safeWidth, safeHeight]);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingHorizontal: s.hPadding, paddingVertical: s.vPadding },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ width: "100%", maxWidth: s.contentMaxWidth }}>
        {/* CareLink 濡쒓퀬 */}
        <View style={[styles.header, { marginBottom: s.gapMd }]}>
          <View style={styles.brandContainer}>
            <Image
              source={require("../../../assets/images/CareLinkicon.png")}
              style={{ width: s.logoW, height: s.logoH, marginRight: 8, tintColor: "#0F766E" }}
              resizeMode="contain"
            />
            <Text style={[styles.brand, { fontSize: s.brandSize }]}>
              CareLink
            </Text>
          </View>
        </View>

        {/* ?쒕ぉ */}
        <Text
          style={[
            styles.title,
            { fontSize: s.titleSize, marginBottom: s.gapSm },
          ]}
        >
          Data Source Agreement
        </Text>

        {/* ?ㅻ챸 諛뺤뒪 */}
        <View
          style={[
            styles.infoBox,
            {
              borderRadius: s.radius,
              padding: s.infoPadding,
              marginBottom: s.gapMd,
            },
          ]}
        >
          <Text
            style={[
              styles.infoText,
              { fontSize: s.bodySize, lineHeight: s.lineHeight },
            ]}
          >
            CareLink is committed to protecting your health data in compliance with GDPR
            and international privacy standards.{"\n\n"}
            To provide you with personalized health management services, we request your
            explicit consent to:{"\n\n"}
            HEALTH DATA COLLECTION:{"\n"}
            ??Access and process health data classified as special categories of personal data{"\n"}
            ??Collect biometric information from connected health devices and wearables{"\n"}
            ??Store your medical history, prescriptions, and wellness metrics{"\n"}
            ??Process sensitive health information that may reveal your health status{"\n\n"}
            YOUR LEGAL RIGHTS UNDER GDPR:{"\n"}
            1. Right to be informed: Clear, transparent communication about data processing{"\n"}
            2. Right of access: Request a copy of all personal health data we hold{"\n"}
            3. Right to rectification: Correct inaccurate or incomplete health information{"\n"}
            4. Right to erasure: Request deletion of your personal health data{"\n"}
            5. Right to restrict processing: Limit how we use your data{"\n"}
            6. Right to object: Withdraw consent or opt out of data processing{"\n"}
            7. Right to data portability: Receive your data in a structured, portable format{"\n\n"}
            CONSENT WITHDRAWAL:{"\n"}
            You can withdraw your consent at any time through account settings. Withdrawal
            does not affect the lawfulness of data processing before withdrawal.{"\n\n"}
            DATA RETENTION:{"\n"}
            Your health data is retained as long as your account is active, unless you
            request deletion. Deleted data is permanently removed within 30 days.{"\n\n"}
            THIRD-PARTY SHARING:{"\n"}
            Your health data will not be sold, transferred, or shared with advertisers or
            marketing partners without your explicit consent. Sharing with healthcare
            providers requires separate authorization.
          </Text>
        </View>

        {/* 泥댄겕諛뺤뒪 ?곸뿭 */}
        <TouchableOpacity
          style={[styles.checkboxContainer, { marginBottom: s.gapLg }]}
          onPress={() => setIsChecked((p) => !p)}
          activeOpacity={0.8}
        >
          <View
            style={[
              styles.checkbox,
              {
                width: s.checkboxSize,
                height: s.checkboxSize,
                borderRadius: clamp(s.checkboxSize * 0.18, 4, 6),
              },
              isChecked && styles.checkedBox,
            ]}
          />
          <Text style={[styles.checkboxLabel, { fontSize: s.bodySize }]}>
            I agree to the data source.
          </Text>
        </TouchableOpacity>

        {/* ?ㅼ쓬 ?④퀎 踰꾪듉 */}
        <TouchableOpacity
          style={[
            styles.continueButton,
            {
              borderRadius: s.radius,
              paddingVertical: s.btnVPad,
              backgroundColor: isChecked ? "#0F766E" : "#A7DCCF",
              ...(Platform.OS === "android" ? { elevation: 1 } : {}),
            },
          ]}
          disabled={!isChecked}
          onPress={() => router.push("../auth/signup")}
          activeOpacity={0.85}
        >
          <Text style={[styles.buttonText, { fontSize: s.buttonSize }]}>
            Agree and Continue
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
  },
  brandContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  brand: {
    fontWeight: "bold",
    color: "#111",
  },
  title: {
    fontWeight: "bold",
    color: "#111",
    alignSelf: "flex-start",
  },
  infoBox: {
    backgroundColor: "#D9F2EC",
  },
  infoText: {
    color: "#333",
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
  },
  checkbox: {
    borderWidth: 2,
    borderColor: "#0F766E",
    marginRight: 10,
  },
  checkedBox: {
    backgroundColor: "#0F766E",
  },
  checkboxLabel: {
    color: "#111",
  },
  continueButton: {
    width: "100%",
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
  },
});
