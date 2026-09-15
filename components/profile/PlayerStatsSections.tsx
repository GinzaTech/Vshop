import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { CachedImage as Image } from "~/components/CachedImage";
import type { MatchHistoryRecord, SeasonPerformanceStats } from "~/types/match-ui";
import type { CompetitiveRankSummary } from "~/utils/profile-cache";
import { getMatchHistoryResult } from "~/utils/match-result";
import type { AggregateRow, TableMode } from "./player-stats-data";
import { CardHeader, MetricCell } from "./PlayerStatsPrimitives";
import { oneDecimal, percentage, toneColor, toneForKd, toneForWinRate } from "./player-stats-format";
import { STATS_COLORS, styles } from "./player-stats-styles";
export type PerformanceCardProps = {
  onRequestDetails: () => void;
  seasonStats: SeasonPerformanceStats | null;
};

/**
 * PerformanceCard – Card tổng quan hiệu suất (tab overview): badge tên ACT,
 * nút "DETAILS" và lưới 4 metric (ADR, K/D, HS%, WIN%) có tô màu ngữ nghĩa.
 *
 * @param onRequestDetails – Callback mở tab details.
 * @param seasonStats – Dữ liệu season hiện tại.
 * @returns Fragment header + lưới metric.
 */
export function PerformanceCard({
  onRequestDetails,
  seasonStats,
}: PerformanceCardProps) {
  return (
    <>
      <CardHeader
        icon="hexagon-multiple-outline"
        title="PERFORMANCE OVERVIEW"
        right={
          <View style={styles.performanceHeaderActions}>
            <View style={styles.actBadge}>
              <Text style={styles.actBadgeText} numberOfLines={1}>
                {seasonStats?.seasonName || "CURRENT ACT"}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open detailed statistics"
              onPress={onRequestDetails}
              style={({ pressed }) => [
                styles.outlineButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Icon name="chart-box-outline" size={10} color={STATS_COLORS.accent} />
              <Text style={styles.outlineButtonText}>DETAILS</Text>
            </Pressable>
          </View>
        }
      />
      <View style={styles.metricGrid}>
        <MetricCell label="ADR" value={oneDecimal(seasonStats?.adr)} />
        <MetricCell
          label="K/D"
          value={oneDecimal(seasonStats?.kd)}
          tone={toneForKd(seasonStats?.kd)}
          right
        />
        <MetricCell
          label="HS%"
          value={percentage(seasonStats?.headshotPercent)}
          bottom
        />
        <MetricCell
          label="WIN%"
          value={percentage(seasonStats?.winRate)}
          tone={toneForWinRate(seasonStats?.winRate)}
          right
          bottom
        />
      </View>
    </>
  );
}

/**
 * AgentsMapsCardProps – Props của AgentsMapsCard.
 *
 * @param agentRows – Bảng tổng hợp theo agent (đã sort, tối đa 6 dòng).
 * @param mapRows – Bảng tổng hợp theo map (đã sort, tối đa 6 dòng).
 * @param totalGames – Tổng số game hiển thị trên header.
 */
export type AgentsMapsCardProps = {
  agentRows: AggregateRow[];
  mapRows: AggregateRow[];
  totalGames: number;
};

/**
 * AgentsMapsCard – Card bảng thống kê theo agent/map (tab overview):
 * 2 tab con "AGENTS"/"MAPS" (state nội bộ mode), bảng cột WINS/K/D/ADR/HS%
 * với màu ngữ nghĩa, avatar agent; trống hiện empty state.
 *
 * @param agentRows – Dòng tổng hợp theo agent.
 * @param mapRows – Dòng tổng hợp theo map.
 * @param totalGames – Tổng game hiển thị trên header.
 * @returns Fragment header + tabs + bảng hoặc trạng thái rỗng.
 */
export function AgentsMapsCard({
  agentRows,
  mapRows,
  totalGames,
}: AgentsMapsCardProps) {
  // mode: bảng đang hiển thị theo agent hay map (state nội bộ)
  const [mode, setMode] = React.useState<TableMode>("agents");
  // rows: dòng dữ liệu của mode hiện tại
  const rows = mode === "agents" ? agentRows : mapRows;

  return (
    <>
      <CardHeader
        icon="account-group-outline"
        title="AGENTS & MAPS"
        right={<Text style={styles.headerMeta}>{totalGames} GAMES</Text>}
      />
      <View accessibilityRole="tablist" style={styles.tableTabs}>
        {(["agents", "maps"] as const).map((tab) => {
          const active = mode === tab;
          return (
            <Pressable
              key={tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setMode(tab)}
              style={styles.tableTab}
            >
              <Text style={[styles.tableTabText, active && styles.tableTabTextActive]}>
                {tab.toUpperCase()}
              </Text>
              <View style={[styles.tableTabLine, active && styles.tableTabLineActive]} />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.tableHeaderRow}>
        <Text style={[styles.tableHeaderText, styles.nameColumn]}>
          {mode === "agents" ? "AGENT" : "MAP"}
        </Text>
        <Text style={[styles.tableHeaderText, styles.statColumn]}>WINS</Text>
        <Text style={[styles.tableHeaderText, styles.statColumn]}>K/D</Text>
        <Text style={[styles.tableHeaderText, styles.statColumn]}>ADR</Text>
        <Text style={[styles.tableHeaderText, styles.statColumn]}>HS%</Text>
      </View>
      {rows.length > 0 ? (
        rows.map((row) => (
          <View key={row.id} style={styles.tableDataRow}>
            <View style={[styles.tableNameCell, styles.nameColumn]}>
              {mode === "agents" && row.imageUrl ? (
                <Image
                  cacheId={`profile-stats-agent:${row.id}`}
                  source={{ uri: row.imageUrl }}
                  style={styles.agentAvatar}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  recyclingKey={row.imageUrl}
                />
              ) : null}
              <Text style={styles.tableName} numberOfLines={1}>
                {row.name}
              </Text>
              <Text style={styles.gamesLabel}>{row.games}G</Text>
            </View>
            <Text
              style={[
                styles.tableValue,
                styles.statColumn,
                { color: toneColor(toneForWinRate(row.winPercent)) },
              ]}
            >
              {percentage(row.winPercent)}
            </Text>
            <Text
              style={[
                styles.tableValue,
                styles.statColumn,
                { color: toneColor(toneForKd(row.kd)) },
              ]}
            >
              {row.kd.toFixed(2)}
            </Text>
            <Text style={[styles.tableValue, styles.statColumn]}>
              {Math.round(row.adr)}
            </Text>
            <Text style={[styles.tableValue, styles.statColumn]}>
              {percentage(row.headshotPercent)}
            </Text>
          </View>
        ))
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            NO {mode === "agents" ? "AGENT" : "MAP"} DATA AVAILABLE
          </Text>
        </View>
      )}
    </>
  );
}

/**
 * RecentCompetitiveCardProps – Props của RecentCompetitiveCard.
 *
 * @param matches – Danh sách trận (chỉ dùng 6 trận mới nhất).
 */
export type RecentCompetitiveCardProps = {
  matches: MatchHistoryRecord[];
};

/**
 * RecentCompetitiveCard – Card 6 trận competitive gần nhất (tab overview):
 * mỗi hàng gồm ngày, rank icon + tên rank + map, kết quả W/L tỉ số và RR
 * thay đổi có tô màu; bỏ qua trận thiếu stats. Trống hiện empty state.
 *
 * @param matches – Danh sách trận.
 * @returns Fragment header + các hàng trận gần nhất.
 */
export function RecentCompetitiveCard({ matches }: RecentCompetitiveCardProps) {
  // recent: 6 trận mới nhất trong danh sách
  const recent = matches.slice(0, 6);

  return (
    <>
      <CardHeader
        icon="history"
        title="RECENT COMP"
        right={<Text style={styles.headerMeta}>{recent.length} MATCHES</Text>}
      />
      {recent.length > 0 ? (
        recent.map((match) => {
          const stats = match.stats;
          if (!stats) return null;
          const rr = stats.rrEarned;
          const result = getMatchHistoryResult(stats);
          const resultLabel = { win: "W", loss: "L", draw: "D", cancelled: "C", unknown: "--" }[result];
          const resultTone = result === "win" ? "positive" : result === "loss" ? "negative" : "neutral";
          return (
            <View key={match.MatchID} style={styles.recentRow}>
              <Text style={styles.recentDate}>
                {new Date(match.GameStartTime).toLocaleDateString(undefined, {
                  day: "2-digit",
                  month: "2-digit",
                })}
              </Text>
              <View style={styles.recentRankCell}>
                {stats.rankIcon ? (
                  <Image
                    cacheId={`profile-stats-rank:${stats.rankTier ?? stats.rankName}`}
                    source={{ uri: stats.rankIcon }}
                    style={styles.recentRankIcon}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                    recyclingKey={stats.rankIcon}
                  />
                ) : (
                  <Icon name="shield-outline" size={17} color={STATS_COLORS.textMuted} />
                )}
                <View style={styles.recentRankTextWrap}>
                  <Text style={styles.recentRankName} numberOfLines={1}>
                    {stats.rankName || "UNRATED"}
                  </Text>
                  <Text style={styles.recentMapName} numberOfLines={1}>
                    {stats.mapName}
                  </Text>
                </View>
              </View>
              <Text
                style={[
                  styles.recentResult,
                  { color: toneColor(resultTone) },
                ]}
              >
                {resultLabel} {stats.roundsWon}-{stats.roundsLost}
              </Text>
              <Text
                style={[
                  styles.recentRr,
                  {
                    color:
                      rr === null
                        ? STATS_COLORS.textMuted
                        : rr >= 0
                          ? STATS_COLORS.positive
                          : STATS_COLORS.negative,
                  },
                ]}
              >
                {rr === null ? "--" : `${rr >= 0 ? "+" : ""}${rr} RR`}
              </Text>
            </View>
          );
        })
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>NO MATCH DATA FOUND</Text>
        </View>
      )}
    </>
  );
}

/**
 * ActivityCardProps – Props của ActivityCard.
 *
 * @param matches – Danh sách trận dùng đếm heatmap.
 */
export type RankSummaryCardProps = {
  competitiveRank: CompetitiveRankSummary | null;
};

/**
 * RankSummaryCard – Card hồ sơ rank (tab details): 2 ô cạnh nhau hiển thị
 * rank hiện tại và rank đỉnh cao (icon cached + tên); thiếu dữ liệu hiện
 * "UNRATED" với icon shield.
 *
 * @param competitiveRank – Tóm tắt rank hiện tại/đỉnh.
 * @returns Fragment header + lưới 2 ô rank.
 */
export function RankSummaryCard({ competitiveRank }: RankSummaryCardProps) {
  // entries: dữ liệu 2 ô (current/peak) để map render
  const entries = [
    {
      key: "current",
      label: "CURRENT RANK",
      name: competitiveRank?.currentName || "UNRATED",
      icon: competitiveRank?.currentIcon,
    },
    {
      key: "peak",
      label: "PEAK RANK",
      name: competitiveRank?.peakName || "UNRATED",
      icon: competitiveRank?.peakIcon,
    },
  ];

  return (
    <>
      <CardHeader icon="shield-star-outline" title="RANK PROFILE" />
      <View style={styles.rankSummaryGrid}>
        {entries.map((entry, index) => (
          <View
            key={entry.key}
            style={[styles.rankSummaryCell, index > 0 && styles.rankSummaryCellRight]}
          >
            {entry.icon ? (
              <Image
                cacheId={`profile-stats-${entry.key}-rank`}
                source={{ uri: entry.icon }}
                style={styles.rankSummaryIcon}
                contentFit="contain"
                cachePolicy="memory-disk"
                recyclingKey={entry.icon}
              />
            ) : (
              <Icon name="shield-outline" size={28} color={STATS_COLORS.textMuted} />
            )}
            <View style={styles.rankSummaryText}>
              <Text style={styles.metricLabel}>{entry.label}</Text>
              <Text style={styles.rankSummaryValue} numberOfLines={1}>
                {entry.name}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </>
  );
}
