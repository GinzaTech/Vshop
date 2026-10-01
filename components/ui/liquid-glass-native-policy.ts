import { useCallback, useId, useSyncExternalStore } from "react";
import { AccessibilityInfo } from "react-native";

// Across retained/preloaded cards, not just the currently visible list.
export const MAX_NATIVE_GLASS_CARDS = 6;
type Subscription = { id: string; notify: () => void };
let slots: readonly Subscription[] = [];
export function useNativeGlassSlot(enabled: boolean) {
  const id = useId();
  const subscribe = useCallback((notify: () => void) => {
    if (!enabled) return () => undefined;
    slots = [...slots, { id, notify }];
    slots.forEach((entry) => entry.notify());
    return () => {
      slots = slots.filter((entry) => entry.id !== id);
      slots.forEach((entry) => entry.notify());
    };
  }, [enabled, id]);
  return useSyncExternalStore(subscribe, () => enabled && slots.findIndex((entry) => entry.id === id) >= 0 &&
    slots.findIndex((entry) => entry.id === id) < MAX_NATIVE_GLASS_CARDS, () => false);
}

type Preferences = { reduceTransparency: boolean; reduceMotion: boolean };
const UNKNOWN: Preferences = { reduceTransparency: true, reduceMotion: true };
let preferences = UNKNOWN;
let listeners: readonly (() => void)[] = [];
let stopListening: (() => void) | undefined;
function publish(next: Preferences) {
  if (next.reduceMotion === preferences.reduceMotion && next.reduceTransparency === preferences.reduceTransparency) return;
  preferences = next;
  listeners.forEach((notify) => notify());
}
function subscribePreferences(notify: () => void) {
  listeners = [...listeners, notify];
  if (listeners.length === 1) {
    let active = true;
    let transparencyEvent = false;
    let motionEvent = false;
    const transparency = AccessibilityInfo.addEventListener("reduceTransparencyChanged", (value) => {
      transparencyEvent = true;
      publish({ ...preferences, reduceTransparency: value });
    });
    const motion = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
      motionEvent = true;
      publish({ ...preferences, reduceMotion: value });
    });
    void Promise.resolve(AccessibilityInfo.isReduceTransparencyEnabled()).then((value) => {
      if (active && !transparencyEvent && typeof value === "boolean") publish({ ...preferences, reduceTransparency: value });
    }).catch(() => undefined); // Unknown/error deliberately keeps the opaque fallback.
    void Promise.resolve(AccessibilityInfo.isReduceMotionEnabled()).then((value) => {
      if (active && !motionEvent && typeof value === "boolean") publish({ ...preferences, reduceMotion: value });
    }).catch(() => undefined);
    stopListening = () => { active = false; transparency.remove(); motion.remove(); preferences = UNKNOWN; };
  }
  return () => {
    listeners = listeners.filter((listener) => listener !== notify);
    if (listeners.length === 0) { stopListening?.(); stopListening = undefined; }
  };
}
export function useNativeGlassPreferences(enabled: boolean) {
  const subscribe = useCallback((notify: () => void) => enabled ? subscribePreferences(notify) : () => undefined, [enabled]);
  return useSyncExternalStore(subscribe, () => preferences, () => UNKNOWN);
}
