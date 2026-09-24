// ===== MatchCard.tsx =====
// Card một trận đấu trong lịch sử: kết quả, tỉ số, K/D/A, thứ hạng, map,
// mode, RR và hàng chỉ số (K/D, HS%, ADR, ACS, TRS). Nhấn card → mở chi tiết.
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import { MatchImage } from "~/components/matches/MatchImage";
import {
  MATCH_COLORS,
  MATCH_RADIUS,
  MATCH_SPACING,
} from "~/constants/MatchTheme";
import type { MatchHistoryItem } from "~/types/match-ui";
import {
  formatMatchRelativeTime,
  formatMetric,
  formatOrdinal,
  formatPercent,
  humanizeMatchMode,
} from "~/utils/match-ui";
import { MOTION_SPRING } from "~/constants/Motion";

/**
 * MatchCardProps – Props của MatchCard.
 *
 * @param match – Dữ liệu một trận (kết quả, tỉ số, agent, rank, chỉ số...).
 * @param locale – Locale dùng format thời gian tương đối ("3 giờ trước").
 * @param onPress – Callback khi bấm card, nhận matchId của trận.
 */
type MatchCardProps = {
  match: MatchHistoryItem;
  locale: string;
  onPress: (matchId: string) => void;
};

/**
 * MetricProps – Props của Metric (ô chỉ số nhỏ dưới card).
 *
 * @param label – Nhãn chỉ số (VD: "K/D", "HS%").
 * @param value – Giá trị đã format để hiển thị.
 */
type MetricProps = {
  label: string;
  value: string;
};

/**
 * Metric – Ô chỉ số đơn giản (label trên, value dưới), chiếm 1/5 hàng metrics.
 *
 * @param label – Nhãn chỉ số.
 * @param value – Giá trị hiển thị.
 * @returns View chứa cặp label + value.
 */
const Metric = ({ label, value }: MetricProps) => (
  <View style={styles.metric}>
    <Text style={styles.metricLabel} numberOfLines={1}>
      {label}
    </Text>
    <Text style={styles.metricValue} numberOfLines={1}>
      {value}
    </Text>
  </View>
);

/**
 * formatRrChange – Format độ thay đổi RR (Ranked Rating).
 * @param value – Số RR thay đổi; undefined nếu trận không tính rank.
 * @returns "+12 RR" / "-8 RR" hoặc "--" nếu undefined.
 */
const formatRrChange = (value: number | undefined) => {
  if (value === undefined) return "--";
  return `${value > 0 ? "+" : ""}${value} RR`;
};

/**
 * MatchCardComponent – Component nội bộ render card trận đấu.
 * Tính màu/nhãn kết quả (thắng/hòa/thua), nhãn RR, accessibilityLabel đầy đủ
 * rồi dựng layout: dải màu kết quả, ảnh agent + rank, tỉ số, K/D/A, badge
 * thứ hạng, map/mode, khối RR và hàng 5 metric dưới cùng.
 *
 * @param match – Dữ liệu trận (xem MatchCardProps).
 * @param locale – Locale cho format thời gian tương đối.
 * @param onPress – Callback mở chi tiết trận với matchId.
 * @returns Animated.View bọc Pressable card (có animation scale khi nhấn).
 *
 * Side effects: animation spring scale trên UI thread khi onPressIn/Out;
 * không có timer/subscription nên không cần cleanup.
 */
function MatchCardComponent({ match, locale, onPress }: MatchCardProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const compact = width <= 380;
  const isWin = match.result === "win";
  const isDraw = match.result === "draw";
  const resultColor = isDraw
    ? MATCH_COLORS.warning
    : isWin
      ? MATCH_COLORS.win
      : match.result === "loss"
        ? MATCH_COLORS.loss
        : MATCH_COLORS.textMuted;
  const resultLabel = t(`match_ui.result.${match.result}`);
  const hasRankedRating = match.rrChange !== undefined;
  const rrChangeColor =
    match.rrChange === undefined || match.rrChange === 0
      ? MATCH_COLORS.textMuted
      : match.rrChange > 0
        ? MATCH_COLORS.win
        : MATCH_COLORS.loss;
  const rrChangeLabel =
    match.rrChange === undefined || match.rrChange === 0
      ? t("match_ui.metrics.rr_change")
      : match.rrChange > 0
        ? t("match_ui.metrics.rr_gained")
        : t("match_ui.metrics.rr_lost");
  const rrChangeIndicator =
    match.rrChange === undefined || match.rrChange === 0
      ? "±"
      : match.rrChange > 0
        ? "▲"
        : "▼";
  const rrSummary = hasRankedRating
    ? `, ${rrChangeLabel} ${formatRrChange(match.rrChange)}`
    : "";
  const accessibilityLabel = `${resultLabel}, ${match.mapName}, ${match.teamScore} to ${match.opponentScore}, ${match.kills} kills, ${match.deaths} deaths, ${match.assists} assists${rrSummary}`;

  // scale: shared value điều khiển animation nhấn (thu nhỏ 0.97 khi giữ)
  const scale = useSharedValue(1);
  // animatedStyle: gắn scale vào transform của Animated.View
  const animatedStyle = useAnimatedStyle(
    () => ({ transform: [{ scale: scale.value }] }),
    [],
  );

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={() => onPress(match.id)}
        onPressIn={() => {
          scale.value = withSpring(0.97, MOTION_SPRING.press);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, MOTION_SPRING.settle);
        }}
        style={[styles.card, isWin && styles.winCard]}
      >
      <View style={[styles.resultIndicator, { backgroundColor: resultColor }]} />
      <View style={styles.cardBody}>
        <View style={styles.primaryRow}>
          <View style={styles.agentColumn}>
            <MatchImage
              uri={match.agent.iconUrl}
              cacheId={`agent:${match.agent.id}:display-icon`}
              style={styles.agentImage}
              icon="account"
              iconSize={25}
            />
            {match.rank ? (
              <View style={styles.rankBadge}>
                <MatchImage
                  uri={match.rank.iconUrl}
                  cacheId={`rank:${match.rank.tier}:icon`}
                  style={styles.rankImage}
                  icon="shield"
                  iconSize={13}
                  contentFit="contain"
                />
              </View>
            ) : null}
          </View>

          <View style={styles.summaryColumn}>
            <View style={styles.resultRow}>
              <Text style={[styles.resultText, { color: resultColor }]}>
                {resultLabel}
              </Text>
              <Text style={styles.relativeTime} numberOfLines={1}>
                {formatMatchRelativeTime(match.startedAt, locale)}
              </Text>
            </View>
            <Text style={[styles.score, { color: resultColor }]}>
              {match.teamScore} : {match.opponentScore}
            </Text>
            <Text style={styles.kdaLabel}>{t("match_ui.metrics.kda")}</Text>
            <Text style={styles.kdaValue} numberOfLines={1}>
              {match.kills} / {match.deaths} / {match.assists}
            </Text>
          </View>

          <View style={styles.placementColumn}>
            <View
              style={[
                styles.placementBadge,
                match.placement <= 3 && styles.topPlacementBadge,
              ]}
            >
              <Text style={styles.placementText}>
                {formatOrdinal(match.placement)}
              </Text>
            </View>
            <Text style={styles.placementLabel}>{t("match_ui.metrics.kd")}</Text>
            <Text style={styles.placementValue}>{formatMetric(match.kd, 2)}</Text>
          </View>

          <View style={[styles.metaColumn, compact && styles.metaColumnCompact]}>
            <Text style={styles.mode} numberOfLines={1}>
              {humanizeMatchMode(match.mode)}
            </Text>
            <Text
              style={[styles.mapName, compact && styles.mapNameCompact]}
              numberOfLines={1}
            >
              {match.mapName}
            </Text>
            {hasRankedRating ? (
              <View style={styles.rrCompactBlock}>
                <Text
                  style={[styles.rrCompactIndicator, { color: rrChangeColor }]}
                >
                  {rrChangeIndicator}
                </Text>
                <Text
                  style={[styles.rrCompactChange, { color: rrChangeColor }]}
                  numberOfLines={1}
                >
                  {formatRrChange(match.rrChange)}
                </Text>
              </View>
            ) : (
              <View style={styles.rrBlock}>
                <Text style={styles.metaLabel}>{t("match_ui.metrics.acs")}</Text>
                <Text style={styles.metaValue}>{formatMetric(match.acs)}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.metricsRow}>
          <Metric label={t("match_ui.metrics.kd")} value={formatMetric(match.kd, 2)} />
          <Metric label={t("match_ui.metrics.hs")} value={formatPercent(match.headshotPercent)} />
          <Metric label={t("match_ui.metrics.adr")} value={formatMetric(match.adr)} />
          <Metric label={t("match_ui.metrics.acs")} value={formatMetric(match.acs)} />
          <Metric label={t("match_ui.metrics.trs")} value={formatMetric(match.trs)} />
        </View>
      </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 160,
    flexDirection: "row",
    marginBottom: MATCH_SPACING.md,
    borderRadius: MATCH_RADIUS.card,
    borderWidth: 1,
    borderColor: MATCH_COLORS.border,
    backgroundColor: MATCH_COLORS.surface,
    overflow: "hidden",
  },
  winCard: {
    borderColor: MATCH_COLORS.winBorder,
    backgroundColor: MATCH_COLORS.winBackground,
  },
  cardPressed: {
    opacity: 0.78,
  },
  resultIndicator: {
    width: 5,
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
    padding: MATCH_SPACING.md,
  },
  primaryRow: {
    minHeight: 86,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: MATCH_SPACING.sm,
  },
  agentColumn: {
    width: 50,
    height: 58,
  },
  agentImage: {
    width: 50,
    height: 50,
    borderRadius: MATCH_RADIUS.medium,
  },
  rankBadge: {
    position: "absolute",
    right: -3,
    bottom: 0,
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: MATCH_RADIUS.small,
    borderWidth: 1,
    borderColor: MATCH_COLORS.border,
    backgroundColor: MATCH_COLORS.surfaceElevated,
  },
  rankImage: {
    width: 18,
    height: 18,
  },
  summaryColumn: {
    flex: 1,
    minWidth: 72,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: MATCH_SPACING.xs,
  },
  resultText: {
    fontSize: 10,
    fontWeight: "900",
  },
  relativeTime: {
    flex: 1,
    color: MATCH_COLORS.textMuted,
    fontSize: 10,
  },
  score: {
    marginTop: 2,
    fontSize: 25,
    fontWeight: "900",
  },
  kdaLabel: {
    marginTop: MATCH_SPACING.xs,
    color: MATCH_COLORS.textMuted,
    fontSize: 10,
    fontWeight: "700",
  },
  kdaValue: {
    marginTop: 1,
    color: MATCH_COLORS.textPrimary,
    fontSize: 12,
    fontWeight: "800",
  },
  placementColumn: {
    width: 43,
    alignItems: "center",
  },
  placementBadge: {
    minWidth: 40,
    height: 27,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: MATCH_SPACING.xs,
    borderRadius: MATCH_RADIUS.medium,
    backgroundColor: MATCH_COLORS.surfaceSoft,
  },
  topPlacementBadge: {
    backgroundColor: "rgba(245, 200, 76, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(245, 200, 76, 0.42)",
  },
  placementText: {
    color: MATCH_COLORS.textPrimary,
    fontSize: 11,
    fontWeight: "900",
  },
  placementLabel: {
    marginTop: MATCH_SPACING.md,
    color: MATCH_COLORS.textMuted,
    fontSize: 10,
    fontWeight: "700",
  },
  placementValue: {
    marginTop: 1,
    color: MATCH_COLORS.textPrimary,
    fontSize: 12,
    fontWeight: "800",
  },
  metaColumn: {
    width: 78,
    minWidth: 0,
    alignItems: "flex-end",
  },
  metaColumnCompact: {
    width: 66,
  },
  mode: {
    maxWidth: "100%",
    color: MATCH_COLORS.textSecondary,
    fontSize: 10,
  },
  mapName: {
    maxWidth: "100%",
    marginTop: 3,
    color: MATCH_COLORS.textPrimary,
    fontSize: 16,
    fontWeight: "900",
  },
  mapNameCompact: {
    fontSize: 14,
  },
  metaLabel: {
    marginTop: MATCH_SPACING.md,
    color: MATCH_COLORS.textMuted,
    fontSize: 10,
    fontWeight: "700",
  },
  metaValue: {
    marginTop: 1,
    color: MATCH_COLORS.textPrimary,
    fontSize: 12,
    fontWeight: "800",
  },
  rrBlock: {
    marginTop: MATCH_SPACING.sm,
    alignItems: "flex-end",
  },
  rrCompactBlock: {
    marginTop: MATCH_SPACING.sm,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: MATCH_SPACING.xs,
    paddingVertical: 4,
    gap: 3,
    borderRadius: MATCH_RADIUS.small,
    backgroundColor: MATCH_COLORS.surfaceSoft,
  },
  rrCompactIndicator: {
    fontSize: 7,
    fontWeight: "900",
  },
  rrCompactChange: {
    fontSize: 10,
    fontWeight: "900",
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    marginTop: MATCH_SPACING.sm,
    paddingTop: MATCH_SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: MATCH_COLORS.divider,
  },
  metric: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
    borderLeftWidth: 1,
    borderLeftColor: MATCH_COLORS.divider,
  },
  metricLabel: {
    color: MATCH_COLORS.textMuted,
    fontSize: 10,
    fontWeight: "700",
  },
  metricValue: {
    marginTop: 2,
    color: MATCH_COLORS.textPrimary,
    fontSize: 12,
    fontWeight: "800",
  },
});

/**
 * MatchCard – Export memo hoá của MatchCardComponent để dùng trong FlatList
 * lịch sử trận; chỉ re-render khi props (match/locale/onPress) thay đổi.
 */
export const MatchCard = React.memo(MatchCardComponent);
