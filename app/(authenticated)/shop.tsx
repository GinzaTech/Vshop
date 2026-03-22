import React from "react";
import {
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";

import Countdown from "~/components/Countdown";
import ShopItem from "~/components/ShopItem";
import CurrencyIcon from "~/components/CurrencyIcon";
import { useUserStore } from "~/hooks/useUserStore";
import { useWishlistStore } from "~/hooks/useWishlistStore";
import { useMediaPopupStore } from "~/components/popups/MediaPopup";
import { useFeatureStore } from "~/hooks/useFeatureStore";
import { getDisplayIcon } from "~/utils/misc";
import { COLORS, RADIUS } from "~/constants/DesignSystem";

function Shop() {
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

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topRow}>
        <View>
          <Text style={styles.greeting}>Hello, {user.name || "Agent"}</Text>
          <Text style={styles.subtitle}>
            Welcome back to your daily store.
          </Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Icon name="magnify" size={22} color={COLORS.TEXT_SECONDARY} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search skins"
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

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Select your next drop</Text>
      </View>

      <View style={styles.chips}>
        {[
          { key: "all", label: "All skins" },
          { key: "wishlist", label: "Wishlist" },
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
        <View style={styles.metricPill}>
          <CurrencyIcon icon="vp" style={styles.metricIcon} />
          <Text style={styles.metricValue}>{user.balances.vp}</Text>
        </View>
        <View style={styles.metricPill}>
          <Icon name="timer-outline" size={16} color={COLORS.TEXT_PRIMARY} />
          <Countdown timestamp={timestamp} />
        </View>
      </View>

      {featured ? (
        <ImageBackground
          source={getDisplayIcon(featured, screenshotModeEnabled)}
          style={styles.featuredCard}
          imageStyle={styles.featuredImage}
          resizeMode="cover"
        >
          <View style={styles.featuredOverlay}>
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
              <Text style={styles.featuredEyebrow}>Featured daily store</Text>
              <Text style={styles.featuredTitle}>{featured.displayName}</Text>
              <View style={styles.featuredMetaRow}>
                <Icon name="star-outline" size={16} color={COLORS.PURE_WHITE} />
                <Text style={styles.featuredMetaText}>Wishlist ready</Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.88}
                style={styles.featuredAction}
                onPress={() =>
                  showMediaPopup(
                    featured.levels.map(
                      (level) => level.streamedVideo || level.displayIcon || ""
                    ),
                    "Preview"
                  )
                }
              >
                <Text style={styles.featuredActionText}>See more</Text>
                <View style={styles.featuredActionIcon}>
                  <Icon name="arrow-right" size={18} color={COLORS.PURE_BLACK} />
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </ImageBackground>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No skins found</Text>
          <Text style={styles.emptySubtitle}>
            Try another search or switch back to all skins.
          </Text>
        </View>
      )}

      {listItems.length > 0 ? (
        <>
          <View style={[styles.sectionRow, styles.sectionTopSpacing]}>
            <Text style={styles.sectionTitle}>Daily rotation</Text>
            <Text style={styles.sectionAction}>{listItems.length} items</Text>
          </View>
          {listItems.map((item) => (
            <ShopItem item={item} key={item.uuid} />
          ))}
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
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  greeting: {
    fontSize: 26,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
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
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 28,
    marginBottom: 12,
  },
  sectionTopSpacing: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
  },
  sectionAction: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
    borderRadius: RADIUS.chip,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    gap: 8,
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
    minHeight: 380,
    justifyContent: "space-between",
    borderRadius: 30,
    overflow: "hidden",
  },
  featuredImage: {
    borderRadius: 30,
  },
  featuredOverlay: {
    flex: 1,
    justifyContent: "space-between",
    padding: 20,
    borderRadius: 30,
    backgroundColor: "rgba(17,17,17,0.24)",
  },
  featuredHeart: {
    alignSelf: "flex-end",
    width: 44,
    height: 44,
    borderRadius: RADIUS.chip,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  featuredEyebrow: {
    color: COLORS.PURE_WHITE,
    fontSize: 14,
    opacity: 0.82,
  },
  featuredTitle: {
    marginTop: 6,
    color: COLORS.PURE_WHITE,
    fontSize: 32,
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
  },
  featuredAction: {
    marginTop: 20,
    minHeight: 68,
    borderRadius: 24,
    paddingHorizontal: 20,
    backgroundColor: "rgba(17,17,17,0.82)",
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
    padding: 24,
    borderRadius: 28,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
  },
  emptySubtitle: {
    marginTop: 8,
    color: COLORS.TEXT_SECONDARY,
  },
});

export default Shop;
