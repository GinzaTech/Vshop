import type { BottomTabNavigationOptions } from "expo-router/tabs";
import { MOTION_TIMING, TAB_MOTION } from "~/constants/Motion";

type TabSceneInterpolator = NonNullable<BottomTabNavigationOptions["sceneStyleInterpolator"]>;

/**
 * Tập option dùng khi người dùng bật "Reduce Motion" của hệ điều hành:
 * tắt hẳn animation chuyển tab (animation: "none") nhưng vẫn giữ lazy + nền
 * trong suốt như cấu hình thường.
 */
export const PRIMARY_TAB_REDUCED_MOTION_OPTIONS = {
  sceneStyle: { backgroundColor: "transparent" },
  lazy: true,
  freezeOnBlur: false,
  animation: "none",
} satisfies BottomTabNavigationOptions;

/**
 * createPrimaryTabScreenOptions — Tạo screen options cho tab bar chính với
 * animation "shift": trang đích trượt nhẹ + fade vào, không crossfade 2 trang
 * (tránh chữ/ảnh nhân đôi). Khoảng trượt tỉ lệ viewport, chặn ở maxShift.
 * @param {number} viewportWidth - Chiều rộng khung nhìn (px) hiện tại
 * @returns {BottomTabNavigationOptions} Options áp dụng cho mọi tab chính
 */
export function createPrimaryTabScreenOptions(viewportWidth: number) {
  const distance = Math.min(viewportWidth * TAB_MOTION.viewportRatio, TAB_MOTION.maxShift);
  const sceneStyleInterpolator: TabSceneInterpolator = ({ current }) => ({
    sceneStyle: {
      // Only the destination is visible. Crossfading two translated pages
      // creates double text/images; a subtle entrance also avoids a blank flash.
      opacity: current.progress.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: [TAB_MOTION.initialOpacity, 1, TAB_MOTION.initialOpacity],
        extrapolate: "clamp",
      }),
      transform: [
        {
          translateX: current.progress.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [-distance, 0, distance],
            extrapolate: "clamp",
          }),
        },
      ],
    },
  });

  return {
    // The content host owns the background so an outgoing native screen
    // cannot cover the destination with an almost-opaque empty surface.
    sceneStyle: { backgroundColor: "transparent" },
    lazy: true,
    freezeOnBlur: false,
    animation: "shift",
    sceneStyleInterpolator,
    transitionSpec: {
      animation: "timing",
      config: { duration: MOTION_TIMING.tab.duration, easing: MOTION_TIMING.tab.easing },
    },
  } satisfies BottomTabNavigationOptions;
}

