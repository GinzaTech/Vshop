// ===== PlayerInfoView.tsx – Giao diện "thông tin người chơi" (Obsidian Premium) =====
// Thiết kế lại phần thông tin chi tiết người chơi khi bấm nút "hồ sơ trang bị"
// và chuyển sang phần thông tin, theo spec VShop_UI_Spec.md:
//   - Card hồ sơ thu gọn nằm trong hero dùng chung của ProfileScreen
//   - TỔNG THỂ: editorial layout dùng divider (không card nền lớn)
//   - Phong độ: card grid 2×2 với bộ chọn Act
//   - Đặc vụ / Bản đồ: bảng top 6 với tab gạch chân lavender
//   - Chi tiết: panel hàng nhãn/giá trị từ season stats + rank
// Nguồn dữ liệu: seasonStats + match detail theo Act (props); không có số liệu
// giả. Mùa lịch sử được tải theo nhu cầu từ store, không crawl đồng loạt.
// Hai panel Tổng quan/Chi tiết luôn được layout sẵn để đổi tab không phải dựng
// lại card. Bảng Đặc vụ/Bản đồ vẫn dùng motion nhẹ và tôn trọng Reduce Motion.

import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import React from "react";
import {
  ActivityIndicator,
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  Easing,
  interpolate,
  ReduceMotion,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CachedImage as Image } from "~/components/CachedImage";
import AppRefreshControl from "~/components/ui/AppRefreshControl";
import { MOTION_DURATION } from "~/constants/Motion";
import {
  getProfileContentBottomPadding,
  PROFILE_INFO_COLORS,
  PROFILE_SEASON_SELECTOR_LAYOUT,
  PROFILE_INFO_TYPOGRAPHY,
} from "~/features/profile/profile-visual-policy";
import {
  aggregateMatches,
  type AggregateRow,
} from "~/components/profile/PlayerStatsDashboard";
import type {
  MatchHistoryRecord,
  SeasonPerformanceStats,
} from "~/types/match-ui";
import type { CompetitiveRankSummary } from "~/utils/profile-cache";
import type { LeaderboardSeasonOption } from "~/utils/leaderboard-seasons";
import {
  type ProfileDashboardTab,
  useProfileDashboardTabStore,
} from "~/features/profile/useProfileDashboardTabStore";

// ============================================================================
// Design tokens — ánh xạ từ design system chung để hai mode Profile đồng nhất
// ============================================================================

// Alias giữ tên ngữ nghĩa của component trong khi nguồn màu nằm ở visual policy.
const PLAYER_INFO_TOKENS = {
  bgElevated: PROFILE_INFO_COLORS.card,
  surfaceSubtle: PROFILE_INFO_COLORS.surfaceSubtle,
  border: PROFILE_INFO_COLORS.border,
  borderSubtle: PROFILE_INFO_COLORS.borderSubtle,
  divider: PROFILE_INFO_COLORS.divider,
  textPrimary: PROFILE_INFO_COLORS.textPrimary,
  textSecondary: PROFILE_INFO_COLORS.textSecondary,
  textMuted: PROFILE_INFO_COLORS.textMuted,
  accent: PROFILE_INFO_COLORS.accent,
  positive: PROFILE_INFO_COLORS.positive,
  negative: PROFILE_INFO_COLORS.negative,
  sectionPink: PROFILE_INFO_COLORS.sectionAccent,
  skeletonBase: PROFILE_INFO_COLORS.skeletonBase,
  skeletonHighlight: PROFILE_INFO_COLORS.skeletonHighlight,
} as const;

// MOTION_TAB_MORPH: timing cho hiệu ứng "co vào – nở ra" khi đổi tab
const MORPH_TIMING = {
  duration: MOTION_DURATION.standard,
  easing: Easing.out(Easing.cubic),
  reduceMotion: ReduceMotion.System,
} as const;

// ============================================================================
// Format helpers — đúng contract số liệu trong VShop_UI_Spec.md §8
// ============================================================================

/** formatTwoDecimals – K/D luôn 2 chữ số thập phân (0.90, 1.03). */
const formatTwoDecimals = (value: number | null | undefined) =>
  value === null || value === undefined ? "--" : value.toFixed(2);

/** formatOneDecimal – ADR một chữ số thập phân (144.9). */
const formatOneDecimal = (value: number | null | undefined) =>
  value === null || value === undefined ? "--" : value.toFixed(1);

/**
 * formatPercent – Phần trăm giữ số lẻ khi có (55.4%) và bỏ ".0" khi tròn
 * (18%, 47%, 100%). Giá trị null/undefined hiển thị "--".
 */
const formatPercent = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "--";
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
};

/** formatInteger – Số nguyên (86, 69, 216). */
const formatInteger = (value: number | null | undefined) =>
  value === null || value === undefined ? "--" : String(Math.round(value));

/**
 * prettifySeasonName – "Episode_8_Act_V" → "Episode 8 Act V" để hiển thị chip
 * Act trong card Phong độ (dữ liệu thật từ seasonStats.seasonName).
 */
const prettifySeasonName = (raw: string | null | undefined) =>
  (raw ?? "").replace(/_/g, " ").trim() || "--";

// ============================================================================
// Skeleton — cùng cấu trúc với nội dung thật (VShop_UI_Spec.md §10)
// ============================================================================

/**
 * SkeletonBlock – Khối xám placeholder trong trạng thái loading.
 * @param height – Chiều cao khối (dp).
 * @param width – Chiều rộng tuỳ chọn ("100%" mặc định).
 * @param radius – Bo góc (mặc định 10).
 */
const SkeletonBlock = ({
  height,
  width = "100%",
  radius = 10,
}: {
  height: number;
  width?: number | string;
  radius?: number;
}) => (
  <View
    style={{
      width: width as number | "100%",
      height,
      borderRadius: radius,
      backgroundColor: PLAYER_INFO_TOKENS.skeletonBase,
      overflow: "hidden",
    }}
  >
    <View
      style={{
        flex: 1,
        margin: 6,
        borderRadius: Math.max(4, radius - 4),
        backgroundColor: PLAYER_INFO_TOKENS.skeletonHighlight,
        opacity: 0.6,
      }}
    />
  </View>
);

/**
 * PlayerInfoSkeleton – Skeleton nội dung khi chưa có seasonStats:
 * hàng Tổng thể → card Phong độ → bảng Đặc vụ.
 */
const PlayerInfoSkeleton = () => (
  <View style={styles.screenPadding}>
    <SkeletonBlock height={16} width="40%" radius={8} />
    <View style={styles.skeletonRow}>
      <SkeletonBlock height={64} width="22%" radius={10} />
      <SkeletonBlock height={64} width="30%" radius={10} />
      <SkeletonBlock height={64} width="22%" radius={10} />
    </View>
    <SkeletonBlock height={172} radius={14} />
    <SkeletonBlock height={240} radius={14} />
  </View>
);

// ============================================================================
// Section header "TỔNG THỂ" — editorial: icon hồng + divider hai bên (§7.4)
// ============================================================================

/**
 * SectionDividerHeader – Tiêu đề section có icon nhỏ màu hồng và divider
 * ngang hai bên (dùng cho "TỔNG THỂ").
 * @param title – Nhãn section viết hoa.
 */
const SectionDividerHeader = ({ title }: { title: string }) => (
  <View style={styles.sectionDividerHeader}>
    <View style={styles.sectionDividerLine} />
    <Icon
      name="target"
      size={15}
      color={PLAYER_INFO_TOKENS.sectionPink}
      style={styles.sectionHeaderIcon}
    />
    <Text style={styles.sectionDividerTitle}>{title}</Text>
    <View style={styles.sectionDividerLine} />
  </View>
);

// ============================================================================
// TỔNG THỂ — primary row (Thắng/Thua/Tỉ lệ thắng/KAST) + secondary row
// ============================================================================

/**
 * VerticalDivider – Divider dọc giữa các nhóm số liệu khu Tổng thể.
 */
const VerticalDivider = () => <View style={styles.verticalDivider} />;

/**
 * MetricCellProps – Một ô số liệu generic.
 * @param label – Nhãn phía trên (THẮNG, KAST TB...).
 * @param value – Chuỗi đã format, không bao giờ wrap.
 * @param color – Màu giá trị (token).
 */
type MetricCellProps = {
  label: string;
  value: string;
  color: string;
};

/**
 * MetricCell – Nhãn nhỏ phía trên, giá trị nổi bật bên dưới, numberOfLines=1
 * để số liệu quan trọng không bao giờ xuống dòng (spec §11).
 */
const MetricCell = ({ label, value, color }: MetricCellProps) => (
  <View style={styles.metricCell}>
    <Text style={styles.metricLabel} numberOfLines={1}>
      {label}
    </Text>
    <Text style={[styles.metricValue, { color }]} numberOfLines={1}>
      {value}
    </Text>
  </View>
);

/**
 * LifetimeSummary – Khu TỔNG THỂ từ seasonStats: hàng chính 4 nhóm với
 * hàng phụ 3 cột HS TB / K/D TB (lavender) / ACS TB. Mọi số dùng cùng một
 * thang chữ để không tạo điểm neo giả giữa các chỉ số ngang hàng.
 * @param stats – Season stats thật (null → hiển thị "--").
 */
const LifetimeSummary = ({ stats }: { stats: SeasonPerformanceStats | null }) => {
  const { t } = useTranslation();
  return (
    <View>
      {/* Hàng chính: THẮNG | THUA | Tỉ lệ thắng | KAST */}
      <View style={styles.lifetimePrimaryRow}>
        <MetricCell
          label={t("profile_page.stats.wins")}
          value={formatInteger(stats?.wins)}
          color={PLAYER_INFO_TOKENS.positive}
        />
        <VerticalDivider />
        <MetricCell
          label={t("profile_page.stats.losses")}
          value={formatInteger(stats?.losses)}
          color={PLAYER_INFO_TOKENS.negative}
        />
        <VerticalDivider />
        <MetricCell
          label={t("profile_page.stats.win_rate")}
          value={formatPercent(stats?.winRate)}
          color={PLAYER_INFO_TOKENS.textPrimary}
        />
        <VerticalDivider />
        <MetricCell
          label={t("profile_page.stats.kast")}
          value={formatPercent(stats?.kast)}
          color={PLAYER_INFO_TOKENS.textPrimary}
        />
      </View>
      {/* Divider ngang + hàng phụ: HS TB | K/D TB (lavender) | ACS TB */}
      <View style={styles.lifetimeSecondaryRow}>
        <MetricCell
          label={t("profile_page.stats.hs_avg")}
          value={formatPercent(stats?.headshotPercent)}
          color={PLAYER_INFO_TOKENS.textPrimary}
        />
        <VerticalDivider />
        <MetricCell
          label={t("profile_page.stats.kd_avg")}
          value={formatTwoDecimals(stats?.kd)}
          color={PLAYER_INFO_TOKENS.accent}
        />
        <VerticalDivider />
        <MetricCell
          label={t("profile_page.stats.acs_avg")}
          value={formatInteger(stats?.acs)}
          color={PLAYER_INFO_TOKENS.textPrimary}
        />
      </View>
    </View>
  );
};

// ============================================================================
// SeasonSelector — chọn nhiều Act, hiển thị rõ mùa đang xem trên cả hai tab
// ============================================================================

const SeasonSelector = React.memo(function SeasonSelector({
  loading,
  onSelect,
  seasons,
  selectedSeasonId,
  selectedSeasonName,
}: {
  loading: boolean;
  onSelect: (seasonId: string) => void;
  seasons: readonly LeaderboardSeasonOption[];
  selectedSeasonId: string | null;
  selectedSeasonName: string;
}) {
  const { t } = useTranslation();

  return (
      <View style={styles.seasonPanel}>
    <View
      accessible
      accessibilityLabel={`${t("profile_page.stats.season_viewing")}: ${prettifySeasonName(selectedSeasonName)}`}
      style={styles.seasonHeaderRow}
      testID="profile-season-current-summary"
    >
      <View style={styles.seasonIconWrap}>
        <Icon
          color={PLAYER_INFO_TOKENS.accent}
          name="calendar-range"
          size={16}
        />
      </View>
      <View style={styles.seasonTitleBlock}>
        <Text style={styles.seasonEyebrow}>
          {t("profile_page.stats.season_viewing")}
        </Text>
        <Text numberOfLines={1} style={styles.seasonTitle}>
          {prettifySeasonName(selectedSeasonName)}
        </Text>
      </View>
      {loading ? (
        <ActivityIndicator
          color={PLAYER_INFO_TOKENS.accent}
          size="small"
        />
      ) : (
        <Text style={styles.seasonCount}>
          {t("profile_page.stats.act_count", { count: seasons.length })}
        </Text>
      )}
    </View>
    {seasons.length > 1 ? (
        <ScrollView
          accessibilityLabel={t("profile_page.stats.season_selector")}
          accessibilityRole="tablist"
          contentContainerStyle={styles.seasonChipRow}
          directionalLockEnabled
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          testID="profile-season-selector"
        >
          {seasons.map((season) => {
            const selected = season.id === selectedSeasonId;
            const disabled = loading && !selected;
            return (
              <Pressable
                key={season.id}
                accessibilityLabel={t("profile_page.stats.season_action", {
                  season: season.name,
                })}
                accessibilityRole="tab"
                accessibilityState={{ disabled, selected }}
                disabled={disabled}
                hitSlop={PROFILE_SEASON_SELECTOR_LAYOUT.chipHitSlop}
                onPress={() => onSelect(season.id)}
                style={({ pressed }) => [
                  styles.seasonChip,
                  selected && styles.seasonChipSelected,
                  pressed && !selected && styles.seasonChipPressed,
                ]}
                testID={`profile-season-${season.id}`}
              >
                {season.isActive ? <View style={styles.seasonActiveDot} /> : null}
                <Text
                  numberOfLines={1}
                  style={[
                    styles.seasonChipText,
                    selected && styles.seasonChipTextSelected,
                  ]}
                >
                  {prettifySeasonName(season.name)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
    ) : null}
    </View>
  );
});

// ============================================================================
// PerformanceCard — "Phong độ" grid 2×2 (spec §7.5)
// ============================================================================

/**
 * PerformanceGridCellProps – Một ô của grid Phong độ.
 * @param icon – Tên icon MaterialCommunityIcons đặt cạnh nhãn.
 * @param label – Nhãn metric (ADR, K/D, HS, Thắng).
 * @param value – Chuỗi đã format.
 */
type PerformanceGridCellProps = {
  icon: React.ComponentProps<typeof Icon>["name"];
  label: string;
  value: string;
};

/**
 * PerformanceGridCell – Ô 2×2: icon line nhỏ + nhãn và giá trị gọn
 * một dòng. Divider dọc/phòng do container đảm nhiệm.
 */
const PerformanceGridCell = ({ icon, label, value }: PerformanceGridCellProps) => (
  <View style={styles.performanceCell}>
    <View style={styles.performanceCellLabelRow}>
      <Icon
        name={icon}
        size={14}
        color={PLAYER_INFO_TOKENS.textMuted}
        style={styles.sectionHeaderIcon}
      />
      <Text style={styles.metricLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
    <Text style={styles.performanceCellValue} numberOfLines={1}>
      {value}
    </Text>
  </View>
);

/**
 * PerformanceCard – Card "Phong độ": header (icon cột + số trận của Act)
 * và grid 2×2 ADR / K/D / HS / Thắng có divider ngang + dọc. Dữ liệu lấy
 * trực tiếp từ seasonStats của act đang chạy — không thêm trend giả.
 * @param stats – Season stats thật (null → skeleton do cha xử lý).
 */
const PerformanceCard = ({ stats }: { stats: SeasonPerformanceStats | null }) => {
  const { t } = useTranslation();
  const matchCountText =
    stats?.matchCount === null || stats?.matchCount === undefined
      ? "--"
      : t("profile_page.stats.match_count", { count: stats.matchCount });
  return (
  <View style={styles.elevatedCard}>
    {/* Header: tiêu đề + số trận trong Act */}
    <View style={styles.performanceHeader}>
      <View style={styles.performanceHeaderTitleRow}>
        <Icon
          name="chart-bar"
          size={16}
          color={PLAYER_INFO_TOKENS.textPrimary}
          style={styles.sectionHeaderIcon}
        />
        <Text style={styles.cardTitle}>
          {t("profile_page.stats.performance")}
        </Text>
      </View>
      <View style={styles.matchCountPill}>
        <Text
          accessibilityLabel={matchCountText}
          numberOfLines={1}
          style={styles.matchCountText}
          testID="profile-match-count"
        >
          {matchCountText}
        </Text>
      </View>
    </View>
    {/* Grid 2×2 với divider dọc giữa 2 cột */}
    <View style={styles.performanceGrid}>
      <View style={styles.performanceGridCol}>
        <PerformanceGridCell
          icon="target"
          label={t("match_ui.metrics.adr")}
          value={formatOneDecimal(stats?.adr)}
        />
        <View style={styles.performanceGridDivider} />
        <PerformanceGridCell
          icon="shield-half-full"
          label={t("match_ui.metrics.hs")}
          value={formatPercent(stats?.headshotPercent)}
        />
      </View>
      <View style={styles.verticalDivider} />
      <View style={styles.performanceGridCol}>
        <PerformanceGridCell
          icon="sword"
          label={t("match_ui.metrics.kd")}
          value={formatTwoDecimals(stats?.kd)}
        />
        <View style={styles.performanceGridDivider} />
        <PerformanceGridCell
          icon="shield-check-outline"
          label={t("profile_page.stats.wins")}
          value={formatPercent(stats?.winRate)}
        />
      </View>
    </View>
  </View>
  );
};

// ============================================================================
// StatsTableCard — "Đặc vụ / Bản đồ" với tab gạch chân lavender (spec §7.6)
// ============================================================================

// TableMode: chế độ bảng — gom theo đặc vụ hoặc theo bản đồ
type TableMode = "agents" | "maps";

/**
 * StatsTableCard – Card bảng tổng hợp: 2 tab bằng nhau (Đặc vụ / Bản đồ)
 * với underline lavender 2dp trượt 150–200ms; header bảng 56/22/22%;
 * các hàng portrait 32dp + tên + K/D + Thắng; divider mảnh giữa các hàng.
 * Đổi tab kích hoạt hiệu ứng co/nở trên nội dung bảng.
 * @param agentRows – Bảng tổng hợp theo đặc vụ (tối đa 6 dòng).
 * @param mapRows – Bảng tổng hợp theo bản đồ (tối đa 6 dòng).
 */
const StatsTableCard = ({
  agentRows,
  mapRows,
}: {
  agentRows: AggregateRow[];
  mapRows: AggregateRow[];
}) => {
  const { t } = useTranslation();
  // tableMode: tab đang chọn; tableMorph: shared value hiệu ứng co/nở
  const [tableMode, setTableMode] = React.useState<TableMode>("agents");
  const tableMorph = useSharedValue(1);
  const rows = tableMode === "agents" ? agentRows : mapRows;

  // tabRowWidth + indicatorTranslateX: underline lavender 2dp trượt giữa 2 tab
  // (mỗi tab chiếm 50% chiều rộng hàng) theo timing chuẩn 150–200ms.
  const [tabRowWidth, setTabRowWidth] = React.useState(0);
  const indicatorTranslateX = useSharedValue(0);
  React.useEffect(() => {
    indicatorTranslateX.value = withTiming(
      tableMode === "agents" ? 0 : tabRowWidth / 2,
      MORPH_TIMING
    );
  }, [indicatorTranslateX, tableMode, tabRowWidth]);
  const indicatorAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorTranslateX.value }],
  }));

  /**
   * handleTableModeChange – Đổi tab bảng: chạy sequence co (0.94) → nở (1)
   * rồi mới swap dữ liệu để nội dung "co vào rồi nở ra" như spec.
   * @param mode – Tab đích ("agents" | "maps").
   */
  const handleTableModeChange = (mode: TableMode) => {
    if (mode === tableMode) return;
    setTableMode(mode);
    tableMorph.value = withSequence(
      withTiming(0.94, { duration: 100, reduceMotion: ReduceMotion.System }),
      withTiming(1, MORPH_TIMING)
    );
  };

  // tableAnimatedStyle: opacity + scale theo tableMorph (co/nở nội dung bảng)
  const tableAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tableMorph.value, [0.94, 1], [0.45, 1]),
    transform: [{ scale: tableMorph.value }],
  }));

  return (
    <View style={styles.elevatedCard}>
      {/* Tabs Đặc vụ / Bản đồ — underline lavender trượt theo tab active */}
      <View
        accessibilityLabel={t("profile_page.stats.breakdown_selector")}
        accessibilityRole="tablist"
        style={styles.tableTabRow}
        onLayout={(event) => setTabRowWidth(event.nativeEvent.layout.width)}
        testID="profile-breakdown-tabs"
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.tableTabIndicator, indicatorAnimatedStyle]}
        />
        {(
          [
            {
              key: "agents",
              label: t("profile_page.stats.breakdown_agents"),
              icon: "account-group",
            },
            {
              key: "maps",
              label: t("profile_page.stats.breakdown_maps"),
              icon: "grid-large",
            },
          ] as const
        ).map((tab) => {
          const active = tableMode === tab.key;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t("profile_page.stats.breakdown_action", {
                label: tab.label,
              })}
              onPress={() => handleTableModeChange(tab.key)}
              style={styles.tableTab}
              testID={`profile-breakdown-tab-${tab.key}`}
            >
              <Icon
                name={tab.icon}
                size={14}
                color={
                  active
                    ? PLAYER_INFO_TOKENS.textPrimary
                    : PLAYER_INFO_TOKENS.textMuted
                }
                style={styles.sectionHeaderIcon}
              />
              <Text
                style={[
                  styles.tableTabLabel,
                  {
                    color: active
                      ? PLAYER_INFO_TOKENS.textPrimary
                      : PLAYER_INFO_TOKENS.textMuted,
                  },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {/* Nội dung bảng (co/nở khi đổi tab) */}
      <Animated.View style={tableAnimatedStyle}>
        {rows.length === 0 ? (
          // Empty state: giữ card + tabs, không render bảng rỗng thừa divider
          <View style={styles.tableEmpty}>
            <Icon
              name="database-off"
              size={20}
              color={PLAYER_INFO_TOKENS.textMuted}
            />
            <Text style={styles.tableEmptyText}>
              {tableMode === "agents"
                ? t("profile_page.stats.no_agent_data")
                : t("profile_page.stats.no_map_data")}
            </Text>
          </View>
        ) : (
          <View>
            {/* Header bảng: 56% / 22% / 22% */}
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderText, styles.tableColName]}>
                {tableMode === "agents"
                  ? t("profile_page.stats.breakdown_agents")
                  : t("profile_page.stats.breakdown_maps")}
              </Text>
              <Text style={[styles.tableHeaderText, styles.tableColNum]}>
                {t("match_ui.metrics.kd")}
              </Text>
              <Text style={[styles.tableHeaderText, styles.tableColNum]}>
                {t("profile_page.stats.wins")}
              </Text>
            </View>
            {rows.map((row, index) => (
              <View
                key={row.id}
                style={[
                  styles.tableRow,
                  index > 0 && styles.tableRowDivider,
                ]}
              >
                <View style={styles.tableColName}>
                  {row.imageUrl ? (
                    <Image
                      source={{ uri: row.imageUrl }}
                      cacheId={`aggregate:${tableMode}:${row.id}`}
                      style={styles.tablePortrait}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={styles.tablePortraitFallback}>
                      <Text style={styles.tablePortraitInitial}>
                        {row.name.slice(0, 1)}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.tableRowName} numberOfLines={1}>
                    {row.name}
                  </Text>
                </View>
                <Text style={[styles.tableRowValue, styles.tableColNum]}>
                  {formatTwoDecimals(row.kd)}
                </Text>
                <Text style={[styles.tableRowValue, styles.tableColNum]}>
                  {formatPercent(row.winPercent)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Animated.View>
    </View>
  );
};

// ============================================================================
// DetailsPanel — nội dung tab "Chi tiết": rank + combat + tổng + thành tích
// ============================================================================

/**
 * DetailRow – Một dòng nhãn/giá trị trong panel Chi tiết.
 */
type DetailRow = { label: string; value: string; tone?: "positive" | "negative" };

/**
 * DetailSectionCard – Một nhóm dòng trong tab Chi tiết.
 * @param title – Tiêu đề nhóm (Combat, Tổng kết, Thành tích).
 * @param rows – Các dòng nhãn/giá trị.
 */
const DetailSectionCard = ({
  title,
  rows,
}: {
  title: string;
  rows: DetailRow[];
}) => (
  <View style={styles.elevatedCard}>
    <Text style={styles.cardTitle}>{title}</Text>
    <View style={styles.detailRows}>
      {rows.map((row) => (
        <View key={row.label} style={styles.detailRow}>
          <Text style={styles.metricLabel}>{row.label}</Text>
          <Text
            style={[
              styles.detailRowValue,
              row.tone === "positive" && {
                color: PLAYER_INFO_TOKENS.positive,
              },
              row.tone === "negative" && {
                color: PLAYER_INFO_TOKENS.negative,
              },
            ]}
            numberOfLines={1}
          >
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  </View>
);

/**
 * DetailsPanel – Toàn bộ nội dung tab "Chi tiết": card rank hiện tại/đỉnh
 * cao nhất (nếu có) + 3 nhóm chỉ số từ seasonStats (giữ nguyên công thức
 * của dashboard cũ: kills/round = kills/roundsPlayed).
 * @param stats – Season stats thật.
 * @param rank – Tóm tắt rank cạnh tranh (nullable).
 */
const DetailsPanel = React.memo(function DetailsPanel({
  stats,
  rank,
}: {
  stats: SeasonPerformanceStats | null;
  rank: CompetitiveRankSummary | null;
}) {
  const { t } = useTranslation();
  const detailedStats =
    stats?.dataCompleteness === "rank-only" ? null : stats;
  // killsPerRound: kills trung bình mỗi vòng (giữ công thức dashboard cũ)
  const killsPerRound =
    detailedStats && detailedStats.roundsPlayed > 0
      ? detailedStats.kills / detailedStats.roundsPlayed
      : null;

  return (
    <View>
      {rank ? (
        <View style={styles.elevatedCard}>
          <Text style={styles.cardTitle}>{t("profile_page.stats.rank")}</Text>
          <View style={styles.rankRows}>
            {/* Hạng hiện tại */}
            <View style={styles.rankRow}>
              {rank.currentIcon ? (
                <Image
                  source={{ uri: rank.currentIcon }}
                  cacheId={`rank:current:${rank.currentTier}`}
                  style={styles.rankIcon}
                  contentFit="contain"
                />
              ) : null}
              <View style={styles.rankRowTextBlock}>
                <Text style={styles.metricLabel}>
                  {t("profile_page.current_rank")}
                </Text>
                <Text style={styles.rankRowValue} numberOfLines={1}>
                  {rank.currentName || "--"}
                </Text>
              </View>
            </View>
            {/* Hạng đỉnh cao nhất */}
            <View style={styles.rankRow}>
              {rank.peakIcon ? (
                <Image
                  source={{ uri: rank.peakIcon }}
                  cacheId={`rank:peak:${rank.peakTier}`}
                  style={styles.rankIcon}
                  contentFit="contain"
                />
              ) : null}
              <View style={styles.rankRowTextBlock}>
                <Text style={styles.metricLabel}>
                  {t("profile_page.peak_rank")}
                </Text>
                <Text style={styles.rankRowValue} numberOfLines={1}>
                  {rank.peakName || "--"}
                </Text>
              </View>
            </View>
          </View>
        </View>
      ) : null}
      <DetailSectionCard
        title={t("profile_page.stats.combat")}
        rows={[
          { label: "K/D", value: formatTwoDecimals(stats?.kd) },
          { label: "ACS", value: formatOneDecimal(stats?.acs) },
          {
            label: t("profile_page.stats.damage_per_round"),
            value: formatOneDecimal(stats?.adr),
          },
          {
            label: t("profile_page.stats.kills_per_round"),
            value: formatTwoDecimals(killsPerRound),
          },
          { label: "HS%", value: formatPercent(stats?.headshotPercent) },
          { label: "KAST%", value: formatPercent(stats?.kast) },
        ]}
      />
      <DetailSectionCard
        title={t("profile_page.stats.summary")}
        rows={[
          { label: t("profile_page.stats.kills"), value: formatInteger(detailedStats?.kills) },
          { label: t("profile_page.stats.deaths"), value: formatInteger(detailedStats?.deaths) },
          { label: t("profile_page.stats.headshots"), value: formatInteger(detailedStats?.headshots) },
          { label: t("profile_page.stats.damage"), value: formatInteger(detailedStats?.damage) },
          { label: t("profile_page.stats.score"), value: formatInteger(detailedStats?.score) },
          { label: t("profile_page.stats.rounds"), value: formatInteger(detailedStats?.roundsPlayed) },
        ]}
      />
      <DetailSectionCard
        title={t("profile_page.stats.achievements")}
        rows={[
          { label: t("profile_page.stats.wins"), value: formatInteger(stats?.wins), tone: "positive" },
          { label: t("profile_page.stats.losses"), value: formatInteger(stats?.losses), tone: "negative" },
          { label: t("profile_page.stats.matches"), value: formatInteger(stats?.matchCount) },
          {
            label: t("profile_page.stats.win_rate"),
            value: formatPercent(stats?.winRate),
          },
        ]}
      />
    </View>
  );
});

const OverviewPanel = React.memo(function OverviewPanel({
  agentRows,
  mapRows,
  stats,
}: {
  agentRows: AggregateRow[];
  mapRows: AggregateRow[];
  stats: SeasonPerformanceStats | null;
}) {
  const { t } = useTranslation();
  return (
    <>
      <View style={[styles.elevatedCard, styles.summaryCard]}>
        <SectionDividerHeader title={t("profile_page.stats.overall")} />
        <LifetimeSummary stats={stats} />
      </View>
      <PerformanceCard stats={stats} />
      <StatsTableCard agentRows={agentRows} mapRows={mapRows} />
    </>
  );
});

type DashboardPanelShellProps = React.PropsWithChildren<{
  animatedStyle: React.ComponentProps<typeof Animated.View>["style"];
  onLayout: (event: LayoutChangeEvent) => void;
  panel: ProfileDashboardTab;
  panelTestID: string;
  panelStyle?: React.ComponentProps<typeof Animated.View>["style"];
}>;

/** Chỉ shell nhỏ này subscribe tab; nội dung, selector và ScrollView không render lại. */
const DashboardPanelShell = ({
  animatedStyle,
  children,
  onLayout,
  panel,
  panelTestID,
  panelStyle,
}: DashboardPanelShellProps) => {
  const activeTab = useProfileDashboardTabStore((state) => state.activeTab);
  const active = activeTab === panel;

  return (
    <Animated.View
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? "auto" : "no-hide-descendants"}
      onLayout={onLayout}
      pointerEvents={active ? "auto" : "none"}
      style={[styles.tabPanel, panelStyle, animatedStyle]}
      testID={panelTestID}
    >
      {children}
    </Animated.View>
  );
};

// ============================================================================
// PlayerInfoView — component chính (drop-in thay PlayerStatsDashboard)
// ============================================================================

/**
 * PlayerInfoViewProps – Props giống hệt PlayerStatsDashboard để thay thế
 * trực tiếp trong ProfileScreen mà không đổi luồng dữ liệu.
 *
 * @param competitiveRank – Tóm tắt rank cạnh tranh (null nếu chưa có).
 * @param loading – Đang sync dữ liệu lần đầu (hiện skeleton).
 * @param matches – Danh sách trận (đã lọc competitive nội bộ để aggregate).
 * @param onRefresh – Callback pull-to-refresh cho đúng Act đang chọn.
 * @param onSeasonChange – Tải dữ liệu khi người dùng chọn Act khác.
 * @param refreshing – Pull-to-refresh đang chạy.
 * @param seasonStats – Thống kê season/act hiện tại (null → skeleton).
 */
type PlayerInfoViewProps = {
  competitiveRank: CompetitiveRankSummary | null;
  loading: boolean;
  matches: MatchHistoryRecord[];
  onRefresh: (seasonId?: string) => void;
  onSeasonChange: (seasonId: string) => void | Promise<void>;
  refreshing: boolean;
  seasonMatchesById: Record<string, MatchHistoryRecord[]>;
  seasonOptions: LeaderboardSeasonOption[];
  seasonStats: SeasonPerformanceStats | null;
  seasonStatsById: Record<string, SeasonPerformanceStats>;
  tabProgress: SharedValue<number>;
};

/**
 * PlayerInfoView – Nội dung thống kê Obsidian Premium. Card hồ sơ nằm trong
 * hero dùng chung ở ProfileScreen để có thể morph trực tiếp. Chỉ số lifetime
 * + act + bảng agent/map đều tính từ props thật.
 */
const PlayerInfoView = ({
  competitiveRank,
  loading,
  matches,
  onRefresh,
  onSeasonChange,
  refreshing,
  seasonMatchesById,
  seasonOptions,
  seasonStats,
  seasonStatsById,
  tabProgress,
}: PlayerInfoViewProps) => {
  const insets = useSafeAreaInsets();
  const overviewPanelAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tabProgress.value, [0, 1], [1, 0]),
  }));
  const detailsPanelAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tabProgress.value, [0, 1], [0, 1]),
  }));
  const initialSeasonId =
    seasonStats?.seasonId ??
    seasonOptions.find((season) => season.isActive)?.id ??
    seasonOptions[0]?.id ??
    null;
  const [selectedSeasonId, setSelectedSeasonId] =
    React.useState<string | null>(initialSeasonId);

  React.useEffect(() => {
    const selectedStillAvailable = Boolean(
      selectedSeasonId &&
        (seasonOptions.some((season) => season.id === selectedSeasonId) ||
          seasonStatsById[selectedSeasonId] ||
          seasonStats?.seasonId === selectedSeasonId)
    );
    if (selectedStillAvailable) return;

    setSelectedSeasonId(
      seasonStats?.seasonId ??
        seasonOptions.find((season) => season.isActive)?.id ??
        seasonOptions[0]?.id ??
        null
    );
  }, [seasonOptions, seasonStats, seasonStatsById, selectedSeasonId]);

  const selectedOption = React.useMemo(
    () => seasonOptions.find((season) => season.id === selectedSeasonId) ?? null,
    [seasonOptions, selectedSeasonId]
  );
  const selectedStats = React.useMemo(() => {
    if (!selectedSeasonId) return seasonStats;
    const cachedStats = seasonStatsById[selectedSeasonId];
    if (cachedStats) return cachedStats;
    return seasonStats?.seasonId === selectedSeasonId ? seasonStats : null;
  }, [seasonStats, seasonStatsById, selectedSeasonId]);
  const selectedIsCurrent =
    selectedOption?.isActive ??
    Boolean(
      selectedSeasonId && seasonStats?.seasonId === selectedSeasonId
    );

  const handleSeasonSelect = React.useCallback(
    (seasonId: string) => {
      if (seasonId === selectedSeasonId) return;
      setSelectedSeasonId(seasonId);
      void onSeasonChange(seasonId);
    },
    [onSeasonChange, selectedSeasonId]
  );

  // Ưu tiên lô hydrate đầy đủ của Act; cache cũ fallback qua seasonId trên record.
  const competitiveMatches = React.useMemo(
    () => {
      const cachedSeasonMatches = selectedSeasonId
        ? seasonMatchesById[selectedSeasonId]
        : undefined;
      const sourceMatches =
        cachedSeasonMatches ??
        matches.filter((match) => {
          const matchSeasonId = match.stats?.seasonId;
          return matchSeasonId
            ? matchSeasonId.toLocaleLowerCase("en-US") ===
                selectedSeasonId?.toLocaleLowerCase("en-US")
            : selectedIsCurrent;
        });

      return sourceMatches.filter(
        (match) =>
          match.stats &&
          (!match.QueueID || match.QueueID.toLowerCase() === "competitive")
      );
    },
    [matches, seasonMatchesById, selectedIsCurrent, selectedSeasonId]
  );
  // agentRows/mapRows: bảng tổng hợp top 6 (tái dùng aggregateMatches)
  const agentRows = React.useMemo(
    () => aggregateMatches(competitiveMatches, "agents"),
    [competitiveMatches]
  );
  const mapRows = React.useMemo(
    () => aggregateMatches(competitiveMatches, "maps"),
    [competitiveMatches]
  );
  const [tabPanelHeights, setTabPanelHeights] = React.useState({
    details: 0,
    overview: 0,
  });
  const handleTabPanelLayout = React.useCallback(
    (panel: "details" | "overview", event: LayoutChangeEvent) => {
      const measuredHeight = Math.ceil(event.nativeEvent.layout.height);
      if (measuredHeight <= 0) return;
      setTabPanelHeights((current) =>
        current[panel] === measuredHeight
          ? current
          : { ...current, [panel]: measuredHeight }
      );
    },
    []
  );
  const tabPanelStackHeight = Math.max(
    1,
    tabPanelHeights.details,
    tabPanelHeights.overview
  );

  const showSkeleton = loading && !selectedStats;
  const selectedSeasonName =
    selectedOption?.name ?? selectedStats?.seasonName ?? "--";

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.screenPaddingBottom,
        { paddingBottom: getProfileContentBottomPadding(insets.bottom) },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <AppRefreshControl
          refreshing={refreshing}
          onRefresh={() => onRefresh(selectedSeasonId ?? undefined)}
        />
      }
    >
      <SeasonSelector
        loading={loading}
        onSelect={handleSeasonSelect}
        seasons={seasonOptions}
        selectedSeasonId={selectedSeasonId}
        selectedSeasonName={selectedSeasonName}
      />
      {showSkeleton ? (
        <PlayerInfoSkeleton />
      ) : (
      <View
        style={[styles.tabPanelStack, { height: tabPanelStackHeight }]}
        testID="profile-tab-panel-stack"
      >
        {/* Hai panel luôn được mount và đo sẵn; đổi tab chỉ đổi opacity/touch,
            không kích hoạt lại layout của toàn bộ card trên JS thread. */}
        <DashboardPanelShell
          animatedStyle={overviewPanelAnimatedStyle}
          onLayout={(event) => handleTabPanelLayout("overview", event)}
          panel="overview"
          panelTestID="profile-overview-panel"
        >
          <OverviewPanel
            agentRows={agentRows}
            mapRows={mapRows}
            stats={selectedStats}
          />
        </DashboardPanelShell>
        <DashboardPanelShell
          animatedStyle={detailsPanelAnimatedStyle}
          onLayout={(event) => handleTabPanelLayout("details", event)}
          panel="details"
          panelTestID="profile-details-panel"
          panelStyle={styles.detailsGap}
        >
          <DetailsPanel
            stats={selectedStats}
            rank={selectedIsCurrent ? competitiveRank : null}
          />
        </DashboardPanelShell>
      </View>
      )}
    </ScrollView>
  );
};

export default PlayerInfoView;

// ============================================================================
// Styles — spacing bội số 4dp, radius theo spec (card 14–16, avatar tròn)
// ============================================================================

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PROFILE_INFO_COLORS.background },
  screenPaddingBottom: { paddingHorizontal: 12, paddingTop: 10, gap: 12 },
  screenPadding: { gap: 12 },
  tabPanelStack: { minHeight: 1, position: "relative" },
  tabPanel: { left: 0, position: "absolute", right: 0, top: 0 },

  // Skeleton
  skeletonRow: { flexDirection: "row", gap: 12 },

  // ── Section header (TỔNG THỂ) ──
  sectionDividerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  sectionDividerLine: { flex: 1, height: 1, backgroundColor: PLAYER_INFO_TOKENS.divider },
  sectionHeaderIcon: { marginRight: 6 },
  sectionDividerTitle: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 1,
    color: PLAYER_INFO_TOKENS.textPrimary,
    marginHorizontal: 8,
  },

  // ── TỔNG THỂ ──
  lifetimePrimaryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  lifetimeSecondaryRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: PLAYER_INFO_TOKENS.divider,
    paddingVertical: 12,
  },
  verticalDivider: { width: 1, alignSelf: "stretch", backgroundColor: PLAYER_INFO_TOKENS.divider },
  metricCell: { flex: 1, alignItems: "center", gap: 4, paddingHorizontal: 4 },
  metricLabel: {
    fontSize: 9.5,
    fontWeight: "500",
    color: PLAYER_INFO_TOKENS.textMuted,
  },
  metricValue: {
    fontSize: PROFILE_INFO_TYPOGRAPHY.summaryMetricValue,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
    lineHeight: 30,
  },

  // ── Card nền chung (Phong độ / Đặc vụ / Chi tiết) ──
  elevatedCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PLAYER_INFO_TOKENS.border,
    backgroundColor: PLAYER_INFO_TOKENS.bgElevated,
    padding: 14,
    gap: 10,
    marginTop: 12,
  },
  summaryCard: {
    marginTop: 0,
    paddingBottom: 4,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: PLAYER_INFO_TOKENS.textPrimary,
  },

  // ── Chọn mùa ──
  seasonPanel: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PLAYER_INFO_TOKENS.border,
    backgroundColor: PLAYER_INFO_TOKENS.bgElevated,
    paddingVertical: PROFILE_SEASON_SELECTOR_LAYOUT.panelPaddingVertical,
  },
  seasonHeaderRow: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  seasonIconWrap: {
    width: PROFILE_SEASON_SELECTOR_LAYOUT.iconSize,
    height: PROFILE_SEASON_SELECTOR_LAYOUT.iconSize,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PLAYER_INFO_TOKENS.surfaceSubtle,
    borderWidth: 1,
    borderColor: PLAYER_INFO_TOKENS.borderSubtle,
  },
  seasonTitleBlock: { flex: 1, minWidth: 0, marginLeft: 8 },
  seasonEyebrow: {
    color: PLAYER_INFO_TOKENS.textMuted,
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.8,
  },
  seasonTitle: {
    color: PLAYER_INFO_TOKENS.textPrimary,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  seasonCount: {
    color: PLAYER_INFO_TOKENS.textMuted,
    fontSize: 9,
    fontWeight: "700",
    marginLeft: 8,
  },
  seasonChipRow: {
    gap: 6,
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  seasonChip: {
    minHeight: PROFILE_SEASON_SELECTOR_LAYOUT.chipHeight,
    maxWidth: 170,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PLAYER_INFO_TOKENS.borderSubtle,
    backgroundColor: PLAYER_INFO_TOKENS.surfaceSubtle,
  },
  seasonChipSelected: {
    borderColor: PLAYER_INFO_TOKENS.accent,
    backgroundColor: PLAYER_INFO_TOKENS.accent,
  },
  seasonChipPressed: { opacity: 0.72 },
  seasonActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 7,
    backgroundColor: PLAYER_INFO_TOKENS.positive,
  },
  seasonChipText: {
    flexShrink: 1,
    color: PLAYER_INFO_TOKENS.textSecondary,
    fontSize: 10.5,
    fontWeight: "600",
  },
  seasonChipTextSelected: { color: PLAYER_INFO_TOKENS.textPrimary },

  // ── Phong độ ──
  performanceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 32,
  },
  performanceHeaderTitleRow: { flexDirection: "row", alignItems: "center" },
  matchCountPill: {
    flexDirection: "row",
    alignItems: "center",
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PLAYER_INFO_TOKENS.border,
    backgroundColor: PLAYER_INFO_TOKENS.surfaceSubtle,
  },
  matchCountText: {
    fontSize: 10.5,
    fontVariant: ["tabular-nums"],
    fontWeight: "600",
    color: PLAYER_INFO_TOKENS.textSecondary,
  },
  performanceGrid: { flexDirection: "row", alignItems: "stretch" },
  performanceGridCol: { flex: 1, gap: 10 },
  performanceGridDivider: { height: 1, backgroundColor: PLAYER_INFO_TOKENS.borderSubtle },
  performanceCell: { gap: 4, paddingHorizontal: 6, paddingVertical: 2 },
  performanceCellLabelRow: { flexDirection: "row", alignItems: "center" },
  performanceCellValue: {
    fontSize: PROFILE_INFO_TYPOGRAPHY.performanceMetricValue,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
    color: PLAYER_INFO_TOKENS.textPrimary,
  },

  // ── Đặc vụ / Bản đồ ──
  tableTabRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: PLAYER_INFO_TOKENS.borderSubtle,
  },
  tableTab: {
    flex: 1,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
  },
  tableTabLabel: { fontSize: 12, fontWeight: "500" },
  tableTabIndicator: {
    position: "absolute",
    left: 0,
    bottom: 0,
    width: "50%",
    height: 2,
    borderRadius: 2,
    backgroundColor: PLAYER_INFO_TOKENS.accent,
  },
  tableHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 32,
    borderBottomWidth: 1,
    borderBottomColor: PLAYER_INFO_TOKENS.borderSubtle,
  },
  tableHeaderText: {
    fontSize: 9.5,
    fontWeight: "500",
    color: PLAYER_INFO_TOKENS.textMuted,
  },
  tableColName: { width: "56%", flexDirection: "row", alignItems: "center", gap: 10 },
  tableColNum: { width: "22%", textAlign: "right" },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
  },
  tableRowDivider: { borderTopWidth: 1, borderTopColor: PLAYER_INFO_TOKENS.borderSubtle },
  tablePortrait: { width: 32, height: 32, borderRadius: 6 },
  tablePortraitFallback: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PLAYER_INFO_TOKENS.surfaceSubtle,
  },
  tablePortraitInitial: {
    fontSize: 11,
    fontWeight: "600",
    color: PLAYER_INFO_TOKENS.textSecondary,
  },
  tableRowName: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "500",
    color: PLAYER_INFO_TOKENS.textPrimary,
  },
  tableRowValue: {
    fontSize: 12,
    fontWeight: "600",
    color: PLAYER_INFO_TOKENS.textPrimary,
  },
  tableEmpty: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 28,
  },
  tableEmptyText: {
    fontSize: 11,
    fontWeight: "500",
    color: PLAYER_INFO_TOKENS.textMuted,
  },

  // ── Chi tiết ──
  detailsGap: { gap: 4 },
  detailRows: { gap: 0 },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 40,
    borderTopWidth: 1,
    borderTopColor: PLAYER_INFO_TOKENS.borderSubtle,
  },
  detailRowValue: {
    fontSize: PROFILE_INFO_TYPOGRAPHY.detailMetricValue,
    fontVariant: ["tabular-nums"],
    fontWeight: "600",
    color: PLAYER_INFO_TOKENS.textPrimary,
    flexShrink: 1,
    marginLeft: 12,
  },
  rankRows: { gap: 10 },
  rankRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  rankIcon: { width: 40, height: 40 },
  rankRowTextBlock: { gap: 2, flexShrink: 1 },
  rankRowValue: {
    fontSize: 13,
    fontWeight: "600",
    color: PLAYER_INFO_TOKENS.textPrimary,
  },
});
