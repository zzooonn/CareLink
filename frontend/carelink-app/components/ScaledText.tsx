import React from "react";
import { Text, TextProps, StyleSheet } from "react-native";
import { useFontSize } from "../contexts/FontSizeContext";

export function ScaledText({ style, ...props }: TextProps) {
  const { multiplier } = useFontSize();
  const flat = StyleSheet.flatten(style) ?? {};
  const scaled = flat.fontSize != null
    ? { ...flat, fontSize: flat.fontSize * multiplier }
    : flat;
  return <Text style={scaled} {...props} />;
}
