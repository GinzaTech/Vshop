import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { Tabs } from "expo-router";
import type { BottomTabBarProps } from "expo-router/tabs";
import { Header, Screen, getHeaderTitle } from "expo-router/react-navigation";
import { StyleSheet, View } from "react-native";
import { BlurTargetView } from "expo-blur";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { COLORS } from "~/constants/DesignSystem";
import { MOTION_DURATION, NAV_MOTION } from "~/constants/Motion";
import { useAppWindowDimensions } from "~/components/ui/AppViewport";
import { useMotionPreference } from "~/hooks/useMotionPreference";
import { FloatingTabBar } from "./FloatingTabBar";
import { supportsNavigationBlur } from "./NavigationBarBackdrop";
import { NavigationSceneContext } from "./NavigationSceneContext";
import { RefractionTarget } from "./NativeRefraction";
import { getNavigationFadeDelay, isPrimaryRoute, PRIMARY_ROUTE_ORDER, sceneDestination } from "./navigation-model";

export type LiquidNavigationShellProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["layout"]>>[0];

/**
 * Keep TabRouter/descriptors (URL, history, focus and preload), replace only its
 * view host. BottomTabView/MaybeScreen hides activityState=0 even with detach=false;
 * plain retained hosts let Reanimated own the complete crossfade on every platform.
 */
export function LiquidNavigationShell({ state, descriptors, navigation }: LiquidNavigationShellProps) {
  // Tabs.layout exposes core generics; the live navigator is still the TabRouter.
  const tabNavigation = navigation as BottomTabBarProps["navigation"];
  const tabDescriptors = descriptors as BottomTabBarProps["descriptors"];
  const active = state.routes[state.index];
  const reduceMotion = useMotionPreference();
  const dimensions = useAppWindowDimensions();
  const blurTarget = useRef<View | null>(null);
  const [blurTargetReady, setBlurTargetReady] = useState(false);
  const [refractionTargetTag, setRefractionTargetTag] = useState<number | null>(null);
  const nativeBlurSupported = supportsNavigationBlur();
  const PageBlurTarget = nativeBlurSupported ? BlurTargetView : View;
  const initialIndex = isPrimaryRoute(active.name) ? PRIMARY_ROUTE_ORDER.indexOf(active.name) : -1;
  const weights = useSharedValue<number[]>(sceneDestination(initialIndex));
  const secondaryOpacity = useSharedValue(1);
  const previous = useRef({ key: active.key, index: initialIndex });
  const generation = useRef(0);
  const mounted = useRef(true);
  const latest = useRef({ active, tabNavigation });
  latest.current = { active, tabNavigation };
  const [settledHost, setSettledHost] = useState<{ key: string; revision: number } | null>({ key: active.key, revision: 0 });
  const [visited, setVisited] = useState<readonly string[]>([active.key]);
  const loaded = useMemo(() => new Set([...visited, active.key, ...state.preloadedRouteKeys]), [visited, active.key, state.preloadedRouteKeys]);
  const finish = useCallback((key: string, revision: number) => {
    if (!mounted.current || revision !== generation.current || latest.current.active.key !== key) return;
    setSettledHost({ key, revision });
    latest.current.tabNavigation.emit({ type: "transitionEnd", target: key });
  }, []);

  useLayoutEffect(() => {
    const before = previous.current;
    if (before.key === active.key) return;
    const revision = ++generation.current;
    setSettledHost(null);
    const nextIndex = isPrimaryRoute(active.name) ? PRIMARY_ROUTE_ORDER.indexOf(active.name) : -1;
    previous.current = { key: active.key, index: nextIndex };
    setVisited((keys) => keys.includes(active.key) ? keys : [...keys, active.key]);
    tabNavigation.emit({ type: "transitionStart", target: active.key });
    cancelAnimation(weights);
    cancelAnimation(secondaryOpacity);
    const destination = sceneDestination(nextIndex);
    if (before.index >= 0 && nextIndex >= 0) {
      // withTiming retargets the whole opacity vector from its current sampled values.
      // Its sum stays one, including a third tap halfway through an existing fade.
      weights.value = withDelay(reduceMotion ? 0 : getNavigationFadeDelay(before.index, nextIndex),
        withTiming(destination, { ...NAV_MOTION.fade, duration: reduceMotion ? NAV_MOTION.reducedFadeMs : NAV_MOTION.fadeMs }, (finished) => {
          if (finished) scheduleOnRN(finish, active.key, revision);
        }));
    } else {
      // Returning from a secondary route is immediate; no replay from a primary default.
      weights.value = destination;
      if (nextIndex < 0 && !reduceMotion) {
        secondaryOpacity.value = 0;
        secondaryOpacity.value = withTiming(1, { ...NAV_MOTION.fade, duration: MOTION_DURATION.fast }, (finished) => {
          if (finished) scheduleOnRN(finish, active.key, revision);
        });
      } else {
        secondaryOpacity.value = 1;
        finish(active.key, revision);
      }
    }
  }, [active.key, active.name, tabNavigation, finish, reduceMotion, secondaryOpacity, weights]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
      cancelAnimation(weights);
      cancelAnimation(secondaryOpacity);
    };
  }, [weights, secondaryOpacity]);
  const context = useMemo(() => ({ weights }), [weights]);
  const secondaryStyle = useAnimatedStyle(() => ({ opacity: secondaryOpacity.value }));

  return (
    <NavigationSceneContext.Provider value={context}>
      <View style={styles.shell} testID="liquid-navigation-shell">
        <RefractionTarget style={styles.pages} enabled={!reduceMotion && isPrimaryRoute(active.name)} onTargetReady={setRefractionTargetTag}>
        <PageBlurTarget ref={blurTarget} testID="navigation-blur-target" accessible={false}
          collapsable={false} pointerEvents="box-none" style={styles.pages}
          onLayout={({ nativeEvent }) => {
            const ready = nativeBlurSupported && blurTarget.current !== null && nativeEvent.layout.width > 0 && nativeEvent.layout.height > 0;
            setBlurTargetReady((current) => current === ready ? current : ready);
          }}>
        {state.routes.map((route) => {
          const primary = isPrimaryRoute(route.name);
          const focused = route.key === active.key;
          // Route focus can precede visible content by 210ms. Keep every page
          // inert until its own current generation has completed, including headers.
          const interactive = focused && settledHost?.key === route.key &&
            settledHost.revision === generation.current && previous.current.key === active.key;
          if (primary ? !loaded.has(route.key) : !focused) return null;
          const descriptor = tabDescriptors[route.key];
          const options = descriptor.options;
          return (
            <Animated.View key={route.key} testID={`navigation-host-${route.name}`} pointerEvents={interactive ? "auto" : "none"}
              aria-hidden={!interactive} accessibilityElementsHidden={!interactive} importantForAccessibility={interactive ? "auto" : "no-hide-descendants"}
              style={[styles.host, { zIndex: focused ? 2 : 1 }, !primary && secondaryStyle]}>
              <Screen focused={focused} route={descriptor.route} navigation={descriptor.navigation}
                headerShown={options.headerShown} headerStatusBarHeight={options.headerStatusBarHeight} headerTransparent={options.headerTransparent}
                header={options.header
                  ? options.header({ layout: dimensions, route: descriptor.route, navigation: descriptor.navigation, options })
                  : <Header {...options} layout={dimensions} title={getHeaderTitle(options, route.name)} />}
                style={styles.screen}>
                {descriptor.render()}
              </Screen>
            </Animated.View>
          );
        })}
        </PageBlurTarget>
        </RefractionTarget>
        <FloatingTabBar state={state} descriptors={tabDescriptors} navigation={tabNavigation}
          refractionTargetTag={refractionTargetTag}
          blurTarget={blurTargetReady ? blurTarget : undefined} />
      </View>
    </NavigationSceneContext.Provider>
  );
}

export function renderLiquidNavigationShell(props: LiquidNavigationShellProps) {
  return <LiquidNavigationShell {...props} />;
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: COLORS.BACKGROUND },
  pages: { flex: 1, backgroundColor: COLORS.BACKGROUND },
  host: { ...StyleSheet.absoluteFill },
  screen: { flex: 1, backgroundColor: "transparent" },
});
