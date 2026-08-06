// ===== Import thư viện =====
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { FlatList, LayoutAnimation, Platform, Pressable, RefreshControl, StyleSheet, Text, UIManager, View } from "react-native";
import { ActivityIndicator } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { DailyMatchSummaryCard } from "~/components/matches/DailyMatchSummaryCard";
import { MatchCard } from "~/components/matches/MatchCard";
import { MatchHistoryHeader } from "~/components/matches/MatchHistoryHeader";
import { MatchCardSkeleton, MatchListSkeleton, MatchStatePanel } from "~/components/matches/MatchStates";
import { MATCH_COLORS, MATCH_LAYOUT, MATCH_RADIUS, MATCH_SPACING } from "~/constants/MatchTheme";
import { useMatchStore } from "~/hooks/useMatchStore";
import { useProfileCacheStore } from "~/hooks/useProfileCacheStore";
import { useUserStore } from "~/hooks/useUserStore";
import { mockMatchHistory } from "~/mocks/match-ui";
import type { DailyMatchSummary, MatchHistoryItem, MatchHistoryRecord } from "~/types/match-ui";
import { buildMatchHistoryGroups } from "~/utils/match-ui";
import { getAssets } from "~/utils/valorant-assets";

// Bật LayoutAnimation trên Android (cần gọi trước khi dùng)
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// HistoryRow: kiểu dữ liệu cho mỗi hàng trong danh sách lịch sử
type HistoryRow =
  | { kind: "summary"; key: string; summary: DailyMatchSummary }      // Header ngày
  | { kind: "match"; key: string; match: MatchHistoryItem }             // Match có dữ liệu
  | { kind: "unavailable"; key: string; matchId: string; gameStartTime: number; queueId: string; } // Match không có dữ liệu
  | { kind: "pending"; key: string };                                   // Match đang tải

// isTruthyParam: kiểm tra giá trị param (cho demo mode)
const isTruthyParam = (value: string | string[] | undefined) => value === "1" || value === "true";

// flattenHistory: chuyển mảng MatchHistoryRecord thành mảng HistoryRow phẳng
// Bao gồm: group rows (summary + match), unavailable rows, pending rows
const flattenHistory = (matches: readonly MatchHistoryRecord[], locale: string): HistoryRow[] => {
  // Pending rows: match đang tải (stats === undefined), lấy tối đa 4
  const pendingRows: HistoryRow[] = matches
    .filter((match) => match.stats === undefined)
    .sort((left, right) => right.GameStartTime - left.GameStartTime)
    .slice(0, 4)
    .map((match) => ({ kind: "pending", key: `pending:${match.MatchID}` }));
  // Unavailable rows: match không có dữ liệu (stats === null)
  const unavailableRows: HistoryRow[] = matches
    .filter((match) => match.stats === null)
    .sort((left, right) => right.GameStartTime - left.GameStartTime)
    .map((match) => ({
      kind: "unavailable", key: `unavailable:${match.MatchID}`,
      matchId: match.MatchID, gameStartTime: match.GameStartTime, queueId: match.QueueID,
    }));
  // Group rows: buildMatchHistoryGroups → summary + match items
  const groupRows = buildMatchHistoryGroups(matches, locale).flatMap<HistoryRow>(
    (group) => [
      { kind: "summary", key: `summary:${group.dateKey}`, summary: group.summary },
      ...group.matches.map<HistoryRow>((match) => ({ kind: "match", key: `match:${match.id}`, match })),
    ]
  );
  return [...groupRows, ...unavailableRows, ...pendingRows];
};

// Component MatchHistoryScreen: màn hình lịch sử đấu (match history)
// Hiển thị danh sách match đã chơi, phân nhóm theo ngày, có refresh, load more
export default function MatchHistoryScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { demo } = useLocalSearchParams<{ demo?: string | string[] }>(); // Param demo mode
  const isDemo = __DEV__ && isTruthyParam(demo);                          // Có đang ở chế độ demo?

  // Store
  const user = useUserStore((state) => state.user);                                   // User
  const matches = useMatchStore((state) => state.matches);                            // Danh sách matches
  const loading = useMatchStore((state) => state.loading);                            // Đang tải
  const hydrating = useMatchStore((state) => state.hydrating);                        // Đang hydrate thêm
  const error = useMatchStore((state) => state.error);                                // Lỗi
  const totalMatches = useMatchStore((state) => state.totalMatches);                  // Tổng số match
  const fetchMatches = useMatchStore((state) => state.fetchMatches);                  // Hàm fetch matches
  const hydrateNextMatches = useMatchStore((state) => state.hydrateNextMatches);      // Hàm load thêm

  const [refreshing, setRefreshing] = React.useState(false);  // State refresh

  // Profile cache
  const authKey = user.region && user.id ? `${user.region}|${user.id}` : "guest";
  const cachedProfile = useProfileCacheStore((state) => state.cacheByAuth[authKey]);

  const sourceMatches = isDemo ? mockMatchHistory : matches;  // Nguồn dữ liệu (thật hoặc mock)

  // rows: danh sách HistoryRow đã flatten (memoized)
  const rows = React.useMemo(() => flattenHistory(sourceMatches, i18n.language || "en"), [i18n.language, sourceMatches]);

  const pendingMatchCount = isDemo ? 0 : matches.filter((match) => match.stats === undefined).length;
  const visibleMatchCount = isDemo ? sourceMatches.length : matches.filter((match) => match.stats !== undefined).length;
  const hasMoreHistory = !isDemo && (pendingMatchCount > 0 || matches.length < totalMatches);

  // useEffect: fetch matches khi component mount (trừ demo)
  React.useEffect(() => {
    if (!isDemo) void fetchMatches(user);
  }, [fetchMatches, isDemo, user]);

  // profileVisuals: thông tin visual của profile (avatar, rank icon)
  const profileVisuals = React.useMemo(() => {
    const assets = getAssets();
    const cardId = cachedProfile?.loadoutSnapshot?.Identity?.PlayerCardID;
    const card = assets.cards.find((item) => item.uuid === cardId);
    return {
      avatarUrl: card?.displayIcon || card?.smallArt || card?.largeArt,
      rankIconUrl: cachedProfile?.competitiveRank?.currentIcon ?? undefined,
    };
  }, [cachedProfile]);

  // refresh: kéo xuống refresh danh sách match (gọi fetchMatches với force = true)
  const refresh = React.useCallback(async () => {
    if (isDemo) return;
    setRefreshing(true);
    try {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      await fetchMatches(user, true);
    }
    finally { setRefreshing(false); }
  }, [fetchMatches, isDemo, user]);

  // loadMore: tải thêm match history (khi scroll gần cuối)
  const loadMore = React.useCallback(() => {
    if (!isDemo && !loading && !hydrating) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      void hydrateNextMatches(user);
    }
  }, [hydrateNextMatches, hydrating, isDemo, loading, user]);

  // openMatch: mở trang chi tiết match
  const openMatch = React.useCallback(
    (matchId: string) => { router.push({ pathname: "/match_details/[id]", params: isDemo ? { id: matchId, demo: "1" } : { id: matchId } }); },
    [isDemo, router]
  );

  // renderItem: render một HistoryRow (summary / match / pending / unavailable)
  const renderItem = React.useCallback(
    ({ item }: { item: HistoryRow }) => {
      if (item.kind === "summary") return <DailyMatchSummaryCard summary={item.summary} />;
      if (item.kind === "pending") return <MatchCardSkeleton />;
      if (item.kind === "unavailable") {
        return (
          <Pressable accessibilityRole="button" onPress={() => openMatch(item.matchId)}
            style={({ pressed }) => [styles.unavailableCard, pressed && styles.unavailableCardPressed]}>
            <View style={styles.unavailableCopy}>
              <Text style={styles.unavailableQueue}>{item.queueId || t("history_page.unknown")}</Text>
              <Text style={styles.unavailableMessage}>{t("match_details_page.error_loading")}</Text>
            </View>
            <Text style={styles.unavailableTime}>{new Date(item.gameStartTime).toLocaleDateString(i18n.language || "en", { month: "short", day: "numeric" })}</Text>
          </Pressable>
        );
      }
      return <MatchCard match={item.match} locale={i18n.language || "en"} onPress={openMatch} />;
    },
    [i18n.language, openMatch, t]
  );

  // listHeader: header danh sách (MatchHistoryHeader) - memoized
  const listHeader = React.useMemo(
    () => (
      <MatchHistoryHeader
        playerName={isDemo ? "KONA" : user.name}
        tagLine={isDemo ? "004" : user.TagLine}
        avatarUrl={profileVisuals.avatarUrl}
        rankIconUrl={profileVisuals.rankIconUrl}
        onBack={() => router.back()}
      />
    ),
    [isDemo, profileVisuals.avatarUrl, profileVisuals.rankIconUrl, router, user.TagLine, user.name]
  );

  // listEmpty: component hiển thị khi danh sách rỗng (loading / error / empty)
  const listEmpty = React.useMemo(() => {
    if ((loading && !refreshing) || (isDemo && rows.length === 0)) return <MatchListSkeleton />;
    if (error) {
      return <MatchStatePanel icon="alert-circle-outline" title={t("match_ui.states.error_title")} body={t("match_ui.states.error_body")}
               primaryLabel={t("match_ui.actions.retry")} onPrimaryPress={() => void refresh()}
               secondaryLabel={t("match_ui.actions.back")} onSecondaryPress={() => router.back()} />;
    }
    return <MatchStatePanel icon="history" title={t("match_ui.states.empty_title")} body={t("match_ui.states.empty_body")}
             primaryLabel={t("match_ui.actions.refresh")} onPrimaryPress={() => void refresh()} />;
  }, [error, isDemo, loading, refresh, refreshing, router, rows.length, t]);

  // listFooter: footer danh sách (loading / load more / bottom space)
  const listFooter = React.useMemo(() => {
    if (hydrating && !isDemo) {
      return (<View style={styles.footer}>
        <ActivityIndicator animating color={MATCH_COLORS.tabIndicator} style={styles.footerLoader} />
        <Text style={styles.footerText}>{t("history_page.loading")}</Text>
      </View>);
    }
    if (hasMoreHistory) {
      return (<View style={styles.footer}>
        <Pressable accessibilityRole="button" onPress={loadMore}
          style={({ pressed }) => [styles.loadMoreButton, pressed && styles.loadMoreButtonPressed]}>
          <Text style={styles.loadMoreText}>{t("leaderboard_page.load_more")} ({visibleMatchCount}/{Math.max(totalMatches, matches.length)})</Text>
        </Pressable>
      </View>);
    }
    return <View style={styles.bottomSpace} />;
  }, [hasMoreHistory, hydrating, isDemo, loadMore, matches.length, t, totalMatches, visibleMatchCount]);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      {/* FlatList chính: hiển thị match history, có header, empty state, footer, refresh, infinite scroll */}
      <FlatList
        data={rows}
        renderItem={renderItem}
        keyExtractor={(item) => item.key}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={listFooter}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl enabled={!isDemo} refreshing={refreshing} onRefresh={refresh} tintColor={MATCH_COLORS.tabIndicator} />}
        initialNumToRender={8}          // Số item render lần đầu
        maxToRenderPerBatch={8}         // Tối đa item mỗi batch
        updateCellsBatchingPeriod={48}  // Thời gian giữa các batch (ms)
        windowSize={7}                  // Kích thước window render
        removeClippedSubviews           // Ẩn item ngoài màn hình
        onEndReached={loadMore}         // Load thêm khi gần cuối
        onEndReachedThreshold={0.35}    // Ngưỡng kích hoạt onEndReached (35%)
      />
    </SafeAreaView>
  );
}

// ===== StyleSheet =====
const styles = StyleSheet.create({
  // Màn hình: nền appBackground
  screen: { flex: 1, backgroundColor: MATCH_COLORS.appBackground },
  // Nội dung: full width, maxWidth giới hạn, canh giữa
  content: { width: "100%", maxWidth: MATCH_LAYOUT.maxContentWidth, alignSelf: "center", paddingHorizontal: MATCH_SPACING.lg },
  // Card match không có dữ liệu: hàng ngang, border, bo góc
  unavailableCard: { minHeight: 76, marginBottom: MATCH_SPACING.md, paddingHorizontal: MATCH_SPACING.lg, paddingVertical: MATCH_SPACING.md, borderWidth: 1, borderColor: MATCH_COLORS.border, borderRadius: MATCH_RADIUS.card, backgroundColor: MATCH_COLORS.surface, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: MATCH_SPACING.md },
  unavailableCardPressed: { backgroundColor: MATCH_COLORS.pressed },
  unavailableCopy: { flex: 1, gap: MATCH_SPACING.xs },
  unavailableQueue: { color: MATCH_COLORS.textPrimary, fontSize: 15, fontWeight: "700", textTransform: "capitalize" },
  unavailableMessage: { color: MATCH_COLORS.textMuted, fontSize: 13 },
  unavailableTime: { color: MATCH_COLORS.textSecondary, fontSize: 13 },
  // Footer: canh giữa
  footer: { minHeight: 88, paddingVertical: MATCH_SPACING.xl, alignItems: "center", justifyContent: "center", gap: MATCH_SPACING.sm },
  footerLoader: { marginVertical: 0 },
  footerText: { color: MATCH_COLORS.textMuted, fontSize: 13 },
  // Nút Load More
  loadMoreButton: { minHeight: MATCH_LAYOUT.minTouchTarget, minWidth: 160, paddingHorizontal: MATCH_SPACING.xl, borderWidth: 1, borderColor: MATCH_COLORS.border, borderRadius: MATCH_RADIUS.medium, backgroundColor: MATCH_COLORS.surfaceElevated, alignItems: "center", justifyContent: "center" },
  loadMoreButtonPressed: { backgroundColor: MATCH_COLORS.pressed },
  loadMoreText: { color: MATCH_COLORS.textPrimary, fontSize: 14, fontWeight: "700" },
  // Khoảng trống cuối danh sách
  bottomSpace: { height: MATCH_SPACING.xxl },
});
