import { useSyncExternalStore } from "react";
import { AccessibilityInfo } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

let preference: boolean | undefined;
const listeners = new Set<() => void>();
let stopListening: (() => void) | undefined;

function publish(value: boolean) {
  if (preference === value) return;
  preference = value;
  listeners.forEach((listener) => listener());
}

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

/** One native subscription/query shared by all buttons, cards and screens. */
export function useMotionPreference() {
  const initialValue = useReducedMotion();
  return useSyncExternalStore(subscribe, () => preference ?? initialValue, () => initialValue);
}
