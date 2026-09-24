// ===== ScoreboardTable.tsx =====
// Bảng tổng quan trận: cột người chơi cố định (agent, tên, marker đội) +
// vùng chỉ số cuộn ngang với nhiều cột sắp xếp được (ACS, K, D, K/D, ADR...).
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
import AppIcon from "~/components/ui/AppIcon";
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

/**
 * ScoreboardTableProps – Props của ScoreboardTable.
 *
 * @param players – Danh sách 10 người chơi trong trận (điểm số, agent, rank).
 * @param onSelectPlayer – Callback khi bấm một người chơi (mở tab hiệu suất).
 */
type ScoreboardTableProps = {
  players: ScoreboardPlayer[];
  onSelectPlayer: (playerId: string) => void;
};

/**
 * ColumnDefinition – Định nghĩa một cột chỉ số trong bảng.
 *
 * @property id – Định danh cột (khớp ScoreboardColumn).
 * @property label – Nhãn hiển thị trên header.
 * @property width – Độ rộng cột (px).
 * @property sortable – (tuỳ chọn) Cột có sắp xếp được không.
 */
type ColumnDefinition = {
  id: ScoreboardColumn;
  label: string;
  width: number;
  sortable?: boolean;
};

/**
 * numericValue – Lấy giá trị thô của một cột cho người chơi (dùng so sánh).
 * @param player – Người chơi cần lấy giá trị.
 * @param column – Cột cần lấy.
 * @returns Số (đa số cột) hoặc chuỗi (cột rank); undefined nếu không có.
 */
const numericValue = (
  player: ScoreboardPlayer,
  column: ScoreboardColumn
): number | string | undefined => {
  if (column === "rank") return player.rank?.name;
  return player[column];
};

/**
 * sortPlayers – Sắp xếp danh sách người chơi theo trạng thái sort hiện tại.
 * Giá trị chuỗi so bằng localeCompare, số so bằng hiệu; undefined coi như
 * -Infinity (xuất hiện cuối). Không mutate mảng gốc.
 *
 * @param players – Danh sách gốc.
 * @param sort – Trạng thái sort { column, direction }.
 * @returns Mảng mới đã sắp xếp (hoặc nguyên bản nếu chưa chọn sort).
 */
const sortPlayers = (
  players: ScoreboardPlayer[],
  sort: ScoreboardSortState
) => {
  if (!sort.column || !sort.direction) return players;
  const direction = sort.direction === "asc" ? 1 : -1;
  return [...players].sort((left, right) => {
    const leftValue = numericValue(left, sort.column as ScoreboardColumn);
    const rightValue = numericValue(right, sort.column as ScoreboardColumn);
    if (leftValue === undefined && rightValue === undefined) return 0;
    if (leftValue === undefined) return 1;
    if (rightValue === undefined) return -1;
    if (typeof leftValue === "string" || typeof rightValue === "string") {
      return String(leftValue).localeCompare(String(rightValue)) * direction;
    }
    return (leftValue - rightValue) * direction;
  });
};

/**
 * cellText – Format nội dung text của một ô chỉ số theo loại cột.
 * @param player – Người chơi của ô này.
 * @param column – Cột cần format.
 * @returns Chuỗi đã format (signed, metric 2 số lẻ, percent, hoặc rỗng
 *          với cột rank).
 */
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

/**
 * signedCellColor – Màu text cho ô có dấu (+/-, DDA): xanh khi dương,
 * đỏ khi âm, màu chữ thường khi 0/không hợp lệ.
 * @param value – Giá trị signed cần tô màu.
 * @returns Màu từ MATCH_COLORS.
 */
const signedCellColor = (value: number | undefined) => {
  if (!Number.isFinite(value) || value === 0) return MATCH_COLORS.textPrimary;
  return Number(value) > 0 ? MATCH_COLORS.win : MATCH_COLORS.loss;
};

/**
 * ScoreboardStatsRow – Hàng chỉ số của một người chơi trong bảng (memo hoá).
 * Cột "rank" hiển thị icon rank, cột "trs" icon + số, còn lại là text format
 * (ô signed được tô màu theo dấu). Không side effect.
 *
 * @param player – Người chơi của hàng.
 * @param columns – Định nghĩa các cột (id, nhãn, độ rộng).
 * @returns View hàng chứa các ô chỉ số theo đúng thứ tự cột.
 */
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
                icon="shield"
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
                  icon="performance"
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

/**
 * ScoreboardTable – Bảng tổng quan chính (memo hoá).
 * Cấu trúc 2 vùng: cột trái cố định (header + header đội A/B + hàng người
 * chơi bấm được) và ScrollView ngang chứa header cột sắp xếp được + các hàng
 * chỉ số. Sort 3 trạng thái: desc → asc → bỏ sắp xếp. Màn hẹp (<=380px)
 * thu hẹp cột người chơi. Không side effect.
 *
 * @param players – Danh sách người chơi (xem ScoreboardTableProps).
 * @param onSelectPlayer – Callback khi bấm người chơi.
 * @returns Section bảng scoreboard hoặc trạng thái rỗng khi không có players.
 */
export const ScoreboardTable = React.memo(function ScoreboardTable({
  players,
  onSelectPlayer,
}: ScoreboardTableProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  // playerColumnWidth: độ rộng cột người chơi, thu hẹp trên màn hình nhỏ
  const playerColumnWidth = width <= 380 ? 150 : 172;
  // sort: trạng thái sắp xếp hiện tại { column, direction }
  const [sort, setSort] = React.useState<ScoreboardSortState>({
    column: null,
    direction: null,
  });
  // columns: định nghĩa các cột chỉ số (nhãn i18n, độ rộng, sortable)
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
  // totalStatsWidth: tổng độ rộng các cột chỉ số (đặt width cho vùng cuộn)
  const totalStatsWidth = columns.reduce((total, column) => total + column.width, 0);
  // teamAPlayers/teamBPlayers: người chơi chia theo đội + đã sort theo sort
  const teamAPlayers = React.useMemo(
    () => sortPlayers(players.filter((player) => player.team === "A"), sort),
    [players, sort]
  );
  const teamBPlayers = React.useMemo(
    () => sortPlayers(players.filter((player) => player.team === "B"), sort),
    [players, sort]
  );

  // cycleSort: chuyển trạng thái sort của một cột: desc → asc → bỏ sort
  const cycleSort = (column: ScoreboardColumn) => {
    setSort((current) => {
      if (current.column !== column || current.direction === null) {
        return { column, direction: "desc" };
      }
      if (current.direction === "desc") return { column, direction: "asc" };
      return { column: null, direction: null };
    });
  };

  // renderFixedPlayer: hàng người chơi trong cột cố định trái
  // (marker đội, avatar agent, tên + agent, tick account hiện tại)
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
        icon="account"
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
        <AppIcon
          name="accountSynced"
          size={15}
          color={MATCH_COLORS.teamA}
          decorative
        />
      ) : null}
    </Pressable>
  );

  // renderTeamHeader: header đội (A/B) của cột cố định trái
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

  // renderStatsTeamHeader: header đội (A/B) trong vùng chỉ số cuộn ngang
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
                const sortDirectionLabel = active
                  ? sort.direction === "asc"
                    ? t("match_ui.scoreboard.sort_ascending", {
                        defaultValue: "Ascending",
                      })
                    : t("match_ui.scoreboard.sort_descending", {
                        defaultValue: "Descending",
                      })
                  : undefined;
                return (
                  <Pressable
                    key={column.id}
                    accessibilityRole={column.sortable ? "button" : "text"}
                    accessibilityLabel={
                      column.sortable
                        ? `${t("match_ui.scoreboard.sort_by")} ${column.label}`
                        : column.label
                    }
                    accessibilityState={{
                      disabled: !column.sortable,
                      selected: Boolean(active),
                    }}
                    accessibilityValue={
                      sortDirectionLabel ? { text: sortDirectionLabel } : undefined
                    }
                    testID={
                      column.sortable
                        ? `match-detail-sort-${column.id}`
                        : undefined
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
                      <AppIcon
                        name={
                          sort.direction === "desc"
                            ? "sortDescending"
                            : "sortAscending"
                        }
                        size={12}
                        color={MATCH_COLORS.tabIndicator}
                        decorative
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
