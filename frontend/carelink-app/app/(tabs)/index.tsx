import React from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import { useRouter } from "expo-router";

const { width, height } = Dimensions.get("window"); // 기기 화면 크기 가져오기

export default function Index() {

  const router = useRouter();

  return (
    <View style={styles.container}>
      <Image
        source={require("../../assets/images/HomeScreen.png")}
        style={styles.image}
        resizeMode="contain"
      />
      <Text style={styles.title}>CareLink</Text>
      <Text style={styles.subtitle}>Empowering families for better</Text>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={() => router.push("../auth/login")}>
          <Text style={styles.buttonText}>Login</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={() => router.push("../auth/data-agreement")}>
          <Text style={styles.buttonText}>Sign Up</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: width * 0.05, // 화면 폭의 5% 여백
  },
  image: {
    width: width * 0.7,   // 화면 폭의 70%
    height: height * 0.25, // 화면 높이의 25%
    marginBottom: height * 0.03, // 화면 높이의 3%
  },
  title: {
    fontSize: width * 0.1, // 화면 폭의 7%
    fontWeight: "bold",
    color: "#111",
  },
  subtitle: {
    fontSize: width * 0.07,
    color: "#666",
    marginBottom: height * 0.05,
    marginTop: height * 0.02,
    textAlign: "center",
    fontWeight: "400",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "center",
    width: "100%",
    marginTop: height * 0.08,
  },
  button: {
    backgroundColor: "#0ea5e9",
    paddingVertical: height * 0.015,
    paddingHorizontal: width * 0.08,
    borderRadius: 8,
    marginHorizontal: width * 0.02,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: width * 0.07,
  },
});
