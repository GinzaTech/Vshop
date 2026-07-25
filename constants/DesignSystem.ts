// ====== DesignSystem – Hệ thống thiết kế tập trung cho toàn bộ ứng dụng ======
// Chứa bảng màu chính (COLORS), bán kính bo góc (RADIUS),
// và các style toàn cục (GLOBAL_STYLES) dùng chung giữa các component.

import { Platform, StyleSheet } from "react-native";

/**
 * COLORS – Bảng màu chính của ứng dụng.
 *
 * ACCENT:         #687076 – Màu xám nhấn (dùng cho chi tiết phụ).
 * ACCENT_DEEP:    #1c2024 – Xám đậm hơn.
 * BACKGROUND:     #f4f6f9 – Màu nền tổng thể (xám rất nhạt).
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
  BACKGROUND: "#f4f6f9",
  SURFACE: "#ffffff",
  SURFACE_MUTED: "#eceef0",
  TEXT_PRIMARY: "#11181c",
  TEXT_SECONDARY: "#687076",
  BORDER: "rgba(0, 0, 0, 0.06)",
  OVERLAY: "rgba(17, 24, 28, 0.4)",
  PURE_WHITE: "#ffffff",
  PURE_BLACK: "#11181c",
  SUCCESS: "#30a46c",
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
};

/**
 * RADIUS – Bộ bán kính bo góc (borderRadius) thống nhất.
 *
 * screen: 32 – Bo góc màn hình / modal lớn.
 * card:   24 – Bo góc thẻ (GlassCard, v.v.).
 * chip:   999 – Bo góc tròn hoàn toàn (dạng pill / chip).
 * button: 22 – Bo góc nút bấm.
 */
export const RADIUS = {
  screen: 32,
  card: 24,
  chip: 999,
  button: 22,
};

/**
 * shadowStyle – Style đổ bóng, xử lý khác nhau giữa nền tảng.
 *
 * - Trên web: dùng boxShadow CSS.
 * - Trên mobile (iOS/Android): dùng shadowColor + shadowOffset + shadowOpacity
 *   + shadowRadius + elevation (Android).
 *
 * Giá trị: offset (0,16), opacity 0.16, radius 28, elevation Android 10.
 */
const shadowStyle =
  Platform.OS === "web"
    ? ({
        boxShadow: "0px 18px 30px rgba(23, 26, 31, 0.16)",
      } as any)
    : {
        shadowColor: "#171a1f",
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.16,
        shadowRadius: 28,
        elevation: 10,
      };

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
  shadow: shadowStyle,
});