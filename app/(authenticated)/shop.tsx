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
import { Image as ExpoImage } from "expo-image";
import { useTranslation } from "react-i18next";

import Countdown from "~/components/Countdown";
import ShopItem from "~/components/ShopItem";
import CurrencyIcon from "~/components/CurrencyIcon";
import { useUserStore } from "~/hooks/useUserStore";
import { useWishlistStore } from "~/hooks/useWishlistStore";
import { useMediaPopupStore } from "~/components/popups/MediaPopup";
import { useFeatureStore } from "~/hooks/useFeatureStore";
import { getDisplayIconUri } from "~/utils/misc";
import { COLORS, RADIUS } from "~/constants/DesignSystem";
import { getContentTierVisual } from "~/utils/content-tier";
import EmptyStateCard from "~/components/ui/EmptyStateCard";
import InfoPill from "~/components/ui/InfoPill";
import PageIntro from "~/components/ui/PageIntro";
import SectionHeader from "~/components/ui/SectionHeader";
import TwoColumnGrid from "~/components/ui/TwoColumnGrid";

function Shop() {
  const { t } = useTranslation();
  const user = useUserStore((state) => state.user);
  const skinIds = useWishlistStore((state) => state.skinIds);
  const toggleSkin = useWishlistStore((state) => state.toggleSkin);
  const { showMediaPopup } = useMediaPopupStore();
  const { screenshotModeEnabled } = useFeatureStore();
  const [query, setQuery] = React.useState("");
  const [mode, setMode] = React.useState<"all" | "wishlist">("all");

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

  const featured = filteredItems[0];
  const listItems = filteredItems.slice(featured ? 1 : 0);
  const initials = (user.name || "V").slice(0, 1).toUpperCase();
  const featuredTier = React.useMemo(
    () => (featured ? getContentTierVisual(featured.contentTierUuid) : null),
    [featured]
  );
  const featuredImageSource = React.useMemo(() => {
    if (!featured) {
      return require("~/assets/images/noimage.png");
    }

    const uri = getDisplayIconUri(featured);

    if (uri && !screenshotModeEnabled) {
      return { uri, cacheKey: uri };
    }

    return require("~/assets/images/noimage.png");
  }, [featured, screenshotModeEnabled]);

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

      {featured ? (
        <View style={styles.featuredCard}>
          <ExpoImage
            source={featuredImageSource}
            style={styles.featuredImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            priority="high"
            transition={140}
            recyclingKey={featured.uuid}
          />
          <View
            style={[
              styles.featuredOverlay,
              featuredTier && {
                backgroundColor: featuredTier.overlayBackground,
                borderColor: featuredTier.border,
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.featuredHeart}
              onPress={() => toggleSkin(featured.levels[0].uuid)}
            >
              <Icon
                name={
                  skinIds.includes(featured.levels[0].uuid) ? "heart" : "heart-outline"
                }
                size={18}
                color={COLORS.PURE_WHITE}
              />
            </TouchableOpacity>

            <View>
              <Text style={styles.featuredEyebrow}>
                {t("shop_page.featured_eyebrow")}
              </Text>
              <Text style={styles.featuredTitle}>{featured.displayName}</Text>
              {featuredTier ? (
                <View style={styles.featuredBadgeRow}>
                  <View style={styles.featuredTierBadge}>
                    <View
                      style={[
                        styles.featuredTierDot,
                        { backgroundColor: featuredTier.accent },
                      ]}
                    />
                    <Text style={styles.featuredTierText}>
                      {featuredTier.label}
                    </Text>
                  </View>
                </View>
              ) : null}
              <View style={styles.featuredMetaRow}>
                <Icon name="star-outline" size={16} color={COLORS.PURE_WHITE} />
                <Text style={styles.featuredMetaText}>
                  {t("shop_page.featured_meta")}
                </Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.88}
                style={styles.featuredAction}
                onPress={() =>
                  showMediaPopup(
                    featured.levels.map(
                      (level) => level.streamedVideo || level.displayIcon || ""
                    ),
                    t("shop_page.preview_title")
                  )
                }
              >
                <Text style={styles.featuredActionText}>
                  {t("shop_page.preview_action")}
                </Text>
                <View style={styles.featuredActionIcon}>
                  <Icon name="arrow-right" size={18} color={COLORS.PURE_BLACK} />
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <EmptyStateCard
          title={t("shop_page.empty_title")}
          subtitle={t("shop_page.empty_subtitle")}
          style={styles.emptyState}
        />
      )}

      {listItems.length > 0 ? (
        <>
          <SectionHeader
            title={t("shop_page.rotation_title")}
            meta={t("shop_page.items_count", { count: listItems.length })}
            style={styles.sectionTopSpacing}
          />
          <TwoColumnGrid
            items={listItems}
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
    backgroundColor: "#b0bac6",
    borderColor: "rgba(23, 26, 31, 0.16)",
  },
  metricIcon: {
    width: 14,
    height: 14,
  },
  metricValue: {
    color: COLORS.TEXT_PRIMARY,
    fontWeight: "700",
    fontSize: 15,
  },
  featuredCard: {
    position: "relative",
    minHeight: 380,
    justifyContent: "space-between",
    borderRadius: 30,
    overflow: "hidden",
  },
  featuredImage: {
    ...StyleSheet.absoluteFillObject,
  },
  featuredOverlay: {
    flex: 1,
    justifyContent: "space-between",
    padding: 20,
    borderRadius: 30,
    backgroundColor: "rgba(23,26,31,0.40)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  featuredHeart: {
    alignSelf: "flex-end",
    width: 44,
    height: 44,
    borderRadius: RADIUS.chip,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(23,26,31,0.44)",
  },
  featuredEyebrow: {
    color: COLORS.PURE_WHITE,
    fontSize: 14,
    opacity: 0.92,
  },
  featuredTitle: {
    marginTop: 6,
    color: COLORS.PURE_WHITE,
    fontSize: 32,
    fontWeight: "700",
  },
  featuredBadgeRow: {
    flexDirection: "row",
    marginTop: 12,
  },
  featuredTierBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.chip,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  featuredTierDot: {
    width: 8,
    height: 8,
    borderRadius: RADIUS.chip,
    marginRight: 6,
  },
  featuredTierText: {
    color: COLORS.PURE_WHITE,
    fontSize: 13,
    fontWeight: "700",
  },
  featuredMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  featuredMetaText: {
    color: COLORS.PURE_WHITE,
    fontSize: 15,
    textShadowColor: "rgba(0,0,0,0.28)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  featuredAction: {
    marginTop: 20,
    minHeight: 68,
    borderRadius: 24,
    paddingHorizontal: 20,
    backgroundColor: "rgba(23,26,31,0.88)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  featuredActionText: {
    color: COLORS.PURE_WHITE,
    fontSize: 18,
    fontWeight: "600",
  },
  featuredActionIcon: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.chip,
    backgroundColor: COLORS.PURE_WHITE,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    marginTop: 4,
  },
});

export default Shop;
