// Stable scene content: opacity belongs to the retained navigation host;
// exactly one committed scene is opaque; focus gates touch/accessibility.
import { useContext, type ReactNode } from "react";
import { useIsFocused } from "expo-router";
import { StyleSheet } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { COLORS } from "~/constants/DesignSystem";
import { AppSceneLanguageBoundary } from "~/components/AppSceneLanguageBoundary";
import { NavigationSceneContext } from "~/features/navigation/NavigationSceneContext";
import { PRIMARY_ROUTE_ORDER, type PrimaryRouteName } from "~/features/navigation/navigation-model";

/**
 * PrimaryTabScene – Container giữ nguyên nội dung khi chuyển tab.
 * - focused = true: touch and accessibility belong to the latest route.
 * - focused = false: retained content stays invisible and cannot receive input.
 *
 * @param children – React node nội dung của tab scene.
 * @returns View full màn hình (nền BACKGROUND) bọc nội dung tab.
 */
export default function PrimaryTabScene({ children, routeName }: { children: ReactNode; routeName?: PrimaryRouteName }) {
  // focused: tab hiện tại có đang hiển thị không (expo-router useIsFocused)
  const focused = useIsFocused();
  const transition = useContext(NavigationSceneContext);
  const index = routeName ? PRIMARY_ROUTE_ORDER.indexOf(routeName) : -1;
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: transition && index >= 0 ? transition.weights.value[index] : focused ? 1 : 0,
  }));
  return (
    <Animated.View
      // collapsable=false: đảm bảo View không bị native flatten để style luôn áp dụng
      collapsable={false}
      pointerEvents={focused ? "auto" : "none"}
      accessibilityElementsHidden={!focused}
      importantForAccessibility={focused ? "auto" : "no-hide-descendants"}
      style={[styles.scene, animatedStyle]}
    >
      <AppSceneLanguageBoundary active={focused}>{children}</AppSceneLanguageBoundary>
    </Animated.View>
  );
}

// styles:
//   scene  – flex 1, nền BACKGROUND đồng bộ với app
const styles = StyleSheet.create({
  scene: { flex: 1, backgroundColor: COLORS.BACKGROUND },
});
