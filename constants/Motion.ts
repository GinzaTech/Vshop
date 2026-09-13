// ===== Motion.ts – Hằng số chuyển động dùng chung cho animation tương tác =====
// Mọi duration/easing/spring phải tham chiếu các token này thay vì hard-code,
// và luôn khai báo reduceMotion: ReduceMotion.System để tôn trọng Reduce Motion
// của hệ điều hành (quy ước bắt buộc trong AGENTS.md mục Motion).
import { Easing, ReduceMotion } from "react-native-reanimated";

/**
 * MOTION_DURATION – Thời lượng chuẩn (ms) theo 4 cấp tốc độ.
 * instant: 0 (không animation), fast: 140 (phản hồi nhấn),
 * standard: 220 (chuyển tab/panel), emphasized: 360 (entrance lớn).
 */
export const MOTION_DURATION = {
  instant: 0,
  fast: 140,
  standard: 220,
  emphasized: 360,
} as const;

/**
 * MOTION_TIMING – Cấu hình timing hoàn chỉnh (duration + easing + reduceMotion)
 * để truyền thẳng vào withTiming. Mỗi preset gắn với một ngữ cảnh:
 * tab (chuyển tab), fast (nút nhấn), standard (fade/slide nội dung),
 * emphasized (dashboard/entrance lớn).
 */
export const MOTION_TIMING = {
  tab: {
    duration: MOTION_DURATION.standard,
    easing: Easing.out(Easing.cubic),
    reduceMotion: ReduceMotion.System,
  },
  fast: {
    duration: MOTION_DURATION.fast,
    easing: Easing.out(Easing.cubic),
    reduceMotion: ReduceMotion.System,
  },
  standard: {
    duration: MOTION_DURATION.standard,
    easing: Easing.inOut(Easing.cubic),
    reduceMotion: ReduceMotion.System,
  },
  emphasized: {
    duration: MOTION_DURATION.emphasized,
    easing: Easing.out(Easing.cubic),
    reduceMotion: ReduceMotion.System,
  },
} as const;

/**
 * TAB_MOTION – Tham số cho hiệu ứng chuyển tab dạng "shutter" của profile:
 * tỉ lệ opacity khởi tạo, phần viewport bị che, độ dịch tối đa (px)
 * và scale khi nhấn giữ tab.
 */
export const TAB_MOTION = {
  initialOpacity: 0.92,
  viewportRatio: 0.08,
  maxShift: 32,
  pressedScale: 0.9,
} as const;

/**
 * MOTION_SPRING – Cấu hình withSpring cho phản hồi vật lý.
 * press: spring cho trạng thái nhấn (cứng, dừng nhanh).
 * settle: spring cho trạng thái thả/về vị trí (mềm hơn, lắc nhẹ).
 * energyThreshold nhỏ giúp spring luôn dừng hẳn trước khi cancel.
 */
export const MOTION_SPRING = {
  press: {
    damping: 20,
    stiffness: 260,
    mass: 0.7,
    energyThreshold: 0.001,
    reduceMotion: ReduceMotion.System,
  },
  settle: {
    damping: 18,
    stiffness: 190,
    mass: 0.8,
    energyThreshold: 0.001,
    reduceMotion: ReduceMotion.System,
  },
} as const;
