// ===== PressFeedback.tsx =====
// Wrapper animation phản hồi nhấn (scale) chạy trên UI thread bằng Reanimated.
// Không làm thay đổi vùng chạm (touch target) của phần tử bên trong.
import { useEffect, type PropsWithChildren } from "react";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useMotionPreference as useReducedMotion } from "~/hooks/useMotionPreference";

import { MOTION_TIMING, TAB_MOTION } from "~/constants/Motion";

/**
 * PressFeedback – Component bọc nội dung và thu nhỏ nhẹ (scale) khi đang nhấn.
 * Dùng cho tab/pressed states để phản hồi trực quan mượt mà.
 *
 * @param pressed – true khi phần tử đang được nhấn (từ Pressable cha truyền vào).
 * @param children – React node con được bọc trong Animated.View.
 * @returns Animated.View với transform scale theo trạng thái pressed.
 *
 * Side effects: animation withTiming trên UI thread mỗi khi pressed đổi;
 * cleanup: cancelAnimation(scale) khi unmount hoặc dependency thay đổi.
 * Reduce Motion: giữ scale = 1 (không animate) khi bật.
 */
export default function PressFeedback({
  pressed,
  children,
}: PropsWithChildren<{ pressed: boolean }>) {
  // reduceMotion: tôn trọng cài đặt Reduce Motion của hệ điều hành
  const reduceMotion = useReducedMotion();
  // scale: shared value điều khiển transform scale trên UI thread
  const scale = useSharedValue(1);

  // Effect: animate scale về pressedScale (khi nhấn) hoặc 1 (khi thả)
  // Cleanup: hủy animation đang chạy
  useEffect(() => {
    scale.value = reduceMotion
      ? 1
      : withTiming(pressed ? TAB_MOTION.pressedScale : 1, MOTION_TIMING.fast);
    return () => cancelAnimation(scale);
  }, [pressed, reduceMotion, scale]);

  // style: animated style gắn shared value scale vào transform của View
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}
