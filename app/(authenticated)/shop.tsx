import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { useTranslation } from "react-i18next";

import Countdown from "~/components/Countdown";
import ShopItem from "~/components/ShopItem";
import CurrencyIcon from "~/components/CurrencyIcon";
import { useUserStore } from "~/hooks/useUserStore";
import { useWishlistStore } from "~/hooks/useWishlistStore";
import { COLORS, RADIUS } from "~/constants/DesignSystem";
import EmptyStateCard from "~/components/ui/EmptyStateCard";
import InfoPill from "~/components/ui/InfoPill";
import PageIntro from "~/components/ui/PageIntro";
import SectionHeader from "~/components/ui/SectionHeader";
import TwoColumnGrid from "~/components/ui/TwoColumnGrid";

function Shop() {
  const { t } = useTranslation();
  const user = useUserStore((state) => state.user);
  const [query, setQuery] = React.useState("");
  const [mode, setMode] = React.useState<"all" | "wishlist">("all");
  const skinIds = useWishlistStore((state) => state.skinIds);

  const timestamp = new Date().getTime() + user.shops.remainingSecs.main * 1000;

  const filteredItems = React.useMemo(() => {
    return user.shops.main.filter((item) => {
      const matchesQuery = item.displayName
        .toLowerCase()
        .includes(query.trim().toLowerCase());
      const matchesMode =
        mode === "all" || skinIds.includes(item.levels[0].uuid);

      return matchesQuery && matchesMode;
    });
  }, [mode, query, skinIds, user.shops.main]);

  const initials = (user.name || "V").slice(0, 1).toUpperCase();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Premium Custom Header Row */}
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

      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Icon name="magnify" size={22} color={COLORS.TEXT_SECONDARY} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("shop_page.search_placeholder")}
            placeholderTextColor={COLORS.TEXT_SECONDARY}
            style={styles.searchInput}
          />
        </View>
        <TouchableOpacity
          style={styles.filterButton}
          activeOpacity={0.85}
          onPress={() => setMode((current) => (current === "all" ? "wishlist" : "all"))}
        >
          <Icon
            name="tune-variant"
            size={22}
            color={COLORS.PURE_WHITE}
          />
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionHeading}>
        {t("shop_page.section_title")}
      </Text>

      <View style={styles.chips}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.chip, mode === "all" && styles.chipActive]}
          onPress={() => setMode("all")}
        >
          <Text style={[styles.chipLabel, mode === "all" && styles.chipLabelActive]}>
            {t("shop_page.filters.all")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.chip, mode === "wishlist" && styles.chipActive]}
          onPress={() => setMode("wishlist")}
        >
          <View style={styles.chipWishlistContent}>
            <Icon
              name={mode === "wishlist" ? "heart" : "heart-outline"}
              size={16}
              color={mode === "wishlist" ? COLORS.PURE_WHITE : COLORS.TEXT_PRIMARY}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.chipLabel, mode === "wishlist" && styles.chipLabelActive]}>
              {t("shop_page.filters.wishlist")}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.metricRow}>
        <InfoPill style={[styles.metricPill, styles.balanceMetricPill]}>
          <View style={styles.metricValueWrapper}>
            <Text style={styles.metricIconText}>Ⓢ</Text>
            <Text style={styles.metricValue}>{user.balances.vp}</Text>
          </View>
        </InfoPill>
        <InfoPill style={styles.metricPill}>
          <Icon name="clock-outline" size={18} color={COLORS.TEXT_PRIMARY} style={{ marginRight: 4 }} />
          <Countdown timestamp={timestamp} />
        </InfoPill>
      </View>

      {filteredItems.length === 0 ? (
        <EmptyStateCard
          title={t("shop_page.empty_title")}
          subtitle={t("shop_page.empty_subtitle")}
          style={styles.emptyState}
        />
      ) : null}

      {filteredItems.length > 0 ? (
        <>
          <View style={styles.todayShopHeader}>
            <Text style={styles.todayShopTitle}>
              {t("shop_page.section_title")}
            </Text>
            <Text style={styles.todayShopMeta}>
              {t("shop_page.items_count", { count: filteredItems.length })}
            </Text>
          </View>
          <TwoColumnGrid
            items={filteredItems}
            keyExtractor={(item) => item.uuid}
            renderItem={(item) => <ShopItem item={item} />}
          />
        </>
      ) : null}
    </ScrollView>
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
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTextContainer: {
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: COLORS.TEXT_PRIMARY,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.TEXT_SECONDARY,
    marginTop: 2,
  },
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
  headerBalanceText: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.TEXT_PRIMARY,
    marginRight: 6,
  },
  headerBalanceIconWrapper: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.PURE_BLACK,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBalanceIconText: {
    fontSize: 10,
    fontWeight: "900",
    color: COLORS.PURE_WHITE,
  },
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
  avatarText: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.TEXT_PRIMARY,
  },
  searchRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.SURFACE,
    borderRadius: 999,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    minHeight: 52,
    shadowColor: COLORS.PURE_BLACK,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.TEXT_PRIMARY,
  },
  filterButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.PURE_BLACK,
    shadowColor: COLORS.PURE_BLACK,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 12,
  },
  chips: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 24,
  },
  chip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  chipActive: {
    backgroundColor: COLORS.PURE_BLACK,
    borderColor: COLORS.PURE_BLACK,
  },
  chipLabel: {
    color: COLORS.TEXT_PRIMARY,
    fontWeight: "700",
    fontSize: 13,
  },
  chipLabelActive: {
    color: COLORS.PURE_WHITE,
  },
  chipWishlistContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 28,
  },
  metricPill: {
    flex: 1,
    minHeight: 48,
    borderRadius: 999,
    shadowColor: COLORS.PURE_BLACK,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  balanceMetricPill: {
    backgroundColor: COLORS.VALORANT_DARK_BLUE,
    borderColor: "rgba(255,255,255,0.04)",
  },
  metricValueWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  metricIconText: {
    fontSize: 12,
    fontWeight: "900",
    color: COLORS.PURE_WHITE,
    marginRight: 6,
    borderWidth: 1,
    borderColor: COLORS.PURE_WHITE,
    borderRadius: 6,
    width: 14,
    height: 14,
    textAlign: "center",
    lineHeight: 12,
  },
  metricValue: {
    color: COLORS.PURE_WHITE,
    fontWeight: "800",
    fontSize: 16,
  },
  todayShopHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  todayShopTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.TEXT_PRIMARY,
  },
  todayShopMeta: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.TEXT_SECONDARY,
  },
  emptyState: {
    marginTop: 4,
  },
});

export default Shop;
