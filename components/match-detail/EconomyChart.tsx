import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { useTranslation } from "react-i18next";

import {
  MATCH_COLORS,
  MATCH_LAYOUT,
  MATCH_RADIUS,
  MATCH_SPACING,
} from "~/constants/MatchTheme";
import type { EconomyPoint } from "~/types/match-ui";

type EconomyMetric =
  | "difference"
  | "total"
  | "teamA"
  | "teamB"
  | "loadout"
  | "spent";

type EconomyChartProps = {
  points: EconomyPoint[];
};

const PLOT_TOP = 16;
const PLOT_HEIGHT = 152;
const CHART_HEIGHT = 205;
const POINT_GAP = 44;

const compactCredits = (value: number) => {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (absolute >= 1000) {
    const digits = absolute >= 10_000 ? 0 : 1;
    return `${sign}${(absolute / 1000).toFixed(digits)}k`;
  }
  return `${Math.round(value)}`;
};

const metricValue = (point: EconomyPoint, metric: EconomyMetric) => {
  if (metric === "total") return point.teamAEconomy + point.teamBEconomy;
  if (metric === "teamA") return point.teamAEconomy;
  if (metric === "teamB") return point.teamBEconomy;
  if (metric === "spent") return point.teamASpent - point.teamBSpent;
  return point.difference;
};

const lineStyle = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string
): ViewStyle => {
  const distance = Math.hypot(x2 - x1, y2 - y1);
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  return {
    position: "absolute",
    left: (x1 + x2 - distance) / 2,
    top: (y1 + y2) / 2 - 1,
    width: distance,
    height: 2,
    backgroundColor: color,
    transform: [{ rotate: `${angle}deg` }],
  };
};

export const EconomyChart = React.memo(function EconomyChart({
  points,
}: EconomyChartProps) {
  const { t } = useTranslation();
  const [metric, setMetric] = React.useState<EconomyMetric>("difference");
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [selectedRound, setSelectedRound] = React.useState<number | null>(null);
  const options: { id: EconomyMetric; label: string }[] = [
    { id: "difference", label: t("match_ui.economy.difference") },
    { id: "total", label: t("match_ui.economy.total") },
    { id: "teamA", label: t("match_ui.teams.team_a") },
    { id: "teamB", label: t("match_ui.teams.team_b") },
    { id: "loadout", label: t("match_ui.economy.loadout") },
    { id: "spent", label: t("match_ui.economy.spent") },
  ];
  const activeLabel = options.find((option) => option.id === metric)?.label ?? "";
  const values = React.useMemo(
    () => points.map((point) => metricValue(point, metric)),
    [metric, points]
  );
  const maxMagnitude = React.useMemo(() => {
    const rawMax = Math.max(5_000, ...values.map((value) => Math.abs(value)));
    return Math.ceil(rawMax / 5_000) * 5_000;
  }, [values]);
  const chartWidth = Math.max(300, (points.length - 1) * POINT_GAP + 40);
  const yForValue = React.useCallback(
    (value: number) =>
      PLOT_TOP +
      PLOT_HEIGHT / 2 -
      (value / maxMagnitude) * (PLOT_HEIGHT / 2 - 9),
    [maxMagnitude]
  );
  const selectedPoint = points.find(
    (point) => point.roundNumber === selectedRound
  );
  const gridValues = [
    maxMagnitude,
    maxMagnitude / 2,
    0,
    -maxMagnitude / 2,
    -maxMagnitude,
  ];
  const screenReaderSummary = `${t("match_ui.economy.title")}. ${points.length} rounds. ${t("match_ui.economy.difference")}: ${values.map((value) => Math.round(value)).join(", ")}`;

  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{t("match_ui.economy.title")}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: menuOpen }}
          onPress={() => setMenuOpen((open) => !open)}
          style={({ pressed }) => [
            styles.metricButton,
            pressed && styles.metricButtonPressed,
          ]}
        >
          <Text style={styles.metricButtonText} numberOfLines={1}>
            {activeLabel}
          </Text>
          <Icon
            name={menuOpen ? "chevron-up" : "chevron-down"}
            size={18}
            color={MATCH_COLORS.textSecondary}
          />
        </Pressable>
      </View>

      {menuOpen ? (
        <View style={styles.metricMenu}>
          {options.map((option) => {
            const active = option.id === metric;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="menuitem"
                onPress={() => {
                  setMetric(option.id);
                  setMenuOpen(false);
                }}
                style={({ pressed }) => [
                  styles.metricOption,
                  active && styles.metricOptionActive,
                  pressed && styles.metricButtonPressed,
                ]}
              >
                <Text
                  style={[
                    styles.metricOptionText,
                    active && styles.metricOptionTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={styles.tooltip} accessibilityLiveRegion="polite">
        {selectedPoint ? (
          <>
            <Text style={styles.tooltipRound}>
              {t("match_ui.round.label", { number: selectedPoint.roundNumber })}
            </Text>
            <View style={styles.tooltipMetrics}>
              <Text style={styles.tooltipText}>
                A {compactCredits(selectedPoint.teamAEconomy)}
              </Text>
              <Text style={styles.tooltipText}>
                B {compactCredits(selectedPoint.teamBEconomy)}
              </Text>
              <Text
                style={[
                  styles.tooltipText,
                  selectedPoint.difference >= 0
                    ? styles.positiveText
                    : styles.negativeText,
                ]}
              >
                {compactCredits(selectedPoint.difference)}
              </Text>
              <Text style={styles.tooltipText}>
                {t("match_ui.round.winner")}: {selectedPoint.winningTeam}
              </Text>
            </View>
          </>
        ) : (
          <Text style={styles.tooltipHint}>{t("match_ui.economy.tap_hint")}</Text>
        )}
      </View>

      {points.length === 0 ? (
        <View style={styles.emptyChart}>
          <Icon name="chart-line" size={28} color={MATCH_COLORS.textMuted} />
          <Text style={styles.emptyText}>{t("match_ui.states.partial")}</Text>
        </View>
      ) : (
        <View
          style={styles.chartRow}
          accessible
          accessibilityLabel={screenReaderSummary}
        >
          <View style={styles.axisLabels}>
            {gridValues.map((value) => (
              <Text key={value} style={styles.axisLabel}>
                {compactCredits(value)}
              </Text>
            ))}
          </View>
          <ScrollView
            horizontal
            nestedScrollEnabled
            directionalLockEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chartScrollContent}
          >
            <View style={[styles.chart, { width: chartWidth }]}>
              {gridValues.map((value, index) => {
                const top = PLOT_TOP + (PLOT_HEIGHT / 4) * index;
                return (
                  <View
                    key={value}
                    style={[
                      styles.gridLine,
                      { top },
                      value === 0 && styles.zeroLine,
                    ]}
                  />
                );
              })}

              {points.slice(0, -1).map((point, index) => {
                const x1 = 20 + index * POINT_GAP;
                const x2 = 20 + (index + 1) * POINT_GAP;
                const value = values[index] ?? 0;
                const nextValue = values[index + 1] ?? 0;
                const color =
                  (value + nextValue) / 2 >= 0
                    ? MATCH_COLORS.chartPositive
                    : MATCH_COLORS.chartNegative;
                return (
                  <View
                    key={`segment-${point.roundNumber}`}
                    style={lineStyle(
                      x1,
                      yForValue(value),
                      x2,
                      yForValue(nextValue),
                      color
                    )}
                  />
                );
              })}

              {points.map((point, index) => {
                const value = values[index] ?? 0;
                const x = 20 + index * POINT_GAP;
                const y = yForValue(value);
                const selected = selectedRound === point.roundNumber;
                const color =
                  value >= 0
                    ? MATCH_COLORS.chartPositive
                    : MATCH_COLORS.chartNegative;
                return (
                  <React.Fragment key={point.roundNumber}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${t("match_ui.round.label", { number: point.roundNumber })}, ${compactCredits(value)}`}
                      onPress={() => setSelectedRound(point.roundNumber)}
                      style={[
                        styles.markerTarget,
                        { left: x - 22, top: y - 22 },
                      ]}
                    >
                      <View
                        style={[
                          styles.marker,
                          { backgroundColor: color },
                          selected && styles.markerSelected,
                        ]}
                      />
                    </Pressable>
                    <View
                      style={[
                        styles.winnerMarker,
                        {
                          left: x - 4,
                          backgroundColor:
                            point.winningTeam === "A"
                              ? MATCH_COLORS.teamA
                              : MATCH_COLORS.teamB,
                        },
                      ]}
                    />
                    <Text style={[styles.roundLabel, { left: x - 15 }]}>
                      {point.roundNumber}
                    </Text>
                  </React.Fragment>
                );
              })}
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  section: {
    paddingVertical: MATCH_SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: MATCH_COLORS.divider,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: MATCH_SPACING.md,
    paddingHorizontal: MATCH_SPACING.lg,
  },
  title: {
    color: MATCH_COLORS.textPrimary,
    fontSize: 20,
    fontWeight: "900",
  },
  metricButton: {
    minWidth: 118,
    maxWidth: 175,
    minHeight: MATCH_LAYOUT.minTouchTarget,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: MATCH_SPACING.xs,
    paddingHorizontal: MATCH_SPACING.md,
    borderRadius: MATCH_RADIUS.medium,
    borderWidth: 1,
    borderColor: MATCH_COLORS.border,
    backgroundColor: MATCH_COLORS.surfaceElevated,
  },
  metricButtonPressed: {
    opacity: 0.72,
  },
  metricButtonText: {
    flexShrink: 1,
    color: MATCH_COLORS.textPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  metricMenu: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: MATCH_SPACING.sm,
    marginHorizontal: MATCH_SPACING.lg,
    marginTop: MATCH_SPACING.sm,
    padding: MATCH_SPACING.sm,
    borderRadius: MATCH_RADIUS.card,
    borderWidth: 1,
    borderColor: MATCH_COLORS.border,
    backgroundColor: MATCH_COLORS.surfaceElevated,
  },
  metricOption: {
    width: "48%",
    minHeight: MATCH_LAYOUT.minTouchTarget,
    justifyContent: "center",
    paddingHorizontal: MATCH_SPACING.md,
    borderRadius: MATCH_RADIUS.small,
  },
  metricOptionActive: {
    backgroundColor: MATCH_COLORS.pressed,
  },
  metricOptionText: {
    color: MATCH_COLORS.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  metricOptionTextActive: {
    color: MATCH_COLORS.textPrimary,
    fontWeight: "800",
  },
  tooltip: {
    minHeight: 58,
    justifyContent: "center",
    marginHorizontal: MATCH_SPACING.lg,
    marginTop: MATCH_SPACING.md,
    paddingHorizontal: MATCH_SPACING.md,
    paddingVertical: MATCH_SPACING.sm,
    borderRadius: MATCH_RADIUS.medium,
    backgroundColor: MATCH_COLORS.surfaceElevated,
  },
  tooltipRound: {
    color: MATCH_COLORS.textPrimary,
    fontSize: 12,
    fontWeight: "800",
  },
  tooltipMetrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: MATCH_SPACING.md,
    marginTop: MATCH_SPACING.xs,
  },
  tooltipText: {
    color: MATCH_COLORS.textSecondary,
    fontSize: 11,
    fontWeight: "700",
  },
  tooltipHint: {
    color: MATCH_COLORS.textMuted,
    fontSize: 12,
  },
  positiveText: {
    color: MATCH_COLORS.chartPositive,
  },
  negativeText: {
    color: MATCH_COLORS.chartNegative,
  },
  chartRow: {
    height: CHART_HEIGHT,
    flexDirection: "row",
    marginTop: MATCH_SPACING.sm,
  },
  axisLabels: {
    width: 45,
    height: PLOT_HEIGHT + 12,
    justifyContent: "space-between",
    paddingTop: PLOT_TOP - 7,
    paddingLeft: MATCH_SPACING.sm,
  },
  axisLabel: {
    color: MATCH_COLORS.textMuted,
    fontSize: 9,
    textAlign: "right",
  },
  chartScrollContent: {
    paddingRight: MATCH_SPACING.lg,
  },
  chart: {
    height: CHART_HEIGHT,
  },
  gridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: MATCH_COLORS.chartGrid,
    opacity: 0.38,
  },
  zeroLine: {
    opacity: 0.82,
  },
  markerTarget: {
    position: "absolute",
    width: MATCH_LAYOUT.minTouchTarget,
    height: MATCH_LAYOUT.minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  marker: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: MATCH_COLORS.appBackground,
  },
  markerSelected: {
    width: 15,
    height: 15,
    borderRadius: 8,
    borderColor: MATCH_COLORS.textPrimary,
  },
  winnerMarker: {
    position: "absolute",
    top: PLOT_TOP + PLOT_HEIGHT + 9,
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  roundLabel: {
    position: "absolute",
    top: PLOT_TOP + PLOT_HEIGHT + 22,
    width: 30,
    color: MATCH_COLORS.textMuted,
    fontSize: 9,
    textAlign: "center",
  },
  emptyChart: {
    height: CHART_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    gap: MATCH_SPACING.sm,
  },
  emptyText: {
    color: MATCH_COLORS.textMuted,
    fontSize: 12,
  },
});
