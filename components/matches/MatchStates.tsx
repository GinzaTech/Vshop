import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import React from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import {
  MATCH_COLORS,
  MATCH_LAYOUT,
  MATCH_RADIUS,
  MATCH_SPACING,
} from "~/constants/MatchTheme";

// Single shared shimmer loop — ALL skeletons interpolate from this ONE value
// Much more efficient than per-component MotiView loops
const shimmerValue = new Animated.Value(0);
let shimmerLoop: Animated.CompositeAnimation | null = null;
let shimmerSubscriberCount = 0;

/**
 * Start the shared shimmer only after a skeleton mounts. Module-level starts
 * execute during Expo web SSR where requestAnimationFrame does not exist.
 */
const useSharedShimmerLoop = () => {
  React.useEffect(() => {
    shimmerSubscriberCount += 1;

    if (!shimmerLoop) {
      shimmerValue.setValue(0);
      shimmerLoop = Animated.loop(
        Animated.timing(shimmerValue, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== "web",
        })
      );
      shimmerLoop.start();
    }

    return () => {
      shimmerSubscriberCount = Math.max(0, shimmerSubscriberCount - 1);
      if (shimmerSubscriberCount === 0) {
        shimmerLoop?.stop();
        shimmerLoop = null;
        shimmerValue.setValue(0);
      }
    };
  }, []);
};

type MatchStatePanelProps = {
  icon: "history" | "alert-circle-outline";
  title: string;
  body: string;
  primaryLabel: string;
  onPrimaryPress: () => void;
  secondaryLabel?: string;
  onSecondaryPress?: () => void;
};

export function MatchStatePanel({
  icon,
  title,
  body,
  primaryLabel,
  onPrimaryPress,
  secondaryLabel,
  onSecondaryPress,
}: MatchStatePanelProps) {
  return (
    <View style={styles.statePanel} accessibilityLiveRegion="polite">
      <Icon name={icon} size={34} color={MATCH_COLORS.textSecondary} />
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateBody}>{body}</Text>
      <View style={styles.stateActions}>
        <Pressable
          accessibilityRole="button"
          onPress={onPrimaryPress}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Icon name="refresh" size={19} color={MATCH_COLORS.textPrimary} />
          <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
        </Pressable>
        {secondaryLabel && onSecondaryPress ? (
          <Pressable
            accessibilityRole="button"
            onPress={onSecondaryPress}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Icon name="arrow-left" size={19} color={MATCH_COLORS.textPrimary} />
            <Text style={styles.secondaryButtonText}>{secondaryLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const SkeletonBlock = ({ style }: { style: ViewStyle }) => {
  const opacity = shimmerValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.4, 0.85, 0.4],
  });
  return <Animated.View style={[styles.skeletonBlock, style, { opacity }]} />;
};

export const MatchCardSkeleton = React.memo(function MatchCardSkeleton() {
  useSharedShimmerLoop();

  return (
    <View style={styles.skeletonCard} accessibilityLabel="Loading match">
      <View style={styles.skeletonTopRow}>
        <SkeletonBlock style={styles.skeletonAvatar} />
        <View style={styles.skeletonMain}>
          <SkeletonBlock style={styles.skeletonShortLine} />
          <SkeletonBlock style={styles.skeletonScore} />
          <SkeletonBlock style={styles.skeletonLongLine} />
        </View>
        <SkeletonBlock style={styles.skeletonBadge} />
      </View>
      <View style={styles.skeletonMetrics}>
        {Array.from({ length: 5 }, (_, index) => (
          <SkeletonBlock key={index} style={styles.skeletonMetric} />
        ))}
      </View>
    </View>
  );
});

export function MatchListSkeleton() {
  useSharedShimmerLoop();

  return (
    <View style={styles.skeletonList}>
      <SkeletonBlock style={styles.skeletonDay} />
      {Array.from({ length: 4 }, (_, index) => (
        <MatchCardSkeleton key={index} />
      ))}
    </View>
  );
}

export function MatchDetailSkeleton() {
  useSharedShimmerLoop();

  return (
    <View style={styles.detailSkeleton} accessibilityLabel="Loading match details">
      <View style={styles.detailHeaderSkeleton}>
        <SkeletonBlock style={styles.detailModeSkeleton} />
        <SkeletonBlock style={styles.detailMapSkeleton} />
        <SkeletonBlock style={styles.detailMetaSkeleton} />
      </View>
      <View style={styles.detailTabsSkeleton}>
        <SkeletonBlock style={styles.detailTabSkeleton} />
        <SkeletonBlock style={styles.detailTabSkeleton} />
      </View>
      <View style={styles.detailBodySkeleton}>
        <SkeletonBlock style={styles.detailChartSkeleton} />
        {Array.from({ length: 7 }, (_, index) => (
          <SkeletonBlock key={index} style={styles.detailRowSkeleton} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  statePanel: {
    minHeight: 260,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: MATCH_SPACING.xxl,
    paddingVertical: MATCH_SPACING.xxxl,
  },
  stateTitle: {
    marginTop: MATCH_SPACING.md,
    color: MATCH_COLORS.textPrimary,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  stateBody: {
    maxWidth: 320,
    marginTop: MATCH_SPACING.sm,
    color: MATCH_COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  stateActions: {
    flexDirection: "row",
    gap: MATCH_SPACING.sm,
    marginTop: MATCH_SPACING.xl,
  },
  primaryButton: {
    minHeight: MATCH_LAYOUT.minTouchTarget,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: MATCH_SPACING.sm,
    paddingHorizontal: MATCH_SPACING.lg,
    borderRadius: MATCH_RADIUS.medium,
    backgroundColor: MATCH_COLORS.tabIndicator,
  },
  secondaryButton: {
    minHeight: MATCH_LAYOUT.minTouchTarget,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: MATCH_SPACING.sm,
    paddingHorizontal: MATCH_SPACING.lg,
    borderRadius: MATCH_RADIUS.medium,
    borderWidth: 1,
    borderColor: MATCH_COLORS.border,
    backgroundColor: MATCH_COLORS.surfaceElevated,
  },
  buttonPressed: {
    opacity: 0.75,
  },
  primaryButtonText: {
    color: MATCH_COLORS.textPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
  secondaryButtonText: {
    color: MATCH_COLORS.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  skeletonList: {
    gap: MATCH_SPACING.md,
  },
  skeletonBlock: {
    backgroundColor: MATCH_COLORS.skeleton,
    opacity: 0.82,
  },
  skeletonDay: {
    width: "100%",
    height: 112,
    borderRadius: MATCH_RADIUS.card,
  },
  skeletonCard: {
    minHeight: 158,
    padding: MATCH_SPACING.md,
    borderRadius: MATCH_RADIUS.card,
    borderWidth: 1,
    borderColor: MATCH_COLORS.divider,
    backgroundColor: MATCH_COLORS.surface,
  },
  skeletonTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: MATCH_SPACING.md,
  },
  skeletonAvatar: {
    width: 50,
    height: 50,
    borderRadius: MATCH_RADIUS.medium,
  },
  skeletonMain: {
    flex: 1,
    gap: MATCH_SPACING.sm,
  },
  skeletonShortLine: {
    width: "44%",
    height: 8,
    borderRadius: 4,
  },
  skeletonScore: {
    width: "60%",
    height: 22,
    borderRadius: 4,
  },
  skeletonLongLine: {
    width: "78%",
    height: 10,
    borderRadius: 4,
  },
  skeletonBadge: {
    width: 46,
    height: 32,
    borderRadius: MATCH_RADIUS.medium,
  },
  skeletonMetrics: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: MATCH_SPACING.xl,
  },
  skeletonMetric: {
    width: "15%",
    height: 24,
    borderRadius: 4,
  },
  detailSkeleton: {
    flex: 1,
    backgroundColor: MATCH_COLORS.appBackground,
  },
  detailHeaderSkeleton: {
    height: 150,
    justifyContent: "center",
    gap: MATCH_SPACING.sm,
    paddingHorizontal: MATCH_SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: MATCH_COLORS.border,
    backgroundColor: MATCH_COLORS.surface,
  },
  detailModeSkeleton: {
    width: 92,
    height: 9,
    borderRadius: 4,
  },
  detailMapSkeleton: {
    width: 150,
    height: 30,
    borderRadius: 4,
  },
  detailMetaSkeleton: {
    width: 210,
    height: 11,
    borderRadius: 4,
  },
  detailTabsSkeleton: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderBottomWidth: 1,
    borderBottomColor: MATCH_COLORS.border,
  },
  detailTabSkeleton: {
    width: "34%",
    height: 10,
    borderRadius: 4,
  },
  detailBodySkeleton: {
    gap: MATCH_SPACING.sm,
    padding: MATCH_SPACING.lg,
  },
  detailChartSkeleton: {
    width: "100%",
    height: 210,
    borderRadius: MATCH_RADIUS.card,
  },
  detailRowSkeleton: {
    width: "100%",
    height: MATCH_LAYOUT.scoreboardRowHeight,
    borderRadius: MATCH_RADIUS.medium,
  },
});
