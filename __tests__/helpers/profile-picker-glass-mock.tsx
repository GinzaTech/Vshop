import React from "react";
import { View, FlatList, type FlatListProps } from "react-native";
import type { RefractiveGlassViewport as CoreViewport, RefractiveGlassCard as CoreCard } from "~/components/ui/refractive-glass";

/** Picker integration boundary: native contents only, independent of core Canvas. */
export function RefractiveGlassViewport(props: React.ComponentProps<typeof CoreViewport>) {
  return <View {...props} />;
}
export function RefractiveGlassCard(props: React.ComponentProps<typeof CoreCard>) {
  return <View {...props} />;
}
export function GlassFlatList<Item>(props: FlatListProps<Item>) {
  return <FlatList {...props} />;
}
