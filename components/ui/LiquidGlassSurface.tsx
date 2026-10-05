import React, { useId } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { COLORS, GLASS_MATERIAL, GLASS_SVG_OPACITY, RADIUS, SHADOWS } from "~/constants/DesignSystem";

export interface LiquidGlassMaterialProps {
  radius?: number;
  density?: "regular" | "dense";
  tone?: "light" | "dark";
}

/** Static optical treatment for repeated tiles. It transmits the backing color,
 * but does not sample/blur pixels or simulate native refraction. No native blur
 * is mounted here: callers without a real BlurTargetView must use this material.
 * Keep artwork and text above this layer, never behind a blur/highlight wash.
 */
export function LiquidGlassDecoration({ radius = RADIUS.card, density = "regular", tone = "light" }: LiquidGlassMaterialProps) {
  const id = useId().replace(/:/g, "");
  const frostId = `glass-frost-${id}`;
  const shineId = `glass-shine-${id}`;
  return (
    <View pointerEvents="none" accessible={false} accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.clip, { borderRadius: radius }]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none"
        accessible={Platform.OS === "web" ? undefined : false} aria-hidden>
        <Defs>
          <LinearGradient id={frostId} x1="0%" y1="0%" x2="80%" y2="100%">
            <Stop offset="0" stopColor={GLASS_MATERIAL.highlightSoft} stopOpacity={GLASS_SVG_OPACITY.highlightSoft} />
            <Stop offset="0.52" stopColor={GLASS_MATERIAL.clear} stopOpacity={GLASS_SVG_OPACITY.clear} />
            <Stop offset="1" stopColor={tone === "dark" ? GLASS_MATERIAL.shade : GLASS_MATERIAL.frost}
              stopOpacity={(tone === "dark" ? GLASS_SVG_OPACITY.shade : GLASS_SVG_OPACITY.frost) * (density === "dense" ? 0.4 : 0.28)} />
          </LinearGradient>
          <LinearGradient id={shineId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0" stopColor={GLASS_MATERIAL.highlight} stopOpacity={GLASS_SVG_OPACITY.highlight * (tone === "dark" ? 0.2 : 1)} />
            <Stop offset="0.45" stopColor={GLASS_MATERIAL.highlightSoft} stopOpacity={GLASS_SVG_OPACITY.highlightSoft} />
            <Stop offset="1" stopColor={GLASS_MATERIAL.clear} stopOpacity={GLASS_SVG_OPACITY.clear} />
          </LinearGradient>
        </Defs>
        <Rect width="100" height="100" fill={`url(#${frostId})`} />
        <Path d="M0 0H100V7C66 2 32 28 0 36Z" fill={`url(#${shineId})`} />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.rim, { borderRadius: radius, borderColor: tone === "dark" ? COLORS.ON_DARK_BORDER : GLASS_MATERIAL.innerBorder }]} />
      <View style={[styles.topRim, { borderTopLeftRadius: radius, borderTopRightRadius: radius, borderColor: tone === "dark" ? COLORS.ON_DARK_BORDER : GLASS_MATERIAL.border }]} />
    </View>
  );
}

export const LIQUID_GLASS_CARD_STYLE: ViewStyle = {
  backgroundColor: GLASS_MATERIAL.surface,
  borderColor: GLASS_MATERIAL.border,
  borderWidth: 1,
  ...SHADOWS.xs,
};

/** Repeated cards that require a crisp single outline, without optical halos. */
export const FLAT_CARD_STYLE: ViewStyle = {
  backgroundColor: COLORS.SURFACE,
  borderColor: COLORS.BORDER,
  borderWidth: 1,
  shadowOpacity: 0,
  shadowRadius: 0,
  shadowOffset: { width: 0, height: 0 },
  elevation: 0,
  boxShadow: "none",
};

/** Lightweight glass for chips/segment tabs: translucent white + inner rim.
 * Không gắn SVG decoration từng chip (danh sách dài) — nền xuyên nhẹ qua
 * màu page để đọc là kính, state active vẫn ghi đè bằng style sau trong mảng. */
export const LIQUID_GLASS_CHIP_STYLE: ViewStyle = {
  backgroundColor: GLASS_MATERIAL.chipSurface,
  borderColor: GLASS_MATERIAL.innerBorder,
  borderWidth: 1,
};

export interface LiquidGlassSurfaceProps extends ViewProps, LiquidGlassMaterialProps {
  contentStyle?: StyleProp<ViewStyle>;
}

/** Neutral presentation container. View props stay on the outer surface. */
export default function LiquidGlassSurface({ children, style, contentStyle, radius = RADIUS.card,
  density = "regular", tone = "light", ...props }: LiquidGlassSurfaceProps) {
  return (
    <View {...props} style={[LIQUID_GLASS_CARD_STYLE, { borderRadius: radius,
      backgroundColor: tone === "dark" ? COLORS.ACCENT_DEEP : density === "dense" ? GLASS_MATERIAL.denseSurface : GLASS_MATERIAL.surface }, style]}>
      <LiquidGlassDecoration radius={radius} density={density} tone={tone} />
      <View style={contentStyle}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden" },
  rim: { margin: 1, borderWidth: StyleSheet.hairlineWidth },
  topRim: { position: "absolute", top: 0, left: 0, right: 0, height: 18,
    borderTopWidth: 1, borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth },
});
