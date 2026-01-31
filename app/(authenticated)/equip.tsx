import React from "react";
import { View, TouchableOpacity, Text, FlatList, StyleSheet } from "react-native";
import { Searchbar, useTheme } from "react-native-paper";
import GalleryEquip from "~/components/GalleryEquip";
import { useFeatureStore } from "~/hooks/useFeatureStore";
import {
  EQUIPMENT_SECTIONS,
  getCollectionBySection,
  filterEquipItems,
  sortEquipItems,
  buildEquipDisplayList,
} from "~/components/popups/equipHelpers";

const Equip = () => {
  const { colors } = useTheme();
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

  const keyExtractor = React.useCallback((item: { id: string }) => item.id, []);

  const renderEquipItem = React.useCallback(
    ({ item }: { item: any }) => (
      <GalleryEquip data={item} screenshotModeEnabled={screenshotModeEnabled} />
    ),
    [screenshotModeEnabled]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Searchbar
        placeholder="Search equipment"
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={[styles.searchBar, { backgroundColor: colors.surface }]}
        inputStyle={styles.searchInput}
        iconColor={colors.placeholder}
      />
      <View style={styles.tabGroup}>
        {EQUIPMENT_SECTIONS.map((section, index) => {
          const isActive = section.key === activeSection;
          return (
            <TouchableOpacity
              key={section.key}
              style={[
                styles.tabButton,
                { borderColor: colors.outlineVariant },
                isActive && {
                  backgroundColor: colors.primary,
                  borderColor: colors.primary,
                },
                index === EQUIPMENT_SECTIONS.length - 1 && { marginRight: 0 },
              ]}
              onPress={() => setActiveSection(section.key)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.tabLabel,
                  { color: isActive ? colors.onPrimary : colors.onSurface },
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
        keyExtractor={keyExtractor}
        renderItem={renderEquipItem}
        numColumns={2}
        columnWrapperStyle={styles.listColumn}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
              No equipment found
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.placeholder }]}>
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
  },
  searchBar: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
  },
  searchInput: {
    fontSize: 16,
  },
  tabGroup: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 32,
    paddingTop: 16,
  },
  listColumn: {
    justifyContent: "space-between",
  },
  emptyState: {
    marginTop: 64,
    paddingHorizontal: 32,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 4,
  },
});

export default Equip;