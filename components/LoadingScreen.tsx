/**
 * LoadingScreen — Màn hình loading có animation khi app đang fetch data.
 * Hiển thị skeleton gần với bố cục màn hình chính để tránh cảm giác blank screen.
 */
import React from "react";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { COLORS, RADIUS, SPACING } from "~/constants/DesignSystem";

type LoadingScreenProps = {
  message?: string;
};

export default function LoadingScreen({ message = "Loading" }: LoadingScreenProps) {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(1);

  React.useEffect(() => {
    if (reduceMotion) {
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(withTiming(0, { duration: 850 }), -1, true);
    return () => {
      cancelAnimation(pulse);
    };
  }, [pulse, reduceMotion]);

  const skeletonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + pulse.value * 0.5,
  }));

  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityLabel={message}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.brandBlock}>
        <View style={styles.brandMark}>
          <Icon name="shopping-outline" size={42} color={COLORS.PURE_WHITE} />
        </View>
        <View>
          <Text style={styles.brandName}>VSHOP</Text>
          <Text style={styles.brandTagline}>VALORANT COMPANION</Text>
        </View>
      </View>

      <View style={styles.statusRow}>
        <ActivityIndicator size={14} color={COLORS.ACCENT_DEEP} />
        <Text style={styles.statusText}>{message}</Text>
      </View>

      <Animated.View style={[styles.skeleton, skeletonAnimatedStyle]}>
        <View style={styles.profileCard}>
          <View style={styles.avatar} />
          <View style={styles.headerCopy}>
            <View style={[styles.line, styles.titleLine]} />
            <View style={[styles.line, styles.subtitleLine]} />
          </View>
        </View>
        <View style={styles.hero} />
        <View style={styles.sectionLine} />
        <View style={styles.cardRow}>
          <View style={styles.card} />
          <View style={styles.card} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
    paddingHorizontal: SPACING.lg,
    paddingTop: 72,
  },
  brandBlock: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  brandMark: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.ACCENT_DEEP,
  },
  brandName: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  brandTagline: {
    marginTop: 2,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  statusRow: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    marginTop: SPACING.xl,
  },
  statusText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: "600",
  },
  skeleton: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.md,
    borderRadius: RADIUS.card,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    gap: SPACING.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.chip,
    backgroundColor: COLORS.SURFACE_MUTED,
  },
  headerCopy: {
    flex: 1,
    gap: SPACING.xs,
  },
  line: {
    height: 12,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.SURFACE_MUTED,
  },
  titleLine: { width: "42%" },
  subtitleLine: { width: "64%", height: 9 },
  hero: {
    height: 136,
    marginTop: SPACING.xl,
    borderRadius: RADIUS.card,
    backgroundColor: COLORS.SURFACE_MUTED,
  },
  sectionLine: {
    width: 120,
    height: 16,
    marginTop: SPACING.xl,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.SURFACE_MUTED,
  },
  cardRow: {
    flexDirection: "row",
    gap: SPACING.sm,
  },
  card: {
    flex: 1,
    height: 176,
    borderRadius: RADIUS.card,
    backgroundColor: COLORS.SURFACE_MUTED,
  },
});
