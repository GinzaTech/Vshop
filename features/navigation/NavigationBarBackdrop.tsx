import type { RefObject } from "react";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View } from "react-native";
import { GLASS_MATERIAL, GLASS_NAV_OPTICS, GLASS_TAB_BAR } from "~/constants/DesignSystem";

export type NavigationBlurTarget = RefObject<View | null>;

export function supportsNavigationBlur() {
  return Platform.OS === "ios" || (Platform.OS === "android" && Number(Platform.Version) >= 31);
}

/** One static, capsule-sized blur of the page-only target; never blur the bar itself. */
export function NavigationBarBackdrop({ blurTarget }: { blurTarget?: NavigationBlurTarget }) {
  const blur = supportsNavigationBlur() && blurTarget?.current != null;
  return <>
    {blur ? <BlurView testID="primary-tab-backdrop-blur" blurTarget={blurTarget}
      blurMethod="dimezisBlurViewSdk31Plus" intensity={55} tint="light"
      pointerEvents="none" accessible={false} aria-hidden accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill} /> : null}
    <View testID="primary-tab-glass-veil" pointerEvents="none" accessible={false} aria-hidden
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { backgroundColor: blur ? GLASS_MATERIAL.surface : GLASS_MATERIAL.fallback }]} />
    <View pointerEvents="none" accessible={false} aria-hidden accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants" style={styles.rim} />
    <View testID="primary-tab-inner-separator" pointerEvents="none" accessible={false} aria-hidden
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.separator} />
  </>;
}

const styles = StyleSheet.create({
  rim: { ...StyleSheet.absoluteFill, margin: 1, borderRadius: GLASS_TAB_BAR.radius,
    borderWidth: StyleSheet.hairlineWidth, borderColor: GLASS_MATERIAL.innerBorder },
  separator: { ...StyleSheet.absoluteFill, margin: 2, borderRadius: GLASS_TAB_BAR.radius - 2,
    borderWidth: StyleSheet.hairlineWidth, borderColor: GLASS_NAV_OPTICS.innerSeparator },
});
