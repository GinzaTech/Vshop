import { useEffect } from "react";
import { useIsFocused } from "expo-router";

/** Hide retained-screen pickers on commit and clear their state after blur. */
export function useDismissPickerOnBlur(dismissPicker: () => void): boolean {
  const focused = useIsFocused();

  useEffect(() => {
    if (!focused) dismissPicker();
  }, [dismissPicker, focused]);

  return focused;
}
