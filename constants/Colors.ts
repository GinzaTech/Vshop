// ====== Colors – Bảng màu cơ bản cho theme sáng / tối (mẫu mặc định từ Expo) ======
// Định nghĩa màu sắc cho light mode và dark mode.
// Lưu ý: Dự án hiện tại dùng bảng COLORS trong DesignSystem.ts làm chính,
// còn Colors.ts là bảng màu gốc do Expo tạo ra và được giữ lại để tham khảo.

/**
 * tintColorLight: Màu xanh dương (#0a7ea4) dùng làm màu nhấn (tint) cho light mode.
 */
const tintColorLight = '#0a7ea4';

/**
 * tintColorDark: Màu trắng (#fff) dùng làm màu nhấn (tint) cho dark mode.
 */
const tintColorDark = '#fff';

/**
 * Colors – Object chứa hai bảng màu light và dark.
 *
 * light:
 *   - text: '#11181C' – chữ gần đen
 *   - background: '#fff' – nền trắng
 *   - tint: tintColorLight – màu nhấn xanh
 *   - icon: '#687076' – màu icon xám
 *   - tabIconDefault / tabIconSelected: màu icon tab mặc định / khi được chọn
 *
 * dark:
 *   - text: '#ECEDEE' – chữ gần trắng
 *   - background: '#151718' – nền tối
 *   - tint: tintColorDark – màu nhấn trắng
 *   - icon: '#9BA1A6' – màu icon xám nhạt
 *   - tabIconDefault / tabIconSelected: tương tự light
 */
export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};