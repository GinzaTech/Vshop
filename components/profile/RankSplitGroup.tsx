import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  interpolate,
  interpolateColor,
  SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

import { CachedImage as Image } from "~/components/CachedImage";
import TypewriterSwapText from "~/components/profile/TypewriterSwapText";
import { COLORS } from "~/constants/DesignSystem";

export type RankSplitContentMode = "rank" | "blank" | "act";

export type RankSplitStat = {
  key: string;
  label: string;
  value: string;
  icon: React.ComponentProps<typeof Icon>["name"];
};

type RankSplitGroupProps = {
  splitProgress: SharedValue<number>;
  contentMode: RankSplitContentMode;
  rankLabel: string;
  rankValue: string;
  rankIconUrl?: string | null;
  rankIconCacheId?: string;
  stats: [RankSplitStat, RankSplitStat];
};

function RankSplitGroup({
  splitProgress,
  contentMode,
  rankLabel,
  rankValue,
  rankIconUrl,
  rankIconCacheId,
  stats,
}: RankSplitGroupProps) {
  const surfacesAnimatedStyle = useAnimatedStyle(() => ({
    gap: interpolate(splitProgress.value, [0, 1], [0, 7]),
  }));
  const mergedSurfaceAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      splitProgress.value,
      [0, 0.02, 0.04, 1],
      [1, 1, 0, 0]
    ),
  }));
  const surfaceAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      splitProgress.value,
      [0, 0.02, 0.04, 1],
      [0, 0, 1, 1]
    ),
    borderWidth: interpolate(splitProgress.value, [0, 1], [0, 1]),
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

  const rankTextTarget = contentMode === "rank" ? rankValue : "";
  const rankLabelTarget = contentMode === "rank" ? rankLabel : "";
  const actStatsVisible = contentMode === "act";

  return (
    <View style={styles.container}>
      <Animated.View
        pointerEvents="none"
        style={[styles.mergedSurface, mergedSurfaceAnimatedStyle]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.surfaces, surfacesAnimatedStyle]}
      >
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
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[styles.rankContent, rankContentAnimatedStyle]}
      >
        <TypewriterSwapText
          text={rankLabelTarget}
          showCursor={false}
          typingSpeed={34}
          deletingSpeed={22}
          initialDelay={60}
          style={styles.rankLabel}
        />
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
          <TypewriterSwapText
            text={rankTextTarget}
            showCursor={false}
            typingSpeed={34}
            deletingSpeed={22}
            initialDelay={60}
            style={styles.rankValue}
          />
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
              <TypewriterSwapText
                text={actStatsVisible ? stat.label : ""}
                showCursor={false}
                typingSpeed={34}
                deletingSpeed={20}
                initialDelay={55}
                style={[
                  styles.actLabel,
                  stat.label.length > 8 && styles.actLabelCompact,
                ]}
              />
            </View>
            <TypewriterSwapText
              text={actStatsVisible ? stat.value : ""}
              showCursor={false}
              typingSpeed={36}
              deletingSpeed={20}
              initialDelay={55}
              style={styles.actValue}
            />
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
    ...StyleSheet.absoluteFill,
    flexDirection: "row",
  },
  mergedSurface: {
    ...StyleSheet.absoluteFill,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  surface: {
    flex: 1,
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
    ...StyleSheet.absoluteFill,
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
    ...StyleSheet.absoluteFill,
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
    fontWeight: "700",
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
    fontWeight: "700",
    color: COLORS.PURE_WHITE,
  },
});

export default React.memo(RankSplitGroup);
