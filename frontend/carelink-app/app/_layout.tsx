import { useEffect, useState } from "react";
import { useRouter, Stack } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { View, ActivityIndicator } from "react-native";
import { FontSizeProvider } from "../contexts/FontSizeContext";

export default function RootLayout() {
    const [isReady, setIsReady] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const init = async () => {
        const userId = await AsyncStorage.getItem("userId");
        setIsLoggedIn(!!userId);
        setIsReady(true);
        };
        init();
    }, []);

    useEffect(() => {
        if (!isReady) return;
        if (isLoggedIn) {
        router.replace("/(tabs)/Home/HomePage");
        } else {
        router.replace("/(tabs)");
        }
    }, [isReady]);

    if (!isReady) {
        return (
        <View style={{ flex: 1, backgroundColor: "#ffffff", justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" color="#00AEEF" />
        </View>
        );
    }

    return (
        <FontSizeProvider>
            <Stack screenOptions={{ headerShown: false }} />
        </FontSizeProvider>
    );
}