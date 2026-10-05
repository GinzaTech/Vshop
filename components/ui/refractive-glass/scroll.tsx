import React from "react";
import { FlatList, type ScrollView, type View, type ScrollViewProps, type FlatListProps } from "react-native";
import Animated, { useAnimatedRef, useScrollOffset, type AnimatedRef } from "react-native-reanimated";
import { GlassEnvironmentContext, GlassSceneContext } from "./context";

// Use the native list, preserving custom CellRendererComponent and generic refs.
const AnimatedCollection = Animated.createAnimatedComponent(FlatList) as unknown as
  <Item>(props: FlatListProps<Item> & React.RefAttributes<FlatList<Item>>) => React.ReactElement;

export const GlassScrollView = React.forwardRef<ScrollView, ScrollViewProps>(function GlassScrollView(props, ref) {
  const scene = React.useContext(GlassSceneContext), environment = React.useContext(GlassEnvironmentContext);
  const anchor = useAnimatedRef<ScrollView>(), offset = useScrollOffset(anchor);
  const next = React.useMemo(() => ({ signals: [...environment.signals, offset],
    clips: [...environment.clips, { ref: anchor as unknown as AnimatedRef<View>, radius: 0 }] }), [environment, anchor, offset]);
  const merged = React.useCallback((node: ScrollView | null) => {
    anchor(node);
    if (typeof ref === "function") ref(node); else if (ref) ref.current = node;
  }, [anchor, ref]);
  return <GlassEnvironmentContext.Provider value={next}><Animated.ScrollView {...props} ref={merged}
    scrollEventThrottle={props.scrollEventThrottle ?? 16} onLayout={event => { scene?.invalidate(); props.onLayout?.(event); }} /></GlassEnvironmentContext.Provider>;
});
function FlatListInner<Item>(props: FlatListProps<Item>, forwarded: React.ForwardedRef<FlatList<Item>>) {
  const scene = React.useContext(GlassSceneContext), environment = React.useContext(GlassEnvironmentContext);
  const anchor = useAnimatedRef<FlatList<Item>>(), offset = useScrollOffset(anchor);
  const next = React.useMemo(() => ({ signals: [...environment.signals, offset],
    clips: [...environment.clips, { ref: anchor as unknown as AnimatedRef<View>, radius: 0 }] }), [environment, anchor, offset]);
  const merged = React.useCallback((node: FlatList<Item> | null) => {
    anchor(node);
    if (typeof forwarded === "function") forwarded(node); else if (forwarded) forwarded.current = node;
  }, [anchor, forwarded]);
  return <GlassEnvironmentContext.Provider value={next}><AnimatedCollection {...props} ref={merged}
    scrollEventThrottle={props.scrollEventThrottle ?? 16} onLayout={event => { scene?.invalidate(); props.onLayout?.(event); }} /></GlassEnvironmentContext.Provider>;
}
export const GlassFlatList = React.forwardRef(FlatListInner) as <Item>(props: FlatListProps<Item> & React.RefAttributes<FlatList<Item>>) => React.ReactElement;
