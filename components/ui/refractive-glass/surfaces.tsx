import React from "react";
import { AppState, StyleSheet, type View, type ViewProps } from "react-native";
import Animated, { useAnimatedRef, useAnimatedReaction, useAnimatedStyle, useDerivedValue, useSharedValue, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useIsFocused } from "expo-router";
import { COLORS, MORE_GLASS_MATERIAL } from "~/constants/DesignSystem";
import { useNativeGlassPreferences } from "~/components/ui/liquid-glass-native-policy";
import { MORE_WHITE_WALLPAPER } from "../more-glass/MoreGlassWallpaper";
import { MoreGlassRim } from "../more-glass/MoreGlassCard";
import { GlassEnvironmentContext, GlassSceneContext } from "./context";
import { GLASS_CLIP_LIMIT, GLASS_ROUNDED_LIMIT, GLASS_REGISTRATION_LIMIT, packGlassProjection, projectGlassCard } from "./model";
import { readGlassMeasure } from "./measurement";
import { GlassRenderer } from "./renderer";
import type { GlassRegistration } from "./types";

export type GlassViewportProps = ViewProps & { enabled?: boolean; wallpaperSource?: number | string; routeFocused?: boolean };
export type GlassCardProps = ViewProps & { compact?: boolean };
export function RefractiveGlassViewport({ routeFocused, ...props }: GlassViewportProps) {
  return routeFocused === undefined ? <FocusedGlassViewport {...props} /> : <GlassViewportContent {...props} focused={routeFocused} />;
}
function FocusedGlassViewport(props: GlassViewportProps) {
  const focused = useIsFocused();
  return <GlassViewportContent {...props} focused={focused} />;
}
function GlassViewportContent({ children, enabled, focused, wallpaperSource = MORE_WHITE_WALLPAPER, onLayout, ...props }: GlassViewportProps & { focused: boolean }) {
  const root = useAnimatedRef<View>();
  const revision = useSharedValue(0), ready = useSharedValue(false);
  const revisionSequence = React.useRef(0);
  const [foreground, setForeground] = React.useState(AppState.currentState === "active");
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  const [entries, setEntries] = React.useState<readonly GlassRegistration[]>([]);
  const [measured, setMeasured] = React.useState(false);
  const active = focused && (enabled ?? true) && foreground;
  const preferences = useNativeGlassPreferences(active);
  const hasEntries = entries.length > 0;
  const key = React.useMemo(() => ({ active, size, wallpaperSource, measured, opaque: preferences.reduceTransparency, hasEntries }),
    [active, size, wallpaperSource, measured, preferences.reduceTransparency, hasEntries]);
  const committed = React.useRef(key), alive = React.useRef(false);
  const generation = React.useRef(0), generationOnUI = useSharedValue(0);
  React.useLayoutEffect(() => { generationOnUI.value = ++generation.current; }, [active, size, wallpaperSource, generationOnUI]);
  React.useLayoutEffect(() => { committed.current = key; ready.value = false; }, [key, ready]);
  React.useLayoutEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  React.useEffect(() => { const sub = AppState.addEventListener("change", state => setForeground(state === "active")); return () => sub.remove(); }, []);
  const invalidate = React.useCallback(() => { revision.value = ++revisionSequence.current; }, [revision]);
  const register = React.useCallback((entry: GlassRegistration) => {
    if (entry.clips.length > GLASS_CLIP_LIMIT || entry.signals.length > GLASS_CLIP_LIMIT ||
      entry.clips.filter(clip => clip.radius > 0).length > GLASS_ROUNDED_LIMIT) return () => {};
    setEntries(previous => {
      if (previous.includes(entry)) return previous;
      const withoutOld = previous.filter(item => item.id !== entry.id);
      return withoutOld.length < GLASS_REGISTRATION_LIMIT ? [...withoutOld, entry] : previous;
    });
    return () => setEntries(previous => previous.includes(entry) ? previous.filter(item => item !== entry) : previous);
  }, []);
  const signals = React.useMemo(() => entries.flatMap(entry => [...entry.signals,
    ...entry.clips.flatMap(clip => clip.height ? [clip.height] : [])]), [entries]);
  const projection = useDerivedValue(() => {
    void revision.value;
    signals.forEach(signal => { void signal.value; });
    const viewport = readGlassMeasure(root);
    const viewportReady = Boolean(viewport && [viewport.pageX, viewport.pageY, viewport.width, viewport.height].every(Number.isFinite) && viewport.width > 0 && viewport.height > 0);
    const measuredCards = viewportReady ? entries.flatMap(entry => {
      const card = projectGlassCard(entry.id, readGlassMeasure(entry.ref), viewport,
        entry.clips.map(clip => ({ measure: readGlassMeasure(clip.ref), radius: clip.radius, height: clip.height?.value })));
      return card ? [card] : [];
    }) : [];
    return { ...packGlassProjection(viewport?.width ?? 0, viewport?.height ?? 0, measuredCards), viewportReady };
  }, [entries, signals, root, revision]);
  const reportMeasured = React.useCallback((value: boolean, owner: number) => {
    if (alive.current && generation.current === owner) setMeasured(value);
  }, []);
  useAnimatedReaction(() => ({ valid: projection.value.viewportReady && active, owner: generationOnUI.value }), (value, previous) => {
    if (value.valid !== previous?.valid || value.owner !== previous?.owner) scheduleOnRN(reportMeasured, value.valid, value.owner);
  }, [projection, active, reportMeasured, generationOnUI]);
  const eligible = active && !preferences.reduceTransparency && measured && size.width > 0 && size.height > 0 && hasEntries;
  const availability = React.useCallback((value: boolean) => {
    if (alive.current && committed.current === key) ready.value = value;
  }, [key, ready]);
  const context = React.useMemo(() => ({ projection, ready, opaque: preferences.reduceTransparency, register, invalidate }),
    [projection, ready, preferences.reduceTransparency, register, invalidate]);
  const initialEnvironment = React.useMemo(() => ({ signals: [], clips: [] }), []);
  return <GlassSceneContext.Provider value={context}><GlassEnvironmentContext.Provider value={initialEnvironment}>
    <Animated.View {...props} ref={root} collapsable={false} testID={props.testID ?? "refractive-glass-viewport"}
      style={[props.style, { backgroundColor: COLORS.BACKGROUND }]} onLayout={event => {
        const { width, height } = event.nativeEvent.layout;
        setSize(previous => previous.width === width && previous.height === height ? previous : { width, height });
        invalidate(); onLayout?.(event);
      }}>
      <GlassRenderer key={`${typeof wallpaperSource}:${wallpaperSource}:${eligible ? "active" : "retired"}`}
        width={size.width} height={size.height} projection={projection} enabled={eligible}
        wallpaperSource={wallpaperSource} onAvailabilityChange={availability} />
      {children}
    </Animated.View>
  </GlassEnvironmentContext.Provider></GlassSceneContext.Provider>;
}
export function RefractiveGlassCard({ children, compact: _compact, onLayout, style, ...props }: GlassCardProps) {
  const scene = React.useContext(GlassSceneContext), environment = React.useContext(GlassEnvironmentContext);
  const ref = useAnimatedRef<View>(), id = React.useId();
  const register = scene?.register;
  React.useLayoutEffect(() => register?.({ id, ref, ...environment }), [register, id, ref, environment]);
  const opaque = scene?.opaque ?? false;
  const material = useAnimatedStyle(() => ({ backgroundColor: opaque ? COLORS.SURFACE :
    scene?.ready.value && scene.projection.value.visibleIds.includes(id) ? "transparent" : MORE_GLASS_MATERIAL.tint }), [scene, id, opaque]);
  const rim = useAnimatedStyle(() => ({ opacity: opaque || scene?.ready.value && scene.projection.value.visibleIds.includes(id) ? 0 : 1 }), [scene, id, opaque]);
  const descendants = React.useMemo(() => ({ signals: environment.signals,
    clips: [...environment.clips, { ref, radius: MORE_GLASS_MATERIAL.radius }] }), [environment, ref]);
  return <Animated.View {...props} ref={ref} collapsable={false} style={[style, styles.card, material]}
    onLayout={event => { scene?.invalidate(); onLayout?.(event); }}>
    <Animated.View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, rim]}><MoreGlassRim /></Animated.View>
    <GlassEnvironmentContext.Provider value={descendants}>{children}</GlassEnvironmentContext.Provider>
  </Animated.View>;
}
export function GlassClip({ children, height, materialOnly = false, onLayout, style, ...props }: ViewProps & { height?: SharedValue<number>; materialOnly?: boolean }) {
  const scene = React.useContext(GlassSceneContext), environment = React.useContext(GlassEnvironmentContext);
  const ref = useAnimatedRef<View>();
  const next = React.useMemo(() => ({ signals: environment.signals, clips: [...environment.clips, { ref, radius: 0, height }] }), [environment, ref, height]);
  const clipStyle = useAnimatedStyle(() => height && !materialOnly ? { height: height.value } : {}, [height, materialOnly]);
  return <GlassEnvironmentContext.Provider value={next}><Animated.View {...props} ref={ref} collapsable={false}
    style={[style, !materialOnly && { overflow: "hidden" }, clipStyle]} onLayout={event => { scene?.invalidate(); onLayout?.(event); }}>{children}</Animated.View></GlassEnvironmentContext.Provider>;
}

const styles = StyleSheet.create({ card: { borderRadius: MORE_GLASS_MATERIAL.radius, overflow: "hidden",
  shadowOpacity: 0, shadowRadius: 0, elevation: 0, boxShadow: "none" } });
