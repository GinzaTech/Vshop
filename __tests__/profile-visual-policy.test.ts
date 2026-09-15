import { COLORS } from "~/constants/DesignSystem";
import {
  getProfileChromeTone,
  getProfileContentBottomPadding,
  PROFILE_INFO_COLORS,
  PROFILE_INFO_TYPOGRAPHY,
} from "~/features/profile/profile-visual-policy";

describe("profile visual policy", () => {
  it.each(["profile", "player-info"] as const)(
    "keeps the %s mode inside the same light application shell",
    (mode) => {
      expect(getProfileChromeTone(mode)).toEqual({
        primaryNavigation: "dark",
        topInset: "light",
      });
    }
  );

  it("uses a dark, readable data canvas backed by shared design tokens", () => {
    expect(PROFILE_INFO_COLORS).toMatchObject({
      background: COLORS.ACCENT_DEEP,
      card: COLORS.VALORANT_DARK_BLUE,
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
});
