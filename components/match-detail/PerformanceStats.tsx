import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
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
  RoundEvent,
  WeaponPerformance,
} from "~/types/match-ui";
import { formatDuration, formatMetric } from "~/utils/match-ui";

const SPIKE_IMAGE = require("~/assets/images/spike.png");

const SectionHeading = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <View style={styles.sectionHeading}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
  </View>
);

const formatEventTime = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  return `${minutes}:${String(safeSeconds % 60).padStart(2, "0")}`;
};

const eventRowTone = (team?: MatchTeam) => {
  if (team === "A") return styles.eventRowTeamA;
  if (team === "B") return styles.eventRowTeamB;
  return styles.eventRowNeutral;
};

const teamIndicatorTone = (team?: MatchTeam) => {
  if (team === "A") return styles.teamAIndicator;
  if (team === "B") return styles.teamBIndicator;
  return styles.neutralIndicator;
};

function RoundCombatEvent({
  event,
  actor,
  target,
  objectiveLabel,
}: {
  event: RoundEvent;
  actor?: MatchPlayerRef;
  target?: MatchPlayerRef;
  objectiveLabel: string;
}) {
  const isKill = event.type === "kill";

  return (
    <View style={[styles.combatEventRow, eventRowTone(actor?.team)]}>
      <View style={styles.eventAgent}>
        <MatchImage
          uri={actor?.agentIconUrl}
          cacheId={`round-event:${actor?.playerId ?? "actor"}:agent`}
          style={styles.eventAgentImage}
          icon="account-outline"
          iconSize={20}
        />
        <View
          style={[
            styles.leftTeamIndicator,
            teamIndicatorTone(actor?.team),
          ]}
        />
      </View>

      <Text style={styles.eventTime}>
        {formatEventTime(event.timestampSeconds)}
      </Text>

      {isKill ? (
        <>
          <View
            style={styles.eventWeaponCell}
            accessible
            accessibilityLabel={event.weaponName}
          >
            <MatchImage
              uri={event.weaponImageUrl}
              cacheId={`round-event:${event.weaponId ?? event.id}:weapon`}
              style={styles.eventWeaponImage}
              icon="pistol"
              iconSize={20}
              contentFit="contain"
            />
          </View>
          <Text style={styles.killDistance}>
            {event.distanceMeters === undefined
              ? ""
              : `${event.distanceMeters} m`}
          </Text>
          <View style={styles.eventAgent}>
            <MatchImage
              uri={target?.agentIconUrl}
              cacheId={`round-event:${target?.playerId ?? "target"}:agent`}
              style={styles.eventAgentImage}
              icon="account-outline"
              iconSize={20}
            />
            <View
              style={[
                styles.rightTeamIndicator,
                teamIndicatorTone(target?.team),
              ]}
            />
          </View>
        </>
      ) : (
        <View style={styles.objectiveBody}>
          <View style={styles.objectiveIconCell}>
            {event.type === "plant" ? (
              <Image
                source={SPIKE_IMAGE}
                style={styles.spikeEventImage}
                resizeMode="contain"
                accessibilityLabel={objectiveLabel}
              />
            ) : (
              <Icon
                name={
                  event.type === "defuse"
                    ? "shield-check-outline"
                    : "crosshairs-gps"
                }
                size={23}
                color={MATCH_COLORS.textPrimary}
              />
            )}
          </View>
          <Text style={styles.objectiveLabel} numberOfLines={1}>
            {objectiveLabel}
          </Text>
        </View>
      )}
    </View>
  );
}

export function RoundDetailPanel({
  round,
  selectedPlayerTeam,
  players,
}: {
  round: RoundDetail | null;
  selectedPlayerTeam: MatchTeam;
  players: MatchPlayerRef[];
}) {
  const { t, i18n } = useTranslation();
  const numberFormatter = React.useMemo(
    () =>
      new Intl.NumberFormat(i18n.language || "en", {
        maximumFractionDigits: 0,
      }),
    [i18n.language]
  );
  if (!round) return null;
  const side =
    selectedPlayerTeam === "A"
      ? round.sideForTeamA
      : round.sideForTeamA === "attack"
        ? "defense"
        : "attack";
  const playerById = new Map(players.map((player) => [player.playerId, player]));
  const visibleEvents = round.events
    .filter((event) => event.type !== "round_end")
    .sort((left, right) => left.timestampSeconds - right.timestampSeconds);
  const teamALoadout =
    round.teamAAverageLoadout ?? round.teamAEconomy;
  const teamBLoadout =
    round.teamBAverageLoadout ?? round.teamBEconomy;
  const teamACredits = round.teamAAverageCredits ?? 0;
  const teamBCredits = round.teamBAverageCredits ?? 0;

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
      <View style={styles.roundTimelineContainer}>
        {visibleEvents.length > 0 ? (
          <View style={styles.eventList}>
            {visibleEvents.map((event) => (
              <RoundCombatEvent
                key={event.id}
                event={event}
                actor={playerById.get(event.actorPlayerId ?? "")}
                target={playerById.get(event.targetPlayerId ?? "")}
                objectiveLabel={
                  event.type === "plant"
                    ? t("match_ui.round.plant_spike")
                    : event.type === "defuse"
                      ? t("match_ui.round.defuse_spike")
                      : event.type
                }
              />
            ))}
          </View>
        ) : (
          <Text style={styles.timelineEmptyText}>
            {t("match_ui.states.partial")}
          </Text>
        )}

        <View style={styles.roundEconomySummary}>
          <Text style={styles.roundEconomyLine}>
            <Text style={styles.roundEconomyLabel}>
              {t("match_ui.economy.average_loadout")}:{" "}
            </Text>
            <Text style={styles.teamAValue}>
              {numberFormatter.format(teamALoadout)}
            </Text>
            <Text style={styles.economySeparator}> / </Text>
            <Text style={styles.teamBValue}>
              {numberFormatter.format(teamBLoadout)}
            </Text>
          </Text>
          <Text style={styles.roundEconomyLine}>
            <Text style={styles.roundEconomyLabel}>
              {t("match_ui.economy.average_credits")}:{" "}
            </Text>
            <Text style={styles.teamAValue}>
              {numberFormatter.format(teamACredits)}
            </Text>
            <Text style={styles.economySeparator}> / </Text>
            <Text style={styles.teamBValue}>
              {numberFormatter.format(teamBCredits)}
            </Text>
          </Text>
        </View>
      </View>
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
                  iconSize={16}
                />
                <Text style={styles.opponentName} numberOfLines={1}>
                  {opponent.opponentAgentName}
                </Text>
              </View>
            </View>
          ))}
        </View>
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
  roundTimelineContainer: {
    width: "100%",
    maxWidth: 453,
    alignSelf: "center",
    marginTop: MATCH_SPACING.sm,
    paddingHorizontal: 30,
  },
  eventList: {
    gap: 2,
  },
  combatEventRow: {
    width: "100%",
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  eventRowTeamA: {
    backgroundColor: "#175F5D",
  },
  eventRowTeamB: {
    backgroundColor: "#50303D",
  },
  eventRowNeutral: {
    backgroundColor: "#3D4541",
  },
  eventAgent: {
    position: "relative",
    width: 42,
    height: 40,
    overflow: "hidden",
  },
  eventAgentImage: {
    width: 42,
    height: 40,
    borderRadius: 0,
  },
  leftTeamIndicator: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 4,
  },
  rightTeamIndicator: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: 4,
  },
  teamAIndicator: {
    backgroundColor: "#00D7C3",
  },
  teamBIndicator: {
    backgroundColor: "#FF3457",
  },
  neutralIndicator: {
    backgroundColor: "#8C979D",
  },
  eventTime: {
    width: 50,
    paddingLeft: 7,
    color: "#F2F2F2",
    fontSize: 16,
    fontWeight: "400",
  },
  eventWeaponCell: {
    flex: 1,
    minWidth: 54,
    height: 40,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  eventWeaponImage: {
    width: "100%",
    height: 24,
    transform: [{ scaleX: -1 }],
  },
  killDistance: {
    width: 48,
    paddingRight: 7,
    color: "#F2F2F2",
    fontSize: 16,
    fontWeight: "400",
    textAlign: "right",
  },
  objectiveBody: {
    flex: 1,
    height: 40,
    flexDirection: "row",
    alignItems: "center",
  },
  objectiveIconCell: {
    width: 70,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  spikeEventImage: {
    width: 22,
    height: 36,
  },
  objectiveLabel: {
    flex: 1,
    paddingRight: 18,
    color: "#F0F4F4",
    fontSize: 16,
    fontWeight: "400",
    textAlign: "right",
  },
  timelineEmptyText: {
    color: MATCH_COLORS.textMuted,
    fontSize: 12,
  },
  roundEconomySummary: {
    marginTop: 14,
  },
  roundEconomyLine: {
    minHeight: 19,
    color: MATCH_COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 19,
  },
  roundEconomyLabel: {
    color: "#8C979D",
    fontSize: 14,
    fontWeight: "400",
  },
  teamAValue: {
    color: "#00E5C4",
    fontSize: 14,
    fontWeight: "500",
  },
  economySeparator: {
    color: "#D8D8D8",
    fontSize: 14,
  },
  teamBValue: {
    color: "#FF3D58",
    fontSize: 14,
    fontWeight: "500",
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
  opponentTable: {
    marginHorizontal: MATCH_SPACING.lg,
    borderWidth: 1,
    borderColor: MATCH_COLORS.border,
    borderRadius: MATCH_RADIUS.card,
    overflow: "hidden",
  },
  opponentHeader: {
    height: 40,
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: MATCH_COLORS.teamAHeader,
  },
  opponentHeaderCell: {
    width: 52,
    textAlignVertical: "center",
    textAlign: "center",
    color: MATCH_COLORS.textPrimary,
    fontSize: 10,
    fontWeight: "800",
    borderRightWidth: 1,
    borderRightColor: MATCH_COLORS.divider,
  },
  opponentNameHeader: {
    flex: 1,
    backgroundColor: MATCH_COLORS.teamBHeader,
  },
  opponentRow: {
    height: 54,
    flexDirection: "row",
    alignItems: "stretch",
    borderTopWidth: 1,
    borderTopColor: MATCH_COLORS.divider,
    backgroundColor: MATCH_COLORS.surface,
  },
  opponentMetric: {
    width: 52,
    textAlignVertical: "center",
    textAlign: "center",
    color: MATCH_COLORS.textPrimary,
    fontSize: 11,
    fontWeight: "800",
    borderRightWidth: 1,
    borderRightColor: MATCH_COLORS.divider,
  },
  opponentIdentity: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: MATCH_SPACING.xs,
    paddingHorizontal: MATCH_SPACING.sm,
    backgroundColor: "rgba(107, 38, 50, 0.42)",
  },
  vsLabel: {
    color: MATCH_COLORS.textMuted,
    fontSize: 10,
    fontWeight: "700",
  },
  opponentIcon: {
    width: 32,
    height: 32,
    borderRadius: MATCH_RADIUS.medium,
  },
  opponentName: {
    flex: 1,
    color: MATCH_COLORS.textPrimary,
    fontSize: 11,
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
