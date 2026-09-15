import { COLORS } from "~/constants/DesignSystem";
import { getPrimaryTabContentBottomPadding } from "~/constants/Layout";
import type { TopInsetTone } from "~/hooks/useSystemChromeStore";

export type ProfileVisualMode = "profile" | "player-info";

type ProfileChromeTone = {
  primaryNavigation: TopInsetTone;
  topInset: TopInsetTone;
};

/**
 * Màu dùng riêng cho vùng dữ liệu. Canvas tối tách thông tin khỏi màn trang bị
 * nhưng mọi giá trị vẫn trỏ về token chung của ứng dụng.
 */
export const PROFILE_INFO_COLORS = {
  accent: COLORS.VALORANT_VIOLET,
  background: COLORS.ACCENT_DEEP,
  border: COLORS.ON_DARK_BORDER,
  borderSubtle: COLORS.ON_DARK_BORDER,
  card: COLORS.VALORANT_DARK_BLUE,
  divider: COLORS.ON_DARK_BORDER,
  negative: COLORS.WARNING,
  positive: COLORS.SUCCESS,
  sectionAccent: COLORS.VALORANT_RED,
  skeletonBase: COLORS.PURE_BLACK,
  skeletonHighlight: COLORS.VALORANT_DARK_BLUE,
  surfaceSubtle: COLORS.PURE_BLACK,
  textMuted: COLORS.TEXT_TERTIARY,
  textPrimary: COLORS.PURE_WHITE,
  textSecondary: COLORS.ON_DARK_TEXT,
} as const;

/** Một thang số nổi bật duy nhất giúp bảng tổng quan không bị lệch cấp độ. */
export const PROFILE_INFO_TYPOGRAPHY = {
  summaryMetricValue: 22,
  performanceMetricValue: 22,
  detailMetricValue: 14,
} as const;

/**
 * Header hệ thống vẫn sáng ở cả hai mode; vùng dữ liệu tự đổi nền bên dưới.
 */
export function getProfileChromeTone(
  _mode: ProfileVisualMode
): ProfileChromeTone {
  return {
    primaryNavigation: "dark",
    topInset: "light",
  };
}

/**
 * Dùng cùng công thức khoảng trống với các primary tab còn lại.
 */
export function getProfileContentBottomPadding(bottomInset: number) {
  return getPrimaryTabContentBottomPadding(bottomInset);
}
