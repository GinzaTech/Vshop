type Phase = "press-in" | "press" | "ui-kick" | "dispatch" | "kick-return" | "commit" | "settled";
type Sample = Readonly<{ phase: Phase; route: string; time: number }>;
type RenderSample = Readonly<{ route: string; phase: string; actual: number; base: number; start: number; commit: number }>;
type Profile = { enabled: boolean; events: readonly Sample[]; renders?: readonly RenderSample[] };
const runtime = globalThis as typeof globalThis & { __VSHOP_NAV_RESPONSE__?: Profile };
if (__DEV__) runtime.__VSHOP_NAV_RESPONSE__ ??= { enabled: false, events: [] };

/** Explicit DEV opt-in, bounded numeric timing only; no React state or console work. */
export function recordNavigationResponse(phase: Phase, route: string) {
  if (!__DEV__ || !runtime.__VSHOP_NAV_RESPONSE__?.enabled) return;
  if (!["bundles", "shop", "profile", "night_market", "settings"].includes(route)) return;
  const profile = runtime.__VSHOP_NAV_RESPONSE__;
  runtime.__VSHOP_NAV_RESPONSE__ = {
    ...profile,
    events: [...profile.events, { phase, route, time: performance.now() }].slice(-120),
  };
}

export function recordNavigationRender(route: string, phase: string, actual: number, base: number, start: number, commit: number) {
  if (!__DEV__ || !runtime.__VSHOP_NAV_RESPONSE__?.enabled) return;
  if (!["bundles", "shop", "profile", "night_market", "settings"].includes(route)) return;
  const profile = runtime.__VSHOP_NAV_RESPONSE__;
  runtime.__VSHOP_NAV_RESPONSE__ = {
    ...profile,
    renders: [...(profile.renders ?? []), { route, phase, actual, base, start, commit }].slice(-120),
  };
}
