// components/TabScreen.tsx
import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, View } from "react-native";

export function TabScreen({ children, scrollable=false, contentContainerStyle }: any) {
  const Container: any = scrollable ? ScrollView : View;
  const containerProps = scrollable
    ? { contentContainerStyle, contentInsetAdjustmentBehavior: "never", showsVerticalScrollIndicator: false }
    : { style: contentContainerStyle };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['left','right','bottom']}>
      <Container {...containerProps}>{children}</Container>
    </SafeAreaView>
  );
}
