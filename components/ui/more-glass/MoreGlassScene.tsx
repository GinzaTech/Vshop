import React from "react";
import { AppState, View, type ViewProps, type LayoutChangeEvent } from "react-native";
import { useIsFocused } from "expo-router";
import { useAnimatedScrollHandler, useSharedValue, type ScrollHandlerProcessed } from "react-native-reanimated";
import { COLORS } from "~/constants/DesignSystem";
import { useNativeGlassPreferences } from "~/components/ui/liquid-glass-native-policy";
import type { MoreGlassRects } from "./more-glass-model";
import { buildMoreGlassSceneUniforms, composeMoreGlassSceneRects, updateMoreGlassSceneRect, MORE_GLASS_SCENE_CARD_COUNT, type MoreGlassPoint } from "./more-glass-scene-model";
import { MoreGlassContext } from "./more-glass-context";
import { MoreGlassSceneRenderer } from "./MoreGlassSceneRenderer";
import { MORE_WHITE_WALLPAPER } from "./MoreGlassWallpaper";

export type MoreGlassSceneApi = {
  onShortcutGridLayout: (event: LayoutChangeEvent) => void;
  onShortcutLayout: (index: number, event: LayoutChangeEvent) => void;
  onCardLayout: (index: number, event: LayoutChangeEvent) => void;
  onScroll: ScrollHandlerProcessed<Record<string, unknown>>;
};
export type MoreGlassSceneProps = Omit<ViewProps, "children"> & {
  enabled?: boolean;
  wallpaperSource?: number | string;
  children: (api: MoreGlassSceneApi) => React.ReactNode;
};
export function MoreGlassScene({ children, enabled, wallpaperSource = MORE_WHITE_WALLPAPER, onLayout, ...props }: MoreGlassSceneProps) {
  const focused = useIsFocused();
  const [foreground, setForeground] = React.useState(AppState.currentState === "active");
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  const [rawRects, setRawRects] = React.useState<MoreGlassRects>(() => Array.from({ length: MORE_GLASS_SCENE_CARD_COUNT }, () => null));
  const [gridOffset, setGridOffset] = React.useState<MoreGlassPoint | null>(null);
  const rects = React.useMemo(() => composeMoreGlassSceneRects(rawRects, gridOffset), [rawRects, gridOffset]);
  const scrollOffset = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({ onScroll: (event) => {
    if (Number.isFinite(event.contentOffset.y)) scrollOffset.value = event.contentOffset.y;
  } });
  const active = (enabled ?? focused) && foreground;
  const preference = useNativeGlassPreferences(active);
  const geometry = React.useMemo(() => buildMoreGlassSceneUniforms(size.width, size.height, rects), [size, rects]);
  const eligible = active && !preference.reduceTransparency && geometry.ready;
  const key = React.useMemo(() => ({ eligible, size, rects, wallpaperSource }), [eligible, size, rects, wallpaperSource]);
  const committed = React.useRef(key);
  const alive = React.useRef(false);
  const [availability, setAvailability] = React.useState<{ key: typeof key; ready: boolean } | null>(null);
  React.useLayoutEffect(() => { committed.current = key; }, [key]);
  React.useLayoutEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  React.useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => setForeground(state === "active"));
    return () => listener.remove();
  }, []);
  const onAvailabilityChange = React.useCallback((ready: boolean) => {
    if (!alive.current || committed.current !== key) return;
    setAvailability((previous) => previous?.key === key && previous.ready === ready ? previous : { key, ready });
  }, [key]);
  const onCardLayout = React.useCallback((index: number, event: LayoutChangeEvent) => {
    const layout = event.nativeEvent.layout;
    setRawRects((previous) => updateMoreGlassSceneRect(previous, index, layout));
  }, []);
  const onShortcutGridLayout = React.useCallback((event: LayoutChangeEvent) => {
    const { x, y } = event.nativeEvent.layout;
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0) return;
    setGridOffset((previous) => previous?.x === x && previous.y === y ? previous : { x, y });
  }, []);
  const api = React.useMemo<MoreGlassSceneApi>(() => ({
    onShortcutGridLayout, onShortcutLayout: onCardLayout, onCardLayout, onScroll,
  }), [onShortcutGridLayout, onCardLayout, onScroll]);
  const content = React.useMemo(() => children(api), [children, api]);
  const nativeReady = eligible && availability?.key === key && availability.ready;
  const mode = preference.reduceTransparency ? "opaque" : nativeReady ? "gpu" : "fallback";
  return <MoreGlassContext.Provider value={mode}>
    <View {...props} testID={props.testID ?? `more-glass-scene-${mode}`}
      style={[props.style, { flex: 1, backgroundColor: COLORS.BACKGROUND }]} onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setSize((previous) => previous.width === width && previous.height === height ? previous : { width, height });
        onLayout?.(event);
      }}>
      <MoreGlassSceneRenderer key={`${typeof wallpaperSource}:${wallpaperSource}:${eligible ? "active" : "retired"}`}
        width={size.width} height={size.height} rects={rects} enabled={eligible}
        scrollOffset={scrollOffset} wallpaperSource={wallpaperSource} onAvailabilityChange={onAvailabilityChange} />
      {content}
    </View>
  </MoreGlassContext.Provider>;
}
