import React, { createContext, useContext } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

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
        await AsyncStorage.multiRemove(["userId", "token", "userName", "profileImageId", "caregivers:list"]);
        if (expired) {
            onSessionExpired();
        }
        router.replace("/(tabs)");
    };

    return (
        <AuthContext.Provider value={{ signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

/** 로그아웃 또는 세션 만료 처리가 필요한 곳에서 사용 */
export const useAuth = () => useContext(AuthContext);
