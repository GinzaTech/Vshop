/**
 * LoadingScreen — Màn hình loading có animation khi app đang fetch data.
 * Hiển thị: logo + spinner + text trạng thái.
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { MotiView } from "moti";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { COLORS } from "~/constants/DesignSystem";

type LoadingScreenProps = {
  message?: string;
};

export default function LoadingScreen({ message = "Loading" }: LoadingScreenProps) {
  return (
    <View style={styles.container}>
      {/* Pulsing logo */}
      <MotiView
        from={{ opacity: 0.4, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          type: "timing",
          duration: 800,
          loop: true,
          repeatReverse: true,
        }}
        style={styles.logoWrap}
      >
        <Icon name="shield-star-outline" size={48} color={COLORS.ACCENT} />
      </MotiView>

      {/* Spinning ring */}
      <MotiView
        from={{ rotate: "0deg" }}
        animate={{ rotate: "360deg" }}
        transition={{
          type: "timing",
          duration: 1200,
          loop: true,
        }}
        style={styles.spinnerRing}
      />

      {/* Loading text */}
      <MotiView
        from={{ opacity: 0.4 }}
        animate={{ opacity: 1 }}
        transition={{
          type: "timing",
          duration: 600,
          loop: true,
          repeatReverse: true,
        }}
      >
        <LoadingText text={message} />
      </MotiView>
    </View>
  );
}

function LoadingText({ text }: { text: string }) {
  return (
    <MotiView
      from={{ opacity: 0.5 }}
      animate={{ opacity: 1 }}
      transition={{ type: "timing", duration: 500, loop: true, repeatReverse: true }}
    >
      <StyledText>{text}</StyledText>
    </MotiView>
  );
}

import { Text } from "react-native";

function StyledText({ children }: { children: React.ReactNode }) {
  return <Text style={styles.text}>{children}</Text>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
    alignItems: "center",
    justifyContent: "center",
  },
  logoWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  spinnerRing: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.08)",
    borderTopColor: COLORS.ACCENT,
    top: "46%",
  },
  text: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginTop: 16,
  },
});
