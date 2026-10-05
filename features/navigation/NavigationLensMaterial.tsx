import { useId } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { GLASS_MATERIAL, GLASS_NAV_OPTICS, GLASS_SVG_OPACITY, GLASS_TAB_BAR } from "~/constants/DesignSystem";
import { getNavigationOptics } from "./navigation-optics";

/** Specular layer sits below sharp glyphs/text inside the existing lens clip. */
export function NavigationLensMaterial({ progress, reduceMotion }: {
  progress: SharedValue<number>; reduceMotion: boolean;
}) {
  const gradientId = `navigation-lens-shine-${useId().replace(/:/g, "")}`;
  const leftStyle = useAnimatedStyle(() => ({ opacity: getNavigationOptics(progress.value, 0, reduceMotion).leftOpacity }));
  const rightStyle = useAnimatedStyle(() => ({ opacity: getNavigationOptics(progress.value, 0, reduceMotion).rightOpacity }));
  return <View testID="navigation-lens-optics" pointerEvents="none" accessible={false}
    accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
    <Svg width="100%" height="100%" accessible={false}>
      <Defs>
        <LinearGradient id={gradientId} x1="50%" y1="0%" x2="50%" y2="100%">
          <Stop offset="0" stopColor={GLASS_MATERIAL.highlight} stopOpacity={GLASS_SVG_OPACITY.highlight} />
          <Stop offset="0.5" stopColor={GLASS_MATERIAL.highlightSoft} stopOpacity={GLASS_SVG_OPACITY.highlightSoft} />
          <Stop offset="1" stopColor={GLASS_MATERIAL.clear} stopOpacity={GLASS_SVG_OPACITY.clear} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
    </Svg>
    <View style={styles.innerRim} />
    <Animated.View testID="navigation-lens-fringe-left" style={[styles.edge, styles.leftEdge, leftStyle]} />
    <Animated.View testID="navigation-lens-fringe-right" style={[styles.edge, styles.rightEdge, rightStyle]} />
  </View>;
}

const styles = StyleSheet.create({
  innerRim: { ...StyleSheet.absoluteFill, margin: 1, borderRadius: GLASS_TAB_BAR.lensRadius,
    borderWidth: 0, borderColor: GLASS_MATERIAL.clear },
  edge: { ...StyleSheet.absoluteFill, margin: 1, borderRadius: GLASS_TAB_BAR.lensRadius,
    borderWidth: GLASS_NAV_OPTICS.fringeWidth, borderColor: GLASS_MATERIAL.clear },
  leftEdge: { borderLeftColor: GLASS_NAV_OPTICS.fringeLeft },
  rightEdge: { borderRightColor: GLASS_NAV_OPTICS.fringeRight },
});
