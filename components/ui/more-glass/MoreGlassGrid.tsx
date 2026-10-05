import React from "react";
import { AppState, View, type ViewProps, type LayoutChangeEvent } from "react-native";
import { useIsFocused } from "expo-router";
import { useNativeGlassPreferences } from "~/components/ui/liquid-glass-native-policy";
import { buildMoreGlassUniforms, updateMoreGlassRect, MORE_GLASS_CARD_COUNT, type MoreGlassRects } from "./more-glass-model";
import { MoreGlassContext } from "./more-glass-context";
import { MoreGlassRenderer } from "./MoreGlassRenderer";

export type MoreGlassGridProps = Omit<ViewProps, "children"> & {
  enabled?: boolean;
  children: (api: { onCardLayout: (index: number, event: LayoutChangeEvent) => void }) => React.ReactNode;
};
export function MoreGlassGrid({ children, enabled, onLayout, ...props }: MoreGlassGridProps) {
  const focused = useIsFocused();
  const [foreground, setForeground] = React.useState(AppState.currentState === "active");
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  const [rects, setRects] = React.useState<MoreGlassRects>(() => Array.from({ length: MORE_GLASS_CARD_COUNT }, () => null));
  const active = (enabled ?? focused) && foreground;
  const preferences = useNativeGlassPreferences(active);
  const geometry = React.useMemo(() => buildMoreGlassUniforms(size.width, size.height, rects), [size, rects]);
  const eligible = active && !preferences.reduceTransparency && geometry.ready;
  const materialKey = React.useMemo(() => ({ eligible, size, rects }), [eligible, size, rects]);
  const committed = React.useRef(materialKey);
  const alive = React.useRef(false);
  const [availability, setAvailability] = React.useState<{ key: typeof materialKey; ready: boolean } | null>(null);
  React.useLayoutEffect(() => { committed.current = materialKey; }, [materialKey]);
  React.useLayoutEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  React.useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => setForeground(state === "active"));
    return () => subscription.remove();
  }, []);
  const onAvailabilityChange = React.useCallback((ready: boolean) => {
    if (!alive.current || committed.current !== materialKey) return;
    setAvailability((previous) => previous?.key === materialKey && previous.ready === ready
      ? previous : { key: materialKey, ready });
  }, [materialKey]);
  const onCardLayout = React.useCallback((index: number, event: LayoutChangeEvent) => {
    const layout = event.nativeEvent.layout;
    setRects((previous) => updateMoreGlassRect(previous, index, layout));
  }, []);
  const nativeReady = eligible && availability?.key === materialKey && availability.ready;
  const mode = preferences.reduceTransparency ? "opaque" : nativeReady ? "gpu" : "fallback";
  return <MoreGlassContext.Provider value={mode}>
    <View {...props} testID={props.testID ?? `more-glass-grid-${mode}`} onLayout={(event) => {
      const { width, height } = event.nativeEvent.layout;
      setSize((previous) => previous.width === width && previous.height === height ? previous : { width, height });
      onLayout?.(event);
    }}>
      <MoreGlassRenderer width={size.width} height={size.height} rects={rects}
        enabled={eligible} onAvailabilityChange={onAvailabilityChange} />
      {children({ onCardLayout })}
    </View>
  </MoreGlassContext.Provider>;
}
