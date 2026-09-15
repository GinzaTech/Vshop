import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import React from "react";
import { LayoutChangeEvent, Pressable, ScrollView, Text, View } from "react-native";
import type { MatchHistoryRecord } from "~/types/match-ui";
import { CardHeader } from "./PlayerStatsPrimitives";
import { ActivityCell, buildActivityWeeks } from "./player-stats-data";
import { lineStyle } from "./player-stats-format";
import { STATS_COLORS, styles } from "./player-stats-styles";
export type ActivityCardProps = {
  matches: MatchHistoryRecord[];
};

/**
 * ActivityCard – Card heatmap hoạt động 12 tuần (tab overview):
 * hàng nhãn tháng, lưới ô bấm được (đếm trận/ngày, tô màu theo level,
 * ô tương lai disabled), footer hiển thị chi tiết ô đang chọn + legend.
 *
 * @param matches – Danh sách trận.
 * @returns Fragment header + heatmap + footer chọn/legend.
 */
export function ActivityCard({ matches }: ActivityCardProps) {
  // weeks: dữ liệu 12 tuần (memo theo matches)
  const weeks = React.useMemo(() => buildActivityWeeks(matches), [matches]);
  // selectedCell: ô đang chọn hiển thị chi tiết ở footer (null nếu chưa)
  const [selectedCell, setSelectedCell] = React.useState<ActivityCell | null>(null);
  // activityColors: dải 6 màu từ trống tới tích cực nhất
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

/**
 * RrTrendCardProps – Props của RrTrendCard.
 *
 * @param matches – Danh sách trận dùng vẽ trend RR.
 */
export type RrTrendCardProps = {
  matches: MatchHistoryRecord[];
};

/**
 * RrTrendCard – Card biểu đồ xu hướng RR 10 trận gần nhất (tab overview):
 * lấy rrAfter (hoặc RankedRatingAfterUpdate), đảo để cũ → mới, vẽ grid line,
 * đoạn thẳng nối các điểm và nhãn min/max; điểm data < 2 hiện empty state.
 *
 * @param matches – Danh sách trận.
 * @returns Fragment header + chart tuyến tính hoặc empty state.
 */
export function RrTrendCard({ matches }: RrTrendCardProps) {
  // chartWidth: bề rộng vùng chart (cập nhật qua onLayout)
  const [chartWidth, setChartWidth] = React.useState(280);
  // points: tối đa 10 giá trị RR gần nhất, đã đảo theo thời gian tăng dần
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
  // plotWidth: bề rộng vùng vẽ trừ lề nhãn
  const plotWidth = Math.max(120, chartWidth - 42);
  // minimum/maximum/range: biên giá trị RR để scale trục Y (range tối thiểu 10)
  const minimum = points.length > 0 ? Math.min(...points) : 0;
  const maximum = points.length > 0 ? Math.max(...points) : 100;
  const range = Math.max(10, maximum - minimum);
  // yForValue: giá trị RR → tung độ pixel; xForIndex: vị trí điểm → hoành độ
  const yForValue = (value: number) => 10 + ((maximum - value) / range) * 74;
  const xForIndex = (index: number) =>
    8 + (points.length <= 1 ? 0 : (index / (points.length - 1)) * (plotWidth - 16));
  // handleLayout: đo bề rộng thực của vùng chart
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

/**
 * RankSummaryCardProps – Props của RankSummaryCard.
 *
 * @param competitiveRank – Tóm tắt rank (current/peak) hoặc null.
 */
