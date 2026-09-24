// ===== Import thư viện =====
import React from "react";
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";

import AppIcon from "~/components/ui/AppIcon";
import { useWishlistStore } from "~/hooks/useWishlistStore";
import GalleryWeapon from "~/components/GalleryWeapon";
import { getAssets } from "~/utils/valorant-assets";
import { COLORS, RADIUS } from "~/constants/DesignSystem";
import EmptyStateCard from "~/components/ui/EmptyStateCard";
import PageIntro from "~/components/ui/PageIntro";
import AppRefreshControl from "~/components/ui/AppRefreshControl";
import { useAsyncRefresh } from "~/hooks/useAsyncRefresh";
import { fullBackgroundSync } from "~/utils/app-sync";
import {
  getGalleryWishlistId,
  matchesGalleryQuery,
  normalizeGalleryQuery,
} from "~/utils/gallery-filter";

/**
 * useDebounceValue — Custom hook debounce giá trị string.
 * @param {string} value – Giá trị đầu vào thay đổi liên tục (VD: ô tìm kiếm).
 * @param {number} delay – Thời gian trễ (ms) kể từ lần thay đổi cuối.
 * @returns {string} Giá trị đã debounce — chỉ cập nhật sau `delay` ms.
 * Side effect: setTimeout bên trong effect; cleanup clearTimeout khi
 * value/delay đổi hoặc unmount.
 */
function useDebounceValue(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  React.useEffect(() => {
    const handler = setTimeout(() => { setDebouncedValue(value); }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Gallery — Thư viện skin vũ khí với tìm kiếm (debounce) và lọc wishlist.
 *
 * State:
 * - searchQuery: từ khóa thô; debouncedQuery: bản debounce 100ms.
 * - filter: "all" | "wishlist" (chip chọn kiểu hiển thị).
 * - columnCount: số cột grid — 3 nếu width >= 700, ngược lại 2.
 * - gallerySkins (useMemo): skin đã lọc theo query/tier/wishlist, gắn cờ
 *   onWishlist và sort item wishlist lên đầu danh sách.
 * - renderItem (useCallback): render một ô skin trong FlatList.
 *
 * @returns {JSX.Element} Màn hình thư viện skin.
 */
function Gallery() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const columnCount = width >= 700 ? 3 : 2;
  const [searchQuery, setSearchQuery] = React.useState("");
  const [filter, setFilter] = React.useState<"all" | "wishlist">("all");
  const debouncedQuery = useDebounceValue(searchQuery, 100);

  const skinIds = useWishlistStore((state) => state.skinIds);
  // refreshApp: pull-to-refresh chạy full sync nền (force = true)
  const refreshApp = React.useCallback(() => fullBackgroundSync(true), []);
  const { refreshing, onRefresh } = useAsyncRefresh(refreshApp);

  // gallerySkins: danh sách skin đã lọc + sort (memoized)
  // Lọc theo: query (tên skin), có contentTier, wishlist (nếu filter = "wishlist")
  // Map thêm field onWishlist, sort wishlist items lên đầu
  const gallerySkins = React.useMemo(() => {
    const normalizedQuery = normalizeGalleryQuery(debouncedQuery);

    return getAssets()
      .skins.filter((skin) => {
        const wishlistId = getGalleryWishlistId(skin);
        const matchesQuery = matchesGalleryQuery(skin, normalizedQuery);
        const matchesTier = skin.contentTierUuid;
        const matchesWishlist =
          filter === "all" ||
          (wishlistId !== null && skinIds.includes(wishlistId));
        return Boolean(matchesQuery && matchesTier && matchesWishlist);
      })
      .map((item) => {
        const wishlistId = getGalleryWishlistId(item);
        return {
          ...item,
          onWishlist: wishlistId !== null && skinIds.includes(wishlistId),
        };
      })
      .sort((a, b) => a.onWishlist === b.onWishlist ? 0 : a.onWishlist ? -1 : 1);
  }, [debouncedQuery, filter, skinIds]);

  // renderItem: render một item skin (memoized)
  const renderItem = React.useCallback(
    ({ item }: { item: GalleryItem }) => <GalleryWeapon item={item} />,
    []
  );

  return (
    <View style={styles.screen}>
      {/* Page intro: tiêu đề + phụ đề */}
      <PageIntro title={t("gallery_page.title")} subtitle={t("gallery_page.subtitle")} style={styles.header} />

      {/* Search bar */}
      <View style={styles.searchBar}>
        <AppIcon name="search" size={20} color={COLORS.TEXT_SECONDARY} decorative />
        <TextInput
          testID="gallery-search-input"
          accessibilityLabel={t("gallery_page.search_placeholder")}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t("gallery_page.search_placeholder")}
          placeholderTextColor={COLORS.TEXT_SECONDARY}
          style={styles.searchInput}
        />
      </View>

      {/* Chips filter: All / Wishlist */}
      <View style={styles.chips}>
        {[
          { key: "all", label: t("gallery_page.filters.all") },
          { key: "wishlist", label: t("gallery_page.filters.wishlist") },
        ].map((item) => {
          const active = item.key === filter;
          return (
            <TouchableOpacity
              key={item.key}
              testID={`gallery-filter-${item.key}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setFilter(item.key as "all" | "wishlist")}
              activeOpacity={0.85} style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Danh sách skin */}
      <FlatList
        data={gallerySkins}
        keyExtractor={(item) => item.uuid}
        renderItem={renderItem}
        key={`grid-${columnCount}`}
        numColumns={columnCount}
        columnWrapperStyle={gallerySkins.length > 0 ? styles.gridRow : undefined}
        contentContainerStyle={[
          styles.gridContent,
          gallerySkins.length === 0 && styles.gridContentEmpty,
        ]}
        ListEmptyComponent={
          <EmptyStateCard
            title={t("gallery_page.empty_title")}
            subtitle={t("gallery_page.empty_subtitle")}
            style={styles.emptyState}
          />
        }
        refreshControl={
          <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        alwaysBounceVertical
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
      />
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
  gridContentEmpty: { flexGrow: 1 },
  gridRow: { gap: 12, marginBottom: 12 },
});

export default Gallery;
