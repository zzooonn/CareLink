import React, { createContext, useContext } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { unregisterPushTokenAsync } from "../utils/pushNotifications";

type AuthContextType = {
    signOut: (expired?: boolean) => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
    signOut: async () => {},
});

export function AuthProvider({
    children,
    onSessionExpired,
}: {
    children: React.ReactNode;
    onSessionExpired: () => void;
}) {
    const router = useRouter();

    const signOut = async (expired = false) => {
        // 이 기기로 다른 사람의 알림이 계속 오지 않도록 서버의 푸시 토큰을 먼저 해제
        if (!expired) {
            await unregisterPushTokenAsync();
        }
        await AsyncStorage.multiRemove(["userId", "token", "refreshToken", "userName", "profileImageId", "caregivers:list"]);
        if (expired) {
            onSessionExpired();
        }
        router.replace("/");
    };

    return (
        <AuthContext.Provider value={{ signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

/** 로그아웃 또는 세션 만료 처리가 필요한 곳에서 사용 */
export const useAuth = () => useContext(AuthContext);
