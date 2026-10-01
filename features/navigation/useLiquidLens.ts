import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { cancelAnimation, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { scheduleOnUI } from "react-native-worklets";
import { NAV_MOTION } from "~/constants/Motion";
import { getLensLeft, getNavigationTravelDuration } from "./navigation-model";

export function useLiquidLens(index: number, slotWidth: number, lensWidth: number, reduceMotion: boolean, visible: boolean) {
  const x = useSharedValue(getLensLeft(index, slotWidth, lensWidth));
  const progress = useSharedValue(1);
  const from = useSharedValue(index);
  const to = useSharedValue(index);
  const alive = useSharedValue(true);
  const mounted = useRef(true);
  const target = useRef(index);
  const geometry = useRef({ slotWidth, lensWidth, visible });

  const move = useCallback((next: number, jump = false) => {
    if (!mounted.current) return;
    target.current = next;
    scheduleOnUI(() => {
      "worklet";
      if (!alive.value) return;
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
        return;
      }
      progress.value = 0;
      x.value = withSpring(destination, NAV_MOTION.spring, (finished) => {
        if (finished) x.value = destination;
      });
      progress.value = withTiming(1, { ...NAV_MOTION.travel, duration: getNavigationTravelDuration(from.value, next) });
    });
  }, [alive, from, lensWidth, progress, reduceMotion, slotWidth, to, x]);

  useLayoutEffect(() => {
    const previous = geometry.current;
    const jump = previous.slotWidth !== slotWidth || previous.lensWidth !== lensWidth || !previous.visible || reduceMotion;
    geometry.current = { slotWidth, lensWidth, visible };
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
