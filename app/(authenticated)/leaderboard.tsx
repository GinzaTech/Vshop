import React from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { ActivityIndicator } from "react-native-paper";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";

import { useUserStore } from "~/hooks/useUserStore";
import { getLeaderboard, getContent } from "~/utils/valorant-api";
import { fetchCompetitiveTiers, getAssets } from "~/utils/valorant-assets";
import GlassCard from "~/components/ui/GlassCard";
import { COLORS, RADIUS } from "~/constants/DesignSystem";

type CompetitiveTierInfo = {
  tier: number;
  tierName?: string;
  smallIcon?: string | null;
  largeIcon?: string | null;
  rankTriangleDownIcon?: string | null;
};

type CompetitiveTierSet = {
  tiers?: CompetitiveTierInfo[];
};

const COMPETITIVE_TIER_IDS: Record<number, string> = {
  0: "Unused",
  1: "Unused1",
  2: "Unused2",
  3: "Iron 1",
  4: "Iron 2",
  5: "Iron 3",
  6: "Bronze 1",
  7: "Bronze 2",
  8: "Bronze 3",
  9: "Silver 1",
  10: "Silver 2",
  11: "Silver 3",
  12: "Gold 1",
  13: "Gold 2",
  14: "Gold 3",
  15: "Platinum 1",
  16: "Platinum 2",
  17: "Platinum 3",
  18: "Diamond 1",
  19: "Diamond 2",
  20: "Diamond 3",
  21: "Ascendant 1",
  22: "Ascendant 2",
  23: "Ascendant 3",
  24: "Immortal 1",
  25: "Immortal 2",
  26: "Immortal 3",
  27: "Radiant",
};

const TIER_COLORS: Record<number, string> = {
  3: "#7a7a7a",
  4: "#7a7a7a",
  5: "#7a7a7a",
  6: "#a0692b",
  7: "#a0692b",
  8: "#a0692b",
  9: "#c0c0c0",
  10: "#c0c0c0",
  11: "#c0c0c0",
  12: "#ffd700",
  13: "#ffd700",
  14: "#ffd700",
  15: "#00bfff",
  16: "#00bfff",
  17: "#00bfff",
  18: "#ff00ff",
  19: "#ff00ff",
  20: "#ff00ff",
  21: "#ff4444",
  22: "#ff4444",
  23: "#ff4444",
  24: "#9b59b6",
  25: "#9b59b6",
  26: "#9b59b6",
  27: "#f39c12",
};

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

function getTierIcon(tier?: CompetitiveTierInfo) {
  return tier?.smallIcon || tier?.largeIcon || tier?.rankTriangleDownIcon || null;
}

export default function LeaderboardScreen() {
  const { t } = useTranslation();
  const user = useUserStore((state) => state.user);

  const [players, setPlayers] = React.useState<LeaderboardResponse["Players"]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [totalPlayers, setTotalPlayers] = React.useState(0);
  const [seasons, setSeasons] = React.useState<{ id: string; name: string }[]>([]);
  const [selectedSeason, setSelectedSeason] = React.useState<string | null>(null);
  const [tierLookup, setTierLookup] = React.useState(() =>
    buildTierLookup(getAssets().competitiveTiers as CompetitiveTierSet[])
  );

  const fetchLeaderboard = React.useCallback(
    async (seasonId: string) => {
      if (!user.accessToken || !user.entitlementsToken || !user.region) return;
      setLoading(true);
      try {
        const data = await getLeaderboard(
          user.accessToken,
          user.entitlementsToken,
          user.region,
          seasonId,
          { startIndex: 0, size: 100 }
        );
        if (data) {
          setPlayers(data.Players ?? []);
          setTotalPlayers(data.totalPlayers ?? 0);
        } else {
          setPlayers([]);
          setTotalPlayers(0);
        }
      } catch (err) {
        console.error("Failed to fetch leaderboard:", err);
        setPlayers([]);
        setTotalPlayers(0);
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

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
          const acts = content.Seasons.filter((s) => s.Type === "act" && s.IsActive);
          const seasonList = acts.map((a) => ({ id: a.ID, name: a.Name }));
          setSeasons(seasonList);
          if (seasonList.length > 0) {
            setSelectedSeason(seasonList[0].id);
            fetchLeaderboard(seasonList[0].id);
          } else {
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to fetch content:", err);
        setLoading(false);
      }
    };
    init();
  }, [user, fetchLeaderboard]);

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
        console.error("Failed to fetch competitive tiers:", err);
      });

    return () => {
      mounted = false;
    };
  }, [tierLookup.size]);

  const filteredPlayers = React.useMemo(() => {
    if (!searchQuery.trim()) return players;
    const q = searchQuery.toLowerCase();
    return players.filter(
      (p) =>
        (p.gameName ?? "").toLowerCase().includes(q) ||
        (p.tagLine ?? "").toLowerCase().includes(q)
    );
  }, [players, searchQuery]);

  const handleSeasonChange = (seasonId: string) => {
    setSelectedSeason(seasonId);
    fetchLeaderboard(seasonId);
  };

  const renderPlayerRow = ({
    item,
    index,
  }: {
    item: LeaderboardResponse["Players"][0];
    index: number;
  }) => {
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
        <Text style={styles.rankText}>
          #{item.leaderboardRank}
        </Text>
        <View style={styles.playerInfo}>
          <Text style={styles.playerName} numberOfLines={1}>
            {playerName}{playerTag}
          </Text>
          <View style={styles.tierRow}>
            {tierIcon ? (
              <Image
                source={{ uri: tierIcon }}
                style={styles.tierIcon}
                contentFit="contain"
              />
            ) : (
              <View style={[styles.tierDot, { backgroundColor: tierColor }]} />
            )}
            <Text style={[styles.tierText, { color: tierColor }]}>
              {tierName}
            </Text>
          </View>
        </View>
        <View style={styles.statsRight}>
          <Text style={styles.rrText}>{item.rankedRating}</Text>
          <Text style={styles.winsText}>
            {item.numberOfWins} {t("leaderboard_page.wins")}
          </Text>
        </View>
      </View>
    );
  };

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
      <View style={styles.headerContent}>
        <Text style={styles.title}>{t("leaderboard_page.title")}</Text>
        <Text style={styles.subtitle}>{t("leaderboard_page.subtitle")}</Text>
      </View>

      {seasons.length > 0 && (
        <View style={styles.seasonRow}>
          <Icon name="calendar-range" size={16} color={COLORS.TEXT_SECONDARY} />
          {seasons.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[
                styles.seasonChip,
                selectedSeason === s.id && styles.seasonChipActive,
              ]}
              onPress={() => handleSeasonChange(s.id)}
            >
              <Text
                style={[
                  styles.seasonChipText,
                  selectedSeason === s.id && styles.seasonChipTextActive,
                ]}
              >
                {s.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

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

      {totalPlayers > 0 && (
        <Text style={styles.totalText}>
          {totalPlayers} {t("leaderboard_page.player").toLowerCase()}s
        </Text>
      )}

      {filteredPlayers.length === 0 && !loading ? (
        <GlassCard style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>
            {t("leaderboard_page.no_results")}
          </Text>
        </GlassCard>
      ) : (
        <FlatList
          data={filteredPlayers}
          keyExtractor={(item) => item.puuid}
          renderItem={renderPlayerRow}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onRefresh={() => selectedSeason && fetchLeaderboard(selectedSeason)}
          refreshing={loading}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.BACKGROUND,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
  },
  headerContent: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.TEXT_SECONDARY,
  },
  seasonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  seasonChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.chip,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  seasonChipActive: {
    backgroundColor: COLORS.ACCENT,
    borderColor: COLORS.ACCENT,
  },
  seasonChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.TEXT_SECONDARY,
  },
  seasonChipTextActive: {
    color: COLORS.PURE_BLACK,
  },
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
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.TEXT_PRIMARY,
    padding: 0,
  },
  totalText: {
    paddingHorizontal: 20,
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 8,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 140,
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  rankText: {
    width: 44,
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.TEXT_PRIMARY,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
  },
  tierRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  tierDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tierIcon: {
    width: 20,
    height: 20,
  },
  tierText: {
    fontSize: 12,
    fontWeight: "600",
  },
  statsRight: {
    alignItems: "flex-end",
  },
  rrText: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.TEXT_PRIMARY,
  },
  winsText: {
    fontSize: 11,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 1,
  },
  emptyCard: {
    marginHorizontal: 20,
    padding: 24,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.TEXT_SECONDARY,
  },
});
