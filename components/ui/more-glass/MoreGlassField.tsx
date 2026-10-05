import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { MORE_GLASS_MATERIAL } from "~/constants/DesignSystem";

/** Backing plane for unsupported/compiling GPU paths. No text/image capture. */
export function MoreGlassField() {
  const id = React.useId().replace(/:/g, "");
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
    <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      <Defs><LinearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0" stopColor={MORE_GLASS_MATERIAL.background} />
        <Stop offset="0.48" stopColor={MORE_GLASS_MATERIAL.silver} stopOpacity={0.25} />
        <Stop offset="1" stopColor={MORE_GLASS_MATERIAL.background} />
      </LinearGradient></Defs>
      <Rect width="100" height="100" fill={MORE_GLASS_MATERIAL.background} />
      <Path d="M-20 -15 C60 8 28 42 120 70 L120 105 C15 82 50 36 -20 25 Z" fill={`url(#${id})`} />
      <Path d="M-20 15 C55 24 35 49 120 85" fill="none" stroke={MORE_GLASS_MATERIAL.highlight} strokeOpacity={0.35} strokeWidth="4" />
    </Svg>
  </View>;
}
