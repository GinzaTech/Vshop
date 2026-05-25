import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

import { COLORS, RADIUS } from "~/constants/DesignSystem";

interface InfoPillProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export default function InfoPill({ children, style }: InfoPillProps) {
  const normalizedChildren = React.Children.toArray(children)
    .filter((child) => child != null)
    .filter(
      (child) =>
        !(typeof child === "string" && child.trim().length === 0)
    )
    .map((child, index) =>
      typeof child === "string" || typeof child === "number" ? (
        <Text key={`pill-text-${index}`} style={styles.inlineText}>
          {child}
        </Text>
      ) : (
        child
      )
    );

  return <View style={[styles.pill, style]}>{normalizedChildren}</View>;
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
    borderRadius: RADIUS.chip,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    paddingHorizontal: 16,
    gap: 8,
  },
  inlineText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: "600",
  },
});
