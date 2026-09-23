// ===== MatchDetailTabs.tsx =====
// Thanh tab màn chi tiết trận: chuyển giữa "Scoreboard" và "Performance".
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import {
  MATCH_COLORS,
  MATCH_LAYOUT,
} from "~/constants/MatchTheme";

/**
 * MatchDetailTab – Hai tab khả dụng: bảng tổng quan hoặc hiệu suất chi tiết.
 */
export type MatchDetailTab = "scoreboard" | "performance";

/**
 * MatchDetailTabsProps – Props của MatchDetailTabs.
 *
 * @param activeTab – Tab đang được chọn.
 * @param onChange – Callback khi người dùng chọn tab khác.
 */
type MatchDetailTabsProps = {
  activeTab: MatchDetailTab;
  onChange: (tab: MatchDetailTab) => void;
};

/**
 * MatchDetailTabs – Tab bar dạng tablist với indicator gạch chân tab active.
 * Thuần presentational, không side effect.
 *
 * @param activeTab – Tab đang active.
 * @param onChange – Callback đổi tab.
 * @returns View tablist chứa 2 nút tab.
 */
export function MatchDetailTabs({
  activeTab,
  onChange,
}: MatchDetailTabsProps) {
  const { t } = useTranslation();
  const tabs: { id: MatchDetailTab; label: string }[] = [
    { id: "scoreboard", label: t("match_ui.tabs.scoreboard") },
    { id: "performance", label: t("match_ui.tabs.performance") },
  ];

  return (
    <View
      accessibilityRole="tablist"
      testID="match-detail-tabs"
      style={styles.tabs}
    >
      {tabs.map((tab) => {
        const selected = tab.id === activeTab;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected }}
            testID={`match-detail-tab-${tab.id}`}
            onPress={() => onChange(tab.id)}
            style={({ pressed }) => [
              styles.tab,
              pressed && styles.tabPressed,
            ]}
          >
            <Text style={[styles.label, selected && styles.selectedLabel]}>
              {tab.label}
            </Text>
            <View style={[styles.indicator, selected && styles.selectedIndicator]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    height: 52,
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: MATCH_COLORS.border,
    backgroundColor: MATCH_COLORS.appBackground,
  },
  tab: {
    flex: 1,
    minHeight: MATCH_LAYOUT.minTouchTarget,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  tabPressed: {
    backgroundColor: MATCH_COLORS.pressed,
  },
  label: {
    paddingBottom: 11,
    color: MATCH_COLORS.textMuted,
    fontSize: 14,
    fontWeight: "700",
  },
  selectedLabel: {
    color: MATCH_COLORS.textPrimary,
  },
  indicator: {
    width: "76%",
    height: 3,
    backgroundColor: "transparent",
  },
  selectedIndicator: {
    backgroundColor: MATCH_COLORS.tabIndicator,
  },
});
