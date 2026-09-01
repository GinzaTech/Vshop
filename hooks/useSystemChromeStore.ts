import { create } from "zustand";

export type TopInsetTone = "light" | "dark";

type SystemChromeState = {
  topInsetTone: TopInsetTone;
  setTopInsetTone: (tone: TopInsetTone) => void;
  primaryNavigationTone: TopInsetTone;
  setPrimaryNavigationTone: (tone: TopInsetTone) => void;
  primaryNavigationAccessibilityHidden: boolean;
  setPrimaryNavigationAccessibilityHidden: (hidden: boolean) => void;
};

/** Shared visual state for the system status-bar safe area. */
export const useSystemChromeStore = create<SystemChromeState>((set) => ({
  topInsetTone: "light",
  setTopInsetTone: (topInsetTone) => set({ topInsetTone }),
  primaryNavigationTone: "dark",
  setPrimaryNavigationTone: (primaryNavigationTone) =>
    set({ primaryNavigationTone }),
  primaryNavigationAccessibilityHidden: false,
  setPrimaryNavigationAccessibilityHidden: (
    primaryNavigationAccessibilityHidden,
  ) => set({ primaryNavigationAccessibilityHidden }),
}));
