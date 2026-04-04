import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

import { COLORS, RADIUS } from "~/constants/DesignSystem";

interface EmptyStateCardProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  centered?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function EmptyStateCard({
  title,
  subtitle,
  icon,
  centered = false,
  style,
}: EmptyStateCardProps) {
  return (
    <View style={[centered ? styles.centeredContainer : styles.inlineContainer, style]}>
      {icon ? <View style={styles.iconBadge}>{icon}</View> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inlineContainer: {
    padding: 24,
    borderRadius: 28,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  centeredContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    backgroundColor: COLORS.BACKGROUND,
  },
  iconBadge: {
    width: 76,
    height: 76,
    borderRadius: RADIUS.chip,
    backgroundColor: COLORS.SURFACE,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    marginBottom: 18,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 8,
    textAlign: "center",
    color: COLORS.TEXT_SECONDARY,
  },
});
