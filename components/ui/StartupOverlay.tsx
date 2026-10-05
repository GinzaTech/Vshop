import React from "react";
import { StyleSheet } from "react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { MOTION_TIMING } from "~/constants/Motion";
import { COLORS } from "~/constants/DesignSystem";
import { useMotionPreference } from "~/hooks/useMotionPreference";

/** Keep the same icon until route commit, then fade without blocking input. */
export default function StartupOverlay({ active, onHidden, children }: React.PropsWithChildren<{
  active: boolean; onHidden?: () => void;
}>) {
  const reduced = useMotionPreference();
  const [rendered, setRendered] = React.useState(active);
  const opacity = useSharedValue(active ? 1 : 0);
  const revision = React.useRef(0);
  const alive = React.useRef(true);
  const latestActive = React.useRef(active);
  const latestHidden = React.useRef(onHidden);
  latestActive.current = active; latestHidden.current = onHidden;
  const finish = React.useCallback((generation: number) => {
    if (!alive.current || latestActive.current || revision.current !== generation) return;
    setRendered(false); latestHidden.current?.();
  }, []);
  React.useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; revision.current += 1; cancelAnimation(opacity); };
  }, [opacity]);
  React.useEffect(() => {
    const generation = ++revision.current;
    cancelAnimation(opacity);
    if (active) { setRendered(true); opacity.value = 1; }
    else if (rendered) {
      if (reduced) { opacity.value = 0; finish(generation); }
      else opacity.value = withTiming(0, MOTION_TIMING.fast, (finished) => {
        if (finished) scheduleOnRN(finish, generation);
      });
    }
    return () => cancelAnimation(opacity);
  }, [active, finish, opacity, reduced, rendered]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  if (!rendered) return null;
  return <Animated.View testID="startup-overlay" pointerEvents={active ? "auto" : "none"}
    aria-hidden={!active} accessibilityElementsHidden={!active}
    importantForAccessibility={active ? "auto" : "no-hide-descendants"}
    style={[styles.overlay, animatedStyle]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({ overlay: { ...StyleSheet.absoluteFill, zIndex: 1000, backgroundColor: COLORS.BACKGROUND } });
