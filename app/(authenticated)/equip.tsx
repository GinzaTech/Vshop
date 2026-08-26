// ===== Import thư viện =====
import React from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { Searchbar } from "react-native-paper";
import { useTranslation } from "react-i18next";

import GalleryEquip from "~/components/GalleryEquip";
import { useFeatureStore } from "~/hooks/useFeatureStore";
import { EQUIPMENT_SECTIONS, getCollectionBySection, sortEquipItems, buildEquipDisplayList, sanitizeQuery, type EquipmentSectionKey } from "~/components/popups/equipHelpers";
import { COLORS, RADIUS } from "~/constants/DesignSystem";
import EmptyStateCard from "~/components/ui/EmptyStateCard";
import AppRefreshControl from "~/components/ui/AppRefreshControl";
import { useAsyncRefresh } from "~/hooks/useAsyncRefresh";
import { fullBackgroundSync } from "~/utils/app-sync";

// EquipmentSectionKey: kiểu key cho các section (VD: "melee", "sidearm", ...)
// EquipmentDisplayItem: kiểu item hiển thị trong danh sách
type EquipmentDisplayItem = ReturnType<typeof buildEquipDisplayList>[number];

// Component Equip: hiển thị danh sách trang bị (vũ khí, mũ, cards, ...) theo section
// Cho phép tìm kiếm và lọc theo tab section
const Equip = () => {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const columnCount = width >= 700 ? 3 : 2;
  const screenshotModeEnabled = useFeatureStore((state) => state.screenshotModeEnabled);

  // State quản lý
  const [activeSection, setActiveSection] = React.useState<EquipmentSectionKey>(EQUIPMENT_SECTIONS[0].key); // Section đang active (UI)
  const [renderedSection, setRenderedSection] = React.useState<EquipmentSectionKey>(EQUIPMENT_SECTIONS[0].key); // Section thực tế render (delay)
  const [searchQuery, setSearchQuery] = React.useState("");                                                     // Từ khóa tìm kiếm
  const refreshApp = React.useCallback(() => fullBackgroundSync(true), []);
  const { refreshing, onRefresh } = useAsyncRefresh(refreshApp);

  // sectionFrameRef: ref cho requestAnimationFrame, dùng để delay render section
  // tránh giật lag khi chuyển tab
  const sectionFrameRef = React.useRef<number | null>(null);

  // sectionData: dữ liệu tất cả sections đã được sort + build (memoized, chỉ tính 1 lần)
  // Mỗi section: lấy collection từ helper, sort, build display list
  const sectionData = React.useMemo(
    () =>
      EQUIPMENT_SECTIONS.reduce<Record<EquipmentSectionKey, EquipmentDisplayItem[]>>(
        (acc, section) => {
          const collection = getCollectionBySection(section.key);
          acc[section.key] = buildEquipDisplayList(sortEquipItems(collection), section.key);
          return acc;
        },
        {} as Record<EquipmentSectionKey, EquipmentDisplayItem[]>
      ),
    []
  );

  // data: items của section đang render, đã lọc theo searchQuery (memoized)
  const data = React.useMemo(() => {
    const items = sectionData[renderedSection] ?? [];
    const normalized = sanitizeQuery(searchQuery);
    if (!normalized) return items;
    return items.filter((item) => {
      const primary = item.displayName ?? "";
      const secondary = item.subtitle ?? "";
      return primary.toLowerCase().includes(normalized) || secondary.toLowerCase().includes(normalized);
    });
  }, [renderedSection, searchQuery, sectionData]);

  // handleSectionPress: chuyển section với delay (requestAnimationFrame)
  // Giúp UI mượt hơn, tránh render ngay lập tức
  const handleSectionPress = React.useCallback(
    (section: EquipmentSectionKey) => {
      if (section === activeSection) return;
      setActiveSection(section);
      if (sectionFrameRef.current !== null) cancelAnimationFrame(sectionFrameRef.current);
      sectionFrameRef.current = requestAnimationFrame(() => {
        sectionFrameRef.current = null;
        setRenderedSection(section);
      });
    },
    [activeSection]
  );

  // Cleanup: hủy animation frame khi component unmount
  React.useEffect(() => () => { if (sectionFrameRef.current !== null) cancelAnimationFrame(sectionFrameRef.current); }, []);

  // renderEquipItem: render một item trang bị (memoized)
  const renderEquipItem = React.useCallback(
    ({ item }: { item: EquipmentDisplayItem }) => <GalleryEquip data={item} screenshotModeEnabled={screenshotModeEnabled} />,
    [screenshotModeEnabled]
  );

  return (
    <View style={styles.container}>
      {/* Searchbar: tìm kiếm trang bị */}
      <Searchbar testID="equipment-search-input" placeholder={t("equipment_page.search_placeholder")} value={searchQuery}
        onChangeText={setSearchQuery} style={styles.searchBar} inputStyle={styles.searchInput}
        iconColor={COLORS.TEXT_SECONDARY} accessibilityLabel={t("equipment_page.search_placeholder")} />

      {/* Tab group: các section (melee, sidearm, smg, ...) */}
      <View style={styles.tabGroup} accessibilityRole="tablist">
        {EQUIPMENT_SECTIONS.map((section) => {
          const isActive = section.key === activeSection;
          return (
            <TouchableOpacity key={section.key}
              testID={`equipment-tab-${section.key}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
              onPress={() => handleSectionPress(section.key)} activeOpacity={0.85}>
              <Text
                numberOfLines={2}
                style={[
                  styles.tabLabel,
                  section.key === "cards" && styles.tabLabelCompact,
                  isActive && styles.tabLabelActive,
                ]}
              >
                {t(section.labelKey)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Danh sách trang bị dạng lưới 2 cột, tối ưu render với các props */}
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        key={`grid-${columnCount}`}
        renderItem={renderEquipItem}
        numColumns={columnCount}
        columnWrapperStyle={styles.listColumn}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        alwaysBounceVertical
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyStateCard title={t("equipment_page.empty_title")} subtitle={t("equipment_page.empty_subtitle")} style={styles.emptyState} />}
        removeClippedSubviews
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={5}
        updateCellsBatchingPeriod={24}
      />
    </View>
  );
};

// ===== StyleSheet =====
const styles = StyleSheet.create({
  // Container: nền tối
  container: { flex: 1, backgroundColor: COLORS.BACKGROUND },
  // Header (không dùng)
  header: { paddingHorizontal: 20, paddingTop: 16 },
  // Searchbar: margin ngang 20, trên 18, bo góc 22, nền SURFACE, viền BORDER
  searchBar: { height: 48, marginHorizontal: 20, marginTop: 16, borderRadius: RADIUS.button, backgroundColor: COLORS.SURFACE, borderWidth: 1, borderColor: COLORS.BORDER, elevation: 0 },
  searchInput: { fontSize: 16, color: COLORS.TEXT_PRIMARY },
  // Hàng tabs section
  tabGroup: { minHeight: 60, marginTop: 12, paddingHorizontal: 20, paddingBottom: 8, gap: 8, alignItems: "stretch", flexDirection: "row" },
  tabButton: { flex: 1, minHeight: 40, paddingHorizontal: 6, borderRadius: RADIUS.chip, borderWidth: 1, borderColor: COLORS.BORDER, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.SURFACE },
  tabButtonActive: { backgroundColor: COLORS.PURE_BLACK, borderColor: COLORS.PURE_BLACK },
  tabLabel: { fontSize: 13, fontWeight: "600", color: COLORS.TEXT_SECONDARY },
  tabLabelCompact: { fontSize: 11, lineHeight: 14 },
  tabLabelActive: { color: COLORS.PURE_WHITE },
  // Nội dung danh sách
  listContent: { paddingHorizontal: 12, paddingBottom: 32, paddingTop: 8 },
  listColumn: { justifyContent: "space-between" },
  // Empty state
  emptyState: { marginTop: 64, marginHorizontal: 20 },
});

export default Equip;
