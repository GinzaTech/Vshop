// Player statistics dashboard: composition and tab lifecycle.
import React from "react";
import { FlatList, Platform, RefreshControl, Text, View } from "react-native";
import { Easing, ReduceMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { MOTION_DURATION } from "~/constants/Motion";
import type { MatchHistoryRecord, SeasonPerformanceStats } from "~/types/match-ui";
import type { CompetitiveRankSummary } from "~/utils/profile-cache";
import { aggregateMatches } from "./player-stats-data";
import { compactNumber, oneDecimal, percentage, toneForKd, toneForWinRate } from "./player-stats-format";
import { DashboardCard, DetailRow, DetailSection } from "./PlayerStatsPrimitives";
import { AgentsMapsCard, PerformanceCard, RankSummaryCard, RecentCompetitiveCard } from "./PlayerStatsSections";
import { ActivityCard, RrTrendCard } from "./PlayerStatsActivity";
import { STATS_COLORS, styles } from "./player-stats-styles";

export { aggregateMatches } from "./player-stats-data";
export type { AggregateRow } from "./player-stats-data";

export type StatsDashboardTab = "overview" | "details";

/**
 * PlayerStatsDashboardProps – Props của PlayerStatsDashboard.
 *
 * @param activeTab – Tab đang hiển thị ("overview" | "details").
 * @param competitiveRank – Tóm tắt rank cạnh tranh (hoặc null nếu chưa có).
 * @param loading – Đang sync dữ liệu lần đầu (hiện thanh loading header).
 * @param matches – Toàn bộ trận (được lọc competitive nội bộ).
 * @param onRefresh – Callback pull-to-refresh.
 * @param onRequestDetails – Callback khi bấm "DETAILS" (chuyển tab details).
 * @param refreshing – Trạng thái pull-to-refresh đang chạy.
 * @param seasonStats – Thống kê season hiện tại (null nếu chưa có).
 * @param totalMatches – Tổng số trận trong account history (footer).
 */
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
};

type DashboardCardKind =
  | "performance"
  | "agents-maps"
  | "recent"
  | "activity"
  | "rr-trend"
  | "rank-summary"
  | "combat"
  | "totals"
  | "record";

// DashboardCardItem: Item của FlatList dashboard (key trùng kind)
type DashboardCardItem = {
  key: DashboardCardKind;
  kind: DashboardCardKind;
};

// Danh sách card của tab OVERVIEW (theo thứ tự hiển thị)
const OVERVIEW_DASHBOARD_CARDS: DashboardCardItem[] = [
  { key: "performance", kind: "performance" },
  { key: "agents-maps", kind: "agents-maps" },
  { key: "recent", kind: "recent" },
  { key: "activity", kind: "activity" },
  { key: "rr-trend", kind: "rr-trend" },
];

// Danh sách card của tab DETAILS (theo thứ tự hiển thị)
const DETAIL_DASHBOARD_CARDS: DashboardCardItem[] = [
  { key: "rank-summary", kind: "rank-summary" },
  { key: "combat", kind: "combat" },
  { key: "totals", kind: "totals" },
  { key: "record", kind: "record" },
];

// dashboardCardKeyExtractor: key FlatList = key của card
const dashboardCardKeyExtractor = (item: DashboardCardItem) => item.key;

/**
 * PlayerStatsDashboard – Dashboard thống kê chính (export memo hoá).
 * Lọc trận competitive + sort mới nhất (memo), tổng hợp theo agent/map,
 * animate tabProgress mỗi khi đổi tab (useLayoutEffect + withTiming,
 * tôn trọng ReduceMotion.System), dựng các dòng detail (combat/totals/
 * record) và render danh sách card qua FlatList với RefreshControl.
 *
 * @param activeTab – Tab đang hiển thị.
 * @param competitiveRank – Tóm tắt rank.
 * @param loading – Đang sync lần đầu.
 * @param matches – Danh sách trận.
 * @param onRefresh – Callback pull-to-refresh.
 * @param onRequestDetails – Callback chuyển sang tab details.
 * @param refreshing – Trạng thái refreshing.
 * @param seasonStats – Thống kê season.
 * @param totalMatches – Tổng số trận (footer).
 * @returns FlatList các dashboard card.
 *
 * Side effects: withTiming trên tabProgress (UI thread); không timer/
 * subscription trực tiếp. FlatList tuning: initialNumToRender 2,
 * maxToRenderPerBatch 1, windowSize 3, removeClippedSubviews trên Android.
 */
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
}: PlayerStatsDashboardProps) {
  // tabProgress: SharedValue 0..1 điều khiển entrance animation các card
  const tabProgress = useSharedValue(1);
  // previousActiveTabRef: tab lần render trước (phát hiện đổi tab)
  const previousActiveTabRef = React.useRef(activeTab);
  // competitiveMatches: trận có stats + queue competitive (hoặc trống),
  // sort mới nhất trước (memo theo matches)
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
  // agentRows/mapRows: bảng tổng hợp theo agent và theo map (memo)
  const agentRows = React.useMemo(
    () => aggregateMatches(competitiveMatches, "agents"),
    [competitiveMatches]
  );
  const mapRows = React.useMemo(
    () => aggregateMatches(competitiveMatches, "maps"),
    [competitiveMatches]
  );

  // Effect: đổi tab → reset tabProgress về 0 rồi animate lên 1 (0.25s,
  // easing cubic out, tuân theo Reduce Motion hệ thống)
  React.useLayoutEffect(() => {
    if (previousActiveTabRef.current === activeTab) return;

    previousActiveTabRef.current = activeTab;
    tabProgress.value = 0;
    tabProgress.value = withTiming(1, {
      duration: MOTION_DURATION.standard,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
  }, [activeTab, tabProgress]);

  // killsPerRound: số kill trung bình mỗi vòng (null nếu chưa có rounds)
  const killsPerRound =
    seasonStats && seasonStats.roundsPlayed > 0
      ? seasonStats.kills / seasonStats.roundsPlayed
      : null;
  // combatRows/totalRows/recordRows: dữ liệu 3 section của tab details
  const combatRows = React.useMemo<DetailRow[]>(
    () => [
      {
        label: "K/D",
        value: oneDecimal(seasonStats?.kd),
        tone: toneForKd(seasonStats?.kd),
      },
      { label: "ACS", value: oneDecimal(seasonStats?.acs) },
      { label: "DMG / ROUND", value: oneDecimal(seasonStats?.adr) },
      { label: "KILLS / ROUND", value: oneDecimal(killsPerRound) },
      { label: "HS%", value: percentage(seasonStats?.headshotPercent) },
      { label: "KAST%", value: percentage(seasonStats?.kast) },
    ],
    [killsPerRound, seasonStats]
  );
  const totalRows = React.useMemo<DetailRow[]>(
    () => [
      { label: "KILLS", value: compactNumber(seasonStats?.kills) },
      { label: "DEATHS", value: compactNumber(seasonStats?.deaths) },
      { label: "HEADSHOTS", value: compactNumber(seasonStats?.headshots) },
      { label: "DAMAGE", value: compactNumber(seasonStats?.damage) },
      { label: "SCORE", value: compactNumber(seasonStats?.score) },
      { label: "ROUNDS", value: compactNumber(seasonStats?.roundsPlayed) },
    ],
    [seasonStats]
  );
  const recordRows = React.useMemo<DetailRow[]>(
    () => [
      {
        label: "WINS",
        value: compactNumber(seasonStats?.wins),
        tone: "positive",
      },
      {
        label: "LOSSES",
        value: compactNumber(seasonStats?.losses),
        tone: "negative",
      },
      { label: "DRAWS", value: compactNumber(seasonStats?.draws) },
      { label: "GAMES", value: compactNumber(seasonStats?.matchCount) },
      {
        label: "WIN%",
        value: percentage(seasonStats?.winRate),
        tone: toneForWinRate(seasonStats?.winRate),
      },
    ],
    [seasonStats]
  );
  // dashboardCards: danh sách card theo tab hiện tại
  const dashboardCards =
    activeTab === "overview"
      ? OVERVIEW_DASHBOARD_CARDS
      : DETAIL_DASHBOARD_CARDS;
  // renderDashboardCard: map kind → nội dung card tương ứng, bọc trong
  // DashboardCard để có entrance animation
  const renderDashboardCard = React.useCallback(
    ({ item, index }: { item: DashboardCardItem; index: number }) => {
      let content: React.ReactNode = null;

      switch (item.kind) {
        case "performance":
          content = (
            <PerformanceCard
              onRequestDetails={onRequestDetails}
              seasonStats={seasonStats}
            />
          );
          break;
        case "agents-maps":
          content = (
            <AgentsMapsCard
              agentRows={agentRows}
              mapRows={mapRows}
              totalGames={
                seasonStats?.matchCount ?? competitiveMatches.length
              }
            />
          );
          break;
        case "recent":
          content = <RecentCompetitiveCard matches={competitiveMatches} />;
          break;
        case "activity":
          content = <ActivityCard matches={competitiveMatches} />;
          break;
        case "rr-trend":
          content = <RrTrendCard matches={competitiveMatches} />;
          break;
        case "rank-summary":
          content = <RankSummaryCard competitiveRank={competitiveRank} />;
          break;
        case "combat":
          content = <DetailSection title="COMBAT" rows={combatRows} />;
          break;
        case "totals":
          content = <DetailSection title="TOTALS" rows={totalRows} />;
          break;
        case "record":
          content = <DetailSection title="RECORD" rows={recordRows} />;
          break;
      }

      return (
        <DashboardCard index={index} tabProgress={tabProgress}>
          {content}
        </DashboardCard>
      );
    },
    [
      agentRows,
      combatRows,
      competitiveMatches,
      competitiveRank,
      mapRows,
      onRequestDetails,
      recordRows,
      seasonStats,
      tabProgress,
      totalRows,
    ]
  );

  return (
    <FlatList
      style={styles.screen}
      data={dashboardCards}
      keyExtractor={dashboardCardKeyExtractor}
      renderItem={renderDashboardCard}
      contentContainerStyle={styles.screenContent}
      showsVerticalScrollIndicator={false}
      initialNumToRender={2}
      maxToRenderPerBatch={1}
      updateCellsBatchingPeriod={64}
      windowSize={3}
      removeClippedSubviews={Platform.OS === "android"}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={STATS_COLORS.accent}
          colors={[STATS_COLORS.accent]}
          progressBackgroundColor={STATS_COLORS.card}
        />
      }
      ListHeaderComponent={loading && !seasonStats ? (
        <View style={styles.loadingBar}>
          <View style={styles.loadingDot} />
          <Text style={styles.loadingText}>SYNCING PERFORMANCE DATA</Text>
        </View>
      ) : null}

      ListFooterComponent={
        <Text style={styles.dashboardFooter}>
          {totalMatches > 0
            ? `${totalMatches.toLocaleString()} MATCHES IN ACCOUNT HISTORY`
            : "VALORANT PERFORMANCE · VSHOP"}
        </Text>
      }
    />
  );
}

export default React.memo(PlayerStatsDashboard);
