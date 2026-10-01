import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cancelAnimation, useSharedValue, withTiming } from "react-native-reanimated";
import { NAV_MOTION } from "~/constants/Motion";

/** Keep the current gesture generation separate from late press/release callbacks. */
export function useNavigationCollapse(hidden: boolean, reduceMotion: boolean) {
  const [collapsed, setCollapsed] = useState(false);
  const collapsedRef = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(true);
  const latest = useRef({ hidden, reduceMotion });
  latest.current = { hidden, reduceMotion };
  const progress = useSharedValue(0);
  const renderGeneration = generation.current;

  useLayoutEffect(() => {
    // Hide retires in-flight gestures, not the user's collapsed preference.
    // New visible render callbacks capture this fresh generation on return.
    if (hidden) generation.current += 1;
  }, [hidden]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; cancelAnimation(progress); };
  }, [progress]);
  useEffect(() => {
    if (!reduceMotion) return;
    cancelAnimation(progress);
    progress.value = collapsedRef.current ? 1 : 0;
  }, [progress, reduceMotion]);

  const current = () => mounted.current && !hidden && !latest.current.hidden && generation.current === renderGeneration;
  const change = (next: boolean) => {
    if (!current() || next === collapsedRef.current) return;
    generation.current += 1;
    collapsedRef.current = next;
    cancelAnimation(progress);
    progress.value = latest.current.reduceMotion ? (next ? 1 : 0) : withTiming(next ? 1 : 0, NAV_MOTION.collapse);
    setCollapsed(next);
  };
  return {
    collapsed,
    progress,
    canPress: () => current() && !collapsedRef.current,
    collapse: () => change(true),
    expand: () => change(false),
  };
}
