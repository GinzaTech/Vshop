import React from "react";
import {
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

import { COLORS, RADIUS } from "~/constants/DesignSystem";

interface InfoPillProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export default function InfoPill({ children, style }: InfoPillProps) {
  return <View style={[styles.pill, style]}>{children}</View>;
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
});
