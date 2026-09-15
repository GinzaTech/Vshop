import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import React from "react";
import { Text, View } from "react-native";
import Animated, { Extrapolation, interpolate, SharedValue, useAnimatedStyle } from "react-native-reanimated";
import { STATS_COLORS, styles } from "./player-stats-styles";
import { DashboardTone, toneColor } from "./player-stats-format";
export type DashboardCardProps = {
  children: React.ReactNode;
  index: number;
  tabProgress: SharedValue<number>;
};

/**
 * DashboardCard – Khung card có entrance animation khi đổi tab (memo không
 * bắt buộc): mỗi card hiện dần (opacity) + trượt lên (translateY) theo
 * một khoảng tabProgress lệch nhau theo index (stagger). Chạy trên UI
 * thread; ReduceMotion.System do withTiming điều khiển.
 *
 * @param children – Nội dung card.
 * @param index – Thứ tự card trong danh sách.
 * @param tabProgress – SharedValue tiến trình tab.
 * @returns Animated.View card đã animate.
 */
export function DashboardCard({
  children,
  index,
  tabProgress,
}: DashboardCardProps) {
  // animatedStyle: map tabProgress → opacity + translateY theo mốc index
  const animatedStyle = useAnimatedStyle(() => {
    const start = Math.min(0.24, 0.025 + index * 0.04);
    const end = Math.min(0.92, start + 0.42);
    const reveal = interpolate(
      tabProgress.value,
      [start, end],
      [0, 1],
      Extrapolation.CLAMP
    );

    return {
      opacity: reveal,
      transform: [
        { translateY: interpolate(reveal, [0, 1], [6, 0]) },
      ],
    };
  }, [index]);

  return (
    <Animated.View style={[styles.card, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

/**
 * CardHeaderProps – Props của CardHeader.
 *
 * @param icon – Icon MaterialCommunityIcons trong ô vuông accent.
 * @param right – (tuỳ chọn) Node hiển thị bên phải header (badge, nút...).
 * @param title – Tiêu đề card (font mono, uppercase).
 */
export type CardHeaderProps = {
  icon: React.ComponentProps<typeof Icon>["name"];
  right?: React.ReactNode;
  title: string;
};

/**
 * CardHeader – Header dùng chung cho mọi dashboard card:
 * [icon accent] [title] ..................... [right tuỳ chọn].
 *
 * @param icon – Icon tiêu đề.
 * @param right – Node bên phải (tuỳ chọn).
 * @param title – Tiêu đề.
 * @returns View header có border-bottom.
 */
export function CardHeader({ icon, right, title }: CardHeaderProps) {
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

/**
 * MetricCellProps – Props của MetricCell.
 *
 * @param label – Nhãn chỉ số.
 * @param value – Giá trị đã format.
 * @param tone – (mặc định "neutral") Tông màu giá trị.
 * @param right – (tuỳ chọn) Ô nằm cột phải (thêm border-left).
 * @param bottom – (tuỳ chọn) Ô nằm hàng dưới (thêm border-top).
 */
export type MetricCellProps = {
  bottom?: boolean;
  label: string;
  right?: boolean;
  tone?: DashboardTone;
  value: string;
};

/**
 * MetricCell – Ô chỉ số 2x2 trong PerformanceCard (nhãn trên, giá trị dưới).
 *
 * @param bottom – Ô hàng dưới.
 * @param label – Nhãn chỉ số.
 * @param right – Ô cột phải.
 * @param tone – Tông màu giá trị.
 * @param value – Giá trị hiển thị.
 * @returns View ô metric.
 */
export function MetricCell({
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

/**
 * PerformanceCardProps – Props của PerformanceCard.
 *
 * @param onRequestDetails – Callback khi bấm nút "DETAILS".
 * @param seasonStats – Thống kê season (ADR, K/D, HS%, WIN%...).
 */
export type DetailRow = {
  label: string;
  tone?: DashboardTone;
  value: string;
};

/**
 * DetailSectionProps – Props của DetailSection.
 *
 * @param rows – Danh sách dòng chỉ số.
 * @param title – Tiêu đề section (COMBAT/TOTALS/RECORD).
 */
export type DetailSectionProps = {
  rows: DetailRow[];
  title: string;
};

/**
 * DetailSection – Section danh sách dòng nhãn-giá trị (tab details), dùng
 * cho các card COMBAT, TOTALS và RECORD.
 *
 * @param rows – Các dòng chỉ số.
 * @param title – Tiêu đề section.
 * @returns Fragment header + các dòng detail.
 */
export function DetailSection({ rows, title }: DetailSectionProps) {
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
