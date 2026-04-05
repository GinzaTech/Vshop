import React from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ActivityIndicator } from "react-native-paper";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { useTranslation } from "react-i18next";

import { useUserStore } from "~/hooks/useUserStore";
import { useMatchStore } from "~/hooks/useMatchStore";
import { COLORS, GLOBAL_STYLES, RADIUS } from "~/constants/DesignSystem";
import EmptyStateCard from "~/components/ui/EmptyStateCard";

const WIN_COLOR = "#5f7a6b";
const WIN_BORDER = "rgba(95, 122, 107, 0.34)";
const LOSS_COLOR = "#8a6770";
const LOSS_BORDER = "rgba(138, 103, 112, 0.30)";

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

export default function MatchHistory() {
  const { t } = useTranslation();
  const user = useUserStore((state) => state.user);
  const router = useRouter();
  const { matches, loading, fetchMatches } = useMatchStore();
  const [refreshing, setRefreshing] = React.useState(false);

  React.useEffect(() => {
    if (matches.length === 0) {
      fetchMatches(user);
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

  if (loading && !refreshing && matches.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator animating color={COLORS.ACCENT} />
        <Text style={styles.loadingText}>{t("history_page.loading")}</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
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
      ListHeaderComponent={
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
      }
      ListEmptyComponent={
        <EmptyStateCard
          icon={<Icon name="history" size={34} color={COLORS.TEXT_SECONDARY} />}
          title={t("history_page.empty_title")}
          subtitle={t("history_page.empty_subtitle")}
          style={styles.emptyState}
        />
      }
      renderItem={({ item }) => {
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

        const resultColor = item.stats.won ? WIN_COLOR : LOSS_COLOR;
        const resultBorder = item.stats.won ? WIN_BORDER : LOSS_BORDER;
        const scrimColor = item.stats.won
          ? "rgba(239, 247, 242, 0.88)"
          : "rgba(246, 240, 243, 0.88)";

        return (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => router.push(`/match_details/${item.MatchID}`)}
          >
            <View
              style={[
                styles.matchCard,
                {
                  backgroundColor: COLORS.SURFACE,
                  borderColor: resultBorder,
                },
              ]}
            >
              <View
                style={[
                  styles.resultBar,
                  { backgroundColor: resultColor },
                ]}
              />
              {item.stats.mapImage ? (
                <Image
                  source={{ uri: item.stats.mapImage }}
                  style={styles.mapBackground}
                  contentFit="cover"
                />
              ) : null}
              <View
                style={[
                  styles.mapScrim,
                  { backgroundColor: scrimColor },
                ]}
              />

              <View style={styles.matchCardContent}>
                <View style={styles.cardTopRow}>
                  <View
                    style={[
                      styles.resultPill,
                      {
                        backgroundColor: resultColor,
                        borderColor: resultColor,
                      },
                    ]}
                  >
                    <Text style={styles.resultPillText}>
                      {item.stats.won
                        ? t("history_page.result_victory")
                        : t("history_page.result_defeat")}
                    </Text>
                  </View>

                  <View style={styles.dateBlock}>
                    <Text style={styles.dateText}>
                      {formatMatchDate(item.GameStartTime)}
                    </Text>
                    <Text style={styles.timeText}>
                  {formatMatchTime(item.GameStartTime)}
                    </Text>
                  </View>
                </View>

                <View style={styles.matchMainRow}>
                  <View style={styles.matchIdentity}>
                    <View
                      style={[
                        styles.agentShell,
                        {
                          backgroundColor: "rgba(255,255,255,0.68)",
                          borderColor: resultBorder,
                        },
                      ]}
                    >
                      <Image
                        source={{ uri: item.stats.agentIcon }}
                        style={styles.agentIcon}
                        contentFit="cover"
                      />
                    </View>

                    <View style={styles.mapBlock}>
                      <Text style={styles.mapTitle} numberOfLines={1}>
                        {item.stats.mapName}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.scoreBlock}>
                    <Text style={[styles.scoreValue, { color: resultColor }]}>
                      {item.stats.roundsWon} - {item.stats.roundsLost}
                    </Text>
                    <Text style={styles.scoreCaption}>{item.stats.kda}</Text>
                  </View>
                </View>

                <View style={styles.metricsInlineRow}>
                  <View style={styles.metricInlineItem}>
                    <Text style={styles.metricLabel}>{t("history_page.metrics.kda")}</Text>
                    <Text style={styles.metricValue}>{item.stats.kda}</Text>
                  </View>
                  <View style={styles.metricInlineItem}>
                    <Text style={styles.metricLabel}>{t("history_page.metrics.kd")}</Text>
                    <Text style={styles.metricValue}>{item.stats.kdRatio}</Text>
                  </View>
                  <View style={styles.metricInlineItem}>
                    <Text style={styles.metricLabel}>{t("history_page.metrics.acs")}</Text>
                    <Text style={styles.metricValue}>{item.stats.acs}</Text>
                  </View>
                  <View style={styles.metricInlineItem}>
                    <Text style={styles.metricLabel}>{t("history_page.metrics.hs")}</Text>
                    <Text style={styles.metricValue}>
                      {item.stats.headshotPct || "--"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        );
      }}
    />
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
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    ...GLOBAL_STYLES.shadow,
  },
  summaryLabel: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  summaryValue: {
    marginTop: 6,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: "700",
  },
  winSummary: {
    color: COLORS.SUCCESS,
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
    position: "relative",
    alignSelf: "center",
    width: "93%",
    overflow: "hidden",
    marginBottom: 10,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    backgroundColor: COLORS.SURFACE,
    ...GLOBAL_STYLES.shadow,
  },
  resultBar: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 4,
    zIndex: 3,
  },
  mapBackground: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.24,
  },
  mapScrim: {
    ...StyleSheet.absoluteFillObject,
    opacity: 1,
  },
  matchCardContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  resultPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.chip,
    borderWidth: 1,
  },
  resultPillText: {
    color: COLORS.PURE_WHITE,
    fontSize: 11,
    fontWeight: "700",
  },
  dateBlock: {
    alignItems: "flex-end",
  },
  dateText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 12,
    fontWeight: "700",
  },
  timeText: {
    marginTop: 2,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 11,
  },
  matchMainRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  matchIdentity: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  agentShell: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  agentIcon: {
    width: "100%",
    height: "100%",
  },
  mapBlock: {
    flex: 1,
    marginLeft: 12,
  },
  mapTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: "700",
  },
  scoreBlock: {
    alignItems: "flex-end",
  },
  scoreValue: {
    fontSize: 19,
    fontWeight: "700",
  },
  scoreCaption: {
    marginTop: 2,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: "600",
  },
  metricsInlineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(23,26,31,0.08)",
  },
  metricInlineItem: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  metricInlineLast: {
    marginRight: 0,
  },
  metricLabel: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  metricValue: {
    marginTop: 2,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: "700",
  },
  pendingCard: {
    flexDirection: "row",
    alignItems: "center",
    width: "93%",
    alignSelf: "center",
    marginBottom: 14,
    padding: 16,
    borderRadius: RADIUS.card,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    ...GLOBAL_STYLES.shadow,
  },
  pendingIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.SURFACE_MUTED,
  },
  pendingIconText: {
    fontWeight: "700",
    fontSize: 18,
    color: COLORS.TEXT_SECONDARY,
  },
  pendingContent: {
    flex: 1,
    marginLeft: 12,
  },
  pendingTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: "700",
  },
  pendingMeta: {
    marginTop: 4,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
  },
});
