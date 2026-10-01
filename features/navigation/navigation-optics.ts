import { GLASS_NAV_OPTICS } from "~/constants/DesignSystem";

/** Small UI-thread-only optical envelope; there is no timer or independent loop. */
export function getNavigationOptics(progress: number, direction: number, reduceMotion: boolean) {
  "worklet";
  if (reduceMotion || !Number.isFinite(progress) || progress <= 0 || progress >= 1) {
    return { leftOpacity: 0, rightOpacity: 0, offset: 0 };
  }
  const fringe = Math.max(0, Math.min(1, (progress - 0.12) / 0.16, (0.92 - progress) / 0.16));
  return {
    leftOpacity: fringe * GLASS_NAV_OPTICS.fringeLeftOpacity,
    rightOpacity: fringe * GLASS_NAV_OPTICS.fringeRightOpacity,
    offset: (Number.isFinite(direction) ? Math.sign(direction) : 0) * Math.sin(Math.PI * progress) * GLASS_NAV_OPTICS.refractionOffset,
  };
}
