import React from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Searchbar } from "react-native-paper";

import GalleryEquip from "~/components/GalleryEquip";
import { useFeatureStore } from "~/hooks/useFeatureStore";
import {
  EQUIPMENT_SECTIONS,
  getCollectionBySection,
  filterEquipItems,
  sortEquipItems,
  buildEquipDisplayList,
} from "~/components/popups/equipHelpers";
import { COLORS, RADIUS } from "~/constants/DesignSystem";

const Equip = () => {
  const { screenshotModeEnabled } = useFeatureStore();
  const [activeSection, setActiveSection] = React.useState(
    EQUIPMENT_SECTIONS[0].key
  );
  const [searchQuery, setSearchQuery] = React.useState("");

  const data = React.useMemo(() => {
    const collection = getCollectionBySection(activeSection);
    const filtered = filterEquipItems(collection, searchQuery);
    const sorted = sortEquipItems(filtered);
    return buildEquipDisplayList(sorted, activeSection);
  }, [activeSection, searchQuery]);

  const renderEquipItem = React.useCallback(
    ({ item }: { item: any }) => (
      <GalleryEquip data={item} screenshotModeEnabled={screenshotModeEnabled} />
    ),
    [screenshotModeEnabled]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Equipment collection</Text>
        <Text style={styles.subtitle}>
          Buddies, sprays, cards and titles in one place.
        </Text>
      </View>

      <Searchbar
        placeholder="Search equipment"
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.searchBar}
        inputStyle={styles.searchInput}
        iconColor={COLORS.TEXT_SECONDARY}
      />

      <View style={styles.tabGroup}>
        {EQUIPMENT_SECTIONS.map((section, index) => {
          const isActive = section.key === activeSection;
          return (
            <TouchableOpacity
              key={section.key}
              style={[
                styles.tabButton,
                isActive && styles.tabButtonActive,
                index === EQUIPMENT_SECTIONS.length - 1 && { marginRight: 0 },
              ]}
              onPress={() => setActiveSection(section.key)}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.tabLabel,
                  isActive && styles.tabLabelActive,
                ]}
              >
                {section.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={data}
        keyExtractor={(item: { id: string }) => item.id}
        renderItem={renderEquipItem}
        numColumns={2}
        columnWrapperStyle={styles.listColumn}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No equipment found</Text>
            <Text style={styles.emptySubtitle}>
              Try a different search term or category.
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
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
    marginTop: 18,
    borderRadius: 22,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    elevation: 0,
  },
  searchInput: {
    fontSize: 16,
    color: COLORS.TEXT_PRIMARY,
  },
  tabGroup: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.chip,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    backgroundColor: COLORS.SURFACE,
  },
  tabButtonActive: {
    backgroundColor: COLORS.PURE_BLACK,
    borderColor: COLORS.PURE_BLACK,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.TEXT_SECONDARY,
  },
  tabLabelActive: {
    color: COLORS.PURE_WHITE,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 40,
    paddingTop: 16,
  },
  listColumn: {
    justifyContent: "space-between",
  },
  emptyState: {
    marginTop: 64,
    marginHorizontal: 20,
    paddingHorizontal: 32,
    paddingVertical: 24,
    alignItems: "center",
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    color: COLORS.TEXT_PRIMARY,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 4,
    color: COLORS.TEXT_SECONDARY,
  },
});

export default Equip;
