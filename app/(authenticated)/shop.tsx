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
      <PageIntro
        title={t("shop_page.greeting", {
          name: user.name || t("shop_page.agent_fallback"),
        })}
        subtitle={t("shop_page.subtitle")}
        style={styles.topIntro}
        accessory={
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        }
      />

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
            name={mode === "all" ? "tune-variant" : "heart"}
            size={20}
            color={COLORS.PURE_WHITE}
          />
        </TouchableOpacity>
      </View>

      <SectionHeader title={t("shop_page.section_title")} style={styles.sectionIntro} />

      <View style={styles.chips}>
        {[
          { key: "all", label: t("shop_page.filters.all") },
          { key: "wishlist", label: t("shop_page.filters.wishlist") },
        ].map((chip) => {
          const active = chip.key === mode;
          return (
            <TouchableOpacity
              key={chip.key}
              activeOpacity={0.85}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setMode(chip.key as "all" | "wishlist")}
            >
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                {chip.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.metricRow}>
        <InfoPill style={[styles.metricPill, styles.balanceMetricPill]}>
          <CurrencyIcon icon="vp" style={styles.metricIcon} />
          <Text style={styles.metricValue}>{user.balances.vp}</Text>
        </InfoPill>
        <InfoPill style={styles.metricPill}>
          <Icon name="timer-outline" size={16} color={COLORS.TEXT_PRIMARY} />
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
          <SectionHeader
            title={t("shop_page.rotation_title")}
            meta={t("shop_page.items_count", { count: filteredItems.length })}
            style={styles.sectionTopSpacing}
          />
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
  topIntro: {
    marginTop: 6,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.chip,
    backgroundColor: COLORS.SURFACE,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
  },
  searchRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 22,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.SURFACE,
    borderRadius: 24,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    minHeight: 56,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: COLORS.TEXT_PRIMARY,
  },
  filterButton: {
    width: 56,
    height: 56,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.PURE_BLACK,
  },
  sectionIntro: {
    marginTop: 28,
  },
  sectionTopSpacing: {
    marginTop: 24,
  },
  chips: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.chip,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  chipActive: {
    backgroundColor: COLORS.PURE_BLACK,
    borderColor: COLORS.PURE_BLACK,
  },
  chipLabel: {
    color: COLORS.TEXT_SECONDARY,
    fontWeight: "600",
  },
  chipLabelActive: {
    color: COLORS.PURE_WHITE,
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 20,
  },
  metricPill: {
    flex: 1,
  },
  balanceMetricPill: {
    backgroundColor: COLORS.VALORANT_DARK_BLUE,
    borderColor: "rgba(255,255,255,0.08)",
  },
  metricIcon: {
    width: 14,
    height: 14,
    tintColor: COLORS.PURE_WHITE,
  },
  metricValue: {
    color: COLORS.PURE_WHITE,
    fontWeight: "700",
    fontSize: 15,
  },
  emptyState: {
    marginTop: 4,
  },
});

export default Shop;
