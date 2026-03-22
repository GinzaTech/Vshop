import React from "react";
import {
  Dimensions,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  DataProvider,
  LayoutProvider,
  RecyclerListView,
} from "recyclerlistview";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";

import { useWishlistStore } from "~/hooks/useWishlistStore";
import GalleryWeapon from "~/components/GalleryWeapon";
import { getAssets } from "~/utils/valorant-assets";
import { COLORS, RADIUS } from "~/constants/DesignSystem";

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

  const galleryDataProvider = React.useMemo(
    () =>
      new DataProvider((r1, r2) => r1.uuid !== r2.uuid).cloneWithRows(
        gallerySkins
      ),
    [gallerySkins]
  );

  const rowRenderer = (
    _type: string | number,
    // @ts-ignore
    data: GalleryWeapon
  ) => <GalleryWeapon item={data} toggleFromWishlist={toggleSkin} />;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Skin gallery</Text>
        <Text style={styles.subtitle}>
          Browse your collection and save favorites for wishlist tracking.
        </Text>
      </View>

      <View style={styles.searchBar}>
        <Icon name="magnify" size={20} color={COLORS.TEXT_SECONDARY} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search skins"
          placeholderTextColor={COLORS.TEXT_SECONDARY}
          style={styles.searchInput}
        />
      </View>

      <View style={styles.chips}>
        {[
          { key: "all", label: "All" },
          { key: "wishlist", label: "Wishlist" },
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

      {galleryDataProvider.getSize() > 0 ? (
        <RecyclerListView
          rowRenderer={rowRenderer}
          dataProvider={galleryDataProvider}
          layoutProvider={
            new LayoutProvider(
              () => 0,
              (_type, dim) => {
                dim.width = Dimensions.get("window").width;
                dim.height = 116;
              }
            )
          }
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No skins found</Text>
          <Text style={styles.emptySubtitle}>
            Try a different keyword or clear the wishlist filter.
          </Text>
        </View>
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
    paddingHorizontal: 20,
    marginBottom: 18,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.TEXT_PRIMARY,
  },
  subtitle: {
    marginTop: 6,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 22,
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
    padding: 24,
    borderRadius: RADIUS.card,
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

export default Gallery;
