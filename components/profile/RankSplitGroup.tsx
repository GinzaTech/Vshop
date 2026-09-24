// ===== RankSplitGroup.tsx =====
// Khối rank trên header profile với animation "tách" bề mặt: từ một pill
// rank liền khối tách thành 2 ô hiển thị act stats. Toàn bộ chuyển động
// điều khiển bởi shared value splitProgress (0 = rank, 1 = act). Chi tiết
// style xem doc của `styles` ở cuối file.
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  interpolate,
  SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";

import { CachedImage as Image } from "~/components/CachedImage";
import TypewriterSwapText from "~/components/profile/TypewriterSwapText";
import AppIcon from "~/components/ui/AppIcon";
import {
  resolveAppIconName,
  type AppIconName,
} from "~/components/ui/app-icon-registry";
import { COLORS } from "~/constants/DesignSystem";

/**
 * RankSplitContentMode – Chế độ nội dung hiển thị:
 * - "rank": rank hiện tại | - "blank": rỗng (đang chuyển) | - "act": act stats.
 */
export type RankSplitContentMode = "rank" | "blank" | "act";

// Compatibility adapter for the four values still produced by the feature
// data hook outside this component slice. Every other runtime value is routed
// through resolveAppIconName and therefore fails closed to `unknown`.
const RANK_SPLIT_LEGACY_ICON_MAP = {
  "close-octagon-outline": "error",
  "percent-outline": "chartLine",
  "shield-check-outline": "shield",
  "trophy-outline": "peakRank",
} as const satisfies Record<string, AppIconName>;

type RankSplitLegacyIconName = keyof typeof RANK_SPLIT_LEGACY_ICON_MAP;

function resolveRankSplitIconName(value: unknown): AppIconName {
  if (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(RANK_SPLIT_LEGACY_ICON_MAP, value)
  ) {
    return RANK_SPLIT_LEGACY_ICON_MAP[value as RankSplitLegacyIconName];
  }

  return resolveAppIconName(value);
}

/**
 * RankSplitStat – Một ô chỉ số act: key (keyExtractor), nhãn, giá trị, icon.
 */
export type RankSplitStat = {
  key: string;
  label: string;
  value: string;
  icon: AppIconName | RankSplitLegacyIconName;
};

/**
 * RankSplitGroupProps – Props của RankSplitGroup.
 *
 * @param splitProgress – SharedValue 0..1: 0 hiển thị rank, 1 hiển thị act
 *                        stats; mọi style animation interpolate từ value này.
 * @param contentMode – Chế độ nội dung (xem RankSplitContentMode).
 * @param rankLabel – Nhãn trên (VD: "CURRENT RANK").
 * @param rankValue – Giá trị rank (VD: "Immortal 2").
 * @param rankIconUrl – (tuỳ chọn) URL icon rank; thiếu → icon shield fallback.
 * @param rankIconCacheId – (tuỳ chọn) Cache key cho ảnh rank.
 * @param stats – Cặp chỉ số act hiển thị khi contentMode = "act".
 */
type RankSplitGroupProps = {
  animateText: boolean;
  splitProgress: SharedValue<number>;
  contentMode: RankSplitContentMode;
  rankLabel: string;
  rankValue: string;
  rankIconUrl?: string | null;
  rankIconCacheId?: string;
  stats: [RankSplitStat, RankSplitStat];
};

/**
 * RankSplitGroup – Khối rank/act với animation tách bề mặt (export memo hoá).
 * Cấu trúc lớp: mergedSurface (pill liền khi progress=0), 2 surface trái/phải
 * (bo góc + nền đỏ nhạt dần khi tách), nội dung rank (fade + co scaleX) và
 * nội dung act stats (fade in muộn hơn, typewriter từng ký tự).
 *
 * @param splitProgress – SharedValue điều khiển toàn bộ animation.
 * @param contentMode – Chế độ nội dung hiện tại.
 * @param rankLabel – Nhãn rank.
 * @param rankValue – Giá trị rank.
 * @param rankIconUrl – URL icon rank (tuỳ chọn).
 * @param rankIconCacheId – Cache key ảnh rank (tuỳ chọn).
 * @param stats – Hai chỉ số act.
 * @returns View chứa các lớp surface + nội dung rank/act.
 *
 * Side effects: các animated style chạy trên UI thread theo splitProgress;
 * TypewriterSwapText nội bộ tự quản timer/animation riêng. Không có
 * timer/subscription trực tiếp trong component này.
 */
function RankSplitGroup({
  animateText,
  splitProgress,
  contentMode,
  rankLabel,
  rankValue,
  rankIconUrl,
  rankIconCacheId,
  stats,
}: RankSplitGroupProps) {
  // === Animated styles (đều chạy trên UI thread theo splitProgress) ===
  // mergedSurfaceAnimatedStyle: pill liền mờ đi ngay khi bắt đầu tách
  const mergedSurfaceAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      splitProgress.value,
      [0, 0.02, 0.04, 1],
      [1, 1, 0, 0]
    ),
  }));
  // Hai surface giữ sẵn paint/layout và chỉ tách bằng transform + opacity.
  const leftSurfaceAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      splitProgress.value,
      [0, 0.02, 0.04, 1],
      [0, 0, 1, 1]
    ),
    transform: [
      { translateX: interpolate(splitProgress.value, [0, 1], [3.5, 0]) },
      { scaleX: interpolate(splitProgress.value, [0, 1], [0.98, 1]) },
    ],
  }));
  const rightSurfaceAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      splitProgress.value,
      [0, 0.02, 0.04, 1],
      [0, 0, 1, 1]
    ),
    transform: [
      { translateX: interpolate(splitProgress.value, [0, 1], [-3.5, 0]) },
      { scaleX: interpolate(splitProgress.value, [0, 1], [0.98, 1]) },
    ],
  }));
  // rankContentAnimatedStyle: nội dung rank fade out + co nhẹ khi tách
  const rankContentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(splitProgress.value, [0, 0.35, 1], [1, 0, 0]),
    transform: [
      {
        scaleX: interpolate(splitProgress.value, [0, 1], [1, 0.9]),
      },
    ],
  }));
  // actContentAnimatedStyle: nội dung act fade in muộn (0.72) + giãn scaleX
  const actContentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(splitProgress.value, [0, 0.72, 1], [0, 0, 1]),
    transform: [
      {
        scaleX: interpolate(splitProgress.value, [0, 1], [0.9, 1]),
      },
    ],
  }));

  // Text rank chỉ hiển thị khi contentMode = "rank"; act stats khi = "act"
  const rankTextTarget = contentMode === "rank" ? rankValue : "";
  const rankLabelTarget = contentMode === "rank" ? rankLabel : "";
  const actStatsVisible = contentMode === "act";

  if (contentMode === "rank") {
    return (
      <View style={styles.container}>
        <View pointerEvents="none" style={styles.mergedSurface} />
        <View style={styles.staticRankContent}>
          <Text numberOfLines={1} style={styles.rankLabel}>
            {rankLabel}
          </Text>
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
              <AppIcon
                color="rgba(255,255,255,0.6)"
                decorative
                name="shield"
                size={18}
              />
            )}
            <Text numberOfLines={1} style={styles.rankValue}>
              {rankValue}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View
        pointerEvents="none"
        style={[styles.mergedSurface, mergedSurfaceAnimatedStyle]}
      />
      <View pointerEvents="none" style={styles.surfaces}>
        <Animated.View
          style={[
            styles.surface,
            styles.leftSurface,
            leftSurfaceAnimatedStyle,
          ]}
        />
        <Animated.View
          style={[
            styles.surface,
            styles.rightSurface,
            rightSurfaceAnimatedStyle,
          ]}
        />
      </View>

      <Animated.View
        pointerEvents="none"
        style={[styles.rankContent, rankContentAnimatedStyle]}
      >
        <TypewriterSwapText
          animate={animateText}
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
            <AppIcon
              color="rgba(255,255,255,0.6)"
              decorative
              name="shield"
              size={18}
            />
          )}
          <TypewriterSwapText
            animate={animateText}
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
              <AppIcon
                color="#ff4655"
                decorative
                name={resolveRankSplitIconName(stat.icon)}
                size={11}
              />
              <TypewriterSwapText
                animate={animateText}
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
              animate={animateText}
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

/**
 * styles: giao diện các lớp của RankSplitGroup.
 *   container: khối 64px cao, relative để các lớp absoluteFill chồng nhau.
 *   surfaces/mergedSurface/surface: các lớp nền pill và 2 nửa surface.
 *   rankContent/rankLabel/rankValueRow/rankIcon/rankValue: nội dung rank.
 *   actContent/actCell/actLabelRow/actLabel/actValue: nội dung act stats
 *   (label > 8 ký tự dùng actLabelCompact co chữ lại cho vừa ô).
 */
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
    gap: 7,
  },
  mergedSurface: {
    ...StyleSheet.absoluteFill,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  surface: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(255,70,85,0.18)",
    backgroundColor: "rgba(255,70,85,0.08)",
  },
  leftSurface: {
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
  },
  rightSurface: {
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  rankContent: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  staticRankContent: {
    flex: 1,
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
