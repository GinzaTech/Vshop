import type { AppIconName } from "~/components/ui/app-icon-registry";
import { GLASS_TAB_BAR } from "~/constants/DesignSystem";
import { NAV_MOTION } from "~/constants/Motion";

export const PRIMARY_ROUTE_ORDER = ["bundles", "shop", "profile", "night_market", "settings"] as const;
export type PrimaryRouteName = (typeof PRIMARY_ROUTE_ORDER)[number];
export const PRIMARY_ROUTES: Record<PrimaryRouteName, { icon: AppIconName; label: string }> = {
  bundles: { icon: "navStore", label: "Bundles" },
  shop: { icon: "navShop", label: "Store" },
  profile: { icon: "navProfile", label: "Profile" },
  night_market: { icon: "navNightMarket", label: "Market" },
  settings: { icon: "navMore", label: "More" },
};

export function isPrimaryRoute(name: string): name is PrimaryRouteName {
  return Object.prototype.hasOwnProperty.call(PRIMARY_ROUTES, name);
}

export function getGlassNavigationMetrics(viewportWidth: number, bottomInset: number) {
  const width = Math.min(GLASS_TAB_BAR.maxWidth, Math.max(0, viewportWidth - GLASS_TAB_BAR.horizontalMargin * 2));
  const contentWidth = Math.max(0, width - GLASS_TAB_BAR.insetHorizontal * 2);
  const slotWidth = contentWidth / PRIMARY_ROUTE_ORDER.length;
  const lensWidth = Math.max(GLASS_TAB_BAR.lensMinWidth, Math.min(slotWidth * GLASS_TAB_BAR.lensWidthRatio, GLASS_TAB_BAR.lensMaxWidth));
  const bottom = Math.max(bottomInset, 10) + 4;
  return { width, contentWidth, slotWidth, lensWidth, bottom, height: GLASS_TAB_BAR.height,
    contentBottomPadding: GLASS_TAB_BAR.height + bottom + GLASS_TAB_BAR.contentClearance };
}

/** Reserve the capped native text line without changing the approved capsule. */
export function getNavigationContentMetrics(fontScale = 1) {
  const scale = Number.isFinite(fontScale) && fontScale > 0
    ? Math.min(fontScale, GLASS_TAB_BAR.labelMaxFontSizeMultiplier) : 1;
  const labelHeight = Math.ceil(GLASS_TAB_BAR.labelLineHeight * scale);
  const iconTop = (GLASS_TAB_BAR.height - GLASS_TAB_BAR.iconSize - GLASS_TAB_BAR.labelGap - labelHeight) / 2;
  return { labelHeight, glyphTop: iconTop - GLASS_TAB_BAR.insetVertical };
}

export function getLensLeft(index: number, slotWidth: number, lensWidth: number) {
  "worklet";
  return (index + 0.5) * slotWidth - lensWidth / 2;
}

export function getNavigationTravelDuration(from: number, to: number) {
  "worklet";
  return Math.min(NAV_MOTION.maxTravelMs, NAV_MOTION.travelMs + Math.max(0, Math.abs(to - from) - 1) * NAV_MOTION.distanceStepMs);
}

export function getNavigationFadeDelay(from: number, to: number) {
  const duration = getNavigationTravelDuration(from, to);
  return Math.abs(to - from) <= 1 ? NAV_MOTION.fadeDelayMs : Math.round(duration * 0.72);
}

/** Continuous direct crossfade, including a new destination during a partial fade. */
export function retargetSceneWeights(current: readonly number[], destination: number, mix: number) {
  "worklet";
  return current.map((weight, index) => weight * (1 - mix) + (index === destination ? mix : 0));
}

export function sceneDestination(index: number) {
  return PRIMARY_ROUTE_ORDER.map((_, routeIndex) => routeIndex === index ? 1 : 0);
}
