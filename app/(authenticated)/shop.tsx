// 📦 shop.tsx – Màn hình Cửa hàng chính (Daily Shop) Valorant
// Hiển thị các skin có sẵn trong cửa hàng hàng ngày, có bộ lọc "Tất cả" / "Yêu thích",
// kèm đếm ngược thời gian làm mới và số dư VP

import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { useTranslation } from "react-i18next";

import Countdown from "~/components/Countdown";
import ShopItem from "~/components/ShopItem";
import { useUserStore } from "~/hooks/useUserStore";
import { useWishlistStore } from "~/hooks/useWishlistStore";
import { COLORS } from "~/constants/DesignSystem";
import EmptyStateCard from "~/components/ui/EmptyStateCard";
import InfoPill from "~/components/ui/InfoPill";
import AppRefreshControl from "~/components/ui/AppRefreshControl";
import { useAsyncRefresh } from "~/hooks/useAsyncRefresh";
import { refreshShopAndBalances } from "~/utils/app-sync";

const CONTENT_PADDING = 20;
const GRID_GAP = 12;

/**
 * Shop – Component chính hiển thị cửa hàng hàng ngày
 * Gồm header (avatar, balance, chào), bộ lọc (all/wishlist),
 * metric row (VP balance + countdown), và danh sách item dạng grid 2 cột
 */
function Shop() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const user = useUserStore((state) => state.user);
  const [mode, setMode] = React.useState<"all" | "wishlist">("all");
  const skinIds = useWishlistStore((state) => state.skinIds);
  const refreshShop = React.useCallback(
    () => refreshShopAndBalances(true),
    []
  );
  const { refreshing, onRefresh } = useAsyncRefresh(refreshShop);

  const timestamp = new Date().getTime() + user.shops.remainingSecs.main * 1000;

  const filteredItems = React.useMemo(() => {
    if (mode === "all") return user.shops.main;
    return user.shops.main.filter((item) =>
      skinIds.includes(item.levels[0]?.uuid),
    );
  }, [mode, skinIds, user.shops.main]);

  const columnCount = width >= 700 ? 3 : 2;
  const cardWidth = Math.floor(
    (width - CONTENT_PADDING * 2 - GRID_GAP * (columnCount - 1)) / columnCount
  );

  const initials = (user.name || "V").slice(0, 1).toUpperCase();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      alwaysBounceVertical
      showsVerticalScrollIndicator={false}
    >
      {/* Premium Custom Header Row: avatar, tên, chào, balance VP */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Vshop</Text>
            <Text style={styles.headerSubtitle}>
              {t("shop_page.greeting", { name: user.name || t("shop_page.agent_fallback") })}
            </Text>
          </View>
        </View>
        <View style={styles.headerBalancePill}>
          <Text style={styles.headerBalanceText}>{user.balances.vp} {t("vp")}</Text>
          <View style={styles.headerBalanceIconWrapper}>
            <Text style={styles.headerBalanceIconText}>Ⓢ</Text>
          </View>
        </View>
      </View>

      {/* Bộ lọc và countdown dùng chung baseline để không bị lệch hàng. */}
      <View style={styles.filterBar}>
        <View style={styles.filterOptions}>
          <TouchableOpacity
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === "all" }}
            activeOpacity={0.85}
            style={[styles.chip, mode === "all" && styles.chipActive]}
            onPress={() => setMode("all")}
          >
            <Text style={[styles.chipLabel, mode === "all" && styles.chipLabelActive]}>
              {t("shop_page.filters.all")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === "wishlist" }}
            activeOpacity={0.85}
            style={[styles.chip, mode === "wishlist" && styles.chipActive]}
            onPress={() => setMode("wishlist")}
          >
            <View style={styles.chipWishlistContent}>
              <Icon
                name={mode === "wishlist" ? "heart" : "heart-outline"}
                size={15}
                color={mode === "wishlist" ? COLORS.PURE_WHITE : COLORS.TEXT_PRIMARY}
                style={{ marginRight: 5 }}
              />
              <Text style={[styles.chipLabel, mode === "wishlist" && styles.chipLabelActive]}>
                {t("shop_page.filters.wishlist")}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <InfoPill style={styles.metricPill}>
          <Icon name="clock-outline" size={15} color={COLORS.TEXT_PRIMARY} />
          <Countdown
            timestamp={timestamp}
            compact
            showIcon={false}
            textStyle={styles.countdownText}
          />
        </InfoPill>
      </View>

      {/* Empty state khi không có item */}
      {filteredItems.length === 0 ? (
        <EmptyStateCard
          title={t("shop_page.empty_title")}
          subtitle={t("shop_page.empty_subtitle")}
          style={styles.emptyState}
        />
      ) : (
        <>
          <View style={styles.todayShopHeader}>
            <Text style={styles.todayShopMeta}>
              {t("shop_page.items_count", { count: filteredItems.length })}
            </Text>
          </View>
          <View style={styles.list}>
            {filteredItems.map((item) => (
              <View key={item.uuid} style={{ width: cardWidth }}>
                <ShopItem item={item} />
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════════
// StyleSheet – Định nghĩa styles cho màn hình Shop
// ═══════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  // screen – Container chính
  screen: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  // content – Padding ScrollView
  content: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 32,
  },
  // headerRow – Hàng header (avatar + balance)
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 24,
  },
  // headerLeft – Bên trái header (avatar + text)
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  // headerTextContainer – Vùng text bên cạnh avatar
  headerTextContainer: {
    marginLeft: 12,
  },
  // headerTitle – Tiêu đề "Vshop"
  headerTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: COLORS.TEXT_PRIMARY,
    letterSpacing: -0.5,
  },
  // headerSubtitle – Câu chào người dùng
  headerSubtitle: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.TEXT_SECONDARY,
    marginTop: 2,
  },
  // headerBalancePill – Pill hiển thị số dư VP
  headerBalancePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.SURFACE,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    shadowColor: COLORS.PURE_BLACK,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  // headerBalanceText – Số dư VP
  headerBalanceText: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.TEXT_PRIMARY,
    marginRight: 6,
  },
  // headerBalanceIconWrapper – Icon Ⓢ trong pill
  headerBalanceIconWrapper: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.PURE_BLACK,
    alignItems: "center",
    justifyContent: "center",
  },
  // headerBalanceIconText – Chữ Ⓢ
  headerBalanceIconText: {
    fontSize: 10,
    fontWeight: "900",
    color: COLORS.PURE_WHITE,
  },
  // avatar – Vòng tròn avatar
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.SURFACE,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  // avatarText – Chữ cái đầu trong avatar
  avatarText: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.TEXT_PRIMARY,
  },
  // filterBar – Filter và countdown cùng một hàng, cùng chiều cao.
  filterBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 24,
  },
  filterOptions: {
    flexDirection: "row",
    flexShrink: 1,
    gap: 6,
  },
  // chip – Chip filter mặc định
  chip: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  // chipActive – Chip đang active (nền đen)
  chipActive: {
    backgroundColor: COLORS.PURE_BLACK,
    borderColor: COLORS.PURE_BLACK,
  },
  // chipLabel – Text chip mặc định
  chipLabel: {
    color: COLORS.TEXT_PRIMARY,
    fontWeight: "700",
    fontSize: 13,
  },
  // chipLabelActive – Text chip active (trắng)
  chipLabelActive: {
    color: COLORS.PURE_WHITE,
  },
  // chipWishlistContent – Nội dung chip wishlist (icon + text)
  chipWishlistContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  // metricPill – Pill thông số
  metricPill: {
    minHeight: 44,
    height: 44,
    marginLeft: "auto",
    paddingHorizontal: 10,
    gap: 4,
    borderRadius: 999,
    shadowColor: COLORS.PURE_BLACK,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  countdownText: {
    fontSize: 11,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  // todayShopHeader – Header "Today's shop"
  todayShopHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  // todayShopMeta – Số lượng item trong shop
  todayShopMeta: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.TEXT_SECONDARY,
  },
  // list – Grid flexWrap (giống Night Market)
  list: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
    marginBottom: 24,
  },
  // emptyState – Margin cho empty state card
  emptyState: {
    marginTop: 4,
  },
});

export default Shop;
