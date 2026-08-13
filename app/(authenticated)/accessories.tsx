// 📄 app/(authenticated)/accessories.tsx — Cửa hàng phụ kiện (Accessory Shop)
// Hiển thị danh sách các accessories (phụ kiện) có sẵn trong shop của người dùng,
// kèm thanh tìm kiếm, số dư KC và bộ đếm thời gian còn lại.

import React from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { useTranslation } from "react-i18next";

import Countdown from "~/components/Countdown";
import ShopAccessoryItem from "~/components/ShopAccessoryItem";
import CurrencyIcon from "~/components/CurrencyIcon";
import { useUserStore } from "~/hooks/useUserStore";
import { COLORS } from "~/constants/DesignSystem";
import EmptyStateCard from "~/components/ui/EmptyStateCard";
import InfoPill from "~/components/ui/InfoPill";
import TwoColumnGrid from "~/components/ui/TwoColumnGrid";
import AppRefreshControl from "~/components/ui/AppRefreshControl";
import { useAsyncRefresh } from "~/hooks/useAsyncRefresh";
import { refreshShopAndBalances } from "~/utils/app-sync";

/**
 * AccessoryShop — Component hiển thị cửa hàng phụ kiện.
 *
 * State:
 * - user (từ useUserStore): Thông tin user (balances, shops.accessory, shops.remainingSecs).
 * - query (state, string): Từ khóa tìm kiếm.
 * - timestamp (number): Thời điểm shop refresh (hiện tại + remaining seconds).
 * - items (useMemo): Danh sách accessory đã lọc theo query.
 *
 * useMemo items: Lọc user.shops.accessory theo query (so sánh không phân biệt hoa/thường).
 *
 * Layout:
 * - Thanh tìm kiếm (search bar) với icon kính lúp.
 * - Hàng metrics: số dư KC + countdown đến lần refresh tiếp theo.
 * - Danh sách items trong TwoColumnGrid (2 cột) hoặc EmptyStateCard nếu không có.
 *
 * @returns {JSX.Element} Màn hình cửa hàng phụ kiện.
 */
function AccessoryShop() {
  const { t } = useTranslation();
  const user = useUserStore((state) => state.user);
  const [query, setQuery] = React.useState(""); // Input tìm kiếm
  const refreshShop = React.useCallback(
    () => refreshShopAndBalances(true),
    []
  );
  const { refreshing, onRefresh } = useAsyncRefresh(refreshShop);

  // Thời gian refresh shop = bây giờ + số giây còn lại
  const timestamp =
    new Date().getTime() + user.shops.remainingSecs.accessory * 1000;

  // Lọc accessories theo query
  const items = React.useMemo(() => {
    return user.shops.accessory.filter((item) =>
      item.displayName.toLowerCase().includes(query.trim().toLowerCase())
    );
  }, [query, user.shops.accessory]);

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
      {/* ── Thanh tìm kiếm ── */}
      <View style={styles.searchBar}>
        <Icon name="magnify" size={20} color={COLORS.TEXT_SECONDARY} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("accessories_page.search_placeholder")}
          placeholderTextColor={COLORS.TEXT_SECONDARY}
          style={styles.searchInput}
        />
      </View>

      {/* ── Metrics: KC + Countdown ── */}
      <View style={styles.metricRow}>
        <InfoPill style={[styles.metricPill, styles.kcMetricPill]}>
          <CurrencyIcon icon="kc" style={styles.metricIcon} />
          <Text style={styles.metricText}>{user.balances.kc}</Text>
        </InfoPill>
        <InfoPill style={styles.metricPill}>
          <Icon name="clock-outline" size={16} color={COLORS.TEXT_PRIMARY} />
          <Countdown
            timestamp={timestamp}
            showIcon={false}
            textStyle={styles.countdownText}
          />
        </InfoPill>
      </View>

      {/* ── Danh sách items hoặc empty state ── */}
      {items.length === 0 ? (
        <EmptyStateCard
          title={t("accessories_page.empty_title")}
          subtitle={t("accessories_page.empty_subtitle")}
        />
      ) : (
        <TwoColumnGrid
            items={items}
            keyExtractor={(item) => item.uuid}
            renderItem={(item) => <ShopAccessoryItem item={item} />}
          />
      )}
    </ScrollView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  content: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 36,
  },
  header: {
    marginBottom: 18,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.SURFACE,
    borderRadius: 24,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    minHeight: 56,
    marginBottom: 18,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: COLORS.TEXT_PRIMARY,
  },
  metricRow: {
    flexDirection: "row",
    gap: 12,            // Khoảng cách giữa 2 pill
    marginBottom: 20,
  },
  metricPill: {
    flex: 1,            // Mỗi pill chiếm 1/2 chiều rộng
  },
  kcMetricPill: {
    backgroundColor: COLORS.VALORANT_DARK_BLUE,
    borderColor: "rgba(255,255,255,0.08)",
  },
  metricIcon: {
    width: 14,
    height: 14,
    tintColor: COLORS.PURE_WHITE,
  },
  metricText: {
    color: COLORS.PURE_WHITE,
    fontWeight: "700",
  },
  countdownText: {
    color: COLORS.TEXT_PRIMARY,
    fontWeight: "700",
  },
});

export default AccessoryShop;
