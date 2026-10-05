// Structural material boundary for callback/route tests; core has real measured tests.
import React from "react";
import { FlatList, ScrollView, View, type ViewProps, type ScrollViewProps } from "react-native";
import type { SharedValue } from "react-native-reanimated";
export function RefractiveGlassViewport({ children, enabled: _enabled, wallpaperSource: _source, ...props }: ViewProps & { enabled?: boolean; wallpaperSource?: number | string }) {
  return <View {...props}>{children}</View>;
}
export function RefractiveGlassCard({ children, compact: _compact, ...props }: ViewProps & { compact?: boolean }) {
  return <View {...props}>{children}</View>;
}
export function GlassClip({ children, height, materialOnly, style, ...props }: ViewProps & { height?: SharedValue<number>; materialOnly?: boolean }) {
  return <View {...props} style={[style, height && !materialOnly && { height: height.value }]}>{children}</View>;
}
export const GlassScrollView = React.forwardRef<ScrollView, ScrollViewProps>(function GlassScrollView(props, ref) { return <ScrollView {...props} ref={ref} />; });
export const GlassFlatList = FlatList;
