import { useId, type RefObject } from "react";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { GLASS_NAV_OPTICS, GLASS_TAB_BAR, NAV_GLASS_MATERIAL } from "~/constants/DesignSystem";
import { useNativeGlassPreferences } from "~/components/ui/liquid-glass-native-policy";

export type NavigationBlurTarget = RefObject<View | null>;

export function supportsNavigationBlur() {
  return Platform.OS === "ios" || (Platform.OS === "android" && Number(Platform.Version) >= 31);
}

/** One static, capsule-sized blur of the page-only target; never blur the bar itself. */
export function NavigationBarBackdrop({ blurTarget, enabled = true }: { blurTarget?: NavigationBlurTarget; enabled?: boolean }) {
  const reflectionId = useId().replace(/:/g, "");
  const eligible = enabled && !NAV_GLASS_MATERIAL.opaque && supportsNavigationBlur();
  const preferences = useNativeGlassPreferences(eligible);
  const blur = eligible && !preferences.reduceTransparency && blurTarget?.current != null;
  return <>
    {blur ? <BlurView testID="primary-tab-backdrop-blur" blurTarget={blurTarget}
      blurMethod="dimezisBlurViewSdk31Plus" intensity={NAV_GLASS_MATERIAL.blurIntensity} tint="systemUltraThinMaterialLight"
      pointerEvents="none" accessible={false} aria-hidden accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill} /> : null}
    <View testID="primary-tab-glass-veil" pointerEvents="none" accessible={false} aria-hidden
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { backgroundColor: blur ? NAV_GLASS_MATERIAL.veil : NAV_GLASS_MATERIAL.fallback }]} />
    <View testID="primary-tab-specular" pointerEvents="none" accessible={false}
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, styles.reflectionInset]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <Defs><LinearGradient id={reflectionId} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0" stopColor="white" stopOpacity={0.24} />
          <Stop offset="0.6" stopColor="white" stopOpacity={0.025} />
          <Stop offset="1" stopColor="white" stopOpacity={0} />
        </LinearGradient></Defs>
        <Path d="M0 0 H100 V12 C64 3 33 24 0 31 Z" fill={`url(#${reflectionId})`} />
      </Svg>
    </View>
    <View pointerEvents="none" accessible={false} aria-hidden accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants" style={styles.rim} />
    <View testID="primary-tab-inner-separator" pointerEvents="none" accessible={false} aria-hidden
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.separator} />
  </>;
}

const styles = StyleSheet.create({
  rim: { ...StyleSheet.absoluteFill, margin: 1, borderRadius: GLASS_TAB_BAR.radius,
    borderWidth: 0, borderColor: NAV_GLASS_MATERIAL.border },
  reflectionInset: { marginHorizontal: 3, marginVertical: 2, borderRadius: GLASS_TAB_BAR.radius - 2, overflow: "hidden" },
  separator: { ...StyleSheet.absoluteFill, margin: 2, borderRadius: GLASS_TAB_BAR.radius - 2,
    borderWidth: StyleSheet.hairlineWidth, borderColor: GLASS_NAV_OPTICS.innerSeparator },
});
