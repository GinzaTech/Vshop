import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { ActivityIndicator } from "react-native-paper";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { useTranslation } from "react-i18next";

import EmptyStateCard from "~/components/ui/EmptyStateCard";
import { COLORS, GLOBAL_STYLES, RADIUS } from "~/constants/DesignSystem";
import { useMatchStore } from "~/hooks/useMatchStore";
import { useUserStore } from "~/hooks/useUserStore";
import { getAgent } from "~/utils/valorant-assets";

const WIN_COLOR = "#30a46c";
const LOSS_COLOR = "#e5484d";
const CARD_BORDER = "rgba(23, 26, 31, 0.08)";

const QUEUE_KEYS: Record<string, string> = {
  competitive: "session_labels.queue.competitive",
  unrated: "session_labels.queue.standard",
  swiftplay: "session_labels.queue.swiftplay",
  spikerush: "session_labels.queue.spike_rush",
  escalation: "session_labels.queue.escalation",
  deathmatch: "session_labels.queue.deathmatch",
  teamdeathmatch: "session_labels.queue.team_deathmatch",
  custom: "session_labels.queue.custom",
};

const formatMatchDate = (value: number) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

const formatMatchTime = (value: number) =>
  new Date(value).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

const formatRelativeTime = (value: number, language: string) => {
  const diffMs = Math.max(0, Date.now() - value);
  const totalMinutes = Math.floor(diffMs / 60000);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);
  const isVietnamese = language.toLowerCase().startsWith("vi");

  if (totalDays > 0) {
    return isVietnamese ? `${totalDays}ng trước` : `${totalDays}d ago`;
  }

  if (totalHours > 0) {
    const remainingMinutes = totalMinutes % 60;
    if (remainingMinutes > 0) {
      return isVietnamese
        ? `${totalHours}g ${remainingMinutes}ph trước`
        : `${totalHours}h ${remainingMinutes}m ago`;
    }

    return isVietnamese ? `${totalHours}g trước` : `${totalHours}h ago`;
  }

  const minutes = Math.max(1, totalMinutes);
  return isVietnamese ? `${minutes}ph trước` : `${minutes}m ago`;
};

const getQueueTitle = (
  queueId: string | null | undefined,
  fallback: string,
  t: (key: string) => string
) => {
  const normalized = String(queueId || "").toLowerCase();

  if (normalized.includes("competitive")) return t("history_page.queue_titles.competitive");
  if (normalized.includes("swiftplay")) return t("history_page.queue_titles.swiftplay");
  if (normalized.includes("deathmatch")) return t("history_page.queue_titles.deathmatch");
  if (normalized.includes("spikerush")) return t("history_page.queue_titles.spike_rush");

  return fallback;
};

const RING_GRAY = "rgba(23, 26, 31, 0.24)";
const OUTER = 60;
const INNER = 52;

function RankProgressRing({
  rankIcon,
  rrEarned,
  rrAfter,
  rrBefore,
  won,
}: {
  rankIcon?: string | null;
  rrEarned?: number | null;
  rrAfter?: number | null;
  rrBefore?: number | null;
  won?: boolean;
}) {
  // API always returns rrEarned as positive — use `won` to determine direction
  const isPositive = won !== false; // default to true if unknown
  const afterClamped = Math.max(0, Math.min(100, rrAfter ?? 0));
  // Use rrBefore directly if available, otherwise fall back to computing from rrAfter
  const beforeClamped = typeof rrBefore === "number"
    ? Math.max(0, Math.min(100, rrBefore))
    : Math.max(0, Math.min(100, isPositive
        ? (rrAfter ?? 0) - Math.abs(rrEarned ?? 0)
        : (rrAfter ?? 0) + Math.abs(rrEarned ?? 0)
      ));

  // Detect rank up: before was > 100 or after < before despite winning
  const rankUp = isPositive && typeof rrAfter === "number" && typeof rrBefore === "number" && rrBefore > rrAfter;

  const TICKS = 100;
  const RADIUS = 26; // Distance from center
  const STICK_W = 1.5;
  const STICK_H = 5;
  const SIZE = OUTER; // 60

  const sticks = React.useMemo(() => {
    return Array.from({ length: TICKS }).map((_, i) => {
      let color = null; // Empty
      if (isPositive) {
        if (i < beforeClamped) color = "rgba(48, 164, 108, 0.35)"; // Base: light green
        else if (i < afterClamped) color = WIN_COLOR; // Gain: full green
      } else {
        if (i < afterClamped) color = "rgba(229, 72, 77, 0.35)"; // Base: light red
        else if (i < beforeClamped) color = LOSS_COLOR; // Loss: full red
      }

      if (!color) return null; // Only render active sticks to save performance

      // i * 3.6 starts at 0deg = 12 o'clock (top), goes clockwise
      const angleDeg = i * 3.6;

      return (
        <View
          key={`tick-${i}`}
          style={{
            position: "absolute",
            // Center the stick in the 60×60 shell BEFORE transforms push it outward
            top: (SIZE - STICK_H) / 2,
            left: (SIZE - STICK_W) / 2,
            width: STICK_W,
            height: STICK_H,
            backgroundColor: color,
            borderRadius: 2,
            transform: [
              { rotate: `${angleDeg}deg` },
              { translateY: -RADIUS },
            ],
          }}
        />
      );
    });
  }, [afterClamped, beforeClamped, isPositive]);

  return (
    <View style={styles.rankRingShell}>
      {/* Gray circular background track */}
      <View
        style={{
          position: "absolute",
          width: 57,
          height: 57,
          borderRadius: 28.5,
          borderWidth: 5,
          borderColor: "rgba(23, 26, 31, 0.24)", // RING_GRAY
        }}
      />
      
      {sticks}

      {rankUp ? (
        <View style={styles.rankArrowBubble}>
          <Icon name="chevron-up" size={13} color="#ffffff" />
        </View>
      ) : null}
      {rankIcon ? (
        <Image
          source={{ uri: rankIcon }}
          style={styles.rankBadgeImage}
          contentFit="contain"
        />
      ) : null}
    </View>
  );
}

const MemoizedMatchItem = React.memo(({ 
  item, 
  agents, 
  t, 
  language, 
  onPress 
}: { 
  item: any; 
  agents: any[]; 
  t: (key: string, options?: any) => string; 
  language: string; 
  onPress: () => void; 
}) => {
  if (!item.stats) {
    return (
      <View style={styles.pendingCard}>
        <View style={styles.pendingIcon}>
          <Text style={styles.pendingIconText}>?</Text>
        </View>
        <View style={styles.pendingContent}>
          <Text style={styles.pendingTitle}>{t("history_page.pending_title")}</Text>
          <Text style={styles.pendingMeta}>
            {t("history_page.pending_at", {
              date: formatMatchDate(item.GameStartTime),
              time: formatMatchTime(item.GameStartTime),
            })}
          </Text>
        </View>
      </View>
    );
  }

  const queueLabel = t(
    QUEUE_KEYS[(item.QueueID ?? "").toLowerCase()] ??
      "session_labels.queue.standard"
  );
  const queueTitle = getQueueTitle(item.QueueID, queueLabel, t);
  const relativeTime = formatRelativeTime(item.GameStartTime, language);
  const rrEarned = item.stats.rrEarned;
  const agentAsset = agents.find(
    (agent) =>
      agent.uuid === (item.stats?.agentId || "") ||
      agent.displayName === item.stats?.agentName
  );
  const agentPortrait = agentAsset?.displayIcon || item.stats.agentIcon;
  const rrTone =
    typeof rrEarned === "number"
      ? rrEarned > 0
        ? WIN_COLOR
        : rrEarned < 0
          ? LOSS_COLOR
          : COLORS.TEXT_SECONDARY
      : COLORS.TEXT_SECONDARY;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
    >
      <View style={styles.matchCard}>
        <View style={styles.matchCardContent}>
          <View style={styles.topRow}>
            <View style={styles.topLeft}>
              <View style={styles.topMeta}>
                <Text style={styles.queueTitle} numberOfLines={1}>
                  {queueTitle}
                </Text>
                <Text style={styles.queueTime}>{relativeTime}</Text>
              </View>
            </View>

            <View style={styles.rankSummary}>
              <Text style={[styles.rrDeltaValue, { color: rrTone }]}>
                {typeof rrEarned === "number"
                  ? `${rrEarned > 0 ? "+" : ""}${rrEarned}`
                  : "--"}
              </Text>
              <View style={styles.rankInfoRow}>
                <Text style={styles.rrAfterText}>
                  {typeof item.stats.rrAfter === "number" ? item.stats.rrAfter : "--"}
                </Text>
                <RankProgressRing
                  rankIcon={item.stats.rankIcon}
                  rrEarned={rrEarned}
                  rrAfter={item.stats.rrAfter}
                  rrBefore={item.stats.rrBefore}
                  won={item.stats.won}
                />
              </View>
            </View>
          </View>

          <View style={styles.bannerCard}>
            {item.stats.mapImage ? (
              <Image
                source={{ uri: item.stats.mapImage }}
                style={styles.bannerBackground}
                contentFit="cover"
              />
            ) : null}
            <View style={styles.bannerScrim} />

            <View style={styles.bannerContent}>
              <View style={styles.bannerLeft}>
                {agentPortrait ? (
                  <View style={styles.bannerAgentShell}>
                    <Image
                      source={{ uri: agentPortrait }}
                      style={styles.bannerAgentImage}
                      contentFit="cover"
                    />
                  </View>
                ) : null}

                <View style={styles.bannerMeta}>
                  <Text style={styles.bannerAgentName} numberOfLines={1}>
                    {item.stats.agentName}
                  </Text>
                  <View style={styles.mapChip}>
                    <Text style={styles.mapChipText} numberOfLines={1}>
                      {item.stats.mapName}
                    </Text>
                  </View>
                </View>
              </View>

              <View
                style={[
                  styles.resultBadge,
                  {
                    backgroundColor: item.stats.won
                      ? "rgba(48, 164, 108, 0.95)"
                      : "rgba(229, 72, 77, 0.95)",
                  },
                ]}
              >
                <Text style={styles.resultBadgeText}>
                  {item.stats.won
                    ? t("history_page.result_victory")
                    : t("history_page.result_defeat")}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.bottomRow}>
            <View style={styles.bottomStat}>
              <Icon
                name="crosshairs-gps"
                size={21}
                color={COLORS.TEXT_SECONDARY}
              />
              <Text style={styles.bottomStatText}>
                {item.stats.kills} / {item.stats.deaths} / {item.stats.assists}
              </Text>
            </View>

            <View style={styles.bottomStat}>
              <Icon
                name="signal-cellular-3"
                size={21}
                color={COLORS.TEXT_SECONDARY}
              />
              <Text style={styles.bottomStatText}>{item.stats.acs}</Text>
            </View>

            <View style={[styles.bottomStat, styles.scoreStat]}>
              <Icon
                name="flag-variant-outline"
                size={21}
                color={COLORS.TEXT_SECONDARY}
              />
              <Text style={styles.bottomStatText}>
                {item.stats.roundsWon} - {item.stats.roundsLost}
              </Text>
              <Icon
                name="chevron-right"
                size={24}
                color={COLORS.TEXT_SECONDARY}
              />
            </View>
          </View>

          {(item.stats.rrPerformanceBonus || item.stats.rrAfkPenalty) ? (
            <View style={styles.rrMetaRow}>
              {item.stats.rrPerformanceBonus ? (
                <Text style={styles.rrMetaText}>
                  {t("history_page.metrics.bonus")} +{item.stats.rrPerformanceBonus}
                </Text>
              ) : null}
              {item.stats.rrAfkPenalty ? (
                <Text style={styles.rrMetaText}>
                  {t("history_page.metrics.penalty")} -{item.stats.rrAfkPenalty}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default function MatchHistory() {
  const { t, i18n } = useTranslation();
  const user = useUserStore((state) => state.user);
  const router = useRouter();
  const { matches, loading, fetchMatches } = useMatchStore();
  const [refreshing, setRefreshing] = React.useState(false);
  const agents = getAgent().agents;

  React.useEffect(() => {
    if (matches.length === 0) {
      void fetchMatches(user);
    }
  }, [fetchMatches, matches.length, user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMatches(user);
    setRefreshing(false);
  };

  const completedMatches = React.useMemo(
    () => matches.filter((item) => item.stats),
    [matches]
  );

  const summary = React.useMemo(() => {
    const wins = completedMatches.filter((item) => item.stats?.won).length;
    const losses = completedMatches.length - wins;
    const avgAcs =
      completedMatches.length > 0
        ? Math.round(
            completedMatches.reduce(
              (total, item) => total + (item.stats?.acs || 0),
              0
            ) / completedMatches.length
          )
        : 0;

    return { wins, losses, avgAcs };
  }, [completedMatches]);

  const renderItem = React.useCallback(
    ({ item }: { item: any }) => {
      return (
        <MemoizedMatchItem
          item={item}
          agents={agents}
          t={t}
          language={i18n.language}
          onPress={() => router.push(`/match_details/${item.MatchID}`)}
        />
      );
    },
    [agents, t, i18n.language, router]
  );

  if (loading && !refreshing && matches.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator animating color={COLORS.ACCENT} />
        <Text style={styles.loadingText}>{t("history_page.loading")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerSubtitle}>{t("history_page.subtitle")}</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>
              {t("history_page.summary.wins")}
            </Text>
            <Text style={[styles.summaryValue, styles.winSummary]}>
              {summary.wins}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>
              {t("history_page.summary.losses")}
            </Text>
            <Text style={styles.summaryValue}>{summary.losses}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>
              {t("history_page.summary.avg_acs")}
            </Text>
            <Text style={styles.summaryValue}>{summary.avgAcs || "--"}</Text>
          </View>
        </View>
      </View>
      <FlatList
        contentContainerStyle={styles.content}
        data={matches}
        keyExtractor={(item) => item.MatchID}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.ACCENT}
          />
        }
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={true}
        ListEmptyComponent={
        <EmptyStateCard
          icon={<Icon name="history" size={34} color={COLORS.TEXT_SECONDARY} />}
          title={t("history_page.empty_title")}
          subtitle={t("history_page.empty_subtitle")}
          style={styles.emptyState}
        />
      }
      renderItem={renderItem}
    />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  content: {
    padding: 20,
    paddingBottom: 140,
  },
  header: {
    marginBottom: 14,
  },
  headerSubtitle: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 15,
    lineHeight: 22,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  summaryCard: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: "#1a1d24",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    ...GLOBAL_STYLES.shadow,
  },
  summaryLabel: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryValue: {
    marginTop: 4,
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
  },
  winSummary: {
    color: WIN_COLOR,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.BACKGROUND,
  },
  loadingText: {
    marginTop: 10,
    color: COLORS.TEXT_SECONDARY,
  },
  emptyState: {
    paddingVertical: 40,
  },
  matchCard: {
    width: "100%",
    marginBottom: 14,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: COLORS.SURFACE,
    overflow: "hidden",
    ...GLOBAL_STYLES.shadow,
  },
  matchCardContent: {
    paddingTop: 20,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  topLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    minWidth: 0,
    paddingRight: 8,
  },
  topMeta: {
    flex: 1,
    minWidth: 0,
    paddingTop: 2,
  },
  queueTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: "900",
    flexShrink: 1,
  },
  queueTime: {
    marginTop: 10,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: "500",
  },
  rankSummary: {
    alignItems: "flex-end",
    justifyContent: "center",
    minWidth: 82,
  },
  rrDeltaValue: {
    fontSize: 17,
    fontWeight: "900",
  },
  rankInfoRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rrAfterText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: "700",
  },
  rankRingShell: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  rankArrowBubble: {
    position: "absolute",
    top: -6,
    right: 10,
    width: 18,
    height: 18,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: WIN_COLOR,
    zIndex: 3,
  },
  rankBadgeImage: {
    width: 34,
    height: 34,
    zIndex: 2,
  },
  bannerCard: {
    height: 144,
    borderRadius: 0,
    overflow: "hidden",
    backgroundColor: "#c6ced8",
    borderTopWidth: 1,
    borderTopColor: "rgba(23, 26, 31, 0.06)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(23, 26, 31, 0.06)",
  },
  bannerBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  bannerScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 19, 25, 0.38)",
  },
  bannerContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  bannerLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },
  bannerAgentShell: {
    width: 118,
    height: 144,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
    marginLeft: -20,
  },
  bannerAgentImage: {
    width: 138,
    height: 138,
    marginLeft: -8,
  },
  bannerMeta: {
    flex: 1,
    minWidth: 0,
    transform: [{ translateY: -24 }],
  },
  bannerAgentName: {
    color: "#ffffff",
    fontSize: 21,
    fontWeight: "900",
    marginTop: 10,
  },
  mapChip: {
    marginTop: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 13,
    paddingVertical: 4,
    borderRadius: RADIUS.chip,
    backgroundColor: "rgba(90, 95, 102, 0.72)",
    transform: [{ translateY: 36 }],
  },
  mapChipText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  resultBadge: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.chip,
    borderWidth: 1,
    borderColor: "rgba(23, 26, 31, 0.22)",
  },
  resultBadgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 0,
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  bottomStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  scoreStat: {
    marginLeft: "auto",
  },
  bottomStatText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: "700",
  },
  rrMetaRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: -4,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  rrMetaText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: "600",
  },
  pendingCard: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 14,
    padding: 16,
    borderRadius: 22,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    ...GLOBAL_STYLES.shadow,
  },
  pendingIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(23, 26, 31, 0.05)",
  },
  pendingIconText: {
    fontWeight: "800",
    fontSize: 15,
    color: COLORS.TEXT_SECONDARY,
  },
  pendingContent: {
    flex: 1,
    marginLeft: 12,
  },
  pendingTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: "800",
  },
  pendingMeta: {
    marginTop: 4,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
  },
});
