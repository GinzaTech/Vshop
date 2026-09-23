// ===== ProfileHeroCard.tsx – Hero biến hình giữa hồ sơ trang bị và thông tin =====
// Hai trạng thái dùng chung một bề mặt: nội dung trang bị tách/mờ khi card co,
// sau đó nội dung hồ sơ ngang xuất hiện. Chiều quay về chạy ngược tự nhiên.

import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import React from "react";
import { LayoutChangeEvent, Pressable, Text, View } from "react-native";
import Animated, {
  interpolate,
  interpolateColor,
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import CurrencyIcon from "~/components/CurrencyIcon";
import type { IdentityDetails } from "~/components/GalleryProfile";
import { CompactPlayerProfileCard } from "~/components/profile/CompactPlayerProfileCard";
import RankSplitGroup, {
  type RankSplitContentMode,
  type RankSplitStat,
} from "~/components/profile/RankSplitGroup";
import TypewriterSwapText from "~/components/profile/TypewriterSwapText";
import { COLORS } from "~/constants/DesignSystem";
import { styles } from "~/features/profile/profile-screen.styles";
import {
  PROFILE_HERO_COMPACT_HEIGHT,
  PROFILE_HERO_EXPANDED_FALLBACK_HEIGHT,
} from "~/features/profile/profile-transition";
import type { CompetitiveRankSummary } from "~/utils/profile-cache";

type BalanceStat = {
  icon: "vp" | "rad" | "kc";
  key: string;
  label: string;
  value: number;
};

type ProfileHeroCardProps = {
  accountLevel: number;
  actRankSummaryStats: {
    left: [RankSplitStat, RankSplitStat];
    right: [RankSplitStat, RankSplitStat];
  };
  competitiveRank: CompetitiveRankSummary | null;
  expandedHeroHeight: SharedValue<number>;
  hasAuth: boolean;
  heroModeProgress: SharedValue<number>;
  identityDetails: IdentityDetails | null;
  isPlayerInfoMode: boolean;
  name: string;
  onRegionPress: () => void;
  onToggleMode: () => void;
  pageModeProgress: SharedValue<number>;
  profileModeTransitioning: boolean;
  profileStats: BalanceStat[];
  rankSplitContentMode: RankSplitContentMode;
  rankSplitProgress: SharedValue<number>;
  regionLabel: string;
  statsVisibilityProgress: SharedValue<number>;
  synced: boolean;
  tagLine: string;
};

/**
 * ProfileHeroCard – Bề mặt hero dùng chung cho hai chế độ Profile.
 * Mọi biến đổi hình học và opacity chạy bằng shared values trên UI thread.
 */
export function ProfileHeroCard({
  accountLevel,
  actRankSummaryStats,
  competitiveRank,
  expandedHeroHeight,
  hasAuth,
  heroModeProgress,
  identityDetails,
  isPlayerInfoMode,
  name,
  onRegionPress,
  onToggleMode,
  pageModeProgress,
  profileModeTransitioning,
  profileStats,
  rankSplitContentMode,
  rankSplitProgress,
  regionLabel,
  statsVisibilityProgress,
  synced,
  tagLine,
}: ProfileHeroCardProps) {
  const { t } = useTranslation();
  const [heroLayoutHeight, setHeroLayoutHeight] = React.useState(
    PROFILE_HERO_EXPANDED_FALLBACK_HEIGHT
  );

  const handleExpandedHeroLayout = React.useCallback(
    (event: LayoutChangeEvent) => {
      const measuredHeight = event.nativeEvent.layout.height;
      if (measuredHeight > PROFILE_HERO_COMPACT_HEIGHT) {
        expandedHeroHeight.value = measuredHeight;
        setHeroLayoutHeight((current) =>
          Math.abs(current - measuredHeight) > 0.5 ? measuredHeight : current
        );
      }
    },
    [expandedHeroHeight]
  );

  const cardMorphStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          pageModeProgress.value,
          [0, 0.46, 1],
          [1, 0.985, 1]
        ),
      },
    ],
  }));
  const expandedSurfaceStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pageModeProgress.value, [0, 0.58, 1], [1, 0, 0]),
    transform: [
      { scaleY: interpolate(pageModeProgress.value, [0, 1], [1, 0.94]) },
    ],
  }));
  const compactSurfaceStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pageModeProgress.value, [0, 0.42, 1], [0, 0, 1]),
    transform: [
      { scale: interpolate(pageModeProgress.value, [0, 1], [0.985, 1]) },
    ],
  }));
  const expandedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      pageModeProgress.value,
      [0, 0.12, 0.66, 1],
      [1, 1, 0, 0]
    ),
    transform: [
      { scale: interpolate(pageModeProgress.value, [0, 1], [1, 0.96]) },
      { translateY: interpolate(pageModeProgress.value, [0, 1], [0, -8]) },
    ],
  }));
  const compactStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      pageModeProgress.value,
      [0, 0.5, 0.72, 1],
      [0, 0, 0.45, 1]
    ),
    transform: [
      {
        scale: interpolate(
          pageModeProgress.value,
          [0, 0.56, 1],
          [0.96, 0.96, 1]
        ),
      },
      { translateY: interpolate(pageModeProgress.value, [0, 1], [8, 0]) },
    ],
  }));
  const leftStatSplitStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(pageModeProgress.value, [0, 1], [0, -36]) },
    ],
  }));
  const centerStatSplitStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(pageModeProgress.value, [0, 1], [1, 0.82]) },
    ],
  }));
  const rightStatSplitStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(pageModeProgress.value, [0, 1], [0, 36]) },
    ],
  }));
  const leftRankSplitStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(pageModeProgress.value, [0, 1], [0, -48]) },
    ],
  }));
  const rightRankSplitStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(pageModeProgress.value, [0, 1], [0, 48]) },
    ],
  }));
  const modeToggleStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      heroModeProgress.value,
      [0, 1],
      ["rgba(48, 164, 108, 0.18)", "rgba(255, 70, 85, 0.22)"]
    ),
  }));
  const modeThumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(heroModeProgress.value, [0, 1], [0, 86]) },
    ],
  }));
  const modeLabelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      heroModeProgress.value,
      [0, 1],
      [COLORS.SUCCESS, COLORS.VALORANT_RED]
    ),
    transform: [
      { translateX: interpolate(heroModeProgress.value, [0, 1], [7, -7]) },
    ],
  }));
  const balanceStatsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(heroModeProgress.value, [0, 0.46, 1], [1, 0, 0]),
    transform: [
      { translateX: interpolate(heroModeProgress.value, [0, 1], [0, -5]) },
    ],
  }));
  const playerStatsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(heroModeProgress.value, [0, 0.54, 1], [0, 0, 1]),
    transform: [
      { translateX: interpolate(heroModeProgress.value, [0, 1], [5, 0]) },
    ],
  }));
  const statsVisibilityStyle = useAnimatedStyle(() => ({
    height: interpolate(statsVisibilityProgress.value, [0, 1], [0, 64]),
    marginTop: interpolate(statsVisibilityProgress.value, [0, 1], [0, 12]),
    opacity: statsVisibilityProgress.value,
    overflow: "hidden" as const,
  }));

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.heroCard, { height: heroLayoutHeight }, cardMorphStyle]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.heroSurface,
          styles.heroExpandedSurface,
          expandedSurfaceStyle,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.heroSurface,
          styles.heroCompactSurface,
          compactSurfaceStyle,
        ]}
      />
      <Animated.View
        accessibilityElementsHidden={isPlayerInfoMode}
        importantForAccessibility={
          isPlayerInfoMode ? "no-hide-descendants" : "auto"
        }
        onLayout={handleExpandedHeroLayout}
        pointerEvents={isPlayerInfoMode ? "none" : "auto"}
        style={[styles.heroExpandedLayer, expandedStyle]}
      >
        <View style={styles.heroTopRow}>
          <Animated.View style={[styles.heroModeToggle, modeToggleStyle]}>
            <Pressable
              accessibilityHint={t("profile_page.switch_info_hint")}
              accessibilityLabel={t("profile_page.player_info")}
              accessibilityRole="button"
              accessibilityState={{
                selected: isPlayerInfoMode,
                disabled: profileModeTransitioning,
                busy: profileModeTransitioning,
              }}
              disabled={profileModeTransitioning}
              onPress={onToggleMode}
              style={({ pressed }) => [
                styles.heroModePressTarget,
                pressed && !profileModeTransitioning && styles.heroModePressed,
              ]}
            >
              <Animated.View
                pointerEvents="none"
                style={[styles.heroModeThumb, modeThumbStyle]}
              >
                <Icon
                  color={COLORS.PURE_WHITE}
                  name={
                    isPlayerInfoMode
                      ? "chart-box-outline"
                      : "shield-account-outline"
                  }
                  size={14}
                />
              </Animated.View>
              <View pointerEvents="none" style={styles.heroModeLabelViewport}>
                <TypewriterSwapText
                  animate={!profileModeTransitioning}
                  charactersPerStep={1}
                  style={[styles.heroModeLabel, modeLabelStyle]}
                  text={
                    isPlayerInfoMode
                      ? t("profile_page.player_info")
                      : t("profile_page.hero_badge")
                  }
                />
              </View>
            </Pressable>
          </Animated.View>
          <Pressable
            accessibilityLabel={regionLabel}
            accessibilityRole="button"
            onPress={onRegionPress}
            style={({ pressed }) => [
              styles.heroRegionPill,
              { backgroundColor: "rgba(255,255,255,0.1)" },
              pressed && styles.heroModePressed,
            ]}
          >
            <Icon color={COLORS.PURE_WHITE} name="web" size={13} />
            <Text style={styles.heroRegionText}>{regionLabel}</Text>
          </Pressable>
        </View>

        <View style={styles.heroNameRow}>
          <Text style={styles.heroTitle}>{name}</Text>
          {tagLine ? (
            <View style={styles.heroTagPill}>
              <Text style={styles.heroTagText}>#{tagLine}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.heroMetaRow}>
          <View style={styles.heroMetaPill}>
            <Icon
              color="rgba(255,255,255,0.7)"
              name="star-circle-outline"
              size={13}
            />
            <Text style={styles.heroMetaText}>
              {t("profile_page.level", { level: accountLevel })}
            </Text>
          </View>
          <View style={styles.heroMetaPill}>
            <Icon
              color="rgba(255,255,255,0.7)"
              name={hasAuth ? "check-decagram-outline" : "alert-circle-outline"}
              size={13}
            />
            <Text style={styles.heroMetaText}>
              {hasAuth
                ? t("profile_page.account_synced")
                : t("profile_page.sign_in_required")}
            </Text>
          </View>
        </View>

        <Animated.View
          style={[styles.heroStatsViewport, statsVisibilityStyle]}
        >
          <View style={styles.heroStatsRow}>
            {profileStats.map((balanceStat, index) => {
              const visibleStat = balanceStat;
              const splitStyle =
                index === 0
                  ? leftStatSplitStyle
                  : index === 1
                    ? centerStatSplitStyle
                    : rightStatSplitStyle;

              return (
                <Animated.View
                  key={balanceStat.key}
                  style={[styles.heroStatCard, splitStyle]}
                >
                  <View style={styles.heroStatLabelRow}>
                    <View style={styles.heroStatIconViewport}>
                      <Animated.View
                        style={[styles.heroStatIconLayer, balanceStatsStyle]}
                      >
                        <CurrencyIcon
                          icon={balanceStat.icon}
                          style={styles.heroStatIcon}
                        />
                      </Animated.View>
                      <Animated.View
                        style={[styles.heroStatIconLayer, playerStatsStyle]}
                      >
                        <Icon
                          color={COLORS.VALORANT_RED}
                          name="chart-box-outline"
                          size={15}
                        />
                      </Animated.View>
                    </View>
                    <TypewriterSwapText
                      animate={!profileModeTransitioning}
                      deletingSpeed={22}
                      initialDelay={60}
                      showCursor={false}
                      style={[
                        styles.heroStatLabel,
                        isPlayerInfoMode && styles.playerStatLabel,
                      ]}
                      text={visibleStat.label}
                      typingSpeed={36}
                    />
                  </View>
                  <TypewriterSwapText
                    animate={!profileModeTransitioning}
                    deletingSpeed={20}
                    initialDelay={60}
                    showCursor={false}
                    style={styles.heroStatValue}
                    text={String(visibleStat.value)}
                    typingSpeed={34}
                  />
                </Animated.View>
              );
            })}
          </View>
        </Animated.View>

        <View style={styles.heroRankRow}>
          <Animated.View style={[styles.heroRankHalf, leftRankSplitStyle]}>
            <RankSplitGroup
              animateText={!profileModeTransitioning}
              contentMode={rankSplitContentMode}
              rankIconCacheId={
                competitiveRank?.currentTier
                  ? `rank:${competitiveRank.currentTier}:icon`
                  : undefined
              }
              rankIconUrl={competitiveRank?.currentIcon}
              rankLabel={t("profile_page.current_rank")}
              rankValue={
                competitiveRank?.currentName || t("profile_page.unrated")
              }
              splitProgress={rankSplitProgress}
              stats={actRankSummaryStats.left}
            />
          </Animated.View>
          <Animated.View style={[styles.heroRankHalf, rightRankSplitStyle]}>
            <RankSplitGroup
              animateText={!profileModeTransitioning}
              contentMode={rankSplitContentMode}
              rankIconCacheId={
                competitiveRank?.peakTier
                  ? `rank:${competitiveRank.peakTier}:icon`
                  : undefined
              }
              rankIconUrl={competitiveRank?.peakIcon}
              rankLabel={t("profile_page.peak_rank")}
              rankValue={
                competitiveRank?.peakName || t("profile_page.unrated")
              }
              splitProgress={rankSplitProgress}
              stats={actRankSummaryStats.right}
            />
          </Animated.View>
        </View>
      </Animated.View>

      <Animated.View
        accessibilityElementsHidden={!isPlayerInfoMode}
        importantForAccessibility={
          isPlayerInfoMode ? "auto" : "no-hide-descendants"
        }
        pointerEvents={isPlayerInfoMode ? "auto" : "none"}
        style={[styles.heroCompactLayer, compactStyle]}
      >
        <Pressable
          accessibilityHint={t("profile_page.switch_info_hint")}
          accessibilityLabel={t("profile_page.hero_badge")}
          accessibilityRole="button"
          accessibilityState={{
            selected: isPlayerInfoMode,
            disabled: profileModeTransitioning,
            busy: profileModeTransitioning,
          }}
          disabled={profileModeTransitioning}
          onPress={onToggleMode}
          style={({ pressed }) => [
            styles.heroCompactPressTarget,
            pressed && !profileModeTransitioning && styles.heroModePressed,
          ]}
        >
          <CompactPlayerProfileCard
            avatarCacheId={
              identityDetails?.cardId
                ? `player-card:${identityDetails.cardId}:avatar`
                : undefined
            }
            avatarUrl={identityDetails?.cardArt}
            level={accountLevel}
            name={name}
            regionLabel={regionLabel}
            synced={synced}
            tag={tagLine ? `#${tagLine.replace(/^#/, "")}` : ""}
          />
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}
