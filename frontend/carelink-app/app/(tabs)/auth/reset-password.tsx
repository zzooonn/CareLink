import React, { useState } from "react";
import {
    View,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Image,
    Dimensions,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    ScrollView,
    Platform,
} from "react-native";
import { ScaledText as Text } from "../../../components/ScaledText";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";

const { width, height } = Dimensions.get("window");
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

function isStrongPassword(pw: string) {
    return /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(pw);
}

export default function ResetPassword() {
    const router = useRouter();
    const { userId, resetToken } = useLocalSearchParams<{ userId: string; resetToken: string }>();

    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [pwVisible, setPwVisible] = useState(false);
    const [pwConfirmVisible, setPwConfirmVisible] = useState(false);

    const handleReset = async () => {
        if (!userId || !resetToken) {
            Alert.alert("Invalid Access", "Please verify your identity again.");
            return;
        }
        if (!newPassword.trim() || !confirmPassword.trim()) {
            Alert.alert("Required", "Please fill in both password fields.");
            return;
        }
        if (!isStrongPassword(newPassword.trim())) {
            Alert.alert("Weak Password", "Password must be at least 8 characters and include both letters and numbers.");
            return;
        }
        if (newPassword !== confirmPassword) {
            Alert.alert("Mismatch", "Passwords do not match.");
            return;
        }
        if (!API_BASE_URL) {
            Alert.alert("Configuration Error", "Server address is not configured.");
            return;
        }

        try {
            setLoading(true);
            const res = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId,
                    newPassword: newPassword.trim(),
                    resetToken,
                }),
            });

            const text = await res.text();
            let data: any = {};
            try { data = text ? JSON.parse(text) : {}; } catch {}

            if (!res.ok) {
                Alert.alert("Error", data?.message || "Failed to reset password.");
                return;
            }

            Alert.alert("Success", "Password has been reset. Please log in.", [
                { text: "OK", onPress: () => router.replace("/(tabs)/auth/login") },
            ]);
        } catch {
            Alert.alert("Connection Error", "Could not connect to the server. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: "#F4FAF6" }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            <ScrollView
                contentContainerStyle={styles.container}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.brandContainer}>
                    <Image
                        source={require("../../../assets/images/CareLinkicon.png")}
                        style={styles.logo}
                        resizeMode="contain"
                    />
                    <Text style={styles.brand}>CareLink</Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.loginTitle}>Reset Password</Text>

                    <View style={styles.pwRow}>
                        <TextInput
                            style={styles.pwInput}
                            placeholder="New Password"
                            placeholderTextColor="#999"
                            secureTextEntry={!pwVisible}
                            value={newPassword}
                            onChangeText={setNewPassword}
                            editable={!loading}
                        />
                        <TouchableOpacity onPress={() => setPwVisible(v => !v)} style={styles.eyeBtn}>
                            <Ionicons name={pwVisible ? "eye-off-outline" : "eye-outline"} size={20} color="#9ca3af" />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.pwRow}>
                        <TextInput
                            style={styles.pwInput}
                            placeholder="Confirm New Password"
                            placeholderTextColor="#999"
                            secureTextEntry={!pwConfirmVisible}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            editable={!loading}
                        />
                        <TouchableOpacity onPress={() => setPwConfirmVisible(v => !v)} style={styles.eyeBtn}>
                            <Ionicons name={pwConfirmVisible ? "eye-off-outline" : "eye-outline"} size={20} color="#9ca3af" />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={[styles.loginButton, loading && { opacity: 0.6 }]}
                        onPress={handleReset}
                        disabled={loading}
                    >
                        {loading
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.loginButtonText}>Set New Password</Text>
                        }
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => router.back()}
                        disabled={loading}
                        style={{ marginTop: height * 0.02 }}
                    >
                        <Text style={styles.backText}>Back</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        backgroundColor: "#F4FAF6",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: width * 0.08,
        paddingVertical: height * 0.05,
    },
    brandContainer: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: height * 0.04,
    },
    logo: {
        width: width * 0.1,
        height: height * 0.05,
        marginRight: width * 0.02,
        tintColor: "#0F766E",
    },
    brand: {
        fontSize: width * 0.07,
        fontWeight: "bold",
        color: "#111",
    },
    card: {
        width: "100%",
        backgroundColor: "#fff",
        borderRadius: 16,
        paddingVertical: height * 0.04,
        paddingHorizontal: width * 0.06,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 6,
        alignItems: "center",
    },
    loginTitle: {
        fontSize: width * 0.06,
        fontWeight: "bold",
        marginBottom: height * 0.03,
        color: "#111",
    },
    input: {
        width: "100%",
        backgroundColor: "#F8FBF9",
        borderRadius: 10,
        paddingVertical: height * 0.015,
        paddingHorizontal: width * 0.04,
        fontSize: width * 0.04,
        marginBottom: height * 0.02,
        color: "#333",
    },
    loginButton: {
        backgroundColor: "#0F766E",
        borderRadius: 10,
        width: "100%",
        paddingVertical: height * 0.018,
        alignItems: "center",
        marginTop: height * 0.01,
    },
    loginButtonText: {
        color: "#fff",
        fontSize: width * 0.045,
        fontWeight: "bold",
    },
    backText: {
        color: "#0F766E",
        fontSize: width * 0.038,
    },
    pwRow: {
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F8FBF9",
        borderRadius: 10,
        marginBottom: height * 0.02,
    },
    pwInput: {
        flex: 1,
        paddingVertical: height * 0.015,
        paddingHorizontal: width * 0.04,
        fontSize: width * 0.04,
        color: "#333",
    },
    eyeBtn: {
        paddingHorizontal: width * 0.03,
        justifyContent: "center",
    },
});
