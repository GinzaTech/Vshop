import React from "react";
import { type LayoutChangeEvent, TouchableOpacity, View } from "react-native";
import Animated from "react-native-reanimated";

import TypewriterSwapText from "~/components/profile/TypewriterSwapText";
import { styles } from "~/features/profile/profile-screen.styles";
import type { TabKey } from "~/components/GalleryProfile";
import type { StatsDashboardTab } from "~/components/profile/PlayerStatsDashboard";

type AnimatedViewStyle = React.ComponentProps<typeof Animated.View>["style"];
type AnimatedTextStyle = React.ComponentProps<typeof Animated.Text>["style"];

interface ProfileSegmentedControlProps {
  activeTab: TabKey;
  collectionSegmentLabelAnimatedStyle: AnimatedTextStyle;
  handleSegmentContainerLayout: (event: LayoutChangeEvent) => void;
  handleStatsDashboardTabChange: (tab: StatsDashboardTab) => void;
  handleTabChange: (tab: TabKey) => void;
  loadoutSegmentLabelAnimatedStyle: AnimatedTextStyle;
  profileNavContentMode: "profile" | "blank" | "stats";
  profileSegmentLayerAnimatedStyle: AnimatedViewStyle;
  segmentIndicatorAnimatedStyle: AnimatedViewStyle;
  skinsSegmentLabelAnimatedStyle: AnimatedTextStyle;
  statsDashboardTab: StatsDashboardTab;
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
  statsDashboardTab,
  statsSegmentLayerAnimatedStyle,
  tabItems,
}: ProfileSegmentedControlProps) {
  return (
      <View
          onLayout={handleSegmentContainerLayout}
          style={[
            styles.segmentContainer,
            { backgroundColor: "#11181c" },
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
                  <TypewriterSwapText
                      text={
                        profileNavContentMode === "profile" ? tab.label : ""
                      }
                      showCursor={false}
                      typingSpeed={32}
                      deletingSpeed={20}
                      initialDelay={55}
                      style={[
                        styles.segmentLabel,
                        index === 0
                            ? loadoutSegmentLabelAnimatedStyle
                            : index === 1
                              ? skinsSegmentLabelAnimatedStyle
                              : collectionSegmentLabelAnimatedStyle,
                      ]}
                  />
                </TouchableOpacity>
            );
          })}
        </Animated.View>
        <Animated.View
            pointerEvents={profileNavContentMode === "stats" ? "auto" : "none"}
            accessibilityElementsHidden={profileNavContentMode !== "stats"}
            importantForAccessibility={
              profileNavContentMode === "stats"
                  ? "auto"
                  : "no-hide-descendants"
            }
            style={[styles.segmentLayer, statsSegmentLayerAnimatedStyle]}
        >
          {(["overview", "details"] as StatsDashboardTab[]).map((tab, index) => {
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
                  <TypewriterSwapText
                      text={
                        profileNavContentMode === "stats"
                            ? tab === "overview"
                              ? "OVERVIEW"
                              : "DETAILS"
                            : ""
                      }
                      showCursor={false}
                      typingSpeed={34}
                      deletingSpeed={20}
                      initialDelay={55}
                      style={[
                        styles.segmentLabel,
                        { color: active ? "#11181c" : "rgba(255,255,255,0.6)" },
                      ]}
                  />
                </TouchableOpacity>
            );
          })}
        </Animated.View>
      </View>
  );
}
