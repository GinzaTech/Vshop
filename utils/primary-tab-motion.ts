import type { BottomTabNavigationOptions } from "expo-router/tabs";

/** The retained custom host owns attachment and UI-thread opacity, never native shift. */
export function getPrimaryTabNavigatorPolicy(platform: string) {
  return { detachInactiveScreens: false, secondaryFreezeOnBlur: platform === "android" } as const;
}

export const PRIMARY_TAB_REDUCED_MOTION_OPTIONS = {
  sceneStyle: { backgroundColor: "transparent" },
  lazy: true,
  freezeOnBlur: false,
  animation: "none",
} satisfies BottomTabNavigationOptions;

/** Keep the public factory contract; geometry belongs to the glass lens, not pages. */
export function createPrimaryTabScreenOptions(_viewportWidth: number) {
  return { ...PRIMARY_TAB_REDUCED_MOTION_OPTIONS } satisfies BottomTabNavigationOptions;
}

