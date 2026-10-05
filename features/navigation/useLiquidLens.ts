import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { Platform } from "react-native";
import { cancelAnimation, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { runOnUISync, scheduleOnRN, scheduleOnUI } from "react-native-worklets";
import { NAV_MOTION } from "~/constants/Motion";
import { getLensLeft, getNavigationTravelDuration } from "./navigation-model";

export function useLiquidLens(index: number, slotWidth: number, lensWidth: number, reduceMotion: boolean, visible: boolean) {
  const x = useSharedValue(getLensLeft(index, slotWidth, lensWidth));
  const progress = useSharedValue(1);
  const from = useSharedValue(index);
  const to = useSharedValue(index);
  const alive = useSharedValue(true);
  const appliedRevision = useSharedValue(0);
  const revision = useRef(0);
  const mounted = useRef(true);
  const target = useRef(index);
  const geometry = useRef({ slotWidth, lensWidth, visible, reduceMotion });

  const move = useCallback((next: number, jump = false, onStarted?: () => void, immediate = false) => {
    if (!mounted.current) return false;
    const command = ++revision.current;
    const kick = () => {
      "worklet";
      if (!alive.value || command < appliedRevision.value) return false;
      appliedRevision.value = command;
      cancelAnimation(x);
      cancelAnimation(progress);
      // Sample the current physical position, including an interrupted spring.
      from.value = (x.value + lensWidth / 2) / slotWidth - 0.5;
      to.value = next;
      const destination = getLensLeft(next, slotWidth, lensWidth);
      if (jump || reduceMotion) {
        x.value = destination;
        progress.value = 1;
        from.value = next;
        return true;
      }
      progress.value = 0;
      x.value = withSpring(destination, NAV_MOTION.spring, (finished) => {
        if (finished) x.value = destination;
      });
      progress.value = withTiming(1, { ...NAV_MOTION.travel, duration: getNavigationTravelDuration(from.value, next) });
      return true;
    };
    if (immediate && (Platform.OS === "android" || Platform.OS === "ios")) {
      try {
        const started = runOnUISync(kick);
        if (!started) return false;
        target.current = next;
        onStarted?.();
        return true;
      } catch (error) {
        console.warn("[navigation] Immediate lens kickoff unavailable; scheduling fallback", error instanceof Error ? error.name : "UnknownError");
      }
    }
    target.current = next;
    scheduleOnUI(() => {
      "worklet";
      if (kick() && onStarted) scheduleOnRN(onStarted);
    });
    return undefined;
  }, [alive, appliedRevision, from, lensWidth, progress, reduceMotion, slotWidth, to, x]);

  useLayoutEffect(() => {
    const previous = geometry.current;
    const jump = previous.slotWidth !== slotWidth || previous.lensWidth !== lensWidth || !previous.visible ||
      (reduceMotion && !previous.reduceMotion);
    geometry.current = { slotWidth, lensWidth, visible, reduceMotion };
    if (visible && (jump || target.current !== index)) move(index, jump);
  }, [index, slotWidth, lensWidth, visible, reduceMotion, move]);

  useEffect(() => {
    mounted.current = true;
    alive.value = true;
    return () => {
      mounted.current = false;
      alive.value = false;
      cancelAnimation(x);
      cancelAnimation(progress);
    };
  }, [alive, x, progress]);
  return { x, progress, from, to, move };
}
