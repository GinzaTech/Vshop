import { create } from "zustand";

export type TopInsetTone = "light" | "dark";

type SystemChromeState = {
  topInsetTone: TopInsetTone;
  setTopInsetTone: (tone: TopInsetTone) => void;
};

/** Shared visual state for the system status-bar safe area. */
export const useSystemChromeStore = create<SystemChromeState>((set) => ({
  topInsetTone: "light",
  setTopInsetTone: (topInsetTone) => set({ topInsetTone }),
}));
