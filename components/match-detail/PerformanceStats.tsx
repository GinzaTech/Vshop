import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { MatchImage } from "~/components/matches/MatchImage";
import {
  MATCH_COLORS,
  MATCH_RADIUS,
  MATCH_SPACING,
} from "~/constants/MatchTheme";
import type {
  MatchPlayerRef,
  MatchTeam,
  OpponentBreakdown,
  PlayerSideStats,
  RoundDetail,
  WeaponPerformance,
} from "~/types/match-ui";
import { formatDuration, formatMetric } from "~/utils/match-ui";

const SectionHeading = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <View style={styles.sectionHeading}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
  </View>
);

export function RoundDetailPanel({
  round,
  selectedPlayerTeam,
  players,
}: {
  round: RoundDetail | null;
  selectedPlayerTeam: MatchTeam;
  players: MatchPlayerRef[];
}) {
  const { t } = useTranslation();
  if (!round) return null;
  const side =
    selectedPlayerTeam === "A"
      ? round.sideForTeamA
      : round.sideForTeamA === "attack"
        ? "defense"
        : "attack";
  const nameById = new Map(players.map((player) => [player.playerId, player.playerName]));
  const visibleEvents = round.events
    .filter((event) => event.type !== "round_end")
    .slice(0, 6);

  return (
    <View style={styles.sectionBand}>
      <SectionHeading
        title={t("match_ui.round.label", { number: round.roundNumber })}
        subtitle={t("match_ui.round.selected_detail")}
      />
      <View style={styles.roundSummaryGrid}>
        <View style={styles.roundSummaryItem}>
          <Text style={styles.statLabel}>{t("match_ui.round.winner")}</Text>
          <Text
            style={[
              styles.statValue,
              {
                color:
                  round.winningTeam === "A"
                    ? MATCH_COLORS.teamA
                    : MATCH_COLORS.teamB,
              },
            ]}
          >
            {round.winningTeam}
          </Text>
        </View>
        <View style={styles.roundSummaryItem}>
          <Text style={styles.statLabel}>{t("match_ui.round.outcome")}</Text>
          <Text style={styles.statValue} numberOfLines={1}>
            {t(`match_ui.outcomes.${round.outcome}`)}
          </Text>
        </View>
        <View style={styles.roundSummaryItem}>
          <Text style={styles.statLabel}>{t("match_ui.round.side")}</Text>
          <Text style={styles.statValue}>{t(`match_ui.sides.${side}`)}</Text>
        </View>
        <View style={styles.roundSummaryItem}>
          <Text style={styles.statLabel}>{t("match_ui.round.duration")}</Text>
          <Text style={styles.statValue}>{formatDuration(round.durationSeconds)}</Text>
        </View>
      </View>
      <View style={styles.economySummary}>
        <Text style={styles.economyText}>A {Math.round(round.teamAEconomy).toLocaleString()}</Text>
        <Text style={styles.economyLabel}>{t("match_ui.economy.loadout")}</Text>
        <Text style={styles.economyText}>B {Math.round(round.teamBEconomy).toLocaleString()}</Text>
      </View>
      {visibleEvents.length > 0 ? (
        <View style={styles.eventList}>
          {visibleEvents.map((event) => (
            <View key={event.id} style={styles.eventRow}>
              <Text style={styles.eventTime}>{event.timestampSeconds}s</Text>
              <Icon
                name={
                  event.type === "kill"
                    ? "crosshairs-gps"
                    : event.type === "plant"
                      ? "bomb"
                      : "shield-check-outline"
                }
                size={15}
                color={MATCH_COLORS.textSecondary}
              />
              <Text style={styles.eventText} numberOfLines={1}>
                {nameById.get(event.actorPlayerId ?? "") || event.type}
                {event.targetPlayerId
                  ? ` -> ${nameById.get(event.targetPlayerId) || t("match_ui.player_fallback")}`
                  : ""}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const SideBlock = ({
  title,
  value,
  tone,
}: {
  title: string;
  value: PlayerSideStats["attack"];
  tone: string;
}) => {
  const { t } = useTranslation();
  const metrics = [
    [t("match_ui.scoreboard.kills"), formatMetric(value.kills)],
    [t("match_ui.scoreboard.deaths"), formatMetric(value.deaths)],
    [t("match_ui.scoreboard.assists"), formatMetric(value.assists)],
    ["K/D", formatMetric(value.kd, 2)],
  ] as const;
  return (
    <View style={styles.sideBlock}>
      <View style={[styles.sideAccent, { backgroundColor: tone }]} />
      <Text style={styles.sideTitle}>{title}</Text>
      <View style={styles.sideGrid}>
        {metrics.map(([label, metric]) => (
          <View key={label} style={styles.sideMetric}>
            <Text style={styles.statLabel}>{label}</Text>
            <Text style={styles.statValue}>{metric}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

export function SideStatsGrid({ stats }: { stats: PlayerSideStats }) {
  const { t } = useTranslation();
  return (
    <View style={styles.sectionBand}>
      <SectionHeading
        title={t("match_ui.performance.all_rounds")}
        subtitle={t("match_ui.performance.round_hint")}
      />
      <SideBlock
        title={t("match_ui.sides.defense")}
        value={stats.defense}
        tone={MATCH_COLORS.accentBlue}
      />
      <SideBlock
        title={t("match_ui.sides.attack")}
        value={stats.attack}
        tone={MATCH_COLORS.warning}
      />
    </View>
  );
}

export function OpponentBreakdownTable({
  opponents,
}: {
  opponents: OpponentBreakdown[];
}) {
  const { t } = useTranslation();
  const headers = [
    t("match_ui.scoreboard.kills"),
    t("match_ui.scoreboard.deaths"),
    t("match_ui.performance.damage_dealt"),
    t("match_ui.performance.damage_taken"),
  ];
  return (
    <View style={styles.sectionBand}>
      <SectionHeading title={t("match_ui.performance.opponents")} />
      {opponents.length === 0 ? (
        <Text style={styles.partialText}>{t("match_ui.states.partial")}</Text>
      ) : (
        <ScrollView
          horizontal
          nestedScrollEnabled
          directionalLockEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tableScrollContent}
        >
          <View style={styles.opponentTable}>
            <View style={styles.opponentHeader} accessibilityRole="header">
              {headers.map((header) => (
                <Text key={header} style={styles.opponentHeaderCell} numberOfLines={2}>
                  {header}
                </Text>
              ))}
              <Text style={[styles.opponentHeaderCell, styles.opponentNameHeader]}>
                {t("match_ui.performance.opponent")}
              </Text>
            </View>
            {opponents.map((opponent) => (
              <View key={opponent.opponentPlayerId} style={styles.opponentRow}>
                <Text style={styles.opponentMetric}>{opponent.killsAgainst}</Text>
                <Text style={styles.opponentMetric}>{opponent.deathsAgainst}</Text>
                <Text style={styles.opponentMetric}>{opponent.damageDealt}</Text>
                <Text style={styles.opponentMetric}>{opponent.damageTaken}</Text>
                <View style={styles.opponentIdentity}>
                  <Text style={styles.vsLabel}>vs</Text>
                  <MatchImage
                    uri={opponent.opponentAgentIconUrl}
                    cacheId={`opponent:${opponent.opponentPlayerId}:agent`}
                    style={styles.opponentIcon}
                    icon="account-outline"
                    iconSize={18}
                  />
                  <Text style={styles.opponentName} numberOfLines={1}>
                    {opponent.opponentAgentName}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

export function WeaponStatsTable({ weapons }: { weapons: WeaponPerformance[] }) {
  const { t } = useTranslation();
  return (
    <View style={styles.sectionBand}>
      <SectionHeading title={t("match_ui.performance.weapons")} />
      <View style={styles.weaponHeader} accessibilityRole="header">
        <Text style={styles.weaponHeaderName}>{t("match_ui.performance.weapon")}</Text>
        <Text style={styles.weaponHeaderMetric}>{t("match_ui.scoreboard.kills")}</Text>
        <Text style={styles.weaponHeaderMetric}>{t("match_ui.performance.damage")}</Text>
      </View>
      {weapons.length === 0 ? (
        <Text style={styles.partialText}>{t("match_ui.states.partial")}</Text>
      ) : (
        weapons.map((weapon, index) => (
          <View
            key={weapon.weaponId}
            style={[styles.weaponRow, index % 2 === 1 && styles.weaponRowAlternate]}
          >
            <View style={styles.weaponIdentity}>
              <View style={styles.weaponTextBlock}>
                <Text style={styles.weaponName} numberOfLines={1}>
                  {weapon.weaponName}
                </Text>
              </View>
              <MatchImage
                uri={weapon.weaponImageUrl}
                cacheId={`weapon:${weapon.weaponId}:display-icon`}
                style={styles.weaponImage}
                icon="pistol"
                iconSize={20}
                contentFit="contain"
              />
            </View>
            <Text style={styles.weaponMetric}>{weapon.kills}</Text>
            <Text style={styles.weaponMetric}>{weapon.damage}</Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionBand: {
    paddingVertical: MATCH_SPACING.xl,
    borderBottomWidth: 1,
    borderBottomColor: MATCH_COLORS.divider,
  },
  sectionHeading: {
    paddingHorizontal: MATCH_SPACING.lg,
    marginBottom: MATCH_SPACING.md,
  },
  sectionTitle: {
    color: MATCH_COLORS.textPrimary,
    fontSize: 18,
    fontWeight: "900",
  },
  sectionSubtitle: {
    marginTop: MATCH_SPACING.xs,
    color: MATCH_COLORS.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  roundSummaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: MATCH_SPACING.lg,
  },
  roundSummaryItem: {
    width: "50%",
    minHeight: 54,
    justifyContent: "center",
    paddingRight: MATCH_SPACING.sm,
  },
  statLabel: {
    color: MATCH_COLORS.textMuted,
    fontSize: 10,
    fontWeight: "700",
  },
  statValue: {
    marginTop: 2,
    color: MATCH_COLORS.textPrimary,
    fontSize: 16,
    fontWeight: "800",
  },
  economySummary: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: MATCH_SPACING.lg,
    marginTop: MATCH_SPACING.sm,
    paddingHorizontal: MATCH_SPACING.md,
    borderRadius: MATCH_RADIUS.medium,
    backgroundColor: MATCH_COLORS.surfaceElevated,
  },
  economyText: {
    color: MATCH_COLORS.textPrimary,
    fontSize: 12,
    fontWeight: "800",
  },
  economyLabel: {
    color: MATCH_COLORS.textMuted,
    fontSize: 10,
    fontWeight: "700",
  },
  eventList: {
    marginHorizontal: MATCH_SPACING.lg,
    marginTop: MATCH_SPACING.md,
    borderTopWidth: 1,
    borderTopColor: MATCH_COLORS.divider,
  },
  eventRow: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: MATCH_SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: MATCH_COLORS.divider,
  },
  eventTime: {
    width: 30,
    color: MATCH_COLORS.textMuted,
    fontSize: 10,
    fontWeight: "700",
  },
  eventText: {
    flex: 1,
    color: MATCH_COLORS.textSecondary,
    fontSize: 11,
  },
  sideBlock: {
    position: "relative",
    marginHorizontal: MATCH_SPACING.lg,
    marginTop: MATCH_SPACING.sm,
    paddingHorizontal: MATCH_SPACING.md,
    paddingVertical: MATCH_SPACING.md,
    borderRadius: MATCH_RADIUS.card,
    backgroundColor: MATCH_COLORS.surface,
    overflow: "hidden",
  },
  sideAccent: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 4,
  },
  sideTitle: {
    color: MATCH_COLORS.textPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  sideGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: MATCH_SPACING.sm,
  },
  sideMetric: {
    width: "25%",
    minWidth: 72,
    paddingVertical: MATCH_SPACING.xs,
  },
  tableScrollContent: {
    paddingHorizontal: MATCH_SPACING.lg,
  },
  opponentTable: {
    width: 520,
    borderWidth: 1,
    borderColor: MATCH_COLORS.border,
    borderRadius: MATCH_RADIUS.card,
    overflow: "hidden",
  },
  opponentHeader: {
    height: 48,
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: MATCH_COLORS.teamAHeader,
  },
  opponentHeaderCell: {
    width: 76,
    textAlignVertical: "center",
    textAlign: "center",
    color: MATCH_COLORS.textPrimary,
    fontSize: 9,
    fontWeight: "800",
    borderRightWidth: 1,
    borderRightColor: MATCH_COLORS.divider,
  },
  opponentNameHeader: {
    width: 216,
    backgroundColor: MATCH_COLORS.teamBHeader,
  },
  opponentRow: {
    height: 72,
    flexDirection: "row",
    alignItems: "stretch",
    borderTopWidth: 1,
    borderTopColor: MATCH_COLORS.divider,
    backgroundColor: MATCH_COLORS.surface,
  },
  opponentMetric: {
    width: 76,
    textAlignVertical: "center",
    textAlign: "center",
    color: MATCH_COLORS.textPrimary,
    fontSize: 12,
    fontWeight: "800",
    borderRightWidth: 1,
    borderRightColor: MATCH_COLORS.divider,
  },
  opponentIdentity: {
    width: 216,
    flexDirection: "row",
    alignItems: "center",
    gap: MATCH_SPACING.sm,
    paddingHorizontal: MATCH_SPACING.md,
    backgroundColor: "rgba(107, 38, 50, 0.42)",
  },
  vsLabel: {
    color: MATCH_COLORS.textMuted,
    fontSize: 10,
    fontWeight: "700",
  },
  opponentIcon: {
    width: 40,
    height: 40,
    borderRadius: MATCH_RADIUS.medium,
  },
  opponentName: {
    flex: 1,
    color: MATCH_COLORS.textPrimary,
    fontSize: 12,
    fontWeight: "800",
  },
  weaponHeader: {
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: MATCH_SPACING.lg,
    paddingHorizontal: MATCH_SPACING.md,
    borderTopLeftRadius: MATCH_RADIUS.card,
    borderTopRightRadius: MATCH_RADIUS.card,
    backgroundColor: MATCH_COLORS.surfaceElevated,
  },
  weaponHeaderName: {
    flex: 1,
    color: MATCH_COLORS.textMuted,
    fontSize: 10,
    fontWeight: "800",
  },
  weaponHeaderMetric: {
    width: 64,
    color: MATCH_COLORS.textMuted,
    fontSize: 10,
    fontWeight: "800",
    textAlign: "right",
  },
  weaponRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: MATCH_SPACING.lg,
    paddingHorizontal: MATCH_SPACING.md,
    borderTopWidth: 1,
    borderTopColor: MATCH_COLORS.divider,
    backgroundColor: MATCH_COLORS.surface,
  },
  weaponRowAlternate: {
    backgroundColor: MATCH_COLORS.surfaceElevated,
  },
  weaponIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: MATCH_SPACING.sm,
  },
  weaponTextBlock: {
    width: 92,
  },
  weaponName: {
    color: MATCH_COLORS.textPrimary,
    fontSize: 12,
    fontWeight: "800",
  },
  weaponImage: {
    flex: 1,
    height: 34,
  },
  weaponMetric: {
    width: 64,
    color: MATCH_COLORS.textPrimary,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "right",
  },
  partialText: {
    marginHorizontal: MATCH_SPACING.lg,
    color: MATCH_COLORS.textMuted,
    fontSize: 12,
  },
});
