// ===== EconomyChart.tsx =====
// Biểu đồ kinh tế (credits) theo từng vòng trong màn chi tiết trận đấu.
// Cho phép chọn chỉ số hiển thị (chênh lệch / tổng / từng đội / loadout /
// đã tiêu), vẽ line chart bằng View xoay, marker bấm được và tooltip vòng.
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import {
  MATCH_COLORS,
  MATCH_LAYOUT,
  MATCH_RADIUS,
  MATCH_SPACING,
} from "~/constants/MatchTheme";
import { GpuLineChartCanvas } from "~/components/ui/GpuLineChartCanvas";
import type { EconomyPoint } from "~/types/match-ui";
import { buildChartSegments } from "~/utils/chart-geometry";

/**
 * EconomyMetric – Các chỉ số kinh tế có thể chọn để vẽ biểu đồ.
 * - difference: chênh lệch kinh tế A vs B (mặc định)
 * - total: tổng kinh tế 2 đội | teamA/teamB: kinh tế từng đội
 * - loadout: chênh lệch loadout trung bình | spent: chênh lệch đã tiêu
 */
type EconomyMetric =
  | "difference"
  | "total"
  | "teamA"
  | "teamB"
  | "loadout"
  | "spent";

/**
 * EconomyChartProps – Props của EconomyChart.
 *
 * @param points – Dữ liệu kinh tế từng vòng (roundNumber, economy,
 *                 loadout, spent, winningTeam của đội A/B).
 */
type EconomyChartProps = {
  points: EconomyPoint[];
};

// Kích thước khung vẽ: đỉnh plot, chiều cao plot, chiều cao tổng, khoảng cách
// ngang giữa 2 điểm vòng liên tiếp
const PLOT_TOP = 16;
const PLOT_HEIGHT = 152;
const CHART_HEIGHT = 205;
const POINT_GAP = 44;

/**
 * compactCredits – Format số credits gọn cho nhãn trục/marker.
 * @param value – Số credits (có thể âm).
 * @returns "1.5k" / "-12k" (>=10k làm tròn nguyên, ngược lại 1 chữ số thập
 *          phân) hoặc số nguyên thường nếu < 1000.
 */
const compactCredits = (value: number) => {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (absolute >= 1000) {
    const digits = absolute >= 10_000 ? 0 : 1;
    return `${sign}${(absolute / 1000).toFixed(digits)}k`;
  }
  return `${Math.round(value)}`;
};

/**
 * metricValue – Lấy giá trị của một chỉ số tại một điểm dữ liệu.
 * @param point – Điểm kinh tế của một vòng.
 * @param metric – Chỉ số cần lấy (xem EconomyMetric).
 * @returns Giá trị số tương ứng với metric.
 */
const metricValue = (point: EconomyPoint, metric: EconomyMetric) => {
  if (metric === "total") return point.teamAEconomy + point.teamBEconomy;
  if (metric === "teamA") return point.teamAEconomy;
  if (metric === "teamB") return point.teamBEconomy;
  if (metric === "spent") return point.teamASpent - point.teamBSpent;
  return point.difference;
};

/**
 * EconomyChart – Biểu đồ kinh tế theo vòng (memo hoá).
 * State nội bộ: metric đang chọn, menu chọn metric mở/closed, vòng được chọn
 * (hiển thị tooltip). Vẽ: nhãn trục Y, grid line, đoạn thẳng nối các điểm
 * (màu theo dấu giá trị), marker bấm được + marker đội thắng + nhãn số vòng.
 * Có screen reader summary cho toàn bộ chart.
 *
 * @param points – Dữ liệu kinh tế từng vòng (xem EconomyChartProps).
 * @returns Section chứa tiêu đề, menu chọn metric, tooltip và biểu đồ.
 *
 * Side effects: không có timer/subscription/animation; state thuần UI.
 */
export const EconomyChart = React.memo(function EconomyChart({
  points,
}: EconomyChartProps) {
  const { t } = useTranslation();
  // metric: chỉ số kinh tế đang vẽ (mặc định: chênh lệch)
  const [metric, setMetric] = React.useState<EconomyMetric>("difference");
  // menuOpen: menu chọn metric có đang mở không
  const [menuOpen, setMenuOpen] = React.useState(false);
  // selectedRound: số vòng được bấm để xem tooltip (null = chưa chọn)
  const [selectedRound, setSelectedRound] = React.useState<number | null>(null);
  // options: danh sách metric + nhãn i18n cho menu chọn
  const options: { id: EconomyMetric; label: string }[] = [
    { id: "difference", label: t("match_ui.economy.difference") },
    { id: "total", label: t("match_ui.economy.total") },
    { id: "teamA", label: t("match_ui.teams.team_a") },
    { id: "teamB", label: t("match_ui.teams.team_b") },
    { id: "loadout", label: t("match_ui.economy.loadout") },
    { id: "spent", label: t("match_ui.economy.spent") },
  ];
  // activeLabel: nhãn i18n của metric đang chọn (hiển thị trên nút)
  const activeLabel = options.find((option) => option.id === metric)?.label ?? "";
  // values: mảng giá trị của metric tại từng vòng (memo theo metric/points)
  const values = React.useMemo(
    () => points.map((point) => metricValue(point, metric)),
    [metric, points]
  );
  // maxMagnitude: biên độ trục Y, làm tròn lên bội 5000 (tối thiểu 5000)
  const maxMagnitude = React.useMemo(() => {
    const rawMax = Math.max(5_000, ...values.map((value) => Math.abs(value)));
    return Math.ceil(rawMax / 5_000) * 5_000;
  }, [values]);
  // chartWidth: chiều rộng chart (tối thiểu 300, mở rộng theo số vòng)
  const chartWidth = Math.max(300, (points.length - 1) * POINT_GAP + 40);
  // yForValue: đổi giá trị số → tung độ pixel trong plot
  const yForValue = React.useCallback(
    (value: number) =>
      PLOT_TOP +
      PLOT_HEIGHT / 2 -
      (value / maxMagnitude) * (PLOT_HEIGHT / 2 - 9),
    [maxMagnitude]
  );
  // selectedPoint: điểm dữ liệu của vòng đang chọn trong tooltip
  const selectedPoint = points.find(
    (point) => point.roundNumber === selectedRound
  );
  // gridValues: 5 mức grid line trên trục Y (max, max/2, 0, -max/2, -max)
  const gridValues = React.useMemo(
    () => [
      maxMagnitude,
      maxMagnitude / 2,
      0,
      -maxMagnitude / 2,
      -maxMagnitude,
    ],
    [maxMagnitude]
  );
  const chartPoints = React.useMemo(
    () =>
      points.map((_point, index) => ({
        x: 20 + index * POINT_GAP,
        y: yForValue(values[index] ?? 0),
      })),
    [points, values, yForValue]
  );
  const chartSegments = React.useMemo(
    () =>
      buildChartSegments(chartPoints, (_start, _end, index) => {
        const value = values[index] ?? 0;
        const nextValue = values[index + 1] ?? 0;
        return (value + nextValue) / 2 >= 0
          ? MATCH_COLORS.chartPositive
          : MATCH_COLORS.chartNegative;
      }),
    [chartPoints, values]
  );
  const chartGridLines = React.useMemo(
    () =>
      gridValues.map((_value, index) => ({
        color: MATCH_COLORS.chartGrid,
        opacity: index === 2 ? 0.82 : 0.38,
        y: PLOT_TOP + (PLOT_HEIGHT / 4) * index,
      })),
    [gridValues]
  );
  const chartDots = React.useMemo(
    () =>
      chartPoints.map((point, index) => {
        const value = values[index] ?? 0;
        const selected = selectedRound === points[index]?.roundNumber;
        return {
          color:
            value >= 0
              ? MATCH_COLORS.chartPositive
              : MATCH_COLORS.chartNegative,
          point,
          radius: selected ? 7.5 : 4.5,
          strokeColor: selected
            ? MATCH_COLORS.textPrimary
            : MATCH_COLORS.appBackground,
          strokeWidth: 2,
        };
      }),
    [chartPoints, points, selectedRound, values]
  );
  // screenReaderSummary: mô tả toàn bộ chart cho screen reader
  const screenReaderSummary = `${t("match_ui.economy.title")}. ${t("match_ui.round.count", { count: points.length })}. ${activeLabel}: ${values.map((value) => Math.round(value)).join(", ")}`;

  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <Text
          accessibilityLabel={screenReaderSummary}
          accessibilityRole="summary"
          testID="match-detail-economy-summary"
          style={styles.title}
        >
          {t("match_ui.economy.title")}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t("match_ui.economy.title")}: ${activeLabel}`}
          accessibilityState={{ expanded: menuOpen }}
          testID="match-detail-economy-menu"
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
        <View
          accessibilityRole="menu"
          testID="match-detail-economy-menu-options"
          style={styles.metricMenu}
        >
          {options.map((option) => {
            const active = option.id === metric;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="menuitem"
                accessibilityLabel={option.label}
                accessibilityState={{ selected: active }}
                testID={`match-detail-economy-metric-${option.id}`}
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
          accessible={false}
          testID="match-detail-economy-chart"
          style={styles.chartRow}
        >
          <View
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            testID="match-detail-economy-axis-labels"
            style={styles.axisLabels}
          >
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
              <GpuLineChartCanvas
                dots={chartDots}
                gridLines={chartGridLines}
                height={CHART_HEIGHT}
                segments={chartSegments}
                width={chartWidth}
              />

              {points.map((point, index) => {
                const value = values[index] ?? 0;
                const x = 20 + index * POINT_GAP;
                const y = yForValue(value);
                const selected = selectedRound === point.roundNumber;
                return (
                  <React.Fragment key={point.roundNumber}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${t("match_ui.round.label", { number: point.roundNumber })}, ${activeLabel}: ${compactCredits(value)}`}
                      accessibilityState={{ selected }}
                      testID={`match-detail-economy-round-${point.roundNumber}`}
                      onPress={() => setSelectedRound(point.roundNumber)}
                      style={[
                        styles.markerTarget,
                        { left: x - 22, top: y - 22 },
                      ]}
                    />
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
                    <Text
                      accessible={false}
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                      testID={`match-detail-economy-round-label-${point.roundNumber}`}
                      style={[styles.roundLabel, { left: x - 15 }]}
                    >
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
  markerTarget: {
    position: "absolute",
    width: MATCH_LAYOUT.minTouchTarget,
    height: MATCH_LAYOUT.minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
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
