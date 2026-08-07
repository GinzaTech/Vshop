import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  interpolate,
  interpolateColor,
  SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

import { CachedImage as Image } from "~/components/CachedImage";
import { COLORS } from "~/constants/DesignSystem";

export type RankSplitStat = {
  key: string;
  label: string;
  value: string;
  icon: React.ComponentProps<typeof Icon>["name"];
};

type RankSplitGroupProps = {
  splitProgress: SharedValue<number>;
  rankLabel: string;
  rankValue: string;
  rankIconUrl?: string | null;
  rankIconCacheId?: string;
  stats: [RankSplitStat, RankSplitStat];
};

function RankSplitGroup({
  splitProgress,
  rankLabel,
  rankValue,
  rankIconUrl,
  rankIconCacheId,
  stats,
}: RankSplitGroupProps) {
  const surfaceAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      splitProgress.value,
      [0, 1],
      ["rgba(255,255,255,0.06)", "rgba(255,70,85,0.08)"]
    ),
    borderColor: interpolateColor(
      splitProgress.value,
      [0, 1],
      ["rgba(255,255,255,0)", "rgba(255,70,85,0.18)"]
    ),
  }));
  const leftSurfaceAnimatedStyle = useAnimatedStyle(() => ({
    borderTopRightRadius: interpolate(splitProgress.value, [0, 1], [0, 16]),
    borderBottomRightRadius: interpolate(splitProgress.value, [0, 1], [0, 16]),
  }));
  const rightSurfaceAnimatedStyle = useAnimatedStyle(() => ({
    borderTopLeftRadius: interpolate(splitProgress.value, [0, 1], [0, 16]),
    borderBottomLeftRadius: interpolate(splitProgress.value, [0, 1], [0, 16]),
  }));
  const dividerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: splitProgress.value,
  }));
  const rankContentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(splitProgress.value, [0, 0.35, 1], [1, 0, 0]),
    transform: [
      {
        scaleX: interpolate(splitProgress.value, [0, 1], [1, 0.9]),
      },
    ],
  }));
  const actContentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(splitProgress.value, [0, 0.72, 1], [0, 0, 1]),
    transform: [
      {
        scaleX: interpolate(splitProgress.value, [0, 1], [0.9, 1]),
      },
    ],
  }));

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={styles.surfaces}>
        <Animated.View
          style={[
            styles.surface,
            styles.leftSurface,
            surfaceAnimatedStyle,
            leftSurfaceAnimatedStyle,
          ]}
        />
        <Animated.View
          style={[
            styles.surface,
            styles.rightSurface,
            surfaceAnimatedStyle,
            rightSurfaceAnimatedStyle,
          ]}
        />
        <Animated.View style={[styles.splitDivider, dividerAnimatedStyle]} />
      </View>

      <Animated.View
        pointerEvents="none"
        style={[styles.rankContent, rankContentAnimatedStyle]}
      >
        <Text style={styles.rankLabel}>{rankLabel}</Text>
        <View style={styles.rankValueRow}>
          {rankIconUrl ? (
            <Image
              cacheId={rankIconCacheId}
              source={{ uri: rankIconUrl }}
              style={styles.rankIcon}
              contentFit="contain"
              cachePolicy="memory-disk"
              priority="normal"
              recyclingKey={rankIconUrl}
            />
          ) : (
            <Icon
              name="shield-outline"
              size={18}
              color="rgba(255,255,255,0.6)"
            />
          )}
          <Text style={styles.rankValue}>{rankValue}</Text>
        </View>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[styles.actContent, actContentAnimatedStyle]}
      >
        {stats.map((stat) => (
          <View key={stat.key} style={styles.actCell}>
            <View style={styles.actLabelRow}>
              <Icon name={stat.icon} size={11} color="#ff4655" />
              <Text
                style={[
                  styles.actLabel,
                  stat.label.length > 8 && styles.actLabelCompact,
                ]}
              >
                {stat.label}
              </Text>
            </View>
            <Text style={styles.actValue}>{stat.value}</Text>
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    flex: 1,
    minWidth: 0,
    height: 64,
  },
  surfaces: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
  },
  splitDivider: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "50%",
    width: 7,
    marginLeft: -3.5,
    backgroundColor: "#1a1d24",
  },
  surface: {
    flex: 1,
    borderWidth: 1,
  },
  leftSurface: {
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  rightSurface: {
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
  },
  rankContent: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  rankLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.72)",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  rankValueRow: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  rankIcon: {
    width: 22,
    height: 22,
  },
  rankValue: {
    flexShrink: 1,
    marginLeft: 8,
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.PURE_WHITE,
  },
  actContent: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    gap: 7,
  },
  actCell: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    paddingHorizontal: 5,
    paddingVertical: 7,
  },
  actLabelRow: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  actLabel: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    marginLeft: 4,
    fontSize: 9,
    fontWeight: "800",
    color: "rgba(255,255,255,0.78)",
    textTransform: "uppercase",
  },
  actLabelCompact: {
    marginLeft: 3,
    fontSize: 7.5,
    letterSpacing: -0.2,
  },
  actValue: {
    marginTop: 5,
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.PURE_WHITE,
  },
});

export default React.memo(RankSplitGroup);
