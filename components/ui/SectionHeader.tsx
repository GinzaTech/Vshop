import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

import { COLORS } from "~/constants/DesignSystem";

interface SectionHeaderProps {
  title: string;
  meta?: string;
  style?: StyleProp<ViewStyle>;
}

export default function SectionHeader({
  title,
  meta,
  style,
}: SectionHeaderProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title}>{title}</Text>
      {meta ? <Text style={styles.meta}>{meta}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
  },
  meta: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },
});
