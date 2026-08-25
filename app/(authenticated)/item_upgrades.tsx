// 📦 item_upgrades.tsx – Màn hình nâng cấp trang bị (vũ khí skin) của người dùng
// Cho phép xem danh sách skin đang sở hữu, các cấp độ nâng cấp (progression) và biến thể (sidegrade)

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
import { CachedImage as Image } from "~/components/CachedImage";

import { useUserStore } from "~/hooks/useUserStore";
import { getItemUpgrades } from "~/utils/valorant-api";
import { getAssetLookups } from "~/utils/valorant-assets";
import CurrencyIcon from "~/components/CurrencyIcon";
import GlassCard from "~/components/ui/GlassCard";
import { COLORS, RADIUS } from "~/constants/DesignSystem";
import AppRefreshControl from "~/components/ui/AppRefreshControl";
import { useAsyncRefresh } from "~/hooks/useAsyncRefresh";

// Hằng số ID loại skin vũ khí (weapon skin type)
const WEAPON_SKIN_TYPE_ID = "e7c63390-eda7-46e0-bb7a-a6abdacd2433";

// Kiểu: một định nghĩa nâng cấp item từ API
type ItemUpgradeDefinition = ItemUpgradesResponse["Definitions"][number];
// Kiểu: một định nghĩa sidegrade (biến thể) từ API
type SidegradeDefinition = NonNullable<ItemUpgradeDefinition["Sidegrades"]>[number];

// Kiểu mô tả metadata của một item (tên, icon, tên cha)
type ItemMeta = {
  name: string;
  icon?: string | null;
  parentName?: string;
};

/**
 * shortId – Rút gọn UUID thành 8 ký tự đầu + "...", dùng để hiển thị fallback
 * @param value – Chuỗi UUID cần rút gọn
 * @returns Chuỗi đã rút gọn hoặc "--" nếu không có giá trị
 */
const shortId = (value?: string) => (value ? `${value.substring(0, 8)}...` : "--");

/**
 * sumWalletCost – Tính tổng chi phí (VP/Radianite) từ mảng wallet costs
 * @param costs – Mảng các đối tượng chứa AmountToDeduct
 * @returns Tổng số tiền cần khấu trừ
 */
const sumWalletCost = (costs?: { AmountToDeduct: number }[]) =>
  costs?.reduce((total, cost) => total + (cost.AmountToDeduct || 0), 0) ?? 0;

/**
 * ItemUpgradesScreen – Component chính hiển thị danh sách nâng cấp trang bị
 * Gồm: header thống kê, thanh tìm kiếm, danh sách skin có thể nâng cấp (dạng FlatList)
 */
export default function ItemUpgradesScreen() {
  const { t } = useTranslation();
  // Lấy thông tin user từ store (token, region, ...)
  const user = useUserStore((state) => state.user);

  // State: dữ liệu nâng cấp từ API (ItemUpgradesResponse)
  const [upgrades, setUpgrades] = React.useState<ItemUpgradesResponse | null>(null);
  // State: trạng thái đang tải dữ liệu
  const [loading, setLoading] = React.useState(true);
  // State: ID của định nghĩa đang được mở rộng (xem chi tiết), null = không mở
  const [expandedDef, setExpandedDef] = React.useState<string | null>(null);
  // State: lưu lựa chọn sidegrade cho từng sidegrade ID (key = sidegradeId, value = optionId)
  const [selectedSidegrade, setSelectedSidegrade] = React.useState<Record<string, string | null>>({});
  // State: từ khóa tìm kiếm
  const [query, setQuery] = React.useState("");

  /**
   * fetchData – Gọi API lấy danh sách nâng cấp item
   * Được gọi khi component mount, phụ thuộc vào thông tin user
   */
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
      if (__DEV__) console.error("Failed to fetch item upgrades:", err);
    } finally {
      setLoading(false);
    }
  }, [user.accessToken, user.entitlementsToken, user.region]);

  // Effect: gọi fetchData khi component mount
  React.useEffect(() => {
    fetchData();
  }, [fetchData]);
  const { refreshing, onRefresh } = useAsyncRefresh(fetchData);

  // useMemo: Trích xuất danh sách Definitions từ response, memoized theo upgrades.Definitions
  const definitions = React.useMemo(
    () => upgrades?.Definitions ?? [],
    [upgrades?.Definitions]
  );

  /**
   * resolveItemMeta – Tra cứu metadata (tên, icon) của một item dựa trên loại và ID
   * Xử lý 3 trường hợp: skin gốc, level của skin, chroma (màu) của skin
   * @param itemTypeId – UUID loại item (ví dụ: weapon skin type)
   * @param itemId – UUID của item cần tra
   * @returns ItemMeta chứa name, icon, parentName (nếu có)
   */
  const resolveItemMeta = React.useCallback(
    (itemTypeId: string, itemId: string): ItemMeta => {
      const skin = getAssetLookups().skinByAnyId.get(itemId);

      // Trường hợp 1: item là skin vũ khí gốc
      if (itemTypeId === WEAPON_SKIN_TYPE_ID && skin?.uuid === itemId) {
        return {
          name: skin.displayName || shortId(itemId),
          icon:
            skin.chromas?.[0]?.displayIcon ||
            skin.displayIcon ||
            skin.chromas?.[0]?.fullRender,
        };
      }

      if (skin) {
        // Trường hợp 2: item là một level (cấp độ) của skin
        const level = skin.levels?.find((item: any) => item.uuid === itemId);
        if (level) {
          return {
            name: level.displayName || skin.displayName || shortId(itemId),
            icon: level.displayIcon || skin.displayIcon,
            parentName: skin.displayName,
          };
        }

        // Trường hợp 3: item là một chroma (biến thể màu) của skin
        const chroma = skin.chromas?.find((item: any) => item.uuid === itemId);
        if (chroma) {
          return {
            name: chroma.displayName || skin.displayName || shortId(itemId),
            icon: chroma.displayIcon || skin.displayIcon || chroma.fullRender,
            parentName: skin.displayName,
          };
        }
      }

      // Fallback: không tìm thấy, hiển thị ID rút gọn
      return { name: shortId(itemId) };
    },
    []
  );

  /**
   * resolveDefinitionMeta – Tìm metadata (icon/tên) cho một định nghĩa nâng cấp
   * Duyệt qua danh sách ứng viên (item chính, reward, sidegrade) để tìm icon đầu tiên
   * @param definition – Đối tượng ItemUpgradeDefinition cần tra metadata
   * @returns ItemMeta tìm được
   */
  const resolveDefinitionMeta = React.useCallback(
    (definition: ItemUpgradeDefinition): ItemMeta => {
      // Danh sách các ứng viên có thể chứa icon
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

      // Tìm ứng viên đầu tiên có icon
      for (const candidate of candidates) {
        const meta = resolveItemMeta(candidate.ItemTypeID, candidate.ItemID);
        if (meta.icon) return meta;
      }

      // Fallback: dùng item chính
      return resolveItemMeta(definition.Item.ItemTypeID, definition.Item.ItemID);
    },
    [resolveItemMeta]
  );

  /**
   * filteredDefinitions – Danh sách definitions đã lọc theo từ khóa tìm kiếm
   * So khớp với: tên item, tên cha, tên progression schedule
   */
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

  /**
   * totalSidegrades – Tổng số lượng tùy chọn sidegrade (biến thể) trên tất cả definitions
   */
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

  /**
   * totalProgressionCost – Tổng chi phí progression (Radianite) trên tất cả definitions
   */
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

  /**
   * renderSidegradeOptions – Render danh sách các tùy chọn biến thể (sidegrade)
   * Mỗi option hiển thị: icon, tên, chi phí Radianite, radio button chọn
   * @param sidegrade – Đối tượng SidegradeDefinition chứa các options
   */
  const renderSidegradeOptions = (sidegrade: SidegradeDefinition) => {
    const defId = sidegrade.SidegradeID || "";
    const selected = selectedSidegrade[defId] ?? null;

    return (
      <View style={styles.sidegradeSection}>
        {/* Tiêu đề section "Biến thể" */}
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
              // Bật/tắt chọn option này
              onPress={() =>
                setSelectedSidegrade((prev) => ({
                  ...prev,
                  [defId]: isSelected ? null : opt.OptionID,
                }))
              }
            >
              {/* Icon của option */}
              {rewardMeta.icon ? (
                <Image
                  cacheId={`item-upgrade:${reward?.ItemID || opt.OptionID}:icon`}
                  source={{ uri: rewardMeta.icon }}
                  style={styles.optionImage}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                  priority="low"
                  recyclingKey={rewardMeta.icon}
                />
              ) : (
                <View style={styles.optionImageFallback}>
                  <Icon name="palette-outline" size={16} color={COLORS.TEXT_SECONDARY} />
                </View>
              )}
              {/* Thông tin: tên + chi phí */}
              <View style={styles.optionInfo}>
                <Text style={styles.optionName} numberOfLines={1}>
                  {rewardMeta.name}
                </Text>
                <View style={styles.costRow}>
                  <CurrencyIcon
                    icon="rad"
                    style={[styles.currencyIcon, styles.darkCurrencyIcon]}
                  />
                  <Text style={styles.optionCost}>
                    {cost || "--"} {t("item_upgrades_page.currency_rad")}
                  </Text>
                </View>
              </View>
              {/* Radio button */}
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

  /**
   * renderUpgradeDefinition – Render một card định nghĩa nâng cấp skin
   * Hiển thị: ảnh skin, tên, số cấp, số biến thể, chi phí, và phần mở rộng chi tiết
   * @param def – Đối tượng ItemUpgradeDefinition cần render
   */
  const renderUpgradeDefinition = ({ item: def }: { item: ItemUpgradeDefinition }) => {
    const itemMeta = resolveDefinitionMeta(def);
    // Card có đang mở rộng không?
    const isExpanded = expandedDef === def.ID;
    // Mảng chi phí từng cấp progression
    const levels = def.ProgressionSchedule.ProgressionDeltaPerLevel ?? [];
    // Mảng các reward theo cấp
    const rewardLevels = def.RewardSchedule?.RewardsPerLevel ?? [];
    // Tổng số biến thể
    const sidegradeCount =
      def.Sidegrades?.reduce((total, sidegrade) => total + sidegrade.Options.length, 0) ??
      0;
    // Tổng chi phí progression
    const progressionCost = levels.reduce((total, amount) => total + amount, 0);

    return (
      <GlassCard style={styles.defCard}>
        {/* Dải ảnh skin lớn phía trên card */}
        <View style={styles.skinImageBand}>
          {itemMeta.icon ? (
            <Image
              cacheId={`item-upgrade:${def.ID}:icon`}
              source={{ uri: itemMeta.icon }}
              style={styles.skinBandImage}
              contentFit="contain"
              cachePolicy="memory-disk"
              priority="low"
              recyclingKey={itemMeta.icon}
            />
          ) : (
            <Icon name="pistol" size={34} color={COLORS.TEXT_SECONDARY} />
          )}
        </View>
        {/* Header card – bấm để mở rộng/thu gọn */}
        <TouchableOpacity
          activeOpacity={0.86}
          style={styles.defHeader}
          onPress={() => setExpandedDef(isExpanded ? null : def.ID)}
        >
          {/* Khung thumbnail nhỏ */}
          <View style={styles.thumbnailFrame}>
            {itemMeta.icon ? (
              <Image
                cacheId={`item-upgrade:${def.ID}:icon`}
                source={{ uri: itemMeta.icon }}
                style={styles.thumbnail}
                contentFit="contain"
                cachePolicy="memory-disk"
                priority="low"
                recyclingKey={itemMeta.icon}
              />
            ) : (
              <Icon name="pistol" size={30} color={COLORS.TEXT_SECONDARY} />
            )}
          </View>

          {/* Thông tin chính: tên, tên progression, chip số cấp/số biến thể */}
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

          {/* Bên phải: chi phí + icon mở rộng */}
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

        {/* Phần thân mở rộng: progression levels + rewards + sidegrades */}
        {isExpanded && (
          <View style={styles.defBody}>
            {/* Progression levels: các cấp nâng cấp và chi phí tương ứng */}
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
                      {/* Số thứ tự cấp */}
                      <View style={styles.levelDot}>
                        <Text style={styles.levelDotText}>{index + 1}</Text>
                      </View>
                      {/* Chi phí cấp đó */}
                      <View style={styles.levelCost}>
                        <CurrencyIcon
                          icon="rad"
                          style={[
                            styles.levelCurrencyIcon,
                            styles.darkCurrencyIcon,
                          ]}
                        />
                        <Text style={styles.levelCostText}>{amount}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Reward levels: các phần thưởng theo từng cấp */}
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

            {/* Sidegrade options: các tùy chọn biến thể */}
            {def.Sidegrades?.map((sidegrade) => (
              <View key={sidegrade.SidegradeID}>{renderSidegradeOptions(sidegrade)}</View>
            ))}
          </View>
        )}
      </GlassCard>
    );
  };

  // Hiển thị loading khi đang tải dữ liệu
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator animating color={COLORS.ACCENT} size="large" />
        <Text style={styles.loadingText}>{t("item_upgrades_page.loading")}</Text>
      </View>
    );
  }

  return (
    // FlatList chính: danh sách nâng cấp dạng cuộn dọc
    <FlatList
      style={styles.screen}
      data={filteredDefinitions}
      keyExtractor={(item) => item.ID}
      renderItem={renderUpgradeDefinition}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
      refreshControl={
        <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      alwaysBounceVertical
      ListHeaderComponent={
        <>
          {/* Hero section: icon + tiêu đề */}
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Icon name="lightning-bolt" size={24} color={COLORS.PURE_WHITE} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.title}>{t("item_upgrades_page.title")}</Text>
              <Text style={styles.subtitle}>{t("item_upgrades_page.subtitle")}</Text>
            </View>
          </View>

          {/* Stats grid: tổng số skin, biến thể, chi phí Radianite */}
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
                <CurrencyIcon
                  icon="rad"
                  style={[styles.statCurrencyIcon, styles.darkCurrencyIcon]}
                />
                <Text style={styles.statValue}>{totalProgressionCost}</Text>
              </View>
              <Text style={styles.statLabel}>{t("item_upgrades_page.currency_rad")}</Text>
            </View>
          </View>

          {/* Thanh tìm kiếm */}
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
        // Empty state: hiển thị khi không có dữ liệu hoặc không có kết quả tìm kiếm
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

// ═══════════════════════════════════════════════════════════════════
// StyleSheet – Định nghĩa tất cả styles cho màn hình Item Upgrades
// ═══════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  // screen – Container chính, full màn hình, nền BACKGROUND
  screen: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  // content – Padding cho nội dung FlatList, gap 12 giữa các item
  content: {
    padding: 20,
    paddingBottom: 32,
    gap: 12,
  },
  // centered – Trung tâm màn hình (dùng cho loading/empty)
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.BACKGROUND,
  },
  // loadingText – Chữ "Đang tải..." bên dưới spinner
  loadingText: {
    marginTop: 12,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
  },
  // hero – Hàng ngang tiêu đề + icon
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 6,
    marginBottom: 4,
  },
  // heroIcon – Icon hình tròn góc bo với nền đỏ Valorant
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.VALORANT_RED,
  },
  // heroCopy – Vùng chứa tiêu đề + phụ đề (co giãn)
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  // title – Tiêu đề chính (Hero)
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.TEXT_PRIMARY,
  },
  // subtitle – Phụ đề (Hero)
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.TEXT_SECONDARY,
  },
  // statsGrid – Grid 3 cột thống kê
  statsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  // statCard – Một ô thống kê (skin, variant, rad)
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
  // statValueRow – Hàng ngang icon + giá trị thống kê
  statValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  // statValue – Số liệu thống kê (to, đậm)
  statValue: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: "900",
  },
  // statLabel – Nhãn cho số liệu thống kê
  statLabel: {
    marginTop: 3,
    color: COLORS.TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: "700",
  },
  // statCurrencyIcon – Icon tiền tệ trong stat
  statCurrencyIcon: {
    width: 14,
    height: 14,
  },
  // searchBox – Container thanh tìm kiếm
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
  // searchInput – Input tìm kiếm
  searchInput: {
    flex: 1,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: "700",
    paddingVertical: 0,
  },
  // clearSearchButton – Nút xóa text tìm kiếm
  clearSearchButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.SURFACE_MUTED,
  },
  // defCard – Card cho mỗi định nghĩa nâng cấp (GlassCard wrapper)
  defCard: {
    padding: 0,
    overflow: "hidden",
  },
  // skinImageBand – Dải ảnh skin lớn phía trên card
  skinImageBand: {
    height: 118,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.SURFACE_MUTED,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
    paddingHorizontal: 18,
  },
  // skinBandImage – Ảnh skin trong band
  skinBandImage: {
    width: "100%",
    height: "100%",
  },
  // defHeader – Header card (thumbnail + info + cost + chevron)
  defHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 112,
    padding: 14,
  },
  // thumbnailFrame – Khung ảnh thumbnail của skin
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
  // thumbnail – Ảnh thumbnail bên trong khung
  thumbnail: {
    width: "96%",
    height: "96%",
  },
  // defInfo – Vùng thông tin chính của định nghĩa
  defInfo: {
    flex: 1,
    minWidth: 0,
  },
  // defName – Tên skin
  defName: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.TEXT_PRIMARY,
  },
  // defDesc – Tên progression schedule
  defDesc: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.TEXT_SECONDARY,
  },
  // cardMetaRow – Hàng chứa các chip metadata
  cardMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  // metaChip – Chip hiển thị số cấp/số biến thể
  metaChip: {
    minHeight: 26,
    borderRadius: RADIUS.chip,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.SURFACE_MUTED,
  },
  // metaChipText – Text trong chip
  metaChipText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 11,
    fontWeight: "800",
  },
  // headerRight – Phần bên phải header (chi phí + chevron)
  headerRight: {
    alignItems: "flex-end",
    gap: 10,
  },
  // cardCostPill – Pill hiển thị chi phí Radianite
  cardCostPill: {
    minHeight: 30,
    borderRadius: RADIUS.chip,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.VALORANT_BLACK,
  },
  // cardCostText – Text chi phí
  cardCostText: {
    color: COLORS.PURE_WHITE,
    fontSize: 12,
    fontWeight: "900",
  },
  // currencyIcon – Icon tiền tệ chung
  currencyIcon: {
    width: 14,
    height: 14,
  },
  // darkCurrencyIcon – Icon tiền tệ tối màu
  darkCurrencyIcon: {
    tintColor: COLORS.TEXT_PRIMARY,
  },
  // defBody – Phần thân mở rộng (progression + rewards + sidegrades)
  defBody: {
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
    padding: 14,
    gap: 12,
    backgroundColor: COLORS.SURFACE,
  },
  // progressionPanel – Panel hiển thị các cấp progression
  progressionPanel: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    backgroundColor: COLORS.SURFACE_MUTED,
    padding: 12,
  },
  // sectionTitleRow – Hàng tiêu đề của một section
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 10,
  },
  // progressionTitle – Tiêu đề section progression
  progressionTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: "900",
  },
  // levelsRow – Hàng chứa các bước cấp độ
  levelsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  // levelStep – Một bước cấp độ (số + chi phí)
  levelStep: {
    minWidth: 58,
    alignItems: "center",
    gap: 5,
  },
  // levelDot – Vòng tròn số thứ tự cấp
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
  // levelDotText – Số thứ tự trong vòng tròn
  levelDotText: {
    fontSize: 12,
    fontWeight: "900",
    color: COLORS.TEXT_PRIMARY,
  },
  // levelCost – Hàng chi phí của cấp
  levelCost: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  // levelCurrencyIcon – Icon tiền trong level
  levelCurrencyIcon: {
    width: 11,
    height: 11,
  },
  // levelCostText – Số tiền của cấp
  levelCostText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: "800",
  },
  // rewardRow – Hàng hiển thị phần thưởng của một cấp
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
  // rewardLevelBadge – Huy hiệu số cấp (màu đỏ)
  rewardLevelBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.VALORANT_RED,
  },
  // rewardLevelText – Text trong huy hiệu
  rewardLevelText: {
    color: COLORS.PURE_WHITE,
    fontSize: 12,
    fontWeight: "900",
  },
  // rewardInfo – Vùng thông tin reward
  rewardInfo: {
    flex: 1,
    minWidth: 0,
  },
  // rewardLabel – Nhãn "Upgrade X"
  rewardLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 4,
  },
  // rewardItem – Tên item nhận được
  rewardItem: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
  },
  // sidegradeSection – Section chứa các option biến thể
  sidegradeSection: {
    gap: 8,
  },
  // sidegradeTitle – Tiêu đề section biến thể
  sidegradeTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: COLORS.TEXT_PRIMARY,
  },
  // optionRow – Một hàng option sidegrade
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
  // optionRowSelected – Hàng option được chọn (màu cảnh báo)
  optionRowSelected: {
    backgroundColor: COLORS.WARNING_SURFACE,
    borderColor: COLORS.WARNING_BORDER,
  },
  // optionImage – Ảnh option sidegrade
  optionImage: {
    width: 42,
    height: 42,
  },
  // optionImageFallback – Fallback khi không có ảnh
  optionImageFallback: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.SURFACE,
  },
  // optionInfo – Vùng thông tin option
  optionInfo: {
    flex: 1,
    minWidth: 0,
  },
  // optionName – Tên option
  optionName: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.TEXT_PRIMARY,
  },
  // costRow – Hàng chi phí của option
  costRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 3,
  },
  // optionCost – Text chi phí option
  optionCost: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.TEXT_SECONDARY,
  },
  // emptyCard – Card hiển thị empty state
  emptyCard: {
    padding: 28,
    alignItems: "center",
    gap: 8,
  },
  // emptyTitle – Tiêu đề empty state
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.TEXT_PRIMARY,
  },
  // emptySubtitle – Phụ đề empty state
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    textAlign: "center",
    lineHeight: 20,
  },
});
