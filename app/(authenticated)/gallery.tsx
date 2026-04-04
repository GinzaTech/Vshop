import React from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { useTranslation } from "react-i18next";

import { useWishlistStore } from "~/hooks/useWishlistStore";
import GalleryWeapon from "~/components/GalleryWeapon";
import { getAssets } from "~/utils/valorant-assets";
import { COLORS, RADIUS } from "~/constants/DesignSystem";
import EmptyStateCard from "~/components/ui/EmptyStateCard";
import PageIntro from "~/components/ui/PageIntro";

function useDebounceValue(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

function Gallery() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [filter, setFilter] = React.useState<"all" | "wishlist">("all");
  const debouncedQuery = useDebounceValue(searchQuery, 100);
  // @ts-ignore
  const [gallerySkins, setGallerySkins] = React.useState<GalleryWeapon[]>([]);
  const { skinIds, toggleSkin } = useWishlistStore();

  React.useEffect(() => {
    setGallerySkins(
      getAssets()
        .skins.filter((skin) => {
          const matchesQuery = skin.displayName.match(
            new RegExp(
              debouncedQuery.replace(/[&/\\#,+()$~%.^'":*?<>{}]/g, ""),
              "i"
            )
          );
          const matchesTier = skin.contentTierUuid;
          const matchesWishlist =
            filter === "all" || skinIds.includes(skin.levels[0].uuid);

          return Boolean(matchesQuery && matchesTier && matchesWishlist);
        })
        .map((item) => ({
          ...item,
          onWishlist: skinIds.includes(item.levels[0].uuid),
        }))
        .sort((a, b) =>
          a.onWishlist === b.onWishlist ? 0 : a.onWishlist ? -1 : 1
        )
    );
  }, [debouncedQuery, filter, skinIds]);

  const renderItem = React.useCallback(
    ({ item }: { item: GalleryItem }) => (
      <GalleryWeapon item={item} toggleFromWishlist={toggleSkin} />
    ),
    [toggleSkin]
  );

  return (
    <View style={styles.screen}>
      <PageIntro
        title={t("gallery_page.title")}
        subtitle={t("gallery_page.subtitle")}
        style={styles.header}
      />

      <View style={styles.searchBar}>
        <Icon name="magnify" size={20} color={COLORS.TEXT_SECONDARY} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t("gallery_page.search_placeholder")}
          placeholderTextColor={COLORS.TEXT_SECONDARY}
          style={styles.searchInput}
        />
      </View>

      <View style={styles.chips}>
        {[
          { key: "all", label: t("gallery_page.filters.all") },
          { key: "wishlist", label: t("gallery_page.filters.wishlist") },
        ].map((item) => {
          const active = item.key === filter;
          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => setFilter(item.key as "all" | "wishlist")}
              activeOpacity={0.85}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {gallerySkins.length > 0 ? (
        <FlatList
          data={gallerySkins}
          keyExtractor={(item) => item.uuid}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <EmptyStateCard
          title={t("gallery_page.empty_title")}
          subtitle={t("gallery_page.empty_subtitle")}
          style={styles.emptyState}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
    paddingTop: 8,
  },
  header: {
    marginTop: 6,
    paddingHorizontal: 20,
    marginBottom: 18,
  },
  searchBar: {
    marginHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.SURFACE,
    borderRadius: 22,
    paddingHorizontal: 16,
    minHeight: 56,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: COLORS.TEXT_PRIMARY,
  },
  chips: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 14,
    marginBottom: 10,
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
  emptyState: {
    margin: 20,
  },
  gridContent: {
    paddingHorizontal: 14,
    paddingBottom: 32,
    paddingTop: 4,
  },
  gridRow: {
    gap: 12,
    marginBottom: 12,
  },
});

export default Gallery;
