// ===== Import thư viện =====
import React from "react";
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from "react-native";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { useTranslation } from "react-i18next";

import { useWishlistStore } from "~/hooks/useWishlistStore";
import GalleryWeapon from "~/components/GalleryWeapon";
import { getAssets } from "~/utils/valorant-assets";
import { COLORS, RADIUS } from "~/constants/DesignSystem";
import EmptyStateCard from "~/components/ui/EmptyStateCard";
import PageIntro from "~/components/ui/PageIntro";

// useDebounceValue: custom hook debounce giá trị string
// value: giá trị đầu vào, delay: thời gian debounce (ms)
// Trả về: giá trị đã debounce (chỉ cập nhật sau delay ms kể từ lần thay đổi cuối)
function useDebounceValue(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  React.useEffect(() => {
    const handler = setTimeout(() => { setDebouncedValue(value); }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// Component Gallery: thư viện skin vũ khí với tìm kiếm, lọc wishlist
function Gallery() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const columnCount = width >= 700 ? 3 : 2;
  const [searchQuery, setSearchQuery] = React.useState("");
  const [filter, setFilter] = React.useState<"all" | "wishlist">("all");
  const debouncedQuery = useDebounceValue(searchQuery, 100);

  const skinIds = useWishlistStore((state) => state.skinIds);
  const toggleSkin = useWishlistStore((state) => state.toggleSkin);                     // Wishlist store

  // gallerySkins: danh sách skin đã lọc + sort (memoized)
  // Lọc theo: query (tên skin), có contentTier, wishlist (nếu filter = "wishlist")
  // Map thêm field onWishlist, sort wishlist items lên đầu
  const gallerySkins = React.useMemo(() => {
    return getAssets()
      .skins.filter((skin) => {
        const matchesQuery = skin.displayName.match(new RegExp(debouncedQuery.replace(/[&/\\#,+()$~%.^'":*?<>{}]/g, ""), "i"));
        const matchesTier = skin.contentTierUuid;
        const matchesWishlist = filter === "all" || skinIds.includes(skin.levels[0].uuid);
        return Boolean(matchesQuery && matchesTier && matchesWishlist);
      })
      .map((item) => ({ ...item, onWishlist: skinIds.includes(item.levels[0].uuid) }))
      .sort((a, b) => a.onWishlist === b.onWishlist ? 0 : a.onWishlist ? -1 : 1);
  }, [debouncedQuery, filter, skinIds]);

  // renderItem: render một item skin (memoized)
  const renderItem = React.useCallback(
    ({ item }: { item: GalleryItem }) => <GalleryWeapon item={item} toggleFromWishlist={toggleSkin} />,
    [toggleSkin]
  );

  return (
    <View style={styles.screen}>
      {/* Page intro: tiêu đề + phụ đề */}
      <PageIntro title={t("gallery_page.title")} subtitle={t("gallery_page.subtitle")} style={styles.header} />

      {/* Search bar */}
      <View style={styles.searchBar}>
        <Icon name="magnify" size={20} color={COLORS.TEXT_SECONDARY} />
        <TextInput value={searchQuery} onChangeText={setSearchQuery}
          placeholder={t("gallery_page.search_placeholder")} placeholderTextColor={COLORS.TEXT_SECONDARY} style={styles.searchInput} />
      </View>

      {/* Chips filter: All / Wishlist */}
      <View style={styles.chips}>
        {[
          { key: "all", label: t("gallery_page.filters.all") },
          { key: "wishlist", label: t("gallery_page.filters.wishlist") },
        ].map((item) => {
          const active = item.key === filter;
          return (
            <TouchableOpacity key={item.key} onPress={() => setFilter(item.key as "all" | "wishlist")}
              activeOpacity={0.85} style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Danh sách skin */}
      {gallerySkins.length > 0 ? (
        <FlatList data={gallerySkins} keyExtractor={(item) => item.uuid} renderItem={renderItem}
          key={`grid-${columnCount}`}
          numColumns={columnCount} columnWrapperStyle={styles.gridRow} contentContainerStyle={styles.gridContent} showsVerticalScrollIndicator={false}
          removeClippedSubviews initialNumToRender={8} maxToRenderPerBatch={8} windowSize={5} />
      ) : (
        <EmptyStateCard title={t("gallery_page.empty_title")} subtitle={t("gallery_page.empty_subtitle")} style={styles.emptyState} />
      )}
    </View>
  );
}

// ===== StyleSheet =====
const styles = StyleSheet.create({
  // Màn hình: nền tối, paddingTop 8
  screen: { flex: 1, backgroundColor: COLORS.BACKGROUND, paddingTop: 8 },
  // Header: marginTop 6, padding ngang 20, marginBottom 18
  header: { marginTop: 6, paddingHorizontal: 20, marginBottom: 18 },
  // Search bar: margin ngang 20, hàng ngang, bo góc 22, nền SURFACE, viền BORDER
  searchBar: { marginHorizontal: 20, flexDirection: "row", alignItems: "center", backgroundColor: COLORS.SURFACE, borderRadius: 22, paddingHorizontal: 16, minHeight: 56, borderWidth: 1, borderColor: COLORS.BORDER },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16, color: COLORS.TEXT_PRIMARY },
  // Hàng chips filter
  chips: { flexDirection: "row", gap: 10, paddingHorizontal: 20, marginTop: 14, marginBottom: 10 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.chip, backgroundColor: COLORS.SURFACE, borderWidth: 1, borderColor: COLORS.BORDER },
  chipActive: { backgroundColor: COLORS.PURE_BLACK, borderColor: COLORS.PURE_BLACK },
  chipLabel: { color: COLORS.TEXT_SECONDARY, fontWeight: "600" },
  chipLabelActive: { color: COLORS.PURE_WHITE },
  // Empty state
  emptyState: { margin: 20 },
  // Lưới skin
  gridContent: { paddingHorizontal: 14, paddingBottom: 32, paddingTop: 4 },
  gridRow: { gap: 12, marginBottom: 12 },
});

export default Gallery;
