import { useSyncExternalStore } from "react";
import { AccessibilityInfo } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

// Snapshot giá trị reduce-motion dùng chung (undefined = chưa đọc lần nào).
let preference: boolean | undefined;
// Danh sách subscriber của useSyncExternalStore (mỗi component dùng hook là 1).
const listeners = new Set<() => void>();
// Hàm hủy subscription native — chỉ tồn tại khi còn ít nhất 1 subscriber.
let stopListening: (() => void) | undefined;

/** Phát giá trị mới cho mọi subscriber (bỏ qua nếu giá trị không đổi). */
function publish(value: boolean) {
  if (preference === value) return;
  preference = value;
  listeners.forEach((listener) => listener());
}

/**
 * Đăng ký listener vào store ngoài. Subscriber ĐẦU TIÊN mở đúng MỘT
 * subscription native (reduceMotionChanged) + đọc giá trị khởi tạo; subscriber
 * cuối rời đi thì hủy subscription. Đảm bảo 1 listener hệ điều hành cho cả app.
 */
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    let active = true;
    let receivedEvent = false;
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
      receivedEvent = true;
      publish(value);
    });
    // The initial Reanimated snapshot can predate this component's mount.
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active && !receivedEvent) publish(value);
    }).catch(() => undefined);
    stopListening = () => {
      active = false;
      subscription.remove();
    };
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stopListening?.();
      stopListening = undefined;
    }
  };
}

/**
 * Đọc Reduce Motion của hệ điều hành cho UI (nút, card, animation lặp...).
 * Snapshot: giá trị native nếu đã có, fallback sang useReducedMotion của
 * Reanimated trong lần render đầu — tránh nhấp nháy sai trạng thái lúc mount.
 * @returns boolean — true nếu người dùng bật Reduce Motion (tắt animation).
 */
export function useMotionPreference() {
  const initialValue = useReducedMotion();
  return useSyncExternalStore(subscribe, () => preference ?? initialValue, () => initialValue);
}
