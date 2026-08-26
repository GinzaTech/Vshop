// ===== Import thư viện =====
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import Icon from "@expo/vector-icons/MaterialCommunityIcons";
import { useTranslation } from "react-i18next";

import GlassCard from "~/components/ui/GlassCard";
import { COLORS, RADIUS } from "~/constants/DesignSystem";
import { CROSSHAIR_DB, type CrosshairData } from "~/constants/CrosshairData";
import AppRefreshControl from "~/components/ui/AppRefreshControl";
import { useAsyncRefresh } from "~/hooks/useAsyncRefresh";
import { fullBackgroundSync } from "~/utils/app-sync";

// CrosshairRender: component vẽ crosshair dựa trên style (type, color, thickness, gap)
// Hỗ trợ 4 kiểu: cross, dot, box, circle
const CrosshairRender = ({ style }: { style: CrosshairData["style"] }) => {
  const { type, color, thickness = 2, gap = 2 } = style;
  const tickStyle = { backgroundColor: color, position: "absolute" as const };
  // center: style căn giữa cho container 40x40
  const center = { justifyContent: "center" as const, alignItems: "center" as const, width: 40, height: 40 };

  // Kiểu dot: hình tròn đặc với đường kính = thickness * 2
  if (type === "dot") {
    return (<View style={center}><View style={{ width: thickness * 2, height: thickness * 2, borderRadius: thickness, backgroundColor: color }} /></View>);
  }

  // Kiểu box: hình vuông rỗng (viền)
  if (type === "box") {
    return (<View style={center}><View style={{ width: 10, height: 10, borderWidth: thickness, borderColor: color, backgroundColor: "transparent" }} /></View>);
  }

  // Kiểu circle: hình tròn rỗng + chấm trung tâm
  if (type === "circle") {
    return (
      <View style={center}>
        <View style={{ width: 20, height: 20, borderWidth: 2, borderColor: color, borderRadius: 10 }} />
        <View style={{ width: 4, height: 4, backgroundColor: color, borderRadius: 2, position: "absolute" }} />
      </View>
    );
  }

  // Kiểu cross (mặc định): 4 thanh (trên, dưới, trái, phải) với gap ở giữa
  const length = 10;
  const offset = gap + length / 2;
  return (
    <View style={center}>
      <View style={[tickStyle, { width: thickness, height: length, top: 20 - offset - length / 2 }]} />
      <View style={[tickStyle, { width: thickness, height: length, bottom: 20 - offset - length / 2 }]} />
      <View style={[tickStyle, { height: thickness, width: length, left: 20 - offset - length / 2 }]} />
      <View style={[tickStyle, { height: thickness, width: length, right: 20 - offset - length / 2 }]} />
    </View>
  );
};

// Component CrosshairDatabase: database crosshair với preview, tìm kiếm, lọc theo category
export default function CrosshairDatabase() {
  const { t } = useTranslation();
  // State quản lý
  const [selected, setSelected] = useState<CrosshairData>(CROSSHAIR_DB[0]); // Crosshair đang được chọn (preview)
  const [search, setSearch] = useState("");                                  // Từ khóa tìm kiếm
  const [activeCategory, setActiveCategory] = useState<string>("All");       // Category đang lọc
  const [copiedName, setCopiedName] = useState<string | null>(null);         // Tên crosshair vừa copy (hiển thị badge)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshApp = React.useCallback(() => fullBackgroundSync(true), []);
  const { refreshing, onRefresh } = useAsyncRefresh(refreshApp);

  useEffect(
    () => () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    },
    [],
  );

  // categories: danh sách category để lọc
  const categories: { value: string; label: string }[] = [
    { value: "All", label: t("crosshair_page.categories.all") },
    { value: "Pro", label: t("crosshair_page.categories.pro") },
    { value: "Content", label: t("crosshair_page.categories.content") },
    { value: "Fun", label: t("crosshair_page.categories.fun") },
  ];

  // filteredData: danh sách crosshair đã lọc theo search + category (memoized)
  const filteredData = useMemo(() => {
    return CROSSHAIR_DB.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || item.team.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = activeCategory === "All" || item.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [activeCategory, search]);

  // handlePress: khi nhấn vào crosshair → chọn để preview, nếu đã chọn rồi thì copy code
  const handlePress = async (item: CrosshairData) => {
    if (selected.name === item.name) {
      await Clipboard.setStringAsync(item.code);
      setCopiedName(item.name);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => {
        copiedTimerRef.current = null;
        setCopiedName(null);
      }, 2000);
      return;
    }
    setSelected(item);
  };

  return (
    <View style={styles.container}>
      {/* Preview header: hiển thị crosshair đang chọn lớn + tên/team */}
      <View style={styles.previewHeader}>
        <View style={styles.previewContent}>
          <View style={styles.crosshairTarget}><CrosshairRender style={selected.style} /></View>
          <View style={styles.previewInfo}>
            <Text style={styles.previewName}>{selected.name}</Text>
            <Text style={styles.previewTeam}>{selected.team} - {selected.category}</Text>
          </View>
        </View>
      </View>

      {/* Body: search bar + tabs + danh sách crosshair */}
      <View style={styles.bodyContent}>
        {/* Toolbar: search + tabs */}
        <View style={styles.toolbar}>
          <View style={styles.searchBar}>
            <Icon name="magnify" size={20} color={COLORS.TEXT_SECONDARY} />
            <TextInput style={styles.input} placeholder={t("crosshair_page.search_placeholder")}
              placeholderTextColor={COLORS.TEXT_SECONDARY} value={search} onChangeText={setSearch} />
          </View>
          <View style={styles.tabs}>
            {categories.map((category) => (
              <TouchableOpacity key={category.value} onPress={() => setActiveCategory(category.value)}
                style={[styles.tab, activeCategory === category.value && styles.tabActive]}>
                <Text style={[styles.tabText, activeCategory === category.value && styles.tabTextActive]}>{category.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Danh sách crosshair dạng lưới 2 cột */}
        <FlatList
          data={filteredData}
          keyExtractor={(item) => item.name}
          renderItem={({ item }) => {
            const isSelected = selected.name === item.name;
            const isCopied = copiedName === item.name;
            return (
              <TouchableOpacity style={styles.cardContainer} activeOpacity={0.85} onPress={() => handlePress(item)}>
                <GlassCard style={[styles.card, isSelected && styles.cardSelected]}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardName}>{item.name}</Text>
                    <Text style={[styles.cardTeam, { color: isSelected ? COLORS.PURE_BLACK : COLORS.TEXT_SECONDARY }]}>{item.team}</Text>
                  </View>
                  <View style={styles.miniPreview}>
                    <CrosshairRender style={{ ...item.style, color: isSelected ? item.style.color : "#9b958d" }} />
                  </View>
                  {isCopied ? (
                    <View style={styles.copiedBadge}><Text style={styles.copiedText}>{t("crosshair_page.copied")}</Text></View>
                  ) : (
                    <View style={styles.cardFooter}><Icon name="crosshairs" size={14} color={COLORS.TEXT_SECONDARY} /></View>
                  )}
                </GlassCard>
              </TouchableOpacity>
            );
          }}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          alwaysBounceVertical
          showsVerticalScrollIndicator={false}
        />
      </View>
    </View>
  );
}

// ===== StyleSheet =====
const styles = StyleSheet.create({
  // Container chính: nền tối
  container: { flex: 1, backgroundColor: COLORS.BACKGROUND },
  // Preview header: hiển thị crosshair lớn + thông tin
  previewHeader: { marginHorizontal: 16, marginTop: 16, marginBottom: 8, borderRadius: RADIUS.card, backgroundColor: COLORS.SURFACE, borderWidth: 1, borderColor: COLORS.BORDER, minHeight: 200, justifyContent: "center", alignItems: "center" },
  previewContent: { alignItems: "center", gap: 12 },
  // Vòng tròn nền cho preview crosshair
  crosshairTarget: { width: 84, height: 84, borderRadius: 42, backgroundColor: COLORS.SURFACE_MUTED, borderWidth: 1, borderColor: COLORS.BORDER, justifyContent: "center", alignItems: "center" },
  previewInfo: { alignItems: "center" },
  previewName: { fontSize: 24, fontWeight: "700", color: COLORS.TEXT_PRIMARY },
  previewTeam: { color: COLORS.TEXT_SECONDARY, fontWeight: "600", fontSize: 14, marginTop: 2 },
  // Body: phần còn lại của màn hình
  bodyContent: { flex: 1 },
  // Toolbar: search + tabs
  toolbar: { padding: 16, paddingBottom: 8 },
  // Search bar
  searchBar: { flexDirection: "row", backgroundColor: COLORS.SURFACE, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, alignItems: "center", marginBottom: 12, borderWidth: 1, borderColor: COLORS.BORDER },
  input: { marginLeft: 10, color: COLORS.TEXT_PRIMARY, flex: 1, fontSize: 14 },
  // Hàng tabs category
  tabs: { flexDirection: "row", gap: 10 },
  tab: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: RADIUS.chip, backgroundColor: COLORS.SURFACE, borderWidth: 1, borderColor: COLORS.BORDER },
  tabActive: { backgroundColor: COLORS.PURE_BLACK, borderColor: COLORS.PURE_BLACK },
  tabText: { color: COLORS.TEXT_SECONDARY, fontSize: 12, fontWeight: "600" },
  tabTextActive: { color: COLORS.PURE_WHITE },
  // Danh sách lưới
  listContainer: { padding: 16, paddingTop: 8, paddingBottom: 36 },
  columnWrapper: { justifyContent: "space-between" },
  // Card crosshair
  cardContainer: { width: "48%", marginBottom: 12 },
  card: { height: 110, justifyContent: "space-between" },
  cardSelected: { borderColor: COLORS.PURE_BLACK },
  // Header card: tên + team
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardName: { color: COLORS.TEXT_PRIMARY, fontWeight: "700", fontSize: 15 },
  cardTeam: { fontSize: 10, fontWeight: "700" },
  // Mini preview trong card
  miniPreview: { alignItems: "center", justifyContent: "center", flex: 1, marginVertical: 4 },
  cardFooter: { alignItems: "flex-end" },
  // Badge "Copied!" khi copy thành công
  copiedBadge: { position: "absolute", bottom: 10, right: 10, backgroundColor: COLORS.PURE_BLACK, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  copiedText: { color: COLORS.PURE_WHITE, fontSize: 10, fontWeight: "700" },
});
