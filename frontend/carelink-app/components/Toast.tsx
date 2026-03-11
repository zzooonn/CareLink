import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, Dimensions } from "react-native";

const { width } = Dimensions.get("window");

type ToastProps = {
    visible: boolean;
    message: string;
    onHide: () => void;
};

export default function Toast({ visible, message, onHide }: ToastProps) {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(-20)).current;

    useEffect(() => {
        if (!visible) return;

        // 나타나기
        Animated.parallel([
            Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start();

        // 3초 후 사라지기
        const timer = setTimeout(() => {
            Animated.parallel([
                Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
                Animated.timing(translateY, { toValue: -20, duration: 300, useNativeDriver: true }),
            ]).start(() => onHide());
        }, 3000);

        return () => clearTimeout(timer);
    }, [visible]);

    if (!visible) return null;

    return (
        <Animated.View style={[styles.container, { opacity, transform: [{ translateY }] }]}>
            <Text style={styles.text}>{message}</Text>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: "absolute",
        top: 60,
        alignSelf: "center",
        backgroundColor: "#1f2937",
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 12,
        maxWidth: width * 0.85,
        zIndex: 9999,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 8,
    },
    text: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "600",
        textAlign: "center",
    },
});
