// ===== ProfileSegmentedControl.tsx – Thanh segment dùng chung của Profile =====
// Hai lớp segment chồng nhau: tab chính (loadout/skins/collection) và tab
// dashboard stats (overview/details). Chỉ nền/chuyển động điều khiển từ
// ProfileScreen (animated styles); component này thuần hiển thị.

import React from "react";
import { type LayoutChangeEvent, TouchableOpacity, View } from "react-native";
import Animated from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import { COLORS } from "~/constants/DesignSystem";
import { styles } from "~/features/profile/profile-screen.styles";
import type { TabKey } from "~/components/GalleryProfile";
import {
  type ProfileDashboardTab,
  useProfileDashboardTabStore,
} from "~/features/profile/useProfileDashboardTabStore";

type AnimatedViewStyle = React.ComponentProps<typeof Animated.View>["style"];
type AnimatedTextStyle = React.ComponentProps<typeof Animated.Text>["style"];

/**
 * ProfileSegmentedControlProps – Props của thanh segment.
 * @param {TabKey} activeTab - Tab chính đang chọn (loadout/skins/collection).
 * @param {AnimatedTextStyle} collectionSegmentLabelAnimatedStyle - Màu nhãn tab collection.
 * @param {Function} handleSegmentContainerLayout - Ghi lại width container (đo indicator).
 * @param {Function} handleStatsDashboardTabChange - Đổi tab dashboard stats.
 * @param {Function} handleTabChange - Đổi tab chính (scroll pager).
 * @param {AnimatedTextStyle} loadoutSegmentLabelAnimatedStyle - Màu nhãn tab loadout.
 * @param {"profile"|"stats"} profileNavContentMode - Lớp segment nào đang tương tác.
 * @param {AnimatedViewStyle} profileSegmentLayerAnimatedStyle - Opacity/motion lớp profile.
 * @param {AnimatedViewStyle} segmentIndicatorAnimatedStyle - Vị trí/width indicator chạy.
 * @param {AnimatedTextStyle} skinsSegmentLabelAnimatedStyle - Màu nhãn tab skins.
 * @param {AnimatedViewStyle} statsSegmentLayerAnimatedStyle - Opacity/motion lớp stats.
 * @param {{value: TabKey; label: string}[]} tabItems - Danh sách tab chính + nhãn.
 */
interface ProfileSegmentedControlProps {
  activeTab: TabKey;
  collectionSegmentLabelAnimatedStyle: AnimatedTextStyle;
  handleSegmentContainerLayout: (event: LayoutChangeEvent) => void;
  handleStatsDashboardTabChange: (tab: ProfileDashboardTab) => void;
  handleTabChange: (tab: TabKey) => void;
  loadoutSegmentLabelAnimatedStyle: AnimatedTextStyle;
  profileNavContentMode: "profile" | "stats";
  profileSegmentLayerAnimatedStyle: AnimatedViewStyle;
  segmentIndicatorAnimatedStyle: AnimatedViewStyle;
  skinsSegmentLabelAnimatedStyle: AnimatedTextStyle;
  statsSegmentLayerAnimatedStyle: AnimatedViewStyle;
  tabItems: { value: TabKey; label: string }[];
}

export function ProfileSegmentedControl({
  activeTab,
  collectionSegmentLabelAnimatedStyle,
  handleSegmentContainerLayout,
  handleStatsDashboardTabChange,
  handleTabChange,
  loadoutSegmentLabelAnimatedStyle,
  profileNavContentMode,
  profileSegmentLayerAnimatedStyle,
  segmentIndicatorAnimatedStyle,
  skinsSegmentLabelAnimatedStyle,
  statsSegmentLayerAnimatedStyle,
  tabItems,
}: ProfileSegmentedControlProps) {
  const { t } = useTranslation();
  const statsDashboardTab = useProfileDashboardTabStore(
    (state) => state.activeTab
  );

  return (
      <View
          onLayout={handleSegmentContainerLayout}
          style={[
            styles.segmentContainer,
            { backgroundColor: COLORS.PURE_BLACK },
          ]}
      >
        <Animated.View
            pointerEvents="none"
            style={[
              styles.segmentIndicator,
              segmentIndicatorAnimatedStyle,
            ]}
        />
        <Animated.View
            accessibilityLabel={t("profile_page.stats.navigation")}
            accessibilityRole="tablist"
            pointerEvents={profileNavContentMode === "profile" ? "auto" : "none"}
            accessibilityElementsHidden={profileNavContentMode !== "profile"}
            importantForAccessibility={
              profileNavContentMode === "profile"
                  ? "auto"
                  : "no-hide-descendants"
            }
            style={[styles.segmentLayer, profileSegmentLayerAnimatedStyle]}
        >
          {tabItems.map((tab, index) => {
            const active = activeTab === tab.value;
            return (
                <TouchableOpacity
                    key={tab.value}
                    testID={`profile-tab-${tab.value}`}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    onPress={() => handleTabChange(tab.value)}
                    activeOpacity={0.85}
                    style={[
                      styles.segmentButton,
                      { marginLeft: index === 0 ? 0 : 8 },
                    ]}
                >
                  <Animated.Text
                      style={[
                        styles.segmentLabel,
                        index === 0
                            ? loadoutSegmentLabelAnimatedStyle
                            : index === 1
                              ? skinsSegmentLabelAnimatedStyle
                              : collectionSegmentLabelAnimatedStyle,
                      ]}
                  >
                    {tab.label}
                  </Animated.Text>
                </TouchableOpacity>
            );
          })}
        </Animated.View>
        <Animated.View
            accessibilityLabel={t("profile_page.stats.navigation")}
            accessibilityRole="tablist"
            pointerEvents={profileNavContentMode === "stats" ? "auto" : "none"}
            accessibilityElementsHidden={profileNavContentMode !== "stats"}
            importantForAccessibility={
              profileNavContentMode === "stats"
                  ? "auto"
                  : "no-hide-descendants"
            }
            style={[styles.segmentLayer, statsSegmentLayerAnimatedStyle]}
        >
          {(["overview", "details"] as ProfileDashboardTab[]).map((tab, index) => {
            const active = statsDashboardTab === tab;
            return (
                <TouchableOpacity
                    key={tab}
                    testID={`profile-stats-tab-${tab}`}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    onPress={() => handleStatsDashboardTabChange(tab)}
                    activeOpacity={0.85}
                    style={[
                      styles.segmentButton,
                      { marginLeft: index === 0 ? 0 : 8 },
                    ]}
                >
                  <Animated.Text
                      style={[
                        styles.segmentLabel,
                        {
                          color: active
                            ? COLORS.TEXT_PRIMARY
                            : COLORS.ON_DARK_TEXT,
                        },
                      ]}
                  >
                    {tab === "overview"
                      ? t("profile_page.stats.overview")
                      : t("profile_page.stats.details")}
                  </Animated.Text>
                </TouchableOpacity>
            );
          })}
        </Animated.View>
      </View>
  );
}
