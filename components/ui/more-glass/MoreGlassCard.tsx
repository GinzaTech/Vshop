import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle, type ViewProps } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { COLORS, MORE_GLASS_MATERIAL } from "~/constants/DesignSystem";
import { MoreGlassContext } from "./more-glass-context";

export type MoreGlassCardProps = ViewProps & {
  index: number;
  contentStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};
export const MoreGlassRim = React.memo(function MoreGlassRim({ radius = MORE_GLASS_MATERIAL.radius }: { radius?: number }) {
  const id = React.useId().replace(/:/g, "");
  return <Svg width="100%" height="100%" aria-hidden>
    <Defs><LinearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
      <Stop offset="0" stopColor={MORE_GLASS_MATERIAL.highlight} stopOpacity={0.95} />
      <Stop offset="0.45" stopColor={MORE_GLASS_MATERIAL.highlight} stopOpacity={0.25} />
      <Stop offset="1" stopColor={MORE_GLASS_MATERIAL.silver} stopOpacity={0.25} />
    </LinearGradient></Defs>
    <Rect x="0.5" y="0.5" width="99%" height="99%" rx={radius} fill="none" stroke={`url(#${id})`} strokeWidth="1" />
  </Svg>;
});
export function MoreGlassCard({ index, children, style, contentStyle, ...props }: MoreGlassCardProps) {
  const mode = React.useContext(MoreGlassContext);
  return <View {...props} style={[styles.card, style, {
    borderRadius: MORE_GLASS_MATERIAL.radius,
    backgroundColor: mode === "opaque" ? COLORS.SURFACE : mode === "gpu" ? "transparent" : MORE_GLASS_MATERIAL.tint,
  }]} nativeID={`more-glass-${index}`}>
    <View pointerEvents="none" accessible={false} accessibilityElementsHidden collapsable={false}
      importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { opacity: mode === "fallback" ? 1 : 0 }]}>
      <MoreGlassRim />
    </View>
    <View style={[styles.content, contentStyle]}>{children}</View>
  </View>;
}

const styles = StyleSheet.create({
  card: { minHeight: 112, overflow: "hidden", shadowOpacity: 0, shadowRadius: 0, elevation: 0, boxShadow: "none" },
  content: { padding: 14, flexShrink: 1 },
});
