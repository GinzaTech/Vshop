import { useEffect, type PropsWithChildren } from "react";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useMotionPreference as useReducedMotion } from "~/hooks/useMotionPreference";

import { MOTION_TIMING, TAB_MOTION } from "~/constants/Motion";

/** Keep press feedback on the UI thread without scaling the touch target. */
export default function PressFeedback({
  pressed,
  children,
}: PropsWithChildren<{ pressed: boolean }>) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = reduceMotion
      ? 1
      : withTiming(pressed ? TAB_MOTION.pressedScale : 1, MOTION_TIMING.fast);
    return () => cancelAnimation(scale);
  }, [pressed, reduceMotion, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}
