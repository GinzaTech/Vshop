import React from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";

import { MatchImage } from "~/components/matches/MatchImage";
import {
  MATCH_COLORS,
  MATCH_RADIUS,
  MATCH_SPACING,
} from "~/constants/MatchTheme";
import type { PlayerPerformanceSummary as PlayerSummary } from "~/types/match-ui";
import { formatMetric } from "~/utils/match-ui";

type PlayerPerformanceSummaryProps = {
  summary: PlayerSummary;
};

export const PlayerPerformanceSummary = React.memo(
  function PlayerPerformanceSummary({ summary }: PlayerPerformanceSummaryProps) {
    const { t } = useTranslation();
    const { width } = useWindowDimensions();
    const compact = width <= 380;
    const metrics = [
      [t("match_ui.performance.avg_score"), formatMetric(summary.averageScore)],
      ["K / D / A", `${summary.kills} / ${summary.deaths} / ${summary.assists}`],
      ["K/D", formatMetric(summary.kd, 2)],
      ["ADR", formatMetric(summary.adr)],
    ] as const;

    return (
      <View style={styles.section}>
        <View style={[styles.artworkShell, compact && styles.artworkShellCompact]}>
          <MatchImage
            uri={summary.agentFullImageUrl}
            cacheId={`agent:${summary.playerId}:full-portrait`}
            style={[styles.artwork, compact && styles.artworkCompact]}
            icon="account-outline"
            iconSize={40}
            contentFit="cover"
          />
        </View>
        <View style={styles.content}>
          <Text style={[styles.playerName, compact && styles.playerNameCompact]} numberOfLines={1}>
            {summary.playerName}
          </Text>
          <View style={styles.rankRow}>
            <MatchImage
              uri={summary.rankIconUrl}
              cacheId={`rank:${summary.rankName}:performance`}
              style={styles.rankIcon}
              icon="shield-outline"
              iconSize={14}
              contentFit="contain"
            />
            <Text style={styles.rankName} numberOfLines={1}>
              {summary.rankName}
            </Text>
          </View>
          <View style={styles.metricsGrid}>
            {metrics.map(([label, value]) => (
              <View key={label} style={styles.metric}>
                <Text style={styles.metricLabel} numberOfLines={1}>
                  {label}
                </Text>
                <Text style={styles.metricValue} numberOfLines={1}>
                  {value}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  section: {
    minHeight: 210,
    flexDirection: "row",
    alignItems: "stretch",
    paddingHorizontal: MATCH_SPACING.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: MATCH_COLORS.divider,
    backgroundColor: MATCH_COLORS.surface,
    overflow: "hidden",
  },
  artworkShell: {
    width: 142,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  artworkShellCompact: {
    width: 118,
  },
  artwork: {
    width: 158,
    height: 208,
  },
  artworkCompact: {
    width: 132,
    height: 198,
  },
  content: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    paddingVertical: MATCH_SPACING.lg,
  },
  playerName: {
    color: MATCH_COLORS.textPrimary,
    fontSize: 24,
    fontWeight: "900",
  },
  playerNameCompact: {
    fontSize: 21,
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: MATCH_SPACING.xs,
    marginTop: MATCH_SPACING.xs,
  },
  rankIcon: {
    width: 24,
    height: 24,
    borderRadius: MATCH_RADIUS.small,
  },
  rankName: {
    flexShrink: 1,
    color: MATCH_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: MATCH_SPACING.md,
  },
  metric: {
    width: "50%",
    minHeight: 52,
    justifyContent: "center",
    paddingRight: MATCH_SPACING.sm,
  },
  metricLabel: {
    color: MATCH_COLORS.textMuted,
    fontSize: 10,
    fontWeight: "700",
  },
  metricValue: {
    marginTop: 2,
    color: MATCH_COLORS.textPrimary,
    fontSize: 17,
    fontWeight: "900",
  },
});
