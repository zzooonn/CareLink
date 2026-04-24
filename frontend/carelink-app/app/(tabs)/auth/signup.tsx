import React, { useMemo, useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScaledText as Text } from "../../../components/ScaledText";
import { useRouter } from "expo-router";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { palette, pressShadow, radius, shadow, spacing, typeScale, webShell } from "../../../constants/design";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

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

type GenderOption = "MAN" | "FEMALE" | "UNKNOWN";

function toApiGender(opt: GenderOption) {
  if (opt === "MAN") return "M";
  if (opt === "FEMALE") return "F";
  return "UNKNOWN";
}

function formatDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isValidBirthDate(v: string) {
  if (!v) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function isStrongPassword(pw: string) {
  return /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(pw);
}

export default function SignUp() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState<GenderOption>("UNKNOWN");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [guardianId, setGuardianId] = useState("");

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [pwVisible, setPwVisible] = useState(false);
  const [pwConfirmVisible, setPwConfirmVisible] = useState(false);

  const [isGuardian, setIsGuardian] = useState(false);
  const [selectedAvatarId, setSelectedAvatarId] = useState<number>(1);

  const [signUpLoading, setSignUpLoading] = useState(false);

  const [showBirthPicker, setShowBirthPicker] = useState(false);
  const [birthPickerValue, setBirthPickerValue] = useState<Date>(
    new Date(2000, 0, 1)
  );

  const currentAvatar = useMemo(
    () =>
      AVATAR_LIST.find((item) => item.id === selectedAvatarId)?.source ??
      AVATAR_LIST[0].source,
    [selectedAvatarId]
  );

  const openBirthPicker = () => {
    setShowBirthPicker(true);
  };

  const onBirthChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") {
      setShowBirthPicker(false);

      if (event.type === "dismissed") return;
      if (selected) {
        setBirthPickerValue(selected);
        setBirthDate(formatDate(selected));
      }
      return;
    }

    if (selected) {
      setBirthPickerValue(selected);
      setBirthDate(formatDate(selected));
    }
  };

  const handleSignUp = async () => {
    if (!API_BASE_URL) {
      Alert.alert(
        "Configuration Error",
        "Please set EXPO_PUBLIC_API_BASE_URL and restart the app."
      );
      return;
    }

    if (!userId.trim() || !name.trim() || !phone.trim()) {
      Alert.alert("Required", "User ID, name, and phone number are required.");
      return;
    }

    if (!password.trim()) {
      Alert.alert("Required", "Please enter a password.");
      return;
    }

    if (!isStrongPassword(password.trim())) {
      Alert.alert("Weak Password", "Password must be at least 8 characters and include both letters and numbers.");
      return;
    }

    if (password !== passwordConfirm) {
      Alert.alert("Mismatch", "Passwords do not match.");
      return;
    }

    if (!isValidBirthDate(birthDate.trim())) {
      Alert.alert("Invalid Format", "Please enter a valid date of birth (YYYY-MM-DD).");
      return;
    }

    const role = isGuardian ? "GUARDIAN" : "PATIENT";
    const normalizedGuardianId = isGuardian ? "" : guardianId.trim();

    const payload = {
      userId: userId.trim(),
      password: password.trim(),
      name: name.trim(),
      gender: toApiGender(gender),
      birthDate: birthDate.trim(),
      phone: phone.trim(),
      address: address.trim(),
      role,
      guardianId: normalizedGuardianId,
      profileImageId: selectedAvatarId,
    };

    const SIGNUP_ENDPOINT = `${API_BASE_URL}/api/auth/signup`;

    try {
      setSignUpLoading(true);

      const res = await fetch(SIGNUP_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const text = await res.text();

      if (!res.ok) {
        Alert.alert("Sign Up Failed", text || "An error occurred during sign up.");
        return;
      }

      Alert.alert("Success", "Account created successfully!");
      router.push("../auth/login");
    } catch {
      Alert.alert("Connection Error", "Could not connect to the server.");
    } finally {
      setSignUpLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboard}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.shell}>
            <View style={styles.brandRow}>
              <View style={styles.logoMark}>
                <Image
                  source={require("../../../assets/images/CareLinkicon.png")}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.brandCopy}>
                <Text style={styles.kicker}>CARELINK ONBOARDING</Text>
                <Text style={styles.brand}>Create account</Text>
              </View>
            </View>

            <View style={styles.card}>
          <Text style={styles.title}>Sign Up</Text>

          <View style={styles.avatarSection}>
            <Text style={styles.avatarLabel}>Choose Your Profile</Text>

            <View style={styles.selectedAvatarWrapper}>
              <Image source={currentAvatar} style={styles.selectedAvatar} />
            </View>

            <ScrollView
              style={styles.avatarCarousel}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.avatarScrollContent}
            >
              {AVATAR_LIST.map((avatar) => (
                <TouchableOpacity
                  key={avatar.id}
                  onPress={() => setSelectedAvatarId(avatar.id)}
                  activeOpacity={0.7}
                  style={[
                    styles.avatarOption,
                    selectedAvatarId === avatar.id && styles.avatarOptionSelected,
                  ]}
                >
                  <Image source={avatar.source} style={styles.avatarOptionImg} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <TextInput
            style={styles.input}
            placeholder="User ID"
            placeholderTextColor={palette.faint}
            value={userId}
            onChangeText={setUserId}
            autoCapitalize="none"
          />

          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              placeholder="Password"
              placeholderTextColor={palette.faint}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!pwVisible}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.pwToggle}
              onPress={() => setPwVisible((v) => !v)}
              activeOpacity={0.85}
            >
              <Text style={styles.pwToggleText}>
                {pwVisible ? "Hide" : "Show"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputSpacer} />

          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              placeholder="Confirm Password"
              placeholderTextColor={palette.faint}
              value={passwordConfirm}
              onChangeText={setPasswordConfirm}
              secureTextEntry={!pwConfirmVisible}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.pwToggle}
              onPress={() => setPwConfirmVisible((v) => !v)}
              activeOpacity={0.85}
            >
              <Text style={styles.pwToggleText}>
                {pwConfirmVisible ? "Hide" : "Show"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputSpacer} />

          <TextInput
            style={styles.input}
            placeholder="Name"
            placeholderTextColor={palette.faint}
            value={name}
            onChangeText={setName}
          />

          <View style={styles.genderContainer}>
            {(["MAN", "FEMALE", "UNKNOWN"] as GenderOption[]).map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.genderButton,
                  gender === option && styles.genderButtonSelected,
                ]}
                onPress={() => setGender(option)}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.genderText,
                    gender === option && styles.genderTextSelected,
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity activeOpacity={0.85} onPress={openBirthPicker}>
            <View pointerEvents="none">
              <TextInput
                style={[styles.input, { color: palette.ink }]}
                placeholder="Date of Birth (YYYY-MM-DD)"
                placeholderTextColor={palette.faint}
                value={birthDate}
                editable={false}
              />
            </View>
          </TouchableOpacity>

          {Platform.OS === "ios" && showBirthPicker && (
            <View style={styles.iosPickerBox}>
              <DateTimePicker
                value={birthPickerValue}
                mode="date"
                display="inline"
                onChange={onBirthChange}
                maximumDate={new Date()}
                themeVariant="light"
              />
              <TouchableOpacity
                style={styles.iosDoneBtn}
                onPress={() => setShowBirthPicker(false)}
                activeOpacity={0.9}
              >
                <Text style={styles.iosDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}

          {Platform.OS === "android" && showBirthPicker && (
            <DateTimePicker
              value={birthPickerValue}
              mode="date"
              display="calendar"
              onChange={onBirthChange}
              maximumDate={new Date()}
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Phone Number"
            keyboardType="phone-pad"
            placeholderTextColor={palette.faint}
            value={phone}
            onChangeText={setPhone}
          />

          <TextInput
            style={styles.input}
            placeholder="Address"
            placeholderTextColor={palette.faint}
            value={address}
            onChangeText={setAddress}
          />

          {!isGuardian && (
            <TextInput
              style={styles.input}
              placeholder="Guardian ID (Optional)"
              placeholderTextColor={palette.faint}
              value={guardianId}
              onChangeText={setGuardianId}
              autoCapitalize="none"
            />
          )}

          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() =>
              setIsGuardian((prev) => {
                const next = !prev;
                if (next) setGuardianId("");
                return next;
              })
            }
            activeOpacity={0.85}
          >
            <View style={[styles.checkbox, isGuardian && styles.checkedBox]} />
            <Text style={styles.checkboxLabel}>I am a guardian</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.joinButton, signUpLoading && styles.joinButtonDisabled]}
            onPress={handleSignUp}
            disabled={signUpLoading}
            activeOpacity={0.9}
          >
            {signUpLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={palette.surface} />
                <Text style={styles.joinButtonText}>Signing up...</Text>
              </View>
            ) : (
              <Text style={styles.joinButtonText}>Join</Text>
            )}
          </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  keyboard: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xl,
  },
  shell: {
    ...webShell,
    gap: spacing.lg,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  logoMark: {
    width: 52,
    height: 52,
    borderRadius: radius.card,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: "center",
    justifyContent: "center",
    ...shadow,
  },
  logo: {
    width: 34,
    height: 34,
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
  brand: {
    color: palette.ink,
    fontSize: typeScale.title,
    fontWeight: "900",
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.line,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow,
  },
  title: {
    fontSize: typeScale.section,
    fontWeight: "900",
    color: palette.ink,
  },
  avatarSection: {
    width: "100%",
    alignItems: "center",
    gap: spacing.sm,
  },
  avatarLabel: {
    fontSize: typeScale.meta,
    color: palette.muted,
    fontWeight: "800",
  },
  selectedAvatarWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: palette.surfaceMuted,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: palette.primarySoft,
    overflow: "hidden",
  },
  selectedAvatar: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  avatarCarousel: {
    width: "100%",
    maxWidth: "100%",
    overflow: "hidden",
  },
  avatarScrollContent: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  avatarOption: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: palette.line,
    overflow: "hidden",
    backgroundColor: palette.surface,
  },
  avatarOptionSelected: {
    borderColor: palette.primary,
    borderWidth: 3,
    transform: [{ scale: 1.05 }],
  },
  avatarOptionImg: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  passwordInput: {
    flex: 1,
    marginBottom: 0,
  },
  pwToggle: {
    marginLeft: spacing.sm,
    minHeight: 54,
    paddingHorizontal: spacing.md,
    borderRadius: radius.card,
    backgroundColor: palette.primarySoft,
    justifyContent: "center",
    alignItems: "center",
  },
  pwToggleText: {
    color: palette.primaryDark,
    fontWeight: "800",
  },
  inputSpacer: {
    height: 0,
  },
  genderContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  genderButton: {
    flex: 1,
    backgroundColor: palette.surfaceMuted,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.line,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  genderButtonSelected: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  genderText: {
    fontSize: typeScale.meta,
    fontWeight: "800",
    color: palette.muted,
  },
  genderTextSelected: {
    color: palette.surface,
    fontWeight: "900",
  },
  input: {
    minHeight: 54,
    backgroundColor: palette.surfaceMuted,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: spacing.md,
    fontSize: typeScale.body,
    fontWeight: "700",
    color: palette.ink,
  },
  iosPickerBox: {
    backgroundColor: palette.surfaceMuted,
    borderRadius: radius.card,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.md,
    borderWidth: 1,
    borderColor: palette.line,
    overflow: "hidden",
  },
  iosDoneBtn: {
    marginTop: spacing.sm,
    backgroundColor: palette.primary,
    paddingVertical: 12,
    borderRadius: radius.card,
    alignItems: "center",
  },
  iosDoneText: {
    color: palette.surface,
    fontWeight: "800",
    fontSize: typeScale.body,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    minHeight: 32,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: palette.primary,
    borderRadius: radius.xs,
    marginRight: 8,
  },
  checkedBox: {
    backgroundColor: palette.primary,
  },
  checkboxLabel: {
    fontSize: typeScale.meta,
    color: palette.ink,
    fontWeight: "700",
  },
  joinButton: {
    backgroundColor: palette.primary,
    borderRadius: radius.card,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    ...pressShadow,
  },
  joinButtonDisabled: {
    opacity: 0.6,
  },
  joinButtonText: {
    color: palette.surface,
    fontSize: typeScale.body,
    fontWeight: "900",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
