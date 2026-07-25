import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useTranslation } from "react-i18next";

import { MatchImage } from "~/components/matches/MatchImage";
import {
  MATCH_COLORS,
  MATCH_LAYOUT,
  MATCH_RADIUS,
  MATCH_SPACING,
} from "~/constants/MatchTheme";
import type {
  ScoreboardColumn,
  ScoreboardPlayer,
  ScoreboardSortState,
} from "~/types/match-ui";
import {
  formatMetric,
  formatPercent,
  formatSigned,
} from "~/utils/match-ui";

type ScoreboardTableProps = {
  players: ScoreboardPlayer[];
  onSelectPlayer: (playerId: string) => void;
};

type ColumnDefinition = {
  id: ScoreboardColumn;
  label: string;
  width: number;
  sortable?: boolean;
};

const numericValue = (
  player: ScoreboardPlayer,
  column: ScoreboardColumn
): number | string | undefined => {
  if (column === "rank") return player.rank?.name;
  return player[column];
};

const sortPlayers = (
  players: ScoreboardPlayer[],
  sort: ScoreboardSortState
) => {
  if (!sort.column || !sort.direction) return players;
  const direction = sort.direction === "asc" ? 1 : -1;
  return [...players].sort((left, right) => {
    const leftValue = numericValue(left, sort.column as ScoreboardColumn);
    const rightValue = numericValue(right, sort.column as ScoreboardColumn);
    if (typeof leftValue === "string" || typeof rightValue === "string") {
      return String(leftValue ?? "").localeCompare(String(rightValue ?? "")) * direction;
    }
    return ((leftValue ?? Number.NEGATIVE_INFINITY) -
      (rightValue ?? Number.NEGATIVE_INFINITY)) * direction;
  });
};

const cellText = (player: ScoreboardPlayer, column: ScoreboardColumn) => {
  if (column === "plusMinus" || column === "dda") {
    return formatSigned(player[column]);
  }
  if (column === "kd") return formatMetric(player.kd, 2);
  if (column === "kast" || column === "headshotPercent") {
    return formatPercent(player[column]);
  }
  if (column === "rank") return "";
  return formatMetric(player[column]);
};

const signedCellColor = (value: number | undefined) => {
  if (!Number.isFinite(value) || value === 0) return MATCH_COLORS.textPrimary;
  return Number(value) > 0 ? MATCH_COLORS.win : MATCH_COLORS.loss;
};

const ScoreboardStatsRow = React.memo(function ScoreboardStatsRow({
  player,
  columns,
}: {
  player: ScoreboardPlayer;
  columns: ColumnDefinition[];
}) {
  return (
    <View style={[styles.statsRow, player.isCurrentUser && styles.currentStatsRow]}>
      {columns.map((column) => {
        if (column.id === "rank") {
          return (
            <View key={column.id} style={[styles.cell, { width: column.width }]}>
              <MatchImage
                uri={player.rank?.iconUrl}
                cacheId={
                  player.rank?.name
                    ? `scoreboard-rank:${player.rank.name}`
                    : undefined
                }
                style={styles.rankIcon}
                icon="shield-outline"
                iconSize={15}
                contentFit="contain"
              />
            </View>
          );
        }
        if (column.id === "trs") {
          return (
            <View key={column.id} style={[styles.cell, { width: column.width }]}>
              {player.trsIconUrl ? (
                <MatchImage
                  uri={player.trsIconUrl}
                  cacheId={`trs:${player.trsIconUrl}`}
                  style={styles.trsIcon}
                  icon="hexagon-outline"
                  iconSize={12}
                  contentFit="contain"
                />
              ) : null}
              <Text style={styles.cellText}>{formatMetric(player.trs)}</Text>
            </View>
          );
        }

        const isSigned = column.id === "plusMinus" || column.id === "dda";
        const rawValue = isSigned ? player[column.id] : undefined;
        return (
          <View key={column.id} style={[styles.cell, { width: column.width }]}>
            <Text
              style={[
                styles.cellText,
                isSigned && { color: signedCellColor(rawValue) },
              ]}
              numberOfLines={1}
            >
              {cellText(player, column.id)}
            </Text>
          </View>
        );
      })}
    </View>
  );
});

export const ScoreboardTable = React.memo(function ScoreboardTable({
  players,
  onSelectPlayer,
}: ScoreboardTableProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const playerColumnWidth = width <= 380 ? 150 : 172;
  const [sort, setSort] = React.useState<ScoreboardSortState>({
    column: null,
    direction: null,
  });
  const columns = React.useMemo<ColumnDefinition[]>(
    () => [
      { id: "acs", label: "ACS", width: 62, sortable: true },
      { id: "kills", label: t("match_ui.scoreboard.kills"), width: 58, sortable: true },
      { id: "deaths", label: t("match_ui.scoreboard.deaths"), width: 62, sortable: true },
      { id: "assists", label: t("match_ui.scoreboard.assists"), width: 62 },
      { id: "plusMinus", label: "+/-", width: 58 },
      { id: "kd", label: "K/D", width: 62, sortable: true },
      { id: "adr", label: "ADR", width: 64, sortable: true },
      { id: "dda", label: "DDA", width: 64 },
      { id: "kast", label: "KAST", width: 72 },
      { id: "headshotPercent", label: "HS%", width: 68 },
      { id: "firstKills", label: "FK", width: 56 },
      { id: "firstDeaths", label: "FD", width: 56 },
      { id: "multiKills", label: "MK", width: 58 },
      { id: "economyRating", label: "Econ", width: 72 },
      { id: "rank", label: t("match_ui.scoreboard.rank"), width: 72 },
      { id: "trs", label: "TRS", width: 72 },
    ],
    [t]
  );
  const totalStatsWidth = columns.reduce((total, column) => total + column.width, 0);
  const teamAPlayers = React.useMemo(
    () => sortPlayers(players.filter((player) => player.team === "A"), sort),
    [players, sort]
  );
  const teamBPlayers = React.useMemo(
    () => sortPlayers(players.filter((player) => player.team === "B"), sort),
    [players, sort]
  );

  const cycleSort = (column: ScoreboardColumn) => {
    setSort((current) => {
      if (current.column !== column || current.direction === null) {
        return { column, direction: "desc" };
      }
      if (current.direction === "desc") return { column, direction: "asc" };
      return { column: null, direction: null };
    });
  };

  const renderFixedPlayer = (player: ScoreboardPlayer) => (
    <Pressable
      key={player.playerId}
      accessibilityRole="button"
      accessibilityLabel={`${player.playerName}, ${player.agent.name}`}
      onPress={() => onSelectPlayer(player.playerId)}
      style={({ pressed }) => [
        styles.fixedPlayerRow,
        player.isCurrentUser && styles.currentFixedRow,
        pressed && styles.playerPressed,
      ]}
    >
      <View
        style={[
          styles.teamMarker,
          {
            backgroundColor:
              player.team === "A" ? MATCH_COLORS.teamA : MATCH_COLORS.teamB,
          },
        ]}
      />
      <MatchImage
        uri={player.agent.iconUrl}
        cacheId={`agent:${player.playerId}:${player.agent.name}`}
        style={styles.agentIcon}
        icon="account-outline"
        iconSize={18}
      />
      <View style={styles.playerIdentity}>
        <Text style={styles.playerName} numberOfLines={1}>
          {player.playerName}
        </Text>
        <Text style={styles.agentName} numberOfLines={1}>
          {player.agent.name}
        </Text>
      </View>
      {player.isCurrentUser ? (
        <Icon name="account-check" size={15} color={MATCH_COLORS.teamA} />
      ) : null}
    </Pressable>
  );

  const renderTeamHeader = (team: "A" | "B") => (
    <View
      style={[
        styles.fixedTeamHeader,
        team === "A" ? styles.teamAHeader : styles.teamBHeader,
      ]}
    >
      <Text style={styles.teamHeaderText}>
        {team === "A"
          ? t("match_ui.teams.team_a")
          : t("match_ui.teams.team_b")}
      </Text>
    </View>
  );

  const renderStatsTeamHeader = (team: "A" | "B") => (
    <View
      style={[
        styles.statsTeamHeader,
        { width: totalStatsWidth },
        team === "A" ? styles.teamAHeader : styles.teamBHeader,
      ]}
    >
      <Text style={styles.statsTeamHeaderText}>
        {team === "A"
          ? t("match_ui.scoreboard.team_a_stats")
          : t("match_ui.scoreboard.team_b_stats")}
      </Text>
    </View>
  );

  if (players.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{t("match_ui.states.partial")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t("match_ui.tabs.scoreboard")}</Text>
      <View style={styles.table}>
        <View style={[styles.fixedColumn, { width: playerColumnWidth }]}>
          <View style={styles.fixedHeader} accessibilityRole="header">
            <Text style={styles.fixedHeaderText}>{t("match_ui.scoreboard.player")}</Text>
          </View>
          {renderTeamHeader("A")}
          {teamAPlayers.map(renderFixedPlayer)}
          {renderTeamHeader("B")}
          {teamBPlayers.map(renderFixedPlayer)}
        </View>

        <ScrollView
          horizontal
          nestedScrollEnabled
          directionalLockEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.statsScroll}
        >
          <View style={{ width: totalStatsWidth }}>
            <View style={styles.statsHeader} accessibilityRole="header">
              {columns.map((column) => {
                const active = sort.column === column.id && sort.direction;
                return (
                  <Pressable
                    key={column.id}
                    accessibilityRole={column.sortable ? "button" : "text"}
                    accessibilityLabel={
                      column.sortable
                        ? `${t("match_ui.scoreboard.sort_by")} ${column.label}`
                        : column.label
                    }
                    disabled={!column.sortable}
                    onPress={() => cycleSort(column.id)}
                    style={({ pressed }) => [
                      styles.headerCell,
                      { width: column.width },
                      active && styles.headerCellActive,
                      pressed && styles.headerCellPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.headerCellText,
                        active && styles.headerCellTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {column.label}
                    </Text>
                    {active ? (
                      <Icon
                        name={sort.direction === "desc" ? "arrow-down" : "arrow-up"}
                        size={12}
                        color={MATCH_COLORS.tabIndicator}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
            {renderStatsTeamHeader("A")}
            {teamAPlayers.map((player) => (
              <ScoreboardStatsRow
                key={player.playerId}
                player={player}
                columns={columns}
              />
            ))}
            {renderStatsTeamHeader("B")}
            {teamBPlayers.map((player) => (
              <ScoreboardStatsRow
                key={player.playerId}
                player={player}
                columns={columns}
              />
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  section: {
    paddingTop: MATCH_SPACING.xl,
    paddingBottom: MATCH_SPACING.xxxl,
  },
  sectionTitle: {
    marginBottom: MATCH_SPACING.md,
    paddingHorizontal: MATCH_SPACING.lg,
    color: MATCH_COLORS.textPrimary,
    fontSize: 20,
    fontWeight: "900",
  },
  table: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: MATCH_COLORS.border,
    backgroundColor: MATCH_COLORS.surface,
  },
  fixedColumn: {
    zIndex: 2,
    borderRightWidth: 1,
    borderRightColor: MATCH_COLORS.border,
    backgroundColor: MATCH_COLORS.surface,
  },
  fixedHeader: {
    height: MATCH_LAYOUT.scoreboardHeaderHeight,
    justifyContent: "center",
    paddingHorizontal: MATCH_SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: MATCH_COLORS.border,
    backgroundColor: MATCH_COLORS.surfaceElevated,
  },
  fixedHeaderText: {
    color: MATCH_COLORS.textSecondary,
    fontSize: 11,
    fontWeight: "800",
  },
  fixedTeamHeader: {
    height: MATCH_LAYOUT.scoreboardTeamHeight,
    justifyContent: "center",
    paddingHorizontal: MATCH_SPACING.md,
  },
  teamAHeader: {
    backgroundColor: MATCH_COLORS.teamAHeader,
  },
  teamBHeader: {
    backgroundColor: MATCH_COLORS.teamBHeader,
  },
  teamHeaderText: {
    color: MATCH_COLORS.textPrimary,
    fontSize: 13,
    fontWeight: "900",
  },
  fixedPlayerRow: {
    height: MATCH_LAYOUT.scoreboardRowHeight,
    flexDirection: "row",
    alignItems: "center",
    gap: MATCH_SPACING.sm,
    paddingHorizontal: MATCH_SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: MATCH_COLORS.divider,
  },
  currentFixedRow: {
    backgroundColor: "rgba(25, 213, 176, 0.09)",
  },
  playerPressed: {
    backgroundColor: MATCH_COLORS.pressed,
  },
  teamMarker: {
    width: 3,
    height: 30,
    borderRadius: 2,
  },
  agentIcon: {
    width: 34,
    height: 34,
    borderRadius: MATCH_RADIUS.medium,
  },
  playerIdentity: {
    flex: 1,
    minWidth: 0,
  },
  playerName: {
    color: MATCH_COLORS.textPrimary,
    fontSize: 11,
    fontWeight: "800",
  },
  agentName: {
    marginTop: 2,
    color: MATCH_COLORS.textMuted,
    fontSize: 9,
  },
  statsScroll: {
    flex: 1,
  },
  statsHeader: {
    height: MATCH_LAYOUT.scoreboardHeaderHeight,
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: MATCH_COLORS.border,
    backgroundColor: MATCH_COLORS.surfaceElevated,
  },
  headerCell: {
    height: MATCH_LAYOUT.scoreboardHeaderHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderRightWidth: 1,
    borderRightColor: MATCH_COLORS.divider,
  },
  headerCellActive: {
    backgroundColor: "rgba(217, 48, 87, 0.1)",
  },
  headerCellPressed: {
    backgroundColor: MATCH_COLORS.pressed,
  },
  headerCellText: {
    color: MATCH_COLORS.textMuted,
    fontSize: 10,
    fontWeight: "800",
  },
  headerCellTextActive: {
    color: MATCH_COLORS.tabIndicator,
  },
  statsTeamHeader: {
    height: MATCH_LAYOUT.scoreboardTeamHeight,
    justifyContent: "center",
    paddingHorizontal: MATCH_SPACING.md,
  },
  statsTeamHeaderText: {
    color: "rgba(245, 247, 250, 0.78)",
    fontSize: 11,
    fontWeight: "700",
  },
  statsRow: {
    height: MATCH_LAYOUT.scoreboardRowHeight,
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: MATCH_COLORS.divider,
  },
  currentStatsRow: {
    backgroundColor: "rgba(25, 213, 176, 0.09)",
  },
  cell: {
    height: MATCH_LAYOUT.scoreboardRowHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderRightWidth: 1,
    borderRightColor: MATCH_COLORS.divider,
  },
  cellText: {
    color: MATCH_COLORS.textPrimary,
    fontSize: 11,
    fontWeight: "700",
  },
  rankIcon: {
    width: 25,
    height: 25,
  },
  trsIcon: {
    width: 18,
    height: 18,
  },
  empty: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: MATCH_COLORS.textMuted,
    fontSize: 13,
  },
});
