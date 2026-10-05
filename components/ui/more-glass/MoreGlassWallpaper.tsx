import React from "react";
import { StyleSheet, View } from "react-native";
import { COLORS } from "~/constants/DesignSystem";

// Neutral sampling texture keeps the existing glass renderer contract without
// displaying the retired decorative artwork anywhere behind page contents.
export const MORE_WHITE_WALLPAPER = require("~/assets/generated/production/more-neutral-gray.png") as number;
export function MoreGlassWallpaper(_props: { source?: number | string }) {
  return <View testID="more-neutral-background" style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.BACKGROUND }]}
    pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
  </View>;
}
