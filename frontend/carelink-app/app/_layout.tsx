import { useEffect, useState } from "react";
import { useRouter, Stack } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { FontSizeProvider } from "../contexts/FontSizeContext";
import { AuthProvider } from "../contexts/AuthContext";
import Toast from "../components/Toast";

export default function RootLayout() {
    const [isReady, setIsReady] = useState(false);
    const [sessionExpired, setSessionExpired] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const init = async () => {
            const [userId, token] = await Promise.all([
                AsyncStorage.getItem("userId"),
                AsyncStorage.getItem("token"),
            ]);
            if (userId && token) {
                router.replace("/(tabs)/Home/HomePage");
            } else {
                router.replace("/(tabs)");
            }
            setIsReady(true);
        };
        init();
    }, []);

    return (
        <FontSizeProvider>
            <AuthProvider onSessionExpired={() => setSessionExpired(true)}>
                {/* Stack은 항상 마운트 → router.replace()가 즉시 동작 */}
                <Stack screenOptions={{ headerShown: false }} />

                {/* 인증 확인 중에는 흰 오버레이로 깜빡임 차단 */}
                {!isReady && (
                    <View style={styles.overlay}>
                        <ActivityIndicator size="large" color="#00AEEF" />
                    </View>
                )}

                {/* 세션 만료 토스트 */}
                <Toast
                    visible={sessionExpired}
                    message="Your session has expired. Please log in again."
                    onHide={() => setSessionExpired(false)}
                />
            </AuthProvider>
        </FontSizeProvider>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "#ffffff",
        justifyContent: "center",
        alignItems: "center",
    },
});
