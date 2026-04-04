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
import PageIntro from "~/components/ui/PageIntro";

const WIN_COLOR = "#5f7a6b";
const WIN_SURFACE = "rgba(95, 122, 107, 0.16)";
const WIN_BORDER = "rgba(95, 122, 107, 0.34)";
const LOSS_COLOR = "#8a6770";
const LOSS_SURFACE = "rgba(138, 103, 112, 0.16)";
const LOSS_BORDER = "rgba(138, 103, 112, 0.30)";

const formatLabel = (value?: string | null, fallback = "Unknown") => {
  if (!value) return fallback;

  return value
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
};

const formatGameModeLabel = (value?: string | null, fallback = "Unknown") => {
  if (!value) return fallback;

  const lastPathSegment = value.split("/").filter(Boolean).pop() || value;
  const lastDotSegment = lastPathSegment.split(".").pop() || lastPathSegment;
  const cleaned = lastDotSegment.replace(/GameMode$/i, "");

  return formatLabel(cleaned || lastDotSegment, fallback);
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
          <PageIntro
            title={t("history_page.title")}
            subtitle={t("history_page.subtitle")}
          />

          <View style={styles.summaryHero}>
            <View style={styles.summaryHeroTop}>
              <View style={styles.summaryHeroBadge}>
                <Icon name="history" size={14} color={COLORS.PURE_WHITE} />
                <Text style={styles.summaryHeroBadgeText}>
                  {t("history_page.title")}
                </Text>
              </View>
              <Text style={styles.summaryHeroMeta}>
                {t("history_page.summary.matches", { count: completedMatches.length })}
              </Text>
            </View>

            <Text style={styles.summaryHeroTitle}>
              {t("history_page.summary.snapshot_title")}
            </Text>
            <Text style={styles.summaryHeroSubtitle}>
              {t("history_page.summary.snapshot_subtitle")}
            </Text>

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
        const resultSurface = item.stats.won ? WIN_SURFACE : LOSS_SURFACE;
        const resultBorder = item.stats.won ? WIN_BORDER : LOSS_BORDER;

        return (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => router.push(`/match_details/${item.MatchID}`)}
          >
            <View
              style={[
                styles.matchCard,
                {
                  backgroundColor: resultSurface,
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

              <View style={styles.matchCardContent}>
                <View style={styles.cardTopRow}>
                  <View style={styles.cardTopLeft}>
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

                    <View
                      style={[
                        styles.modePill,
                        {
                          backgroundColor: resultSurface,
                          borderColor: COLORS.BORDER,
                        },
                      ]}
                    >
                      <Text style={styles.modePillText}>
                        {formatGameModeLabel(
                          item.stats.gameMode || item.QueueID,
                          t("history_page.unknown")
                        )}
                      </Text>
                    </View>
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
                        { backgroundColor: resultSurface, borderColor: resultBorder },
                      ]}
                    >
                      <Image
                        source={{ uri: item.stats.agentIcon }}
                        style={styles.agentIcon}
                        contentFit="cover"
                      />
                    </View>

                    <View style={styles.mapBlock}>
                      <Text style={styles.mapTitle}>
                      {item.stats.mapName}
                      </Text>
                      <Text style={styles.mapMeta}>
                        {formatGameModeLabel(
                          item.stats.gameMode || item.QueueID,
                          t("history_page.unknown")
                        )}
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

                <View style={styles.metricsGrid}>
                  <View
                    style={[
                      styles.metricCard,
                      {
                        backgroundColor: resultSurface,
                        borderColor: resultBorder,
                      },
                    ]}
                  >
                    <Text style={styles.metricLabel}>{t("history_page.metrics.kda")}</Text>
                    <Text style={styles.metricValue}>{item.stats.kda}</Text>
                  </View>
                  <View
                    style={[
                      styles.metricCard,
                      {
                        backgroundColor: resultSurface,
                        borderColor: resultBorder,
                      },
                    ]}
                  >
                    <Text style={styles.metricLabel}>{t("history_page.metrics.kd")}</Text>
                    <Text style={styles.metricValue}>{item.stats.kdRatio}</Text>
                  </View>
                  <View
                    style={[
                      styles.metricCard,
                      {
                        backgroundColor: resultSurface,
                        borderColor: resultBorder,
                      },
                    ]}
                  >
                    <Text style={styles.metricLabel}>{t("history_page.metrics.acs")}</Text>
                    <Text style={styles.metricValue}>{item.stats.acs}</Text>
                  </View>
                  <View
                    style={[
                      styles.metricCard,
                      {
                        backgroundColor: resultSurface,
                        borderColor: resultBorder,
                      },
                    ]}
                  >
                    <Text style={styles.metricLabel}>{t("history_page.metrics.hs")}</Text>
                    <Text style={styles.metricValue}>
                      {item.stats.headshotPct || "--"}
                    </Text>
                  </View>
                </View>

                <View style={styles.mapPreviewRow}>
                  <View style={styles.mapPreviewTextBlock}>
                    <Text style={styles.mapPreviewEyebrow}>
                      {t("history_page.map_preview")}
                    </Text>
                    <Text style={styles.mapPreviewTitle}>{item.stats.mapName}</Text>
                  </View>
                  <View
                    style={[
                      styles.mapPreviewFrame,
                      { backgroundColor: resultSurface, borderColor: resultBorder },
                    ]}
                  >
                    {item.stats.mapImage ? (
                      <Image
                        source={{ uri: item.stats.mapImage }}
                        style={styles.mapPreviewImage}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={styles.mapPreviewFallback}>
                        <Icon
                          name="map-outline"
                          size={20}
                          color={COLORS.TEXT_SECONDARY}
                        />
                      </View>
                    )}
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
    marginBottom: 18,
  },
  summaryHero: {
    marginTop: 18,
    padding: 18,
    borderRadius: RADIUS.card,
    backgroundColor: COLORS.ACCENT_DEEP,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    ...GLOBAL_STYLES.shadow,
  },
  summaryHeroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryHeroBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.chip,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  summaryHeroBadgeText: {
    marginLeft: 8,
    color: COLORS.PURE_WHITE,
    fontSize: 12,
    fontWeight: "700",
  },
  summaryHeroMeta: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontWeight: "600",
  },
  summaryHeroTitle: {
    marginTop: 16,
    color: COLORS.PURE_WHITE,
    fontSize: 28,
    fontWeight: "700",
  },
  summaryHeroSubtitle: {
    marginTop: 6,
    color: "rgba(255,255,255,0.72)",
    fontSize: 14,
    lineHeight: 20,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  summaryCard: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  summaryLabel: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  summaryValue: {
    marginTop: 8,
    color: COLORS.PURE_WHITE,
    fontSize: 22,
    fontWeight: "700",
  },
  winSummary: {
    color: "#b9dbca",
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
    overflow: "hidden",
    marginBottom: 14,
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
    width: 5,
    zIndex: 3,
  },
  matchCardContent: {
    padding: 16,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  cardTopLeft: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    flex: 1,
  },
  resultPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.chip,
    borderWidth: 1,
  },
  resultPillText: {
    color: COLORS.PURE_WHITE,
    fontSize: 12,
    fontWeight: "700",
  },
  modePill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.chip,
    borderWidth: 1,
  },
  modePillText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
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
    marginTop: 4,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
  },
  matchMainRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
  },
  matchIdentity: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  agentShell: {
    width: 56,
    height: 56,
    borderRadius: 18,
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
    fontSize: 18,
    fontWeight: "700",
  },
  mapMeta: {
    marginTop: 5,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
  },
  scoreBlock: {
    alignItems: "flex-end",
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: "700",
  },
  scoreCaption: {
    marginTop: 4,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: "600",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
  metricCard: {
    width: "47.5%",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
  },
  metricLabel: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  metricValue: {
    marginTop: 6,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: "700",
  },
  mapPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
  },
  mapPreviewTextBlock: {
    flex: 1,
    marginRight: 12,
  },
  mapPreviewEyebrow: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: "600",
  },
  mapPreviewTitle: {
    marginTop: 4,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: "700",
  },
  mapPreviewFrame: {
    width: 108,
    height: 72,
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  mapPreviewImage: {
    width: "100%",
    height: "100%",
  },
  mapPreviewFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pendingCard: {
    flexDirection: "row",
    alignItems: "center",
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
