import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import React from "react";
import {
  LayoutChangeEvent,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { CachedImage as Image } from "~/components/CachedImage";
import type { MatchHistoryRecord, SeasonPerformanceStats } from "~/types/match-ui";
import type { CompetitiveRankSummary } from "~/utils/profile-cache";

export type StatsDashboardTab = "overview" | "details";

type PlayerStatsDashboardProps = {
  activeTab: StatsDashboardTab;
  competitiveRank: CompetitiveRankSummary | null;
  loading: boolean;
  matches: MatchHistoryRecord[];
  onRefresh: () => void;
  onRequestDetails: () => void;
  refreshing: boolean;
  seasonStats: SeasonPerformanceStats | null;
  totalMatches: number;
  transitionProgress: SharedValue<number>;
};

type DashboardTone = "positive" | "negative" | "neutral";
type TableMode = "agents" | "maps";

type AggregateRow = {
  adr: number;
  games: number;
  headshotPercent: number;
  id: string;
  imageUrl: string | null;
  kd: number;
  name: string;
  winPercent: number;
};

type ActivityCell = {
  count: number;
  date: Date;
  dateKey: string;
  future: boolean;
  level: 0 | 1 | 2 | 3 | 4 | 5;
};

const STATS_COLORS = {
  page: "#090A0B",
  card: "#141414",
  cardSecondary: "#101010",
  row: "#111111",
  border: "#2A2A2A",
  borderSecondary: "#202020",
  divider: "#242424",
  text: "#F1F1F1",
  textSecondary: "#A0A0A0",
  textMuted: "#646464",
  accent: "#A56BFF",
  accentDark: "#603A96",
  accentSoft: "rgba(165, 107, 255, 0.14)",
  positive: "#00F58C",
  negative: "#FF3B47",
  warning: "#F6C84C",
  neutral: "#D6D6D6",
} as const;

const MONO_FONT = Platform.select({
  android: "monospace",
  ios: "Menlo",
  web: "monospace",
});

const compactNumber = (value: number | null | undefined) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? "--"
    : Math.round(value).toLocaleString();

const oneDecimal = (value: number | null | undefined) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? "--"
    : value.toFixed(1);

const percentage = (value: number | null | undefined) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? "--"
    : `${Math.round(value)}%`;

const toneColor = (tone: DashboardTone) => {
  if (tone === "positive") return STATS_COLORS.positive;
  if (tone === "negative") return STATS_COLORS.negative;
  return STATS_COLORS.neutral;
};

const toneForKd = (value: number | null | undefined): DashboardTone =>
  value === null || value === undefined
    ? "neutral"
    : value >= 1
      ? "positive"
      : "negative";

const toneForWinRate = (value: number | null | undefined): DashboardTone =>
  value === null || value === undefined
    ? "neutral"
    : value >= 50
      ? "positive"
      : "negative";

const dayKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const aggregateMatches = (
  matches: MatchHistoryRecord[],
  mode: TableMode
): AggregateRow[] => {
  const groups = new Map<
    string,
    {
      adrTotal: number;
      deaths: number;
      games: number;
      hsCount: number;
      hsTotal: number;
      id: string;
      imageUrl: string | null;
      kills: number;
      name: string;
      wins: number;
    }
  >();

  matches.forEach((match) => {
    const stats = match.stats;
    if (!stats) return;

    const id =
      mode === "agents"
        ? stats.agentId || stats.agentName
        : stats.mapId || stats.mapName;
    const name = mode === "agents" ? stats.agentName : stats.mapName;
    if (!id || !name) return;

    const current = groups.get(id) ?? {
      adrTotal: 0,
      deaths: 0,
      games: 0,
      hsCount: 0,
      hsTotal: 0,
      id,
      imageUrl:
        mode === "agents"
          ? stats.agentIcon || stats.agentPortrait
          : stats.mapImage,
      kills: 0,
      name,
      wins: 0,
    };

    current.games += 1;
    current.wins += stats.won ? 1 : 0;
    current.kills += stats.kills;
    current.deaths += stats.deaths;
    current.adrTotal += stats.adr;
    if (stats.headshotPercent !== null) {
      current.hsTotal += stats.headshotPercent;
      current.hsCount += 1;
    }
    groups.set(id, current);
  });

  return Array.from(groups.values())
    .map((group) => ({
      adr: group.games > 0 ? group.adrTotal / group.games : 0,
      games: group.games,
      headshotPercent:
        group.hsCount > 0 ? group.hsTotal / group.hsCount : 0,
      id: group.id,
      imageUrl: group.imageUrl,
      kd: group.deaths > 0 ? group.kills / group.deaths : group.kills,
      name: group.name,
      winPercent: group.games > 0 ? (group.wins / group.games) * 100 : 0,
    }))
    .sort((left, right) => right.games - left.games || right.kd - left.kd)
    .slice(0, 6);
};

const buildActivityWeeks = (matches: MatchHistoryRecord[]) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const start = new Date(thisMonday);
  start.setDate(thisMonday.getDate() - 11 * 7);

  const counts = new Map<string, number>();
  matches.forEach((match) => {
    if (!match.GameStartTime) return;
    const date = new Date(match.GameStartTime);
    const key = dayKey(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return Array.from({ length: 12 }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex): ActivityCell => {
      const date = new Date(start);
      date.setDate(start.getDate() + weekIndex * 7 + dayIndex);
      const key = dayKey(date);
      const count = counts.get(key) ?? 0;
      return {
        count,
        date,
        dateKey: key,
        future: date.getTime() > today.getTime(),
        level: Math.min(5, count) as ActivityCell["level"],
      };
    })
  );
};

const lineStyle = (
  x1: number,
  y1: number,
  x2: number,
  y2: number
): ViewStyle => {
  const distance = Math.hypot(x2 - x1, y2 - y1);
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  return {
    position: "absolute",
    left: (x1 + x2 - distance) / 2,
    top: (y1 + y2) / 2 - 1,
    width: distance,
    height: 2,
    borderRadius: 2,
    backgroundColor: STATS_COLORS.accent,
    transform: [{ rotate: `${angle}deg` }],
  };
};

type DashboardCardProps = {
  children: React.ReactNode;
  index: number;
  tabProgress: SharedValue<number>;
  transitionProgress: SharedValue<number>;
};

function DashboardCard({
  children,
  index,
  tabProgress,
  transitionProgress,
}: DashboardCardProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const combined = transitionProgress.value * tabProgress.value;
    const start = Math.min(0.46, 0.04 + index * 0.075);
    const end = Math.min(0.94, start + 0.34);
    const reveal = interpolate(
      combined,
      [start, end],
      [0, 1],
      Extrapolation.CLAMP
    );

    return {
      opacity: reveal,
      transform: [
        { scale: interpolate(reveal, [0, 1], [0.66, 1]) },
        { translateY: interpolate(reveal, [0, 1], [18, 0]) },
      ],
    };
  }, [index]);

  return (
    <Animated.View style={[styles.card, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

type CardHeaderProps = {
  icon: React.ComponentProps<typeof Icon>["name"];
  right?: React.ReactNode;
  title: string;
};

function CardHeader({ icon, right, title }: CardHeaderProps) {
  return (
    <View style={styles.cardHeader}>
      <View style={styles.cardHeaderTitleRow}>
        <View style={styles.cardHeaderIcon}>
          <Icon name={icon} size={11} color={STATS_COLORS.accent} />
        </View>
        <Text style={styles.cardHeaderTitle}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

type MetricCellProps = {
  bottom?: boolean;
  label: string;
  right?: boolean;
  tone?: DashboardTone;
  value: string;
};

function MetricCell({
  bottom = false,
  label,
  right = false,
  tone = "neutral",
  value,
}: MetricCellProps) {
  return (
    <View
      style={[
        styles.metricCell,
        right && styles.metricCellRight,
        bottom && styles.metricCellBottom,
      ]}
    >
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color: toneColor(tone) }]}>
        {value}
      </Text>
    </View>
  );
}

type PerformanceCardProps = {
  onRequestDetails: () => void;
  seasonStats: SeasonPerformanceStats | null;
};

function PerformanceCard({
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

type AgentsMapsCardProps = {
  agentRows: AggregateRow[];
  mapRows: AggregateRow[];
  totalGames: number;
};

function AgentsMapsCard({
  agentRows,
  mapRows,
  totalGames,
}: AgentsMapsCardProps) {
  const [mode, setMode] = React.useState<TableMode>("agents");
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

type RecentCompetitiveCardProps = {
  matches: MatchHistoryRecord[];
};

function RecentCompetitiveCard({ matches }: RecentCompetitiveCardProps) {
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
                  { color: stats.won ? STATS_COLORS.positive : STATS_COLORS.negative },
                ]}
              >
                {stats.won ? "W" : "L"} {stats.roundsWon}-{stats.roundsLost}
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

type ActivityCardProps = {
  matches: MatchHistoryRecord[];
};

function ActivityCard({ matches }: ActivityCardProps) {
  const weeks = React.useMemo(() => buildActivityWeeks(matches), [matches]);
  const [selectedCell, setSelectedCell] = React.useState<ActivityCell | null>(null);
  const activityColors = [
    "#1A1A1A",
    "#2A2037",
    "#453060",
    "#67439A",
    "#8B59DD",
    "#A66BFF",
  ];

  return (
    <>
      <CardHeader
        icon="calendar-blank-outline"
        title="ACTIVITY"
        right={<Text style={styles.headerMeta}>{matches.length} MATCHES</Text>}
      />
      <View style={styles.activityBody}>
        <View style={styles.activityMonthRow}>
          {weeks.map((week, index) => (
            <Text key={week[0].dateKey} style={styles.activityMonthText}>
              {index % 3 === 0
                ? week[0].date.toLocaleDateString(undefined, { month: "short" }).toUpperCase()
                : ""}
            </Text>
          ))}
        </View>
        <View style={styles.activityGridRow}>
          <View style={styles.activityDayLabels}>
            <Text style={styles.activityDayText}>MON</Text>
            <Text style={styles.activityDayText}>WED</Text>
            <Text style={styles.activityDayText}>FRI</Text>
          </View>
          <ScrollView
            horizontal
            contentContainerStyle={styles.activityWeeks}
            showsHorizontalScrollIndicator={false}
          >
            {weeks.map((week) => (
              <View key={week[0].dateKey} style={styles.activityWeek}>
                {week.map((cell) => (
                  <Pressable
                    key={cell.dateKey}
                    accessibilityRole="button"
                    accessibilityLabel={`${cell.date.toLocaleDateString()}: ${cell.count} matches`}
                    disabled={cell.future}
                    onPress={() => setSelectedCell(cell)}
                    style={[
                      styles.activityCell,
                      {
                        backgroundColor: cell.future
                          ? "transparent"
                          : activityColors[cell.level],
                      },
                      selectedCell?.dateKey === cell.dateKey && styles.activityCellSelected,
                    ]}
                  />
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
        <View style={styles.activityFooter}>
          <Text style={styles.activitySelection} numberOfLines={1}>
            {selectedCell
              ? `${selectedCell.date.toLocaleDateString()} · ${selectedCell.count} MATCHES`
              : "TAP A CELL FOR DETAILS"}
          </Text>
          <View style={styles.activityLegend}>
            {activityColors.map((color, index) => (
              <View key={color} style={styles.activityLegendItem}>
                <View style={[styles.activityLegendCell, { backgroundColor: color }]} />
                <Text style={styles.activityLegendText}>{index === 5 ? "5+" : index}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </>
  );
}

type RrTrendCardProps = {
  matches: MatchHistoryRecord[];
};

function RrTrendCard({ matches }: RrTrendCardProps) {
  const [chartWidth, setChartWidth] = React.useState(280);
  const points = React.useMemo(
    () =>
      matches
        .flatMap((match) => {
          const rr = match.stats?.rrAfter ?? match.rankUpdate?.RankedRatingAfterUpdate;
          return rr === null || rr === undefined ? [] : [rr];
        })
        .slice(0, 10)
        .reverse(),
    [matches]
  );
  const plotWidth = Math.max(120, chartWidth - 42);
  const minimum = points.length > 0 ? Math.min(...points) : 0;
  const maximum = points.length > 0 ? Math.max(...points) : 100;
  const range = Math.max(10, maximum - minimum);
  const yForValue = (value: number) => 10 + ((maximum - value) / range) * 74;
  const xForIndex = (index: number) =>
    8 + (points.length <= 1 ? 0 : (index / (points.length - 1)) * (plotWidth - 16));
  const handleLayout = (event: LayoutChangeEvent) => {
    setChartWidth(event.nativeEvent.layout.width);
  };

  return (
    <>
      <CardHeader
        icon="chart-timeline-variant"
        title="RR TREND"
        right={<Text style={styles.headerMeta}>{points.length} PTS · RECENT</Text>}
      />
      <View onLayout={handleLayout} style={styles.trendChart}>
        {points.length >= 2 ? (
          <>
            <View style={[styles.trendGridLine, { top: 10 }]} />
            <View style={[styles.trendGridLine, { top: 47 }]} />
            <View style={[styles.trendGridLine, { top: 84 }]} />
            {points.slice(0, -1).map((point, index) => (
              <View
                key={`${index}-${point}`}
                style={lineStyle(
                  xForIndex(index),
                  yForValue(point),
                  xForIndex(index + 1),
                  yForValue(points[index + 1])
                )}
              />
            ))}
            {points.map((point, index) => (
              <View
                key={`point-${index}-${point}`}
                style={[
                  styles.trendPoint,
                  {
                    left: xForIndex(index) - 2.5,
                    top: yForValue(point) - 2.5,
                  },
                ]}
              />
            ))}
            <Text style={[styles.trendAxisLabel, { top: 4 }]}>{maximum}</Text>
            <Text style={[styles.trendAxisLabel, { top: 78 }]}>{minimum}</Text>
          </>
        ) : (
          <View style={styles.trendEmpty}>
            <Icon name="chart-line" size={20} color={STATS_COLORS.textMuted} />
            <Text style={styles.emptyStateText}>NOT ENOUGH RR DATA</Text>
          </View>
        )}
      </View>
    </>
  );
}

type RankSummaryCardProps = {
  competitiveRank: CompetitiveRankSummary | null;
};

function RankSummaryCard({ competitiveRank }: RankSummaryCardProps) {
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

type DetailRow = {
  label: string;
  tone?: DashboardTone;
  value: string;
};

type DetailSectionProps = {
  rows: DetailRow[];
  title: string;
};

function DetailSection({ rows, title }: DetailSectionProps) {
  return (
    <>
      <CardHeader icon="code-tags" title={title} />
      {rows.map((row) => (
        <View key={row.label} style={styles.detailRow}>
          <Text style={styles.detailLabel}>{row.label}</Text>
          <Text
            style={[
              styles.detailValue,
              { color: toneColor(row.tone ?? "neutral") },
            ]}
          >
            {row.value}
          </Text>
        </View>
      ))}
    </>
  );
}

function PlayerStatsDashboard({
  activeTab,
  competitiveRank,
  loading,
  matches,
  onRefresh,
  onRequestDetails,
  refreshing,
  seasonStats,
  totalMatches,
  transitionProgress,
}: PlayerStatsDashboardProps) {
  const tabProgress = useSharedValue(0);
  const competitiveMatches = React.useMemo(
    () =>
      matches
        .filter(
          (match) =>
            match.stats &&
            (!match.QueueID || match.QueueID.toLowerCase() === "competitive")
        )
        .sort((left, right) => right.GameStartTime - left.GameStartTime),
    [matches]
  );
  const agentRows = React.useMemo(
    () => aggregateMatches(competitiveMatches, "agents"),
    [competitiveMatches]
  );
  const mapRows = React.useMemo(
    () => aggregateMatches(competitiveMatches, "maps"),
    [competitiveMatches]
  );

  React.useEffect(() => {
    tabProgress.value = 0;
    tabProgress.value = withTiming(1, {
      duration: 520,
      easing: Easing.out(Easing.cubic),
    });
  }, [activeTab, tabProgress]);

  const killsPerRound =
    seasonStats && seasonStats.roundsPlayed > 0
      ? seasonStats.kills / seasonStats.roundsPlayed
      : null;
  const combatRows: DetailRow[] = [
    { label: "K/D", value: oneDecimal(seasonStats?.kd), tone: toneForKd(seasonStats?.kd) },
    { label: "ACS", value: oneDecimal(seasonStats?.acs) },
    { label: "DMG / ROUND", value: oneDecimal(seasonStats?.adr) },
    { label: "KILLS / ROUND", value: oneDecimal(killsPerRound) },
    { label: "HS%", value: percentage(seasonStats?.headshotPercent) },
    { label: "KAST%", value: percentage(seasonStats?.kast) },
  ];
  const totalRows: DetailRow[] = [
    { label: "KILLS", value: compactNumber(seasonStats?.kills) },
    { label: "DEATHS", value: compactNumber(seasonStats?.deaths) },
    { label: "HEADSHOTS", value: compactNumber(seasonStats?.headshots) },
    { label: "DAMAGE", value: compactNumber(seasonStats?.damage) },
    { label: "SCORE", value: compactNumber(seasonStats?.score) },
    { label: "ROUNDS", value: compactNumber(seasonStats?.roundsPlayed) },
  ];
  const recordRows: DetailRow[] = [
    { label: "WINS", value: compactNumber(seasonStats?.wins), tone: "positive" },
    { label: "LOSSES", value: compactNumber(seasonStats?.losses), tone: "negative" },
    { label: "GAMES", value: compactNumber(seasonStats?.matchCount) },
    {
      label: "WIN%",
      value: percentage(seasonStats?.winRate),
      tone: toneForWinRate(seasonStats?.winRate),
    },
  ];

  return (
    <Animated.ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={STATS_COLORS.accent}
          colors={[STATS_COLORS.accent]}
          progressBackgroundColor={STATS_COLORS.card}
        />
      }
    >
      {loading && !seasonStats ? (
        <View style={styles.loadingBar}>
          <View style={styles.loadingDot} />
          <Text style={styles.loadingText}>SYNCING PERFORMANCE DATA</Text>
        </View>
      ) : null}

      {activeTab === "overview" ? (
        <>
          <DashboardCard
            index={0}
            tabProgress={tabProgress}
            transitionProgress={transitionProgress}
          >
            <PerformanceCard
              onRequestDetails={onRequestDetails}
              seasonStats={seasonStats}
            />
          </DashboardCard>
          <DashboardCard
            index={1}
            tabProgress={tabProgress}
            transitionProgress={transitionProgress}
          >
            <AgentsMapsCard
              agentRows={agentRows}
              mapRows={mapRows}
              totalGames={seasonStats?.matchCount ?? competitiveMatches.length}
            />
          </DashboardCard>
          <DashboardCard
            index={2}
            tabProgress={tabProgress}
            transitionProgress={transitionProgress}
          >
            <RecentCompetitiveCard matches={competitiveMatches} />
          </DashboardCard>
          <DashboardCard
            index={3}
            tabProgress={tabProgress}
            transitionProgress={transitionProgress}
          >
            <ActivityCard matches={competitiveMatches} />
          </DashboardCard>
          <DashboardCard
            index={4}
            tabProgress={tabProgress}
            transitionProgress={transitionProgress}
          >
            <RrTrendCard matches={competitiveMatches} />
          </DashboardCard>
        </>
      ) : (
        <>
          <DashboardCard
            index={0}
            tabProgress={tabProgress}
            transitionProgress={transitionProgress}
          >
            <RankSummaryCard competitiveRank={competitiveRank} />
          </DashboardCard>
          <DashboardCard
            index={1}
            tabProgress={tabProgress}
            transitionProgress={transitionProgress}
          >
            <DetailSection title="COMBAT" rows={combatRows} />
          </DashboardCard>
          <DashboardCard
            index={2}
            tabProgress={tabProgress}
            transitionProgress={transitionProgress}
          >
            <DetailSection title="TOTALS" rows={totalRows} />
          </DashboardCard>
          <DashboardCard
            index={3}
            tabProgress={tabProgress}
            transitionProgress={transitionProgress}
          >
            <DetailSection title="RECORD" rows={recordRows} />
          </DashboardCard>
        </>
      )}

      <Text style={styles.dashboardFooter}>
        {totalMatches > 0
          ? `${totalMatches.toLocaleString()} MATCHES IN ACCOUNT HISTORY`
          : "VALORANT PERFORMANCE · VSHOP"}
      </Text>
    </Animated.ScrollView>
  );
}

export default React.memo(PlayerStatsDashboard);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: STATS_COLORS.page,
  },
  screenContent: {
    paddingHorizontal: 6,
    paddingTop: 10,
    paddingBottom: 140,
  },
  card: {
    marginBottom: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: STATS_COLORS.border,
    backgroundColor: STATS_COLORS.card,
    overflow: "hidden",
  },
  cardHeader: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: STATS_COLORS.divider,
  },
  cardHeaderTitleRow: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
  },
  cardHeaderIcon: {
    width: 19,
    height: 19,
    marginRight: 7,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: STATS_COLORS.accentSoft,
  },
  cardHeaderTitle: {
    flexShrink: 1,
    color: STATS_COLORS.text,
    fontFamily: MONO_FONT,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "700",
    letterSpacing: 1.05,
  },
  headerMeta: {
    marginLeft: 8,
    color: STATS_COLORS.textMuted,
    fontFamily: MONO_FONT,
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 0.6,
    fontVariant: ["tabular-nums"],
  },
  performanceHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 6,
  },
  actBadge: {
    maxWidth: 62,
    marginRight: 5,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: STATS_COLORS.borderSecondary,
    backgroundColor: STATS_COLORS.cardSecondary,
  },
  actBadgeText: {
    color: STATS_COLORS.textSecondary,
    fontFamily: MONO_FONT,
    fontSize: 7,
    fontWeight: "700",
    letterSpacing: 0.35,
  },
  outlineButton: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 7,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: STATS_COLORS.accentDark,
  },
  outlineButtonText: {
    marginLeft: 4,
    color: STATS_COLORS.accent,
    fontFamily: MONO_FONT,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.55,
  },
  buttonPressed: {
    opacity: 0.75,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  metricCell: {
    width: "50%",
    minHeight: 62,
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: STATS_COLORS.divider,
  },
  metricCellRight: {
    borderLeftWidth: 1,
    borderLeftColor: STATS_COLORS.divider,
  },
  metricCellBottom: {
    borderBottomWidth: 0,
  },
  metricLabel: {
    color: STATS_COLORS.textMuted,
    fontFamily: MONO_FONT,
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1,
  },
  metricValue: {
    marginTop: 6,
    fontFamily: MONO_FONT,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  tableTabs: {
    minHeight: 40,
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: STATS_COLORS.divider,
  },
  tableTab: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  tableTabText: {
    color: STATS_COLORS.textMuted,
    fontFamily: MONO_FONT,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.9,
  },
  tableTabTextActive: {
    color: STATS_COLORS.text,
  },
  tableTabLine: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: "transparent",
  },
  tableTabLineActive: {
    backgroundColor: STATS_COLORS.accent,
  },
  tableHeaderRow: {
    minHeight: 27,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    backgroundColor: STATS_COLORS.cardSecondary,
    borderBottomWidth: 1,
    borderBottomColor: STATS_COLORS.borderSecondary,
  },
  tableHeaderText: {
    color: STATS_COLORS.textMuted,
    fontFamily: MONO_FONT,
    fontSize: 7,
    fontWeight: "700",
    letterSpacing: 0.45,
    textAlign: "right",
  },
  nameColumn: {
    flex: 0.51,
  },
  statColumn: {
    flex: 0.1225,
    minWidth: 0,
  },
  tableDataRow: {
    minHeight: 37,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    borderBottomWidth: 1,
    borderBottomColor: STATS_COLORS.borderSecondary,
    backgroundColor: STATS_COLORS.row,
  },
  tableNameCell: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 4,
  },
  agentAvatar: {
    width: 20,
    height: 20,
    marginRight: 6,
    borderRadius: 3,
    backgroundColor: STATS_COLORS.cardSecondary,
  },
  tableName: {
    minWidth: 0,
    flexShrink: 1,
    color: STATS_COLORS.text,
    fontSize: 10,
    fontWeight: "700",
  },
  gamesLabel: {
    marginLeft: 4,
    color: STATS_COLORS.textMuted,
    fontFamily: MONO_FONT,
    fontSize: 7.5,
    fontVariant: ["tabular-nums"],
  },
  tableValue: {
    color: STATS_COLORS.neutral,
    fontFamily: MONO_FONT,
    fontSize: 9,
    fontWeight: "700",
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  emptyState: {
    minHeight: 74,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  emptyStateText: {
    color: STATS_COLORS.textMuted,
    fontFamily: MONO_FONT,
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 0.7,
    textAlign: "center",
  },
  recentRow: {
    minHeight: 43,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    borderBottomWidth: 1,
    borderBottomColor: STATS_COLORS.borderSecondary,
    backgroundColor: STATS_COLORS.row,
  },
  recentDate: {
    width: "13%",
    color: STATS_COLORS.textMuted,
    fontFamily: MONO_FONT,
    fontSize: 7.5,
    fontVariant: ["tabular-nums"],
  },
  recentRankCell: {
    width: "43%",
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  recentRankIcon: {
    width: 22,
    height: 22,
    marginRight: 5,
  },
  recentRankTextWrap: {
    minWidth: 0,
    flex: 1,
  },
  recentRankName: {
    color: STATS_COLORS.text,
    fontFamily: MONO_FONT,
    fontSize: 9,
    fontWeight: "700",
  },
  recentMapName: {
    marginTop: 2,
    color: STATS_COLORS.textMuted,
    fontSize: 8,
  },
  recentResult: {
    width: "23%",
    fontFamily: MONO_FONT,
    fontSize: 9,
    fontWeight: "800",
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  recentRr: {
    width: "21%",
    fontFamily: MONO_FONT,
    fontSize: 8,
    fontWeight: "700",
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  activityBody: {
    paddingHorizontal: 9,
    paddingVertical: 10,
  },
  activityMonthRow: {
    flexDirection: "row",
    paddingLeft: 31,
    marginBottom: 5,
  },
  activityMonthText: {
    width: 15,
    color: STATS_COLORS.textMuted,
    fontFamily: MONO_FONT,
    fontSize: 6.5,
  },
  activityGridRow: {
    flexDirection: "row",
  },
  activityDayLabels: {
    width: 31,
    height: 95,
    justifyContent: "space-around",
    paddingVertical: 3,
  },
  activityDayText: {
    color: STATS_COLORS.textMuted,
    fontFamily: MONO_FONT,
    fontSize: 6.5,
  },
  activityWeeks: {
    flexDirection: "row",
    paddingRight: 2,
  },
  activityWeek: {
    width: 15,
    marginRight: 1,
  },
  activityCell: {
    width: 11,
    height: 11,
    marginBottom: 2,
    borderRadius: 2,
  },
  activityCellSelected: {
    borderWidth: 1,
    borderColor: STATS_COLORS.text,
  },
  activityFooter: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 7,
  },
  activitySelection: {
    flex: 1,
    paddingRight: 8,
    color: STATS_COLORS.textMuted,
    fontFamily: MONO_FONT,
    fontSize: 6.5,
    letterSpacing: 0.25,
  },
  activityLegend: {
    flexDirection: "row",
  },
  activityLegendItem: {
    alignItems: "center",
    marginLeft: 4,
  },
  activityLegendCell: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  activityLegendText: {
    marginTop: 2,
    color: STATS_COLORS.textMuted,
    fontFamily: MONO_FONT,
    fontSize: 5.5,
  },
  trendChart: {
    height: 104,
    marginHorizontal: 9,
    marginVertical: 8,
    position: "relative",
    overflow: "hidden",
  },
  trendGridLine: {
    position: "absolute",
    left: 8,
    right: 34,
    height: 1,
    backgroundColor: STATS_COLORS.borderSecondary,
  },
  trendPoint: {
    position: "absolute",
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: STATS_COLORS.accent,
  },
  trendAxisLabel: {
    position: "absolute",
    right: 0,
    width: 30,
    color: STATS_COLORS.textMuted,
    fontFamily: MONO_FONT,
    fontSize: 7,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  trendEmpty: {
    flex: 1,
    gap: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  rankSummaryGrid: {
    flexDirection: "row",
  },
  rankSummaryCell: {
    width: "50%",
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  rankSummaryCellRight: {
    borderLeftWidth: 1,
    borderLeftColor: STATS_COLORS.divider,
  },
  rankSummaryIcon: {
    width: 34,
    height: 34,
    marginRight: 8,
  },
  rankSummaryText: {
    minWidth: 0,
    flex: 1,
  },
  rankSummaryValue: {
    marginTop: 5,
    color: STATS_COLORS.text,
    fontFamily: MONO_FONT,
    fontSize: 11,
    fontWeight: "800",
  },
  detailRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#191919",
    backgroundColor: STATS_COLORS.row,
  },
  detailLabel: {
    color: STATS_COLORS.textSecondary,
    fontFamily: MONO_FONT,
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.9,
  },
  detailValue: {
    color: STATS_COLORS.text,
    fontFamily: MONO_FONT,
    fontSize: 13,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  loadingBar: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: STATS_COLORS.border,
    backgroundColor: STATS_COLORS.card,
  },
  loadingDot: {
    width: 6,
    height: 6,
    marginRight: 8,
    borderRadius: 3,
    backgroundColor: STATS_COLORS.accent,
  },
  loadingText: {
    color: STATS_COLORS.textSecondary,
    fontFamily: MONO_FONT,
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.7,
  },
  dashboardFooter: {
    marginTop: 3,
    color: STATS_COLORS.textMuted,
    fontFamily: MONO_FONT,
    fontSize: 7,
    lineHeight: 12,
    letterSpacing: 0.55,
    textAlign: "center",
  },
});
