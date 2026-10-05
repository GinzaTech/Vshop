import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as Haptics from "expo-haptics";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import AppIcon, { type AppIconHandle } from "~/components/ui/AppIcon";
import { useAppWindowDimensions } from "~/components/ui/AppViewport";
import PressFeedback from "~/components/ui/PressFeedback";
import { COLORS, GLASS_MATERIAL, NAV_GLASS_MATERIAL, GLASS_TAB_BAR } from "~/constants/DesignSystem";
import { NAV_MOTION } from "~/constants/Motion";
import { useMotionPreference } from "~/hooks/useMotionPreference";
import { usePrimaryTabPreload, type TabTransitionNavigation } from "~/hooks/usePrimaryTabPreload";
import { useSystemChromeStore } from "~/hooks/useSystemChromeStore";
import { flowTracer } from "~/utils/flow-tracer";
import { recordNavigationResponse } from "./navigation-response-profile";
import { getGlassNavigationMetrics, getNavigationContentMetrics, isPrimaryRoute, PRIMARY_ROUTES, PRIMARY_ROUTE_ORDER, type PrimaryRouteName } from "./navigation-model";
import { useLiquidLens } from "./useLiquidLens";
import { NavigationBarBackdrop, supportsNavigationBlur, type NavigationBlurTarget } from "./NavigationBarBackdrop";
import { NavigationLensMaterial } from "./NavigationLensMaterial";
import { getNavigationOptics } from "./navigation-optics";
import { RefractionLens } from "./NativeRefraction";
import { useNavigationCollapse } from "./useNavigationCollapse";

type Route = { key: string; name: string; params?: unknown };
export type FloatingTabBarProps = {
  refractionTargetTag?: number | null;
  blurTarget?: NavigationBlurTarget;
  state: { index: number; routes: Route[] };
  descriptors: Record<string, { options?: { tabBarAccessibilityLabel?: string; title?: string }; navigation?: TabTransitionNavigation }>;
  navigation: {
    emit: (event: { type: "tabPress"; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
    preload?: (name: string) => void;
    addListener?: TabTransitionNavigation["addListener"];
  };
};

const TabVisual = memo(function TabVisual({ name, label, index, slotWidth, lensWidth, labelHeight, x, pressed, insideLens, ink }: {
  name: PrimaryRouteName; label: string; index: number; slotWidth: number; lensWidth: number;
  labelHeight: number; x: SharedValue<number>; pressed: boolean; insideLens: boolean; ink: string;
}) {
  const iconVisibility = useAnimatedStyle(() => {
    const distance = Math.abs((index + 0.5) * slotWidth - (x.value + lensWidth / 2));
    // The traveling glyph owns the lens center. The clone refracts icons at its edges.
    return { opacity: interpolate(distance, [0, 18, slotWidth * 0.6], [0, 0, 1], "clamp") };
  });
  return (
    <View style={[styles.slot, { width: slotWidth }]}>
      <Animated.View style={[styles.icon, insideLens && iconVisibility]}>
        <PressFeedback pressed={pressed}>
        <AppIcon name={PRIMARY_ROUTES[name].icon} size={GLASS_TAB_BAR.iconSize}
          color={insideLens ? NAV_GLASS_MATERIAL.activeIcon : ink} decorative />
        </PressFeedback>
      </Animated.View>
      <View style={[styles.labelStack, { height: labelHeight }]}>
        <Text numberOfLines={1} maxFontSizeMultiplier={GLASS_TAB_BAR.labelMaxFontSizeMultiplier}
          style={[styles.label, insideLens && styles.activeLabel, { color: ink }]}>{label}</Text>
      </View>
    </View>
  );
});

/** One stable AppIcon changes name on accepted intent: retain the path morph and 500ms repair. */
export const FloatingTabBar = memo(function FloatingTabBar({ state, descriptors, navigation, blurTarget, refractionTargetTag = null }: FloatingTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useAppWindowDimensions();
  const contentMetrics = getNavigationContentMetrics(fontScale);
  const reduceMotion = useMotionPreference();
  const accessibilityHidden = useSystemChromeStore((chrome) => chrome.primaryNavigationAccessibilityHidden);
  const active = state.routes[state.index];
  const visible = !!active && isPrimaryRoute(active.name);
  const navigationHidden = !visible || accessibilityHidden;
  const collapse = useNavigationCollapse(navigationHidden, reduceMotion);
  const tabsHidden = navigationHidden || collapse.collapsed;
  const routes = useMemo(() => PRIMARY_ROUTE_ORDER.flatMap((name) => state.routes.filter((route) => route.name === name)), [state.routes]);
  const metrics = getGlassNavigationMetrics(width, insets.bottom);
  const [measurement, setMeasurement] = useState({ viewportWidth: width, width: metrics.width });
  const actualWidth = measurement.viewportWidth === width ? measurement.width : metrics.width;
  const contentWidth = Math.max(0, actualWidth - GLASS_TAB_BAR.insetHorizontal * 2);
  const slotWidth = Math.max(1, contentWidth / 5);
  const lensWidth = Math.max(GLASS_TAB_BAR.lensMinWidth, Math.min(slotWidth * GLASS_TAB_BAR.lensWidthRatio, GLASS_TAB_BAR.lensMaxWidth));
  const pending = useRef<string | null>(null);
  const intentRevision = useRef(0);
  const mounted = useRef(false);
  const interactionReady = useRef(!tabsHidden);
  const acceptedRoutes = useRef<readonly string[]>([]);
  const committedRoute = useRef(active);
  const [intent, setIntent] = useState<string | null>(null);
  const [pressedRoute, setPressedRoute] = useState<string | null>(null);
  const previousActive = useRef(active?.key);
  const lastPrimaryGlyph = useRef<PrimaryRouteName>(visible ? active.name as PrimaryRouteName : "profile");
  const routeName = visible
    ? intent && isPrimaryRoute(intent) ? intent : active.name as PrimaryRouteName
    : lastPrimaryGlyph.current;
  const index = PRIMARY_ROUTE_ORDER.indexOf(routeName);
  const lens = useLiquidLens(index, slotWidth, lensWidth, reduceMotion, visible);
  const iconRef = useRef<AppIconHandle>(null);
  const previousIcon = useRef(routeName);
  const pausePreload = usePrimaryTabPreload({ routes, activeKey: active?.key ?? "", enabled: visible, preload: navigation.preload, descriptors });

  const collapseFrameStyle = useAnimatedStyle(() => ({
    width: interpolate(collapse.progress.value, [0, 1], [actualWidth, GLASS_TAB_BAR.height]),
  }));
  const expandedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(collapse.progress.value, [0, 0.35, 1], [1, 0, 0], "clamp"),
  }));
  const collapsedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(collapse.progress.value, [0, 0.65, 1], [0, 0, 1], "clamp"),
  }));

  useLayoutEffect(() => {
    committedRoute.current = active;
    interactionReady.current = !tabsHidden;
  }, [active, tabsHidden]);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; intentRevision.current += 1; };
  }, []);

  useLayoutEffect(() => {
    if (visible) {
      lastPrimaryGlyph.current = routeName;
    } else {
      pending.current = null;
      intentRevision.current += 1;
      acceptedRoutes.current = [];
      setIntent(null);
      setPressedRoute(null);
    }
  }, [routeName, visible]);

  useLayoutEffect(() => {
    if (previousActive.current === active?.key) return;
    previousActive.current = active?.key;
    if (!visible || pending.current === active.name || !pending.current || !acceptedRoutes.current.includes(active.name)) {
      pending.current = null;
      intentRevision.current += 1;
      acceptedRoutes.current = [];
      setIntent(null);
    }
  }, [active?.key, active?.name, visible]);

  useEffect(() => navigation.addListener?.("transitionEnd", (event) => {
    const confirmed = committedRoute.current;
    if (!confirmed || event.target !== confirmed.key || !pending.current ||
        acceptedRoutes.current.includes(confirmed.name)) return;
    // An intermediate accepted press is a stale confirmation. A settled route
    // outside that sequence is authoritative (e.g. an account-switch redirect).
    pending.current = null;
    intentRevision.current += 1;
    acceptedRoutes.current = [];
    setIntent(null);
  }), [navigation]);

  useEffect(() => {
    const iconChanged = previousIcon.current !== routeName;
    previousIcon.current = routeName;
    if (reduceMotion) { iconRef.current?.settle(); return; }
    if (!iconChanged) return;
    const timer = setTimeout(() => iconRef.current?.settle(), NAV_MOTION.iconRepairMs);
    return () => clearTimeout(timer);
  }, [routeName, reduceMotion]);

  const lensStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: lens.x.value },
      { scaleX: reduceMotion ? 1 : interpolate(lens.progress.value, [0, 0.18, 0.48, 0.75, 1], [1, 1.08, 1.17, 1.07, 1], "clamp") },
      { scaleY: reduceMotion ? 1 : interpolate(lens.progress.value, [0, 0.48, 1], [1, 0.965, 1], "clamp") },
    ],
  }));
  const cloneStyle = useAnimatedStyle(() => {
    const sx = reduceMotion ? 1 : interpolate(lens.progress.value, [0, 0.18, 0.48, 0.75, 1], [1, 1.08, 1.17, 1.07, 1], "clamp");
    const sy = reduceMotion ? 1 : interpolate(lens.progress.value, [0, 0.48, 1], [1, 0.965, 1], "clamp");
    const magnify = reduceMotion ? 1 : GLASS_TAB_BAR.magnify;
    const scale = magnify / sx;
    const opticalOffset = getNavigationOptics(lens.progress.value, lens.to.value - lens.from.value, reduceMotion).offset / sx;
    return { transform: [
      { translateX: -scale * lens.x.value + (scale - 1) * (contentWidth - lensWidth) / 2 + opticalOffset },
      { scaleX: scale }, { scaleY: magnify / sy },
    ] };
  });
  const glyphStyle = useAnimatedStyle(() => ({ transform: [
    { translateX: getNavigationOptics(lens.progress.value, lens.to.value - lens.from.value, reduceMotion).offset /
      (reduceMotion ? 1 : interpolate(lens.progress.value, [0, 0.18, 0.48, 0.75, 1], [1, 1.08, 1.17, 1.07, 1], "clamp")) },
    { scaleX: (reduceMotion ? 1 : GLASS_TAB_BAR.magnify) / (reduceMotion ? 1 : interpolate(lens.progress.value, [0, 0.18, 0.48, 0.75, 1], [1, 1.08, 1.17, 1.07, 1], "clamp")) },
    { scaleY: (reduceMotion ? 1 : GLASS_TAB_BAR.magnify) / (reduceMotion ? 1 : interpolate(lens.progress.value, [0, 0.48, 1], [1, 0.965, 1], "clamp")) },
  ] }));

  // Red lives exclusively inside the moving clip, never in stale overlays on
  // the neutral base row. The clip itself controls the tint during travel.
  const clearBackdrop = !NAV_GLASS_MATERIAL.opaque && supportsNavigationBlur() && blurTarget?.current != null;
  const ink = clearBackdrop ? NAV_GLASS_MATERIAL.clearText : NAV_GLASS_MATERIAL.text;
  const row = (insideLens: boolean) => routes.map((route, routeIndex) => (
    <TabVisual key={route.key} name={route.name as PrimaryRouteName} label={descriptors[route.key]?.options?.title ?? PRIMARY_ROUTES[route.name as PrimaryRouteName].label}
      index={routeIndex} slotWidth={slotWidth} lensWidth={lensWidth} labelHeight={contentMetrics.labelHeight} x={lens.x} pressed={pressedRoute === route.name} insideLens={insideLens} ink={ink} />
  ));
  return (
    <View testID="primary-tab-bar" pointerEvents={navigationHidden ? "none" : "box-none"}
      aria-hidden={navigationHidden} accessibilityElementsHidden={navigationHidden}
      importantForAccessibility={navigationHidden ? "no-hide-descendants" : "auto"}
      style={[styles.positioner, { bottom: metrics.bottom, opacity: visible ? 1 : 0 }]}>
      <View testID="primary-tab-surface" pointerEvents="box-none" style={[styles.measurement, { width: actualWidth }]} onLayout={(event) => {
        const next = event.nativeEvent.layout.width;
        if (measurement.viewportWidth !== width || Math.abs(next - measurement.width) > 0.5) setMeasurement({ viewportWidth: width, width: next });
      }}>
        <Animated.View testID="primary-navigation-frame" style={[styles.shadow, collapseFrameStyle]}>
        <View testID="primary-tab-capsule" style={[styles.surface, { backgroundColor: clearBackdrop ? GLASS_MATERIAL.clear : NAV_GLASS_MATERIAL.fallback }]}>
          <NavigationBarBackdrop blurTarget={blurTarget} enabled={!tabsHidden} />
          <Animated.View testID="primary-navigation-expanded" pointerEvents={tabsHidden ? "none" : "auto"}
            aria-hidden={tabsHidden} accessibilityElementsHidden={tabsHidden}
            importantForAccessibility={tabsHidden ? "no-hide-descendants" : "auto"}
            style={[styles.expanded, { width: actualWidth }, expandedStyle]}>
          <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.visuals}>
            <View testID="primary-tab-base-row" style={styles.row}>{row(false)}</View>
            <Animated.View pointerEvents="none" testID="primary-tab-indicator" style={[styles.lens, { width: lensWidth }, lensStyle]}>
              <RefractionLens targetTag={refractionTargetTag} enabled={!NAV_GLASS_MATERIAL.opaque && !reduceMotion && !tabsHidden} />
              <NavigationLensMaterial progress={lens.progress} reduceMotion={reduceMotion} />
              <Animated.View testID="primary-tab-magnified-row" style={[styles.row, styles.cloneRow, { width: contentWidth }, cloneStyle]}>{row(true)}</Animated.View>
              <Animated.View style={[styles.glyph, { left: (lensWidth - GLASS_TAB_BAR.iconSize) / 2, top: contentMetrics.glyphTop }, glyphStyle]}>
                <PressFeedback pressed={pressedRoute === routeName}>
                  <AppIcon ref={iconRef} name={PRIMARY_ROUTES[routeName].icon} size={GLASS_TAB_BAR.iconSize} color={NAV_GLASS_MATERIAL.activeIcon} decorative spring="bouncy" testID="primary-tab-active-icon" />
                </PressFeedback>
              </Animated.View>
            </Animated.View>
          </View>
          <View accessibilityRole="tablist" testID="primary-tab-list" style={styles.touchRow}>
            {routes.map((route) => (
              <Pressable key={route.key} testID={`primary-tab-${route.name}`} accessibilityRole="tab"
                disabled={tabsHidden}
                accessibilityLabel={descriptors[route.key]?.options?.tabBarAccessibilityLabel ?? descriptors[route.key]?.options?.title ?? PRIMARY_ROUTES[route.name as PrimaryRouteName].label}
                accessibilityState={{ selected: route.name === routeName }} style={styles.touchSlot}
                delayLongPress={route.name === "settings" ? NAV_MOTION.collapseHoldMs : undefined}
                onLongPress={route.name === "settings" ? () => {
                  if (!collapse.canPress()) return;
                  setPressedRoute(null);
                  collapse.collapse();
                } : undefined}
                onPressIn={() => { recordNavigationResponse("press-in", route.name); if (collapse.canPress()) setPressedRoute(route.name); }} onPressOut={() => setPressedRoute(null)}
                onPress={() => {
                  if (!collapse.canPress()) return;
                  const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                  if (event.defaultPrevented || (pending.current ?? active.name) === route.name) return;
                  recordNavigationResponse("press", route.name);
                  pending.current = route.name;
                  acceptedRoutes.current = [...acceptedRoutes.current, route.name];
                  const revision = ++intentRevision.current;
                  pausePreload(route.key);
                  const kicked = lens.move(PRIMARY_ROUTE_ORDER.indexOf(route.name as PrimaryRouteName), false, () => {
                    if (!mounted.current || !interactionReady.current || intentRevision.current !== revision || pending.current !== route.name) return;
                    recordNavigationResponse("ui-kick", route.name);
                    navigation.navigate(route.name);
                    recordNavigationResponse("dispatch", route.name);
                    if (Platform.OS !== "web") {
                      void Haptics.selectionAsync().catch((error: unknown) => console.warn("Tab selection haptic failed", error));
                    }
                    flowTracer.startTrace(`Vshop Tab Navigation: ${active.name} to ${route.name}`);
                    flowTracer.track({ type: "NAVIGATION", label: `navigation.navigate('${route.name}')`, source: { file: "features/navigation/FloatingTabBar.tsx", functionName: "onPress" }, input: { from: active.name, to: route.name }, tool: "React Navigation" });
                  }, true);
                  recordNavigationResponse("kick-return", route.name);
                  if (kicked === false) {
                    pending.current = null;
                    acceptedRoutes.current = [];
                    intentRevision.current += 1;
                    return;
                  }
                  setIntent(route.name);
                }}>
              </Pressable>
            ))}
          </View>
          </Animated.View>
          <Animated.View testID="primary-navigation-collapsed" style={[styles.collapsed, collapsedStyle]}
            pointerEvents={collapse.collapsed && !navigationHidden ? "auto" : "none"}
            accessibilityElementsHidden={!collapse.collapsed || navigationHidden}
            importantForAccessibility={collapse.collapsed && !navigationHidden ? "auto" : "no-hide-descendants"}>
            <Pressable testID="primary-navigation-expand" accessibilityRole="button"
              accessibilityLabel="Expand navigation" accessibilityState={{ expanded: !collapse.collapsed }}
              disabled={!collapse.collapsed || navigationHidden} onPress={collapse.expand} style={styles.expandButton}>
              <AppIcon name="navMore" size={GLASS_TAB_BAR.iconSize} color={ink} decorative />
            </Pressable>
          </Animated.View>
        </View>
        </Animated.View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  positioner: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 1000 },
  measurement: { height: GLASS_TAB_BAR.height },
  shadow: { position: "absolute", right: 0, bottom: 0, height: GLASS_TAB_BAR.height, borderRadius: GLASS_TAB_BAR.radius, backgroundColor: "transparent",
    shadowColor: COLORS.PURE_BLACK, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0, boxShadow: "none" },
  surface: { flex: 1, borderRadius: GLASS_TAB_BAR.radius, overflow: "hidden", backgroundColor: NAV_GLASS_MATERIAL.fallback,
    borderColor: NAV_GLASS_MATERIAL.border, borderWidth: 0 },
  expanded: { position: "absolute", left: 0, top: 0, height: GLASS_TAB_BAR.height },
  collapsed: { ...StyleSheet.absoluteFill },
  expandButton: { flex: 1, alignItems: "center", justifyContent: "center", minWidth: 48, minHeight: 48 },
  visuals: { ...StyleSheet.absoluteFill, marginHorizontal: GLASS_TAB_BAR.insetHorizontal },
  row: { height: GLASS_TAB_BAR.height, flexDirection: "row" },
  cloneRow: { position: "absolute", top: -GLASS_TAB_BAR.insetVertical },
  slot: { height: GLASS_TAB_BAR.height, alignItems: "center", justifyContent: "center" },
  icon: { width: GLASS_TAB_BAR.iconSize, height: GLASS_TAB_BAR.iconSize },
  labelStack: { width: "100%", marginTop: GLASS_TAB_BAR.labelGap },
  label: { fontSize: GLASS_TAB_BAR.labelSize, lineHeight: GLASS_TAB_BAR.labelLineHeight, fontWeight: "500", letterSpacing: -0.15, textAlign: "center", color: NAV_GLASS_MATERIAL.text },
  activeLabel: { color: NAV_GLASS_MATERIAL.selectedText, fontWeight: "600" },
  lens: { position: "absolute", left: 0, top: GLASS_TAB_BAR.insetVertical, height: GLASS_TAB_BAR.lensHeight, borderRadius: GLASS_TAB_BAR.lensRadius,
    overflow: "hidden", backgroundColor: NAV_GLASS_MATERIAL.lens, borderColor: NAV_GLASS_MATERIAL.border, borderWidth: 0 },
  glyph: { position: "absolute", width: GLASS_TAB_BAR.iconSize, height: GLASS_TAB_BAR.iconSize },
  touchRow: { ...StyleSheet.absoluteFill, marginHorizontal: GLASS_TAB_BAR.insetHorizontal, flexDirection: "row" },
  touchSlot: { flex: 1, minHeight: 48, minWidth: 44, alignItems: "center", justifyContent: "center" },
});
