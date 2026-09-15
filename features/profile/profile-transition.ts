export const PROFILE_HERO_EXPANDED_FALLBACK_HEIGHT = 292;
export const PROFILE_HERO_COMPACT_HEIGHT = 116;

type ProfileHeaderGeometryInput = {
  collapseOffset: number;
  expandedCollapseDistance: number;
  expandedHeroHeight: number;
  compactHeroHeight: number;
  modeProgress: number;
};

const clamp = (value: number, minimum: number, maximum: number) => {
  "worklet";
  return Math.min(maximum, Math.max(minimum, value));
};

/**
 * Dùng cùng modeProgress với hero để khoảng cách của body thay đổi đúng từng
 * frame. Nhờ vậy section đầu không phải chờ một vòng onLayout qua JS bridge.
 */
export function getProfileHeaderGeometry({
  collapseOffset,
  expandedCollapseDistance,
  expandedHeroHeight,
  compactHeroHeight,
  modeProgress,
}: ProfileHeaderGeometryInput) {
  "worklet";
  const progress = clamp(modeProgress, 0, 1);
  const heroHeightDelta = Math.max(0, expandedHeroHeight - compactHeroHeight);
  const collapseDistance = Math.max(
    0,
    expandedCollapseDistance - heroHeightDelta * progress
  );

  return {
    collapseDistance,
    collapseOffset: clamp(collapseOffset, 0, collapseDistance),
  };
}
