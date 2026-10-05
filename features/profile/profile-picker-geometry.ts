import { SPACING } from "~/constants/DesignSystem";
import type { PickerState } from "./profile-loadout";

/** Picker-only geometry; no account, selection or preparation ownership. */
export function getProfilePickerGeometry({ width, height, fontScale }: {
  width: number; height: number; fontScale: number;
}, pickerType?: PickerState["type"]) {
  // Preserve the existing dialog's 16dp outer and inner horizontal padding.
  const contentWidth = Math.max(0, width - SPACING.md * 4);
  const gap = SPACING.xs;
  const columns = contentWidth >= 310 && fontScale < 1.3 ? 3 : 2;
  const cardWidth = Math.max(48, (contentWidth - gap * (columns - 1)) / columns);
  const optionScale = pickerType === "spray" || pickerType === "expression" ? 1.2 : 1;
  // Grow around the fixed two-line name, visual gap, and borders; never scale text.
  const fixedBodyHeight = SPACING.xs * 2 + SPACING.xxs + 34 + 2;
  return {
    columns,
    cardWidth,
    viewportHeight: Math.max(1, Math.floor(height * 0.82)),
    // Keep every other picker at its exact compact artwork baseline.
    artHeight: (columns === 3 ? 62 : 72) * optionScale,
    optionMinHeight: 48 * optionScale,
    optionPaddingVertical: SPACING.xs + fixedBodyHeight * (optionScale - 1) / 2,
  } as const;
}
