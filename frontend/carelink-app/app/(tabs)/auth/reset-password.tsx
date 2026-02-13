import React from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Image,
    Dimensions,
} from "react-native";
import { useRouter } from "expo-router";

const { width, height } = Dimensions.get("window");

export default function ForgotPassWord() {
    const router = useRouter();

    return (
        <View style={styles.container}>
        {/* 로고 + CareLink 한 줄 */}
        <View style={styles.brandContainer}>
            <Image
            source={require("../../../assets/images/CareLinkicon.png")}
            style={styles.logo}
            resizeMode="contain"
            />
            <Text style={styles.brand}>CareLink</Text>
        </View>

        {/* 로그인 카드 */}
        <View style={styles.card}>
            <Text style={styles.loginTitle}>Reset Password</Text>

            <TextInput
            style={styles.input}
            placeholder="New Password"
            placeholderTextColor="#999"
            />
            <TextInput
            style={styles.input}
            placeholder="New Password"
            secureTextEntry
            placeholderTextColor="#999"
            />

            <TouchableOpacity style={styles.loginButton} onPress={() => router.push("./login")}>
            <Text style={styles.loginButtonText}>Go to Login</Text>
            </TouchableOpacity>
        </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f7f9fb",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: width * 0.08,
    },
    brandContainer: {
        flexDirection: "row", // ✅ 한 줄 정렬
        alignItems: "center",
        marginBottom: height * 0.04,
    },
    logo: {
        width: width * 0.1, // 조금 작게
        height: height * 0.05,
        marginRight: width * 0.02, // 로고와 텍스트 간격
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
        backgroundColor: "#f1f3f6",
        borderRadius: 10,
        paddingVertical: height * 0.015,
        paddingHorizontal: width * 0.04,
        fontSize: width * 0.04,
        marginBottom: height * 0.02,
        color: "#333",
    },
    loginButton: {
        backgroundColor: "#0ea5e9",
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
    forgotText: {
        color: "#0ea5e9",
        fontSize: width * 0.04,
        marginTop: height * 0.015,
    },
});
