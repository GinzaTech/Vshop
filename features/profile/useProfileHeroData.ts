import React from "react";
import { type RankSplitStat } from "~/components/profile/RankSplitGroup";
import { CATEGORY_ORDER } from "~/components/GalleryProfile";
import { COLORS } from "~/constants/DesignSystem";
import { formatOneDecimal, formatPercentage } from "~/features/profile/profile-loadout";
import type { useProfileSession } from "./useProfileSession";
import type { useProfileState } from "./useProfileState";

type Props = Pick<ReturnType<typeof useProfileSession>, "colors" | "user" | "t" | "dashboardSeasonStats"> &
Pick<ReturnType<typeof useProfileState>, "competitiveRank">;

export function useProfileHeroData({ colors, user, t, dashboardSeasonStats, competitiveRank }: Props) {


  // ─── Palette màu (tính toán từ theme) ─────────────────────────────────────
  const palette = React.useMemo(
      () => {
        const accent = colors?.primary ?? COLORS.PURE_BLACK;

        return {
          accent,
          background: colors?.background ?? COLORS.BACKGROUND,
          card: COLORS.SURFACE,
          cardBorder: COLORS.BORDER,
          chipBackground: COLORS.SURFACE_MUTED,
          textPrimary: colors?.onSurface ?? COLORS.TEXT_PRIMARY,
          textSecondary: COLORS.TEXT_SECONDARY,
        };
      },
      [colors]
  );
  const regionLabel = user.region ? user.region.toUpperCase() : "VAL";

  // ─── profileStats: các thông số hiển thị trong hero card ─────────────────
  const profileStats = React.useMemo(
      () => [
        { key: "vp", label: t("vp"), value: user.balances.vp, icon: "vp" as const },
        { key: "rad", label: t("rad"), value: user.balances.rad, icon: "rad" as const },
        { key: "kc", label: t("kc"), value: user.balances.kc, icon: "kc" as const },
      ],
      [t, user.balances.kc, user.balances.rad, user.balances.vp]
  );
  // playerPerformanceStats: HS/KD/ACS trung bình act (từ seasonStats khớp authKey).
  const playerPerformanceStats = React.useMemo(() => {
    const seasonStats = dashboardSeasonStats;

    if (!seasonStats || seasonStats.matchCount === 0) {
      return [
        { key: "hs", label: "HS TB", value: "--", icon: "target-account" as const },
        { key: "kd", label: "K/D TB", value: "--", icon: "sword-cross" as const },
        { key: "acs", label: "ACS TB", value: "--", icon: "speedometer" as const },
      ];
    }

    const averageHeadshot =
        seasonStats.headshotPercent !== null
            ? formatPercentage(seasonStats.headshotPercent)
            : "--";
    const averageKd =
        seasonStats.kd !== null
            ? formatOneDecimal(seasonStats.kd)
            : "--";
    const averageAcs =
        seasonStats.acs !== null ? Math.round(seasonStats.acs).toString() : "--";

    return [
      {
        key: "hs",
        label: "HS TB",
        value: averageHeadshot,
        icon: "target-account" as const,
      },
      {
        key: "kd",
        label: "K/D TB",
        value: averageKd,
        icon: "sword-cross" as const,
      },
      {
        key: "acs",
        label: "ACS TB",
        value: averageAcs,
        icon: "speedometer" as const,
      },
    ];
  }, [dashboardSeasonStats]);
  // actRankSummaryStats: trái = thắng/thua act; phải = KAST + tỉ lệ thắng act.
  const actRankSummaryStats = React.useMemo(() => {
    const seasonStats = dashboardSeasonStats;
    const hasPerformanceStats = Boolean(
        seasonStats &&
        seasonStats.calculationVersion >= 6 &&
        seasonStats.matchCount > 0
    );
    const hasActRecord = Boolean(
        competitiveRank?.actWins !== null &&
        competitiveRank?.actWins !== undefined &&
        competitiveRank?.actLosses !== null &&
        competitiveRank?.actLosses !== undefined &&
        competitiveRank?.actGames
    );
    const actWinRate =
        hasActRecord && competitiveRank?.actGames
        ? ((competitiveRank?.actWins ?? 0) /
            competitiveRank.actGames) *
          100
        : null;
    const left: [RankSplitStat, RankSplitStat] = [
      {
        key: "wins",
        label: t("profile_page.act_wins", { defaultValue: "Thắng" }),
        value: hasActRecord ? String(competitiveRank?.actWins ?? 0) : "--",
        icon: "trophy-outline",
      },
      {
        key: "losses",
        label: t("profile_page.act_losses", { defaultValue: "Thua" }),
        value: hasActRecord ? String(competitiveRank?.actLosses ?? 0) : "--",
        icon: "close-octagon-outline",
      },
    ];
    const right: [RankSplitStat, RankSplitStat] = [
      {
        key: "kast",
        label: "KAST",
        value:
            hasPerformanceStats && seasonStats?.kast !== null
                ? formatPercentage(seasonStats?.kast ?? 0)
                : "--",
        icon: "shield-check-outline",
      },
      {
        key: "win-rate",
        label: t("profile_page.act_win_rate", {
          defaultValue: "Tỉ lệ thắng",
        }),
        value:
            actWinRate !== null
                ? formatPercentage(actWinRate)
                : "--",
        icon: "percent-outline",
      },
    ];

    return { left, right };
  }, [competitiveRank, dashboardSeasonStats, t]);

  // ─── tabItems: các tab cho segmented control ──────────────────────────────
  const tabItems = React.useMemo(
      () => [
        { value: "loadout" as const, label: t("equip_page.tabs.loadout") },
        { value: "skins" as const, label: t("equip_page.tabs.skins") },
        { value: "collection" as const, label: t("equip_page.tabs.collection") },
      ],
      [t]
  );

  // ─── categoryLabels: map category → tên đã dịch ──────────────────────────
  const categoryLabels = React.useMemo(
      () =>
          CATEGORY_ORDER.reduce<Record<string, string>>((labels, category) => {
            const translationKey = `equip_page.categories.${category}`;
            const translated = t(translationKey);
            labels[category] = translated !== translationKey ? translated : category;
            return labels;
          }, {}),
      [t]
  );

  /**
   * formatCategoryLabel — Lấy tên hiển thị cho category vũ khí (đã dịch).
   * Nếu không có bản dịch, tự động format camelCase/snake_case thành text thường.
   */
  const formatCategoryLabel = React.useCallback(
      (category: string) => {
        if (categoryLabels[category]) {
          return categoryLabels[category];
        }

        const translationKey = `equip_page.categories.${category}`;
        const translated = t(translationKey);
        if (translated !== translationKey) {
          return translated;
        }

        return category
            .replace(/([a-z])([A-Z])/g, "$1 $2")
            .replace(/[_-]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();
      },
      [categoryLabels, t]
  );
  return { palette, regionLabel, profileStats, playerPerformanceStats, actRankSummaryStats, tabItems, formatCategoryLabel };
}
