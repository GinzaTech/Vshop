import React from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

import { COLORS } from "~/constants/DesignSystem";

interface PageIntroProps {
  title: string;
  subtitle?: string;
  accessory?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

export default function PageIntro({
  title,
  subtitle,
  accessory,
  style,
  contentStyle,
}: PageIntroProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={[styles.content, contentStyle]}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {accessory}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.TEXT_SECONDARY,
  },
});
