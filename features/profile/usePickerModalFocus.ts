import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { AccessibilityInfo, Platform, View } from "react-native";

/** Focus follows the actual modal presentation; retired hosts cannot move it. */
export function usePickerModalFocus(visible: boolean, onDismiss: () => void) {
  const closeButtonRef = useRef<View>(null);
  const sheetRef = useRef<View>(null);
  const lifetime = useMemo(() => ({ visible }), [visible]);
  const active = useRef<typeof lifetime | null>(null);
  const shown = useRef<typeof lifetime | null>(null);
  useLayoutEffect(() => {
    active.current = visible ? lifetime : null;
    shown.current = null;
    return () => { active.current = null; shown.current = null; };
  }, [lifetime, visible]);

  const handleNativeShow = useCallback(() => {
    if (active.current !== lifetime || shown.current === lifetime || !closeButtonRef.current) return;
    shown.current = lifetime;
    AccessibilityInfo.sendAccessibilityEvent(closeButtonRef.current, "focus");
  }, [lifetime]);

  useEffect(() => {
    if (!visible || Platform.OS !== "web") return;
    const trigger = document.activeElement;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onDismiss(); return; }
      if (event.key !== "Tab" || !(sheetRef.current instanceof HTMLElement)) return;
      const sheet = sheetRef.current;
      const targets = Array.from(sheet.querySelectorAll<HTMLElement>(
        'button, input, [tabindex="0"], [role="button"], [role="tab"]',
      )).filter((element) => !element.hasAttribute("disabled") &&
        element.getAttribute("aria-disabled") !== "true" && element.getClientRects().length > 0);
      const first = targets[0]; const last = targets.at(-1);
      if (!first || !last) return;
      const focused = document.activeElement;
      if (!sheet.contains(focused) || (event.shiftKey ? focused === first : focused === last)) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener("keydown", handleKey, true);
    const frame = requestAnimationFrame(() => {
      if (active.current === lifetime) closeButtonRef.current?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKey, true);
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, [lifetime, onDismiss, visible]);

  return { closeButtonRef, sheetRef, handleNativeShow };
}
