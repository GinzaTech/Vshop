// 📦 leaderboard.tsx – Màn hình Bảng xếp hạng (Leaderboard) game Valorant
// Hiển thị danh sách người chơi theo thứ hạng cạnh tranh, theo mùa giải

import React from "react";
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { ActivityIndicator } from "react-native-paper";
import { CachedImage as Image } from "~/components/CachedImage";
import { useTranslation } from "react-i18next";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";

import { useUserStore } from "~/hooks/useUserStore";
import { getLeaderboard, getContent } from "~/utils/valorant-api";
import { fetchCompetitiveTiers, getAssets } from "~/utils/valorant-assets";
import GlassCard from "~/components/ui/GlassCard";
import { COLORS, RADIUS } from "~/constants/DesignSystem";
import {
  COMPETITIVE_TIER_IDS,
  TIER_COLORS,
} from "~/constants/LeaderboardData";
import {
  buildLeaderboardSeasonOptions,
  type LeaderboardSeasonOption,
} from "~/utils/leaderboard-seasons";

// Kiểu: thông tin một tier cạnh tranh (tên, icon các loại)
type CompetitiveTierInfo = {
  tier: number;
  tierName?: string;
  smallIcon?: string | null;
  largeIcon?: string | null;
  rankTriangleDownIcon?: string | null;
};

// Kiểu: một tập hợp các tier
type CompetitiveTierSet = {
  tiers?: CompetitiveTierInfo[];
};

/**
 * buildTierLookup – Xây dựng Map<number, CompetitiveTierInfo> để tra cứu nhanh
 * @param tierSets – Mảng các CompetitiveTierSet từ API
 * @returns Map ánh xạ số tier → thông tin chi tiết
 */
function buildTierLookup(tierSets: CompetitiveTierSet[] = []) {
  const lookup = new Map<number, CompetitiveTierInfo>();

  tierSets.forEach((tierSet) => {
    tierSet.tiers?.forEach((tier) => {
      if (typeof tier.tier === "number") {
        lookup.set(tier.tier, tier);
      }
    });
  });

  return lookup;
}

/**
 * getTierIcon – Lấy URL icon đầu tiên khả dụng cho một tier
 * @param tier – Đối tượng CompetitiveTierInfo (hoặc undefined)
 * @returns URL icon hoặc null
 */
function getTierIcon(tier?: CompetitiveTierInfo) {
  return tier?.smallIcon || tier?.largeIcon || tier?.rankTriangleDownIcon || null;
}

/**
 * LeaderboardScreen – Component hiển thị bảng xếp hạng người chơi theo mùa giải
 * Cho phép chọn mùa, tìm kiếm người chơi, xem thứ hạng và rank
 */
export default function LeaderboardScreen() {
  const { t } = useTranslation();
  // Thông tin user từ store
  const user = useUserStore((state) => state.user);

  // State: danh sách người chơi từ API
  const [players, setPlayers] = React.useState<LeaderboardResponse["Players"]>([]);
  // State: trạng thái đang tải
  const [loading, setLoading] = React.useState(true);
  // State: trạng thái kéo xuống để làm mới
  const [refreshing, setRefreshing] = React.useState(false);
  // State: từ khóa tìm kiếm
  const [searchQuery, setSearchQuery] = React.useState("");
  // State: tổng số người chơi trên leaderboard
  const [totalPlayers, setTotalPlayers] = React.useState(0);
  // State: danh sách mùa giải có sẵn
  const [seasons, setSeasons] = React.useState<LeaderboardSeasonOption[]>([]);
  // State: ID mùa giải đang được chọn
  const [selectedSeason, setSelectedSeason] = React.useState<string | null>(null);
  // State: Map tra cứu thông tin tier (khởi tạo từ assets có sẵn)
  const [tierLookup, setTierLookup] = React.useState(() =>
    buildTierLookup(getAssets().competitiveTiers as CompetitiveTierSet[])
  );
  const leaderboardRequestId = React.useRef(0);

  /**
   * fetchLeaderboard – Gọi API lấy dữ liệu bảng xếp hạng theo seasonId
   * @param seasonId – ID của mùa giải cần lấy
   */
  const fetchLeaderboard = React.useCallback(
    async (seasonId: string, options: { showLoading?: boolean } = {}) => {
      const { showLoading = true } = options;
      const requestId = ++leaderboardRequestId.current;
      if (!user.accessToken || !user.entitlementsToken || !user.region) {
        if (showLoading) setLoading(false);
        return;
      }
      if (showLoading) setLoading(true);
      try {
        const data = await getLeaderboard(
          user.accessToken,
          user.entitlementsToken,
          user.region,
          seasonId,
          { startIndex: 0, size: 100 }
        );
        if (requestId !== leaderboardRequestId.current) return;
        if (data) {
          setPlayers(data.Players ?? []);
          setTotalPlayers(data.totalPlayers ?? 0);
        } else {
          setPlayers([]);
          setTotalPlayers(0);
        }
      } catch (err) {
        if (requestId !== leaderboardRequestId.current) return;
        if (__DEV__) console.error("Failed to fetch leaderboard:", err);
        setPlayers([]);
        setTotalPlayers(0);
      } finally {
        if (showLoading && requestId === leaderboardRequestId.current) {
          setLoading(false);
        }
      }
    },
    [user]
  );

  // Effect: Lấy danh sách mùa giải (season) và tải leaderboard mặc định
  React.useEffect(() => {
    const init = async () => {
      if (!user.accessToken || !user.entitlementsToken || !user.region) return;
      try {
        const content = await getContent(
          user.accessToken,
          user.entitlementsToken,
          user.region
        );
        if (content) {
          // Hiển thị toàn bộ Act đã bắt đầu, mới nhất trước.
          const seasonList = buildLeaderboardSeasonOptions(content.Seasons);
          setSeasons(seasonList);
          if (seasonList.length > 0) {
            const defaultSeason =
              seasonList.find((season) => season.isActive) ?? seasonList[0];
            setSelectedSeason(defaultSeason.id);
            fetchLeaderboard(defaultSeason.id);
          } else {
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      } catch (err) {
        if (__DEV__) console.error("Failed to fetch content:", err);
        setLoading(false);
      }
    };
    init();
  }, [user, fetchLeaderboard]);

  // Effect: Nếu chưa có tierLookup, fetch competitive tiers từ API
  React.useEffect(() => {
    if (tierLookup.size > 0) return;

    let mounted = true;

    fetchCompetitiveTiers()
      .then((tiers) => {
        if (mounted) {
          setTierLookup(buildTierLookup(tiers as CompetitiveTierSet[]));
        }
      })
      .catch((err) => {
        if (__DEV__) console.error("Failed to fetch competitive tiers:", err);
      });

    return () => {
      mounted = false;
    };
  }, [tierLookup.size]);

  /**
   * filteredPlayers – Danh sách người chơi đã lọc theo từ khóa tìm kiếm
   * So khớp với gameName hoặc tagLine
   */
  const filteredPlayers = React.useMemo(() => {
    if (!searchQuery.trim()) return players;
    const q = searchQuery.toLowerCase();
    return players.filter(
      (p) =>
        (p.gameName ?? "").toLowerCase().includes(q) ||
        (p.tagLine ?? "").toLowerCase().includes(q)
    );
  }, [players, searchQuery]);

  /**
   * handleSeasonChange – Xử lý khi người dùng chọn mùa giải khác
   * @param seasonId – ID mùa giải mới
   */
  const handleSeasonChange = (seasonId: string) => {
    if (seasonId === selectedSeason) return;
    setSelectedSeason(seasonId);
    setSearchQuery("");
    fetchLeaderboard(seasonId);
  };

  const handleRefresh = React.useCallback(async () => {
    if (!selectedSeason || refreshing) return;

    setRefreshing(true);
    try {
      await fetchLeaderboard(selectedSeason, { showLoading: false });
    } finally {
      setRefreshing(false);
    }
  }, [fetchLeaderboard, refreshing, selectedSeason]);

  /**
   * renderPlayerRow – Render một hàng người chơi trong danh sách
   * Hiển thị: số thứ hạng, tên, tag, rank icon, RR, số trận thắng
   */
  const renderPlayerRow = ({
    item,
    index,
  }: {
    item: LeaderboardResponse["Players"][0];
    index: number;
  }) => {
    // Màu sắc và thông tin tier
    const tierColor = TIER_COLORS[item.competitiveTier] || COLORS.TEXT_SECONDARY;
    const tierInfo = tierLookup.get(item.competitiveTier);
    const tierIcon = getTierIcon(tierInfo);
    const tierName =
      tierInfo?.tierName ||
      COMPETITIVE_TIER_IDS[item.competitiveTier] ||
      `Tier ${item.competitiveTier}`;
    const playerName = item.gameName || "Secret Agent";
    const playerTag = item.tagLine ? `#${item.tagLine}` : "";

    return (
      <View style={styles.playerRow}>
        {/* Số thứ hạng */}
        <Text style={styles.rankText}>
          #{item.leaderboardRank}
        </Text>
        {/* Thông tin người chơi */}
        <View style={styles.playerInfo}>
          <Text style={styles.playerName} numberOfLines={1}>
            {playerName}{playerTag}
          </Text>
          {/* Hàng hiển thị rank */}
          <View style={styles.tierRow}>
            {tierIcon ? (
              <Image
                cacheId={`rank:${item.competitiveTier}:icon`}
                source={{ uri: tierIcon }}
                style={styles.tierIcon}
                contentFit="contain"
                cachePolicy="memory-disk"
                priority="low"
                recyclingKey={tierIcon}
              />
            ) : (
              <View style={[styles.tierDot, { backgroundColor: tierColor }]} />
            )}
            <Text style={[styles.tierText, { color: tierColor }]}>
              {tierName}
            </Text>
          </View>
        </View>
        {/* Thống kê bên phải: RR và số trận thắng */}
        <View style={styles.statsRight}>
          <Text style={styles.rrText}>{item.rankedRating}</Text>
          <Text style={styles.winsText}>
            {item.numberOfWins} {t("leaderboard_page.wins")}
          </Text>
        </View>
      </View>
    );
  };

  // Hiển thị loading khi chưa có dữ liệu
  if (loading && players.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator animating color={COLORS.ACCENT} size="large" />
        <Text style={styles.loadingText}>{t("leaderboard_page.loading")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Header: tiêu đề */}
      <View style={styles.headerContent}>
        <Text style={styles.title}>{t("leaderboard_page.title")}</Text>
      </View>

      {/* Dải chọn mùa giải (season chips) */}
      {seasons.length > 0 && (
        <View style={styles.seasonRow}>
          <Icon name="calendar-range" size={16} color={COLORS.TEXT_SECONDARY} />
          <ScrollView
            horizontal
            style={styles.seasonScroller}
            contentContainerStyle={styles.seasonScrollerContent}
            showsHorizontalScrollIndicator={false}
          >
            {seasons.map((s) => (
              <TouchableOpacity
                key={s.id}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedSeason === s.id }}
                style={[
                  styles.seasonChip,
                  selectedSeason === s.id && styles.seasonChipActive,
                ]}
                onPress={() => handleSeasonChange(s.id)}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.seasonChipText,
                    selectedSeason === s.id && styles.seasonChipTextActive,
                  ]}
                >
                  {s.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Thanh tìm kiếm người chơi */}
      <View style={styles.searchBar}>
        <Icon name="magnify" size={18} color={COLORS.TEXT_SECONDARY} />
        <TextInput
          style={styles.searchInput}
          placeholder={t("leaderboard_page.search_placeholder")}
          placeholderTextColor={COLORS.TEXT_SECONDARY}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Icon name="close-circle" size={18} color={COLORS.TEXT_SECONDARY} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Tổng số người chơi */}
      {totalPlayers > 0 && (
        <Text style={styles.totalText}>
          {totalPlayers} {t("leaderboard_page.player").toLowerCase()}s
        </Text>
      )}

      {/* Luôn giữ FlatList để pull-to-refresh hoạt động cả khi danh sách rỗng. */}
      <FlatList
        data={filteredPlayers}
        keyExtractor={(item, index) => item.puuid || `player-${index}`}
        renderItem={renderPlayerRow}
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          filteredPlayers.length === 0 && styles.listContentEmpty,
        ]}
        ListEmptyComponent={
          loading ? null : (
            <GlassCard style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>
                {t("leaderboard_page.no_results")}
              </Text>
            </GlassCard>
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.ACCENT]}
            tintColor={COLORS.ACCENT}
            progressBackgroundColor={COLORS.SURFACE}
          />
        }
        alwaysBounceVertical
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════
// StyleSheet – Định nghĩa tất cả styles cho màn hình Leaderboard
// ═══════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  // screen – Container chính full màn hình
  screen: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  // centered – Trung tâm màn hình khi loading
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.BACKGROUND,
  },
  // loadingText – Chữ loading bên dưới spinner
  loadingText: {
    marginTop: 12,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
  },
  // headerContent – Padding cho header
  headerContent: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 12,
  },
  // title – Tiêu đề màn hình
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
  },
  // subtitle – Phụ đề
  subtitle: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.TEXT_SECONDARY,
  },
  // seasonRow – Hàng chứa các chip chọn mùa
  seasonRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 20,
    paddingBottom: 12,
  },
  seasonScroller: {
    flex: 1,
  },
  seasonScrollerContent: {
    gap: 8,
    paddingLeft: 8,
    paddingRight: 20,
  },
  // seasonChip – Chip chọn mùa (mặc định)
  seasonChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.chip,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  // seasonChipActive – Chip mùa đang được chọn (màu accent)
  seasonChipActive: {
    backgroundColor: COLORS.ACCENT,
    borderColor: COLORS.ACCENT,
  },
  // seasonChipText – Text chip mặc định
  seasonChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.TEXT_SECONDARY,
  },
  // seasonChipTextActive – Text chip đang active
  seasonChipTextActive: {
    color: COLORS.PURE_BLACK,
  },
  // searchBar – Thanh tìm kiếm người chơi
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.chip,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  // searchInput – Input tìm kiếm
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.TEXT_PRIMARY,
    padding: 0,
  },
  // totalText – Text tổng số người chơi
  totalText: {
    paddingHorizontal: 20,
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 8,
  },
  // listContent – Content container cho FlatList
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  // playerRow – Một hàng người chơi
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  // rankText – Số thứ hạng (#1, #2, ...)
  rankText: {
    width: 44,
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.TEXT_PRIMARY,
  },
  // playerInfo – Vùng thông tin người chơi
  playerInfo: {
    flex: 1,
  },
  // playerName – Tên người chơi
  playerName: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
  },
  // tierRow – Hàng hiển thị rank (icon + tên tier)
  tierRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  // tierDot – Chấm tròn màu rank (khi không có icon)
  tierDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  // tierIcon – Icon rank
  tierIcon: {
    width: 20,
    height: 20,
  },
  // tierText – Tên rank
  tierText: {
    fontSize: 12,
    fontWeight: "600",
  },
  // statsRight – Vùng thống kê bên phải (RR + wins)
  statsRight: {
    alignItems: "flex-end",
  },
  // rrText – Số RR (ranked rating)
  rrText: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.TEXT_PRIMARY,
  },
  // winsText – Số trận thắng
  winsText: {
    fontSize: 11,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 1,
  },
  // emptyCard – Card empty state
  emptyCard: {
    marginTop: 8,
    padding: 24,
    alignItems: "center",
  },
  // emptyTitle – Tiêu đề empty state
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.TEXT_SECONDARY,
  },
});
