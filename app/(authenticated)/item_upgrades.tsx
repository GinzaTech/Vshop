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
import { useTranslation } from "react-i18next";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { Image } from "expo-image";

import { useUserStore } from "~/hooks/useUserStore";
import { getItemUpgrades } from "~/utils/valorant-api";
import { getAssets } from "~/utils/valorant-assets";
import CurrencyIcon from "~/components/CurrencyIcon";
import GlassCard from "~/components/ui/GlassCard";
import { COLORS, RADIUS } from "~/constants/DesignSystem";

const WEAPON_SKIN_TYPE_ID = "e7c63390-eda7-46e0-bb7a-a6abdacd2433";

type ItemUpgradeDefinition = ItemUpgradesResponse["Definitions"][number];
type SidegradeDefinition = NonNullable<ItemUpgradeDefinition["Sidegrades"]>[number];

type ItemMeta = {
  name: string;
  icon?: string | null;
  parentName?: string;
};

const shortId = (value?: string) => (value ? `${value.substring(0, 8)}...` : "--");

const sumWalletCost = (costs?: { AmountToDeduct: number }[]) =>
  costs?.reduce((total, cost) => total + (cost.AmountToDeduct || 0), 0) ?? 0;

export default function ItemUpgradesScreen() {
  const { t } = useTranslation();
  const user = useUserStore((state) => state.user);
  const assets = getAssets();

  const [upgrades, setUpgrades] = React.useState<ItemUpgradesResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [expandedDef, setExpandedDef] = React.useState<string | null>(null);
  const [selectedSidegrade, setSelectedSidegrade] = React.useState<Record<string, string | null>>({});
  const [query, setQuery] = React.useState("");

  const fetchData = React.useCallback(async () => {
    if (!user.accessToken || !user.entitlementsToken || !user.region) {
      setLoading(false);
      return;
    }
    try {
      const data = await getItemUpgrades(
        user.accessToken,
        user.entitlementsToken,
        user.region
      );
      setUpgrades(data);
    } catch (err) {
      console.error("Failed to fetch item upgrades:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const definitions = React.useMemo(
    () => upgrades?.Definitions ?? [],
    [upgrades?.Definitions]
  );

  const resolveItemMeta = React.useCallback(
    (itemTypeId: string, itemId: string): ItemMeta => {
      const skins = assets.skins ?? [];

      if (itemTypeId === WEAPON_SKIN_TYPE_ID) {
        const skin = skins.find((item: any) => item.uuid === itemId);
        if (skin) {
          return {
            name: skin.displayName || shortId(itemId),
            icon:
              skin.chromas?.[0]?.fullRender ||
              skin.chromas?.[0]?.displayIcon ||
              skin.displayIcon,
          };
        }
      }

      for (const skin of skins) {
        const level = skin.levels?.find((item: any) => item.uuid === itemId);
        if (level) {
          return {
            name: level.displayName || skin.displayName || shortId(itemId),
            icon: level.displayIcon || skin.displayIcon,
            parentName: skin.displayName,
          };
        }

        const chroma = skin.chromas?.find((item: any) => item.uuid === itemId);
        if (chroma) {
          return {
            name: chroma.displayName || skin.displayName || shortId(itemId),
            icon: chroma.fullRender || chroma.displayIcon || skin.displayIcon,
            parentName: skin.displayName,
          };
        }
      }

      return { name: shortId(itemId) };
    },
    [assets.skins]
  );

  const resolveDefinitionMeta = React.useCallback(
    (definition: ItemUpgradeDefinition): ItemMeta => {
      const candidates: { ItemTypeID: string; ItemID: string }[] = [
        definition.Item,
        definition.RequiredEntitlement,
        ...(definition.RewardSchedule?.RewardsPerLevel ?? []).flatMap(
          (reward) => reward.EntitlementRewards ?? []
        ),
        ...(definition.Sidegrades ?? []).flatMap((sidegrade) =>
          sidegrade.Options.flatMap((option) => option.Rewards ?? [])
        ),
      ];

      for (const candidate of candidates) {
        const meta = resolveItemMeta(candidate.ItemTypeID, candidate.ItemID);
        if (meta.icon) return meta;
      }

      return resolveItemMeta(definition.Item.ItemTypeID, definition.Item.ItemID);
    },
    [resolveItemMeta]
  );

  const filteredDefinitions = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return definitions;

    return definitions.filter((def) => {
      const item = resolveDefinitionMeta(def);
      return [item.name, item.parentName, def.ProgressionSchedule.Name]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedQuery));
    });
  }, [definitions, query, resolveDefinitionMeta]);

  const totalSidegrades = React.useMemo(
    () =>
      definitions.reduce(
        (total, def) =>
          total +
          (def.Sidegrades?.reduce(
            (innerTotal, sidegrade) => innerTotal + sidegrade.Options.length,
            0
          ) ?? 0),
        0
      ),
    [definitions]
  );

  const totalProgressionCost = React.useMemo(
    () =>
      definitions.reduce(
        (total, def) =>
          total +
          (def.ProgressionSchedule.ProgressionDeltaPerLevel?.reduce(
            (innerTotal, amount) => innerTotal + amount,
            0
          ) ?? 0),
        0
      ),
    [definitions]
  );

  const renderSidegradeOptions = (sidegrade: SidegradeDefinition) => {
    const defId = sidegrade.SidegradeID || "";
    const selected = selectedSidegrade[defId] ?? null;

    return (
      <View style={styles.sidegradeSection}>
        <View style={styles.sectionTitleRow}>
          <Icon name="palette-swatch-outline" size={16} color={COLORS.VALORANT_RED} />
          <Text style={styles.sidegradeTitle}>
            {t("item_upgrades_page.sidegrade_title")}
          </Text>
        </View>
        {sidegrade.Options.map((opt: any) => {
          const isSelected = selected === opt.OptionID;
          const reward = opt.Rewards?.[0];
          const rewardMeta = reward
            ? resolveItemMeta(reward.ItemTypeID, reward.ItemID)
            : { name: shortId(opt.OptionID) };
          const cost = sumWalletCost(opt.Cost?.WalletCosts);
          return (
            <TouchableOpacity
              key={opt.OptionID}
              style={[styles.optionRow, isSelected && styles.optionRowSelected]}
              onPress={() =>
                setSelectedSidegrade((prev) => ({
                  ...prev,
                  [defId]: isSelected ? null : opt.OptionID,
                }))
              }
            >
              {rewardMeta.icon ? (
                <Image
                  source={{ uri: rewardMeta.icon }}
                  style={styles.optionImage}
                  contentFit="contain"
                />
              ) : (
                <View style={styles.optionImageFallback}>
                  <Icon name="palette-outline" size={16} color={COLORS.TEXT_SECONDARY} />
                </View>
              )}
              <View style={styles.optionInfo}>
                <Text style={styles.optionName} numberOfLines={1}>
                  {rewardMeta.name}
                </Text>
                <View style={styles.costRow}>
                  <CurrencyIcon icon="rad" style={styles.currencyIcon} />
                  <Text style={styles.optionCost}>
                    {cost || "--"} {t("item_upgrades_page.currency_rad")}
                  </Text>
                </View>
              </View>
              <Icon
                name={isSelected ? "radiobox-marked" : "radiobox-blank"}
                size={20}
                color={isSelected ? COLORS.VALORANT_RED : COLORS.TEXT_SECONDARY}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderUpgradeDefinition = ({ item: def }: { item: ItemUpgradeDefinition }) => {
    const itemMeta = resolveDefinitionMeta(def);
    const isExpanded = expandedDef === def.ID;
    const levels = def.ProgressionSchedule.ProgressionDeltaPerLevel ?? [];
    const rewardLevels = def.RewardSchedule?.RewardsPerLevel ?? [];
    const sidegradeCount =
      def.Sidegrades?.reduce((total, sidegrade) => total + sidegrade.Options.length, 0) ??
      0;
    const progressionCost = levels.reduce((total, amount) => total + amount, 0);

    return (
      <GlassCard style={styles.defCard}>
        <View style={styles.skinImageBand}>
          {itemMeta.icon ? (
            <Image
              source={{ uri: itemMeta.icon }}
              style={styles.skinBandImage}
              contentFit="contain"
            />
          ) : (
            <Icon name="pistol" size={34} color={COLORS.TEXT_SECONDARY} />
          )}
        </View>
        <TouchableOpacity
          activeOpacity={0.86}
          style={styles.defHeader}
          onPress={() => setExpandedDef(isExpanded ? null : def.ID)}
        >
          <View style={styles.thumbnailFrame}>
            {itemMeta.icon ? (
              <Image
                source={{ uri: itemMeta.icon }}
                style={styles.thumbnail}
                contentFit="contain"
              />
            ) : (
              <Icon name="pistol" size={30} color={COLORS.TEXT_SECONDARY} />
            )}
          </View>

          <View style={styles.defInfo}>
            <Text style={styles.defName} numberOfLines={1}>
              {itemMeta.name}
            </Text>
            <Text style={styles.defDesc} numberOfLines={1}>
              {def.ProgressionSchedule.Name}
            </Text>
            <View style={styles.cardMetaRow}>
              <View style={styles.metaChip}>
                <Icon name="arrow-up-bold-hexagon-outline" size={13} color={COLORS.TEXT_PRIMARY} />
                <Text style={styles.metaChipText}>{levels.length} levels</Text>
              </View>
              <View style={styles.metaChip}>
                <Icon name="palette-outline" size={13} color={COLORS.TEXT_PRIMARY} />
                <Text style={styles.metaChipText}>{sidegradeCount} variants</Text>
              </View>
            </View>
          </View>

          <View style={styles.headerRight}>
            <View style={styles.cardCostPill}>
              <CurrencyIcon icon="rad" style={styles.currencyIcon} />
              <Text style={styles.cardCostText}>{progressionCost || "--"}</Text>
            </View>
            <Icon
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={20}
              color={COLORS.TEXT_SECONDARY}
            />
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.defBody}>
            {levels.length > 0 ? (
              <View style={styles.progressionPanel}>
                <View style={styles.sectionTitleRow}>
                  <Icon name="timeline-check-outline" size={16} color={COLORS.VALORANT_RED} />
                  <Text style={styles.progressionTitle}>
                    {t("item_upgrades_page.upgrade_title")}
                  </Text>
                </View>
                <View style={styles.levelsRow}>
                  {levels.map((amount, index) => (
                    <View key={`${def.ID}-${index}`} style={styles.levelStep}>
                      <View style={styles.levelDot}>
                        <Text style={styles.levelDotText}>{index + 1}</Text>
                      </View>
                      <View style={styles.levelCost}>
                        <CurrencyIcon icon="rad" style={styles.levelCurrencyIcon} />
                        <Text style={styles.levelCostText}>{amount}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {rewardLevels.map((reward, index) => (
              <View key={`${def.ID}-reward-${index}`} style={styles.rewardRow}>
                <View style={styles.rewardLevelBadge}>
                  <Text style={styles.rewardLevelText}>{index + 1}</Text>
                </View>
                <View style={styles.rewardInfo}>
                  <Text style={styles.rewardLabel}>
                    {t("item_upgrades_page.upgrade_title")} {index + 1}
                  </Text>
                  {reward.EntitlementRewards?.map((er, rewardIndex) => {
                    const rewardMeta = resolveItemMeta(er.ItemTypeID, er.ItemID);
                    return (
                      <Text
                        key={`${er.ItemID}-${rewardIndex}`}
                        style={styles.rewardItem}
                        numberOfLines={1}
                      >
                        {rewardMeta.name}
                      </Text>
                    );
                  })}
                </View>
              </View>
            ))}

            {def.Sidegrades?.map((sidegrade) => (
              <View key={sidegrade.SidegradeID}>{renderSidegradeOptions(sidegrade)}</View>
            ))}
          </View>
        )}
      </GlassCard>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator animating color={COLORS.ACCENT} size="large" />
        <Text style={styles.loadingText}>{t("item_upgrades_page.loading")}</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      data={filteredDefinitions}
      keyExtractor={(item) => item.ID}
      renderItem={renderUpgradeDefinition}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <>
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Icon name="lightning-bolt" size={24} color={COLORS.PURE_WHITE} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.title}>{t("item_upgrades_page.title")}</Text>
              <Text style={styles.subtitle}>{t("item_upgrades_page.subtitle")}</Text>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{definitions.length}</Text>
              <Text style={styles.statLabel}>Skins</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{totalSidegrades}</Text>
              <Text style={styles.statLabel}>Variants</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statValueRow}>
                <CurrencyIcon icon="rad" style={styles.statCurrencyIcon} />
                <Text style={styles.statValue}>{totalProgressionCost}</Text>
              </View>
              <Text style={styles.statLabel}>{t("item_upgrades_page.currency_rad")}</Text>
            </View>
          </View>

          <View style={styles.searchBox}>
            <Icon name="magnify" size={20} color={COLORS.TEXT_SECONDARY} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search upgrades"
              placeholderTextColor={COLORS.TEXT_SECONDARY}
              autoCorrect={false}
              style={styles.searchInput}
            />
            {query ? (
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => setQuery("")}
                style={styles.clearSearchButton}
              >
                <Icon name="close" size={16} color={COLORS.TEXT_SECONDARY} />
              </TouchableOpacity>
            ) : null}
          </View>
        </>
      }
      ListEmptyComponent={
        <GlassCard style={styles.emptyCard}>
          <Icon name="lightning-bolt-outline" size={30} color={COLORS.TEXT_SECONDARY} />
          <Text style={styles.emptyTitle}>
            {definitions.length === 0
              ? t("item_upgrades_page.empty_title")
              : "No matching upgrades"}
          </Text>
          <Text style={styles.emptySubtitle}>
            {definitions.length === 0
              ? t("item_upgrades_page.empty_subtitle")
              : "Try a different skin name."}
          </Text>
        </GlassCard>
      }
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
    gap: 12,
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
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 6,
    marginBottom: 4,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.VALORANT_RED,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.TEXT_PRIMARY,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.TEXT_SECONDARY,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    minHeight: 72,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    backgroundColor: COLORS.SURFACE,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: "center",
  },
  statValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statValue: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: "900",
  },
  statLabel: {
    marginTop: 3,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: "700",
  },
  statCurrencyIcon: {
    width: 14,
    height: 14,
  },
  searchBox: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    backgroundColor: COLORS.SURFACE,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: "700",
    paddingVertical: 0,
  },
  clearSearchButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.SURFACE_MUTED,
  },
  defCard: {
    padding: 0,
    overflow: "hidden",
  },
  skinImageBand: {
    height: 118,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.SURFACE_MUTED,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
    paddingHorizontal: 18,
  },
  skinBandImage: {
    width: "100%",
    height: "100%",
  },
  defHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 112,
    padding: 14,
  },
  thumbnailFrame: {
    width: 88,
    height: 76,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    backgroundColor: COLORS.SURFACE_MUTED,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumbnail: {
    width: "96%",
    height: "96%",
  },
  defInfo: {
    flex: 1,
    minWidth: 0,
  },
  defName: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.TEXT_PRIMARY,
  },
  defDesc: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.TEXT_SECONDARY,
  },
  cardMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  metaChip: {
    minHeight: 26,
    borderRadius: RADIUS.chip,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.SURFACE_MUTED,
  },
  metaChipText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 11,
    fontWeight: "800",
  },
  headerRight: {
    alignItems: "flex-end",
    gap: 10,
  },
  cardCostPill: {
    minHeight: 30,
    borderRadius: RADIUS.chip,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.VALORANT_BLACK,
  },
  cardCostText: {
    color: COLORS.PURE_WHITE,
    fontSize: 12,
    fontWeight: "900",
  },
  currencyIcon: {
    width: 14,
    height: 14,
  },
  defBody: {
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
    padding: 14,
    gap: 12,
    backgroundColor: COLORS.SURFACE,
  },
  progressionPanel: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    backgroundColor: COLORS.SURFACE_MUTED,
    padding: 12,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 10,
  },
  progressionTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: "900",
  },
  levelsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  levelStep: {
    minWidth: 58,
    alignItems: "center",
    gap: 5,
  },
  levelDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  levelDotText: {
    fontSize: 12,
    fontWeight: "900",
    color: COLORS.TEXT_PRIMARY,
  },
  levelCost: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  levelCurrencyIcon: {
    width: 11,
    height: 11,
  },
  levelCostText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: "800",
  },
  rewardRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    padding: 10,
    backgroundColor: COLORS.SURFACE,
  },
  rewardLevelBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.VALORANT_RED,
  },
  rewardLevelText: {
    color: COLORS.PURE_WHITE,
    fontSize: 12,
    fontWeight: "900",
  },
  rewardInfo: {
    flex: 1,
    minWidth: 0,
  },
  rewardLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 4,
  },
  rewardItem: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
  },
  sidegradeSection: {
    gap: 8,
  },
  sidegradeTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: COLORS.TEXT_PRIMARY,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 58,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    backgroundColor: COLORS.SURFACE_MUTED,
  },
  optionRowSelected: {
    backgroundColor: COLORS.WARNING_SURFACE,
    borderColor: COLORS.WARNING_BORDER,
  },
  optionImage: {
    width: 42,
    height: 42,
  },
  optionImageFallback: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.SURFACE,
  },
  optionInfo: {
    flex: 1,
    minWidth: 0,
  },
  optionName: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.TEXT_PRIMARY,
  },
  costRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 3,
  },
  optionCost: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.TEXT_SECONDARY,
  },
  emptyCard: {
    padding: 28,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.TEXT_PRIMARY,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    textAlign: "center",
    lineHeight: 20,
  },
});
