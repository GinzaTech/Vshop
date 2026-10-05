// ====== DesignSystem – Hệ thống thiết kế tập trung cho toàn bộ ứng dụng ======
// Chứa bảng màu chính (COLORS), bán kính bo góc (RADIUS),
// và các style toàn cục (GLOBAL_STYLES) dùng chung giữa các component.

import { Platform, StyleSheet, type ViewStyle } from "react-native";

/**
 * COLORS – Bảng màu chính của ứng dụng.
 *
 * ACCENT:         #687076 – Màu xám nhấn (dùng cho chi tiết phụ).
 * ACCENT_DEEP:    #1c2024 – Xám đậm hơn.
 * BACKGROUND:     #eceef0 – Màu nền tổng thể (xám trung tính).
 * SURFACE:        #ffffff – Màu nền thẻ / bề mặt (trắng).
 * SURFACE_MUTED:  #eceef0 – Nền bề mặt mờ (xám nhạt hơn).
 * TEXT_PRIMARY:   #11181c – Màu chữ chính (gần đen).
 * TEXT_SECONDARY: #687076 – Màu chữ phụ (xám).
 * BORDER:         rgba(0,0,0,0.06) – Đường viền trong suốt nhẹ.
 * OVERLAY:        rgba(17,24,28,0.4) – Lớp phủ tối (modal, backdrop).
 * PURE_WHITE:     #ffffff – Trắng tinh.
 * PURE_BLACK:     #11181c – Đen tinh.
 * SUCCESS:        #30a46c – Xanh lá (thành công).
 * WARNING:        #e5484d – Đỏ cảnh báo.
 * WARNING_SURFACE: #fdf7f7 – Nền cảnh báo (hồng nhạt).
 * WARNING_BORDER: #f3aeaf – Viền cảnh báo (hồng).
 * VALORANT_RED:   #ff4655 – Đỏ đặc trưng Valorant.
 * VALORANT_VIOLET: #7c3aed – Tím Valorant.
 * VALORANT_BLACK: #11181c – Đen Valorant.
 * VALORANT_DARK_BLUE: #1f2937 – Xanh đậm Valorant.
 * GLASS_WHITE:    rgba(255,255,255,0.85) – Trắng trong suốt (glassmorphism).
 * GLASS_WHITE_DIM: rgba(17,24,28,0.08) – Trắng mờ tối (glassmorphism dim).
 * GLASS_BORDER:   rgba(0,0,0,0.06) – Viền glassmorphism.
 */
export const COLORS = {
  ACCENT: "#687076",
  ACCENT_DEEP: "#1c2024",
  BACKGROUND: "#eceef0",
  SURFACE: "#ffffff",
  SURFACE_MUTED: "#eceef0",
  TEXT_PRIMARY: "#11181c",
  TEXT_SECONDARY: "#687076",
  TEXT_TERTIARY: "#889096",
  BORDER: "rgba(0, 0, 0, 0.06)",
  BORDER_STRONG: "rgba(0, 0, 0, 0.1)",
  OVERLAY: "rgba(17, 24, 28, 0.4)",
  MODAL_BACKDROP: "rgba(17, 24, 28, 0.62)",
  PURE_WHITE: "#ffffff",
  PURE_BLACK: "#11181c",
  SUCCESS: "#30a46c",
  STATUS_AWAY: "#d9952a",
  STATUS_BUSY: "#d64045",
  STATUS_INFO: "#3978c5",
  WARNING: "#e5484d",
  WARNING_SURFACE: "#fdf7f7",
  WARNING_BORDER: "#f3aeaf",
  VALORANT_RED: "#ff4655",
  VALORANT_VIOLET: "#7c3aed",
  VALORANT_BLACK: "#11181c",
  VALORANT_DARK_BLUE: "#1f2937",
  GLASS_WHITE: "rgba(255, 255, 255, 0.85)",
  GLASS_WHITE_DIM: "rgba(17, 24, 28, 0.08)",
  GLASS_BORDER: "rgba(0, 0, 0, 0.06)",
  ON_DARK_BORDER: "rgba(255, 255, 255, 0.12)",
  ON_DARK_TEXT: "rgba(255, 255, 255, 0.78)",
};

/** Shared optical material: light transmission, frosted lens and specular rims. */
export const GLASS_MATERIAL = {
  surface: "rgba(255, 255, 255, 0.88)",
  denseSurface: "rgba(255, 255, 255, 0.94)",
  chipSurface: "rgba(255, 255, 255, 0.66)",
  navVeil: "rgba(255, 255, 255, 0.58)",
  fallback: COLORS.SURFACE,
  frost: "rgba(236, 238, 240, 0.72)",
  lens: "rgba(235, 235, 235, 0.78)",
  lensFallback: "rgba(235, 235, 235, 0.92)",
  border: "rgba(255, 255, 255, 0.86)",
  innerBorder: "rgba(255, 255, 255, 0.48)",
  highlight: "rgba(255, 255, 255, 0.72)",
  highlightSoft: "rgba(255, 255, 255, 0.16)",
  clear: "rgba(255, 255, 255, 0)",
  shade: "rgba(17, 24, 28, 0.035)",
  // The reference's deeper red remains readable on the pale gray lens at 11sp.
  active: "#c72232",
  inactive: COLORS.TEXT_PRIMARY,
} as const;

// Explicit SVG-alpha counterparts of the shared glass colors above.
// react-native-svg 15.x overwrites rgba stop alpha unless stopOpacity is explicit.
export const GLASS_SVG_OPACITY = {
  highlight: 0.72,
  highlightSoft: 0.16,
  clear: 0,
  frost: 0.72,
  shade: 0.035,
} as const;

/** White Liquid Glass navigation; gray pages remain independent. */
export const NAV_GLASS_MATERIAL = {
  opaque: false,
  veil: "rgba(255, 255, 255, 0.24)",
  blurIntensity: 18,
  fallback: COLORS.PURE_WHITE,
  border: GLASS_MATERIAL.clear,
  lens: "rgba(255, 255, 255, 0.32)",
  nativeLensTint: "rgba(255, 255, 255, 0.12)",
  clearText: COLORS.TEXT_PRIMARY,
  clearSelectedText: COLORS.TEXT_PRIMARY,
  text: COLORS.TEXT_PRIMARY,
  selectedText: COLORS.TEXT_PRIMARY,
  activeIcon: COLORS.VALORANT_RED,
} as const;

/** Reference skin viewer: darker red keeps small white level labels readable. */
export const SKIN_PREVIEW_MATERIAL = {
  activeLevel: "#c23d48",
  surface: COLORS.SURFACE,
  frameFallback: COLORS.SURFACE_MUTED,
  backdrop: "rgba(17, 24, 28, 0.18)",
} as const;

// Optional optical details from navigation spec sections 5.3, 17–19.
// Keep separate from shared card opacity and the approved navigation geometry.
export const GLASS_NAV_OPTICS = {
  innerSeparator: "rgba(0, 0, 0, 0.025)",
  fringeLeft: "#ff3d5d",
  fringeRight: "#5078ff",
  fringeLeftOpacity: 0.18,
  fringeRightOpacity: 0.1,
  fringeWidth: 1.5,
  refractionOffset: 1.5,
} as const;

/** Bundle-only outline: visible on white without a tinted artwork backdrop. */
export const BUNDLE_SURFACE_BORDER = {
  color: COLORS.BORDER_STRONG,
  width: 1.5,
} as const;

export const GLASS_TAB_BAR = {
  horizontalMargin: 14,
  smallHorizontalMargin: 10,
  height: 54,
  smallHeight: 52,
  radius: 27,
  maxWidth: 420,
  insetHorizontal: 3,
  insetVertical: 2,
  iconSize: 24,
  labelSize: 11,
  labelLineHeight: 13,
  labelMaxFontSizeMultiplier: 1.3,
  labelGap: 1,
  lensHeight: 50,
  lensRadius: 25,
  lensWidthRatio: 1.26,
  lensMinWidth: 76,
  lensMaxWidth: 90,
  magnify: 1.065,
  contentClearance: 20,
} as const;

/**
 * RADIUS – Bộ bán kính bo góc (borderRadius) thống nhất.
 *
 * screen: 28 – Bo góc màn hình / modal lớn.
 * card:   18 – Bo góc thẻ (GlassCard, v.v.).
 * chip:   999 – Bo góc tròn hoàn toàn (dạng pill / chip).
 * button: 14 – Bo góc nút bấm.
 */
export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  screen: 28,
  card: 18,
  chip: 999,
  button: 14,
};

/** Clear silver lenses for the finite More grid, rendered over a shared light field. */
export const MORE_GLASS_MATERIAL = {
  background: COLORS.BACKGROUND,
  silver: COLORS.VALORANT_DARK_BLUE,
  tint: GLASS_MATERIAL.highlightSoft,
  highlight: COLORS.PURE_WHITE,
  edge: COLORS.BORDER_STRONG,
  radius: RADIUS.xl,
  whiteVeil: 0.08,
  refraction: 12,
  bevelWidth: 14,
  magnification: 1.025,
  wallpaperStrength: 0.72,
} as const;

/**
 * SPACING – Thang khoảng cách (px) thống nhất: xxs(4) → xxl(32).
 * Dùng cho margin/padding/gap thay vì số lẻ tự chọn.
 */
export const SPACING = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

/**
 * TYPOGRAPHY – Thang cỡ chữ (px) thống nhất: caption(12) → display(28).
 */
export const TYPOGRAPHY = {
  captionSmall: 11,
  caption: 12,
  bodyCompact: 13,
  bodySmall: 14,
  body: 16,
  titleSmall: 18,
  title: 22,
  display: 28,
} as const;

/**
 * LAYOUT – Hằng số bố cục chung: padding màn hình, gap giữa section,
 * vùng chạm tối thiểu (44px theo chuẩn accessibility) và chiều cao bottom nav.
 */
export const LAYOUT = {
  screenPadding: 20,
  compactScreenPadding: 16,
  sectionGap: 24,
  minTouchTarget: 44,
  bottomNavHeight: 78,
} as const;

/**
 * shadowStyle – Style đổ bóng, xử lý khác nhau giữa nền tảng.
 *
 * - Trên web: dùng boxShadow CSS.
 * - Trên mobile (iOS/Android): dùng shadowColor + shadowOffset + shadowOpacity
 *   + shadowRadius + elevation (Android).
 *
 * Bóng được chia theo cấp để card, navigation và modal dùng đúng độ sâu.
 */
function createShadow(
  y: number,
  blur: number,
  opacity: number,
  elevation: number,
): ViewStyle {
  if (Platform.OS === "web") {
    return { boxShadow: `0px ${y}px ${blur}px rgba(23, 26, 31, ${opacity})` };
  }

  return {
    shadowColor: "#171a1f",
    shadowOffset: { width: 0, height: y },
    shadowOpacity: opacity,
    shadowRadius: blur / 2,
    elevation,
  };
}

/**
 * SHADOWS – Bộ bóng chia cấp (xs → lg) tạo bởi createShadow.
 * none: không bóng; xs/sm: card, chip; md: panel nổi;
 * lg: chỉ dành cho sheet/dialog/popover (không dùng cho card).
 */
export const SHADOWS = {
  none: {} as ViewStyle,
  xs: createShadow(1, 4, 0.04, 1),
  sm: createShadow(2, 8, 0.06, 2),
  md: createShadow(4, 12, 0.1, 4),
  // Reserved for sheets, dialogs and popovers. Never use this for cards.
  lg: createShadow(8, 20, 0.14, 8),
} as const;

/**
 * GLOBAL_STYLES – StyleSheet chứa các style dùng chung.
 *
 * glassContainer:
 *   - backgroundColor: SURFACE (trắng)
 *   - borderColor: BORDER (viền mờ)
 *   - borderWidth: 1
 *   - overflow: "hidden" (giữ bo góc không bị tràn)
 *
 * shadow:
 *   - Đổ bóng (xem shadowStyle ở trên)
 */
export const GLOBAL_STYLES = StyleSheet.create({
  glassContainer: {
    backgroundColor: COLORS.SURFACE,
    borderColor: COLORS.BORDER,
    borderWidth: 1,
    overflow: "hidden",
  },
  shadow: SHADOWS.sm,
});
