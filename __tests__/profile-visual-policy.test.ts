import { COLORS } from "~/constants/DesignSystem";
import {
  getProfileChromeTone,
  getProfileContentBottomPadding,
  PROFILE_INFO_COLORS,
  PROFILE_SEASON_SELECTOR_LAYOUT,
  PROFILE_INFO_TYPOGRAPHY,
} from "~/features/profile/profile-visual-policy";

describe("profile visual policy", () => {
  it("uses a light shell for equipment and a fully dark shell for player data", () => {
    expect(getProfileChromeTone("profile")).toEqual({
      primaryNavigation: "dark",
      topInset: "light",
    });
    expect(getProfileChromeTone("player-info")).toEqual({
      primaryNavigation: "dark",
      topInset: "dark",
    });
  });

  it("uses a dark, readable data canvas backed by shared design tokens", () => {
    expect(PROFILE_INFO_COLORS).toMatchObject({
      background: COLORS.PURE_BLACK,
      card: COLORS.ACCENT_DEEP,
      surfaceSubtle: COLORS.VALORANT_DARK_BLUE,
      textPrimary: COLORS.PURE_WHITE,
      textSecondary: COLORS.ON_DARK_TEXT,
    });
    expect(PROFILE_INFO_COLORS.accent).not.toBe("#D5D1FF");
  });

  it("keeps every headline statistic on one numeric type scale", () => {
    expect(PROFILE_INFO_TYPOGRAPHY.summaryMetricValue).toBe(
      PROFILE_INFO_TYPOGRAPHY.performanceMetricValue
    );
  });

  it("keeps player-information content clear of the floating navigation", () => {
    expect(getProfileContentBottomPadding(0)).toBe(100);
    expect(getProfileContentBottomPadding(24)).toBe(116);
  });

  it("keeps the season selector visually compact with a 44dp effective target", () => {
    expect(PROFILE_SEASON_SELECTOR_LAYOUT).toEqual({
      chipHeight: 30,
      chipHitSlop: { bottom: 7, left: 3, right: 3, top: 7 },
      iconSize: 28,
      panelPaddingVertical: 8,
    });
    expect(
      PROFILE_SEASON_SELECTOR_LAYOUT.chipHeight +
        PROFILE_SEASON_SELECTOR_LAYOUT.chipHitSlop.top +
        PROFILE_SEASON_SELECTOR_LAYOUT.chipHitSlop.bottom
    ).toBeGreaterThanOrEqual(44);
  });
});
