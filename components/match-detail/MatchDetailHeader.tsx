import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { MatchImage } from "~/components/matches/MatchImage";
import {
  MATCH_COLORS,
  MATCH_LAYOUT,
  MATCH_RADIUS,
  MATCH_SPACING,
} from "~/constants/MatchTheme";
import type { MatchDetailViewModel } from "~/types/match-ui";
import { formatDuration, humanizeMatchMode } from "~/utils/match-ui";

type MatchDetailHeaderProps = {
  match: MatchDetailViewModel["match"];
  locale: string;
  onClose: () => void;
};

export function MatchDetailHeader({
  match,
  locale,
  onClose,
}: MatchDetailHeaderProps) {
  const { t } = useTranslation();
  const startedAt = new Date(match.startedAt);
  const dateLabel = Number.isNaN(startedAt.getTime())
    ? "--"
    : startedAt.toLocaleString(locale, {
        month: "numeric",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

  return (
    <View style={styles.header}>
      {match.mapImageUrl ? (
        <MatchImage
          uri={match.mapImageUrl}
          cacheId={`map:${match.mapName}:match-detail-header`}
          style={StyleSheet.absoluteFill}
          icon="map-outline"
        />
      ) : null}
      <View style={styles.scrim} />
      <View style={styles.topRow}>
        <View style={styles.mapBlock}>
          <Text style={styles.mode} numberOfLines={1}>
            {humanizeMatchMode(match.mode)}
          </Text>
          <Text style={styles.mapName} numberOfLines={1}>
            {match.mapName}
          </Text>
        </View>

        <View style={styles.scoreBlock}>
          <View style={styles.teamScore}>
            <Text style={[styles.teamLabel, styles.teamALabel]}>
              {t("match_ui.teams.team_a")}
            </Text>
            <Text style={[styles.score, styles.teamAScore]}>
              {match.teamAScore}
            </Text>
          </View>
          <Text style={styles.scoreDivider}>:</Text>
          <View style={styles.teamScore}>
            <Text style={[styles.teamLabel, styles.teamBLabel]}>
              {t("match_ui.teams.team_b")}
            </Text>
            <Text style={[styles.score, styles.teamBScore]}>
              {match.teamBScore}
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("match_ui.actions.close_details")}
          hitSlop={8}
          onPress={onClose}
          style={({ pressed }) => [
            styles.closeButton,
            pressed && styles.closeButtonPressed,
          ]}
        >
          <Icon name="close" size={23} color={MATCH_COLORS.textPrimary} />
        </Pressable>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Icon name="calendar-blank-outline" size={15} color={MATCH_COLORS.textSecondary} />
          <Text style={styles.metaText} numberOfLines={1}>
            {dateLabel}
          </Text>
        </View>
        <View style={styles.metaItem}>
          <Icon name="clock-outline" size={15} color={MATCH_COLORS.textSecondary} />
          <Text style={styles.metaText}>{formatDuration(match.durationSeconds)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 150,
    justifyContent: "space-between",
    paddingHorizontal: MATCH_SPACING.lg,
    paddingTop: MATCH_SPACING.md,
    paddingBottom: MATCH_SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: MATCH_COLORS.border,
    backgroundColor: MATCH_COLORS.surface,
    overflow: "hidden",
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(16, 18, 22, 0.86)",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: MATCH_SPACING.sm,
  },
  mapBlock: {
    flex: 1,
    minWidth: 0,
    paddingTop: MATCH_SPACING.xs,
  },
  mode: {
    color: MATCH_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  mapName: {
    marginTop: 2,
    color: MATCH_COLORS.textPrimary,
    fontSize: 27,
    fontWeight: "900",
  },
  scoreBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: MATCH_SPACING.xs,
  },
  teamScore: {
    width: 42,
    alignItems: "center",
  },
  teamLabel: {
    fontSize: 9,
    fontWeight: "800",
  },
  teamALabel: {
    color: MATCH_COLORS.teamA,
  },
  teamBLabel: {
    color: MATCH_COLORS.teamB,
  },
  score: {
    marginTop: 2,
    fontSize: 30,
    fontWeight: "900",
  },
  teamAScore: {
    color: MATCH_COLORS.teamA,
  },
  teamBScore: {
    color: MATCH_COLORS.teamB,
  },
  scoreDivider: {
    paddingTop: 13,
    color: MATCH_COLORS.textMuted,
    fontSize: 20,
    fontWeight: "800",
  },
  closeButton: {
    width: MATCH_LAYOUT.minTouchTarget,
    height: MATCH_LAYOUT.minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: MATCH_RADIUS.medium,
    backgroundColor: "rgba(32, 36, 42, 0.9)",
  },
  closeButtonPressed: {
    backgroundColor: MATCH_COLORS.pressed,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: MATCH_SPACING.lg,
    marginTop: MATCH_SPACING.md,
  },
  metaItem: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: MATCH_SPACING.xs,
  },
  metaText: {
    flexShrink: 1,
    color: MATCH_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
});
